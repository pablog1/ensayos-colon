import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
} from "../types"

interface CoberturaExternaConfig {
  criterio: "MAS_ROTATIVOS" | "MENOS_ROTATIVOS"
}

const DEFAULT_CONFIG: CoberturaExternaConfig = {
  criterio: "MAS_ROTATIVOS",
}

export const coberturaExternaRule: RuleDefinition = {
  id: "R8_COBERTURA_EXTERNA",
  name: "Cobertura por causas externas",
  description: "Cuando el teatro necesita cubrir lugares por causas externas (ej: baja de personal contratado), se prioriza a quienes más rotativos hayan tomado. En empate: consenso o azar (registrado en auditoría).",
  category: "rotacion",
  priority: 35,
  enabled: true,
  configKey: "COBERTURA_EXTERNA",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    // Esta regla solo aplica cuando se procesa una cobertura externa
    if (context.requestType !== "COBERTURA") {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No es cobertura por causa externa",
        details: {
          esCobertura: false,
        },
        suggestedAction: "APPROVE",
      }
    }

    const coberturaConfig = (config.value as CoberturaExternaConfig) ?? DEFAULT_CONFIG

    const { rotativosTomados, rotativosObligatorios } = context.userBalance
    const totalUsuario = rotativosTomados + rotativosObligatorios
    const promedioGrupo = context.seasonData.promedioRotativos

    // Para cobertura externa, el criterio es opuesto a rotacion obligatoria
    // Se busca a quien MAS rotativos haya tomado
    const esCandidatoIdeal = totalUsuario >= promedioGrupo

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true, // La cobertura siempre se permite si hay cupo
      blocking: false,
      message: esCandidatoIdeal
        ? `Candidato prioritario para cobertura (${totalUsuario} rotativos, promedio: ${promedioGrupo.toFixed(1)})`
        : `Usuario con menos rotativos que el promedio (${totalUsuario} vs ${promedioGrupo.toFixed(1)})`,
      details: {
        esCobertura: true,
        criterio: coberturaConfig.criterio,
        rotativosUsuario: totalUsuario,
        promedioGrupo,
        esCandidatoIdeal,
      },
      suggestedAction: "APPROVE",
    }
  },
}
