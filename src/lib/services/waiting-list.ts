import { prisma } from "@/lib/prisma"
import { createNotification } from "./notifications"
import { createAuditLog } from "./audit"
import { updateUserBalance } from "./balance"
import { formatTimeAR, formatDateMediumAR } from "@/lib/utils"

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

export async function promoteFromWaitingList(eventId: string): Promise<boolean> {
  // Obtener siguiente en cola
  const nextEntry = await prisma.waitingListEntry.findFirst({
    where: { eventId },
    orderBy: { position: "asc" },
    include: {
      event: {
        include: {
          titulo: {
            select: { name: true },
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

  // Obtener cupo del tipo de evento
  const cupoConfig = await prisma.ruleConfig.findUnique({
    where: { key: "CUPO_DIARIO" },
  })

  let cupoTotal = 2 // Default
  if (cupoConfig) {
    try {
      const cupos = JSON.parse(cupoConfig.value) as Record<string, number>
      cupoTotal = cupos[nextEntry.event.eventType] ?? 2
    } catch {
      // Usar default
    }
  }

  if (rotativosAprobados >= cupoTotal) {
    return false // No hay cupo todavia
  }

  // Buscar el rotativo en espera del usuario
  const rotativoEnEspera = await prisma.rotativo.findUnique({
    where: { userId_eventId: { userId: nextEntry.userId, eventId } },
  })

  await prisma.$transaction([
    // Actualizar rotativo a aprobado
    ...(rotativoEnEspera
      ? [
          prisma.rotativo.update({
            where: { id: rotativoEnEspera.id },
            data: { estado: "APROBADO" },
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

  // Actualizar balance
  const dayOfWeek = nextEntry.event.date.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  await updateUserBalance(nextEntry.userId, nextEntry.seasonId, {
    incrementRotativos: true,
    isWeekend,
    eventDate: nextEntry.event.date,
  })

  // Notificar al usuario
  const eventDate = nextEntry.event.date
  const tipoEvento = nextEntry.event.eventType === "ENSAYO" ? "Ensayo" : "Función"
  const fechaFormateada = formatDateMediumAR(eventDate)
  const horaFormateada = formatTimeAR(nextEntry.event.startTime)

  const detalleEvento = horaFormateada
    ? `${tipoEvento} - ${fechaFormateada} ${horaFormateada}`
    : `${tipoEvento} - ${fechaFormateada}`

  await createNotification({
    userId: nextEntry.userId,
    type: "LISTA_ESPERA_CUPO",
    title: "Cupo disponible",
    message: `Se liberó un cupo para ${nextEntry.event.title} (${detalleEvento}) y tu rotativo fue aprobado`,
    data: { eventId, eventTitle: nextEntry.event.title },
  })

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
