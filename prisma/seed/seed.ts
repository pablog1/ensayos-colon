import { PrismaClient } from "../../src/generated/prisma"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Crear admin
  const adminPassword = await bcrypt.hash("admin123", 10)
  const admin = await prisma.user.upsert({
    where: { email: "admin@orquesta.com" },
    update: {},
    create: {
      email: "admin@orquesta.com",
      name: "Administrador",
      alias: "Admin",
      avatar: "🎼",
      password: adminPassword,
      role: "ADMIN",
    },
  })
  console.log(`Admin created: ${admin.email}`)

  // Crear 10 integrantes de ejemplo con alias y avatares
  const integrantePassword = await bcrypt.hash("integrante123", 10)

  const integrantes = [
    { email: "violin1@orquesta.com", name: "María García", alias: "Mari", avatar: "🎻" },
    { email: "violin2@orquesta.com", name: "Juan López", alias: "Juancho", avatar: "🎻" },
    { email: "viola1@orquesta.com", name: "Ana Martínez", alias: "Anita", avatar: "🎻" },
    { email: "cello1@orquesta.com", name: "Carlos Rodríguez", alias: "Carlitos", avatar: "🎻" },
    { email: "contrabajo1@orquesta.com", name: "Laura Fernández", alias: "Lau", avatar: "🎸" },
    { email: "flauta1@orquesta.com", name: "Pedro Sánchez", alias: "Pete", avatar: "🎵" },
    { email: "oboe1@orquesta.com", name: "Sofia Díaz", alias: "Sofi", avatar: "🎶" },
    { email: "clarinete1@orquesta.com", name: "Miguel Torres", alias: "Migue", avatar: "🎷" },
    { email: "fagot1@orquesta.com", name: "Lucía Ruiz", alias: "Lu", avatar: "🎵" },
    { email: "trompa1@orquesta.com", name: "Diego Morales", alias: "Dieguito", avatar: "🎺" },
  ]

  const createdUsers: Array<{ id: string; name: string }> = []

  for (const data of integrantes) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: { alias: data.alias, avatar: data.avatar },
      create: {
        ...data,
        password: integrantePassword,
        role: "INTEGRANTE",
      },
    })
    createdUsers.push({ id: user.id, name: user.name })
    console.log(`Integrante created: ${user.email} (${data.alias})`)
  }

  // Crear solicitudes de demo para mostrar cómo se ve el calendario con varios nombres
  // Usamos una fecha específica: el próximo lunes
  const today = new Date()
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7
  const demoDate = new Date(today)
  demoDate.setDate(today.getDate() + daysUntilMonday)
  demoDate.setHours(12, 0, 0, 0) // Mediodía para evitar problemas de timezone

  console.log(`\nCreando solicitudes de demo para ${demoDate.toISOString().split('T')[0]}...`)

  // Crear solicitudes para 8 de los 10 usuarios en el mismo día
  for (let i = 0; i < 8; i++) {
    const user = createdUsers[i]
    try {
      await prisma.solicitud.upsert({
        where: {
          userId_fecha: {
            userId: user.id,
            fecha: demoDate,
          },
        },
        update: {},
        create: {
          userId: user.id,
          fecha: demoDate,
          motivo: "Demo - Solicitud de ejemplo",
          estado: i < 5 ? "APROBADA" : "PENDIENTE", // 5 aprobadas, 3 pendientes
        },
      })
      console.log(`  Solicitud creada para ${user.name}`)
    } catch {
      console.log(`  Solicitud ya existe para ${user.name}`)
    }
  }

  // Crear algunas solicitudes adicionales en otros días del mes
  const secondDate = new Date(demoDate)
  secondDate.setDate(demoDate.getDate() + 2)

  for (let i = 0; i < 3; i++) {
    const user = createdUsers[i]
    try {
      await prisma.solicitud.upsert({
        where: {
          userId_fecha: {
            userId: user.id,
            fecha: secondDate,
          },
        },
        update: {},
        create: {
          userId: user.id,
          fecha: secondDate,
          motivo: "Demo - Segunda solicitud",
          estado: "APROBADA",
        },
      })
    } catch {
      // Ignorar si ya existe
    }
  }

  console.log("\nSeeding completed!")
  console.log("\nCredentials:")
  console.log("Admin: admin@orquesta.com / admin123")
  console.log("Integrantes: [instrumento]1@orquesta.com / integrante123")
  console.log("\nEjemplos:")
  console.log("  violin1@orquesta.com (María García)")
  console.log("  flauta1@orquesta.com (Pedro Sánchez)")
  console.log("  trompa1@orquesta.com (Diego Morales)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
