import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyAdmins } from "@/lib/services/notifications"
import { getCupoParaEvento } from "@/lib/services/cupo-rules"

/**
 * GET /api/admin/test-eventos-sin-cubrir
 *
 * Endpoint de prueba para verificar la funcionalidad de alertas de eventos sin cubrir.
 *
 * Parámetros opcionales:
 * - date: Fecha específica a verificar (formato YYYY-MM-DD). Si no se especifica, usa mañana.
 * - notify: Si es "true", envía notificación real. Si no, solo muestra qué se enviaría.
 *
 * Ejemplos:
 * /api/admin/test-eventos-sin-cubrir                     -> Verifica mañana, sin notificar
 * /api/admin/test-eventos-sin-cubrir?notify=true         -> Verifica mañana, notifica
 * /api/admin/test-eventos-sin-cubrir?date=2026-02-15     -> Verifica fecha específica
 * /api/admin/test-eventos-sin-cubrir?date=2026-02-15&notify=true
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get("date")
  const shouldNotify = searchParams.get("notify") === "true"

  try {
    // Determinar fecha a verificar
    let fechaVerificar: Date
    if (dateParam) {
      fechaVerificar = new Date(dateParam + "T00:00:00")
    } else {
      // Por defecto: mañana
      fechaVerificar = new Date()
      fechaVerificar.setDate(fechaVerificar.getDate() + 1)
    }
    fechaVerificar.setHours(0, 0, 0, 0)

    const fechaFin = new Date(fechaVerificar)
    fechaFin.setDate(fechaFin.getDate() + 1)

    console.log(`[test-eventos-sin-cubrir] Verificando fecha: ${fechaVerificar.toISOString()}`)

    // Buscar eventos de la fecha especificada
    const eventos = await prisma.event.findMany({
      where: {
        date: {
          gte: fechaVerificar,
          lt: fechaFin,
        },
      },
      include: {
        titulo: true,
        rotativos: {
          where: {
            estado: { in: ["APROBADO", "PENDIENTE"] },
          },
          include: {
            user: {
              select: { name: true, alias: true },
            },
          },
        },
      },
      orderBy: { startTime: "asc" },
    })

    if (eventos.length === 0) {
      return NextResponse.json({
        mensaje: "No hay eventos en la fecha especificada",
        fecha: fechaVerificar.toLocaleDateString("es-AR"),
        fechaISO: fechaVerificar.toISOString(),
        eventosEncontrados: 0,
        eventosSinCubrir: 0,
      })
    }

    // Analizar cada evento
    const analisisEventos: Array<{
      id: string
      titulo: string
      hora: string
      tipo: string | null
      cupoNecesario: number
      cupoActual: number
      faltantes: number
      cubierto: boolean
      rotativos: string[]
    }> = []

    const eventosSinCubrir: Array<{
      id: string
      titulo: string
      fecha: string
      hora: string
      cupoNecesario: number
      cupoActual: number
      faltantes: number
    }> = []

    for (const evento of eventos) {
      const cupoDeReglas = await getCupoParaEvento(
        evento.eventoType,
        evento.titulo?.type ?? null
      )
      const cupoEfectivo = evento.cupoOverride ?? cupoDeReglas
      const rotativosActuales = evento.rotativos.length
      const faltantes = cupoEfectivo - rotativosActuales
      const cubierto = rotativosActuales >= cupoEfectivo

      const horaStr = evento.startTime
        ? evento.startTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "Sin horario"

      analisisEventos.push({
        id: evento.id,
        titulo: evento.titulo?.name || evento.title || "Sin título",
        hora: horaStr,
        tipo: evento.eventoType,
        cupoNecesario: cupoEfectivo,
        cupoActual: rotativosActuales,
        faltantes: Math.max(0, faltantes),
        cubierto,
        rotativos: evento.rotativos.map(r => r.user.alias || r.user.name || "?"),
      })

      if (!cubierto) {
        eventosSinCubrir.push({
          id: evento.id,
          titulo: evento.titulo?.name || evento.title || "Sin título",
          fecha: fechaVerificar.toLocaleDateString("es-AR"),
          hora: horaStr,
          cupoNecesario: cupoEfectivo,
          cupoActual: rotativosActuales,
          faltantes,
        })
      }
    }

    // Si hay eventos sin cubrir y se pidió notificar
    let notificacionEnviada = false
    if (eventosSinCubrir.length > 0 && shouldNotify) {
      const listaEventos = eventosSinCubrir
        .map(e => `• ${e.titulo} (${e.hora}) - Faltan ${e.faltantes} rotativo(s)`)
        .join("\n")

      await notifyAdmins({
        type: "SISTEMA",
        title: `${eventosSinCubrir.length} evento(s) sin cubrir para ${fechaVerificar.toLocaleDateString("es-AR")}`,
        message: `Los siguientes eventos no tienen el cupo completo:\n${listaEventos}`,
        data: {
          eventosSinCubrir,
          fecha: fechaVerificar.toISOString(),
          esPrueba: true,
        },
      })

      notificacionEnviada = true
      console.log(`[test-eventos-sin-cubrir] Notificación enviada: ${eventosSinCubrir.length} eventos sin cubrir`)
    }

    return NextResponse.json({
      fecha: fechaVerificar.toLocaleDateString("es-AR"),
      fechaISO: fechaVerificar.toISOString(),
      eventosEncontrados: eventos.length,
      eventosSinCubrir: eventosSinCubrir.length,
      eventosCubiertos: eventos.length - eventosSinCubrir.length,
      notificacionEnviada,
      notificarHabilitado: shouldNotify,
      analisis: analisisEventos,
      resumen: eventosSinCubrir.length > 0
        ? `Hay ${eventosSinCubrir.length} evento(s) sin cubrir${shouldNotify ? " - Notificación enviada" : " - Usar ?notify=true para enviar notificación"}`
        : "Todos los eventos tienen cupo cubierto",
    })

  } catch (error) {
    console.error("[test-eventos-sin-cubrir] Error:", error)
    return NextResponse.json(
      { error: "Error interno al verificar eventos" },
      { status: 500 }
    )
  }
}
