import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCupoParaEvento } from "@/lib/services/cupo-rules"

// Helper: Obtener número de semana del año
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

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

  // Determinar si requiere aprobación de admin
  let requiereAprobacion = false
  const motivosAprobacion: string[] = []

  // ============================================
  // REGLA: PLAZO_SOLICITUD
  // Solicitudes del mismo día requieren aprobación
  // ============================================
  const reglaPlazo = await prisma.ruleConfig.findUnique({
    where: { key: "PLAZO_SOLICITUD" },
  })

  if (reglaPlazo?.enabled) {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const fechaEvento = new Date(evento.date)
    fechaEvento.setHours(0, 0, 0, 0)

    const diffMs = fechaEvento.getTime() - hoy.getTime()
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDias < 0) {
      return NextResponse.json(
        { error: "No se pueden solicitar rotativos para fechas pasadas" },
        { status: 400 }
      )
    }

    if (diffDias === 0) {
      requiereAprobacion = true
      motivosAprobacion.push("Solicitud del mismo día")
    }
  }

  // ============================================
  // REGLA: FINES_SEMANA_MAX
  // Máximo de fines de semana con rotativo por mes
  // ============================================
  const reglaFinesSemana = await prisma.ruleConfig.findUnique({
    where: { key: "FINES_SEMANA_MAX" },
  })

  if (reglaFinesSemana?.enabled) {
    const fechaEvento = new Date(evento.date)
    const diaSemana = fechaEvento.getUTCDay() // 0 = domingo, 6 = sábado
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6

    if (esFinDeSemana) {
      const maxPorMes = parseInt(reglaFinesSemana.value) || 1

      // Obtener el mes del evento
      const year = fechaEvento.getUTCFullYear()
      const month = fechaEvento.getUTCMonth()
      const inicioMes = new Date(Date.UTC(year, month, 1))
      const finMes = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59))

      // Contar fines de semana ya usados este mes
      const rotativosFinDeSemana = await prisma.rotativo.findMany({
        where: {
          userId: session.user.id,
          estado: { in: ["APROBADO", "PENDIENTE"] },
          event: {
            date: {
              gte: inicioMes,
              lte: finMes,
            },
          },
        },
        include: {
          event: {
            select: { date: true },
          },
        },
      })

      // Agrupar por fin de semana (contar fines de semana únicos)
      const finesDeSemanasUsados = new Set<string>()
      for (const r of rotativosFinDeSemana) {
        const dia = r.event.date.getUTCDay()
        if (dia === 0 || dia === 6) {
          // Usar la semana del año como identificador del fin de semana
          const d = new Date(r.event.date)
          const weekNum = getWeekNumber(d)
          finesDeSemanasUsados.add(`${d.getUTCFullYear()}-W${weekNum}`)
        }
      }

      if (finesDeSemanasUsados.size >= maxPorMes) {
        requiereAprobacion = true
        motivosAprobacion.push(
          `Excede límite de fines de semana (${finesDeSemanasUsados.size}/${maxPorMes} este mes)`
        )
      }
    }
  }

  // ============================================
  // REGLA: MAX_PROYECTADO
  // Límite anual de rotativos
  // ============================================
  const reglaMaxProyectado = await prisma.ruleConfig.findUnique({
    where: { key: "MAX_PROYECTADO" },
  })

  if (reglaMaxProyectado?.enabled) {
    // Obtener la temporada activa
    const temporadaActiva = await prisma.season.findFirst({
      where: { isActive: true },
    })

    if (temporadaActiva) {
      // Obtener balance del usuario
      const balance = await prisma.userSeasonBalance.findUnique({
        where: {
          userId_seasonId: {
            userId: session.user.id,
            seasonId: temporadaActiva.id,
          },
        },
      })

      if (balance) {
        const maxEfectivo = balance.maxAjustadoManual ?? balance.maxProyectado
        const totalActual =
          balance.rotativosTomados +
          balance.rotativosObligatorios +
          balance.rotativosPorLicencia

        if (totalActual + 1 > maxEfectivo) {
          requiereAprobacion = true
          motivosAprobacion.push(
            `Excede máximo proyectado anual (${totalActual + 1}/${maxEfectivo})`
          )
        }
      }
    }
  }

  // ============================================
  // REGLA: ENSAYOS_DOBLES
  // Máximo de rotativos en días con ensayos dobles
  // ============================================
  if (evento.eventoType === "ENSAYO" && evento.tituloId) {
    const reglaEnsayosDobles = await prisma.ruleConfig.findUnique({
      where: { key: "ENSAYOS_DOBLES" },
    })

    if (reglaEnsayosDobles?.enabled) {
      const config = JSON.parse(reglaEnsayosDobles.value)
      const maxRotativosPorTitulo = config.maxRotativosPorTitulo ?? 1

      // Obtener todos los ensayos del mismo título
      const ensayosDelTitulo = await prisma.event.findMany({
        where: {
          tituloId: evento.tituloId,
          eventoType: "ENSAYO",
        },
        select: {
          id: true,
          date: true,
        },
      })

      // Agrupar por fecha para identificar días dobles
      const ensayosPorFecha: Record<string, string[]> = {}
      for (const ensayo of ensayosDelTitulo) {
        const fechaKey = `${ensayo.date.getUTCFullYear()}-${String(ensayo.date.getUTCMonth() + 1).padStart(2, "0")}-${String(ensayo.date.getUTCDate()).padStart(2, "0")}`
        if (!ensayosPorFecha[fechaKey]) {
          ensayosPorFecha[fechaKey] = []
        }
        ensayosPorFecha[fechaKey].push(ensayo.id)
      }

      // Identificar días dobles
      const diasDobles: { fecha: string; eventIds: string[] }[] = []
      for (const [fecha, eventIds] of Object.entries(ensayosPorFecha)) {
        if (eventIds.length > 1) {
          diasDobles.push({ fecha, eventIds })
        }
      }

      if (diasDobles.length > 0) {
        // Verificar si el evento actual está en un día doble
        const fechaEventoActual = `${evento.date.getUTCFullYear()}-${String(evento.date.getUTCMonth() + 1).padStart(2, "0")}-${String(evento.date.getUTCDate()).padStart(2, "0")}`
        const esDiaDoble = diasDobles.some((d) => d.fecha === fechaEventoActual)

        if (esDiaDoble) {
          // Obtener todos los IDs de eventos en días dobles
          const eventIdsEnDiasDobles = diasDobles.flatMap((d) => d.eventIds)

          // Buscar rotativos del usuario en días dobles de este título
          const rotativosEnDiasDobles = await prisma.rotativo.count({
            where: {
              userId: session.user.id,
              eventId: { in: eventIdsEnDiasDobles },
              estado: { in: ["APROBADO", "PENDIENTE"] },
            },
          })

          if (rotativosEnDiasDobles >= maxRotativosPorTitulo) {
            requiereAprobacion = true
            motivosAprobacion.push(
              `Excede límite en días con ensayos dobles (${rotativosEnDiasDobles}/${maxRotativosPorTitulo})`
            )
          }
        }
      }
    }
  }

  // ============================================
  // REGLA: FUNCIONES_POR_TITULO
  // ============================================
  // Validar regla FUNCIONES_POR_TITULO (solo para funciones)
  if (evento.eventoType === "FUNCION" && evento.tituloId) {
    // Obtener configuración de la regla
    const reglaFunciones = await prisma.ruleConfig.findUnique({
      where: { key: "FUNCIONES_POR_TITULO" },
    })

    if (reglaFunciones?.enabled) {
      const config = JSON.parse(reglaFunciones.value)
      const { umbralFunciones, maxHasta, porcentajeSobre } = config

      // Contar total de funciones del título
      const totalFuncionesTitulo = await prisma.event.count({
        where: {
          tituloId: evento.tituloId,
          eventoType: "FUNCION",
        },
      })

      // Contar funciones que el usuario ya tiene para este título
      const funcionesUsuarioEnTitulo = await prisma.rotativo.count({
        where: {
          userId: session.user.id,
          event: {
            tituloId: evento.tituloId,
            eventoType: "FUNCION",
          },
        },
      })

      // Calcular límite según la regla
      let maxFuncionesPermitidas: number
      if (totalFuncionesTitulo <= umbralFunciones) {
        maxFuncionesPermitidas = maxHasta
      } else {
        maxFuncionesPermitidas = Math.ceil(totalFuncionesTitulo * porcentajeSobre / 100)
      }

      // Si ya está en el límite o lo supera, requiere aprobación
      if (funcionesUsuarioEnTitulo >= maxFuncionesPermitidas) {
        requiereAprobacion = true
        motivosAprobacion.push(
          `Excede límite de funciones por título (${funcionesUsuarioEnTitulo}/${maxFuncionesPermitidas})`
        )
      }
    }
  }

  // Crear rotativo (PENDIENTE si requiere aprobación, APROBADO si no)
  const motivoFinal = motivosAprobacion.length > 0 ? motivosAprobacion.join("; ") : null
  const rotativo = await prisma.rotativo.create({
    data: {
      userId: session.user.id,
      eventId: eventId,
      estado: requiereAprobacion ? "PENDIENTE" : "APROBADO",
      tipo: "VOLUNTARIO",
      motivo: motivoFinal,
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
