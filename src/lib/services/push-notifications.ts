import webpush from "web-push"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma"

// Configurar VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:admin@teatrocolon.org.ar",
    vapidPublicKey,
    vapidPrivateKey
  )
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
}

/**
 * Enviar notificación push a un usuario específico
 */
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushSubscription: true, pushEnabled: true },
    })

    if (!user?.pushEnabled || !user?.pushSubscription) {
      return false
    }

    const subscription = user.pushSubscription as unknown as webpush.PushSubscription

    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || "/icons/icon-192.png",
        badge: payload.badge || "/icons/icon-192.png",
        url: payload.url || "/",
        tag: payload.tag || "notification",
      })
    )

    return true
  } catch (error: unknown) {
    console.error(`[Push] Error enviando a usuario ${userId}:`, error)

    // Si la suscripción expiró o es inválida, deshabilitarla
    if (error && typeof error === "object" && "statusCode" in error) {
      const pushError = error as { statusCode: number }
      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        await prisma.user.update({
          where: { id: userId },
          data: { pushEnabled: false, pushSubscription: Prisma.DbNull },
        })
        console.log(`[Push] Suscripción inválida removida para usuario ${userId}`)
      }
    }

    return false
  }
}

/**
 * Enviar notificación push a múltiples usuarios
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (const userId of userIds) {
    const success = await sendPushToUser(userId, payload)
    if (success) {
      sent++
    } else {
      failed++
    }
  }

  return { sent, failed }
}

/**
 * Enviar notificación push a todos los admins
 */
export async function sendPushToAdmins(
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      pushEnabled: true,
      pushSubscription: { not: Prisma.DbNull },
    },
    select: { id: true },
  })

  return sendPushToUsers(
    admins.map((a) => a.id),
    payload
  )
}

/**
 * Enviar notificación push a todos los usuarios con push habilitado
 */
export async function sendPushToAll(
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: {
      pushEnabled: true,
      pushSubscription: { not: Prisma.DbNull },
    },
    select: { id: true },
  })

  return sendPushToUsers(
    users.map((u) => u.id),
    payload
  )
}
