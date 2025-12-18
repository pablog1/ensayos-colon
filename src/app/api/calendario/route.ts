import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/calendario - Lista eventos para el calendario
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get("mes") // formato: "2024-12"
  const tituloId = searchParams.get("tituloId")

  // Calcular rango de fechas
  let startDate: Date
  let endDate: Date

  if (mes) {
    const [year, month] = mes.split("-").map(Number)
    startDate = new Date(year, month - 1, 1)
    endDate = new Date(year, month, 0)
  } else {
    // Por defecto, mostrar mes actual
    const now = new Date()
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
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

  const eventos = await prisma.event.findMany({
    where: whereClause,
    include: {
      titulo: {
        select: {
          id: true,
          name: true,
          type: true,
          cupoEnsayo: true,
          cupoFuncion: true,
          color: true,
        },
      },
      _count: {
        select: { rotativos: true },
      },
    },
    orderBy: { date: "asc" },
  })

  // Formatear eventos para el calendario
  const eventosFormateados = eventos.map((evento) => {
    const cupoEfectivo =
      evento.cupoOverride ??
      (evento.titulo
        ? evento.eventoType === "ENSAYO"
          ? evento.titulo.cupoEnsayo
          : evento.titulo.cupoFuncion
        : 2)

    return {
      id: evento.id,
      title: evento.title,
      date: evento.date,
      eventoType: evento.eventoType,
      startTime: evento.startTime,
      endTime: evento.endTime,
      tituloId: evento.tituloId,
      tituloName: evento.titulo?.name,
      tituloType: evento.titulo?.type,
      tituloColor: evento.titulo?.color,
      cupoEfectivo,
      rotativosUsados: evento._count.rotativos,
      cupoDisponible: cupoEfectivo - evento._count.rotativos,
    }
  })

  return NextResponse.json(eventosFormateados)
}
