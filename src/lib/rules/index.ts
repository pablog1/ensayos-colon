import { registerRule, getRegisteredRules } from "./engine"
import { cupoDiarioRule } from "./implementations/cupo-diario"
import { maxProyectadoRule } from "./implementations/max-proyectado"
import { finesSemanasRule } from "./implementations/fines-semana"
import { bloqueExclusivoRule } from "./implementations/bloque-exclusivo"
import { listaEsperaRule } from "./implementations/lista-espera"
import { plazoSolicitudRule } from "./implementations/plazo-solicitud"
import { rotacionObligatoriaRule } from "./implementations/rotacion-obligatoria"
import { coberturaExternaRule } from "./implementations/cobertura-externa"
import { licenciasRule } from "./implementations/licencias"
import { integranteNuevoRule } from "./implementations/integrante-nuevo"
import { alertaCercaniaRule } from "./implementations/alerta-cercania"
import { ensayosDoblesRule } from "./implementations/ensayos-dobles"

let initialized = false

// Registrar todas las reglas
export function initializeRules(): void {
  if (initialized) return

  registerRule(cupoDiarioRule) // R1
  registerRule(maxProyectadoRule) // R2
  registerRule(finesSemanasRule) // R3
  registerRule(bloqueExclusivoRule) // R4
  registerRule(listaEsperaRule) // R5
  registerRule(plazoSolicitudRule) // R6
  registerRule(rotacionObligatoriaRule) // R7
  registerRule(coberturaExternaRule) // R8
  registerRule(licenciasRule) // R9
  registerRule(integranteNuevoRule) // R10
  registerRule(alertaCercaniaRule) // R11
  registerRule(ensayosDoblesRule) // R12

  initialized = true
}

// Obtener todas las reglas con su metadata para documentacion
export function getAllRulesMetadata() {
  initializeRules()
  return getRegisteredRules().map((rule) => ({
    id: rule.id,
    name: rule.name,
    description: rule.description,
    category: rule.category,
    priority: rule.priority,
    enabled: rule.enabled,
    configKey: rule.configKey,
  }))
}

// Re-exportar todo del engine
export * from "./engine"
export * from "./types"

// Exportar reglas individuales para testing
export {
  cupoDiarioRule,
  maxProyectadoRule,
  finesSemanasRule,
  bloqueExclusivoRule,
  listaEsperaRule,
  plazoSolicitudRule,
  rotacionObligatoriaRule,
  coberturaExternaRule,
  licenciasRule,
  integranteNuevoRule,
  alertaCercaniaRule,
  ensayosDoblesRule,
}
