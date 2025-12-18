import { describe, it, expect } from "vitest"
import { alertaCercaniaRule } from "@/lib/rules/implementations/alerta-cercania"
import { createMockContext, createMockConfig } from "../helpers/mocks"

describe("R11: Alerta de Cercanía al Máximo", () => {
  it("debe activar alerta al 90% del máximo", async () => {
    const context = createMockContext({
      userBalance: {
        rotativosTomados: 44, // Con +1 = 45 = 90%
        rotativosObligatorios: 0,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig(90)

    const result = await alertaCercaniaRule.validate(context, config)

    expect(result.passed).toBe(true) // Nunca bloquea
    expect(result.blocking).toBe(false)
    expect(result.details?.superaUmbral).toBe(true)
    expect(result.details?.porcentajeConNuevo).toBeCloseTo(90, 0)
    expect(result.details?.nivelAlerta).toBe("LIMITE")
  })

  it("NO debe activar alerta bajo el umbral", async () => {
    const context = createMockContext({
      userBalance: {
        rotativosTomados: 40,
        rotativosObligatorios: 0,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig(90)

    const result = await alertaCercaniaRule.validate(context, config)

    expect(result.details?.superaUmbral).toBe(false)
    expect(result.details?.porcentajeActual).toBe(80)
    expect(result.details?.nivelAlerta).toBe("NINGUNA")
  })

  it("debe usar umbral configurable", async () => {
    const context = createMockContext({
      userBalance: {
        rotativosTomados: 37, // Con +1 = 38 = 76%
        rotativosObligatorios: 0,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig(75) // Umbral más bajo

    const result = await alertaCercaniaRule.validate(context, config)

    expect(result.details?.superaUmbral).toBe(true)
    expect(result.details?.umbral).toBe(75)
  })

  it("debe detectar exceso del máximo", async () => {
    const context = createMockContext({
      userBalance: {
        rotativosTomados: 50,
        rotativosObligatorios: 0,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig(90)

    const result = await alertaCercaniaRule.validate(context, config)

    expect(result.details?.superaMaximo).toBe(true)
    expect(result.details?.nivelAlerta).toBe("EXCESO")
    expect(result.message).toContain("Excedes el máximo")
  })

  it("debe calcular restantes correctamente", async () => {
    const context = createMockContext({
      userBalance: {
        rotativosTomados: 40,
        rotativosObligatorios: 0,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig(90)

    const result = await alertaCercaniaRule.validate(context, config)

    expect(result.details?.restantesHastaMaximo).toBe(9) // 50 - 41
    expect(result.details?.restantesHastaUmbral).toBe(5) // 45 - 40
  })

  it("siempre debe aprobar (nunca bloquea)", async () => {
    const context = createMockContext({
      userBalance: {
        rotativosTomados: 100,
        rotativosObligatorios: 0,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig(90)

    const result = await alertaCercaniaRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.blocking).toBe(false)
    expect(result.suggestedAction).toBe("APPROVE")
  })
})
