import { PrismaClient } from "../src/generated/prisma"

const prisma = new PrismaClient()

async function main() {
  console.log("Buscando bloques fantasma (activos pero sin rotativos)...\n")

  // Buscar bloques activos asignados a alguien
  const bloquesActivos = await prisma.block.findMany({
    where: {
      assignedToId: { not: null },
      estado: { in: ["SOLICITADO", "APROBADO", "EN_CURSO", "COMPLETADO"] },
    },
    include: {
      assignedTo: { select: { id: true, name: true, alias: true } },
      rotativos: {
        where: {
          estado: { in: ["APROBADO", "PENDIENTE", "EN_ESPERA", "CANCELACION_PENDIENTE"] },
        },
        select: { id: true },
      },
    },
  })

  const fantasmas = bloquesActivos.filter((b) => b.rotativos.length === 0)

  if (fantasmas.length === 0) {
    console.log("No se encontraron bloques fantasma. Todo limpio!")
    return
  }

  console.log(`Encontrados ${fantasmas.length} bloque(s) fantasma:\n`)
  for (const b of fantasmas) {
    console.log(`  - Bloque "${b.name}" (${b.id})`)
    console.log(`    Estado: ${b.estado}`)
    console.log(`    Asignado a: ${b.assignedTo?.alias || b.assignedTo?.name} (${b.assignedToId})`)
    console.log(`    Rotativos activos: 0`)
    console.log()
  }

  // Limpiar bloques fantasma
  const temporadaActiva = await prisma.season.findFirst({
    where: { isActive: true },
  })

  for (const b of fantasmas) {
    await prisma.block.update({
      where: { id: b.id },
      data: {
        estado: "CANCELADO",
        assignedToId: null,
      },
    })
    console.log(`  [OK] Bloque "${b.name}" marcado como CANCELADO`)

    // Resetear bloqueUsado si hay temporada activa
    if (temporadaActiva && b.assignedToId) {
      // Solo resetear si no tiene OTROS bloques activos
      const otrosBloques = await prisma.block.count({
        where: {
          assignedToId: b.assignedToId,
          seasonId: temporadaActiva.id,
          estado: { in: ["SOLICITADO", "APROBADO", "EN_CURSO", "COMPLETADO"] },
        },
      })

      if (otrosBloques === 0) {
        await prisma.userSeasonBalance.updateMany({
          where: {
            userId: b.assignedToId,
            seasonId: temporadaActiva.id,
          },
          data: { bloqueUsado: false },
        })
        console.log(`  [OK] bloqueUsado reseteado para ${b.assignedTo?.alias || b.assignedTo?.name}`)
      } else {
        console.log(`  [--] ${b.assignedTo?.alias || b.assignedTo?.name} tiene ${otrosBloques} bloque(s) activo(s), bloqueUsado no se resetea`)
      }
    }
    console.log()
  }

  console.log("Limpieza completada!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
