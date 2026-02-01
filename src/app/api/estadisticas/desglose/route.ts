import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/estadisticas/desglose - Obtener desglose de cupos por título
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const yearParam = searchParams.get("year")
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

  // Buscar la temporada del año solicitado
  const season = await prisma.season.findFirst({
    where: {
      OR: [
        { name: { contains: year.toString() } },
        {
          AND: [
            { startDate: { lte: new Date(`${year}-12-31`) } },
            { endDate: { gte: new Date(`${year}-01-01`) } },
          ],
        },
      ],
    },
  })

  if (!season) {
    return NextResponse.json({ titulos: [], totalGeneral: 0 })
  }

  // Obtener títulos con sus eventos
  const titulos = await prisma.titulo.findMany({
    where: { seasonId: season.id },
    include: {
      events: {
        select: {
          id: true,
          date: true,
          cupoOverride: true,
        },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { name: "asc" },
  })

  // Calcular desglose
  let totalGeneral = 0
  const desglose = titulos.map((titulo) => {
    const eventos = titulo.events.map((evento) => {
      const cupo = evento.cupoOverride ?? titulo.cupo
      return {
        id: evento.id,
        fecha: evento.date.toISOString(),
        cupo,
      }
    })

    const subtotal = eventos.reduce((sum, e) => sum + e.cupo, 0)
    totalGeneral += subtotal

    // Obtener fecha de inicio y fin del título
    const fechaInicio = titulo.events.length > 0 ? titulo.events[0].date : null
    const fechaFin = titulo.events.length > 0 ? titulo.events[titulo.events.length - 1].date : null

    return {
      id: titulo.id,
      nombre: titulo.name,
      cupoDefault: titulo.cupo,
      cantidadEventos: eventos.length,
      fechaInicio: fechaInicio?.toISOString() ?? null,
      fechaFin: fechaFin?.toISOString() ?? null,
      eventos,
      subtotal,
    }
  })

  // Ordenar títulos cronológicamente por fecha de inicio
  desglose.sort((a, b) => {
    if (!a.fechaInicio) return 1
    if (!b.fechaInicio) return -1
    return new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()
  })

  return NextResponse.json({
    temporada: season.name,
    titulos: desglose,
    totalGeneral,
  })
}
