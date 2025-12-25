import { prisma } from "@/lib/prisma"
import { Prisma, type NotificationType } from "@/generated/prisma"

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
}

export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data ? (params.data as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  })
}

export async function notifyAdmins(params: Omit<CreateNotificationParams, "userId">): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  })

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data ? (params.data as Prisma.InputJsonValue) : Prisma.JsonNull,
    })),
  })
}

export async function getUserNotifications(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number; skip?: number }
) {
  // Limitar a notificaciones de los últimos 12 meses
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  return prisma.notification.findMany({
    where: {
      userId,
      createdAt: { gte: twelveMonthsAgo },
      ...(options?.unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.skip ?? 0,
  })
}

export async function countUserNotifications(
  userId: string,
  options?: { unreadOnly?: boolean }
): Promise<number> {
  // Limitar a notificaciones de los últimos 12 meses
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  return prisma.notification.count({
    where: {
      userId,
      createdAt: { gte: twelveMonthsAgo },
      ...(options?.unreadOnly ? { read: false } : {}),
    },
  })
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  })
}

export async function markAsRead(notificationId: string): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  })
}

export async function markAllAsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  })
}
