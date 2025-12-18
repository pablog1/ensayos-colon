import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
  ListaEsperaConfig,
} from "../types"

const DEFAULT_CONFIG: ListaEsperaConfig = {
  tipo: "FIFO",
  vencimiento: null, // Sin vencimiento, se purga al fin de temporada
}

export const listaEsperaRule: RuleDefinition = {
  id: "R5_LISTA_ESPERA",
  name: "Lista de espera FIFO",
  description: "Cuando no hay cupo disponible, las solicitudes entran a una lista de espera ordenada por orden de llegada (FIFO). No tiene vencimiento y se purga al fin de temporada. El primer solicitante en lista de espera pasa al lugar liberado cuando hay cancelaciones.",
  category: "cupo",
  priority: 15,
  enabled: true,
  configKey: "LISTA_ESPERA",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    const listaConfig = (config.value as ListaEsperaConfig) ?? DEFAULT_CONFIG

    // Esta regla solo provee informacion sobre la lista de espera
    // La decision de ir a lista de espera la toma R1 (cupo diario)

    const hayListaEspera = context.eventData.waitingListLength > 0
    const posicionEstimada = context.eventData.waitingListLength + 1

    // Si hay cupo, no se necesita lista de espera
    if (context.eventData.currentApproved < context.eventData.cupoTotal) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "Hay cupo disponible, no se requiere lista de espera",
        details: {
          hayListaEspera,
          personasEnEspera: context.eventData.waitingListLength,
          cupoDisponible: context.eventData.cupoTotal - context.eventData.currentApproved,
        },
        suggestedAction: "APPROVE",
      }
    }

    // No hay cupo, informar sobre lista de espera
    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true, // No bloquea, solo informa
      blocking: false,
      message: hayListaEspera
        ? `Lista de espera activa. Tu posición estimada: #${posicionEstimada}`
        : "Serás el primero en la lista de espera",
      details: {
        tipoLista: listaConfig.tipo,
        vencimiento: listaConfig.vencimiento,
        personasEnEspera: context.eventData.waitingListLength,
        posicionEstimada,
        cupoTotal: context.eventData.cupoTotal,
        cupoUsado: context.eventData.currentApproved,
      },
      suggestedAction: "WAITING_LIST",
    }
  },
}
