import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/titulos - Lista todos los titulos de la temporada activa
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const seasonId = searchParams.get("seasonId")

  // Si no se especifica temporada, buscar la activa
  let targetSeasonId: string | null = seasonId
  if (!targetSeasonId) {
    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true },
    })
    targetSeasonId = activeSeason?.id ?? null
  }

  if (!targetSeasonId) {
    return NextResponse.json({ error: "No hay temporada activa" }, { status: 404 })
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
      const cupo =
        event.cupoOverride ??
        (event.eventoType === "ENSAYO" ? titulo.cupoEnsayo : titulo.cupoFuncion)
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
      cupoEnsayo: titulo.cupoEnsayo,
      cupoFuncion: titulo.cupoFuncion,
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
  const { name, type, cupoEnsayo, cupoFuncion, description, color, seasonId, startDate, endDate } = body

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
  const validTypes = ["OPERA", "CONCIERTO", "BALLET", "RECITAL", "OTRO"]
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

  // Si no se especifica temporada, usar la activa
  let targetSeasonId = seasonId
  let season
  if (!targetSeasonId) {
    season = await prisma.season.findFirst({
      where: { isActive: true },
    })
    if (!season) {
      return NextResponse.json(
        { error: "No hay temporada activa" },
        { status: 404 }
      )
    }
    targetSeasonId = season.id
  } else {
    season = await prisma.season.findUnique({
      where: { id: targetSeasonId },
    })
    if (!season) {
      return NextResponse.json(
        { error: "Temporada no encontrada" },
        { status: 404 }
      )
    }
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

  const titulo = await prisma.titulo.create({
    data: {
      name,
      type,
      cupoEnsayo: cupoEnsayo ?? 2,
      cupoFuncion: cupoFuncion ?? 4,
      description: description || null,
      color: color || null,
      seasonId: targetSeasonId,
      startDate: start,
      endDate: end,
    },
  })

  return NextResponse.json(titulo)
}
