import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"
import { promoteFromWaitingList, removeFromWaitingList } from "@/lib/services/waiting-list"
import type { AuditAction } from "@/generated/prisma"

// DELETE /api/solicitudes/[id] - Cancelar rotativo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  // Get request body for reason (optional for admins)
  let motivoEliminacion: string | undefined
  try {
    const body = await req.json()
    motivoEliminacion = body.motivo
  } catch {
    // No body provided, that's fine
  }

  const rotativo = await prisma.rotativo.findUnique({
    where: { id },
    include: {
      event: {
        select: { date: true, title: true },
      },
      user: {
        select: { id: true, name: true, alias: true },
      },
    },
  })

  if (!rotativo) {
    return NextResponse.json(
      { error: "Rotativo no encontrado" },
      { status: 404 }
    )
  }

  // Check permissions
  const isOwner = rotativo.userId === session.user.id
  const isAdmin = session.user.role === "ADMIN"

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "No tienes permiso para cancelar este rotativo" },
      { status: 403 }
    )
  }

  // Check if event is in the past (usar UTC para evitar problemas de timezone)
  const ahora = new Date()
  const hoyUTC = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())
  const eventoDate = new Date(rotativo.event.date)
  const fechaEventoUTC = Date.UTC(eventoDate.getUTCFullYear(), eventoDate.getUTCMonth(), eventoDate.getUTCDate())
  const esEventoPasado = fechaEventoUTC < hoyUTC

  // Only restrict past events for non-admins
  if (esEventoPasado && !isAdmin) {
    return NextResponse.json(
      { error: "No se puede cancelar un rotativo de un evento pasado" },
      { status: 400 }
    )
  }

  // Determine if this is a critical action
  const eliminaAjeno = !isOwner && isAdmin
  const isCritical = eliminaAjeno || esEventoPasado

  // Determine audit action
  let auditAction: AuditAction = "ROTATIVO_CANCELADO"
  if (esEventoPasado) {
    auditAction = "ROTATIVO_PASADO_ELIMINADO"
  } else if (eliminaAjeno) {
    auditAction = "ROTATIVO_ELIMINADO_ADMIN"
  }

  // Guardar info antes de eliminar
  const eventId = rotativo.eventId
  const estadoAnterior = rotativo.estado

  // Create audit log before deleting
  await createAuditLog({
    action: auditAction,
    entityType: "Rotativo",
    entityId: id,
    userId: session.user.id,
    targetUserId: eliminaAjeno ? rotativo.userId : undefined,
    isCritical,
    details: {
      evento: rotativo.event.title,
      fecha: rotativo.event.date.toISOString(),
      esEventoPasado,
      eliminaAjeno,
      usuarioAfectado: rotativo.user.alias || rotativo.user.name,
      motivoEliminacion,
      realizadoPor: session.user.name || session.user.email,
    },
  })

  // Si el rotativo estaba en espera, removerlo de la lista de espera
  if (estadoAnterior === "EN_ESPERA") {
    await removeFromWaitingList(rotativo.userId, eventId)
  }

  // Eliminar el rotativo
  await prisma.rotativo.delete({
    where: { id },
  })

  // Si el rotativo liberó un cupo (estaba APROBADO o PENDIENTE), promover desde lista de espera
  if (estadoAnterior === "APROBADO" || estadoAnterior === "PENDIENTE") {
    await promoteFromWaitingList(eventId)
  }

  return NextResponse.json({ success: true })
}
