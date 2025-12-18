import { describe, it, expect } from "vitest"
import { finesSemanasRule } from "@/lib/rules/implementations/fines-semana"
import { createMockContext, createMockConfig } from "../helpers/mocks"

describe("R3: Restricción de Fines de Semana", () => {
  it("debe permitir primer fin de semana del mes", async () => {
    const context = createMockContext({
      isWeekend: true,
      eventDate: new Date("2024-03-16"), // Sábado
      userBalance: {
        rotativosTomados: 10,
        rotativosObligatorios: 2,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: { "2024-03": 0 },
        bloqueUsado: false,
      },
    })
    const config = createMockConfig(1)

    const result = await finesSemanasRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.blocking).toBe(false)
    expect(result.suggestedAction).toBe("APPROVE")
  })

  it("debe rechazar segundo fin de semana del mismo mes", async () => {
    const context = createMockContext({
      isWeekend: true,
      eventDate: new Date("2024-03-23"),
      userBalance: {
        rotativosTomados: 10,
        rotativosObligatorios: 2,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: { "2024-03": 1 },
        bloqueUsado: false,
      },
    })
    const config = createMockConfig(1)

    const result = await finesSemanasRule.validate(context, config)

    expect(result.passed).toBe(false)
    expect(result.blocking).toBe(true)
    expect(result.suggestedAction).toBe("REJECT")
    expect(result.message).toContain("Límite de fines de semana alcanzado")
  })

  it("debe permitir fin de semana de otro mes", async () => {
    const context = createMockContext({
      isWeekend: true,
      eventDate: new Date("2024-04-06"),
      userBalance: {
        rotativosTomados: 10,
        rotativosObligatorios: 2,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: { "2024-03": 1 },
        bloqueUsado: false,
      },
    })
    const config = createMockConfig(1)

    const result = await finesSemanasRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.details?.mes).toBe("2024-04")
  })

  it("NO debe aplicar para bloques", async () => {
    const context = createMockContext({
      isWeekend: true,
      isPartOfBlock: true,
      eventDate: new Date("2024-03-23"),
      userBalance: {
        rotativosTomados: 10,
        rotativosObligatorios: 2,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: { "2024-03": 1 },
        bloqueUsado: false,
      },
    })
    const config = createMockConfig(1)

    const result = await finesSemanasRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.message).toContain("no aplica para bloques")
    expect(result.details?.esBloque).toBe(true)
  })

  it("debe pasar si no es fin de semana", async () => {
    const context = createMockContext({
      isWeekend: false,
      eventDate: new Date("2024-03-20"), // Miércoles
    })
    const config = createMockConfig(1)

    const result = await finesSemanasRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.details?.esFinDeSemana).toBe(false)
  })

  it("debe permitir con límite configurable mayor", async () => {
    const context = createMockContext({
      isWeekend: true,
      eventDate: new Date("2024-03-23"),
      userBalance: {
        rotativosTomados: 10,
        rotativosObligatorios: 2,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: { "2024-03": 1 },
        bloqueUsado: false,
      },
    })
    const config = createMockConfig(2) // 2 fines de semana permitidos

    const result = await finesSemanasRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.details?.disponibles).toBe(1)
  })
})
