import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma"
import { createAuditLog } from "@/lib/services/audit"
import { createNotification } from "@/lib/services/notifications"
import { formatDateAR } from "@/lib/utils"

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

  // Todos ven todas las licencias, pero se puede filtrar por userId
  if (userId) {
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

  // Parsear fechas manualmente para evitar desfase de timezone
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number)
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number)
  const start = new Date(startYear, startMonth - 1, startDay, 12, 0, 0)
  const end = new Date(endYear, endMonth - 1, endDay, 12, 0, 0)

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
  const { resultado: rotativosCalculados, detalles: detallesCalculo } = await calcularRotativosProporcionales(
    start,
    end,
    season.id
  )

  // Buscar y eliminar rotativos del usuario durante el período de licencia
  const rotativosEliminados = await eliminarRotativosDuranteLicencia(
    targetUserId,
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
      detallesCalculo: detallesCalculo as unknown as Prisma.InputJsonValue,
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
      rotativosEliminados: rotativosEliminados.cantidad,
      eventosEliminados: rotativosEliminados.eventos,
      registradoPor: session.user.name,
    },
  })

  // Notificar al usuario que se le registró una licencia
  const mensajeRotativosEliminados = rotativosEliminados.cantidad > 0
    ? ` Se eliminaron ${rotativosEliminados.cantidad} rotativo(s) que tenías anotado(s) en ese período.`
    : ""
  await createNotification({
    userId: targetUserId,
    type: "LICENCIA_REGISTRADA",
    title: "Licencia registrada",
    message: `${session.user.name} te registró una licencia del ${formatDateAR(start)} al ${formatDateAR(end)}. Se sumaron ${rotativosCalculados} rotativos a tu balance.${mensajeRotativosEliminados}`,
  })

  return NextResponse.json(license)
}

interface DetallesCalculo {
  totalCupos: number
  totalIntegrantes: number
  resultadoExacto: number
  resultadoRedondeado: number
}

// Calcular rotativos proporcionales durante el período de licencia
async function calcularRotativosProporcionales(
  startDate: Date,
  endDate: Date,
  seasonId: string
): Promise<{ resultado: number; detalles: DetallesCalculo }> {
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

  // Contar todos los usuarios (INTEGRANTE y ADMIN participan de rotativos)
  const integrantes = await prisma.user.count()

  if (integrantes === 0) {
    return {
      resultado: 0,
      detalles: { totalCupos: 0, totalIntegrantes: 0, resultadoExacto: 0, resultadoRedondeado: 0 }
    }
  }

  const resultadoExacto = totalCupos / integrantes
  const resultadoRedondeado = Math.floor(resultadoExacto)

  return {
    resultado: resultadoRedondeado,
    detalles: {
      totalCupos,
      totalIntegrantes: integrantes,
      resultadoExacto: Math.round(resultadoExacto * 100) / 100, // 2 decimales
      resultadoRedondeado,
    }
  }
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
    },
  })
}

// Eliminar rotativos del usuario durante el período de licencia
async function eliminarRotativosDuranteLicencia(
  userId: string,
  startDate: Date,
  endDate: Date,
  seasonId: string
): Promise<{ cantidad: number; eventos: string[] }> {
  // Buscar rotativos aprobados del usuario en eventos dentro del período
  const rotativosAprobados = await prisma.rotativo.findMany({
    where: {
      userId,
      estado: "APROBADO",
      event: {
        seasonId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          date: true,
        },
      },
    },
  })

  if (rotativosAprobados.length === 0) {
    return { cantidad: 0, eventos: [] }
  }

  const eventosInfo = rotativosAprobados.map(
    (r) => `${r.event.title} (${formatDateAR(r.event.date)})`
  )

  // Eliminar los rotativos
  await prisma.rotativo.deleteMany({
    where: {
      id: { in: rotativosAprobados.map((r) => r.id) },
    },
  })

  // Decrementar el contador de rotativosTomados
  await prisma.userSeasonBalance.update({
    where: {
      userId_seasonId: { userId, seasonId },
    },
    data: {
      rotativosTomados: {
        decrement: rotativosAprobados.length,
      },
    },
  })

  return {
    cantidad: rotativosAprobados.length,
    eventos: eventosInfo,
  }
}
