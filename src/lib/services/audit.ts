import { prisma } from "@/lib/prisma"
import { Prisma, type AuditAction } from "@/generated/prisma"

interface CreateAuditLogParams {
  action: AuditAction
  entityType: string
  entityId: string
  userId: string
  targetUserId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      targetUserId: params.targetUserId ?? null,
      details: params.details ? (params.details as Prisma.InputJsonValue) : Prisma.JsonNull,
      ipAddress: params.ipAddress ?? null,
    },
  })
}

export async function getAuditLogs(options?: {
  action?: AuditAction
  entityType?: string
  entityId?: string
  userId?: string
  targetUserId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const where: Record<string, unknown> = {}

  if (options?.action) where.action = options.action
  if (options?.entityType) where.entityType = options.entityType
  if (options?.entityId) where.entityId = options.entityId
  if (options?.userId) where.userId = options.userId
  if (options?.targetUserId) where.targetUserId = options.targetUserId

  if (options?.startDate || options?.endDate) {
    where.createdAt = {
      ...(options.startDate ? { gte: options.startDate } : {}),
      ...(options.endDate ? { lte: options.endDate } : {}),
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    }),
    prisma.auditLog.count({ where }),
  ])

  // Obtener información de usuarios
  const userIds = [...new Set(logs.flatMap(log => [log.userId, log.targetUserId].filter(Boolean)))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds as string[] } },
    select: { id: true, name: true, alias: true },
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  // Agregar datos de usuario a los logs
  const logsWithUsers = logs.map(log => ({
    ...log,
    user: userMap.get(log.userId) || null,
    targetUser: log.targetUserId ? userMap.get(log.targetUserId) || null : null,
  }))

  return { logs: logsWithUsers, total }
}

export async function getEntityHistory(entityType: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  })
}

// Purgar logs del año anterior (llamar al inicio de temporada)
export async function purgeOldLogs(keepCurrentYear: boolean = true): Promise<number> {
  const currentYear = new Date().getFullYear()
  const cutoffDate = keepCurrentYear
    ? new Date(currentYear, 0, 1) // 1 de enero del año actual
    : new Date() // Todos los logs antiguos

  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  })

  return result.count
}
