import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"

// GET /api/configuracion/reglas/[key] - Obtener una configuracion especifica
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { key } = await params

  const config = await prisma.ruleConfig.findUnique({
    where: { key },
  })

  if (!config) {
    return NextResponse.json(
      { error: "Configuración no encontrada" },
      { status: 404 }
    )
  }

  let parsedValue = null
  try {
    parsedValue = JSON.parse(config.value)
  } catch {
    parsedValue = config.value
  }

  return NextResponse.json({
    ...config,
    parsedValue,
  })
}

// PUT /api/configuracion/reglas/[key] - Actualizar una configuracion
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden modificar configuraciones" },
      { status: 403 }
    )
  }

  const { key } = await params
  const body = await req.json()
  const { value, enabled, priority, description } = body

  const existingConfig = await prisma.ruleConfig.findUnique({
    where: { key },
  })

  if (!existingConfig) {
    return NextResponse.json(
      { error: "Configuración no encontrada" },
      { status: 404 }
    )
  }

  const data: Record<string, unknown> = {}

  if (value !== undefined) {
    data.value = typeof value === "string" ? value : JSON.stringify(value)
  }
  if (enabled !== undefined) {
    data.enabled = enabled
  }
  if (priority !== undefined) {
    data.priority = priority
  }
  if (description !== undefined) {
    data.description = description
  }

  const updated = await prisma.ruleConfig.update({
    where: { key },
    data,
  })

  // Registrar en auditoria
  await createAuditLog({
    action: "CONFIG_MODIFICADA",
    entityType: "RuleConfig",
    entityId: updated.id,
    userId: session.user.id,
    details: {
      key,
      previousValue: existingConfig.value,
      newValue: data.value ?? existingConfig.value,
      changes: data,
    },
  })

  let parsedValue = null
  try {
    parsedValue = JSON.parse(updated.value)
  } catch {
    parsedValue = updated.value
  }

  return NextResponse.json({
    ...updated,
    parsedValue,
  })
}
