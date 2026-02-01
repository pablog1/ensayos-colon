import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"
import bcrypt from "bcryptjs"

// GET /api/integrantes - Lista todos los usuarios (solo admin)
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const integrantes = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      alias: true,
      role: true,
      joinDate: true,
      createdAt: true,
      _count: {
        select: {
          solicitudes: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(integrantes)
}

// POST /api/integrantes - Crear usuario (solo admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await req.json()
  const { email, name, alias, password, role, joinDate } = body

  if (!email || !name || !password) {
    return NextResponse.json(
      { error: "Email, nombre y contrasena son requeridos" },
      { status: 400 }
    )
  }

  // Validar rol
  const validRoles = ["ADMIN", "INTEGRANTE"]
  const userRole = role && validRoles.includes(role) ? role : "INTEGRANTE"

  // Verificar que el email no exista
  const existente = await prisma.user.findUnique({
    where: { email },
  })

  if (existente) {
    return NextResponse.json(
      { error: "Ya existe un usuario con este email" },
      { status: 400 }
    )
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // Determinar si es un integrante nuevo (tiene fecha de ingreso)
  const esIntegranteNuevo = userRole === "INTEGRANTE" && joinDate

  const integrante = await prisma.user.create({
    data: {
      email,
      name,
      alias,
      password: hashedPassword,
      role: userRole,
      joinDate: joinDate ? new Date(joinDate) : null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      alias: true,
      role: true,
      joinDate: true,
      createdAt: true,
    },
  })

  // Si es integrante nuevo, calcular su maximo proporcional
  let rotativosCalculados = 0
  if (esIntegranteNuevo) {
    // Buscar la temporada que contenga la fecha de ingreso
    const fechaIngresoDate = new Date(joinDate)
    const season = await prisma.season.findFirst({
      where: {
        isActive: true,
        startDate: { lte: fechaIngresoDate },
        endDate: { gte: fechaIngresoDate },
      },
    }) ?? await prisma.season.findFirst({
      // Fallback: temporada activa más reciente
      where: { isActive: true },
      orderBy: { startDate: 'desc' },
    })

    if (season) {
      // Calcular promedio de rotativos tomados por el resto del grupo
      const balances = await prisma.userSeasonBalance.findMany({
        where: {
          seasonId: season.id,
          user: { role: "INTEGRANTE" },
        },
      })

      if (balances.length > 0) {
        const totalRotativos = balances.reduce(
          (sum, b) => sum + b.rotativosTomados + b.rotativosObligatorios,
          0
        )
        rotativosCalculados = Math.round(totalRotativos / balances.length)
      }

      // Calcular cupos reales disponibles desde la fecha de ingreso
      const eventosDesdeIngreso = await prisma.event.findMany({
        where: {
          seasonId: season.id,
          date: { gte: new Date(joinDate) }
        },
        include: { titulo: { select: { cupo: true } } }
      })

      let cuposDesdeIngreso = 0
      for (const evento of eventosDesdeIngreso) {
        if (evento.titulo) {
          cuposDesdeIngreso += evento.cupoOverride ?? evento.titulo.cupo
        }
      }

      // Total de integrantes (incluyendo el nuevo)
      const totalIntegrantes = await prisma.user.count()
      const maxCalculado = totalIntegrantes > 0 ? Math.floor(cuposDesdeIngreso / totalIntegrantes) : 1

      // Crear balance para el nuevo integrante
      // NO guardamos maxAjustadoManual para que se calcule dinámicamente
      const justificacion = `Cupos desde fecha de ingreso: ${cuposDesdeIngreso} / ${totalIntegrantes} integrantes = ${maxCalculado} rotativos`

      await prisma.userSeasonBalance.create({
        data: {
          userId: integrante.id,
          seasonId: season.id,
          rotativosTomados: 0,
          rotativosObligatorios: 0,
          rotativosPorLicencia: 0,
          // maxAjustadoManual: null - se calcula dinámicamente basado en eventos desde fechaIngreso
          fechaIngreso: new Date(joinDate),
          asignacionInicialRotativos: maxCalculado, // valor de referencia al momento del ingreso
          asignacionFechaCalculo: new Date(),
          asignacionJustificacion: justificacion,
        },
      })

      rotativosCalculados = maxCalculado

      // Audit log
      await createAuditLog({
        action: "USUARIO_CREADO",
        entityType: "User",
        entityId: integrante.id,
        userId: session.user.id,
        details: {
          esIntegranteNuevo: true,
          fechaIngreso: joinDate,
          maxAjustadoManual: rotativosCalculados,
          promedioGrupoAlIngreso: rotativosCalculados,
        },
      })
    }
  } else {
    // Audit log para usuario normal
    await createAuditLog({
      action: "USUARIO_CREADO",
      entityType: "User",
      entityId: integrante.id,
      userId: session.user.id,
      details: {
        esIntegranteNuevo: false,
        role: userRole,
      },
    })
  }

  return NextResponse.json({
    ...integrante,
    rotativosCalculados: esIntegranteNuevo ? rotativosCalculados : undefined,
  })
}
