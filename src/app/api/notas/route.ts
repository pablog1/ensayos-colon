import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/notas - Lista notas (por mes o rango de fechas)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get("mes") // formato YYYY-MM
  const fechaInicio = searchParams.get("fechaInicio")
  const fechaFin = searchParams.get("fechaFin")

  // Construir filtro de fechas
  let dateFilter = {}
  if (mes) {
    const [year, month] = mes.split("-").map(Number)
    // Incluir dias extra para la grilla del calendario
    const inicioMes = new Date(Date.UTC(year, month - 1, 1))
    inicioMes.setDate(inicioMes.getDate() - 7) // Una semana antes
    const finMes = new Date(Date.UTC(year, month, 0))
    finMes.setDate(finMes.getDate() + 7) // Una semana despues
    dateFilter = {
      date: {
        gte: inicioMes,
        lte: finMes,
      },
    }
  } else if (fechaInicio && fechaFin) {
    dateFilter = {
      date: {
        gte: new Date(fechaInicio),
        lte: new Date(fechaFin),
      },
    }
  }

  const notas = await prisma.note.findMany({
    where: dateFilter,
    include: {
      event: {
        select: {
          id: true,
          title: true,
          date: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { date: "asc" },
  })

  return NextResponse.json(notas)
}

// POST /api/notas - Crear nota (solo admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Solo admin puede crear notas
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden crear notas" },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { date, title, description, color, eventId } = body

  // Validar campos requeridos
  if (!date || !title) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: date, title" },
      { status: 400 }
    )
  }

  // Si se asocia a un evento, verificar que exista
  if (eventId) {
    const evento = await prisma.event.findUnique({
      where: { id: eventId },
    })
    if (!evento) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 }
      )
    }
  }

  const nota = await prisma.note.create({
    data: {
      date: new Date(date),
      title,
      description,
      color: color || "#6b7280",
      eventId,
      createdById: session.user.id,
    },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          date: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  return NextResponse.json(nota)
}
