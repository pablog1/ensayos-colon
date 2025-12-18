import { prisma } from "@/lib/prisma"
import type {
  ValidationContext,
  ValidationResult,
  RuleDefinition,
  RuleConfigValue,
  RuleValidationSummary,
  SuggestedAction,
} from "./types"

// Registro de reglas
const ruleRegistry: Map<string, RuleDefinition> = new Map()

export function registerRule(rule: RuleDefinition): void {
  ruleRegistry.set(rule.id, rule)
}

export function getRegisteredRules(): RuleDefinition[] {
  return Array.from(ruleRegistry.values())
}

export function getRuleById(ruleId: string): RuleDefinition | undefined {
  return ruleRegistry.get(ruleId)
}

export async function loadRuleConfigs(): Promise<Map<string, RuleConfigValue>> {
  const configs = await prisma.ruleConfig.findMany()

  const configMap = new Map<string, RuleConfigValue>()
  for (const config of configs) {
    let parsedValue: unknown
    try {
      parsedValue = JSON.parse(config.value)
    } catch {
      parsedValue = config.value
    }

    configMap.set(config.key, {
      enabled: config.enabled,
      value: parsedValue,
      priority: config.priority,
    })
  }
  return configMap
}

export async function getRuleConfig(key: string): Promise<RuleConfigValue | null> {
  const config = await prisma.ruleConfig.findUnique({
    where: { key },
  })

  if (!config) return null

  let parsedValue: unknown
  try {
    parsedValue = JSON.parse(config.value)
  } catch {
    parsedValue = config.value
  }

  return {
    enabled: config.enabled,
    value: parsedValue,
    priority: config.priority,
  }
}

export async function updateRuleConfig(
  key: string,
  updates: { value?: unknown; enabled?: boolean; priority?: number }
): Promise<void> {
  const data: Record<string, unknown> = {}

  if (updates.value !== undefined) {
    data.value = typeof updates.value === "string"
      ? updates.value
      : JSON.stringify(updates.value)
  }
  if (updates.enabled !== undefined) {
    data.enabled = updates.enabled
  }
  if (updates.priority !== undefined) {
    data.priority = updates.priority
  }

  await prisma.ruleConfig.update({
    where: { key },
    data,
  })
}

export async function validateRequest(
  context: ValidationContext
): Promise<RuleValidationSummary> {
  const configs = await loadRuleConfigs()

  // Ordenar reglas por prioridad (jerarquia configurable R12)
  const sortedRules = Array.from(ruleRegistry.values())
    .filter((rule) => {
      const config = configs.get(rule.configKey)
      return config?.enabled ?? rule.enabled
    })
    .sort((a, b) => {
      const priorityA = configs.get(a.configKey)?.priority ?? a.priority
      const priorityB = configs.get(b.configKey)?.priority ?? b.priority
      return priorityA - priorityB
    })

  const results: ValidationResult[] = []
  let canProceed = true
  let suggestedAction: SuggestedAction = "APPROVE"
  let blockingRule: string | undefined

  for (const rule of sortedRules) {
    const config = configs.get(rule.configKey) ?? {
      enabled: rule.enabled,
      value: null,
      priority: rule.priority,
    }

    const result = await rule.validate(context, config)
    results.push(result)

    if (!result.passed) {
      if (result.blocking) {
        canProceed = false
        blockingRule = rule.id
        suggestedAction = result.suggestedAction ?? "REJECT"
        break // Detener en primera regla bloqueante
      }

      // Actualizar accion sugerida si es mas restrictiva
      if (result.suggestedAction === "REJECT") {
        suggestedAction = "REJECT"
      } else if (
        result.suggestedAction === "WAITING_LIST" &&
        suggestedAction === "APPROVE"
      ) {
        suggestedAction = "WAITING_LIST"
      } else if (
        result.suggestedAction === "PENDING_ADMIN" &&
        suggestedAction !== "REJECT"
      ) {
        suggestedAction = "PENDING_ADMIN"
      }
    }
  }

  return { canProceed, results, suggestedAction, blockingRule }
}

export async function buildValidationContext(
  userId: string,
  eventId: string
): Promise<ValidationContext> {
  // Obtener datos del evento
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      season: true,
      block: true,
      rotativos: {
        where: { estado: "APROBADO" },
      },
      waitingList: true,
    },
  })

  if (!event) {
    throw new Error(`Evento no encontrado: ${eventId}`)
  }

  // Obtener balance del usuario
  const balance = await prisma.userSeasonBalance.findUnique({
    where: {
      userId_seasonId: {
        userId,
        seasonId: event.seasonId,
      },
    },
  })

  // Obtener configuracion de cupos
  const cupoConfig = await getRuleConfig("CUPO_DIARIO")
  const cupos = (cupoConfig?.value as Record<string, number>) ?? {
    OPERA: 4,
    CONCIERTO: 2,
    ENSAYO: 2,
    ENSAYO_DOBLE: 2,
    OTRO: 2,
  }

  // Calcular estadisticas de temporada
  const totalIntegrantes = await prisma.user.count({
    where: { role: "INTEGRANTE" },
  })

  const totalRotativos = await prisma.rotativo.count({
    where: {
      event: { seasonId: event.seasonId },
      estado: "APROBADO",
    },
  })

  const promedioRotativos =
    totalIntegrantes > 0 ? totalRotativos / totalIntegrantes : 0

  // Determinar si es fin de semana
  const dayOfWeek = event.date.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  // Parsear fines de semana del mes
  const finesDeSemanaMes = (balance?.finesDeSemanaMes as Record<string, number>) ?? {}

  return {
    userId,
    eventId,
    seasonId: event.seasonId,
    requestType: "VOLUNTARIO",
    requestDate: new Date(),
    eventDate: event.date,
    eventType: event.eventType,
    isWeekend,
    isPartOfBlock: !!event.blockId,
    blockId: event.blockId ?? undefined,

    userBalance: {
      rotativosTomados: balance?.rotativosTomados ?? 0,
      rotativosObligatorios: balance?.rotativosObligatorios ?? 0,
      rotativosPorLicencia: balance?.rotativosPorLicencia ?? 0,
      maxProyectado: balance?.maxProyectado ?? 50,
      maxAjustadoManual: balance?.maxAjustadoManual ?? undefined,
      finesDeSemanaMes,
      bloqueUsado: balance?.bloqueUsado ?? false,
      fechaIngreso: balance?.fechaIngreso ?? undefined,
    },

    eventData: {
      currentApproved: event.rotativos.length,
      cupoTotal: cupos[event.eventType] ?? 2,
      waitingListLength: event.waitingList.length,
    },

    seasonData: {
      workingDays: event.season.workingDays,
      totalIntegrantes,
      promedioRotativos,
    },
  }
}

// Funcion auxiliar para validar solo cupo (usada por lista de espera)
export async function validateCupoOnly(
  context: ValidationContext
): Promise<ValidationResult> {
  const cupoRule = ruleRegistry.get("R1_CUPO_DIARIO")
  if (!cupoRule) {
    return {
      ruleId: "R1_CUPO_DIARIO",
      ruleName: "Cupo diario",
      passed: true,
      blocking: false,
      message: "Regla no encontrada, permitiendo por defecto",
    }
  }

  const config = await getRuleConfig("CUPO_DIARIO")
  return cupoRule.validate(context, config ?? { enabled: true, value: null, priority: 10 })
}
