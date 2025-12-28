import { PrismaClient, RotativoEstado, RotativoTipo } from "../../src/generated/prisma"

const prisma = new PrismaClient()

// Helper para obtener el mes en formato YYYY-MM
function getYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

// Helper para verificar si es fin de semana
function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // Domingo o Sábado
}

// Mezclar array aleatoriamente (Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Obtener número aleatorio entre min y max
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

interface UserStats {
  id: string
  name: string
  rotativosTomados: number
  maxTarget: number // 80% del máximo proyectado con variabilidad
  finesDeSemanaPorMes: Record<string, number>
}

interface EventWithTitulo {
  id: string
  title: string
  date: Date
  cupo: number
  rotativosAsignados: number
}

async function main() {
  console.log("==============================================")
  console.log("GENERADOR DE ROTATIVOS 2026")
  console.log("==============================================\n")

  // 1. Obtener todos los usuarios (integrantes)
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
  })

  console.log(`Total usuarios encontrados: ${users.length}`)

  // 2. Obtener temporada 2026
  const season2026 = await prisma.season.findFirst({
    where: { id: "season-2026" },
  })

  if (!season2026) {
    console.error("ERROR: No se encontró la temporada 2026. Ejecuta el seed de temporadas primero.")
    process.exit(1)
  }

  // 3. Obtener todos los eventos de 2026 con info de título
  const events = await prisma.event.findMany({
    where: {
      seasonId: season2026.id,
    },
    include: {
      titulo: true,
      rotativos: true,
    },
    orderBy: { date: "asc" },
  })

  console.log(`Total eventos en 2026: ${events.length}`)

  // 4. Calcular cupos totales disponibles
  let totalCupos = 0
  const eventosConCupo: EventWithTitulo[] = events.map((e) => {
    const cupo = e.cupoOverride ?? e.titulo?.cupo ?? 4
    totalCupos += cupo
    return {
      id: e.id,
      title: e.title,
      date: e.date,
      cupo,
      rotativosAsignados: e.rotativos.length,
    }
  })

  console.log(`Total cupos disponibles: ${totalCupos}`)

  // 5. Calcular máximo proyectado por persona
  const maxProyectado = Math.floor(totalCupos / users.length)
  console.log(`Máximo proyectado por persona: ~${maxProyectado}`)
  console.log(`Objetivo ~80%: ~${Math.floor(maxProyectado * 0.8)}`)

  // 6. Inicializar estadísticas por usuario con variabilidad (75-85%)
  const userStats: Map<string, UserStats> = new Map()
  for (const user of users) {
    // Variabilidad: entre 70% y 88% del máximo proyectado
    const porcentaje = randomBetween(70, 88) / 100
    const maxTarget = Math.floor(maxProyectado * porcentaje)

    userStats.set(user.id, {
      id: user.id,
      name: user.name,
      rotativosTomados: 0,
      maxTarget,
      finesDeSemanaPorMes: {},
    })
  }

  // Mostrar targets asignados
  console.log("\nTargets por integrante (variabilidad 70-88%):")
  for (const [, stats] of userStats) {
    console.log(`  ${stats.name}: ${stats.maxTarget} rotativos`)
  }

  // 7. Asignar rotativos respetando reglas
  console.log("\n--- Iniciando asignación de rotativos ---\n")

  let totalRotativosCreados = 0
  const rotativosACrear: Array<{
    userId: string
    eventId: string
    estado: RotativoEstado
    tipo: RotativoTipo
  }> = []

  // Mezclar eventos para distribuir mejor
  const eventosShuffled = shuffle(eventosConCupo)

  for (const evento of eventosShuffled) {
    const fechaEvento = new Date(evento.date)
    const mesEvento = getYearMonth(fechaEvento)
    const esFinDeSemana = isWeekend(fechaEvento)

    // Cuántos cupos quedan por llenar en este evento
    let cuposRestantes = evento.cupo - evento.rotativosAsignados

    if (cuposRestantes <= 0) continue

    // Obtener usuarios elegibles para este evento
    const usuariosElegibles = shuffle(
      Array.from(userStats.values()).filter((u) => {
        // Ya completó su target?
        if (u.rotativosTomados >= u.maxTarget) return false

        // Si es fin de semana, verificar que no haya tomado uno este mes
        if (esFinDeSemana) {
          const finesDeSemanaEsteMes = u.finesDeSemanaPorMes[mesEvento] || 0
          if (finesDeSemanaEsteMes >= 1) return false
        }

        return true
      })
    )

    // Asignar usuarios al evento (hasta llenar cupos)
    for (const usuario of usuariosElegibles) {
      if (cuposRestantes <= 0) break

      // Verificar que no tenga ya un rotativo en este evento
      const yaAsignado = rotativosACrear.some(
        (r) => r.userId === usuario.id && r.eventId === evento.id
      )
      if (yaAsignado) continue

      // Crear el rotativo
      rotativosACrear.push({
        userId: usuario.id,
        eventId: evento.id,
        estado: RotativoEstado.APROBADO,
        tipo: RotativoTipo.VOLUNTARIO,
        // Sin motivo para que se vea como solicitud manual
      })

      // Actualizar estadísticas
      usuario.rotativosTomados++
      if (esFinDeSemana) {
        usuario.finesDeSemanaPorMes[mesEvento] = (usuario.finesDeSemanaPorMes[mesEvento] || 0) + 1
      }

      cuposRestantes--
      totalRotativosCreados++
    }
  }

  console.log(`Total rotativos a crear: ${totalRotativosCreados}`)

  // 8. Crear rotativos en la base de datos (en lotes)
  console.log("\nGuardando en base de datos...")

  const batchSize = 100
  for (let i = 0; i < rotativosACrear.length; i += batchSize) {
    const batch = rotativosACrear.slice(i, i + batchSize)

    for (const rotativo of batch) {
      try {
        await prisma.rotativo.create({
          data: rotativo,
        })
      } catch (error) {
        // Ignorar duplicados
      }
    }

    console.log(`  Procesados ${Math.min(i + batchSize, rotativosACrear.length)}/${rotativosACrear.length}`)
  }

  // 9. Crear/actualizar balances de usuario
  console.log("\nActualizando balances de usuarios...")

  for (const [userId, stats] of userStats) {
    await prisma.userSeasonBalance.upsert({
      where: {
        userId_seasonId: {
          userId,
          seasonId: season2026.id,
        },
      },
      update: {
        rotativosTomados: stats.rotativosTomados,
        maxProyectado: maxProyectado,
        finesDeSemanaMes: stats.finesDeSemanaPorMes,
      },
      create: {
        userId,
        seasonId: season2026.id,
        rotativosTomados: stats.rotativosTomados,
        maxProyectado: maxProyectado,
        finesDeSemanaMes: stats.finesDeSemanaPorMes,
      },
    })
  }

  // 10. Resumen final
  console.log("\n==============================================")
  console.log("RESUMEN FINAL")
  console.log("==============================================")

  console.log("\nRotativos asignados por integrante:")
  const statsArray = Array.from(userStats.values()).sort((a, b) => b.rotativosTomados - a.rotativosTomados)

  for (const stats of statsArray) {
    const porcentaje = Math.round((stats.rotativosTomados / maxProyectado) * 100)
    const bar = "█".repeat(Math.floor(porcentaje / 5)) + "░".repeat(20 - Math.floor(porcentaje / 5))
    console.log(`  ${stats.name.padEnd(25)} ${String(stats.rotativosTomados).padStart(3)}/${maxProyectado} (${porcentaje}%) ${bar}`)
  }

  const promedioReal = statsArray.reduce((sum, s) => sum + s.rotativosTomados, 0) / statsArray.length
  const minRotativos = Math.min(...statsArray.map((s) => s.rotativosTomados))
  const maxRotativos = Math.max(...statsArray.map((s) => s.rotativosTomados))

  console.log(`\nEstadísticas:`)
  console.log(`  - Total rotativos creados: ${totalRotativosCreados}`)
  console.log(`  - Promedio por persona: ${promedioReal.toFixed(1)}`)
  console.log(`  - Mínimo: ${minRotativos}`)
  console.log(`  - Máximo: ${maxRotativos}`)
  console.log(`  - Porcentaje promedio del máximo: ${Math.round((promedioReal / maxProyectado) * 100)}%`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
