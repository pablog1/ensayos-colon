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

// POST /api/solicitudes/validar - Validar si un rotativo requiere aprobación
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

  // Verificar que no exista ya un rotativo activo del usuario en este evento
  // (excluir rechazados y cancelados)
  const existente = await prisma.rotativo.findFirst({
    where: {
      userId: session.user.id,
      eventId: eventId,
      estado: { notIn: ["RECHAZADO", "CANCELADO"] },
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

  // Validar reglas y recopilar motivos
  const motivosAprobacion: string[] = []

  // ============================================
  // REGLA: PLAZO_SOLICITUD
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
      motivosAprobacion.push("Solicitud del mismo día")
    }
  }

  // ============================================
  // REGLA: FINES_SEMANA_MAX
  // ============================================
  const reglaFinesSemana = await prisma.ruleConfig.findUnique({
    where: { key: "FINES_SEMANA_MAX" },
  })

  if (reglaFinesSemana?.enabled) {
    const fechaEvento = new Date(evento.date)
    const diaSemana = fechaEvento.getUTCDay()
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6

    if (esFinDeSemana) {
      const maxPorMes = parseInt(reglaFinesSemana.value) || 1
      const year = fechaEvento.getUTCFullYear()
      const month = fechaEvento.getUTCMonth()
      const inicioMes = new Date(Date.UTC(year, month, 1))
      const finMes = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59))

      const rotativosFinDeSemana = await prisma.rotativo.findMany({
        where: {
          userId: session.user.id,
          estado: { in: ["APROBADO", "PENDIENTE"] },
          event: {
            date: { gte: inicioMes, lte: finMes },
          },
        },
        include: { event: { select: { date: true } } },
      })

      const finesDeSemanasUsados = new Set<string>()
      for (const r of rotativosFinDeSemana) {
        const dia = r.event.date.getUTCDay()
        if (dia === 0 || dia === 6) {
          const d = new Date(r.event.date)
          const weekNum = getWeekNumber(d)
          finesDeSemanasUsados.add(`${d.getUTCFullYear()}-W${weekNum}`)
        }
      }

      if (finesDeSemanasUsados.size >= maxPorMes) {
        motivosAprobacion.push(
          `Excede límite de fines de semana (${finesDeSemanasUsados.size}/${maxPorMes} este mes)`
        )
      }
    }
  }

  // ============================================
  // REGLA: MAX_PROYECTADO
  // ============================================
  const reglaMaxProyectado = await prisma.ruleConfig.findUnique({
    where: { key: "MAX_PROYECTADO" },
  })

  if (reglaMaxProyectado?.enabled) {
    const temporadaActiva = await prisma.season.findFirst({
      where: { isActive: true },
    })

    if (temporadaActiva) {
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
          motivosAprobacion.push(
            `Excede máximo proyectado anual (${totalActual + 1}/${maxEfectivo})`
          )
        }
      }
    }
  }

  // ============================================
  // REGLA: ENSAYOS_DOBLES
  // ============================================
  if (evento.eventoType === "ENSAYO" && evento.tituloId) {
    const reglaEnsayosDobles = await prisma.ruleConfig.findUnique({
      where: { key: "ENSAYOS_DOBLES" },
    })

    if (reglaEnsayosDobles?.enabled) {
      const config = JSON.parse(reglaEnsayosDobles.value)
      const maxRotativosPorTitulo = config.maxRotativosPorTitulo ?? 1

      const ensayosDelTitulo = await prisma.event.findMany({
        where: { tituloId: evento.tituloId, eventoType: "ENSAYO" },
        select: { id: true, date: true },
      })

      const ensayosPorFecha: Record<string, string[]> = {}
      for (const ensayo of ensayosDelTitulo) {
        const fechaKey = `${ensayo.date.getUTCFullYear()}-${String(ensayo.date.getUTCMonth() + 1).padStart(2, "0")}-${String(ensayo.date.getUTCDate()).padStart(2, "0")}`
        if (!ensayosPorFecha[fechaKey]) ensayosPorFecha[fechaKey] = []
        ensayosPorFecha[fechaKey].push(ensayo.id)
      }

      const diasDobles: { fecha: string; eventIds: string[] }[] = []
      for (const [fecha, eventIds] of Object.entries(ensayosPorFecha)) {
        if (eventIds.length > 1) diasDobles.push({ fecha, eventIds })
      }

      if (diasDobles.length > 0) {
        const fechaEventoActual = `${evento.date.getUTCFullYear()}-${String(evento.date.getUTCMonth() + 1).padStart(2, "0")}-${String(evento.date.getUTCDate()).padStart(2, "0")}`
        const esDiaDoble = diasDobles.some((d) => d.fecha === fechaEventoActual)

        if (esDiaDoble) {
          const eventIdsEnDiasDobles = diasDobles.flatMap((d) => d.eventIds)
          const rotativosEnDiasDobles = await prisma.rotativo.count({
            where: {
              userId: session.user.id,
              eventId: { in: eventIdsEnDiasDobles },
              estado: { in: ["APROBADO", "PENDIENTE"] },
            },
          })

          if (rotativosEnDiasDobles >= maxRotativosPorTitulo) {
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
  if (evento.eventoType === "FUNCION" && evento.tituloId) {
    const reglaFunciones = await prisma.ruleConfig.findUnique({
      where: { key: "FUNCIONES_POR_TITULO" },
    })

    if (reglaFunciones?.enabled) {
      const config = JSON.parse(reglaFunciones.value)
      const { umbralFunciones, maxHasta, porcentajeSobre } = config

      const totalFuncionesTitulo = await prisma.event.count({
        where: { tituloId: evento.tituloId, eventoType: "FUNCION" },
      })

      const funcionesUsuarioEnTitulo = await prisma.rotativo.count({
        where: {
          userId: session.user.id,
          event: { tituloId: evento.tituloId, eventoType: "FUNCION" },
        },
      })

      let maxFuncionesPermitidas: number
      if (totalFuncionesTitulo <= umbralFunciones) {
        maxFuncionesPermitidas = maxHasta
      } else {
        maxFuncionesPermitidas = Math.ceil(totalFuncionesTitulo * porcentajeSobre / 100)
      }

      if (funcionesUsuarioEnTitulo >= maxFuncionesPermitidas) {
        motivosAprobacion.push(
          `Excede límite de funciones por título (${funcionesUsuarioEnTitulo}/${maxFuncionesPermitidas})`
        )
      }
    }
  }

  // Retornar resultado de validación
  const requiereAprobacion = motivosAprobacion.length > 0
  return NextResponse.json({
    requiereAprobacion,
    motivos: motivosAprobacion,
    motivoTexto: motivosAprobacion.join("; "),
  })
}
