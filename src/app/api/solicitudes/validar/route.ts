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
  const { eventId, userId: targetUserId } = body

  if (!eventId) {
    return NextResponse.json({ error: "eventId es requerido" }, { status: 400 })
  }

  // Determine which user to validate for
  // Only admins can validate on behalf of another user
  const isAdmin = session.user.role === "ADMIN"
  const isValidatingForOther = targetUserId && isAdmin && targetUserId !== session.user.id
  const userIdToValidate = isValidatingForOther ? targetUserId : session.user.id

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
      userId: userIdToValidate,
      eventId: eventId,
      estado: { notIn: ["RECHAZADO", "CANCELADO"] },
    },
  })

  if (existente) {
    return NextResponse.json(
      { error: isValidatingForOther ? "El usuario ya tiene un rotativo en este evento" : "Ya tienes un rotativo en este evento" },
      { status: 400 }
    )
  }

  // Calcular cupo efectivo usando reglas
  const cupoDeReglas = await getCupoParaEvento(
    evento.eventoType,
    evento.titulo?.type ?? null
  )
  const cupoEfectivo = evento.cupoOverride ?? cupoDeReglas

  // Determinar si irá a lista de espera (no bloqueamos, solo informamos)
  const sinCupo = evento.rotativos.length >= cupoEfectivo

  // Verificar fecha pasada (solo para usuarios normales, admins pueden crear en fechas pasadas)
  const ahora = new Date()
  const hoyUTC = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())
  const eventoDate = new Date(evento.date)
  const fechaEventoUTC = Date.UTC(eventoDate.getUTCFullYear(), eventoDate.getUTCMonth(), eventoDate.getUTCDate())
  if (fechaEventoUTC < hoyUTC && !isValidatingForOther) {
    return NextResponse.json(
      { error: "No se pueden solicitar rotativos para fechas pasadas" },
      { status: 400 }
    )
  }

  // Validar reglas y recopilar motivos
  const motivosAprobacion: string[] = []
  let debugMaxProyectado: {
    maxEfectivo: number
    totalActual: number
    rotativosReales: number
    rotativosPorLicencia: number
    tieneAjusteManual: boolean
    maxGuardadoEnBD: number
    balanceRotativosTomados: number
    totalCuposTemporada: number
    totalIntegrantes: number
  } | null = null

  // ============================================
  // REGLA: SOBRECUPO (siempre activa)
  // Si el usuario ya está en su máximo o lo superaría, requiere aprobación
  // ============================================
  if (evento.seasonId) {
    // Obtener todos los títulos de la temporada con sus eventos para calcular cupos totales
    const titulos = await prisma.titulo.findMany({
      where: { seasonId: evento.seasonId },
      include: {
        events: {
          select: {
            id: true,
            cupoOverride: true,
          },
        },
      },
    })

    // Calcular total de cupos disponibles en la temporada
    let totalCuposDisponibles = 0
    for (const titulo of titulos) {
      for (const ev of titulo.events) {
        const cupo = ev.cupoOverride ?? titulo.cupo
        totalCuposDisponibles += cupo
      }
    }

    // Contar total de integrantes
    const totalIntegrantes = await prisma.user.count()

    // Calcular máximo por integrante
    const maximoPorIntegrante = totalIntegrantes > 0
      ? Math.round(totalCuposDisponibles / totalIntegrantes)
      : 0

    // Contar rotativos actuales del usuario en la temporada (APROBADO o PENDIENTE)
    const rotativosUsuarioTemporada = await prisma.rotativo.count({
      where: {
        userId: userIdToValidate,
        estado: { in: ["APROBADO", "PENDIENTE"] },
        event: {
          seasonId: evento.seasonId,
        },
      },
    })

    // Si ya está en su máximo o lo superaría, requiere aprobación
    if (rotativosUsuarioTemporada >= maximoPorIntegrante) {
      motivosAprobacion.push(
        `Excede cupo máximo de temporada (${rotativosUsuarioTemporada + 1}/${maximoPorIntegrante})`
      )
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
          userId: userIdToValidate,
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
            userId: userIdToValidate,
            seasonId: temporadaActiva.id,
          },
        },
      })

      if (balance) {
        // Si hay ajuste manual, usarlo. Si no, recalcular siempre en tiempo real
        // (el maxProyectado guardado puede estar desactualizado)
        let maxEfectivo: number

        // Recalcular siempre: obtener total de cupos y total de integrantes
        const titulosTemp = await prisma.titulo.findMany({
          where: { seasonId: temporadaActiva.id },
          include: { events: { select: { cupoOverride: true } } },
        })
        let totalCuposTemp = 0
        for (const t of titulosTemp) {
          for (const e of t.events) {
            totalCuposTemp += e.cupoOverride ?? t.cupo
          }
        }
        const totalIntegrantesTemp = await prisma.user.count()
        const maxCalculado = totalIntegrantesTemp > 0 ? Math.max(1, Math.round(totalCuposTemp / totalIntegrantesTemp)) : 1

        if (balance.maxAjustadoManual !== null) {
          maxEfectivo = balance.maxAjustadoManual
        } else {
          maxEfectivo = maxCalculado
        }

        // Contar rotativos REALES de la base de datos (no usar balance que puede estar desactualizado)
        const rotativosReales = await prisma.rotativo.count({
          where: {
            userId: userIdToValidate,
            estado: { in: ["APROBADO", "PENDIENTE"] },
            event: { seasonId: temporadaActiva.id },
          },
        })
        const rotativosPorLicencia = Math.floor(balance.rotativosPorLicencia || 0)
        const totalActual = rotativosReales + rotativosPorLicencia

        if (totalActual + 1 > maxEfectivo) {
          motivosAprobacion.push(
            `Excede máximo proyectado anual (${totalActual + 1}/${maxEfectivo})`
          )
        }

        // Guardar info de debug para mostrar en la respuesta
        debugMaxProyectado = {
          maxEfectivo,
          totalActual,
          rotativosReales,
          rotativosPorLicencia,
          tieneAjusteManual: balance.maxAjustadoManual !== null,
          maxGuardadoEnBD: balance.maxProyectado,
          balanceRotativosTomados: balance.rotativosTomados,
          totalCuposTemporada: totalCuposTemp,
          totalIntegrantes: totalIntegrantesTemp,
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
              userId: userIdToValidate,
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
          userId: userIdToValidate,
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
    sinCupo, // indica que irá a lista de espera
    debug: debugMaxProyectado, // Info de cálculo del máximo proyectado
  })
}
