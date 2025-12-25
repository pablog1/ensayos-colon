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
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

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

  const hoy = new Date()
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

  // Obtener todos los usuarios
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

  // Mapear usuarios con sus cupos de temporada
  const integrantes = usuarios.map((usuario) => {
    const usadosPasados = rotativosPasadosMap[usuario.id] || 0
    const usadosFuturos = rotativosFuturosMap[usuario.id] || 0
    const consumidos = usadosPasados + usadosFuturos
    const restantes = Math.max(0, maximoPorIntegrante - consumidos)
    const porcentajeUsado = maximoPorIntegrante > 0
      ? Math.round((consumidos / maximoPorIntegrante) * 100)
      : 0

    return {
      id: usuario.id,
      nombre: usuario.alias || usuario.name,
      email: usuario.email,
      cuposTemporada: {
        maximoAsignado: maximoPorIntegrante,
        consumidos,
        usadosPasados,    // Ya utilizados
        usadosFuturos,    // Reservados
        restantes,
        porcentajeUsado,
      },
    }
  })

  // Ordenar por rotativos consumidos (mayor a menor)
  integrantes.sort((a, b) => b.cuposTemporada.consumidos - a.cuposTemporada.consumidos)

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
  const consumidosUsuario = usadosPasadosUsuario + usadosFuturosUsuario
  const restantesUsuario = Math.max(0, maximoPorIntegrante - consumidosUsuario)
  const porcentajeUsadoUsuario = maximoPorIntegrante > 0
    ? Math.round((consumidosUsuario / maximoPorIntegrante) * 100)
    : 0

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
        maximoAsignado: maximoPorIntegrante,
        consumidos: consumidosUsuario,
        usadosPasados: usadosPasadosUsuario,
        usadosFuturos: usadosFuturosUsuario,
        restantes: restantesUsuario,
        porcentajeUsado: porcentajeUsadoUsuario,
      },
    },
  })
}
