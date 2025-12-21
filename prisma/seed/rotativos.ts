import { prisma } from "../../src/lib/prisma"

async function createRotativos() {
  // Get some users
  const users = await prisma.user.findMany({
    where: { role: "INTEGRANTE" },
    take: 8
  })

  // Get events in December 2025 with their titulo info
  const events = await prisma.event.findMany({
    where: {
      date: {
        gte: new Date("2025-12-01"),
        lte: new Date("2025-12-31")
      }
    },
    include: {
      titulo: true,
      rotativos: true
    },
    orderBy: { date: "asc" },
    take: 20
  })

  console.log(`Found ${users.length} users and ${events.length} events in December 2025`)

  // Create rotativos for some events
  let created = 0
  for (const event of events.slice(0, 15)) {
    // Calculate effective cupo respecting the limit
    const cupoEfectivo = event.cupoOverride ??
      (event.titulo
        ? event.eventoType === "ENSAYO"
          ? event.titulo.cupoEnsayo
          : event.titulo.cupoFuncion
        : 2)

    // Only create up to cupoEfectivo rotativos, minus existing ones
    const existingCount = event.rotativos.length
    const maxNew = Math.max(0, cupoEfectivo - existingCount)
    const numRotativos = Math.min(maxNew, Math.floor(Math.random() * 2) + 1)
    const shuffledUsers = users.sort(() => Math.random() - 0.5)

    for (let i = 0; i < numRotativos && i < shuffledUsers.length; i++) {
      try {
        await prisma.rotativo.create({
          data: {
            userId: shuffledUsers[i].id,
            eventId: event.id,
            estado: i === 0 ? "APROBADO" : (Math.random() > 0.3 ? "APROBADO" : "PENDIENTE"),
            tipo: "VOLUNTARIO",
            motivo: "Rotativo de prueba"
          }
        })
        created++
        console.log(`  ✓ Rotativo para ${event.title} - ${event.date.toISOString().split('T')[0]}`)
      } catch (e) {
        // Skip if already exists
      }
    }
  }

  console.log(`\n✓ Created ${created} rotativos for December 2025`)
  await prisma.$disconnect()
}

createRotativos()
