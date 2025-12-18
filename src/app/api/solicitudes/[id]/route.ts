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

// PUT /api/solicitudes/[id] - Actualizar solicitud
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { motivo } = body

  const solicitud = await prisma.solicitud.findUnique({
    where: { id },
  })

  if (!solicitud) {
    return NextResponse.json(
      { error: "Solicitud no encontrada" },
      { status: 404 }
    )
  }

  // Solo el propietario puede modificar y solo si esta pendiente
  if (solicitud.userId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  if (solicitud.estado !== "PENDIENTE") {
    return NextResponse.json(
      { error: "Solo se pueden modificar solicitudes pendientes" },
      { status: 400 }
    )
  }

  const updated = await prisma.solicitud.update({
    where: { id },
    data: { motivo },
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

  return NextResponse.json(updated)
}

// DELETE /api/solicitudes/[id] - Cancelar solicitud
export async function DELETE(
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
