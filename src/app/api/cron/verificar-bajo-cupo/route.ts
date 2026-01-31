import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { notifyAdmins } from "@/lib/services/notifications"

/**
 * GET /api/cron/verificar-bajo-cupo
 *
 * Verifica usuarios que están por debajo del promedio del grupo
 * y notifica a los admins si hay casos críticos.
 *
 * Se recomienda configurar como cron job periódico (ej: una vez por semana)
 */
export async function GET(req: NextRequest) {
  // Verificar token de autorización (opcional pero recomendado)
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    // Obtener temporada activa
    const season = await prisma.season.findFirst({
      where: { isActive: true },
    })

    if (!season) {
      return NextResponse.json({
        message: "No hay temporada activa",
        usuariosConBajoCupo: 0,
      })
    }

    // Obtener configuración de umbral de subcupo
    const reglaSubcupo = await prisma.ruleConfig.findUnique({
      where: { key: "ALERTA_SUBCUPO" },
    })
    const umbralSubcupo = reglaSubcupo?.enabled ? parseInt(reglaSubcupo.value) || 30 : 30

    // Obtener todos los balances de la temporada
    const balances = await prisma.userSeasonBalance.findMany({
      where: { seasonId: season.id },
      include: {
        user: {
          select: { id: true, name: true, alias: true, email: true },
        },
      },
    })

    if (balances.length === 0) {
      return NextResponse.json({
        message: "No hay balances en la temporada",
        usuariosConBajoCupo: 0,
      })
    }

    // Calcular promedio del grupo
    const totalRotativos = balances.reduce((sum, b) =>
      sum + b.rotativosTomados + b.rotativosObligatorios, 0)
    const promedioGrupo = totalRotativos / balances.length

    // Si el promedio es muy bajo, no tiene sentido alertar
    if (promedioGrupo < 2) {
      return NextResponse.json({
        message: "El promedio del grupo es muy bajo para evaluar",
        promedioGrupo,
        usuariosConBajoCupo: 0,
      })
    }

    // Calcular umbral inferior
    const umbralInferior = promedioGrupo * (1 - umbralSubcupo / 100)

    // Encontrar usuarios por debajo del promedio
    const usuariosConBajoCupo: Array<{
      id: string
      nombre: string
      email: string
      rotativosTotales: number
      diferencia: number
    }> = []

    for (const balance of balances) {
      const totalUsuario = balance.rotativosTomados + balance.rotativosObligatorios
      if (totalUsuario < umbralInferior) {
        const nombre = balance.user.alias || balance.user.name || "Usuario"
        usuariosConBajoCupo.push({
          id: balance.userId,
          nombre,
          email: balance.user.email,
          rotativosTotales: totalUsuario,
          diferencia: Math.round(promedioGrupo - totalUsuario),
        })
      }
    }

    // Si hay usuarios con bajo cupo, notificar a los admins
    if (usuariosConBajoCupo.length > 0) {
      const listaUsuarios = usuariosConBajoCupo
        .map(u => `• ${u.nombre}: ${u.rotativosTotales} rotativos (${u.diferencia} menos que el promedio)`)
        .join("\n")

      await notifyAdmins({
        type: "SISTEMA",
        title: `${usuariosConBajoCupo.length} usuario(s) con bajo cupo de rotativos`,
        message: `Los siguientes usuarios están por debajo del ${umbralSubcupo}% del promedio del grupo (${promedioGrupo.toFixed(1)} rotativos):\n${listaUsuarios}`,
        data: {
          usuariosConBajoCupo,
          promedioGrupo,
          umbralSubcupo,
          temporadaId: season.id,
        },
      })

      console.log(`[Cron] Notificación enviada: ${usuariosConBajoCupo.length} usuarios con bajo cupo`)
    }

    return NextResponse.json({
      message: usuariosConBajoCupo.length > 0
        ? `Se notificó a los admins sobre ${usuariosConBajoCupo.length} usuario(s) con bajo cupo`
        : "Todos los usuarios están dentro del rango normal",
      promedioGrupo: Math.round(promedioGrupo * 10) / 10,
      umbralInferior: Math.round(umbralInferior * 10) / 10,
      usuariosConBajoCupo: usuariosConBajoCupo.length,
      detalles: usuariosConBajoCupo,
    })

  } catch (error) {
    console.error("[Cron] Error verificando bajo cupo:", error)
    return NextResponse.json(
      { error: "Error interno al verificar bajo cupo" },
      { status: 500 }
    )
  }
}
