import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCupoParaEvento } from "@/lib/services/cupo-rules"
import { createAuditLog } from "@/lib/services/audit"
import { notifyAdmins, notifyAlertaCercania, verificarYNotificarBajoCupo } from "@/lib/services/notifications"
import { addToWaitingList, getUserWaitingListPosition } from "@/lib/services/waiting-list"

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
  const soloMias = searchParams.get("soloMias") === "true"

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
  // Si soloMias=true, mostrar solo las del usuario actual (para "Mis Solicitudes")
  // Si no, admin puede ver todos, integrante solo los suyos
  let userFilter = {}
  if (!verTodas) {
    if (soloMias) {
      // Forzar filtro por usuario actual, independientemente del rol
      userFilter = { userId: session.user.id }
    } else {
      userFilter =
        session.user.role === "ADMIN"
          ? userId
            ? { userId }
            : {}
          : { userId: session.user.id }
    }
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
          startTime: true,
          eventoType: true,
          tituloId: true,
          titulo: {
            select: {
              id: true,
              name: true,
              color: true,
              type: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Formatear para compatibilidad con el frontend
  // Para solicitudes EN_ESPERA, obtener la posición en cola
  const solicitudesFormateadas = await Promise.all(rotativos.map(async r => {
    let posicionEnCola: number | null = null
    if (r.estado === "EN_ESPERA") {
      posicionEnCola = await getUserWaitingListPosition(r.userId, r.eventId)
    }

    return {
      id: r.id,
      fecha: `${r.event.date.getUTCFullYear()}-${String(r.event.date.getUTCMonth() + 1).padStart(2, '0')}-${String(r.event.date.getUTCDate()).padStart(2, '0')}`,
      estado: r.estado,
      esCasoEspecial: false,
      porcentajeAlMomento: r.contadorAlMomento,
      createdAt: r.createdAt,
      user: r.user,
      motivo: r.motivo,
      posicionEnCola,
      // Datos adicionales del evento
      eventoId: r.event.id,
      eventoTitle: r.event.title,
      eventoType: r.event.eventoType,
      tituloId: r.event.tituloId,
      tituloName: r.event.titulo?.name,
      tituloColor: r.event.titulo?.color,
      tituloType: r.event.titulo?.type,
      esEventoIndividualConcierto: r.event.titulo?.type === "CONCIERTO" && !r.esParteDeBloqueId,
      // Hora del evento
      eventoHora: r.event.startTime ? r.event.startTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : null,
      // Información de bloque para cancelación
      esParteDeBloque: !!r.esParteDeBloqueId,
      bloqueId: r.esParteDeBloqueId,
    }
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
            estado: { notIn: ["RECHAZADO", "CANCELADO", "EN_ESPERA"] },
          },
        },
      },
    })

    if (!evento) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
    }

    // Verificar si es un concierto - eventos individuales requieren aprobación obligatoria
    const esEventoIndividualConcierto = evento.titulo?.type === "CONCIERTO"

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

    // Verificar si hay cupo disponible
    const sinCupo = evento.rotativos.length >= cupoEfectivo

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

    // Determinar estado del rotativo
    // Si no hay cupo, va a lista de espera
    // Si es evento individual de concierto o requiere aprobación, queda pendiente
    // Si no, se aprueba directamente
    let nuevoEstado: "EN_ESPERA" | "PENDIENTE" | "APROBADO"
    if (sinCupo) {
      nuevoEstado = "EN_ESPERA"
    } else if (esEventoIndividualConcierto || requiereAprobacion) {
      nuevoEstado = "PENDIENTE"
    } else {
      nuevoEstado = "APROBADO"
    }

    // Construir motivo final - agregar indicador si es evento individual de concierto
    let motivoFinal = motivo || null
    if (esEventoIndividualConcierto) {
      const motivoConcierto = "[EVENTO INDIVIDUAL DE CONCIERTO - Requiere aprobación especial]"
      motivoFinal = motivoFinal ? `${motivoConcierto} ${motivoFinal}` : motivoConcierto
    }

    console.log("[POST /api/solicitudes] Creando rotativo con estado:", nuevoEstado, "sinCupo:", sinCupo)

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
              startTime: true,
              eventoType: true,
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
              startTime: true,
              eventoType: true,
              titulo: {
                select: { name: true },
              },
            },
          },
        },
      })
    }

    console.log("[POST /api/solicitudes] Rotativo creado:", rotativo.id, "en", Date.now() - startTime, "ms")

    // Si está en espera, agregar a lista de espera
    let posicionEnEspera: number | null = null
    if (nuevoEstado === "EN_ESPERA") {
      const temporadaActiva = await prisma.season.findFirst({
        where: { isActive: true },
      })
      if (temporadaActiva) {
        const { position } = await addToWaitingList(
          session.user.id,
          eventId,
          temporadaActiva.id
        )
        posicionEnEspera = position
        console.log("[POST /api/solicitudes] Agregado a lista de espera, posición:", position)
      }
    }

    // Registrar en audit log
    await createAuditLog({
      action: nuevoEstado === "EN_ESPERA" ? "ROTATIVO_EN_ESPERA" : "ROTATIVO_CREADO",
      entityType: "Rotativo",
      entityId: rotativo.id,
      userId: session.user.id,
      details: {
        evento: rotativo.event.title,
        titulo: rotativo.event.titulo?.name,
        fecha: rotativo.event.date,
        horario: rotativo.event.startTime?.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }),
        tipoEvento: rotativo.event.eventoType,
        estado: rotativo.estado,
        posicionEnEspera,
        requiereAprobacion: requiereAprobacion || false,
      },
    })

    // Notificar a admins si requiere aprobación (solo si no está en espera)
    if (requiereAprobacion && nuevoEstado === "PENDIENTE") {
      const userName = rotativo.user.alias || rotativo.user.name
      const fechaStr = rotativo.event.date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
      const horaStr = rotativo.event.startTime
        ? ` a las ${rotativo.event.startTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}`
        : ""
      const tipoStr = rotativo.event.eventoType ? ` (${rotativo.event.eventoType})` : ""

      console.log("[POST /api/solicitudes] Notificando a admins...")
      await notifyAdmins({
        type: "SOLICITUD_PENDIENTE",
        title: "Nueva solicitud pendiente",
        message: `${userName} solicitó rotativo para "${rotativo.event.title}" el ${fechaStr}${horaStr}${tipoStr}`,
        data: {
          rotativoId: rotativo.id,
          eventId: rotativo.eventId,
          eventTitle: rotativo.event.title,
          eventDate: rotativo.event.date.toISOString(),
          eventStartTime: rotativo.event.startTime?.toISOString(),
          eventType: rotativo.event.eventoType,
          userId: rotativo.userId,
          userName,
          motivo: motivoFinal,
        },
      })
      console.log("[POST /api/solicitudes] Notificación enviada")
    }

    // Verificar si el usuario está cerca del máximo y enviar alerta (solo si fue aprobado)
    // Usar la temporada del evento, no la temporada "activa"
    if (nuevoEstado === "APROBADO") {
      try {
        const seasonId = evento.seasonId
        console.log("[DEBUG solicitudes/route] Usando seasonId del evento:", seasonId)

        const balance = await prisma.userSeasonBalance.findUnique({
          where: {
            userId_seasonId: {
              userId: session.user.id,
              seasonId: seasonId,
            },
          },
        })

        if (balance) {
          // Calcular máximo proyectado siempre en tiempo real
          const titulos = await prisma.titulo.findMany({
            where: { seasonId: seasonId },
            include: { events: { select: { cupoOverride: true } } },
          })
          let totalCupos = 0
          for (const t of titulos) {
            for (const e of t.events) {
              totalCupos += e.cupoOverride ?? t.cupo
            }
          }
          const totalIntegrantes = await prisma.user.count()
          const maxEfectivo = totalIntegrantes > 0 ? Math.max(1, Math.floor(totalCupos / totalIntegrantes)) : 1

          console.log("[DEBUG solicitudes/route] titulos:", titulos.length, "totalCupos:", totalCupos, "totalIntegrantes:", totalIntegrantes, "maxEfectivo:", maxEfectivo)

          const totalActual =
            balance.rotativosTomados +
            balance.rotativosObligatorios +
            balance.rotativosPorLicencia

          // Obtener umbral de alerta (default 90%)
          const reglaUmbral = await prisma.ruleConfig.findUnique({
            where: { key: "ALERTA_UMBRAL" },
          })
          const umbral = reglaUmbral?.enabled ? parseInt(reglaUmbral.value) || 90 : 90

          const porcentaje = (totalActual / maxEfectivo) * 100

          // Determinar nivel de alerta
          let nivelAlerta: "CERCANIA" | "LIMITE" | "EXCESO" | null = null
          if (totalActual > maxEfectivo) {
            nivelAlerta = "EXCESO"
          } else if (porcentaje >= umbral) {
            nivelAlerta = "LIMITE"
          } else if (porcentaje >= umbral - 10) {
            nivelAlerta = "CERCANIA"
          }

          // Enviar notificación si hay alerta
          if (nivelAlerta) {
            await notifyAlertaCercania({
              userId: session.user.id,
              totalActual,
              maxProyectado: maxEfectivo,
              porcentaje,
              nivelAlerta,
            })
          }
        }
      } catch (error) {
        console.error("[POST /api/solicitudes] Error al verificar alerta de cercanía:", error)
      }
    }

    // Verificar si hay usuarios con bajo cupo (para APROBADO y PENDIENTE)
    if (nuevoEstado === "APROBADO" || nuevoEstado === "PENDIENTE") {
      verificarYNotificarBajoCupo().catch((err) =>
        console.error("[POST /api/solicitudes] Error al verificar bajo cupo:", err)
      )
    }

    console.log("[POST /api/solicitudes] Enviando respuesta. Tiempo total:", Date.now() - startTime, "ms")

    return NextResponse.json({
      id: rotativo.id,
      estado: rotativo.estado,
      eventId: rotativo.eventId,
      userId: rotativo.userId,
      motivo: rotativo.motivo,
      posicionEnEspera,
    })
  } catch (error) {
    console.error("[POST /api/solicitudes] Error:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
