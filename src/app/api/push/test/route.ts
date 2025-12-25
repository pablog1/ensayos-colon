import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sendPushToUser } from "@/lib/services/push-notifications"

// POST /api/push/test - Enviar notificación de prueba al usuario actual
export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const success = await sendPushToUser(session.user.id, {
      title: "Notificación de prueba",
      body: "Las notificaciones push están funcionando correctamente",
      url: "/",
      tag: "test",
    })

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Notificación enviada",
      })
    } else {
      return NextResponse.json(
        { error: "No se pudo enviar. ¿Tenés las notificaciones activadas?" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("[Push Test] Error:", error)
    return NextResponse.json(
      { error: "Error al enviar notificación de prueba" },
      { status: 500 }
    )
  }
}
