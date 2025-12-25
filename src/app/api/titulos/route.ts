import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/titulos - Lista todos los titulos de una temporada
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const seasonId = searchParams.get("seasonId")
    const year = searchParams.get("year")

    // Determinar temporada: por seasonId, por año, o la activa
    let targetSeasonId: string | null = seasonId

    if (!targetSeasonId && year) {
      // Buscar temporada por año
      targetSeasonId = `season-${year}`
      const seasonExists = await prisma.season.findUnique({
        where: { id: targetSeasonId },
      })
      if (!seasonExists) {
        // Si no existe la temporada para ese año, buscar títulos cuyo rango
        // de fechas incluya ese año (para títulos que cruzan años)
        const yearStart = new Date(`${year}-01-01`)
        const yearEnd = new Date(`${year}-12-31`)

        const titulosCrossYear = await prisma.titulo.findMany({
          where: {
            AND: [
              { startDate: { lte: yearEnd } },
              { endDate: { gte: yearStart } },
            ],
          },
          include: {
            _count: {
              select: { events: true },
            },
            events: {
              select: {
                id: true,
                eventoType: true,
                cupoOverride: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })

        // Calcular totales
        const titulosConTotales = titulosCrossYear.map((titulo) => {
          let totalRotativos = 0
          let totalEnsayos = 0
          let totalFunciones = 0

          for (const event of titulo.events) {
            const cupo = event.cupoOverride ?? titulo.cupo
            totalRotativos += cupo
            if (event.eventoType === "ENSAYO") {
              totalEnsayos++
            } else {
              totalFunciones++
            }
          }

          return {
            id: titulo.id,
            name: titulo.name,
            type: titulo.type,
            cupo: titulo.cupo,
            description: titulo.description,
            color: titulo.color,
            startDate: titulo.startDate,
            endDate: titulo.endDate,
            seasonId: titulo.seasonId,
            createdAt: titulo.createdAt,
            updatedAt: titulo.updatedAt,
            totalEventos: titulo._count.events,
            totalEnsayos,
            totalFunciones,
            totalRotativos,
          }
        })

        return NextResponse.json(titulosConTotales)
      }
    }

    if (!targetSeasonId) {
      // Fallback a temporada activa
      const activeSeason = await prisma.season.findFirst({
        where: { isActive: true },
      })
      targetSeasonId = activeSeason?.id ?? null
    }

    if (!targetSeasonId) {
      return NextResponse.json([])
    }

    const titulos = await prisma.titulo.findMany({
      where: { seasonId: targetSeasonId },
      include: {
        _count: {
          select: { events: true },
        },
        events: {
          select: {
            id: true,
            eventoType: true,
            cupoOverride: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Calcular totales para cada titulo
    const titulosConTotales = titulos.map((titulo) => {
      let totalRotativos = 0
      let totalEnsayos = 0
      let totalFunciones = 0

      for (const event of titulo.events) {
        const cupo = event.cupoOverride ?? titulo.cupo
        totalRotativos += cupo

        if (event.eventoType === "ENSAYO") {
          totalEnsayos++
        } else {
          totalFunciones++
        }
      }

      return {
        id: titulo.id,
        name: titulo.name,
        type: titulo.type,
        cupo: titulo.cupo,
        description: titulo.description,
        color: titulo.color,
        startDate: titulo.startDate,
        endDate: titulo.endDate,
        seasonId: titulo.seasonId,
        createdAt: titulo.createdAt,
        updatedAt: titulo.updatedAt,
        totalEventos: titulo._count.events,
        totalEnsayos,
        totalFunciones,
        totalRotativos,
      }
    })

    return NextResponse.json(titulosConTotales)
  } catch (error) {
    console.error("Error en GET /api/titulos:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// POST /api/titulos - Crear nuevo titulo (solo admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await req.json()
  const { name, type, cupo, description, color, seasonId, startDate, endDate } = body

  if (!name || !type) {
    return NextResponse.json(
      { error: "Nombre y tipo son requeridos" },
      { status: 400 }
    )
  }

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "Fecha de inicio y fin son requeridas" },
      { status: 400 }
    )
  }

  // Validar tipo
  const validTypes = ["OPERA", "CONCIERTO", "BALLET"]
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: "Tipo de titulo invalido" },
      { status: 400 }
    )
  }

  // Parsear y validar fechas
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json(
      { error: "Formato de fecha invalido" },
      { status: 400 }
    )
  }

  if (start > end) {
    return NextResponse.json(
      { error: "La fecha de inicio debe ser anterior o igual a la fecha de fin" },
      { status: 400 }
    )
  }

  // Determinar la temporada basándose en el año de la fecha de inicio
  const tituloYear = start.getFullYear()
  let targetSeasonId = seasonId
  let season

  if (targetSeasonId) {
    // Si se especifica temporada, usarla
    season = await prisma.season.findUnique({
      where: { id: targetSeasonId },
    })
    if (!season) {
      return NextResponse.json(
        { error: "Temporada no encontrada" },
        { status: 404 }
      )
    }
  } else {
    // Buscar o crear temporada para el año del título
    const seasonYearId = `season-${tituloYear}`
    season = await prisma.season.findUnique({
      where: { id: seasonYearId },
    })

    if (!season) {
      // Crear temporada automáticamente
      season = await prisma.season.create({
        data: {
          id: seasonYearId,
          name: `Temporada ${tituloYear}`,
          startDate: new Date(tituloYear, 0, 1), // 1 de enero
          endDate: new Date(tituloYear, 11, 31), // 31 de diciembre
          isActive: false,
          workingDays: 250,
        },
      })
    }
    targetSeasonId = season.id
  }

  // Validar que las fechas estén dentro de la temporada
  const seasonStart = new Date(season.startDate)
  const seasonEnd = new Date(season.endDate)

  if (start < seasonStart || end > seasonEnd) {
    return NextResponse.json(
      { error: `Las fechas deben estar dentro de la temporada (${seasonStart.toISOString().split('T')[0]} - ${seasonEnd.toISOString().split('T')[0]})` },
      { status: 400 }
    )
  }

  // Cupo por defecto según tipo
  const defaultCupos: Record<string, number> = { OPERA: 4, BALLET: 4, CONCIERTO: 2 }
  const cupoFinal = cupo ?? defaultCupos[type] ?? 4

  const titulo = await prisma.titulo.create({
    data: {
      name,
      type,
      cupo: cupoFinal,
      description: description || null,
      color: color || null,
      seasonId: targetSeasonId,
      startDate: start,
      endDate: end,
    },
  })

  return NextResponse.json(titulo)
}
