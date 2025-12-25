import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"
import {
  notifyRotacionObligatoria,
  notifyAdminsRotacionObligatoriaAsignada,
} from "@/lib/services/notifications"

// POST /api/solicitudes/asignar-obligatorio
// Asignar rotativo obligatorio a un usuario (solo admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden asignar rotativos obligatorios" },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { eventId, userId, motivo } = body

  if (!eventId || !userId) {
    return NextResponse.json(
      { error: "eventId y userId son requeridos" },
      { status: 400 }
    )
  }

  // Verificar que el evento existe
  const evento = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      titulo: true,
      rotativos: {
        where: {
          estado: { notIn: ["RECHAZADO", "CANCELADO"] },
        },
      },
    },
  })

  if (!evento) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  // Verificar que el usuario existe
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, alias: true, email: true },
  })

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  // Verificar que no existe ya un rotativo del usuario en este evento
  const existente = await prisma.rotativo.findFirst({
    where: {
      userId: userId,
      eventId: eventId,
      estado: { notIn: ["RECHAZADO", "CANCELADO"] },
    },
  })

  if (existente) {
    return NextResponse.json(
      { error: "El usuario ya tiene un rotativo en este evento" },
      { status: 400 }
    )
  }

  // Calcular días hasta el evento
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechaEvento = new Date(evento.date)
  fechaEvento.setHours(0, 0, 0, 0)
  const diffMs = fechaEvento.getTime() - hoy.getTime()
  const diasHastaEvento = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // No permitir asignar a eventos pasados
  if (diasHastaEvento < 0) {
    return NextResponse.json(
      { error: "No se pueden asignar rotativos a eventos pasados" },
      { status: 400 }
    )
  }

  // Crear el rotativo obligatorio
  const rotativo = await prisma.rotativo.create({
    data: {
      userId: userId,
      eventId: eventId,
      estado: "APROBADO",
      tipo: "OBLIGATORIO",
      motivo: motivo || "Rotación obligatoria asignada por administrador",
      aprobadoPor: session.user.id,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          alias: true,
          email: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          titulo: {
            select: { name: true },
          },
        },
      },
    },
  })

  // Notificar al usuario afectado
  await notifyRotacionObligatoria({
    userId: usuario.id,
    eventTitle: evento.title,
    eventDate: evento.date,
    eventId: evento.id,
    rotativoId: rotativo.id,
    diasHastaEvento,
    motivo,
  })

  // Notificar a los demás admins
  await notifyAdminsRotacionObligatoriaAsignada({
    userId: usuario.id,
    userName: usuario.alias || usuario.name || usuario.email,
    eventTitle: evento.title,
    eventDate: evento.date,
    eventId: evento.id,
    rotativoId: rotativo.id,
    asignadoPorId: session.user.id,
    asignadoPorNombre: session.user.name || session.user.email || "Admin",
  })

  // Registrar en audit log
  await createAuditLog({
    action: "ROTATIVO_OBLIGATORIO_ASIGNADO",
    entityType: "Rotativo",
    entityId: rotativo.id,
    userId: session.user.id,
    targetUserId: usuario.id,
    details: {
      evento: evento.title,
      titulo: evento.titulo?.name,
      fecha: evento.date.toISOString(),
      diasHastaEvento,
      motivo: motivo || "Rotación obligatoria",
      asignadoPor: session.user.name || session.user.email,
    },
  })

  return NextResponse.json({
    success: true,
    rotativo: {
      id: rotativo.id,
      estado: rotativo.estado,
      tipo: rotativo.tipo,
      eventId: rotativo.eventId,
      userId: rotativo.userId,
      user: rotativo.user,
      event: rotativo.event,
    },
    message: `Rotativo obligatorio asignado a ${usuario.alias || usuario.name}`,
  })
}
