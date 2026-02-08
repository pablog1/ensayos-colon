import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"
import { createNotification } from "@/lib/services/notifications"

// POST /api/solicitudes/crear-en-nombre
// Admin crea rotativo en nombre de otro usuario
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden crear rotativos en nombre de otros" },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { eventId, userId, motivo, advertenciasIgnoradas } = body

  if (!eventId || !userId) {
    return NextResponse.json(
      { error: "eventId y userId son requeridos" },
      { status: 400 }
    )
  }

  // Verificar que el evento existe
  const evento = await prisma.event.findUnique({
    where: { id: eventId },
    include: { titulo: true },
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

  // Verificar si existe un rotativo del usuario en este evento (cualquier estado)
  const existente = await prisma.rotativo.findFirst({
    where: {
      userId: userId,
      eventId: eventId,
    },
  })

  // Si existe uno activo (no rechazado/cancelado), no permitir
  if (existente && !["RECHAZADO", "CANCELADO"].includes(existente.estado)) {
    return NextResponse.json(
      { error: "El usuario ya tiene un rotativo en este evento" },
      { status: 400 }
    )
  }

  // Determinar si es evento pasado
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechaEvento = new Date(evento.date)
  fechaEvento.setHours(0, 0, 0, 0)
  const esEventoPasado = fechaEvento < hoy

  // Si existe uno rechazado/cancelado, reutilizarlo; si no, crear nuevo
  let rotativo
  if (existente) {
    rotativo = await prisma.rotativo.update({
      where: { id: existente.id },
      data: {
        estado: "APROBADO",
        tipo: "VOLUNTARIO",
        motivo: motivo || `Creado por administrador`,
        aprobadoPor: session.user.id,
        asignadoPor: session.user.id,
        rechazadoPor: null,
      },
      include: {
        user: {
          select: { id: true, name: true, alias: true },
        },
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            titulo: { select: { name: true } },
          },
        },
      },
    })
  } else {
    rotativo = await prisma.rotativo.create({
      data: {
        userId: userId,
        eventId: eventId,
        estado: "APROBADO",
        tipo: "VOLUNTARIO",
        motivo: motivo || `Creado por administrador`,
        aprobadoPor: session.user.id,
        asignadoPor: session.user.id,
      },
      include: {
        user: {
          select: { id: true, name: true, alias: true },
        },
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            titulo: { select: { name: true } },
          },
        },
      },
    })
  }

  // Notificar al usuario afectado
  await createNotification({
    userId: usuario.id,
    type: "ROTATIVO_APROBADO",
    title: "Rotativo asignado",
    message: `Se te asignó un rotativo para "${evento.title}"${esEventoPasado ? " (corrección de datos)" : ""}`,
    data: {
      eventId: evento.id,
      eventTitle: evento.title,
      rotativoId: rotativo.id,
      creadoPor: session.user.name || session.user.email,
    },
  })

  // Registrar en audit log con isCritical = true
  await createAuditLog({
    action: esEventoPasado ? "ROTATIVO_PASADO_CREADO" : "ROTATIVO_CREADO_EN_NOMBRE",
    entityType: "Rotativo",
    entityId: rotativo.id,
    userId: session.user.id,
    targetUserId: usuario.id,
    isCritical: true,
    details: {
      evento: evento.title,
      titulo: evento.titulo?.name,
      fecha: evento.date.toISOString(),
      esEventoPasado,
      advertenciasIgnoradas: advertenciasIgnoradas || [],
      creadoEnNombreDe: usuario.alias || usuario.name,
      motivo,
      realizadoPor: session.user.name || session.user.email,
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
    message: `Rotativo creado para ${usuario.alias || usuario.name}`,
  })
}
