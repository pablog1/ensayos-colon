import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCuposFromRules, type CupoDiarioConfig } from "@/lib/services/cupo-rules"

// GET /api/calendario - Lista eventos para el calendario
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get("mes") // formato: "2024-12"
  const tituloId = searchParams.get("tituloId")

  // Calcular rango de fechas (usando UTC para evitar problemas de timezone)
  let startDate: Date
  let endDate: Date

  if (mes) {
    const [year, month] = mes.split("-").map(Number)
    // Usar UTC para evitar problemas de timezone
    // Extender rango para incluir días visibles en el calendario (días de meses adyacentes)
    // El calendario puede mostrar hasta 6 días del mes anterior y 13 del siguiente
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
    const dayOfWeek = firstOfMonth.getUTCDay() // 0=domingo, 1=lunes, etc.
    // Ajustar para que martes sea el primer día de la semana (dayOfWeek: mar=2)
    const daysFromPrevMonth = dayOfWeek === 0 ? 5 : dayOfWeek === 1 ? 6 : dayOfWeek - 2
    startDate = new Date(Date.UTC(year, month - 1, 1 - daysFromPrevMonth, 0, 0, 0))
    // Último día del mes + hasta 13 días del siguiente mes para completar la grilla
    endDate = new Date(Date.UTC(year, month, 13, 23, 59, 59))
  } else {
    // Por defecto, mostrar mes actual
    const now = new Date()
    startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0))
    endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59))
  }

  const whereClause: {
    date: { gte: Date; lte: Date }
    tituloId?: string | { not: null }
  } = {
    date: {
      gte: startDate,
      lte: endDate,
    },
  }

  if (tituloId) {
    whereClause.tituloId = tituloId
  } else {
    // Solo mostrar eventos que pertenecen a un titulo
    whereClause.tituloId = { not: null }
  }

  // Obtener cupos de reglas
  const cuposReglas = await getCuposFromRules()

  const eventos = await prisma.event.findMany({
    where: whereClause,
    include: {
      titulo: {
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
        },
      },
      rotativos: {
        select: {
          id: true,
          estado: true,
          motivo: true,
          motivoInicial: true,
          aprobadoPor: true,
          validationResults: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              alias: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  })

  // Helper para obtener cupo según tipo de título
  // Tanto ensayos como funciones de un mismo título usan el mismo cupo
  const getCupoParaEvento = (
    _eventoType: string | null,
    tituloType: string | null
  ): number => {
    if (tituloType) {
      const tipoMap: Record<string, string> = {
        OPERA: "OPERA",
        CONCIERTO: "CONCIERTO",
        BALLET: "BALLET",
        RECITAL: "CONCIERTO",
        OTRO: "BALLET",
      }
      const cupoKey = tipoMap[tituloType] || "BALLET"
      return cuposReglas[cupoKey] ?? cuposReglas.BALLET
    }
    return cuposReglas.BALLET
  }

  // Formatear eventos para el calendario
  const eventosFormateados = eventos.map((evento) => {
    // Usar cupoOverride si existe, sino obtener de reglas
    const cupoEfectivo =
      evento.cupoOverride ??
      getCupoParaEvento(
        evento.eventoType,
        evento.titulo?.type ?? null
      )

    // Convertir fecha a string ISO para evitar problemas de timezone
    // La DB guarda solo fecha (sin hora), pero Prisma la devuelve como UTC midnight
    // Usamos los métodos UTC para extraer el día correcto
    const dateStr = `${evento.date.getUTCFullYear()}-${String(evento.date.getUTCMonth() + 1).padStart(2, '0')}-${String(evento.date.getUTCDate()).padStart(2, '0')}`

    // Filtrar solo rotativos activos (APROBADO o PENDIENTE) para contar el cupo usado
    const rotativosActivos = evento.rotativos.filter(
      r => r.estado === "APROBADO" || r.estado === "PENDIENTE"
    )

    // Incluir también los EN_ESPERA para mostrar al usuario (pero no cuentan para el cupo)
    // Los rotativos ya vienen ordenados por createdAt ASC (FIFO)
    const rotativosVisibles = evento.rotativos.filter(
      r => r.estado === "APROBADO" || r.estado === "PENDIENTE" || r.estado === "EN_ESPERA"
    )

    // Calcular posición en cola para los EN_ESPERA (FIFO basado en createdAt)
    let posicionEnCola = 0
    const rotativosConPosicion = rotativosVisibles.map(r => {
      if (r.estado === "EN_ESPERA") {
        posicionEnCola++
        return { ...r, posicionEnCola }
      }
      return { ...r, posicionEnCola: null }
    })

    return {
      id: evento.id,
      title: evento.title,
      date: dateStr,
      eventoType: evento.eventoType,
      startTime: evento.startTime,
      endTime: evento.endTime,
      tituloId: evento.tituloId,
      tituloName: evento.titulo?.name,
      tituloType: evento.titulo?.type,
      tituloColor: evento.titulo?.color,
      cupoEfectivo,
      cupoOverride: evento.cupoOverride,
      rotativosUsados: rotativosActivos.length,
      cupoDisponible: cupoEfectivo - rotativosActivos.length,
      rotativos: rotativosConPosicion,
    }
  })

  // Obtener títulos que se superponen con el mes para mostrar rangos de color
  const titulos = await prisma.titulo.findMany({
    where: {
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: {
      id: true,
      name: true,
      color: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "asc" },
  })

  return NextResponse.json({
    eventos: eventosFormateados,
    titulos: titulos.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      startDate: t.startDate.toISOString().split("T")[0],
      endDate: t.endDate.toISOString().split("T")[0],
    })),
  })
}
