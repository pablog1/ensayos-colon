import { prisma } from "@/lib/prisma"
import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
  FuncionesPorTituloConfig,
} from "../types"

const DEFAULT_CONFIG: FuncionesPorTituloConfig = {
  enabled: true,
  umbralFunciones: 3, // Hasta 3 funciones
  maxHasta: 1, // Máximo 1 rotativo
  porcentajeSobre: 30, // 30% si hay más de 3
}

export const funcionesPorTituloRule: RuleDefinition = {
  id: "R13_FUNCIONES_POR_TITULO",
  name: "Límite de funciones por título",
  description:
    "Limita cuántas funciones puede pedir un integrante como rotativo dentro del mismo título. Hasta 3 funciones: máximo 1. Más de 3 funciones: máximo 30%.",
  category: "restriccion",
  priority: 16, // Después de ensayos dobles (15)
  enabled: true,
  configKey: "FUNCIONES_POR_TITULO",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    const cfg = (config.value as FuncionesPorTituloConfig) ?? DEFAULT_CONFIG

    // Obtener el evento con su título y tipo
    const evento = await prisma.event.findUnique({
      where: { id: context.eventId },
      select: {
        id: true,
        eventoType: true,
        tituloId: true,
        titulo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Solo aplica a eventos tipo FUNCION
    if (evento?.eventoType !== "FUNCION") {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No aplica: el evento no es una función",
      }
    }

    if (!evento?.tituloId) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No aplica: el evento no tiene título asociado",
      }
    }

    // Contar todas las funciones del título
    const totalFunciones = await prisma.event.count({
      where: {
        tituloId: evento.tituloId,
        eventoType: "FUNCION",
      },
    })

    if (totalFunciones === 0) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No aplica: el título no tiene funciones",
      }
    }

    // Calcular máximo permitido
    let maxPermitido: number
    if (totalFunciones <= cfg.umbralFunciones) {
      maxPermitido = cfg.maxHasta
    } else {
      // Porcentaje, redondeando hacia abajo, mínimo 1
      maxPermitido = Math.max(1, Math.floor((totalFunciones * cfg.porcentajeSobre) / 100))
    }

    // Contar funciones del usuario en este título (aprobadas o pendientes)
    const funcionesDelUsuario = await prisma.rotativo.count({
      where: {
        userId: context.userId,
        estado: { in: ["APROBADO", "PENDIENTE"] },
        event: {
          tituloId: evento.tituloId,
          eventoType: "FUNCION",
        },
      },
    })

    // Si ya tiene el máximo permitido, enviar a revisión
    if (funcionesDelUsuario >= maxPermitido) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: false,
        blocking: false, // No bloquea, va a revisión del admin
        message: `Ya tenés ${funcionesDelUsuario} rotativo(s) en funciones de "${evento.titulo?.name}" (máx: ${maxPermitido} de ${totalFunciones}). Solicitud enviada a revisión.`,
        details: {
          tituloId: evento.tituloId,
          tituloName: evento.titulo?.name,
          totalFunciones,
          funcionesDelUsuario,
          maxPermitido,
          umbralAplicado: totalFunciones <= cfg.umbralFunciones ? "fijo" : "porcentaje",
        },
        suggestedAction: "PENDING_ADMIN",
      }
    }

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true,
      blocking: false,
      message: `Podés solicitar rotativo en funciones de "${evento.titulo?.name}" (${funcionesDelUsuario}/${maxPermitido} usado)`,
      details: {
        tituloId: evento.tituloId,
        tituloName: evento.titulo?.name,
        totalFunciones,
        funcionesDelUsuario,
        maxPermitido,
      },
    }
  },
}
