import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUserNotifications, getUnreadCount, markAllAsRead, countUserNotifications } from "@/lib/services/notifications"

// GET /api/notifications - Get user notifications
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get("unreadOnly") === "true"
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined
  const skip = searchParams.get("skip") ? parseInt(searchParams.get("skip")!) : undefined

  const notifications = await getUserNotifications(session.user.id, {
    unreadOnly,
    limit,
    skip,
  })

  const unreadCount = await getUnreadCount(session.user.id)
  const totalCount = await countUserNotifications(session.user.id, { unreadOnly })

  return NextResponse.json({
    notifications,
    unreadCount,
    totalCount,
  })
}

// PATCH /api/notifications - Mark all as read
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  await markAllAsRead(session.user.id)

  return NextResponse.json({ success: true })
}
