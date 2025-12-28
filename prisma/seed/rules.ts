import { PrismaClient } from "../../src/generated/prisma"

const prisma = new PrismaClient()

const ruleConfigs = [
  {
    key: "CUPO_DIARIO",
    value: JSON.stringify({
      OPERA: 4,
      CONCIERTO: 2,
      BALLET: 4,
    }),
    valueType: "json",
    description:
      "Cupos por defecto según tipo de título. Ópera: 4 cupos, Ballet: 4 cupos, Concierto: 2 cupos. Los ensayos usan el mismo cupo que las funciones del título.",
    category: "cupo",
    priority: 10,
  },
  {
    key: "MAX_PROYECTADO",
    value: JSON.stringify({
      baseAnual: 50,
      formula: "workingDays * cupoDiario / totalIntegrantes",
    }),
    valueType: "json",
    description:
      "Máximo proyectado anual por integrante. Fórmula: (Días a trabajar × Cupo diario) ÷ Cantidad integrantes ≈ 50.",
    category: "restriccion",
    priority: 40,
  },
  {
    key: "FINES_SEMANA_MAX",
    value: "1",
    valueType: "number",
    description:
      "Máximo de fines de semana por mes. Si se toma solo el sábado cuenta como el fin de semana del mes.",
    category: "restriccion",
    priority: 50,
  },
  {
    key: "BLOQUE_EXCLUSIVO",
    value: JSON.stringify({
      maxPorPersona: 1,
      permiteCancel: false,
    }),
    valueType: "json",
    description:
      "Configuración de bloques exclusivos. 1 bloque por persona por año, no se puede cancelar una vez iniciado.",
    category: "bloque",
    priority: 20,
  },
  {
    key: "LISTA_ESPERA",
    value: JSON.stringify({
      tipo: "FIFO",
      vencimiento: null,
    }),
    valueType: "json",
    description:
      "Configuración de lista de espera. Tipo FIFO (primero en llegar), sin vencimiento (se purga al fin de temporada).",
    category: "cupo",
    priority: 15,
  },
  {
    key: "ROTACION_OBLIGATORIA",
    value: JSON.stringify({
      diasAntes: 5,
      criterio: "MENOS_ROTATIVOS",
    }),
    valueType: "json",
    description:
      "Configuración de rotación obligatoria. 5 días antes se asigna automáticamente a quienes tienen menos rotativos.",
    category: "rotacion",
    priority: 30,
  },
  {
    key: "COBERTURA_EXTERNA",
    value: JSON.stringify({
      criterio: "MAS_ROTATIVOS",
    }),
    valueType: "json",
    description:
      "Configuración para cobertura por causas externas. Se prioriza a quienes más rotativos hayan tomado.",
    category: "rotacion",
    priority: 35,
  },
  {
    key: "LICENCIAS",
    value: JSON.stringify({
      calculoPromedio: true,
    }),
    valueType: "json",
    description:
      "Configuración de licencias. Al reincorporarse se suma al contador el promedio de rotativos del resto durante la licencia.",
    category: "restriccion",
    priority: 70,
  },
  {
    key: "INTEGRANTE_NUEVO",
    value: JSON.stringify({
      usarPromedio: true,
      adminOverride: true,
    }),
    valueType: "json",
    description:
      "Configuración para integrantes nuevos. El máximo se calcula como promedio del grupo al ingreso. Admin puede modificar.",
    category: "restriccion",
    priority: 80,
  },
  {
    key: "ALERTA_UMBRAL",
    value: "90",
    valueType: "number",
    description:
      "Umbral de alerta de cercanía al máximo (%). Se notifica al integrante y admin cuando se alcanza este porcentaje.",
    category: "alerta",
    priority: 200,
  },
  {
    key: "ENSAYOS_DOBLES",
    value: JSON.stringify({
      enabled: true,
      maxRotativosPorTitulo: 1,
    }),
    valueType: "json",
    description:
      "Límite de rotativos en días con ensayo doble. Si un título tiene días con ensayo doble, cada integrante solo puede pedir rotativo para un ensayo en uno de esos días. Las solicitudes adicionales van a revisión del admin.",
    category: "restriccion",
    priority: 15,
  },
  {
    key: "FUNCIONES_POR_TITULO",
    value: JSON.stringify({
      enabled: true,
      umbralFunciones: 3,
      maxHasta: 1,
      porcentajeSobre: 30,
    }),
    valueType: "json",
    description:
      "Límite de funciones por título. Si un título tiene hasta 3 funciones, cada integrante puede pedir rotativo para máximo 1. Si tiene más de 3 funciones, puede pedir hasta el 30% del total. Las solicitudes adicionales van a revisión del admin.",
    category: "restriccion",
    priority: 16,
  },
  {
    key: "PRIMER_ULTIMO_TITULO",
    value: JSON.stringify({
      enabled: true,
    }),
    valueType: "json",
    description:
      "Si un integrante toma rotativo en el primer título del año, no puede tomar en el último. El admin verifica esta restricción manualmente.",
    category: "restriccion",
    priority: 40,
  },
]

export async function seedRuleConfigs() {
  console.log("Seeding rule configurations...")

  for (const config of ruleConfigs) {
    await prisma.ruleConfig.upsert({
      where: { key: config.key },
      create: config,
      update: {
        value: config.value,
        valueType: config.valueType,
        description: config.description,
        category: config.category,
        priority: config.priority,
      },
    })
    console.log(`  ✓ ${config.key}`)
  }

  console.log("Rule configurations seeded successfully!")
}

export async function seedDefaultSeason() {
  console.log("Seeding default season...")

  const currentYear = new Date().getFullYear()

  const season = await prisma.season.upsert({
    where: { id: `season-${currentYear}` },
    create: {
      id: `season-${currentYear}`,
      name: `Temporada ${currentYear}`,
      startDate: new Date(currentYear, 0, 1), // 1 de enero
      endDate: new Date(currentYear, 11, 31), // 31 de diciembre
      isActive: true,
      workingDays: 250,
    },
    update: {
      isActive: true,
    },
  })

  console.log(`  ✓ ${season.name}`)
  console.log("Default season seeded successfully!")

  return season
}

// Main execution
async function main() {
  try {
    await seedRuleConfigs()
    await seedDefaultSeason()
  } catch (error) {
    console.error("Error seeding:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
main()
