import { prisma } from "@/lib/prisma"

export type CupoDiarioConfig = {
  OPERA: number
  CONCIERTO: number
  ENSAYO: number
  ENSAYO_DOBLE: number
  OTRO: number
  [key: string]: number
}

const DEFAULT_CUPOS: CupoDiarioConfig = {
  OPERA: 4,
  CONCIERTO: 2,
  ENSAYO: 2,
  ENSAYO_DOBLE: 2,
  OTRO: 2,
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
 * Obtiene el cupo para un evento específico
 * @param eventoType - ENSAYO o FUNCION
 * @param tituloType - OPERA, CONCIERTO, BALLET, RECITAL, OTRO
 * @param isDoble - Si es ensayo doble
 */
export async function getCupoParaEvento(
  eventoType: "ENSAYO" | "FUNCION" | null,
  tituloType: string | null,
  isDoble: boolean = false
): Promise<number> {
  const cupos = await getCuposFromRules()

  // Si es ensayo, usar cupo de ENSAYO o ENSAYO_DOBLE
  if (eventoType === "ENSAYO") {
    return isDoble ? cupos.ENSAYO_DOBLE : cupos.ENSAYO
  }

  // Si es función, usar cupo según tipo de título
  if (eventoType === "FUNCION" && tituloType) {
    // Mapear tipos de título a tipos de cupo
    const tipoMap: Record<string, string> = {
      OPERA: "OPERA",
      CONCIERTO: "CONCIERTO",
      BALLET: "OPERA", // Ballet usa mismo cupo que ópera
      RECITAL: "CONCIERTO", // Recital usa mismo cupo que concierto
      OTRO: "OTRO",
    }
    const cupoKey = tipoMap[tituloType] || "OTRO"
    return cupos[cupoKey] ?? cupos.OTRO
  }

  // Default
  return cupos.OTRO
}

/**
 * Invalida el cache de cupos (llamar cuando se modifican las reglas)
 */
export function invalidateCuposCache() {
  cuposCache = null
  cacheTimestamp = 0
}
