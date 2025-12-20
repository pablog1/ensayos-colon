import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/solicitudes/[id] - Obtener solicitud
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  const solicitud = await prisma.solicitud.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!solicitud) {
    return NextResponse.json(
      { error: "Solicitud no encontrada" },
      { status: 404 }
    )
  }

  // Verificar acceso
  if (
    session.user.role !== "ADMIN" &&
    solicitud.userId !== session.user.id
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  return NextResponse.json(solicitud)
}

// DELETE /api/solicitudes/[id] - Cancelar solicitud o rotativo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  // Primero intentar buscar como Rotativo
  const rotativo = await prisma.rotativo.findUnique({
    where: { id },
    include: { event: true },
  })

  if (rotativo) {
    // Solo el propietario o admin puede cancelar
    if (
      session.user.role !== "ADMIN" &&
      rotativo.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    // Verificar que la fecha del evento no sea pasada
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (rotativo.event.date < hoy) {
      return NextResponse.json(
        { error: "No se pueden cancelar rotativos de eventos pasados" },
        { status: 400 }
      )
    }

    // Eliminar rotativo
    await prisma.rotativo.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  }

  // Si no es Rotativo, buscar como Solicitud
  const solicitud = await prisma.solicitud.findUnique({
    where: { id },
  })

  if (!solicitud) {
    return NextResponse.json(
      { error: "Solicitud no encontrada" },
      { status: 404 }
    )
  }

  // Solo el propietario o admin puede cancelar
  if (
    session.user.role !== "ADMIN" &&
    solicitud.userId !== session.user.id
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // Verificar que la fecha no sea pasada
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  if (solicitud.fecha < hoy) {
    return NextResponse.json(
      { error: "No se pueden cancelar rotativos pasados" },
      { status: 400 }
    )
  }

  const updated = await prisma.solicitud.update({
    where: { id },
    data: { estado: "CANCELADA" },
  })

  return NextResponse.json(updated)
}
