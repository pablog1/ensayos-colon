import { prisma } from "../src/lib/prisma"

async function test() {
  // Ver todas las temporadas
  const seasons = await prisma.season.findMany({
    select: { id: true, name: true, isActive: true }
  })
  console.log("=== TEMPORADAS ===")
  console.log(seasons)

  // Ver temporada activa
  const activa = await prisma.season.findFirst({ where: { isActive: true } })
  console.log("\n=== TEMPORADA ACTIVA ===")
  console.log(activa)

  // Contar títulos y eventos por temporada
  for (const s of seasons) {
    const titulos = await prisma.titulo.findMany({
      where: { seasonId: s.id },
      include: { events: { select: { id: true, cupoOverride: true } } }
    })
    let totalCupos = 0
    let totalEventos = 0
    for (const t of titulos) {
      for (const e of t.events) {
        totalCupos += e.cupoOverride ?? t.cupo
        totalEventos++
      }
    }
    console.log(`\nTemporada ${s.name} (id: ${s.id}):`)
    console.log(`  - Títulos: ${titulos.length}`)
    console.log(`  - Eventos en títulos: ${totalEventos}`)
    console.log(`  - Total cupos: ${totalCupos}`)
  }

  // Total usuarios
  const users = await prisma.user.count()
  console.log(`\n=== USUARIOS: ${users} ===`)

  // Ver un evento específico para verificar su seasonId
  const evento = await prisma.event.findFirst({
    where: { title: { contains: "Lago Cisnes" } },
    select: { id: true, title: true, seasonId: true }
  })
  console.log("\n=== EVENTO LAGO CISNES ===")
  console.log(evento)

  await prisma.$disconnect()
}

test().catch(console.error)
