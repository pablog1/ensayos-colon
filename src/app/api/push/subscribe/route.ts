import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma"

// POST /api/push/subscribe - Guardar suscripción push del usuario
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { subscription } = await req.json()

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Suscripción inválida" },
        { status: 400 }
      )
    }

    // Buscar si esta suscripción ya existe en otro usuario (mismo dispositivo)
    // y removerla para evitar notificaciones duplicadas
    const usersWithSameSubscription = await prisma.user.findMany({
      where: {
        id: { not: session.user.id },
        pushEnabled: true,
      },
      select: { id: true, pushSubscription: true },
    })

    // Comparar por endpoint (identificador único de la suscripción)
    for (const user of usersWithSameSubscription) {
      const userSub = user.pushSubscription as { endpoint?: string } | null
      if (userSub?.endpoint === subscription.endpoint) {
        // Remover suscripción del otro usuario
        await prisma.user.update({
          where: { id: user.id },
          data: {
            pushSubscription: Prisma.DbNull,
            pushEnabled: false,
          },
        })
        console.log(`[Push] Suscripción transferida de usuario ${user.id} a ${session.user.id}`)
      }
    }

    // Guardar suscripción en el usuario actual
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        pushSubscription: subscription,
        pushEnabled: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Notificaciones push activadas",
    })
  } catch (error) {
    console.error("[Push Subscribe] Error:", error)
    return NextResponse.json(
      { error: "Error al guardar suscripción" },
      { status: 500 }
    )
  }
}

// DELETE /api/push/subscribe - Desactivar notificaciones push
export async function DELETE() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        pushSubscription: Prisma.DbNull,
        pushEnabled: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Notificaciones push desactivadas",
    })
  } catch (error) {
    console.error("[Push Unsubscribe] Error:", error)
    return NextResponse.json(
      { error: "Error al desactivar suscripción" },
      { status: 500 }
    )
  }
}

// GET /api/push/subscribe - Verificar estado de suscripción
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { pushEnabled: true },
    })

    return NextResponse.json({
      enabled: user?.pushEnabled || false,
    })
  } catch (error) {
    console.error("[Push Status] Error:", error)
    return NextResponse.json(
      { error: "Error al verificar estado" },
      { status: 500 }
    )
  }
}
