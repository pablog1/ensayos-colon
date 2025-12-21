import { prisma } from "@/lib/prisma"

export interface DescansoStats {
  userId: string
  mes: Date
  descansosAprobados: number
  promedioGrupo: number
  limiteMaximo: number
  porcentajeVsPromedio: number
  puedesolicitarSinAprobacion: boolean
  descansosRestantesPermitidos: number
}


/**
 * Obtiene todos los rotativos de un mes (ambos sistemas) de una sola vez
 * Más eficiente que hacer queries individuales por usuario
 */
async function obtenerRotativosMes(mesStr: string) {
  // mesStr formato: "2025-12"
  const [year, month] = mesStr.split('-').map(Number)

  // Crear fechas en UTC para evitar problemas de timezone
  const inicioMes = new Date(Date.UTC(year, month - 1, 1))
  const finMes = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  // Solicitudes antiguas aprobadas
  const solicitudes = await prisma.solicitud.findMany({
    where: {
      fecha: { gte: inicioMes, lte: finMes },
      estado: "APROBADA",
    },
    select: { userId: true },
  })

  // Rotativos nuevos - buscar TODOS y filtrar después
  const rotativos = await prisma.rotativo.findMany({
    where: {
      estado: "APROBADO",
    },
    select: {
      userId: true,
      event: {
        select: { date: true },
      },
    },
  })

  // Filtrar rotativos por mes del evento usando string comparison (evita problemas de timezone)
  const rotativosFiltrados = rotativos.filter(r => {
    const eventDateStr = r.event.date.toISOString().substring(0, 7) // YYYY-MM
    return eventDateStr === mesStr
  })

  // Agrupar por userId
  const porUsuario: Record<string, number> = {}

  for (const s of solicitudes) {
    porUsuario[s.userId] = (porUsuario[s.userId] || 0) + 1
  }

  for (const r of rotativosFiltrados) {
    porUsuario[r.userId] = (porUsuario[r.userId] || 0) + 1
  }

  const totalRotativos = solicitudes.length + rotativosFiltrados.length

  return { porUsuario, totalRotativos }
}

/**
 * Convierte una fecha a string YYYY-MM
 */
function fechaAMesStr(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Calcula estadisticas de descanso para un usuario
 */
export async function calcularEstadisticasUsuario(
  userId: string,
  mes: Date
): Promise<DescansoStats> {
  const mesStr = fechaAMesStr(mes)

  // Obtener todos los rotativos del mes de una sola vez
  const { porUsuario, totalRotativos } = await obtenerRotativosMes(mesStr)
  const totalUsuarios = await prisma.user.count()

  const descansosAprobados = porUsuario[userId] || 0
  const promedioGrupo = totalUsuarios > 0 ? totalRotativos / totalUsuarios : 0
  const limiteMaximo = promedioGrupo * 1.05

  const porcentajeVsPromedio =
    promedioGrupo > 0
      ? ((descansosAprobados - promedioGrupo) / promedioGrupo) * 100
      : descansosAprobados > 0
        ? 100
        : 0

  // Si el promedio es 0, siempre puede solicitar sin aprobación
  // Si hay promedio, verificar que no supere el límite máximo
  const puedesolicitarSinAprobacion =
    promedioGrupo === 0 || descansosAprobados < limiteMaximo
  const descansosRestantesPermitidos =
    promedioGrupo === 0
      ? Infinity
      : Math.max(0, limiteMaximo - descansosAprobados)

  return {
    userId,
    mes,
    descansosAprobados,
    promedioGrupo,
    limiteMaximo,
    porcentajeVsPromedio,
    puedesolicitarSinAprobacion,
    descansosRestantesPermitidos,
  }
}

/**
 * Obtiene estadisticas generales del mes para todos los usuarios
 * @param mesStr - Formato "YYYY-MM" (ej: "2025-12")
 */
export async function obtenerEstadisticasGenerales(mesStr: string) {
  const [year, month] = mesStr.split('-').map(Number)
  const inicioMes = new Date(Date.UTC(year, month - 1, 1))
  const finMes = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  // Obtener TODOS los usuarios (ADMIN e INTEGRANTE)
  const usuarios = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      alias: true,
      role: true,
    },
    orderBy: { name: "asc" },
  })

  // Obtener todos los rotativos del mes de una sola vez (optimizado)
  const { porUsuario, totalRotativos } = await obtenerRotativosMes(mesStr)

  const promedioGrupo = usuarios.length > 0 ? totalRotativos / usuarios.length : 0
  const limiteMaximo = promedioGrupo * 1.05

  // Contar solicitudes pendientes (sistema antiguo)
  const solicitudesPendientes = await prisma.solicitud.count({
    where: {
      fecha: { gte: inicioMes, lte: finMes },
      estado: "PENDIENTE",
      esCasoEspecial: true,
    },
  })

  // Mapear usuarios con sus estadísticas (sin queries adicionales)
  const estadisticasPorUsuario = usuarios.map((usuario) => {
    const descansosAprobados = porUsuario[usuario.id] || 0

    const porcentajeVsPromedio =
      promedioGrupo > 0
        ? ((descansosAprobados - promedioGrupo) / promedioGrupo) * 100
        : 0

    return {
      id: usuario.id,
      nombre: usuario.alias || usuario.name,
      email: usuario.email,
      role: usuario.role,
      descansosAprobados,
      porcentajeVsPromedio: Math.round(porcentajeVsPromedio * 100) / 100,
      puedesolicitarMas: descansosAprobados < limiteMaximo,
    }
  })

  // Ordenar por rotativos (mayor a menor)
  estadisticasPorUsuario.sort((a, b) => b.descansosAprobados - a.descansosAprobados)

  return {
    mes: mesStr,
    totalIntegrantes: usuarios.length,
    promedioDescansos: Math.round(promedioGrupo * 100) / 100,
    limiteMaximo: Math.round(limiteMaximo * 100) / 100,
    solicitudesPendientes,
    integrantes: estadisticasPorUsuario,
  }
}
