import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { notifyAdmins } from "@/lib/services/notifications"

/**
 * GET /api/cron/verificar-bajo-cupo
 *
 * Verifica usuarios que están por debajo del promedio del grupo
 * y notifica a los admins si hay casos críticos.
 *
 * Se puede ejecutar:
 * - Como cron job periódico (configurado en vercel.json)
 * - Manualmente desde la consola del navegador: fetch('/api/cron/verificar-bajo-cupo')
 */
export async function GET(req: NextRequest) {
  // Verificar token de autorización (opcional - permitir sin token para pruebas manuales)
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // En producción, el cron de Vercel envía el header automáticamente
  // Pero permitimos llamadas manuales sin token para testing
  const isVercelCron = authHeader === `Bearer ${cronSecret}`
  const isManualCall = !cronSecret || !authHeader

  if (cronSecret && authHeader && !isVercelCron) {
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

    // Obtener todos los usuarios
    const usuarios = await prisma.user.findMany({
      select: { id: true, name: true, alias: true, email: true },
    })

    if (usuarios.length === 0) {
      return NextResponse.json({
        message: "No hay usuarios",
        usuariosConBajoCupo: 0,
      })
    }

    // Contar rotativos REALES de cada usuario (no usar balance que puede estar desactualizado)
    const rotativosPorUsuario = await prisma.rotativo.groupBy({
      by: ['userId'],
      where: {
        estado: { in: ["APROBADO", "PENDIENTE"] },
        event: { seasonId: season.id },
      },
      _count: { id: true },
    })

    const rotativosMap: Record<string, number> = {}
    for (const r of rotativosPorUsuario) {
      rotativosMap[r.userId] = r._count.id
    }

    // Calcular promedio del grupo (usando datos reales)
    let totalRotativos = 0
    for (const usuario of usuarios) {
      totalRotativos += rotativosMap[usuario.id] || 0
    }
    const promedioGrupo = totalRotativos / usuarios.length

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

    for (const usuario of usuarios) {
      const totalUsuario = rotativosMap[usuario.id] || 0
      if (totalUsuario < umbralInferior) {
        const nombre = usuario.alias || usuario.name || "Usuario"
        usuariosConBajoCupo.push({
          id: usuario.id,
          nombre,
          email: usuario.email,
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
          ejecutadoManualmente: isManualCall,
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
      umbralSubcupo,
      totalUsuarios: usuarios.length,
      usuariosConBajoCupo: usuariosConBajoCupo.length,
      detalles: usuariosConBajoCupo,
      ejecutadoManualmente: isManualCall,
    })

  } catch (error) {
    console.error("[Cron] Error verificando bajo cupo:", error)
    return NextResponse.json(
      { error: "Error interno al verificar bajo cupo" },
      { status: 500 }
    )
  }
}
