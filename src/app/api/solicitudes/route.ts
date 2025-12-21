import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validarSolicitud } from "@/lib/rules/descanso-rules"
import { getCupoParaEvento } from "@/lib/services/cupo-rules"

// GET /api/solicitudes - Lista solicitudes
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get("mes")
  const userId = searchParams.get("userId")
  const verTodas = searchParams.get("todas") === "true"

  let fechaFilter = {}
  if (mes) {
    const [year, month] = mes.split("-").map(Number)
    // Usar UTC para evitar problemas de timezone
    const inicioMes = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
    const finMes = new Date(Date.UTC(year, month, 0, 23, 59, 59))
    fechaFilter = {
      fecha: {
        gte: inicioMes,
        lte: finMes,
      },
    }
  }

  // Si todas=true, mostrar todas las solicitudes (para calendario general)
  // Si no, admin puede ver todas, integrante solo las suyas
  let userFilter = {}
  if (!verTodas) {
    userFilter =
      session.user.role === "ADMIN"
        ? userId
          ? { userId }
          : {}
        : { userId: session.user.id }
  }

  const solicitudes = await prisma.solicitud.findMany({
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
    },
    orderBy: { fecha: "desc" },
  })

  // Formatear fechas usando UTC para evitar problemas de timezone
  // (igual que en /api/calendario)
  const solicitudesFormateadas = solicitudes.map(s => ({
    ...s,
    fecha: `${s.fecha.getUTCFullYear()}-${String(s.fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(s.fecha.getUTCDate()).padStart(2, '0')}`,
  }))

  return NextResponse.json(solicitudesFormateadas)
}

// POST /api/solicitudes - Crear solicitud o rotativo
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()
  const { fecha, eventId } = body

  // Si hay eventId, crear Rotativo vinculado al evento
  if (eventId) {
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
      evento.titulo?.type ?? null,
      evento.units > 1
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

  // Flujo original para solicitudes sin evento específico
  if (!fecha) {
    return NextResponse.json({ error: "Fecha es requerida" }, { status: 400 })
  }

  const fechaDate = new Date(fecha)

  // Verificar que la fecha no sea pasada
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  if (fechaDate < hoy) {
    return NextResponse.json(
      { error: "No se pueden solicitar rotativos en fechas pasadas" },
      { status: 400 }
    )
  }

  // Verificar que no exista una solicitud para esa fecha
  const existente = await prisma.solicitud.findUnique({
    where: {
      userId_fecha: {
        userId: session.user.id,
        fecha: fechaDate,
      },
    },
  })

  if (existente) {
    return NextResponse.json(
      { error: "Ya existe una solicitud para esta fecha" },
      { status: 400 }
    )
  }

  // Validar límites del usuario
  const validacion = await validarSolicitud(session.user.id, fechaDate)

  const solicitud = await prisma.solicitud.create({
    data: {
      userId: session.user.id,
      fecha: fechaDate,
      estado: validacion.autoApprove ? "APROBADA" : "PENDIENTE",
      esCasoEspecial: validacion.esCasoEspecial,
      porcentajeAlMomento: validacion.porcentaje,
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
    },
  })

  return NextResponse.json({
    solicitud,
    validacion,
  })
}
