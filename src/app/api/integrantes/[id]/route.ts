import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// GET /api/integrantes/[id] - Obtener integrante
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params

  const integrante = await prisma.user.findUnique({
    where: { id, role: "INTEGRANTE" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          solicitudes: true,
        },
      },
    },
  })

  if (!integrante) {
    return NextResponse.json(
      { error: "Integrante no encontrado" },
      { status: 404 }
    )
  }

  return NextResponse.json(integrante)
}

// PUT /api/integrantes/[id] - Actualizar integrante
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { email, name, password } = body

  const integrante = await prisma.user.findUnique({
    where: { id, role: "INTEGRANTE" },
  })

  if (!integrante) {
    return NextResponse.json(
      { error: "Integrante no encontrado" },
      { status: 404 }
    )
  }

  // Verificar que el email no exista si se cambió
  if (email && email !== integrante.email) {
    const existente = await prisma.user.findUnique({
      where: { email },
    })
    if (existente) {
      return NextResponse.json(
        { error: "Ya existe un usuario con este email" },
        { status: 400 }
      )
    }
  }

  const updateData: { email?: string; name?: string; password?: string } = {}
  if (email) updateData.email = email
  if (name) updateData.name = name
  if (password) updateData.password = await bcrypt.hash(password, 10)

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/integrantes/[id] - Eliminar integrante
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params

  const integrante = await prisma.user.findUnique({
    where: { id, role: "INTEGRANTE" },
  })

  if (!integrante) {
    return NextResponse.json(
      { error: "Integrante no encontrado" },
      { status: 404 }
    )
  }

  await prisma.user.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
