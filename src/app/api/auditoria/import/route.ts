import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditAction, Prisma } from "@/generated/prisma"
import { createAuditLog } from "@/lib/services/audit"

interface ImportedLog {
  id: string
  action: string
  entityType: string
  entityId: string
  userId: string
  targetUserId?: string | null
  details?: Record<string, unknown> | null
  isCritical?: boolean
  createdAt: string
}

// POST /api/auditoria/import - Importar logs desde JSON (solo admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden importar logs" },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const { logs } = body as { logs: ImportedLog[] }

    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { error: "Formato de backup inválido" },
        { status: 400 }
      )
    }

    // Obtener IDs existentes para evitar duplicados
    const existingIds = new Set(
      (await prisma.auditLog.findMany({ select: { id: true } })).map(l => l.id)
    )

    // Filtrar logs que no existen
    const newLogs = logs.filter(log => !existingIds.has(log.id))

    if (newLogs.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: logs.length,
        message: "Todos los logs ya existen en la base de datos",
      })
    }

    // Verificar que los usuarios referenciados existen
    const userIds = new Set([
      ...newLogs.map(l => l.userId),
      ...newLogs.filter(l => l.targetUserId).map(l => l.targetUserId as string),
    ])
    const existingUsers = new Set(
      (await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true },
      })).map(u => u.id)
    )

    // Filtrar logs con usuarios válidos
    const validLogs = newLogs.filter(
      log => existingUsers.has(log.userId) &&
             (!log.targetUserId || existingUsers.has(log.targetUserId))
    )

    // Importar logs
    await prisma.auditLog.createMany({
      data: validLogs.map(log => ({
        id: log.id,
        action: log.action as AuditAction,
        entityType: log.entityType,
        entityId: log.entityId,
        userId: log.userId,
        targetUserId: log.targetUserId || null,
        details: log.details ? (log.details as Prisma.InputJsonValue) : Prisma.JsonNull,
        isCritical: log.isCritical || false,
        createdAt: new Date(log.createdAt),
      })),
      skipDuplicates: true,
    })

    // Registrar la importación
    await createAuditLog({
      action: "CONFIG_MODIFICADA",
      entityType: "AuditLog",
      entityId: "backup-import",
      userId: session.user.id,
      isCritical: true,
      details: {
        importedCount: validLogs.length,
        skippedExisting: logs.length - newLogs.length,
        skippedInvalidUsers: newLogs.length - validLogs.length,
      },
    })

    return NextResponse.json({
      imported: validLogs.length,
      skipped: logs.length - validLogs.length,
      message: `${validLogs.length} registros importados correctamente`,
    })
  } catch (error) {
    console.error("Error importing logs:", error)
    return NextResponse.json(
      { error: "Error al procesar el archivo de backup" },
      { status: 500 }
    )
  }
}
