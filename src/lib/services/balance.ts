import { prisma } from "@/lib/prisma"

/**
 * Calcula el máximo proyectado basado en los cupos reales de todos los eventos
 * de la temporada dividido por la cantidad de integrantes
 */
async function calcularMaxProyectadoReal(seasonId: string): Promise<number> {
  // Obtener todos los titulos con sus eventos
  const titulos = await prisma.titulo.findMany({
    where: { seasonId },
    include: {
      events: {
        select: {
          cupoOverride: true,
        },
      },
    },
  })

  // Calcular total de cupos disponibles sumando los slots de cada evento
  let totalCuposDisponibles = 0
  for (const titulo of titulos) {
    for (const evento of titulo.events) {
      const cupo = evento.cupoOverride ?? titulo.cupo
      totalCuposDisponibles += cupo
    }
  }

  // Total de integrantes (todos los usuarios son integrantes, incluyendo ADMIN)
  const totalIntegrantes = await prisma.user.count()

  // Máximo por integrante = total cupos / cantidad de integrantes
  return totalIntegrantes > 0
    ? Math.round(totalCuposDisponibles / totalIntegrantes)
    : 0
}

interface UpdateBalanceParams {
  incrementRotativos?: boolean
  incrementObligatorios?: boolean
  isWeekend?: boolean
  eventDate?: Date
}

export async function updateUserBalance(
  userId: string,
  seasonId: string,
  params: UpdateBalanceParams
): Promise<void> {
  const balance = await prisma.userSeasonBalance.findUnique({
    where: { userId_seasonId: { userId, seasonId } },
  })

  if (!balance) {
    // Crear balance si no existe
    const maxProyectado = await calcularMaxProyectadoReal(seasonId)

    await prisma.userSeasonBalance.create({
      data: {
        userId,
        seasonId,
        rotativosTomados: params.incrementRotativos ? 1 : 0,
        rotativosObligatorios: params.incrementObligatorios ? 1 : 0,
        maxProyectado,
        finesDeSemanaMes: params.isWeekend && params.eventDate
          ? { [params.eventDate.toISOString().slice(0, 7)]: 1 }
          : {},
      },
    })
    return
  }

  const updates: Record<string, unknown> = {}

  if (params.incrementRotativos) {
    updates.rotativosTomados = { increment: 1 }
  }

  if (params.incrementObligatorios) {
    updates.rotativosObligatorios = { increment: 1 }
  }

  if (params.isWeekend && params.eventDate) {
    const mesKey = params.eventDate.toISOString().slice(0, 7)
    const finesActuales = (balance.finesDeSemanaMes as Record<string, number>) ?? {}
    finesActuales[mesKey] = (finesActuales[mesKey] ?? 0) + 1
    updates.finesDeSemanaMes = finesActuales
  }

  await prisma.userSeasonBalance.update({
    where: { id: balance.id },
    data: updates,
  })
}

export async function decrementUserBalance(
  userId: string,
  seasonId: string,
  params: UpdateBalanceParams
): Promise<void> {
  const balance = await prisma.userSeasonBalance.findUnique({
    where: { userId_seasonId: { userId, seasonId } },
  })

  if (!balance) return

  const updates: Record<string, unknown> = {}

  if (params.incrementRotativos) {
    updates.rotativosTomados = { decrement: 1 }
  }

  if (params.incrementObligatorios) {
    updates.rotativosObligatorios = { decrement: 1 }
  }

  if (params.isWeekend && params.eventDate) {
    const mesKey = params.eventDate.toISOString().slice(0, 7)
    const finesActuales = (balance.finesDeSemanaMes as Record<string, number>) ?? {}
    if (finesActuales[mesKey] && finesActuales[mesKey] > 0) {
      finesActuales[mesKey] -= 1
    }
    updates.finesDeSemanaMes = finesActuales
  }

  await prisma.userSeasonBalance.update({
    where: { id: balance.id },
    data: updates,
  })
}

export async function recalculateBalance(userId: string, seasonId: string): Promise<void> {
  // Contar rotativos aprobados
  const rotativosTomados = await prisma.rotativo.count({
    where: {
      userId,
      event: { seasonId },
      estado: "APROBADO",
      tipo: "VOLUNTARIO",
    },
  })

  // Contar rotativos obligatorios
  const rotativosObligatorios = await prisma.rotativo.count({
    where: {
      userId,
      event: { seasonId },
      estado: { in: ["APROBADO", "ASIGNADO"] },
      tipo: "OBLIGATORIO",
    },
  })

  // Calcular fines de semana por mes
  const rotativosFinesSemana = await prisma.rotativo.findMany({
    where: {
      userId,
      event: { seasonId },
      estado: "APROBADO",
    },
    include: { event: true },
  })

  const finesDeSemanaMes: Record<string, number> = {}
  for (const rotativo of rotativosFinesSemana) {
    const dayOfWeek = rotativo.event.date.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const mesKey = rotativo.event.date.toISOString().slice(0, 7)
      finesDeSemanaMes[mesKey] = (finesDeSemanaMes[mesKey] ?? 0) + 1
    }
  }

  // Verificar si tiene bloque
  const bloqueUsado = await prisma.block.count({
    where: {
      assignedToId: userId,
      seasonId,
      estado: { in: ["SOLICITADO", "APROBADO", "EN_CURSO", "COMPLETADO"] },
    },
  }) > 0

  // Calcular maximo proyectado basado en cupos reales
  const maxProyectado = await calcularMaxProyectadoReal(seasonId)

  await prisma.userSeasonBalance.upsert({
    where: { userId_seasonId: { userId, seasonId } },
    create: {
      userId,
      seasonId,
      rotativosTomados,
      rotativosObligatorios,
      maxProyectado,
      finesDeSemanaMes,
      bloqueUsado,
    },
    update: {
      rotativosTomados,
      rotativosObligatorios,
      maxProyectado,
      finesDeSemanaMes,
      bloqueUsado,
    },
  })
}

export async function getUserBalance(userId: string, seasonId: string) {
  return prisma.userSeasonBalance.findUnique({
    where: { userId_seasonId: { userId, seasonId } },
  })
}

export async function getAllBalances(seasonId: string) {
  return prisma.userSeasonBalance.findMany({
    where: { seasonId },
    include: {
      user: {
        select: { id: true, name: true, email: true, alias: true, avatar: true },
      },
    },
    orderBy: { rotativosTomados: "desc" },
  })
}

// Ajustar balance por licencia
export async function adjustBalanceForLicense(
  userId: string,
  seasonId: string,
  rotativosCalculados: number
): Promise<void> {
  await prisma.userSeasonBalance.update({
    where: { userId_seasonId: { userId, seasonId } },
    data: {
      rotativosPorLicencia: { increment: rotativosCalculados },
    },
  })
}

// Ajustar maximo manualmente (admin)
export async function setManualMax(
  userId: string,
  seasonId: string,
  maxAjustado: number | null
): Promise<void> {
  await prisma.userSeasonBalance.update({
    where: { userId_seasonId: { userId, seasonId } },
    data: { maxAjustadoManual: maxAjustado },
  })
}
