import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
} from "../types"

export const maxProyectadoRule: RuleDefinition = {
  id: "R2_MAX_PROYECTADO",
  name: "Máximo proyectado anual",
  description: "Límite de rotativos por año calculado con la fórmula: (Días a trabajar × Cupo diario) ÷ Cantidad integrantes. Aproximadamente 50 rotativos por persona por año. Puede excederse por rotación obligatoria.",
  category: "restriccion",
  priority: 40,
  enabled: true,
  configKey: "MAX_PROYECTADO",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    const {
      maxProyectado,
      rotativosTomados,
      rotativosObligatorios,
      rotativosPorLicencia,
    } = context.userBalance

    // Siempre usar maxProyectado calculado en tiempo real
    const maxEfectivo = maxProyectado
    const totalActual = rotativosTomados + rotativosObligatorios + rotativosPorLicencia
    const totalConNuevo = totalActual + 1

    // Permitir exceder si es rotacion obligatoria (R7)
    if (context.requestType === "OBLIGATORIO") {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "Rotación obligatoria puede exceder máximo proyectado sin límite",
        details: {
          totalActual,
          maxProyectado: maxEfectivo,
          esRotacionObligatoria: true,
        },
        suggestedAction: "APPROVE",
      }
    }

    const dentroDelLimite = totalConNuevo <= maxEfectivo
    const yaEnSobrecupo = totalActual > maxEfectivo
    const porcentajeUsado = (totalConNuevo / maxEfectivo) * 100

    // Si ya está en sobrecupo, bloquear la solicitud
    if (yaEnSobrecupo) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: false,
        blocking: true, // Bloquea completamente
        message: `Ya estás en sobrecupo (${totalActual}/${maxEfectivo}). No se permiten más solicitudes.`,
        details: {
          rotativosTomados,
          rotativosObligatorios,
          rotativosPorLicencia,
          totalActual,
          totalConNuevo,
          maxProyectado: maxEfectivo,
          porcentajeUsado,
          yaEnSobrecupo: true,
        },
        suggestedAction: "REJECT",
      }
    }

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: dentroDelLimite,
      blocking: false, // Si excedería pero no está en sobrecupo, va a aprobación
      message: dentroDelLimite
        ? `Dentro del límite (${totalConNuevo}/${maxEfectivo}) - ${porcentajeUsado.toFixed(1)}%`
        : `Excedería máximo proyectado (${totalConNuevo}/${maxEfectivo}) - ${porcentajeUsado.toFixed(1)}%`,
      details: {
        rotativosTomados,
        rotativosObligatorios,
        rotativosPorLicencia,
        totalActual,
        totalConNuevo,
        maxProyectado: maxEfectivo,
        porcentajeUsado,
      },
      suggestedAction: dentroDelLimite ? "APPROVE" : "PENDING_ADMIN",
    }
  },
}
