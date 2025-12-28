import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
} from "../types"

/**
 * Regla de Cobertura por Causas Externas
 *
 * Esta regla es INFORMATIVA - no tiene automatismos.
 * El criterio de priorización es: se prioriza a quienes más rotativos hayan tomado.
 * El admin se encarga de gestionar manualmente las coberturas.
 */
export const coberturaExternaRule: RuleDefinition = {
  id: "R8_COBERTURA_EXTERNA",
  name: "Cobertura por causas externas",
  description: "Cuando alguien no puede asistir, se prioriza a quienes más rotativos hayan tomado para cubrir. La gestión es manual por parte del admin.",
  category: "rotacion",
  priority: 35,
  enabled: true,
  configKey: "COBERTURA_EXTERNA",

  async validate(
    _context: ValidationContext,
    _config: RuleConfigValue
  ): Promise<ValidationResult> {
    // Esta regla es solo informativa, no tiene validación automática
    // El admin gestiona manualmente las coberturas
    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true,
      blocking: false,
      message: "Gestión manual por admin - Se prioriza a quienes más rotativos hayan tomado",
      details: {
        gestionManual: true,
        criterio: "El admin asigna coberturas priorizando a quienes más rotativos tienen",
      },
      suggestedAction: "APPROVE",
    }
  },
}
