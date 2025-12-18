import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
  CupoDiarioConfig,
} from "../types"

const DEFAULT_CUPOS: CupoDiarioConfig = {
  OPERA: 4,
  CONCIERTO: 2,
  ENSAYO: 2,
  ENSAYO_DOBLE: 2,
  OTRO: 2,
}

export const cupoDiarioRule: RuleDefinition = {
  id: "R1_CUPO_DIARIO",
  name: "Cupo diario por tipo de evento",
  description: "Limita la cantidad de rotativos que se pueden tomar por día según el tipo de evento. Ópera: 4 cupos, Concierto: 2 cupos.",
  category: "cupo",
  priority: 10,
  enabled: true,
  configKey: "CUPO_DIARIO",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    const cupos = (config.value as CupoDiarioConfig) ?? DEFAULT_CUPOS
    const cupoParaTipo = cupos[context.eventType] ?? 2

    const hayLugar = context.eventData.currentApproved < cupoParaTipo

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: hayLugar,
      blocking: !hayLugar,
      message: hayLugar
        ? `Hay lugar disponible (${context.eventData.currentApproved}/${cupoParaTipo})`
        : `Cupo lleno para ${context.eventType} (${cupoParaTipo}/${cupoParaTipo})`,
      details: {
        eventType: context.eventType,
        cupoTotal: cupoParaTipo,
        cupoUsado: context.eventData.currentApproved,
        cupoDisponible: Math.max(0, cupoParaTipo - context.eventData.currentApproved),
      },
      suggestedAction: hayLugar ? "APPROVE" : "WAITING_LIST",
    }
  },
}
