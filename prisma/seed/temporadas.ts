import { PrismaClient } from "../../src/generated/prisma"

const prisma = new PrismaClient()

// Función para agregar días a una fecha
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// Generar eventos para un título
async function crearEventos(
  tituloId: string,
  seasonId: string,
  tituloName: string,
  tituloType: string,
  fechaInicio: Date,
  ensayos: number,
  funciones: number
) {
  const eventos = []
  let fecha = new Date(fechaInicio)

  // Crear ensayos (antes de las funciones)
  for (let i = 0; i < ensayos; i++) {
    eventos.push({
      title: `${tituloName} - Ensayo`,
      date: new Date(fecha),
      eventoType: "ENSAYO" as const,
      eventType: tituloType === "OPERA" ? "OPERA" : tituloType === "CONCIERTO" ? "CONCIERTO" : "OTRO" as const,
      startTime: new Date(fecha.setHours(10, 0, 0, 0)),
      endTime: new Date(fecha.setHours(13, 0, 0, 0)),
      tituloId,
      seasonId,
    })
    fecha = addDays(fecha, 1)
    // Saltar fines de semana para ensayos
    if (fecha.getDay() === 0) fecha = addDays(fecha, 1)
    if (fecha.getDay() === 6) fecha = addDays(fecha, 2)
  }

  // Crear funciones (después de los ensayos)
  fecha = addDays(fecha, 2) // Pausa antes de las funciones
  for (let i = 0; i < funciones; i++) {
    eventos.push({
      title: `${tituloName} - Función`,
      date: new Date(fecha),
      eventoType: "FUNCION" as const,
      eventType: tituloType === "OPERA" ? "OPERA" : tituloType === "CONCIERTO" ? "CONCIERTO" : "OTRO" as const,
      startTime: new Date(fecha.setHours(20, 0, 0, 0)),
      endTime: new Date(fecha.setHours(23, 0, 0, 0)),
      tituloId,
      seasonId,
    })
    fecha = addDays(fecha, 2) // Funciones cada 2 días
  }

  await prisma.event.createMany({ data: eventos })
  return eventos.length
}

async function main() {
  console.log("Creando temporadas 2025 y 2026...")

  // Crear temporada 2025
  const season2025 = await prisma.season.upsert({
    where: { id: "season-2025" },
    update: {},
    create: {
      id: "season-2025",
      name: "Temporada 2025",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      isActive: true,
      workingDays: 250,
    },
  })
  console.log(`✓ Temporada 2025 creada (activa)`)

  // Crear temporada 2026
  const season2026 = await prisma.season.upsert({
    where: { id: "season-2026" },
    update: {},
    create: {
      id: "season-2026",
      name: "Temporada 2026",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      isActive: false,
      workingDays: 250,
    },
  })
  console.log(`✓ Temporada 2026 creada`)

  // ==========================================
  // TITULOS TEMPORADA 2025
  // ==========================================
  console.log("\n--- Temporada 2025 ---")

  const titulos2025 = [
    // Óperas
    { name: "La Traviata", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2025-02-15", ensayos: 12, funciones: 6 },
    { name: "Tosca", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2025-04-01", ensayos: 10, funciones: 5 },
    { name: "La Bohème", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2025-05-20", ensayos: 11, funciones: 6 },
    { name: "Carmen", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2025-07-10", ensayos: 12, funciones: 7 },
    { name: "Aida", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2025-09-01", ensayos: 14, funciones: 6 },
    { name: "Rigoletto", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2025-10-20", ensayos: 10, funciones: 5 },
    // Ballets
    { name: "El Lago de los Cisnes", type: "BALLET", cupoEnsayo: 2, cupoFuncion: 3, fechaInicio: "2025-03-10", ensayos: 8, funciones: 5 },
    { name: "El Cascanueces", type: "BALLET", cupoEnsayo: 2, cupoFuncion: 3, fechaInicio: "2025-12-01", ensayos: 10, funciones: 8 },
    { name: "Giselle", type: "BALLET", cupoEnsayo: 2, cupoFuncion: 3, fechaInicio: "2025-06-15", ensayos: 7, funciones: 4 },
    // Conciertos
    { name: "Concierto de Apertura", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2025-01-20", ensayos: 4, funciones: 2 },
    { name: "Sinfonías de Beethoven I", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2025-03-25", ensayos: 4, funciones: 2 },
    { name: "Concierto de Otoño", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2025-04-28", ensayos: 3, funciones: 2 },
    { name: "Mahler Sinfonía No. 5", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2025-06-02", ensayos: 5, funciones: 2 },
    { name: "Noche de Gala", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2025-08-15", ensayos: 4, funciones: 1 },
    { name: "Concierto Navideño", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2025-12-18", ensayos: 3, funciones: 2 },
  ]

  let totalEventos2025 = 0
  for (const t of titulos2025) {
    const titulo = await prisma.titulo.create({
      data: {
        name: t.name,
        type: t.type as "OPERA" | "CONCIERTO" | "BALLET" | "RECITAL" | "OTRO",
        cupoEnsayo: t.cupoEnsayo,
        cupoFuncion: t.cupoFuncion,
        seasonId: season2025.id,
      },
    })

    const eventosCreados = await crearEventos(
      titulo.id,
      season2025.id,
      t.name,
      t.type,
      new Date(t.fechaInicio),
      t.ensayos,
      t.funciones
    )
    totalEventos2025 += eventosCreados
    console.log(`  ✓ ${t.name} (${t.type}) - ${t.ensayos} ensayos, ${t.funciones} funciones`)
  }

  // ==========================================
  // TITULOS TEMPORADA 2026
  // ==========================================
  console.log("\n--- Temporada 2026 ---")

  const titulos2026 = [
    // Óperas
    { name: "Don Giovanni", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2026-02-10", ensayos: 12, funciones: 6 },
    { name: "Madama Butterfly", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2026-03-25", ensayos: 11, funciones: 5 },
    { name: "Il Trovatore", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2026-05-15", ensayos: 10, funciones: 5 },
    { name: "La Flauta Mágica", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2026-07-01", ensayos: 12, funciones: 7 },
    { name: "Otello", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2026-08-20", ensayos: 13, funciones: 6 },
    { name: "Turandot", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2026-10-10", ensayos: 14, funciones: 6 },
    { name: "Las Bodas de Fígaro", type: "OPERA", cupoEnsayo: 2, cupoFuncion: 4, fechaInicio: "2026-11-20", ensayos: 11, funciones: 5 },
    // Ballets
    { name: "La Bella Durmiente", type: "BALLET", cupoEnsayo: 2, cupoFuncion: 3, fechaInicio: "2026-03-05", ensayos: 9, funciones: 5 },
    { name: "Romeo y Julieta", type: "BALLET", cupoEnsayo: 2, cupoFuncion: 3, fechaInicio: "2026-06-10", ensayos: 8, funciones: 4 },
    { name: "El Cascanueces", type: "BALLET", cupoEnsayo: 2, cupoFuncion: 3, fechaInicio: "2026-12-05", ensayos: 10, funciones: 8 },
    // Conciertos
    { name: "Concierto Inaugural 2026", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2026-01-15", ensayos: 4, funciones: 2 },
    { name: "Ciclo Brahms I", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2026-02-25", ensayos: 4, funciones: 2 },
    { name: "Ciclo Brahms II", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2026-04-20", ensayos: 4, funciones: 2 },
    { name: "Tchaikovsky Festival", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2026-05-28", ensayos: 5, funciones: 3 },
    { name: "Concierto de Invierno", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2026-07-20", ensayos: 3, funciones: 2 },
    { name: "Gala Aniversario", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2026-09-15", ensayos: 5, funciones: 1 },
    { name: "Concierto de Fin de Año", type: "CONCIERTO", cupoEnsayo: 1, cupoFuncion: 2, fechaInicio: "2026-12-28", ensayos: 3, funciones: 2 },
  ]

  let totalEventos2026 = 0
  for (const t of titulos2026) {
    const titulo = await prisma.titulo.create({
      data: {
        name: t.name,
        type: t.type as "OPERA" | "CONCIERTO" | "BALLET" | "RECITAL" | "OTRO",
        cupoEnsayo: t.cupoEnsayo,
        cupoFuncion: t.cupoFuncion,
        seasonId: season2026.id,
      },
    })

    const eventosCreados = await crearEventos(
      titulo.id,
      season2026.id,
      t.name,
      t.type,
      new Date(t.fechaInicio),
      t.ensayos,
      t.funciones
    )
    totalEventos2026 += eventosCreados
    console.log(`  ✓ ${t.name} (${t.type}) - ${t.ensayos} ensayos, ${t.funciones} funciones`)
  }

  // Resumen
  console.log("\n==========================================")
  console.log("RESUMEN")
  console.log("==========================================")
  console.log(`Temporada 2025: ${titulos2025.length} títulos, ${totalEventos2025} eventos`)
  console.log(`Temporada 2026: ${titulos2026.length} títulos, ${totalEventos2026} eventos`)
  console.log(`Total: ${titulos2025.length + titulos2026.length} títulos, ${totalEventos2025 + totalEventos2026} eventos`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
