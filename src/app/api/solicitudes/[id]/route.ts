import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"
import { createNotification } from "@/lib/services/notifications"
import { promoteFromWaitingList, removeFromWaitingList } from "@/lib/services/waiting-list"
import type { AuditAction } from "@/generated/prisma"
import { formatTimeAR, formatDateAR } from "@/lib/utils"

// DELETE /api/solicitudes/[id] - Cancelar rotativo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  // Get request body for reason (optional for admins)
  let motivoEliminacion: string | undefined
  try {
    const body = await req.json()
    motivoEliminacion = body.motivo
  } catch {
    // No body provided, that's fine
  }

  const rotativo = await prisma.rotativo.findUnique({
    where: { id },
    include: {
      event: {
        select: { id: true, date: true, title: true, startTime: true, eventoType: true, titulo: { select: { name: true } } },
      },
      user: {
        select: { id: true, name: true, alias: true },
      },
    },
  })

  if (!rotativo) {
    return NextResponse.json(
      { error: "Rotativo no encontrado" },
      { status: 404 }
    )
  }

  // Check permissions
  const isOwner = rotativo.userId === session.user.id
  const isAdmin = session.user.role === "ADMIN"

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "No tienes permiso para cancelar este rotativo" },
      { status: 403 }
    )
  }

  // Calcular diferencia de dias hasta el evento
  const ahora = new Date()
  const hoyUTC = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())
  const eventoDate = new Date(rotativo.event.date)
  const fechaEventoUTC = Date.UTC(eventoDate.getUTCFullYear(), eventoDate.getUTCMonth(), eventoDate.getUTCDate())
  const diasHastaEvento = Math.floor((fechaEventoUTC - hoyUTC) / (1000 * 60 * 60 * 24))
  const esEventoPasado = diasHastaEvento < 0
  const esCancelacionTardia = diasHastaEvento <= 1 && !esEventoPasado

  // Only restrict past events for non-admins
  if (esEventoPasado && !isAdmin) {
    return NextResponse.json(
      { error: "No se puede cancelar un rotativo de un evento pasado" },
      { status: 400 }
    )
  }

  // NUEVA REGLA: Cancelaciones tardias (<=1 dia) requieren aprobacion
  // Solo aplica a usuarios, admins pueden cancelar directamente
  if (esCancelacionTardia && !isAdmin && isOwner) {
    // No eliminar, marcar como CANCELACION_PENDIENTE
    await prisma.rotativo.update({
      where: { id },
      data: {
        estado: "CANCELACION_PENDIENTE",
        motivo: motivoEliminacion || "Cancelacion tardia solicitada por el usuario",
      },
    })

    // Audit log
    await createAuditLog({
      action: "ROTATIVO_CANCELADO",
      entityType: "Rotativo",
      entityId: id,
      userId: session.user.id,
      details: {
        evento: rotativo.event.title,
        titulo: rotativo.event.titulo?.name,
        fecha: rotativo.event.date.toISOString(),
        horario: formatTimeAR(rotativo.event.startTime),
        tipoEvento: rotativo.event.eventoType,
        esCancelacionTardia: true,
        diasHastaEvento,
        estadoAnterior: rotativo.estado,
        nuevoEstado: "CANCELACION_PENDIENTE",
        motivo: motivoEliminacion,
      },
    })

    // Notificar a admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    })

    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: "SOLICITUD_PENDIENTE",
        title: "Cancelacion tardia pendiente",
        message: `${rotativo.user.alias || rotativo.user.name} solicita cancelar rotativo del ${formatDateAR(eventoDate)} (${diasHastaEvento} dias de anticipacion)`,
      })
    }

    return NextResponse.json({
      success: true,
      pendiente: true,
      message: "Cancelacion solicitada. Requiere aprobacion de un administrador por ser con menos de 1 dia de anticipacion.",
    })
  }

  // Cancelacion normal (>1 dia de anticipacion o admin)
  const eliminaAjeno = !isOwner && isAdmin
  const isCritical = eliminaAjeno || esEventoPasado

  // Determine audit action
  let auditAction: AuditAction = "ROTATIVO_CANCELADO"
  if (esEventoPasado) {
    auditAction = "ROTATIVO_PASADO_ELIMINADO"
  } else if (eliminaAjeno) {
    auditAction = "ROTATIVO_ELIMINADO_ADMIN"
  }

  // Guardar info antes de eliminar
  const eventId = rotativo.eventId
  const estadoAnterior = rotativo.estado

  // Create audit log before deleting
  await createAuditLog({
    action: auditAction,
    entityType: "Rotativo",
    entityId: id,
    userId: session.user.id,
    targetUserId: eliminaAjeno ? rotativo.userId : undefined,
    isCritical,
    details: {
      evento: rotativo.event.title,
      titulo: rotativo.event.titulo?.name,
      fecha: rotativo.event.date.toISOString(),
      horario: formatTimeAR(rotativo.event.startTime),
      tipoEvento: rotativo.event.eventoType,
      esEventoPasado,
      esCancelacionTardia,
      diasHastaEvento,
      eliminaAjeno,
      usuarioAfectado: rotativo.user.alias || rotativo.user.name,
      motivo: motivoEliminacion,
      realizadoPor: session.user.name || session.user.email,
    },
  })

  // Si el rotativo estaba en espera, removerlo de la lista de espera
  if (estadoAnterior === "EN_ESPERA") {
    await removeFromWaitingList(rotativo.userId, eventId)
  }

  // Eliminar el rotativo
  await prisma.rotativo.delete({
    where: { id },
  })

  // Si el rotativo libero un cupo (estaba APROBADO o PENDIENTE), promover desde lista de espera
  if (estadoAnterior === "APROBADO" || estadoAnterior === "PENDIENTE") {
    await promoteFromWaitingList(eventId)
  }

  // Si el rotativo era parte de un bloque, verificar si el bloque quedó vacío
  if (rotativo.esParteDeBloqueId) {
    const rotativosRestantes = await prisma.rotativo.count({
      where: {
        esParteDeBloqueId: rotativo.esParteDeBloqueId,
        estado: { in: ["APROBADO", "PENDIENTE", "EN_ESPERA", "CANCELACION_PENDIENTE"] },
      },
    })

    if (rotativosRestantes === 0) {
      await prisma.block.update({
        where: { id: rotativo.esParteDeBloqueId },
        data: {
          estado: "CANCELADO",
          assignedToId: null,
        },
      })

      const temporadaActiva = await prisma.season.findFirst({
        where: { isActive: true },
      })

      if (temporadaActiva) {
        await prisma.userSeasonBalance.updateMany({
          where: {
            userId: rotativo.userId,
            seasonId: temporadaActiva.id,
          },
          data: { bloqueUsado: false },
        })
      }
    }
  }

  return NextResponse.json({ success: true })
}
