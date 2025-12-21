import { describe, it, expect } from "vitest"
import { cupoDiarioRule } from "@/lib/rules/implementations/cupo-diario"
import { createMockContext, createMockConfig } from "../helpers/mocks"

describe("R1: Cupo Diario", () => {
  const defaultCupos = {
    OPERA: 4,
    CONCIERTO: 2,
    ENSAYO: 4,
    BALLET: 4,
  }

  describe("Opera (4 cupos)", () => {
    it("debe permitir cuando hay cupo disponible (0/4)", async () => {
      const context = createMockContext({
        eventType: "OPERA",
        eventData: { currentApproved: 0, cupoTotal: 4, waitingListLength: 0 },
      })
      const config = createMockConfig(defaultCupos)

      const result = await cupoDiarioRule.validate(context, config)

      expect(result.passed).toBe(true)
      expect(result.blocking).toBe(false)
      expect(result.suggestedAction).toBe("APPROVE")
      expect(result.details?.cupoDisponible).toBe(4)
    })

    it("debe permitir cuando hay 3/4 cupos usados", async () => {
      const context = createMockContext({
        eventType: "OPERA",
        eventData: { currentApproved: 3, cupoTotal: 4, waitingListLength: 0 },
      })
      const config = createMockConfig(defaultCupos)

      const result = await cupoDiarioRule.validate(context, config)

      expect(result.passed).toBe(true)
      expect(result.details?.cupoDisponible).toBe(1)
    })

    it("debe rechazar y sugerir lista de espera cuando cupo lleno (4/4)", async () => {
      const context = createMockContext({
        eventType: "OPERA",
        eventData: { currentApproved: 4, cupoTotal: 4, waitingListLength: 0 },
      })
      const config = createMockConfig(defaultCupos)

      const result = await cupoDiarioRule.validate(context, config)

      expect(result.passed).toBe(false)
      expect(result.blocking).toBe(true)
      expect(result.suggestedAction).toBe("WAITING_LIST")
      expect(result.details?.cupoDisponible).toBe(0)
    })

    it("debe mostrar mensaje correcto cuando hay exceso de solicitudes", async () => {
      const context = createMockContext({
        eventType: "OPERA",
        eventData: { currentApproved: 5, cupoTotal: 4, waitingListLength: 2 },
      })
      const config = createMockConfig(defaultCupos)

      const result = await cupoDiarioRule.validate(context, config)

      expect(result.passed).toBe(false)
      expect(result.message).toContain("Cupo lleno")
    })
  })

  describe("Concierto (2 cupos)", () => {
    it("debe permitir cuando hay cupo disponible (0/2)", async () => {
      const context = createMockContext({
        eventType: "CONCIERTO",
        eventData: { currentApproved: 0, cupoTotal: 2, waitingListLength: 0 },
      })
      const config = createMockConfig(defaultCupos)

      const result = await cupoDiarioRule.validate(context, config)

      expect(result.passed).toBe(true)
      expect(result.details?.cupoTotal).toBe(2)
    })

    it("debe rechazar cuando cupo lleno (2/2)", async () => {
      const context = createMockContext({
        eventType: "CONCIERTO",
        eventData: { currentApproved: 2, cupoTotal: 2, waitingListLength: 0 },
      })
      const config = createMockConfig(defaultCupos)

      const result = await cupoDiarioRule.validate(context, config)

      expect(result.passed).toBe(false)
      expect(result.blocking).toBe(true)
    })
  })

  describe("Cupos configurables", () => {
    it("debe usar cupos personalizados", async () => {
      const customCupos = { ...defaultCupos, OPERA: 6 }
      const context = createMockContext({
        eventType: "OPERA",
        eventData: { currentApproved: 5, cupoTotal: 6, waitingListLength: 0 },
      })
      const config = createMockConfig(customCupos)

      const result = await cupoDiarioRule.validate(context, config)

      expect(result.passed).toBe(true)
      expect(result.details?.cupoTotal).toBe(6)
    })

    it("debe usar valor por defecto si no hay configuracion", async () => {
      const context = createMockContext({
        eventType: "BALLET",
        eventData: { currentApproved: 0, cupoTotal: 4, waitingListLength: 0 },
      })
      const config = createMockConfig(null)

      const result = await cupoDiarioRule.validate(context, config)

      expect(result.passed).toBe(true)
    })
  })
})
