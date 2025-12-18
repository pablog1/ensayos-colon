import { describe, it, expect } from "vitest"
import { maxProyectadoRule } from "@/lib/rules/implementations/max-proyectado"
import { createMockContext, createMockConfig } from "../helpers/mocks"

describe("R2: Máximo Proyectado Anual", () => {
  it("debe aprobar cuando está dentro del límite", async () => {
    const context = createMockContext({
      userBalance: {
        rotativosTomados: 30,
        rotativosObligatorios: 5,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig({ baseAnual: 50 })

    const result = await maxProyectadoRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.suggestedAction).toBe("APPROVE")
    expect(result.details?.totalConNuevo).toBe(36)
  })

  it("debe requerir aprobación admin cuando excede límite", async () => {
    const context = createMockContext({
      userBalance: {
        rotativosTomados: 48,
        rotativosObligatorios: 2,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig({ baseAnual: 50 })

    const result = await maxProyectadoRule.validate(context, config)

    expect(result.passed).toBe(false)
    expect(result.blocking).toBe(false) // No bloquea, pero requiere aprobación
    expect(result.suggestedAction).toBe("PENDING_ADMIN")
    expect(result.message).toContain("Excede máximo proyectado")
  })

  it("debe usar máximo ajustado por admin si existe", async () => {
    const context = createMockContext({
      userBalance: {
        rotativosTomados: 55,
        rotativosObligatorios: 0,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        maxAjustadoManual: 60, // Admin aumentó el límite
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig({ baseAnual: 50 })

    const result = await maxProyectadoRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.details?.maxProyectado).toBe(60)
  })

  it("debe permitir exceder para rotación obligatoria", async () => {
    const context = createMockContext({
      requestType: "OBLIGATORIO",
      userBalance: {
        rotativosTomados: 55,
        rotativosObligatorios: 5,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig({ baseAnual: 50 })

    const result = await maxProyectadoRule.validate(context, config)

    expect(result.passed).toBe(true)
    expect(result.suggestedAction).toBe("APPROVE")
    expect(result.message).toContain("Rotación obligatoria puede exceder")
  })

  it("debe incluir rotativos por licencia en el cálculo", async () => {
    const context = createMockContext({
      userBalance: {
        rotativosTomados: 40,
        rotativosObligatorios: 5,
        rotativosPorLicencia: 5,
        maxProyectado: 50,
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig({ baseAnual: 50 })

    const result = await maxProyectadoRule.validate(context, config)

    expect(result.details?.totalActual).toBe(50)
    expect(result.details?.totalConNuevo).toBe(51)
    expect(result.passed).toBe(false)
  })

  it("debe mostrar porcentaje correcto", async () => {
    const context = createMockContext({
      userBalance: {
        rotativosTomados: 45,
        rotativosObligatorios: 0,
        rotativosPorLicencia: 0,
        maxProyectado: 50,
        finesDeSemanaMes: {},
        bloqueUsado: false,
      },
    })
    const config = createMockConfig({ baseAnual: 50 })

    const result = await maxProyectadoRule.validate(context, config)

    expect(result.details?.porcentajeUsado).toBeCloseTo(92, 0) // (46/50)*100
  })
})
