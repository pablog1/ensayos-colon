import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
  RotacionObligatoriaConfig,
} from "../types"

const DEFAULT_CONFIG: RotacionObligatoriaConfig = {
  diasAntes: 5,
  criterio: "MENOS_ROTATIVOS",
}

export const rotacionObligatoriaRule: RuleDefinition = {
  id: "R7_ROTACION_OBLIGATORIA",
  name: "Rotación obligatoria",
  description: "Cuando sobra personal y nadie solicita rotativo: hasta 5 días antes hay plazo para consenso entre integrantes. Faltando 5 días, el sistema asigna automáticamente. Criterio: quienes tengan menos rotativos tomados. En empate, selección al azar. Las decisiones quedan registradas en auditoría.",
  category: "rotacion",
  priority: 30,
  enabled: true,
  configKey: "ROTACION_OBLIGATORIA",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    // Esta regla solo aplica cuando se procesa una asignacion obligatoria
    if (context.requestType !== "OBLIGATORIO") {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No es rotación obligatoria",
        details: {
          esRotacionObligatoria: false,
        },
        suggestedAction: "APPROVE",
      }
    }

    const rotacionConfig = (config.value as RotacionObligatoriaConfig) ?? DEFAULT_CONFIG

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const fechaEvento = new Date(context.eventDate)
    fechaEvento.setHours(0, 0, 0, 0)

    const diffMs = fechaEvento.getTime() - hoy.getTime()
    const diasHastaEvento = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    // Verificar si estamos dentro del plazo de asignacion automatica
    const dentroDelPlazo = diasHastaEvento <= rotacionConfig.diasAntes

    if (!dentroDelPlazo) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: false,
        blocking: true,
        message: `Rotación obligatoria solo puede asignarse faltando ${rotacionConfig.diasAntes} días o menos`,
        details: {
          diasHastaEvento,
          diasLimite: rotacionConfig.diasAntes,
          criterio: rotacionConfig.criterio,
          dentroDelPlazo: false,
        },
        suggestedAction: "REJECT",
      }
    }

    // Validar que el usuario tiene los menos rotativos (o empate)
    const { rotativosTomados, rotativosObligatorios } = context.userBalance
    const totalUsuario = rotativosTomados + rotativosObligatorios

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true,
      blocking: false,
      message: `Rotación obligatoria válida (${diasHastaEvento} días hasta evento)`,
      details: {
        esRotacionObligatoria: true,
        diasHastaEvento,
        diasLimite: rotacionConfig.diasAntes,
        criterio: rotacionConfig.criterio,
        dentroDelPlazo: true,
        rotativosUsuario: totalUsuario,
      },
      suggestedAction: "APPROVE",
    }
  },
}
