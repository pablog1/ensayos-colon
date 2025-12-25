import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/services/notifications"
import { createAuditLog } from "@/lib/services/audit"

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

  if (rotativo.estado !== "PENDIENTE") {
    return NextResponse.json(
      { error: "Solo se pueden rechazar rotativos pendientes" },
      { status: 400 }
    )
  }

  // Create notification before deleting
  await createNotification({
    userId: rotativo.userId,
    type: "ROTATIVO_RECHAZADO",
    title: "Rotativo rechazado",
    message: `Tu solicitud de rotativo para "${rotativo.event.title}" ha sido rechazada`,
    data: {
      eventId: rotativo.eventId,
      eventTitle: rotativo.event.title,
      eventDate: rotativo.event.date.toISOString(),
    },
  })

  // Create audit log before deleting
  await createAuditLog({
    action: "ROTATIVO_RECHAZADO",
    entityType: "Rotativo",
    entityId: id,
    userId: session.user.id,
    targetUserId: rotativo.userId,
    details: {
      evento: rotativo.event.title,
      fecha: rotativo.event.date.toISOString(),
    },
  })

  // Al rechazar, eliminamos el rotativo
  await prisma.rotativo.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
