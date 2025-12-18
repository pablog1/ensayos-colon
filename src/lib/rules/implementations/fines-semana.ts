import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
} from "../types"

export const finesSemanasRule: RuleDefinition = {
  id: "R3_FINES_SEMANA",
  name: "Restricción de fines de semana",
  description: "Cada integrante puede tomar máximo 1 fin de semana por mes. Si se toma solo el sábado de un fin de semana que incluye sábado y domingo, cuenta como el fin de semana del mes. Esta regla NO aplica para bloques.",
  category: "restriccion",
  priority: 50,
  enabled: true,
  configKey: "FINES_SEMANA_MAX",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    // No aplica para bloques (R4 tiene prioridad segun jerarquia R12)
    if (context.isPartOfBlock) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "Regla no aplica para bloques",
        details: {
          esBloque: true,
          reglaAplicada: false,
        },
        suggestedAction: "APPROVE",
      }
    }

    // No aplica si no es fin de semana
    if (!context.isWeekend) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No es fin de semana",
        details: {
          esFinDeSemana: false,
          diaSemana: context.eventDate.getDay(),
        },
        suggestedAction: "APPROVE",
      }
    }

    const maxPorMes = (config.value as number) ?? 1

    // Obtener el mes del evento en formato YYYY-MM
    const mesKey = context.eventDate.toISOString().slice(0, 7)
    const usadosEsteMes = context.userBalance.finesDeSemanaMes[mesKey] ?? 0

    const dentroDelLimite = usadosEsteMes < maxPorMes

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: dentroDelLimite,
      blocking: !dentroDelLimite,
      message: dentroDelLimite
        ? `Fin de semana disponible (${usadosEsteMes}/${maxPorMes} usado(s) este mes)`
        : `Límite de fines de semana alcanzado (${maxPorMes}/${maxPorMes} este mes)`,
      details: {
        esFinDeSemana: true,
        mes: mesKey,
        usadosEsteMes,
        maximoPorMes: maxPorMes,
        disponibles: Math.max(0, maxPorMes - usadosEsteMes),
      },
      suggestedAction: dentroDelLimite ? "APPROVE" : "REJECT",
    }
  },
}
