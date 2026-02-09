import { prisma } from "@/lib/prisma"
import { createNotification, notifyAdmins } from "./notifications"
import { createAuditLog } from "./audit"
import { updateUserBalance } from "./balance"
import { getCupoParaEvento } from "./cupo-rules"
import { formatTimeAR, formatDateMediumAR } from "@/lib/utils"
import { initializeRules, getRegisteredRules, buildValidationContext, loadRuleConfigs } from "@/lib/rules"

export async function addToWaitingList(
  userId: string,
  eventId: string,
  seasonId: string
): Promise<{ position: number }> {
  // Obtener ultima posicion y datos del evento
  const [lastEntry, event] = await Promise.all([
    prisma.waitingListEntry.findFirst({
      where: { eventId },
      orderBy: { position: "desc" },
    }),
    prisma.event.findUnique({
      where: { id: eventId },
      include: {
        titulo: {
          select: { name: true },
        },
      },
    }),
  ])

  const position = (lastEntry?.position ?? 0) + 1

  await prisma.waitingListEntry.create({
    data: { userId, eventId, seasonId, position },
  })

  await createAuditLog({
    action: "LISTA_ESPERA_AGREGADO",
    entityType: "WaitingListEntry",
    entityId: eventId,
    userId,
    details: {
      position,
      eventId,
      evento: event?.title,
      titulo: event?.titulo?.name,
      fecha: event?.date?.toISOString(),
      horario: formatTimeAR(event?.startTime),
      tipoEvento: event?.eventoType,
    },
  })

  return { position }
}

export async function removeFromWaitingList(
  userId: string,
  eventId: string
): Promise<void> {
  const entry = await prisma.waitingListEntry.findUnique({
    where: { userId_eventId: { userId, eventId } },
  })

  if (!entry) return

  await prisma.$transaction([
    // Eliminar entrada
    prisma.waitingListEntry.delete({
      where: { id: entry.id },
    }),
    // Actualizar posiciones de los demas
    prisma.waitingListEntry.updateMany({
      where: { eventId, position: { gt: entry.position } },
      data: { position: { decrement: 1 } },
    }),
  ])
}

/**
 * Re-valida reglas no relacionadas con cupo para un usuario+evento.
 * Retorna un array de mensajes de reglas violadas.
 * Array vacío significa que todas las reglas pasan.
 */
async function checkNonCupoRules(userId: string, eventId: string): Promise<string[]> {
  initializeRules()

  const context = await buildValidationContext(userId, eventId)
  const configs = await loadRuleConfigs()
  const motivos: string[] = []

  // Excluir reglas de cupo/espera (ya verificadas) e informativas
  const excludedRules = new Set([
    "R1_CUPO_DIARIO",      // Cupo ya verificado antes de llegar acá
    "R5_LISTA_ESPERA",     // No aplica, estamos promoviendo desde la lista
    "R11_ALERTA_CERCANIA", // Solo informativa, no bloquea
  ])

  for (const rule of getRegisteredRules()) {
    if (excludedRules.has(rule.id)) continue

    const config = configs.get(rule.configKey) ?? {
      enabled: rule.enabled,
      value: null,
      priority: rule.priority,
    }

    if (!config.enabled) continue

    try {
      const result = await rule.validate(context, config)
      if (!result.passed) {
        motivos.push(result.message)
      }
    } catch (error) {
      console.error(`[checkNonCupoRules] Error en regla ${rule.id}:`, error)
    }
  }

  return motivos
}

export async function promoteFromWaitingList(eventId: string): Promise<boolean> {
  // Obtener siguiente en cola
  const nextEntry = await prisma.waitingListEntry.findFirst({
    where: { eventId },
    orderBy: { position: "asc" },
    include: {
      event: {
        include: {
          titulo: {
            select: { name: true, type: true },
          },
        },
      },
      user: true,
    },
  })

  if (!nextEntry) return false

  // Verificar si hay cupo (consultando rotativos aprobados)
  const rotativosAprobados = await prisma.rotativo.count({
    where: { eventId, estado: "APROBADO" },
  })

  // Obtener cupo efectivo: override del evento tiene prioridad sobre reglas
  let cupoTotal: number
  if (nextEntry.event.cupoOverride != null) {
    cupoTotal = nextEntry.event.cupoOverride
  } else {
    cupoTotal = await getCupoParaEvento(
      nextEntry.event.eventoType,
      nextEntry.event.titulo?.type ?? null
    )
  }

  if (rotativosAprobados >= cupoTotal) {
    return false // No hay cupo todavia
  }

  // Buscar el rotativo en espera del usuario
  const rotativoEnEspera = await prisma.rotativo.findUnique({
    where: { userId_eventId: { userId: nextEntry.userId, eventId } },
  })

  // Si el admin ya pre-aprobó la excepción (aprobadoPor set, motivoInicial limpio),
  // saltar validación y auto-aprobar directamente.
  const yaPreAprobadoPorAdmin = !!rotativoEnEspera?.aprobadoPor

  // Si la solicitud originalmente requirió aprobación (motivoInicial set),
  // NUNCA aprobar automáticamente — siempre va al admin.
  const requirioAprobacionOriginal = !!rotativoEnEspera?.motivoInicial

  let motivosValidacion: string[] = []
  if (!yaPreAprobadoPorAdmin) {
    // Solo re-validar si el admin no pre-aprobó
    try {
      motivosValidacion = await checkNonCupoRules(nextEntry.userId, eventId)
    } catch (error) {
      console.error("[promoteFromWaitingList] Error al re-validar reglas:", error)
      motivosValidacion = ["Error al validar reglas - requiere revisión manual"]
    }
  }

  // APROBADO si: admin pre-aprobó, o no hay motivos
  // PENDIENTE si: requirió aprobación original OR reglas actuales fallan
  const nuevoEstado: "APROBADO" | "PENDIENTE" =
    yaPreAprobadoPorAdmin
      ? "APROBADO"
      : (requirioAprobacionOriginal || motivosValidacion.length > 0)
        ? "PENDIENTE"
        : "APROBADO"

  // Construir explicación para el admin (solo si va a PENDIENTE)
  const explicacionPartes: string[] = []
  if (requirioAprobacionOriginal) {
    explicacionPartes.push(`Motivo original: ${rotativoEnEspera.motivoInicial}`)
  }
  if (motivosValidacion.length > 0) {
    explicacionPartes.push(`Reglas actuales: ${motivosValidacion.join("; ")}`)
  } else if (requirioAprobacionOriginal) {
    explicacionPartes.push("Las reglas actuales se cumplen, pero requiere revisión por los motivos originales")
  }
  const explicacion = explicacionPartes.join(". ")

  await prisma.$transaction([
    // Actualizar rotativo al estado determinado por la re-validación
    ...(rotativoEnEspera
      ? [
          prisma.rotativo.update({
            where: { id: rotativoEnEspera.id },
            data: {
              estado: nuevoEstado,
              ...(nuevoEstado === "PENDIENTE" && {
                motivo: `[Desde lista de espera] Cupo disponible, pero requiere revisión. ${explicacion}`,
              }),
            },
          }),
        ]
      : []),
    // Eliminar de lista de espera
    prisma.waitingListEntry.delete({
      where: { id: nextEntry.id },
    }),
    // Actualizar posiciones
    prisma.waitingListEntry.updateMany({
      where: { eventId, position: { gt: nextEntry.position } },
      data: { position: { decrement: 1 } },
    }),
  ])

  // Preparar datos del evento para notificaciones
  const eventDate = nextEntry.event.date
  const tipoEvento = nextEntry.event.eventType === "ENSAYO" ? "Ensayo" : "Función"
  const fechaFormateada = formatDateMediumAR(eventDate)
  const horaFormateada = formatTimeAR(nextEntry.event.startTime)

  const detalleEvento = horaFormateada
    ? `${tipoEvento} - ${fechaFormateada} ${horaFormateada}`
    : `${tipoEvento} - ${fechaFormateada}`

  if (nuevoEstado === "APROBADO") {
    // Flujo normal: actualizar balance y notificar aprobación
    const dayOfWeek = nextEntry.event.date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    await updateUserBalance(nextEntry.userId, nextEntry.seasonId, {
      incrementRotativos: true,
      isWeekend,
      eventDate: nextEntry.event.date,
    })

    await createNotification({
      userId: nextEntry.userId,
      type: "LISTA_ESPERA_CUPO",
      title: "Cupo disponible",
      message: `Se liberó un cupo para ${nextEntry.event.title} (${detalleEvento}) y tu rotativo fue aprobado`,
      data: { eventId, eventTitle: nextEntry.event.title },
    })
  } else {
    // Hay reglas violadas: notificar al usuario que requiere revisión
    await createNotification({
      userId: nextEntry.userId,
      type: "LISTA_ESPERA_CUPO",
      title: "Cupo disponible - Revisión pendiente",
      message: `Se liberó un cupo para ${nextEntry.event.title} (${detalleEvento}), pero tu solicitud requiere aprobación del administrador`,
      data: { eventId, eventTitle: nextEntry.event.title },
    })

    // Notificar a los admins con el contexto completo de la situación
    const userName = nextEntry.user?.alias || nextEntry.user?.name || "Usuario"
    await notifyAdmins({
      type: "SOLICITUD_PENDIENTE",
      title: "Solicitud pendiente desde lista de espera",
      message: `${userName} estaba en lista de espera para ${nextEntry.event.title} (${detalleEvento}). Se liberó un cupo, pero la solicitud requiere revisión. ${explicacion}`,
      data: {
        rotativoId: rotativoEnEspera?.id,
        eventId,
        eventTitle: nextEntry.event.title,
        userId: nextEntry.userId,
        userName,
        motivosValidacion,
        motivoOriginal: rotativoEnEspera?.motivoInicial,
        origenListaEspera: true,
      },
    })
  }

  await createAuditLog({
    action: "LISTA_ESPERA_PROMOVIDO",
    entityType: "WaitingListEntry",
    entityId: eventId,
    userId: nextEntry.userId,
    details: {
      previousPosition: nextEntry.position,
      eventId,
      evento: nextEntry.event.title,
      titulo: nextEntry.event.titulo?.name,
      fecha: nextEntry.event.date.toISOString(),
      horario: formatTimeAR(nextEntry.event.startTime),
      tipoEvento: nextEntry.event.eventoType,
      nuevoEstado,
      ...(requirioAprobacionOriginal && { motivoOriginal: rotativoEnEspera?.motivoInicial }),
      ...(motivosValidacion.length > 0 && { motivosValidacion }),
    },
  })

  return true
}

export async function getWaitingList(eventId: string) {
  return prisma.waitingListEntry.findMany({
    where: { eventId },
    orderBy: { position: "asc" },
    include: {
      user: {
        select: { id: true, name: true, alias: true },
      },
    },
  })
}

export async function getUserWaitingListPosition(
  userId: string,
  eventId: string
): Promise<number | null> {
  const entry = await prisma.waitingListEntry.findUnique({
    where: { userId_eventId: { userId, eventId } },
  })

  return entry?.position ?? null
}

export async function getUserWaitingListEntries(userId: string, seasonId: string) {
  return prisma.waitingListEntry.findMany({
    where: { userId, seasonId },
    include: {
      event: {
        select: { id: true, title: true, date: true, eventType: true },
      },
    },
    orderBy: { event: { date: "asc" } },
  })
}

// Purgar lista de espera al fin de temporada
export async function purgeWaitingList(seasonId: string): Promise<number> {
  const result = await prisma.waitingListEntry.deleteMany({
    where: { seasonId },
  })

  return result.count
}
