import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { verificarYNotificarBajoCupo } from "@/lib/services/notifications"

/**
 * GET /api/admin/test-bajo-cupo
 *
 * Endpoint de prueba para verificar la funcionalidad de alerta de bajo cupo.
 * Ejecuta la misma lógica que se ejecutaría después de aprobar un rotativo.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
  }

  console.log("[test-bajo-cupo] Ejecutando verificación manualmente...")

  const resultado = await verificarYNotificarBajoCupo()

  console.log("[test-bajo-cupo] Resultado:", resultado)

  return NextResponse.json({
    mensaje: resultado.notificado
      ? `Se envió notificación sobre ${resultado.usuariosAfectados} usuario(s) con bajo cupo`
      : "No hay usuarios con bajo cupo o no se cumplieron las condiciones",
    ...resultado,
  })
}
