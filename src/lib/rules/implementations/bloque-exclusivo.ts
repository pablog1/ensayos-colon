import { prisma } from "@/lib/prisma"
import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
  BloqueExclusivoConfig,
} from "../types"

const DEFAULT_CONFIG: BloqueExclusivoConfig = {
  maxPorPersona: 1,
  permiteCancel: false,
}

export const bloqueExclusivoRule: RuleDefinition = {
  id: "R4_BLOQUE_EXCLUSIVO",
  name: "Bloque exclusivo",
  description: "Cada persona puede solicitar 1 bloque por año. Si alguien pide un bloque, nadie más puede pedirlo. No se puede cancelar un bloque una vez iniciado. Cada función del bloque cuenta individualmente para el máximo anual.",
  category: "bloque",
  priority: 20,
  enabled: true,
  configKey: "BLOQUE_EXCLUSIVO",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    // Si no es solicitud de bloque, pasar
    if (context.requestType !== "VOLUNTARIO" || !context.blockId) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No es solicitud de bloque",
        details: {
          esSolicitudBloque: false,
        },
        suggestedAction: "APPROVE",
      }
    }

    const bloqueConfig = (config.value as BloqueExclusivoConfig) ?? DEFAULT_CONFIG

    // Verificar si ya uso bloque esta temporada
    if (context.userBalance.bloqueUsado) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: false,
        blocking: true,
        message: `Ya utilizaste tu bloque de esta temporada (máximo ${bloqueConfig.maxPorPersona} por año)`,
        details: {
          bloqueUsado: true,
          maxPorPersona: bloqueConfig.maxPorPersona,
        },
        suggestedAction: "REJECT",
      }
    }

    // Verificar si el bloque esta disponible (no solicitado por otro)
    const bloque = await prisma.block.findUnique({
      where: { id: context.blockId },
      include: {
        assignedTo: {
          select: { id: true, name: true },
        },
      },
    })

    if (!bloque) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: false,
        blocking: true,
        message: "Bloque no encontrado",
        details: {
          blockId: context.blockId,
          error: "NOT_FOUND",
        },
        suggestedAction: "REJECT",
      }
    }

    // Verificar si ya esta asignado a otro usuario
    if (bloque.assignedToId && bloque.assignedToId !== context.userId) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: false,
        blocking: true,
        message: `Este bloque ya fue solicitado por ${bloque.assignedTo?.name ?? "otro integrante"}`,
        details: {
          blockId: context.blockId,
          blockName: bloque.name,
          assignedToId: bloque.assignedToId,
          assignedToName: bloque.assignedTo?.name,
          estado: bloque.estado,
        },
        suggestedAction: "REJECT",
      }
    }

    // Verificar si el bloque ya inicio (no se puede cancelar)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const bloqueInicio = new Date(bloque.startDate)
    bloqueInicio.setHours(0, 0, 0, 0)

    if (bloque.estado === "EN_CURSO" || bloqueInicio <= hoy) {
      // Si ya esta asignado al mismo usuario y ya inicio, permitir continuar
      if (bloque.assignedToId === context.userId) {
        return {
          ruleId: this.id,
          ruleName: this.name,
          passed: true,
          blocking: false,
          message: "Bloque en curso - continuando con tu asignación",
          details: {
            blockName: bloque.name,
            estado: bloque.estado,
            enCurso: true,
          },
          suggestedAction: "APPROVE",
        }
      }
    }

    // Bloque disponible
    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true,
      blocking: false,
      message: `Bloque "${bloque.name}" disponible`,
      details: {
        blockId: bloque.id,
        blockName: bloque.name,
        startDate: bloque.startDate,
        endDate: bloque.endDate,
        estado: bloque.estado,
      },
      suggestedAction: "APPROVE",
    }
  },
}
