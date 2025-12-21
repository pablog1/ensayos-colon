import type { EventType, RotativoTipo } from "@/generated/prisma"

export interface ValidationContext {
  userId: string
  eventId: string
  seasonId: string
  requestType: RotativoTipo
  requestDate: Date
  eventDate: Date
  eventType: EventType
  isWeekend: boolean
  isPartOfBlock: boolean
  blockId?: string

  // Datos del usuario
  userBalance: {
    rotativosTomados: number
    rotativosObligatorios: number
    rotativosPorLicencia: number
    maxProyectado: number
    maxAjustadoManual?: number
    finesDeSemanaMes: Record<string, number>
    bloqueUsado: boolean
    fechaIngreso?: Date
  }

  // Datos del evento
  eventData: {
    currentApproved: number
    cupoTotal: number
    waitingListLength: number
  }

  // Datos de la temporada
  seasonData: {
    workingDays: number
    totalIntegrantes: number
    promedioRotativos: number
  }
}

export type SuggestedAction = "APPROVE" | "REJECT" | "WAITING_LIST" | "PENDING_ADMIN"

export interface ValidationResult {
  ruleId: string
  ruleName: string
  passed: boolean
  blocking: boolean // Si bloquea la solicitud completamente
  message: string
  details?: Record<string, unknown>
  suggestedAction?: SuggestedAction
}

export interface RuleConfigValue {
  enabled: boolean
  value: unknown
  priority: number
}

export interface RuleDefinition {
  id: string
  name: string
  description: string
  category: "cupo" | "restriccion" | "rotacion" | "alerta" | "bloque"
  priority: number // Menor = mayor prioridad
  enabled: boolean
  configKey: string // Key en RuleConfig

  validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult>
}

export interface RuleValidationSummary {
  canProceed: boolean
  results: ValidationResult[]
  suggestedAction: SuggestedAction
  blockingRule?: string
}

// Tipos para configuración de reglas específicas
export interface CupoDiarioConfig {
  OPERA: number
  CONCIERTO: number
  ENSAYO: number
  BALLET: number
  [key: string]: number
}

export interface MaxProyectadoConfig {
  baseAnual: number
  formula: string
}

export interface PlazoSolicitudConfig {
  mismoDia: SuggestedAction
  diaAnterior: SuggestedAction
}

export interface RotacionObligatoriaConfig {
  diasAntes: number
  criterio: "MENOS_ROTATIVOS" | "MAS_ROTATIVOS"
}

export interface BloqueExclusivoConfig {
  maxPorPersona: number
  permiteCancel: boolean
}

export interface ListaEsperaConfig {
  tipo: "FIFO" | "PRIORIDAD"
  vencimiento: number | null // dias o null para sin vencimiento
}

// Todas las configuraciones de reglas
export interface AllRuleConfigs {
  CUPO_DIARIO: CupoDiarioConfig
  MAX_PROYECTADO: MaxProyectadoConfig
  FINES_SEMANA_MAX: number
  BLOQUE_EXCLUSIVO: BloqueExclusivoConfig
  LISTA_ESPERA: ListaEsperaConfig
  PLAZO_SOLICITUD: PlazoSolicitudConfig
  ROTACION_OBLIGATORIA: RotacionObligatoriaConfig
  COBERTURA_EXTERNA: { criterio: "MAS_ROTATIVOS" | "MENOS_ROTATIVOS" }
  LICENCIAS: { calculoPromedio: boolean }
  INTEGRANTE_NUEVO: { usarPromedio: boolean; adminOverride: boolean }
  ALERTA_UMBRAL: number
}
