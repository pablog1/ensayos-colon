import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// GET /api/integrantes/[id] - Obtener usuario
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

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          solicitudes: true,
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    )
  }

  return NextResponse.json(user)
}

// PUT /api/integrantes/[id] - Actualizar usuario
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
  const { email, name, password, role } = body

  const user = await prisma.user.findUnique({
    where: { id },
  })

  if (!user) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    )
  }

  // Verificar que el email no exista si se cambió
  if (email && email !== user.email) {
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

  // Validar cambio de rol
  if (role && role !== user.role) {
    // No permitir que un admin se quite su propio rol
    if (id === session.user.id && role === "INTEGRANTE") {
      return NextResponse.json(
        { error: "No podés quitarte tu propio rol de administrador" },
        { status: 400 }
      )
    }

    // Verificar que quede al menos un admin
    if (user.role === "ADMIN" && role === "INTEGRANTE") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Debe haber al menos un administrador en el sistema" },
          { status: 400 }
        )
      }
    }
  }

  const updateData: { email?: string; name?: string; password?: string; role?: "ADMIN" | "INTEGRANTE" } = {}
  if (email) updateData.email = email
  if (name) updateData.name = name
  if (password) updateData.password = await bcrypt.hash(password, 10)
  if (role && ["ADMIN", "INTEGRANTE"].includes(role)) updateData.role = role

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/integrantes/[id] - Eliminar usuario
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

  // No permitir eliminarse a sí mismo
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "No podés eliminarte a vos mismo" },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id },
  })

  if (!user) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    )
  }

  // Verificar que quede al menos un admin
  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN" },
    })
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Debe haber al menos un administrador en el sistema" },
        { status: 400 }
      )
    }
  }

  await prisma.user.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
