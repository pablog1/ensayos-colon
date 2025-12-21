import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
        select: { date: true },
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

  // No permitir cancelar eventos pasados
  if (rotativo.event.date < new Date()) {
    return NextResponse.json(
      { error: "No se puede cancelar un rotativo de un evento pasado" },
      { status: 400 }
    )
  }

  // Eliminar el rotativo
  await prisma.rotativo.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
