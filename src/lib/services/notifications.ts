import { prisma } from "@/lib/prisma"
import { Prisma, type NotificationType } from "@/generated/prisma"
import { sendPushToUser, sendPushToAdmins } from "./push-notifications"

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
  const fechaStr = params.eventDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
  const horaStr = params.eventStartTime
    ? ` a las ${params.eventStartTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}`
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
 * Notificar a admins sobre usuarios que están muy por debajo del promedio
 */
export async function notifyAdminsUsuarioPorDebajo(params: {
  userId: string
  userName: string
  totalRotativos: number
  promedioGrupo: number
  diferencia: number
}): Promise<void> {
  await notifyAdmins({
    type: "SISTEMA",
    title: "Usuario por debajo del promedio",
    message: `${params.userName} tiene ${params.totalRotativos} rotativos, ${params.diferencia} menos que el promedio del grupo (${params.promedioGrupo.toFixed(1)})`,
    data: {
      userId: params.userId,
      userName: params.userName,
      totalRotativos: params.totalRotativos,
      promedioGrupo: params.promedioGrupo,
      diferencia: params.diferencia,
    },
  })
}

/**
 * Verificar y notificar sobre usuarios con bajo cupo de rotativos
 * Esta función se puede llamar después de aprobar/crear rotativos
 */
export async function verificarYNotificarBajoCupo(): Promise<{
  notificado: boolean
  usuariosAfectados: number
}> {
  try {
    // Obtener temporada activa
    const season = await prisma.season.findFirst({
      where: { isActive: true },
    })

    if (!season) {
      return { notificado: false, usuariosAfectados: 0 }
    }

    // Obtener configuración de umbral de subcupo
    const reglaSubcupo = await prisma.ruleConfig.findUnique({
      where: { key: "ALERTA_SUBCUPO" },
    })

    // Si la regla está deshabilitada, no verificar
    if (reglaSubcupo && !reglaSubcupo.enabled) {
      return { notificado: false, usuariosAfectados: 0 }
    }

    const umbralSubcupo = reglaSubcupo?.enabled ? parseInt(reglaSubcupo.value) || 30 : 30

    // Obtener todos los usuarios
    const usuarios = await prisma.user.findMany({
      select: { id: true, name: true, alias: true },
    })

    if (usuarios.length === 0) {
      return { notificado: false, usuariosAfectados: 0 }
    }

    // Contar rotativos REALES de cada usuario
    const rotativosPorUsuario = await prisma.rotativo.groupBy({
      by: ['userId'],
      where: {
        estado: { in: ["APROBADO", "PENDIENTE"] },
        event: { seasonId: season.id },
      },
      _count: { id: true },
    })

    const rotativosMap: Record<string, number> = {}
    for (const r of rotativosPorUsuario) {
      rotativosMap[r.userId] = r._count.id
    }

    // Calcular promedio del grupo
    let totalRotativos = 0
    for (const usuario of usuarios) {
      totalRotativos += rotativosMap[usuario.id] || 0
    }
    const promedioGrupo = totalRotativos / usuarios.length

    // Si el promedio es muy bajo, no alertar
    if (promedioGrupo < 2) {
      return { notificado: false, usuariosAfectados: 0 }
    }

    // Calcular umbral inferior
    const umbralInferior = promedioGrupo * (1 - umbralSubcupo / 100)

    // Encontrar usuarios por debajo del promedio
    const usuariosConBajoCupo: Array<{
      id: string
      nombre: string
      rotativosTotales: number
      diferencia: number
    }> = []

    for (const usuario of usuarios) {
      const totalUsuario = rotativosMap[usuario.id] || 0
      if (totalUsuario < umbralInferior) {
        const nombre = usuario.alias || usuario.name || "Usuario"
        usuariosConBajoCupo.push({
          id: usuario.id,
          nombre,
          rotativosTotales: totalUsuario,
          diferencia: Math.round(promedioGrupo - totalUsuario),
        })
      }
    }

    // Si hay usuarios con bajo cupo, notificar a los admins
    if (usuariosConBajoCupo.length > 0) {
      const listaUsuarios = usuariosConBajoCupo
        .map(u => `• ${u.nombre}: ${u.rotativosTotales} rotativos (${u.diferencia} menos que el promedio)`)
        .join("\n")

      await notifyAdmins({
        type: "SISTEMA",
        title: `Alerta: ${usuariosConBajoCupo.length} usuario(s) con bajo cupo`,
        message: `Usuarios por debajo del ${umbralSubcupo}% del promedio (${promedioGrupo.toFixed(1)}):\n${listaUsuarios}`,
        data: {
          usuariosConBajoCupo,
          promedioGrupo,
          umbralSubcupo,
        },
      })

      return { notificado: true, usuariosAfectados: usuariosConBajoCupo.length }
    }

    return { notificado: false, usuariosAfectados: 0 }
  } catch (error) {
    console.error("[Notificaciones] Error verificando bajo cupo:", error)
    return { notificado: false, usuariosAfectados: 0 }
  }
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
