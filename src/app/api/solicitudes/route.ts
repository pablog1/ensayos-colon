import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCupoParaEvento } from "@/lib/services/cupo-rules"

// GET /api/solicitudes - Lista rotativos del usuario
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get("mes")
  const userId = searchParams.get("userId")
  const verTodas = searchParams.get("todas") === "true"

  // Construir filtro de fecha basado en la fecha del evento
  let fechaFilter = {}
  if (mes) {
    const [year, month] = mes.split("-").map(Number)
    const inicioMes = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
    const finMes = new Date(Date.UTC(year, month, 0, 23, 59, 59))
    fechaFilter = {
      event: {
        date: {
          gte: inicioMes,
          lte: finMes,
        },
      },
    }
  }

  // Si todas=true, mostrar todos los rotativos (para calendario general)
  // Si no, admin puede ver todos, integrante solo los suyos
  let userFilter = {}
  if (!verTodas) {
    userFilter =
      session.user.role === "ADMIN"
        ? userId
          ? { userId }
          : {}
        : { userId: session.user.id }
  }

  const rotativos = await prisma.rotativo.findMany({
    where: {
      ...fechaFilter,
      ...userFilter,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          alias: true,
          avatar: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          eventoType: true,
          titulo: {
            select: {
              name: true,
              color: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Formatear para compatibilidad con el frontend
  const solicitudesFormateadas = rotativos.map(r => ({
    id: r.id,
    fecha: `${r.event.date.getUTCFullYear()}-${String(r.event.date.getUTCMonth() + 1).padStart(2, '0')}-${String(r.event.date.getUTCDate()).padStart(2, '0')}`,
    estado: r.estado,
    esCasoEspecial: false,
    porcentajeAlMomento: r.contadorAlMomento,
    createdAt: r.createdAt,
    user: r.user,
    // Datos adicionales del evento
    eventoId: r.event.id,
    eventoTitle: r.event.title,
    eventoType: r.event.eventoType,
    tituloName: r.event.titulo?.name,
    tituloColor: r.event.titulo?.color,
  }))

  return NextResponse.json(solicitudesFormateadas)
}

// POST /api/solicitudes - Crear rotativo para un evento
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()
  const { eventId } = body

  if (!eventId) {
    return NextResponse.json({ error: "eventId es requerido" }, { status: 400 })
  }

  // Verificar que el evento existe
  const evento = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      titulo: true,
      rotativos: true,
    },
  })

  if (!evento) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  // Verificar que no exista ya un rotativo del usuario en este evento
  const existente = await prisma.rotativo.findFirst({
    where: {
      userId: session.user.id,
      eventId: eventId,
    },
  })

  if (existente) {
    return NextResponse.json(
      { error: "Ya tienes un rotativo en este evento" },
      { status: 400 }
    )
  }

  // Calcular cupo efectivo usando reglas
  const cupoDeReglas = await getCupoParaEvento(
    evento.eventoType,
    evento.titulo?.type ?? null
  )
  const cupoEfectivo = evento.cupoOverride ?? cupoDeReglas

  // Verificar cupo disponible
  if (evento.rotativos.length >= cupoEfectivo) {
    return NextResponse.json(
      { error: "No hay cupo disponible en este evento" },
      { status: 400 }
    )
  }

  // Crear rotativo
  const rotativo = await prisma.rotativo.create({
    data: {
      userId: session.user.id,
      eventId: eventId,
      estado: "APROBADO", // Auto-aprobado si hay cupo
      tipo: "VOLUNTARIO",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          alias: true,
          avatar: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          date: true,
        },
      },
    },
  })

  return NextResponse.json(rotativo)
}
