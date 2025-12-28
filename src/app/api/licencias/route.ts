import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"
import { createNotification } from "@/lib/services/notifications"

// GET /api/licencias - Lista licencias
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const seasonId = searchParams.get("seasonId")
  const userId = searchParams.get("userId")
  const estado = searchParams.get("estado")

  // Construir filtros
  const filters: Record<string, unknown> = {}

  if (seasonId) {
    filters.seasonId = seasonId
  }

  if (estado) {
    filters.estado = estado
  }

  // Admin ve todas, integrante solo las suyas
  if (session.user.role !== "ADMIN") {
    filters.userId = session.user.id
  } else if (userId) {
    filters.userId = userId
  }

  const licencias = await prisma.license.findMany({
    where: filters,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          alias: true,
        },
      },
      season: {
        select: {
          id: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(licencias)
}

// POST /api/licencias - Crear licencia (solo admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Solo admin puede crear licencias
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden registrar licencias" },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { userId, startDate, endDate, description } = body

  // Validar campos requeridos
  if (!userId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: userId, startDate, endDate" },
      { status: 400 }
    )
  }

  const targetUserId = userId

  // Validar fechas
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (start > end) {
    return NextResponse.json(
      { error: "La fecha de inicio debe ser anterior a la fecha de fin" },
      { status: 400 }
    )
  }

  // Obtener temporada activa
  const season = await prisma.season.findFirst({
    where: { isActive: true },
  })

  if (!season) {
    return NextResponse.json(
      { error: "No hay temporada activa" },
      { status: 400 }
    )
  }

  // Verificar solapamiento con otras licencias del usuario
  const licenciaSolapada = await prisma.license.findFirst({
    where: {
      userId: targetUserId,
      seasonId: season.id,
      OR: [
        {
          AND: [
            { startDate: { lte: end } },
            { endDate: { gte: start } },
          ],
        },
      ],
    },
  })

  if (licenciaSolapada) {
    return NextResponse.json(
      { error: "Ya existe una licencia que se superpone con estas fechas" },
      { status: 400 }
    )
  }

  // Calcular rotativos proporcionales durante la licencia
  const rotativosCalculados = await calcularRotativosProporcionales(
    start,
    end,
    season.id
  )

  // Crear licencia (siempre aprobada, solo admin puede crear)
  const license = await prisma.license.create({
    data: {
      userId: targetUserId,
      seasonId: season.id,
      startDate: start,
      endDate: end,
      type: "OTRO", // Tipo genérico, no se usa
      description,
      createdById: session.user.id,
      rotativosCalculados,
      estado: "APROBADA", // Siempre aprobada directamente
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, alias: true },
      },
      season: {
        select: { id: true, name: true },
      },
    },
  })

  // Actualizar balance inmediatamente
  await actualizarBalancePorLicencia(targetUserId, season.id, rotativosCalculados)

  // Audit log
  await createAuditLog({
    action: "LICENCIA_CREADA",
    entityType: "License",
    entityId: license.id,
    userId: session.user.id,
    targetUserId: targetUserId,
    details: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rotativosCalculados,
    },
  })

  // Notificar al usuario que se le registró una licencia
  await createNotification({
    userId: targetUserId,
    type: "LICENCIA_REGISTRADA",
    title: "Licencia registrada",
    message: `Se te ha registrado una licencia del ${start.toLocaleDateString()} al ${end.toLocaleDateString()}. Se acreditaron ${rotativosCalculados.toFixed(2)} rotativos.`,
  })

  return NextResponse.json(license)
}

// Calcular rotativos proporcionales durante el período de licencia
async function calcularRotativosProporcionales(
  startDate: Date,
  endDate: Date,
  seasonId: string
): Promise<number> {
  // Contar cupos de rotativos disponibles durante el período
  const eventos = await prisma.event.findMany({
    where: {
      seasonId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      tituloId: { not: null },
    },
    include: {
      titulo: true,
    },
  })

  // Sumar cupos de todos los eventos
  let totalCupos = 0
  for (const evento of eventos) {
    const cupo = evento.cupoOverride ?? evento.titulo?.cupo ?? 4
    totalCupos += cupo
  }

  // Contar integrantes activos
  const integrantes = await prisma.user.count({
    where: { role: "INTEGRANTE" },
  })

  if (integrantes === 0) return 0

  // Rotativos proporcionales = total de cupos / cantidad de integrantes
  return totalCupos / integrantes
}

// Actualizar balance del usuario por licencia aprobada
async function actualizarBalancePorLicencia(
  userId: string,
  seasonId: string,
  rotativos: number
) {
  await prisma.userSeasonBalance.upsert({
    where: {
      userId_seasonId: {
        userId,
        seasonId,
      },
    },
    update: {
      rotativosPorLicencia: {
        increment: rotativos,
      },
    },
    create: {
      userId,
      seasonId,
      rotativosPorLicencia: rotativos,
      maxProyectado: 0,
    },
  })
}
