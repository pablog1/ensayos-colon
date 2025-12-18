import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { plazoSolicitudRule } from "@/lib/rules/implementations/plazo-solicitud"
import { createMockContext, createMockConfig } from "../helpers/mocks"

describe("R6: Plazo de Solicitud", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("debe requerir aprobación manual si es mismo día", async () => {
    vi.setSystemTime(new Date("2024-03-15T10:00:00"))
    const context = createMockContext({
      eventDate: new Date("2024-03-15T20:00:00"), // Mismo día en hora local
    })
    const config = createMockConfig({
      mismoDia: "PENDING_ADMIN",
      diaAnterior: "APPROVE",
    })

    const result = await plazoSolicitudRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.suggestedAction).toBe("PENDING_ADMIN")
    expect(result.details?.esMismoDia).toBe(true)
    expect(result.message).toContain("mismo día")
  })

  it("debe permitir auto-aprobación si es día anterior", async () => {
    vi.setSystemTime(new Date("2024-03-14T10:00:00"))
    const context = createMockContext({
      eventDate: new Date("2024-03-15T20:00:00"), // Día siguiente en hora local
    })
    const config = createMockConfig({
      mismoDia: "PENDING_ADMIN",
      diaAnterior: "APPROVE",
    })

    const result = await plazoSolicitudRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.suggestedAction).toBe("APPROVE")
    expect(result.details?.diasAnticipacion).toBe(1)
  })

  it("debe permitir con varios días de anticipación", async () => {
    vi.setSystemTime(new Date("2024-03-10T10:00:00"))
    const context = createMockContext({
      eventDate: new Date("2024-03-15T20:00:00"), // 5 días después en hora local
    })
    const config = createMockConfig({
      mismoDia: "PENDING_ADMIN",
      diaAnterior: "APPROVE",
    })

    const result = await plazoSolicitudRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.details?.diasAnticipacion).toBe(5)
    expect(result.details?.requiereAprobacion).toBe(false)
  })

  it("debe rechazar fechas pasadas", async () => {
    vi.setSystemTime(new Date("2024-03-15T10:00:00"))
    const context = createMockContext({
      eventDate: new Date("2024-03-10T20:00:00"), // 5 días antes en hora local
    })
    const config = createMockConfig({
      mismoDia: "PENDING_ADMIN",
      diaAnterior: "APPROVE",
    })

    const result = await plazoSolicitudRule.validate(context, config)

    expect(result.passed).toBe(false)
    expect(result.blocking).toBe(true)
    expect(result.suggestedAction).toBe("REJECT")
    expect(result.details?.esFechaPasada).toBe(true)
  })

  it("debe usar configuración por defecto si no hay config", async () => {
    vi.setSystemTime(new Date("2024-03-15T10:00:00"))
    const context = createMockContext({
      eventDate: new Date("2024-03-15T20:00:00"), // Mismo día en hora local
    })
    const config = createMockConfig(null)

    const result = await plazoSolicitudRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.suggestedAction).toBe("PENDING_ADMIN")
  })
})
