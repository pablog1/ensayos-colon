import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/temporada/stats - Obtener estadisticas de la temporada
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Obtener temporada activa
  const season = await prisma.season.findFirst({
    where: { isActive: true },
  })

  if (!season) {
    return NextResponse.json({ error: "No hay temporada activa" }, { status: 404 })
  }

  // Obtener todos los titulos con sus eventos
  const titulos = await prisma.titulo.findMany({
    where: { seasonId: season.id },
    include: {
      events: {
        select: {
          id: true,
          eventoType: true,
          cupoOverride: true,
        },
      },
    },
  })

  // Calcular totales
  let totalEventos = 0
  let totalEnsayos = 0
  let totalFunciones = 0
  let totalRotativosDisponibles = 0

  const titulosPorTipo: Record<string, number> = {
    OPERA: 0,
    CONCIERTO: 0,
    BALLET: 0,
    RECITAL: 0,
    OTRO: 0,
  }

  for (const titulo of titulos) {
    titulosPorTipo[titulo.type]++

    for (const evento of titulo.events) {
      totalEventos++
      const cupo = evento.cupoOverride ?? titulo.cupo
      totalRotativosDisponibles += cupo

      if (evento.eventoType === "ENSAYO") {
        totalEnsayos++
      } else {
        totalFunciones++
      }
    }
  }

  // Obtener total de integrantes
  const totalIntegrantes = await prisma.user.count({
    where: { role: "INTEGRANTE" },
  })

  // Calcular promedio de rotativos por integrante
  const promedioRotativosPorIntegrante =
    totalIntegrantes > 0
      ? Math.floor(totalRotativosDisponibles / totalIntegrantes)
      : 0

  return NextResponse.json({
    season: {
      id: season.id,
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
    },
    titulos: {
      total: titulos.length,
      porTipo: titulosPorTipo,
    },
    eventos: {
      total: totalEventos,
      ensayos: totalEnsayos,
      funciones: totalFunciones,
    },
    rotativos: {
      totalDisponibles: totalRotativosDisponibles,
      totalIntegrantes,
      promedioPorintegrante: promedioRotativosPorIntegrante,
    },
  })
}
