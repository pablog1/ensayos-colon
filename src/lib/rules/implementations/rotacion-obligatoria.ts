import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
} from "../types"

/**
 * Regla de Rotación Obligatoria
 *
 * Esta regla es INFORMATIVA - no tiene automatismos.
 * Cuando no hay voluntarios para cubrir un evento, el admin puede designar
 * a quién rotará, priorizando a quienes menos rotativos hayan utilizado.
 * Se busca consenso, pero el admin tiene potestad para asignar.
 */
export const rotacionObligatoriaRule: RuleDefinition = {
  id: "R7_ROTACION_OBLIGATORIA",
  name: "Rotación obligatoria",
  description: "Si es necesario cubrir un evento y no hay voluntarios, el admin puede designar quién rotará priorizando a quienes menos rotativos hayan utilizado. La gestión es manual.",
  category: "rotacion",
  priority: 30,
  enabled: true,
  configKey: "ROTACION_OBLIGATORIA",

  async validate(
    _context: ValidationContext,
    _config: RuleConfigValue
  ): Promise<ValidationResult> {
    // Esta regla es solo informativa, no tiene validación automática
    // El admin gestiona manualmente las asignaciones obligatorias
    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true,
      blocking: false,
      message: "Gestión manual por admin - Se prioriza a quienes menos rotativos hayan utilizado",
      details: {
        gestionManual: true,
        criterio: "El admin asigna priorizando a quienes menos rotativos tengan",
      },
      suggestedAction: "APPROVE",
    }
  },
}
