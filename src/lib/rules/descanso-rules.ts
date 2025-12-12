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

export interface ValidacionResult {
  autoApprove: boolean
  esCasoEspecial: boolean
  porcentaje: number
  mensaje: string
}

/**
 * Obtiene el inicio y fin de un mes
 */
function getRangoMes(fecha: Date): { inicioMes: Date; finMes: Date } {
  const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1)
  const finMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)
  return { inicioMes, finMes }
}

/**
 * Calcula el promedio de descansos del grupo para un mes especifico
 */
export async function calcularPromedioGrupo(mes: Date): Promise<number> {
  const { inicioMes, finMes } = getRangoMes(mes)

  const totalIntegrantes = await prisma.user.count({
    where: { role: "INTEGRANTE" },
  })

  if (totalIntegrantes === 0) return 0

  const totalDescansos = await prisma.solicitud.count({
    where: {
      fecha: {
        gte: inicioMes,
        lte: finMes,
      },
      estado: "APROBADA",
    },
  })

  return totalDescansos / totalIntegrantes
}

/**
 * Calcula estadisticas de descanso para un usuario
 */
export async function calcularEstadisticasUsuario(
  userId: string,
  mes: Date
): Promise<DescansoStats> {
  const { inicioMes, finMes } = getRangoMes(mes)

  const descansosAprobados = await prisma.solicitud.count({
    where: {
      userId,
      fecha: { gte: inicioMes, lte: finMes },
      estado: "APROBADA",
    },
  })

  const promedioGrupo = await calcularPromedioGrupo(mes)
  const limiteMaximo = promedioGrupo * 1.05

  const porcentajeVsPromedio =
    promedioGrupo > 0
      ? ((descansosAprobados - promedioGrupo) / promedioGrupo) * 100
      : descansosAprobados > 0
        ? 100
        : 0

  // Si el promedio es 0, siempre puede solicitar sin aprobación
  // Si hay promedio, verificar que no supere el límite del 5%
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
 * Valida si una solicitud puede ser aprobada automaticamente
 */
export async function validarSolicitud(
  userId: string,
  fecha: Date
): Promise<ValidacionResult> {
  const mes = new Date(fecha.getFullYear(), fecha.getMonth(), 1)
  const stats = await calcularEstadisticasUsuario(userId, mes)

  const descansosConNuevo = stats.descansosAprobados + 1
  const superaLimite = descansosConNuevo > stats.limiteMaximo

  const nuevoPorcentaje =
    stats.promedioGrupo > 0
      ? ((descansosConNuevo - stats.promedioGrupo) / stats.promedioGrupo) * 100
      : 100

  if (superaLimite) {
    return {
      autoApprove: false,
      esCasoEspecial: true,
      porcentaje: nuevoPorcentaje,
      mensaje: `Esta solicitud excede el limite del 5% (${nuevoPorcentaje.toFixed(1)}% sobre el promedio). Requiere aprobacion del administrador.`,
    }
  }

  return {
    autoApprove: true,
    esCasoEspecial: false,
    porcentaje: nuevoPorcentaje,
    mensaje: "Solicitud dentro del limite permitido. Aprobada automaticamente.",
  }
}

/**
 * Obtiene estadisticas generales del mes para todos los integrantes
 */
export async function obtenerEstadisticasGenerales(mes: Date) {
  const { inicioMes, finMes } = getRangoMes(mes)

  const integrantes = await prisma.user.findMany({
    where: { role: "INTEGRANTE" },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

  const promedioGrupo = await calcularPromedioGrupo(mes)
  const limiteMaximo = promedioGrupo * 1.05

  const solicitudesPendientes = await prisma.solicitud.count({
    where: {
      fecha: { gte: inicioMes, lte: finMes },
      estado: "PENDIENTE",
      esCasoEspecial: true,
    },
  })

  const estadisticasPorIntegrante = await Promise.all(
    integrantes.map(async (integrante) => {
      const descansosAprobados = await prisma.solicitud.count({
        where: {
          userId: integrante.id,
          fecha: { gte: inicioMes, lte: finMes },
          estado: "APROBADA",
        },
      })

      const porcentajeVsPromedio =
        promedioGrupo > 0
          ? ((descansosAprobados - promedioGrupo) / promedioGrupo) * 100
          : 0

      return {
        id: integrante.id,
        nombre: integrante.name,
        email: integrante.email,
        descansosAprobados,
        porcentajeVsPromedio: Math.round(porcentajeVsPromedio * 100) / 100,
        puedesolicitarMas: descansosAprobados < limiteMaximo,
      }
    })
  )

  return {
    mes: mes.toISOString().slice(0, 7),
    totalIntegrantes: integrantes.length,
    promedioDescansos: Math.round(promedioGrupo * 100) / 100,
    limiteMaximo: Math.round(limiteMaximo * 100) / 100,
    solicitudesPendientes,
    integrantes: estadisticasPorIntegrante,
  }
}
