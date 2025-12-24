import { prisma } from "@/lib/prisma"

export type CupoDiarioConfig = {
  OPERA: number
  CONCIERTO: number
  BALLET: number
  [key: string]: number
}

const DEFAULT_CUPOS: CupoDiarioConfig = {
  OPERA: 4,
  CONCIERTO: 2,
  BALLET: 4,
}

// Cache para no hacer query cada vez
let cuposCache: CupoDiarioConfig | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 60000 // 1 minuto

/**
 * Obtiene los cupos configurados desde las reglas
 */
export async function getCuposFromRules(): Promise<CupoDiarioConfig> {
  const now = Date.now()

  // Usar cache si es válido
  if (cuposCache && (now - cacheTimestamp) < CACHE_TTL) {
    return cuposCache
  }

  try {
    const config = await prisma.ruleConfig.findUnique({
      where: { key: "CUPO_DIARIO" },
    })

    if (config?.value) {
      const parsed = JSON.parse(config.value)
      const result: CupoDiarioConfig = { ...DEFAULT_CUPOS, ...parsed }
      cuposCache = result
      cacheTimestamp = now
      return result
    }
  } catch (error) {
    console.error("Error obteniendo cupos de reglas:", error)
  }

  return DEFAULT_CUPOS
}

/**
 * Obtiene el cupo para un evento específico basado en el tipo de título
 * Tanto ensayos como funciones de un mismo título usan el mismo cupo
 * @param tituloType - OPERA, CONCIERTO, BALLET, RECITAL, OTRO
 */
export async function getCupoParaEvento(
  _eventoType: "ENSAYO" | "FUNCION" | null,
  tituloType: string | null
): Promise<number> {
  const cupos = await getCuposFromRules()

  // Usar cupo según tipo de título (tanto para ensayos como funciones)
  if (tituloType) {
    const tipoMap: Record<string, string> = {
      OPERA: "OPERA",
      CONCIERTO: "CONCIERTO",
      BALLET: "BALLET",
      RECITAL: "CONCIERTO", // Recital usa mismo cupo que concierto
      OTRO: "BALLET", // Fallback a Ballet
    }
    const cupoKey = tipoMap[tituloType] || "BALLET"
    return cupos[cupoKey] ?? cupos.BALLET
  }

  // Default
  return cupos.BALLET
}

/**
 * Invalida el cache de cupos (llamar cuando se modifican las reglas)
 */
export function invalidateCuposCache() {
  cuposCache = null
  cacheTimestamp = 0
}
