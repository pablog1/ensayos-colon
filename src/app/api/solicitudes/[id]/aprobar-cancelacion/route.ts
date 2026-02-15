import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"
import { createNotification } from "@/lib/services/notifications"
import { promoteFromWaitingList } from "@/lib/services/waiting-list"
import { formatTimeAR, formatDateAR } from "@/lib/utils"

// POST /api/solicitudes/[id]/aprobar-cancelacion - Aprobar cancelacion tardia
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Solo admin puede aprobar cancelaciones
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden aprobar cancelaciones" },
      { status: 403 }
    )
  }

  const { id } = await params

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

  if (rotativo.estado !== "CANCELACION_PENDIENTE") {
    return NextResponse.json(
      { error: "Este rotativo no tiene una cancelacion pendiente" },
      { status: 400 }
    )
  }

  const eventId = rotativo.eventId

  // Audit log
  await createAuditLog({
    action: "ROTATIVO_CANCELADO",
    entityType: "Rotativo",
    entityId: id,
    userId: session.user.id,
    targetUserId: rotativo.userId,
    details: {
      evento: rotativo.event.title,
      titulo: rotativo.event.titulo?.name,
      fecha: rotativo.event.date.toISOString(),
      horario: formatTimeAR(rotativo.event.startTime),
      tipoEvento: rotativo.event.eventoType,
      accion: "cancelacion_tardia_aprobada",
      aprobadoPor: session.user.name || session.user.email,
    },
  })

  // Eliminar el rotativo
  await prisma.rotativo.delete({
    where: { id },
  })

  // Promover desde lista de espera
  await promoteFromWaitingList(eventId)

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

  // Notificar al usuario
  await createNotification({
    userId: rotativo.userId,
    type: "ROTATIVO_RECHAZADO",
    title: "Cancelacion aprobada",
    message: `Tu solicitud de cancelacion del rotativo del ${formatDateAR(new Date(rotativo.event.date))} fue aprobada`,
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/solicitudes/[id]/aprobar-cancelacion - Rechazar cancelacion (restaurar rotativo)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden rechazar cancelaciones" },
      { status: 403 }
    )
  }

  const { id } = await params

  const rotativo = await prisma.rotativo.findUnique({
    where: { id },
    include: {
      event: {
        select: { date: true, title: true, startTime: true, eventoType: true, titulo: { select: { name: true } } },
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

  if (rotativo.estado !== "CANCELACION_PENDIENTE") {
    return NextResponse.json(
      { error: "Este rotativo no tiene una cancelacion pendiente" },
      { status: 400 }
    )
  }

  // Restaurar el rotativo a APROBADO
  await prisma.rotativo.update({
    where: { id },
    data: {
      estado: "APROBADO",
      motivo: "Cancelacion tardia rechazada por administrador",
    },
  })

  // Audit log
  await createAuditLog({
    action: "ROTATIVO_APROBADO",
    entityType: "Rotativo",
    entityId: id,
    userId: session.user.id,
    targetUserId: rotativo.userId,
    details: {
      evento: rotativo.event.title,
      titulo: rotativo.event.titulo?.name,
      fecha: rotativo.event.date.toISOString(),
      horario: formatTimeAR(rotativo.event.startTime),
      tipoEvento: rotativo.event.eventoType,
      accion: "cancelacion_tardia_rechazada",
      rechazadoPor: session.user.name || session.user.email,
    },
  })

  // Notificar al usuario
  await createNotification({
    userId: rotativo.userId,
    type: "ROTATIVO_RECHAZADO",
    title: "Cancelacion rechazada",
    message: `Tu solicitud de cancelacion del rotativo del ${formatDateAR(new Date(rotativo.event.date))} fue rechazada. El rotativo sigue activo.`,
  })

  return NextResponse.json({ success: true })
}
