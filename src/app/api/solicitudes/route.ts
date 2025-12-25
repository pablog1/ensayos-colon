import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCupoParaEvento } from "@/lib/services/cupo-rules"
import { createAuditLog } from "@/lib/services/audit"
import { notifyAdmins } from "@/lib/services/notifications"

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
    motivo: r.motivo,
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
// NOTA: La validación de reglas se hace en /api/solicitudes/validar
// Este endpoint solo verifica condiciones básicas y crea el rotativo
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  console.log("[POST /api/solicitudes] Iniciando...")

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await req.json()
    const { eventId, requiereAprobacion, motivo } = body
    console.log("[POST /api/solicitudes] EventId:", eventId, "User:", session.user.id, "RequiereAprobacion:", requiereAprobacion)

    if (!eventId) {
      return NextResponse.json({ error: "eventId es requerido" }, { status: 400 })
    }

    // Verificar que el evento existe y obtener datos necesarios
    const evento = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        titulo: true,
        rotativos: {
          where: {
            estado: { notIn: ["RECHAZADO", "CANCELADO"] },
          },
        },
      },
    })

    if (!evento) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
    }

    // Verificar si existe un rotativo del usuario en este evento
    const existente = await prisma.rotativo.findFirst({
      where: {
        userId: session.user.id,
        eventId: eventId,
      },
    })

    // Si existe uno activo (PENDIENTE o APROBADO), no permitir
    if (existente && existente.estado !== "RECHAZADO" && existente.estado !== "CANCELADO") {
      return NextResponse.json(
        { error: "Ya tienes un rotativo en este evento" },
        { status: 400 }
      )
    }

    // Si existe uno rechazado/cancelado, lo reutilizaremos
    const rotativoAReutilizar = existente

    // Calcular cupo efectivo
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

    // Verificar fecha pasada (validación básica que siempre debe hacerse)
    // Usar UTC para evitar problemas de timezone entre servidor y cliente
    const ahora = new Date()
    const hoyUTC = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())
    const eventoDate = new Date(evento.date)
    const fechaEventoUTC = Date.UTC(eventoDate.getUTCFullYear(), eventoDate.getUTCMonth(), eventoDate.getUTCDate())
    if (fechaEventoUTC < hoyUTC) {
      return NextResponse.json(
        { error: "No se pueden solicitar rotativos para fechas pasadas" },
        { status: 400 }
      )
    }

    // Usar los valores de validación pasados por el cliente
    // (validados previamente por /api/solicitudes/validar)
    const nuevoEstado = requiereAprobacion ? "PENDIENTE" : "APROBADO"
    const motivoFinal = motivo || null

    console.log("[POST /api/solicitudes] Creando rotativo con estado:", nuevoEstado)

    let rotativo
    if (rotativoAReutilizar) {
      // Reutilizar el rotativo rechazado/cancelado existente
      rotativo = await prisma.rotativo.update({
        where: { id: rotativoAReutilizar.id },
        data: {
          estado: nuevoEstado,
          tipo: "VOLUNTARIO",
          motivo: motivoFinal,
          rechazadoPor: null,
          aprobadoPor: nuevoEstado === "APROBADO" ? session.user.id : null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              alias: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              date: true,
              titulo: {
                select: { name: true },
              },
            },
          },
        },
      })
    } else {
      // Crear nuevo rotativo
      rotativo = await prisma.rotativo.create({
        data: {
          userId: session.user.id,
          eventId: eventId,
          estado: nuevoEstado,
          tipo: "VOLUNTARIO",
          motivo: motivoFinal,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              alias: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              date: true,
              titulo: {
                select: { name: true },
              },
            },
          },
        },
      })
    }

    console.log("[POST /api/solicitudes] Rotativo creado:", rotativo.id, "en", Date.now() - startTime, "ms")

    // Registrar en audit log
    await createAuditLog({
      action: "ROTATIVO_CREADO",
      entityType: "Rotativo",
      entityId: rotativo.id,
      userId: session.user.id,
      details: {
        evento: rotativo.event.title,
        titulo: rotativo.event.titulo?.name,
        fecha: rotativo.event.date,
        estado: rotativo.estado,
        requiereAprobacion: requiereAprobacion || false,
      },
    })

    // Notificar a admins si requiere aprobación
    if (requiereAprobacion) {
      const userName = rotativo.user.alias || rotativo.user.name
      console.log("[POST /api/solicitudes] Notificando a admins...")
      await notifyAdmins({
        type: "SOLICITUD_PENDIENTE",
        title: "Nueva solicitud pendiente",
        message: `${userName} solicitó rotativo para "${rotativo.event.title}" y requiere aprobación`,
        data: {
          rotativoId: rotativo.id,
          eventId: rotativo.eventId,
          eventTitle: rotativo.event.title,
          userId: rotativo.userId,
          userName,
          motivo: motivoFinal,
        },
      })
      console.log("[POST /api/solicitudes] Notificación enviada")
    }

    console.log("[POST /api/solicitudes] Enviando respuesta. Tiempo total:", Date.now() - startTime, "ms")

    return NextResponse.json({
      id: rotativo.id,
      estado: rotativo.estado,
      eventId: rotativo.eventId,
      userId: rotativo.userId,
      motivo: rotativo.motivo,
    })
  } catch (error) {
    console.error("[POST /api/solicitudes] Error:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
