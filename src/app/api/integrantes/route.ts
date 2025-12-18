import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// GET /api/integrantes - Lista todos los usuarios (solo admin)
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const integrantes = await prisma.user.findMany({
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
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(integrantes)
}

// POST /api/integrantes - Crear usuario (solo admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await req.json()
  const { email, name, password, role } = body

  if (!email || !name || !password) {
    return NextResponse.json(
      { error: "Email, nombre y contraseña son requeridos" },
      { status: 400 }
    )
  }

  // Validar rol
  const validRoles = ["ADMIN", "INTEGRANTE"]
  const userRole = role && validRoles.includes(role) ? role : "INTEGRANTE"

  // Verificar que el email no exista
  const existente = await prisma.user.findUnique({
    where: { email },
  })

  if (existente) {
    return NextResponse.json(
      { error: "Ya existe un usuario con este email" },
      { status: 400 }
    )
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  const integrante = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role: userRole,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  })

  return NextResponse.json(integrante)
}
