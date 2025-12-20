import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/titulos/[id]/eventos - Lista eventos de un titulo
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id: tituloId } = await params

  const titulo = await prisma.titulo.findUnique({
    where: { id: tituloId },
  })

  if (!titulo) {
    return NextResponse.json(
      { error: "Titulo no encontrado" },
      { status: 404 }
    )
  }

  const eventos = await prisma.event.findMany({
    where: { tituloId },
    orderBy: { date: "asc" },
    include: {
      _count: {
        select: { rotativos: true },
      },
    },
  })

  // Agregar cupo efectivo a cada evento
  const eventosConCupo = eventos.map((evento) => ({
    ...evento,
    cupoEfectivo:
      evento.cupoOverride ??
      (evento.eventoType === "ENSAYO" ? titulo.cupoEnsayo : titulo.cupoFuncion),
    rotativosUsados: evento._count.rotativos,
  }))

  return NextResponse.json(eventosConCupo)
}

// POST /api/titulos/[id]/eventos - Crear evento para un titulo (solo admin)
export async function POST(
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

  const { id: tituloId } = await params
  const body = await req.json()
  const { date, eventoType, cupoOverride, notes, startTime, endTime } = body

  if (!date || !eventoType) {
    return NextResponse.json(
      { error: "Fecha y tipo de evento son requeridos" },
      { status: 400 }
    )
  }

  // Validar tipo
  if (!["ENSAYO", "FUNCION"].includes(eventoType)) {
    return NextResponse.json(
      { error: "Tipo de evento invalido. Debe ser ENSAYO o FUNCION" },
      { status: 400 }
    )
  }

  const titulo = await prisma.titulo.findUnique({
    where: { id: tituloId },
    include: { season: true },
  })

  if (!titulo) {
    return NextResponse.json(
      { error: "Titulo no encontrado" },
      { status: 404 }
    )
  }

  // Parsear fecha como mediodía UTC para evitar problemas de timezone
  const [year, month, day] = date.split('-').map(Number)
  const fechaEvento = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

  // Verificar que la fecha este dentro del rango del título
  const tituloStart = new Date(titulo.startDate)
  const tituloEnd = new Date(titulo.endDate)

  // Normalizar a solo fecha para comparación
  const fechaEventoStr = fechaEvento.toISOString().split('T')[0]
  const tituloStartStr = tituloStart.toISOString().split('T')[0]
  const tituloEndStr = tituloEnd.toISOString().split('T')[0]

  if (fechaEventoStr < tituloStartStr || fechaEventoStr > tituloEndStr) {
    return NextResponse.json(
      { error: `La fecha debe estar dentro del rango del título (${tituloStartStr} - ${tituloEndStr})` },
      { status: 400 }
    )
  }

  // Crear evento
  const evento = await prisma.event.create({
    data: {
      title: `${titulo.name} - ${eventoType === "ENSAYO" ? "Ensayo" : "Funcion"}`,
      date: fechaEvento,
      eventoType,
      eventType: titulo.type === "OPERA" ? "OPERA" : titulo.type === "CONCIERTO" ? "CONCIERTO" : "OTRO",
      startTime: startTime ? new Date(startTime) : fechaEvento,
      endTime: endTime ? new Date(endTime) : new Date(fechaEvento.getTime() + 3 * 60 * 60 * 1000), // 3 horas por defecto
      tituloId,
      seasonId: titulo.seasonId,
      cupoOverride: cupoOverride ?? null,
      description: notes || null,
    },
  })

  return NextResponse.json(evento)
}
