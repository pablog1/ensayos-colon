import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { notifyAdmins } from "@/lib/services/notifications"
import { getCupoParaEvento } from "@/lib/services/cupo-rules"
import { formatTimeAR, formatDateAR } from "@/lib/utils"

/**
 * GET /api/cron/eventos-sin-cubrir
 *
 * Endpoint para verificar eventos que ocurren mañana y no tienen el cupo cubierto.
 * Notifica a los admins si hay eventos sin cubrir.
 *
 * Se recomienda configurar como cron job diario (ej: Vercel Cron a las 9:00 AM)
 *
 * Para proteger el endpoint, se puede agregar un token secreto en headers:
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  // Verificar token de autorización (opcional pero recomendado)
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    // Calcular fecha de mañana
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const manana = new Date(hoy)
    manana.setDate(manana.getDate() + 1)

    const pasadoManana = new Date(manana)
    pasadoManana.setDate(pasadoManana.getDate() + 1)

    // Buscar eventos de mañana
    const eventosDeMañana = await prisma.event.findMany({
      where: {
        date: {
          gte: manana,
          lt: pasadoManana,
        },
      },
      include: {
        titulo: true,
        rotativos: {
          where: {
            estado: { in: ["APROBADO", "PENDIENTE"] },
          },
        },
      },
    })

    if (eventosDeMañana.length === 0) {
      return NextResponse.json({
        message: "No hay eventos mañana",
        eventosSinCubrir: 0,
      })
    }

    // Verificar cuáles no tienen el cupo cubierto
    const eventosSinCubrir: Array<{
      id: string
      titulo: string
      fecha: string
      hora: string
      cupoNecesario: number
      cupoActual: number
      faltantes: number
    }> = []

    for (const evento of eventosDeMañana) {
      const cupoDeReglas = await getCupoParaEvento(
        evento.eventoType,
        evento.titulo?.type ?? null
      )
      const cupoEfectivo = evento.cupoOverride ?? evento.titulo?.cupo ?? cupoDeReglas
      const rotativosActuales = evento.rotativos.length

      if (rotativosActuales < cupoEfectivo) {
        const horaStr = formatTimeAR(evento.startTime) || "Sin horario"

        eventosSinCubrir.push({
          id: evento.id,
          titulo: evento.titulo?.name || evento.title || "Sin título",
          fecha: formatDateAR(manana),
          hora: horaStr,
          cupoNecesario: cupoEfectivo,
          cupoActual: rotativosActuales,
          faltantes: cupoEfectivo - rotativosActuales,
        })
      }
    }

    // Si hay eventos sin cubrir, notificar a los admins
    if (eventosSinCubrir.length > 0) {
      const listaEventos = eventosSinCubrir
        .map(e => `• ${e.titulo} (${e.hora}) - Faltan ${e.faltantes} rotativo(s)`)
        .join("\n")

      await notifyAdmins({
        type: "SISTEMA",
        title: `${eventosSinCubrir.length} evento(s) sin cubrir para mañana`,
        message: `Los siguientes eventos de mañana no tienen el cupo completo:\n${listaEventos}`,
        data: {
          eventosSinCubrir,
          fecha: manana.toISOString(),
        },
      })

      console.log(`[Cron] Notificación enviada: ${eventosSinCubrir.length} eventos sin cubrir`)
    }

    return NextResponse.json({
      message: eventosSinCubrir.length > 0
        ? `Se notificó a los admins sobre ${eventosSinCubrir.length} evento(s) sin cubrir`
        : "Todos los eventos de mañana tienen cupo cubierto",
      eventosSinCubrir: eventosSinCubrir.length,
      detalles: eventosSinCubrir,
    })

  } catch (error) {
    console.error("[Cron] Error verificando eventos sin cubrir:", error)
    return NextResponse.json(
      { error: "Error interno al verificar eventos" },
      { status: 500 }
    )
  }
}
