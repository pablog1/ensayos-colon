import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/auditoria/export - Exportar todos los logs como JSON (solo admin)
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden exportar logs" },
      { status: 403 }
    )
  }

  // Obtener todos los logs
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    version: "1.0",
    totalLogs: logs.length,
    logs,
  })
}
