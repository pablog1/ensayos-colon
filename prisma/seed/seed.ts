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
      password: adminPassword,
      role: "ADMIN",
    },
  })
  console.log(`Admin created: ${admin.email}`)

  // Crear algunos integrantes de ejemplo
  const integrantePassword = await bcrypt.hash("integrante123", 10)

  const integrantes = [
    { email: "violin1@orquesta.com", name: "Maria Garcia" },
    { email: "violin2@orquesta.com", name: "Juan Lopez" },
    { email: "viola1@orquesta.com", name: "Ana Martinez" },
    { email: "cello1@orquesta.com", name: "Carlos Rodriguez" },
    { email: "contrabajo1@orquesta.com", name: "Laura Fernandez" },
  ]

  for (const data of integrantes) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        ...data,
        password: integrantePassword,
        role: "INTEGRANTE",
      },
    })
    console.log(`Integrante created: ${user.email}`)
  }

  console.log("Seeding completed!")
  console.log("\nCredentials:")
  console.log("Admin: admin@orquesta.com / admin123")
  console.log("Integrantes: [email]@orquesta.com / integrante123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
