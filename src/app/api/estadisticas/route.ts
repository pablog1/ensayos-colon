import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  obtenerEstadisticasGenerales,
  calcularEstadisticasUsuario,
} from "@/lib/rules/descanso-rules"

// GET /api/estadisticas - Obtener estadisticas del mes
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mesParam = searchParams.get("mes")

  // Usar mes actual si no se especifica (formato YYYY-MM)
  const mesStr = mesParam
    ? mesParam
    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  // Todos los usuarios ven las estadísticas generales
  const stats = await obtenerEstadisticasGenerales(mesStr)

  // Para integrantes, agregar también sus datos personales y su userId
  if (session.user.role !== "ADMIN") {
    const [year, month] = mesStr.split('-').map(Number)
    const mes = new Date(Date.UTC(year, month - 1, 1))

    const statsPersonales = await calcularEstadisticasUsuario(
      session.user.id,
      mes
    )

    return NextResponse.json({
      ...stats,
      currentUserId: session.user.id,
      personal: {
        descansosAprobados: statsPersonales.descansosAprobados,
        porcentajeVsPromedio:
          Math.round(statsPersonales.porcentajeVsPromedio * 100) / 100,
        puedesolicitarMas: statsPersonales.puedesolicitarSinAprobacion,
        descansosRestantesPermitidos:
          Math.round(statsPersonales.descansosRestantesPermitidos * 100) / 100,
      },
      grupo: {
        promedioDescansos:
          Math.round(statsPersonales.promedioGrupo * 100) / 100,
        limiteMaximo: Math.round(statsPersonales.limiteMaximo * 100) / 100,
      },
    })
  }

  return NextResponse.json(stats)
}
