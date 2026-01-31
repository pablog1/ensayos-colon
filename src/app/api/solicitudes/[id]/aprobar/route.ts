import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createNotification, notifyAlertaCercania, verificarYNotificarBajoCupo } from "@/lib/services/notifications"
import { createAuditLog } from "@/lib/services/audit"

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
  const fechaStr = updated.event.date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
  const horaStr = updated.event.startTime
    ? ` a las ${updated.event.startTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}`
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
      horario: updated.event.startTime?.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }),
      tipoEvento: updated.event.eventoType,
      motivo: motivo,
    },
  })

  // Verificar si el usuario está cerca del máximo y enviar alerta
  try {
    const temporadaActiva = await prisma.season.findFirst({
      where: { isActive: true },
    })

    if (temporadaActiva) {
      const balance = await prisma.userSeasonBalance.findUnique({
        where: {
          userId_seasonId: {
            userId: updated.userId,
            seasonId: temporadaActiva.id,
          },
        },
      })

      if (balance) {
        const maxEfectivo = balance.maxAjustadoManual ?? balance.maxProyectado
        const totalActual =
          balance.rotativosTomados +
          balance.rotativosObligatorios +
          balance.rotativosPorLicencia

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
    }
  } catch (error) {
    // No fallar la aprobación si hay error en la alerta
    console.error("[Aprobar] Error al verificar alerta de cercanía:", error)
  }

  // Verificar si hay usuarios con bajo cupo y notificar a admins
  // (esto se ejecuta en background, no bloquea la respuesta)
  verificarYNotificarBajoCupo().catch((err) =>
    console.error("[Aprobar] Error al verificar bajo cupo:", err)
  )

  return NextResponse.json(updated)
}
