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
    startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
    // Último día del mes: día 0 del mes siguiente
    endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))
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
          user: {
            select: {
              id: true,
              name: true,
              alias: true,
              avatar: true,
            },
          },
        },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  })

  // Helper para obtener cupo según tipo de evento
  const getCupoParaEvento = (
    eventoType: string | null,
    tituloType: string | null,
    isDoble: boolean = false
  ): number => {
    // Si es ensayo, usar cupo de ENSAYO
    if (eventoType === "ENSAYO") {
      return isDoble ? cuposReglas.ENSAYO_DOBLE : cuposReglas.ENSAYO
    }
    // Si es función, usar cupo según tipo de título
    if (eventoType === "FUNCION" && tituloType) {
      const tipoMap: Record<string, string> = {
        OPERA: "OPERA",
        CONCIERTO: "CONCIERTO",
        BALLET: "OPERA", // Ballet usa mismo cupo que ópera
        RECITAL: "CONCIERTO", // Recital usa mismo cupo que concierto
        OTRO: "OTRO",
      }
      const cupoKey = tipoMap[tituloType] || "OTRO"
      return cuposReglas[cupoKey] ?? cuposReglas.OTRO
    }
    return cuposReglas.OTRO
  }

  // Formatear eventos para el calendario
  const eventosFormateados = eventos.map((evento) => {
    // Usar cupoOverride si existe, sino obtener de reglas
    const cupoEfectivo =
      evento.cupoOverride ??
      getCupoParaEvento(
        evento.eventoType,
        evento.titulo?.type ?? null,
        evento.units > 1 // isDoble si tiene más de 1 unidad
      )

    // Convertir fecha a string ISO para evitar problemas de timezone
    // La DB guarda solo fecha (sin hora), pero Prisma la devuelve como UTC midnight
    // Usamos los métodos UTC para extraer el día correcto
    const dateStr = `${evento.date.getUTCFullYear()}-${String(evento.date.getUTCMonth() + 1).padStart(2, '0')}-${String(evento.date.getUTCDate()).padStart(2, '0')}`

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
      rotativosUsados: evento.rotativos.length,
      cupoDisponible: cupoEfectivo - evento.rotativos.length,
      rotativos: evento.rotativos,
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
