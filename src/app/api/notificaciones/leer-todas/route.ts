import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { markAllAsRead } from "@/lib/services/notifications"

// POST /api/notificaciones/leer-todas - Marcar todas como leidas
export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  await markAllAsRead(session.user.id)

  return NextResponse.json({ success: true })
}
