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
    const season = await prisma.season.findFirst({
      where: { isActive: true },
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

      // Crear balance para el nuevo integrante con justificación
      const justificacion = `Promedio del grupo al momento del ingreso: ${rotativosCalculados} rotativos (${balances.length} integrantes activos)`

      await prisma.userSeasonBalance.create({
        data: {
          userId: integrante.id,
          seasonId: season.id,
          rotativosTomados: 0,
          rotativosObligatorios: 0,
          rotativosPorLicencia: 0,
          maxProyectado: rotativosCalculados,
          fechaIngreso: new Date(joinDate),
          asignacionInicialRotativos: rotativosCalculados,
          asignacionFechaCalculo: new Date(),
          asignacionJustificacion: justificacion,
        },
      })

      // Audit log
      await createAuditLog({
        action: "USUARIO_CREADO",
        entityType: "User",
        entityId: integrante.id,
        userId: session.user.id,
        details: {
          esIntegranteNuevo: true,
          fechaIngreso: joinDate,
          maxProyectadoCalculado: rotativosCalculados,
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
