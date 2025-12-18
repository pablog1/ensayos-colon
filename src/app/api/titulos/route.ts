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
  let targetSeasonId = seasonId
  if (!targetSeasonId) {
    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true },
    })
    targetSeasonId = activeSeason?.id
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
  const { name, type, cupoEnsayo, cupoFuncion, description, color, seasonId } = body

  if (!name || !type) {
    return NextResponse.json(
      { error: "Nombre y tipo son requeridos" },
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

  // Si no se especifica temporada, usar la activa
  let targetSeasonId = seasonId
  if (!targetSeasonId) {
    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true },
    })
    if (!activeSeason) {
      return NextResponse.json(
        { error: "No hay temporada activa" },
        { status: 404 }
      )
    }
    targetSeasonId = activeSeason.id
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
    },
  })

  return NextResponse.json(titulo)
}
