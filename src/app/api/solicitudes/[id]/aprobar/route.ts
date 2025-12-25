import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/services/notifications"
import { createAuditLog } from "@/lib/services/audit"

// POST /api/solicitudes/[id]/aprobar - Aprobar rotativo pendiente (solo admin)
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
      { error: "Solo administradores pueden aprobar solicitudes" },
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
      { error: "Solo se pueden aprobar rotativos pendientes" },
      { status: 400 }
    )
  }

  const updated = await prisma.rotativo.update({
    where: { id },
    data: {
      estado: "APROBADO",
      aprobadoPor: session.user.id,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      event: true,
    },
  })

  // Create notification for user
  await createNotification({
    userId: updated.userId,
    type: "ROTATIVO_APROBADO",
    title: "Rotativo aprobado",
    message: `Tu solicitud de rotativo para "${updated.event.title}" ha sido aprobada`,
    data: {
      rotativoId: updated.id,
      eventId: updated.eventId,
      eventTitle: updated.event.title,
      eventDate: updated.event.date.toISOString(),
    },
  })

  // Create audit log
  await createAuditLog({
    action: "ROTATIVO_APROBADO",
    entityType: "Rotativo",
    entityId: updated.id,
    userId: session.user.id,
    targetUserId: updated.userId,
    details: {
      evento: updated.event.title,
      fecha: updated.event.date.toISOString(),
    },
  })

  return NextResponse.json(updated)
}
