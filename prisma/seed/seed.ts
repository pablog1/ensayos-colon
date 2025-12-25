import { PrismaClient } from "../../src/generated/prisma"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  const password = await bcrypt.hash("admin123", 10)

  // 4 Administradores (que también son integrantes/músicos)
  const admins = [
    { email: "admin@orquesta.com", name: "Roberto Giménez", alias: "Roberto" },
    { email: "concertino@orquesta.com", name: "Alejandra Vidal", alias: "Ale" },
    { email: "jefe.seccion@orquesta.com", name: "Fernando Acosta", alias: "Fer" },
    { email: "coordinador@orquesta.com", name: "Claudia Méndez", alias: "Clau" },
  ]

  for (const data of admins) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: { alias: data.alias },
      create: {
        ...data,
        password,
        role: "ADMIN",
      },
    })
    console.log(`Admin created: ${user.email} (${data.alias})`)
  }

  // 16 Integrantes (músicos) - para completar 20 usuarios
  const integrantes = [
    // Mujeres
    { email: "violin1@orquesta.com", name: "María García", alias: "Mari" },
    { email: "violin3@orquesta.com", name: "Ana Martínez", alias: "Anita" },
    { email: "violin5@orquesta.com", name: "Laura Fernández", alias: "Lau" },
    { email: "violin7@orquesta.com", name: "Sofía Díaz", alias: "Sofi" },
    { email: "violin9@orquesta.com", name: "Lucía Ruiz", alias: "Lu" },
    { email: "violin11@orquesta.com", name: "Paula Herrera", alias: "Pau" },
    // Hombres
    { email: "violin2@orquesta.com", name: "Juan López", alias: "Juancho" },
    { email: "violin4@orquesta.com", name: "Carlos Rodríguez", alias: "Carlitos" },
    { email: "violin6@orquesta.com", name: "Pedro Sánchez", alias: "Pete" },
    { email: "violin8@orquesta.com", name: "Miguel Torres", alias: "Migue" },
    { email: "violin10@orquesta.com", name: "Diego Morales", alias: "Dieguito" },
    { email: "viola1@orquesta.com", name: "Martín Pérez", alias: "Tín" },
    { email: "viola2@orquesta.com", name: "Andrés Castro", alias: "Andy" },
    { email: "cello1@orquesta.com", name: "Gabriel Romero", alias: "Gabi" },
    // Mujeres adicionales
    { email: "viola3@orquesta.com", name: "Valentina Suárez", alias: "Vale" },
    { email: "cello2@orquesta.com", name: "Camila Ortiz", alias: "Cami" },
  ]

  const createdUsers: Array<{ id: string; name: string }> = []

  for (const data of integrantes) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: { alias: data.alias },
      create: {
        ...data,
        password,
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
  console.log("\n=== Credenciales (contraseña: admin123) ===")
  console.log("\nAdministradores (4):")
  console.log("  admin@orquesta.com (Roberto Giménez) 👨")
  console.log("  concertino@orquesta.com (Alejandra Vidal) 👩")
  console.log("  jefe.seccion@orquesta.com (Fernando Acosta) 🧔")
  console.log("  coordinador@orquesta.com (Claudia Méndez) 👩‍🦱")
  console.log("\nIntegrantes (16):")
  console.log("  Mujeres: Mari 👩‍🦰, Anita 👧, Lau 👩‍🦳, Sofi 💁‍♀️, Lu 🙋‍♀️, Pau 👵, Vale 👩‍🦲, Cami 🧕")
  console.log("  Hombres: Juancho 👨‍🦱, Carlitos 👨‍🦳, Pete 👴, Migue 👨‍🦲, Dieguito 🧑, Tín 👦, Andy 🧔‍♂️, Gabi 👨‍🦰")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
