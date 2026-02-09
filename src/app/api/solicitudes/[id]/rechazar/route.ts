import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/services/notifications"
import { createAuditLog } from "@/lib/services/audit"
import { promoteFromWaitingList, removeFromWaitingList } from "@/lib/services/waiting-list"
import { formatDateLongAR, formatTimeAR } from "@/lib/utils"

// POST /api/solicitudes/[id]/rechazar - Rechazar rotativo pendiente (solo admin)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden rechazar solicitudes" },
      { status: 403 }
    )
  }

  const { id } = await params

  const rotativo = await prisma.rotativo.findUnique({
    where: { id },
    include: {
      event: {
        select: {
          title: true,
          date: true,
          startTime: true,
          eventoType: true,
        },
      },
    },
  })

  if (!rotativo) {
    return NextResponse.json(
      { error: "Rotativo no encontrado" },
      { status: 404 }
    )
  }

  if (rotativo.estado !== "PENDIENTE" && rotativo.estado !== "EN_ESPERA") {
    return NextResponse.json(
      { error: "Solo se pueden rechazar rotativos pendientes o en espera" },
      { status: 400 }
    )
  }

  const estabaEnEspera = rotativo.estado === "EN_ESPERA"

  // Obtener motivo de rechazo del body (opcional)
  let motivoRechazo: string | null = null
  try {
    const body = await req.json()
    motivoRechazo = body.motivo || null
  } catch {
    // No body provided, that's ok
  }

  // Actualizar estado a RECHAZADO (no eliminar)
  const updated = await prisma.rotativo.update({
    where: { id },
    data: {
      estado: "RECHAZADO",
      rechazadoPor: session.user.id,
      motivo: motivoRechazo || rotativo.motivo,
    },
  })

  // Create notification
  const fechaStr = formatDateLongAR(rotativo.event.date)
  const horaStr = rotativo.event.startTime
    ? ` a las ${formatTimeAR(rotativo.event.startTime)}`
    : ""
  const tipoStr = rotativo.event.eventoType ? ` (${rotativo.event.eventoType})` : ""

  await createNotification({
    userId: rotativo.userId,
    type: "ROTATIVO_RECHAZADO",
    title: "Rotativo rechazado",
    message: `Tu solicitud de rotativo para "${rotativo.event.title}" el ${fechaStr}${horaStr}${tipoStr} ha sido rechazada${motivoRechazo ? `: ${motivoRechazo}` : ""}`,
    data: {
      eventId: rotativo.eventId,
      eventTitle: rotativo.event.title,
      eventDate: rotativo.event.date.toISOString(),
      eventStartTime: rotativo.event.startTime?.toISOString(),
      eventType: rotativo.event.eventoType,
      motivo: motivoRechazo,
    },
  })

  // Create audit log
  await createAuditLog({
    action: "ROTATIVO_RECHAZADO",
    entityType: "Rotativo",
    entityId: id,
    userId: session.user.id,
    targetUserId: rotativo.userId,
    details: {
      evento: rotativo.event.title,
      fecha: rotativo.event.date.toISOString(),
      horario: formatTimeAR(rotativo.event.startTime),
      tipoEvento: rotativo.event.eventoType,
      motivo: motivoRechazo,
    },
  })

  if (estabaEnEspera) {
    // Si estaba en espera, remover de la lista de espera
    await removeFromWaitingList(rotativo.userId, rotativo.eventId)
    // Promover al siguiente en la lista (si hay cupo)
    await promoteFromWaitingList(rotativo.eventId)
  } else {
    // Si estaba pendiente, promover desde lista de espera si hay alguien esperando
    await promoteFromWaitingList(rotativo.eventId)
  }

  return NextResponse.json(updated)
}
