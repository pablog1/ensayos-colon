import type { ValidationContext, RuleConfigValue } from "@/lib/rules/types"
import type { EventType, RotativoTipo } from "@/generated/prisma"

export function createMockContext(
  overrides: Partial<ValidationContext> = {}
): ValidationContext {
  const defaultContext: ValidationContext = {
    userId: "user-1",
    eventId: "event-1",
    seasonId: "season-1",
    requestType: "VOLUNTARIO" as RotativoTipo,
    requestDate: new Date(),
    eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    eventType: "OPERA" as EventType,
    isWeekend: false,
    isPartOfBlock: false,

    userBalance: {
      rotativosTomados: 10,
      rotativosObligatorios: 2,
      rotativosPorLicencia: 0,
      maxProyectado: 50,
      maxAjustadoManual: undefined,
      finesDeSemanaMes: {},
      bloqueUsado: false,
      fechaIngreso: undefined,
    },

    eventData: {
      currentApproved: 2,
      cupoTotal: 4,
      waitingListLength: 0,
    },

    seasonData: {
      workingDays: 250,
      totalIntegrantes: 15,
      promedioRotativos: 10,
    },
  }

  // Deep merge for nested objects
  return {
    ...defaultContext,
    ...overrides,
    userBalance: {
      ...defaultContext.userBalance,
      ...(overrides.userBalance || {}),
    },
    eventData: {
      ...defaultContext.eventData,
      ...(overrides.eventData || {}),
    },
    seasonData: {
      ...defaultContext.seasonData,
      ...(overrides.seasonData || {}),
    },
  }
}

export function createMockConfig(
  value: unknown,
  overrides: Partial<RuleConfigValue> = {}
): RuleConfigValue {
  return {
    enabled: true,
    value,
    priority: 100,
    ...overrides,
  }
}

export function createMockEvent(overrides: Partial<{
  id: string
  title: string
  eventType: EventType
  date: Date
  seasonId: string
  blockId: string | null
}> = {}) {
  return {
    id: "event-1",
    title: "La Traviata",
    eventType: "OPERA" as EventType,
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    seasonId: "season-1",
    blockId: null,
    ...overrides,
  }
}

export function createMockUser(overrides: Partial<{
  id: string
  name: string
  email: string
  role: "ADMIN" | "INTEGRANTE"
}> = {}) {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: "INTEGRANTE" as const,
    ...overrides,
  }
}

export function createMockBalance(overrides: Partial<{
  userId: string
  seasonId: string
  rotativosTomados: number
  rotativosObligatorios: number
  rotativosPorLicencia: number
  maxProyectado: number
  maxAjustadoManual: number | null
  finesDeSemanaMes: Record<string, number>
  bloqueUsado: boolean
}> = {}) {
  return {
    userId: "user-1",
    seasonId: "season-1",
    rotativosTomados: 10,
    rotativosObligatorios: 2,
    rotativosPorLicencia: 0,
    maxProyectado: 50,
    maxAjustadoManual: null,
    finesDeSemanaMes: {},
    bloqueUsado: false,
    ...overrides,
  }
}
