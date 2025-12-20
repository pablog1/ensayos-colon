import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { obtenerEstadisticasGenerales } from "@/lib/rules/descanso-rules"

// GET /api/debug - Debug endpoint para verificar datos
export async function GET() {
  const mesStr = "2025-12"

  // 1. Llamar a la función de estadísticas generales (la misma que usa el API)
  const statsFromFunction = await obtenerEstadisticasGenerales(mesStr)

  // 2. También hacer el cálculo manual para comparar
  const rotativos = await prisma.rotativo.findMany({
    where: { estado: "APROBADO" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      event: { select: { date: true, title: true } },
    },
  })

  // Filtrar y debuggear el proceso
  const rotativosConInfo = rotativos.map(r => {
    const dateObj = r.event.date
    const dateStr = dateObj.toISOString()
    const monthStr = dateStr.substring(0, 7)
    const matches = monthStr === mesStr
    return {
      id: r.id,
      estado: r.estado,
      userId: r.user.id,
      userName: r.user.name,
      eventDateRaw: dateObj,
      eventDateISO: dateStr,
      extractedMonth: monthStr,
      targetMonth: mesStr,
      matches,
    }
  })

  const rotativosFiltrados = rotativosConInfo.filter(r => r.matches)

  const porUsuario: Record<string, number> = {}
  for (const r of rotativosFiltrados) {
    porUsuario[r.userId] = (porUsuario[r.userId] || 0) + 1
  }

  return NextResponse.json({
    comparison: {
      mesStr,
      functionResult: {
        totalRotativos: statsFromFunction.promedioDescansos * statsFromFunction.totalIntegrantes,
        promedioDescansos: statsFromFunction.promedioDescansos,
        integrantes: statsFromFunction.integrantes.map(i => ({
          nombre: i.nombre,
          rotativos: i.descansosAprobados,
        })),
      },
      manualCalculation: {
        totalRotativosAprobados: rotativos.length,
        totalQueMatchean: rotativosFiltrados.length,
        porUsuario,
      },
    },
    detalleRotativos: rotativosConInfo.slice(0, 5), // Solo primeros 5 para no llenar
  })
}
