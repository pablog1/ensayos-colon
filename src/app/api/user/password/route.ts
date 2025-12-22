import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await request.json()
  const { currentPassword, newPassword } = body

  // Validar que se enviaron los campos requeridos
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "La contraseña actual y la nueva son requeridas" },
      { status: 400 }
    )
  }

  // Validar longitud mínima de nueva contraseña
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "La nueva contraseña debe tener al menos 6 caracteres" },
      { status: 400 }
    )
  }

  // Obtener usuario con su contraseña actual
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  })

  if (!user) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    )
  }

  // Verificar contraseña actual
  const isValidPassword = await bcrypt.compare(currentPassword, user.password)
  if (!isValidPassword) {
    return NextResponse.json(
      { error: "La contraseña actual es incorrecta" },
      { status: 400 }
    )
  }

  // Verificar que la nueva contraseña sea diferente
  const isSamePassword = await bcrypt.compare(newPassword, user.password)
  if (isSamePassword) {
    return NextResponse.json(
      { error: "La nueva contraseña debe ser diferente a la actual" },
      { status: 400 }
    )
  }

  // Hashear y actualizar contraseña
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashedPassword },
  })

  return NextResponse.json({ success: true })
}
