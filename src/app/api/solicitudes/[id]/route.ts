import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"

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

  const rotativo = await prisma.rotativo.findUnique({
    where: { id },
    include: {
      event: {
        select: { date: true, title: true },
      },
    },
  })

  if (!rotativo) {
    return NextResponse.json(
      { error: "Rotativo no encontrado" },
      { status: 404 }
    )
  }

  // Solo el dueño o admin puede cancelar
  if (rotativo.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "No tienes permiso para cancelar este rotativo" },
      { status: 403 }
    )
  }

  // No permitir cancelar eventos pasados (usar UTC para evitar problemas de timezone)
  const ahora = new Date()
  const hoyUTC = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())
  const eventoDate = new Date(rotativo.event.date)
  const fechaEventoUTC = Date.UTC(eventoDate.getUTCFullYear(), eventoDate.getUTCMonth(), eventoDate.getUTCDate())
  if (fechaEventoUTC < hoyUTC) {
    return NextResponse.json(
      { error: "No se puede cancelar un rotativo de un evento pasado" },
      { status: 400 }
    )
  }

  // Create audit log before deleting
  await createAuditLog({
    action: "ROTATIVO_CANCELADO",
    entityType: "Rotativo",
    entityId: id,
    userId: session.user.id,
    details: {
      evento: rotativo.event.title,
      fecha: rotativo.event.date.toISOString(),
    },
  })

  // Eliminar el rotativo
  await prisma.rotativo.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
