import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"
import { promoteFromWaitingList } from "@/lib/services/waiting-list"

// POST /api/bloques/cancelar - Cancelar todos los rotativos de un bloque
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()
  const { bloqueId, motivo } = body

  if (!bloqueId) {
    return NextResponse.json({ error: "bloqueId es requerido" }, { status: 400 })
  }

  // Obtener el bloque con sus rotativos
  const bloque = await prisma.block.findUnique({
    where: { id: bloqueId },
    include: {
      rotativos: {
        include: {
          event: {
            select: { id: true, date: true, title: true },
          },
        },
      },
      assignedTo: {
        select: { id: true, name: true, alias: true },
      },
    },
  })

  if (!bloque) {
    return NextResponse.json({ error: "Bloque no encontrado" }, { status: 404 })
  }

  // Verificar permisos
  const isOwner = bloque.assignedToId === session.user.id
  const isAdmin = session.user.role === "ADMIN"

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "No tienes permiso para cancelar este bloque" },
      { status: 403 }
    )
  }

  // Filtrar solo rotativos futuros y activos (APROBADO, PENDIENTE)
  const ahora = new Date()
  ahora.setHours(0, 0, 0, 0)

  const rotativosCancelables = bloque.rotativos.filter((r) => {
    const fechaEvento = new Date(r.event.date)
    return fechaEvento >= ahora && (r.estado === "APROBADO" || r.estado === "PENDIENTE")
  })

  if (rotativosCancelables.length === 0) {
    return NextResponse.json(
      { error: "No hay rotativos futuros para cancelar en este bloque" },
      { status: 400 }
    )
  }

  // Verificar si hay eventos muy cercanos (<=1 día)
  const rotativosCercanos = rotativosCancelables.filter((r) => {
    const fechaEvento = new Date(r.event.date)
    const diasHasta = Math.ceil((fechaEvento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
    return diasHasta <= 1
  })

  // Si hay rotativos cercanos y no es admin, requiere aprobación
  if (rotativosCercanos.length > 0 && !isAdmin) {
    // Marcar como cancelación pendiente
    for (const rotativo of rotativosCancelables) {
      await prisma.rotativo.update({
        where: { id: rotativo.id },
        data: {
          estado: "CANCELACION_PENDIENTE",
          motivo: motivo || "Cancelación de bloque solicitada por el usuario",
        },
      })
    }

    // Notificar a admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    })

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: "SOLICITUD_PENDIENTE",
          title: "Cancelación de bloque pendiente",
          message: `${bloque.assignedTo?.alias || bloque.assignedTo?.name} solicita cancelar ${rotativosCancelables.length} rotativos del bloque "${bloque.name}"`,
        },
      })
    }

    await createAuditLog({
      action: "BLOQUE_CANCELADO",
      entityType: "Block",
      entityId: bloqueId,
      userId: session.user.id,
      details: {
        bloque: bloque.name,
        rotativosCancelados: rotativosCancelables.length,
        requiereAprobacion: true,
        motivo,
      },
    })

    return NextResponse.json({
      success: true,
      pendiente: true,
      rotativosCancelados: rotativosCancelables.length,
      message: `Cancelación de ${rotativosCancelables.length} rotativos solicitada. Requiere aprobación por incluir eventos cercanos.`,
    })
  }

  // Cancelación directa (admin o eventos lejanos)
  const eventosPromocionados: string[] = []

  for (const rotativo of rotativosCancelables) {
    const eventId = rotativo.eventId

    await prisma.rotativo.delete({
      where: { id: rotativo.id },
    })

    // Promover desde lista de espera
    const promoted = await promoteFromWaitingList(eventId)
    if (promoted) {
      eventosPromocionados.push(eventId)
    }
  }

  // Actualizar estado del bloque
  await prisma.block.update({
    where: { id: bloqueId },
    data: {
      estado: "CANCELADO",
      assignedToId: null,
    },
  })

  // Actualizar balance del usuario (liberar bloqueUsado)
  const temporadaActiva = await prisma.season.findFirst({
    where: { isActive: true },
  })

  if (temporadaActiva && bloque.assignedToId) {
    await prisma.userSeasonBalance.updateMany({
      where: {
        userId: bloque.assignedToId,
        seasonId: temporadaActiva.id,
      },
      data: { bloqueUsado: false },
    })
  }

  await createAuditLog({
    action: "BLOQUE_CANCELADO",
    entityType: "Block",
    entityId: bloqueId,
    userId: session.user.id,
    details: {
      bloque: bloque.name,
      rotativosCancelados: rotativosCancelables.length,
      eventosPromocionados: eventosPromocionados.length,
      motivo,
    },
  })

  return NextResponse.json({
    success: true,
    rotativosCancelados: rotativosCancelables.length,
    eventosPromocionados: eventosPromocionados.length,
    message: `Bloque cancelado. ${rotativosCancelables.length} rotativos eliminados.`,
  })
}
