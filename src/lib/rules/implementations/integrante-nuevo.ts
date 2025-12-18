import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
} from "../types"

interface IntegranteNuevoConfig {
  usarPromedio: boolean
  adminOverride: boolean
}

const DEFAULT_CONFIG: IntegranteNuevoConfig = {
  usarPromedio: true,
  adminOverride: true,
}

export const integranteNuevoRule: RuleDefinition = {
  id: "R10_INTEGRANTE_NUEVO",
  name: "Integrante nuevo",
  description: "Cuando ingresa un nuevo integrante durante la temporada, su máximo proyectado se calcula como el promedio de rotativos tomados por el resto al momento del ingreso. El administrador puede modificar este valor manualmente.",
  category: "restriccion",
  priority: 80,
  enabled: true,
  configKey: "INTEGRANTE_NUEVO",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    const integranteConfig = (config.value as IntegranteNuevoConfig) ?? DEFAULT_CONFIG

    const { fechaIngreso, maxProyectado, maxAjustadoManual } = context.userBalance

    // Verificar si es integrante nuevo (tiene fecha de ingreso registrada)
    const esIntegranteNuevo = !!fechaIngreso

    if (!esIntegranteNuevo) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No es integrante nuevo",
        details: {
          esIntegranteNuevo: false,
        },
        suggestedAction: "APPROVE",
      }
    }

    // Calcular dias desde ingreso
    const hoy = new Date()
    const fechaIngresoDate = new Date(fechaIngreso)
    const diasDesdeIngreso = Math.floor(
      (hoy.getTime() - fechaIngresoDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Verificar si el max fue ajustado por admin
    const maxEfectivo = maxAjustadoManual ?? maxProyectado
    const fueAjustado = maxAjustadoManual !== null && maxAjustadoManual !== undefined

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true,
      blocking: false,
      message: fueAjustado
        ? `Integrante nuevo con máximo ajustado por admin: ${maxEfectivo}`
        : `Integrante nuevo con máximo basado en promedio: ${maxEfectivo}`,
      details: {
        esIntegranteNuevo: true,
        fechaIngreso: fechaIngresoDate.toISOString(),
        diasDesdeIngreso,
        maxProyectadoOriginal: maxProyectado,
        maxAjustadoManual,
        maxEfectivo,
        fueAjustadoPorAdmin: fueAjustado,
        usarPromedio: integranteConfig.usarPromedio,
        permitirOverride: integranteConfig.adminOverride,
      },
      suggestedAction: "APPROVE",
    }
  },
}

// Funcion auxiliar para calcular maximo de integrante nuevo
export function calcularMaximoIntegranteNuevo(
  promedioRotativosGrupo: number
): number {
  // El maximo es el promedio del grupo al momento del ingreso
  return Math.round(promedioRotativosGrupo)
}
