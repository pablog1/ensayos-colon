import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
} from "../types"

interface LicenciasConfig {
  calculoPromedio: boolean
}

const DEFAULT_CONFIG: LicenciasConfig = {
  calculoPromedio: true,
}

export const licenciasRule: RuleDefinition = {
  id: "R9_LICENCIAS",
  name: "Licencias",
  description: "Cuando un integrante toma licencia, se suma a su contador la cantidad promedio de rotativos que tomó el resto durante los días de la licencia. El cálculo se realiza al reincorporarse. Si la licencia afecta un bloque solicitado, las funciones afectadas se quitan automáticamente y el bloque ya no cuenta como tal.",
  category: "restriccion",
  priority: 70,
  enabled: true,
  configKey: "LICENCIAS",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    const licenciasConfig = (config.value as LicenciasConfig) ?? DEFAULT_CONFIG

    // Esta regla solo informa sobre el impacto de licencias en el contador
    const { rotativosPorLicencia, rotativosTomados, maxProyectado } = context.userBalance

    const tieneRotativosPorLicencia = rotativosPorLicencia > 0

    if (!tieneRotativosPorLicencia) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "Sin rotativos restados por licencia",
        details: {
          rotativosPorLicencia: 0,
          calculoPromedio: licenciasConfig.calculoPromedio,
        },
        suggestedAction: "APPROVE",
      }
    }

    const totalConLicencia = rotativosTomados + rotativosPorLicencia
    const porcentajeDeMaximo = (totalConLicencia / maxProyectado) * 100

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true,
      blocking: false,
      message: `${Math.floor(rotativosPorLicencia)} rotativo(s) restado(s) por licencia`,
      details: {
        rotativosPorLicencia,
        rotativosTomados,
        totalConLicencia,
        maxProyectado,
        porcentajeDeMaximo,
        calculoPromedio: licenciasConfig.calculoPromedio,
      },
      suggestedAction: "APPROVE",
    }
  },
}

// Funcion auxiliar para calcular rotativos por licencia
export function calcularRotativosPorLicencia(
  diasLicencia: number,
  totalRotativosGrupo: number,
  integrantesActivos: number
): number {
  if (integrantesActivos === 0 || diasLicencia === 0) return 0

  // Promedio diario del grupo
  const promedioDiario = totalRotativosGrupo / integrantesActivos / diasLicencia

  // Redondear hacia abajo
  return Math.floor(promedioDiario * diasLicencia)
}
