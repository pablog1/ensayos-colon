import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
  PlazoSolicitudConfig,
} from "../types"

const DEFAULT_CONFIG: PlazoSolicitudConfig = {
  mismoDia: "PENDING_ADMIN",
  diaAnterior: "APPROVE",
}

export const plazoSolicitudRule: RuleDefinition = {
  id: "R6_PLAZO_SOLICITUD",
  name: "Plazo de solicitud",
  description: "Las solicitudes hasta el día anterior pueden auto-aprobarse si hay cupo. Las solicitudes del mismo día de la función siempre quedan pendientes de aprobación del administrador.",
  category: "restriccion",
  priority: 60,
  enabled: true,
  configKey: "PLAZO_SOLICITUD",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    const plazoConfig = (config.value as PlazoSolicitudConfig) ?? DEFAULT_CONFIG

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const fechaEvento = new Date(context.eventDate)
    fechaEvento.setHours(0, 0, 0, 0)

    const diffMs = fechaEvento.getTime() - hoy.getTime()
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    // Verificar si es fecha pasada
    if (diffDias < 0) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: false,
        blocking: true,
        message: "No se pueden solicitar rotativos para fechas pasadas",
        details: {
          diasAnticipacion: diffDias,
          fechaEvento: fechaEvento.toISOString(),
          fechaSolicitud: hoy.toISOString(),
          esFechaPasada: true,
        },
        suggestedAction: "REJECT",
      }
    }

    const esMismoDia = diffDias === 0

    if (esMismoDia) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true, // Se puede solicitar
        blocking: false,
        message: "Solicitud del mismo día - requiere aprobación manual del administrador",
        details: {
          diasAnticipacion: 0,
          esMismoDia: true,
          requiereAprobacion: true,
        },
        suggestedAction: plazoConfig.mismoDia,
      }
    }

    // Con anticipacion
    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true,
      blocking: false,
      message: `Solicitud con ${diffDias} día(s) de anticipación`,
      details: {
        diasAnticipacion: diffDias,
        esMismoDia: false,
        requiereAprobacion: false,
      },
      suggestedAction: plazoConfig.diaAnterior,
    }
  },
}
