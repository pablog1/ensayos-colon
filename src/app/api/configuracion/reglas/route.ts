import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAllRulesMetadata, loadRuleConfigs, initializeRules } from "@/lib/rules"
import { createAuditLog } from "@/lib/services/audit"

// GET /api/configuracion/reglas - Obtener todas las configuraciones de reglas
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  initializeRules()

  // Obtener metadata de reglas
  const rulesMetadata = getAllRulesMetadata()

  // Obtener configuraciones de la BD
  const configs = await prisma.ruleConfig.findMany({
    orderBy: { priority: "asc" },
  })

  // Combinar metadata con configuraciones
  const rules = rulesMetadata.map((rule) => {
    const config = configs.find((c) => c.key === rule.configKey)

    let parsedValue = null
    if (config?.value) {
      try {
        parsedValue = JSON.parse(config.value)
      } catch {
        parsedValue = config.value
      }
    }

    return {
      ...rule,
      currentValue: parsedValue,
      enabled: config?.enabled ?? rule.enabled,
      priority: config?.priority ?? rule.priority,
      description: config?.description ?? rule.description,
      category: config?.category ?? rule.category,
      valueType: config?.valueType ?? "json",
      lastUpdated: config?.updatedAt ?? null,
    }
  })

  return NextResponse.json({ rules })
}

// PUT /api/configuracion/reglas - Actualizar multiples configuraciones (solo admin)
export async function PUT(req: NextRequest) {
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

  const body = await req.json()
  const { updates } = body as {
    updates: Array<{
      key: string
      value?: unknown
      enabled?: boolean
      priority?: number
    }>
  }

  if (!updates || !Array.isArray(updates)) {
    return NextResponse.json(
      { error: "Se requiere un array de actualizaciones" },
      { status: 400 }
    )
  }

  const results = []

  for (const update of updates) {
    const data: Record<string, unknown> = {}

    if (update.value !== undefined) {
      data.value =
        typeof update.value === "string"
          ? update.value
          : JSON.stringify(update.value)
    }
    if (update.enabled !== undefined) {
      data.enabled = update.enabled
    }
    if (update.priority !== undefined) {
      data.priority = update.priority
    }

    const updated = await prisma.ruleConfig.update({
      where: { key: update.key },
      data,
    })

    // Registrar en auditoria
    await createAuditLog({
      action: "CONFIG_MODIFICADA",
      entityType: "RuleConfig",
      entityId: updated.id,
      userId: session.user.id,
      details: {
        key: update.key,
        changes: data,
      },
    })

    results.push(updated)
  }

  return NextResponse.json({ success: true, updated: results.length })
}
