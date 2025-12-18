import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
} from "../types"

const DEFAULT_UMBRAL = 90 // 90% del maximo

export const alertaCercaniaRule: RuleDefinition = {
  id: "R11_ALERTA_CERCANIA",
  name: "Alerta de cercanía al máximo",
  description: "Se notifica al integrante y al administrador cuando se alcanza el umbral configurable (por defecto 90%) del máximo proyectado.",
  category: "alerta",
  priority: 200, // Baja prioridad, no bloqueante
  enabled: true,
  configKey: "ALERTA_UMBRAL",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    const umbral = (config.value as number) ?? DEFAULT_UMBRAL

    const {
      maxProyectado,
      maxAjustadoManual,
      rotativosTomados,
      rotativosObligatorios,
      rotativosPorLicencia,
    } = context.userBalance

    const maxEfectivo = maxAjustadoManual ?? maxProyectado
    const totalActual = rotativosTomados + rotativosObligatorios + rotativosPorLicencia
    const totalConNuevo = totalActual + 1
    const porcentajeActual = (totalActual / maxEfectivo) * 100
    const porcentajeConNuevo = (totalConNuevo / maxEfectivo) * 100

    const superaUmbralActual = porcentajeActual >= umbral
    const superaUmbralConNuevo = porcentajeConNuevo >= umbral
    const superaMaximo = totalConNuevo > maxEfectivo

    // Determinar nivel de alerta
    let nivelAlerta: "NINGUNA" | "CERCANIA" | "LIMITE" | "EXCESO" = "NINGUNA"
    if (superaMaximo) {
      nivelAlerta = "EXCESO"
    } else if (superaUmbralConNuevo) {
      nivelAlerta = "LIMITE"
    } else if (superaUmbralActual) {
      nivelAlerta = "CERCANIA"
    }

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true, // Nunca bloquea, solo alerta
      blocking: false,
      message:
        nivelAlerta === "EXCESO"
          ? `ALERTA: Excedes el máximo proyectado (${porcentajeConNuevo.toFixed(1)}%)`
          : nivelAlerta === "LIMITE"
            ? `ALERTA: Alcanzarás el ${umbral}% del máximo (${porcentajeConNuevo.toFixed(1)}%)`
            : nivelAlerta === "CERCANIA"
              ? `AVISO: Ya estás en ${porcentajeActual.toFixed(1)}% del máximo`
              : `Balance: ${porcentajeActual.toFixed(1)}% del máximo proyectado`,
      details: {
        umbral,
        porcentajeActual,
        porcentajeConNuevo,
        totalActual,
        totalConNuevo,
        maxProyectado: maxEfectivo,
        superaUmbral: superaUmbralConNuevo,
        superaMaximo,
        nivelAlerta,
        rotativosTomados,
        rotativosObligatorios,
        rotativosPorLicencia,
        restantesHastaMaximo: Math.max(0, maxEfectivo - totalConNuevo),
        restantesHastaUmbral: Math.max(
          0,
          Math.floor((maxEfectivo * umbral) / 100) - totalActual
        ),
      },
      suggestedAction: "APPROVE",
    }
  },
}
