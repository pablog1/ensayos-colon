import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getArgentinaDateKey } from "@/lib/date-utils"

export interface DescansoCalendario {
  fecha: string
  descansos: {
    id: string
    userName: string
    estado: string
  }[]
}

// GET /api/solicitudes/calendario - Obtener descansos agrupados por fecha
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get("mes")

  if (!mes) {
    return NextResponse.json({ error: "Mes es requerido" }, { status: 400 })
  }

  const [year, month] = mes.split("-").map(Number)
  const inicioMes = new Date(year, month - 1, 1)
  const finMes = new Date(year, month, 0)

  const solicitudes = await prisma.solicitud.findMany({
    where: {
      fecha: {
        gte: inicioMes,
        lte: finMes,
      },
      estado: {
        in: ["APROBADA", "PENDIENTE"],
      },
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { fecha: "asc" },
  })

  // Agrupar por fecha (usando timezone de Argentina)
  const descansosPorFecha: Record<string, DescansoCalendario["descansos"]> = {}

  for (const sol of solicitudes) {
    const fechaKey = getArgentinaDateKey(sol.fecha)
    if (!descansosPorFecha[fechaKey]) {
      descansosPorFecha[fechaKey] = []
    }
    descansosPorFecha[fechaKey].push({
      id: sol.id,
      userName: sol.user.name,
      estado: sol.estado,
    })
  }

  return NextResponse.json(descansosPorFecha)
}
