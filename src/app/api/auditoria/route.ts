import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAuditLogs } from "@/lib/services/audit"
import type { AuditAction } from "@/generated/prisma"

// GET /api/auditoria - Obtener logs de auditoria
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)

  const action = searchParams.get("action") as AuditAction | null
  const entityType = searchParams.get("entityType")
  const entityId = searchParams.get("entityId")
  const userId = searchParams.get("userId")
  const limit = parseInt(searchParams.get("limit") ?? "100")
  const offset = parseInt(searchParams.get("offset") ?? "0")

  const startDateStr = searchParams.get("startDate")
  const endDateStr = searchParams.get("endDate")

  const startDate = startDateStr ? new Date(startDateStr) : undefined
  const endDate = endDateStr ? new Date(endDateStr) : undefined

  const { logs, total } = await getAuditLogs({
    action: action ?? undefined,
    entityType: entityType ?? undefined,
    entityId: entityId ?? undefined,
    userId: userId ?? undefined,
    startDate,
    endDate,
    limit,
    offset,
  })

  return NextResponse.json({
    logs,
    total,
    limit,
    offset,
    hasMore: offset + logs.length < total,
  })
}
