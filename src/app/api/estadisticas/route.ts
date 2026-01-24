import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/estadisticas - Obtener estadisticas de una temporada (por año)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const yearParam = searchParams.get("year")
  const debugDateParam = searchParams.get("debugDate")

  // Usar fecha de debug si se proporciona, o la fecha actual
  const baseDate = debugDateParam ? new Date(debugDateParam) : new Date()
  const year = yearParam ? parseInt(yearParam) : baseDate.getFullYear()

  // Buscar la temporada del año solicitado
  // Asumimos que el nombre de la temporada incluye el año (ej: "Temporada 2025")
  // O buscamos por el rango de fechas
  let season = await prisma.season.findFirst({
    where: {
      OR: [
        { name: { contains: year.toString() } },
        {
          AND: [
            { startDate: { lte: new Date(`${year}-12-31`) } },
            { endDate: { gte: new Date(`${year}-01-01`) } },
          ],
        },
      ],
    },
  })

  // Si no hay temporada para ese año, retornar datos vacíos
  if (!season) {
    return NextResponse.json({
      temporada: null,
      totalIntegrantes: 0,
      solicitudesPendientes: 0,
      integrantes: [],
      currentUserId: session.user.id,
      cuposTemporada: {
        totalCuposDisponibles: 0,
        cuposConsumidos: 0,
        cuposUsadosPasados: 0,
        cuposUsadosFuturos: 0,
        cuposRestantes: 0,
        maximoPorIntegrante: 0,
        porcentajeUsado: 0,
      },
      personal: {
        cuposTemporada: {
          maximoAsignado: 0,
          consumidos: 0,
          usadosPasados: 0,
          usadosFuturos: 0,
          restantes: 0,
          porcentajeUsado: 0,
        },
      },
    })
  }

  // Obtener todos los titulos con sus eventos de la temporada
  const titulos = await prisma.titulo.findMany({
    where: { seasonId: season.id },
    include: {
      events: {
        select: {
          id: true,
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

  // Usar la fecha de debug o la fecha actual para determinar "hoy"
  const hoy = new Date(baseDate)
  hoy.setHours(0, 0, 0, 0)

  // Contar rotativos aprobados de la temporada - pasados (ya utilizados)
  const cuposUsadosPasados = await prisma.rotativo.count({
    where: {
      estado: "APROBADO",
      event: {
        seasonId: season.id,
        date: { lt: hoy },
      },
    },
  })

  // Contar rotativos aprobados de la temporada - futuros (reservados)
  const cuposUsadosFuturos = await prisma.rotativo.count({
    where: {
      estado: "APROBADO",
      event: {
        seasonId: season.id,
        date: { gte: hoy },
      },
    },
  })

  const cuposConsumidos = cuposUsadosPasados + cuposUsadosFuturos

  // Total de integrantes (todos los usuarios son integrantes, incluyendo ADMIN)
  const totalIntegrantes = await prisma.user.count()

  const cuposRestantes = totalCuposDisponibles - cuposConsumidos
  const maximoPorIntegrante = totalIntegrantes > 0
    ? Math.round(totalCuposDisponibles / totalIntegrantes)
    : 0

  // Obtener rotativos de temporada agrupados por usuario - pasados
  const rotativosPasadosPorUsuario = await prisma.rotativo.groupBy({
    by: ['userId'],
    where: {
      estado: "APROBADO",
      event: {
        seasonId: season.id,
        date: { lt: hoy },
      },
    },
    _count: {
      id: true,
    },
  })

  // Obtener rotativos de temporada agrupados por usuario - futuros
  const rotativosFuturosPorUsuario = await prisma.rotativo.groupBy({
    by: ['userId'],
    where: {
      estado: "APROBADO",
      event: {
        seasonId: season.id,
        date: { gte: hoy },
      },
    },
    _count: {
      id: true,
    },
  })

  const rotativosPasadosMap: Record<string, number> = {}
  for (const r of rotativosPasadosPorUsuario) {
    rotativosPasadosMap[r.userId] = r._count.id
  }

  const rotativosFuturosMap: Record<string, number> = {}
  for (const r of rotativosFuturosPorUsuario) {
    rotativosFuturosMap[r.userId] = r._count.id
  }

  // Obtener todos los usuarios con sus balances
  const usuarios = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      alias: true,
      role: true,
    },
    orderBy: { name: "asc" },
  })

  // Obtener balances de la temporada (incluye rotativosPorLicencia)
  const balances = await prisma.userSeasonBalance.findMany({
    where: { seasonId: season.id },
    select: {
      userId: true,
      rotativosPorLicencia: true,
      maxProyectado: true,
      maxAjustadoManual: true,
    },
  })

  const balancesMap: Record<string, { rotativosPorLicencia: number; maxProyectado: number; maxAjustadoManual: number | null }> = {}
  for (const b of balances) {
    balancesMap[b.userId] = {
      rotativosPorLicencia: b.rotativosPorLicencia,
      maxProyectado: b.maxProyectado,
      maxAjustadoManual: b.maxAjustadoManual,
    }
  }

  // Primero calculamos el promedio de uso del grupo (solo rotativos reales, sin licencia)
  let totalUsadosGrupo = 0
  let usuariosConUso = 0
  for (const usuario of usuarios) {
    const usados = (rotativosPasadosMap[usuario.id] || 0) + (rotativosFuturosMap[usuario.id] || 0)
    totalUsadosGrupo += usados
    if (usados > 0) usuariosConUso++
  }
  const promedioGrupo = totalIntegrantes > 0 ? totalUsadosGrupo / totalIntegrantes : 0

  // Obtener umbral de alerta de cercanía al máximo (default 90%)
  const reglaUmbral = await prisma.ruleConfig.findUnique({
    where: { key: "ALERTA_UMBRAL" },
  })
  const umbralCercania = reglaUmbral?.enabled ? parseInt(reglaUmbral.value) || 90 : 90

  // Obtener umbral de alerta de subcupo (default 30%)
  const reglaSubcupo = await prisma.ruleConfig.findUnique({
    where: { key: "ALERTA_SUBCUPO" },
  })
  const umbralSubcupo = reglaSubcupo?.enabled ? parseInt(reglaSubcupo.value) || 30 : 30

  // Mapear usuarios con sus cupos de temporada
  const integrantes = usuarios.map((usuario) => {
    const usadosPasados = rotativosPasadosMap[usuario.id] || 0
    const usadosFuturos = rotativosFuturosMap[usuario.id] || 0
    const balance = balancesMap[usuario.id]
    const rotativosPorLicencia = Math.floor(balance?.rotativosPorLicencia || 0)
    const maxIndividual = balance?.maxAjustadoManual ?? balance?.maxProyectado ?? maximoPorIntegrante

    // Total consumidos incluye los rotativos por licencia
    const consumidos = usadosPasados + usadosFuturos + rotativosPorLicencia
    const restantes = Math.max(0, maxIndividual - consumidos)
    const porcentajeUsado = maxIndividual > 0
      ? Math.round((consumidos / maxIndividual) * 100)
      : 0

    // Calcular alertas
    // Cerca del límite superior: cuando el porcentaje de uso >= umbral
    const cercaDelLimite = porcentajeUsado >= umbralCercania && restantes > 0

    // Por debajo del promedio: cuando está X% por debajo del promedio del grupo (configurable)
    const usadosReales = usadosPasados + usadosFuturos
    const umbralInferior = promedioGrupo * (1 - umbralSubcupo / 100) // X% debajo del promedio
    const porDebajoDelPromedio = promedioGrupo > 2 && usadosReales < umbralInferior

    return {
      id: usuario.id,
      nombre: usuario.alias || usuario.name,
      email: usuario.email,
      cuposTemporada: {
        maximoAsignado: Math.round(maxIndividual),
        consumidos,
        usadosPasados,    // Ya utilizados
        usadosFuturos,    // Reservados
        rotativosPorLicencia, // Restados por licencia
        restantes,
        porcentajeUsado,
        cercaDelLimite,
        porDebajoDelPromedio,
      },
    }
  })

  // Ordenar: usuario logueado primero, luego alfabéticamente por nombre
  integrantes.sort((a, b) => {
    // Usuario logueado siempre primero
    if (a.id === session.user.id) return -1
    if (b.id === session.user.id) return 1
    // Luego ordenar alfabéticamente por nombre
    return a.nombre.localeCompare(b.nombre, "es")
  })

  // Solicitudes pendientes de la temporada
  const solicitudesPendientes = await prisma.rotativo.count({
    where: {
      estado: "PENDIENTE",
      event: {
        seasonId: season.id,
      },
    },
  })

  // Datos personales del usuario actual
  const usadosPasadosUsuario = rotativosPasadosMap[session.user.id] || 0
  const usadosFuturosUsuario = rotativosFuturosMap[session.user.id] || 0
  const balanceUsuario = balancesMap[session.user.id]
  const rotativosPorLicenciaUsuario = Math.floor(balanceUsuario?.rotativosPorLicencia || 0)
  const maxUsuario = balanceUsuario?.maxAjustadoManual ?? balanceUsuario?.maxProyectado ?? maximoPorIntegrante
  const consumidosUsuario = usadosPasadosUsuario + usadosFuturosUsuario + rotativosPorLicenciaUsuario
  const restantesUsuario = Math.max(0, maxUsuario - consumidosUsuario)
  const porcentajeUsadoUsuario = maxUsuario > 0
    ? Math.round((consumidosUsuario / maxUsuario) * 100)
    : 0

  // Alertas personales
  const cercaDelLimiteUsuario = porcentajeUsadoUsuario >= umbralCercania && restantesUsuario > 0
  const usadosRealesUsuario = usadosPasadosUsuario + usadosFuturosUsuario
  const porDebajoDelPromedioUsuario = promedioGrupo > 2 && usadosRealesUsuario < promedioGrupo * (1 - umbralSubcupo / 100)

  return NextResponse.json({
    temporada: {
      id: season.id,
      name: season.name,
      year,
    },
    totalIntegrantes,
    solicitudesPendientes,
    integrantes,
    currentUserId: session.user.id,
    cuposTemporada: {
      totalCuposDisponibles,
      cuposConsumidos,
      cuposUsadosPasados,      // Ya utilizados
      cuposUsadosFuturos,      // Reservados para eventos futuros
      cuposRestantes,
      maximoPorIntegrante,
      porcentajeUsado: totalCuposDisponibles > 0
        ? Math.round((cuposConsumidos / totalCuposDisponibles) * 100)
        : 0,
    },
    personal: {
      cuposTemporada: {
        maximoAsignado: Math.round(maxUsuario),
        consumidos: consumidosUsuario,
        usadosPasados: usadosPasadosUsuario,
        usadosFuturos: usadosFuturosUsuario,
        rotativosPorLicencia: rotativosPorLicenciaUsuario,
        restantes: restantesUsuario,
        porcentajeUsado: porcentajeUsadoUsuario,
        cercaDelLimite: cercaDelLimiteUsuario,
        porDebajoDelPromedio: porDebajoDelPromedioUsuario,
      },
    },
    promedioGrupo: Math.round(promedioGrupo * 10) / 10,
  })
}
