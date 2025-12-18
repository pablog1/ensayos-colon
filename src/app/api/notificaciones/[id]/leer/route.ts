import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { markAsRead } from "@/lib/services/notifications"
import { prisma } from "@/lib/prisma"

// POST /api/notificaciones/[id]/leer - Marcar notificacion como leida
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  // Verificar que la notificacion pertenece al usuario
  const notification = await prisma.notification.findUnique({
    where: { id },
  })

  if (!notification) {
    return NextResponse.json(
      { error: "Notificación no encontrada" },
      { status: 404 }
    )
  }

  if (notification.userId !== session.user.id) {
    return NextResponse.json(
      { error: "No tienes permiso para esta notificación" },
      { status: 403 }
    )
  }

  await markAsRead(id)

  return NextResponse.json({ success: true })
}
