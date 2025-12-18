import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUserNotifications, getUnreadCount } from "@/lib/services/notifications"

// GET /api/notificaciones - Obtener notificaciones del usuario
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get("unread") === "true"
  const limit = parseInt(searchParams.get("limit") ?? "50")

  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(session.user.id, { unreadOnly, limit }),
    getUnreadCount(session.user.id),
  ])

  return NextResponse.json({
    notifications,
    unreadCount,
  })
}
