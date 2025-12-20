import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Lista de avatares disponibles (emojis de instrumentos musicales)
export const AVATARS = [
  "🎻", // Violín
  "🎺", // Trompeta
  "🎷", // Saxofón
  "🎸", // Guitarra
  "🎹", // Piano
  "🥁", // Batería
  "🎵", // Nota musical
  "🎶", // Notas musicales
  "🎼", // Partitura
  "🪕", // Banjo
  "🪗", // Acordeón
  "🪘", // Tambor
]

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      alias: true,
      avatar: true,
    },
  })

  return NextResponse.json({ user, avatars: AVATARS })
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await request.json()
  const { alias, avatar, name } = body

  // Validar nombre (mínimo 2 caracteres si se proporciona)
  if (name !== undefined && name.trim().length < 2) {
    return NextResponse.json(
      { error: "El nombre debe tener al menos 2 caracteres" },
      { status: 400 }
    )
  }

  // Validar alias (máximo 15 caracteres)
  if (alias && alias.length > 15) {
    return NextResponse.json(
      { error: "El alias no puede tener más de 15 caracteres" },
      { status: 400 }
    )
  }

  // Validar avatar (debe estar en la lista o ser null)
  if (avatar && !AVATARS.includes(avatar)) {
    return NextResponse.json(
      { error: "Avatar no válido" },
      { status: 400 }
    )
  }

  const updateData: { alias?: string | null; avatar?: string | null; name?: string } = {}

  if (alias !== undefined) updateData.alias = alias || null
  if (avatar !== undefined) updateData.avatar = avatar || null
  if (name !== undefined && name.trim().length >= 2) updateData.name = name.trim()

  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      alias: true,
      avatar: true,
    },
  })

  return NextResponse.json({ user: updatedUser })
}
