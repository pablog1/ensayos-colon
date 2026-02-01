import { prisma } from "@/lib/prisma"
import { Prisma, type NotificationType } from "@/generated/prisma"
import { sendPushToUser, sendPushToAdmins } from "./push-notifications"
import { formatDateLongAR, formatTimeAR } from "@/lib/utils"

// URLs para cada tipo de notificación - todas van a home por ahora
const NOTIFICATION_URLS: Record<NotificationType, string> = {
  ROTATIVO_APROBADO: "/",
  ROTATIVO_RECHAZADO: "/",
  SOLICITUD_PENDIENTE: "/",
  LISTA_ESPERA_CUPO: "/",
  ROTACION_OBLIGATORIA: "/",
  ALERTA_CERCANIA_MAXIMO: "/",
  CONSENSO_PENDIENTE: "/",
  BLOQUE_APROBADO: "/",
  LICENCIA_REGISTRADA: "/",
  SISTEMA: "/",
}

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
  // Crear notificación en BD
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data ? (params.data as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  })

  // Enviar push notification (no esperar, fire and forget)
  sendPushToUser(params.userId, {
    title: params.title,
    body: params.message,
    url: NOTIFICATION_URLS[params.type] || "/",
    tag: params.type,
  }).catch((err) => console.error("[Push] Error:", err))
}

export async function notifyAdmins(params: Omit<CreateNotificationParams, "userId">): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  })

  // Crear notificaciones en BD
  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data ? (params.data as Prisma.InputJsonValue) : Prisma.JsonNull,
    })),
  })

  // Enviar push notifications a admins (no esperar)
  sendPushToAdmins({
    title: params.title,
    body: params.message,
    url: NOTIFICATION_URLS[params.type] || "/admin",
    tag: params.type,
  }).catch((err) => console.error("[Push Admins] Error:", err))
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

// ============================================
// Notificaciones específicas para equidad y rotativos
// ============================================

/**
 * Notificar al usuario cuando se le asigna una rotación obligatoria
 */
export async function notifyRotacionObligatoria(params: {
  userId: string
  eventTitle: string
  eventDate: Date
  eventStartTime?: Date | null
  eventType?: string
  eventId: string
  rotativoId: string
  diasHastaEvento: number
  motivo?: string
}): Promise<void> {
  // Formatear fecha y hora para el mensaje
  const fechaStr = formatDateLongAR(params.eventDate)
  const horaStr = params.eventStartTime
    ? ` a las ${formatTimeAR(params.eventStartTime)}`
    : ""

  await createNotification({
    userId: params.userId,
    type: "ROTACION_OBLIGATORIA",
    title: "Rotación obligatoria asignada",
    message: `Se te ha asignado rotativo obligatorio para "${params.eventTitle}" el ${fechaStr}${horaStr} (${params.diasHastaEvento} días restantes)`,
    data: {
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      eventDate: params.eventDate.toISOString(),
      eventStartTime: params.eventStartTime?.toISOString(),
      eventType: params.eventType,
      rotativoId: params.rotativoId,
      diasHastaEvento: params.diasHastaEvento,
      motivo: params.motivo || "Asignación automática por falta de voluntarios",
    },
  })
}

/**
 * Notificar al usuario cuando está cerca del máximo proyectado
 */
export async function notifyAlertaCercania(params: {
  userId: string
  totalActual: number
  maxProyectado: number
  porcentaje: number
  nivelAlerta: "CERCANIA" | "LIMITE" | "EXCESO"
}): Promise<void> {
  console.log("[notifyAlertaCercania] ===== ALERTA MÁXIMO =====")
  console.log("[notifyAlertaCercania] userId:", params.userId)
  console.log("[notifyAlertaCercania] totalActual:", params.totalActual)
  console.log("[notifyAlertaCercania] maxProyectado:", params.maxProyectado)
  console.log("[notifyAlertaCercania] porcentaje:", params.porcentaje)
  console.log("[notifyAlertaCercania] nivelAlerta:", params.nivelAlerta)
  console.log("[notifyAlertaCercania] Llamado desde:", new Error().stack?.split("\n").slice(2, 5).join("\n"))
  console.log("[notifyAlertaCercania] ========================")

  const mensajes = {
    CERCANIA: `Estás en ${params.porcentaje.toFixed(0)}% de tu máximo anual (${params.totalActual}/${params.maxProyectado} rotativos)`,
    LIMITE: `Has alcanzado el umbral del máximo anual (${params.totalActual}/${params.maxProyectado} rotativos)`,
    EXCESO: `Has superado tu máximo anual proyectado (${params.totalActual}/${params.maxProyectado} rotativos)`,
  }

  await createNotification({
    userId: params.userId,
    type: "ALERTA_CERCANIA_MAXIMO",
    title: params.nivelAlerta === "EXCESO" ? "Máximo superado" : "Cerca del máximo anual",
    message: mensajes[params.nivelAlerta],
    data: {
      totalActual: params.totalActual,
      maxProyectado: params.maxProyectado,
      porcentaje: params.porcentaje,
      nivelAlerta: params.nivelAlerta,
    },
  })
}


/**
 * Notificar a admins cuando se asigna rotación obligatoria
 */
export async function notifyAdminsRotacionObligatoriaAsignada(params: {
  userId: string
  userName: string
  eventTitle: string
  eventDate: Date
  eventId: string
  rotativoId: string
  asignadoPorId: string
  asignadoPorNombre: string
}): Promise<void> {
  await notifyAdmins({
    type: "ROTACION_OBLIGATORIA",
    title: "Rotación obligatoria asignada",
    message: `${params.asignadoPorNombre} asignó rotativo obligatorio a ${params.userName} para "${params.eventTitle}"`,
    data: {
      userId: params.userId,
      userName: params.userName,
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      eventDate: params.eventDate.toISOString(),
      rotativoId: params.rotativoId,
      asignadoPorId: params.asignadoPorId,
      asignadoPorNombre: params.asignadoPorNombre,
    },
  })
}
