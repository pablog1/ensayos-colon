import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"

// PUT /api/integrantes/[id]/balance - Modificar asignación inicial de un integrante
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden modificar balances" },
      { status: 403 }
    )
  }

  const { id: userId } = await params
  const body = await req.json()
  const { asignacionInicialRotativos, asignacionJustificacion, seasonId } = body

  if (asignacionInicialRotativos === undefined || !seasonId) {
    return NextResponse.json(
      { error: "asignacionInicialRotativos y seasonId son requeridos" },
      { status: 400 }
    )
  }

  // Verificar que el usuario existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, alias: true },
  })

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  // Buscar o crear el balance de temporada
  let balance = await prisma.userSeasonBalance.findUnique({
    where: {
      userId_seasonId: {
        userId,
        seasonId,
      },
    },
  })

  if (!balance) {
    // Crear balance inicial con ajuste manual (para integrantes con asignación especial)
    balance = await prisma.userSeasonBalance.create({
      data: {
        userId,
        seasonId,
        maxAjustadoManual: asignacionInicialRotativos,
        asignacionInicialRotativos,
        asignacionFechaCalculo: new Date(),
        asignacionJustificacion,
        asignacionModificadaPor: session.user.id,
      },
    })
  } else {
    // Actualizar balance existente
    balance = await prisma.userSeasonBalance.update({
      where: { id: balance.id },
      data: {
        asignacionInicialRotativos,
        asignacionFechaCalculo: new Date(),
        asignacionJustificacion,
        asignacionModificadaPor: session.user.id,
      },
    })
  }

  // Registrar en audit log
  await createAuditLog({
    action: "BALANCE_AJUSTADO",
    entityType: "UserSeasonBalance",
    entityId: balance.id,
    userId: session.user.id,
    targetUserId: userId,
    isCritical: true,
    details: {
      asignacionInicialRotativos,
      asignacionJustificacion,
      seasonId,
      userName: user.alias || user.name,
    },
  })

  return NextResponse.json({
    success: true,
    balance: {
      id: balance.id,
      asignacionInicialRotativos: balance.asignacionInicialRotativos,
      asignacionJustificacion: balance.asignacionJustificacion,
      asignacionFechaCalculo: balance.asignacionFechaCalculo,
    },
  })
}

// GET /api/integrantes/[id]/balance - Obtener balance de un integrante
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id: userId } = await params
  const { searchParams } = new URL(req.url)
  const seasonId = searchParams.get("seasonId")

  if (!seasonId) {
    return NextResponse.json(
      { error: "seasonId es requerido" },
      { status: 400 }
    )
  }

  const balance = await prisma.userSeasonBalance.findUnique({
    where: {
      userId_seasonId: {
        userId,
        seasonId,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          alias: true,
        },
      },
    },
  })

  if (!balance) {
    return NextResponse.json({ error: "Balance no encontrado" }, { status: 404 })
  }

  // Obtener nombre del admin que modificó
  let modificadoPor = null
  if (balance.asignacionModificadaPor) {
    const admin = await prisma.user.findUnique({
      where: { id: balance.asignacionModificadaPor },
      select: { name: true, alias: true },
    })
    modificadoPor = admin?.alias || admin?.name || null
  }

  return NextResponse.json({
    id: balance.id,
    userId: balance.userId,
    seasonId: balance.seasonId,
    maxAjustadoManual: balance.maxAjustadoManual,
    asignacionInicialRotativos: balance.asignacionInicialRotativos,
    asignacionFechaCalculo: balance.asignacionFechaCalculo,
    asignacionJustificacion: balance.asignacionJustificacion,
    asignacionModificadaPor: modificadoPor,
    user: balance.user,
  })
}
