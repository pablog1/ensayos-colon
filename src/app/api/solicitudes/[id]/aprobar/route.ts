import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createNotification, notifyAlertaCercania } from "@/lib/services/notifications"
import { createAuditLog } from "@/lib/services/audit"
import { formatDateLongAR, formatTimeAR } from "@/lib/utils"

// POST /api/solicitudes/[id]/aprobar - Aprobar rotativo pendiente (solo admin)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden aprobar solicitudes" },
      { status: 403 }
    )
  }

  const { id } = await params

  // Leer motivo del body (opcional)
  let motivo: string | undefined
  try {
    const body = await req.json()
    motivo = body.motivo
  } catch {
    // Si no hay body, continuar sin motivo
  }

  const rotativo = await prisma.rotativo.findUnique({
    where: { id },
    include: {
      event: {
        select: {
          title: true,
          date: true,
          startTime: true,
          eventoType: true,
        },
      },
    },
  })

  if (!rotativo) {
    return NextResponse.json(
      { error: "Rotativo no encontrado" },
      { status: 404 }
    )
  }

  if (rotativo.estado !== "PENDIENTE") {
    return NextResponse.json(
      { error: "Solo se pueden aprobar rotativos pendientes" },
      { status: 400 }
    )
  }

  const updated = await prisma.rotativo.update({
    where: { id },
    data: {
      estado: "APROBADO",
      aprobadoPor: session.user.id,
      motivo: motivo || rotativo.motivo,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      event: true,
    },
  })

  // Create notification for user
  const fechaStr = formatDateLongAR(updated.event.date)
  const horaStr = updated.event.startTime
    ? ` a las ${formatTimeAR(updated.event.startTime)}`
    : ""
  const tipoStr = updated.event.eventoType ? ` (${updated.event.eventoType})` : ""

  await createNotification({
    userId: updated.userId,
    type: "ROTATIVO_APROBADO",
    title: "Rotativo aprobado",
    message: `Tu solicitud de rotativo para "${updated.event.title}" el ${fechaStr}${horaStr}${tipoStr} ha sido aprobada`,
    data: {
      rotativoId: updated.id,
      eventId: updated.eventId,
      eventTitle: updated.event.title,
      eventDate: updated.event.date.toISOString(),
      eventStartTime: updated.event.startTime?.toISOString(),
      eventType: updated.event.eventoType,
      motivo: motivo,
    },
  })

  // Create audit log
  await createAuditLog({
    action: "ROTATIVO_APROBADO",
    entityType: "Rotativo",
    entityId: updated.id,
    userId: session.user.id,
    targetUserId: updated.userId,
    details: {
      evento: updated.event.title,
      fecha: updated.event.date.toISOString(),
      horario: formatTimeAR(updated.event.startTime),
      tipoEvento: updated.event.eventoType,
      motivo: motivo,
      motivoInicial: rotativo.motivoInicial,
    },
  })

  // Verificar si el usuario está cerca del máximo y enviar alerta
  // Usar la temporada del evento, no la temporada "activa"
  const seasonId = updated.event.seasonId
  try {
    console.log("[DEBUG Aprobar] Usando seasonId del evento:", seasonId)

    const balance = await prisma.userSeasonBalance.findUnique({
      where: {
        userId_seasonId: {
          userId: updated.userId,
          seasonId: seasonId,
        },
      },
    })

    if (balance) {
      // Calcular máximo proyectado siempre en tiempo real
      const titulos = await prisma.titulo.findMany({
        where: { seasonId: seasonId },
        include: { events: { select: { cupoOverride: true } } },
      })
      let totalCupos = 0
      for (const t of titulos) {
        for (const e of t.events) {
          totalCupos += e.cupoOverride ?? t.cupo
        }
      }
      const totalIntegrantes = await prisma.user.count()
      const maxEfectivo = totalIntegrantes > 0 ? Math.max(1, Math.floor(totalCupos / totalIntegrantes)) : 1

      console.log("[DEBUG Alerta] totalCupos:", totalCupos, "totalIntegrantes:", totalIntegrantes, "maxEfectivo:", maxEfectivo, "titulos:", titulos.length)

      // Contar rotativos aprobados en tiempo real (igual que el dashboard)
      const rotativosAprobados = await prisma.rotativo.count({
        where: {
          userId: updated.userId,
          estado: "APROBADO",
          event: { seasonId: seasonId },
        },
      })
      const totalActual = rotativosAprobados + balance.rotativosPorLicencia
      console.log("[DEBUG Alerta] rotativosAprobados:", rotativosAprobados, "rotativosPorLicencia:", balance.rotativosPorLicencia, "totalActual:", totalActual)

      // Obtener umbral de alerta (default 90%)
      const reglaUmbral = await prisma.ruleConfig.findUnique({
        where: { key: "ALERTA_UMBRAL" },
      })
      const umbral = reglaUmbral?.enabled ? parseInt(reglaUmbral.value) || 90 : 90

      const porcentaje = (totalActual / maxEfectivo) * 100

      // Determinar nivel de alerta
      let nivelAlerta: "CERCANIA" | "LIMITE" | "EXCESO" | null = null
      if (totalActual > maxEfectivo) {
        nivelAlerta = "EXCESO"
      } else if (porcentaje >= umbral) {
        nivelAlerta = "LIMITE"
      } else if (porcentaje >= umbral - 10) {
        // Alertar cuando esté a 10% del umbral
        nivelAlerta = "CERCANIA"
      }

      // Enviar notificación si hay alerta
      if (nivelAlerta) {
        await notifyAlertaCercania({
          userId: updated.userId,
          totalActual,
          maxProyectado: maxEfectivo,
          porcentaje,
          nivelAlerta,
        })
      }
    }
  } catch (error) {
    // No fallar la aprobación si hay error en la alerta
    console.error("[Aprobar] Error al verificar alerta de cercanía:", error)
  }

  return NextResponse.json(updated)
}
