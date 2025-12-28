import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
} from "../types"

/**
 * Regla de Primer y Último Título
 *
 * Esta regla es INFORMATIVA - no tiene automatismos.
 * Si un integrante toma rotativo en el primer título del año,
 * no puede tomar rotativo en el último título del año.
 * El admin gestiona esto manualmente.
 */
export const primerUltimoTituloRule: RuleDefinition = {
  id: "R9_PRIMER_ULTIMO_TITULO",
  name: "Primer y último título",
  description: "Si un integrante toma rotativo en el primer título del año, no puede tomar rotativo en el último título. Esto distribuye mejor las oportunidades a lo largo de la temporada.",
  category: "restriccion",
  priority: 40,
  enabled: true,
  configKey: "PRIMER_ULTIMO_TITULO",

  async validate(
    _context: ValidationContext,
    _config: RuleConfigValue
  ): Promise<ValidationResult> {
    // Esta regla es solo informativa, no tiene validación automática
    // El admin gestiona manualmente esta restricción
    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true,
      blocking: false,
      message: "Regla informativa - El admin verifica manualmente la restricción primer/último título",
      details: {
        gestionManual: true,
        criterio: "Si toma el primer título, no puede tomar el último del año",
      },
      suggestedAction: "APPROVE",
    }
  },
}
