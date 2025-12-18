import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/titulos/[id] - Obtener titulo con sus eventos
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  const titulo = await prisma.titulo.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          title: true,
          date: true,
          eventoType: true,
          cupoOverride: true,
          startTime: true,
          endTime: true,
        },
      },
      season: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!titulo) {
    return NextResponse.json(
      { error: "Titulo no encontrado" },
      { status: 404 }
    )
  }

  // Calcular totales
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

  return NextResponse.json({
    ...titulo,
    totalEventos: titulo.events.length,
    totalEnsayos,
    totalFunciones,
    totalRotativos,
  })
}

// PUT /api/titulos/[id] - Actualizar titulo (solo admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { name, type, cupoEnsayo, cupoFuncion, description, color } = body

  const titulo = await prisma.titulo.findUnique({
    where: { id },
  })

  if (!titulo) {
    return NextResponse.json(
      { error: "Titulo no encontrado" },
      { status: 404 }
    )
  }

  // Validar tipo si se proporciona
  if (type) {
    const validTypes = ["OPERA", "CONCIERTO", "BALLET", "RECITAL", "OTRO"]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Tipo de titulo invalido" },
        { status: 400 }
      )
    }
  }

  const updateData: {
    name?: string
    type?: "OPERA" | "CONCIERTO" | "BALLET" | "RECITAL" | "OTRO"
    cupoEnsayo?: number
    cupoFuncion?: number
    description?: string | null
    color?: string | null
  } = {}

  if (name) updateData.name = name
  if (type) updateData.type = type
  if (cupoEnsayo !== undefined) updateData.cupoEnsayo = cupoEnsayo
  if (cupoFuncion !== undefined) updateData.cupoFuncion = cupoFuncion
  if (description !== undefined) updateData.description = description || null
  if (color !== undefined) updateData.color = color || null

  const updated = await prisma.titulo.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(updated)
}

// DELETE /api/titulos/[id] - Eliminar titulo y sus eventos (solo admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params

  const titulo = await prisma.titulo.findUnique({
    where: { id },
    include: {
      _count: { select: { events: true } },
    },
  })

  if (!titulo) {
    return NextResponse.json(
      { error: "Titulo no encontrado" },
      { status: 404 }
    )
  }

  // Eliminar titulo (los eventos se eliminan en cascada)
  await prisma.titulo.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
