import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"
import { createNotification } from "@/lib/services/notifications"

// GET /api/licencias/[id] - Obtener licencia específica
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  const license = await prisma.license.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, alias: true },
      },
      season: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, name: true },
      },
    },
  })

  if (!license) {
    return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 })
  }

  // Solo admin o el propio usuario pueden ver la licencia
  if (session.user.role !== "ADMIN" && license.userId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  return NextResponse.json(license)
}

// PUT /api/licencias/[id] - Actualizar licencia (solo admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Solo admin puede editar licencias
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden editar licencias" },
      { status: 403 }
    )
  }

  const { id } = await params
  const body = await req.json()
  const { startDate, endDate, description } = body

  const license = await prisma.license.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
    },
  })

  if (!license) {
    return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {}

  // Actualizar campos si se proporcionan
  if (startDate) updateData.startDate = new Date(startDate)
  if (endDate) updateData.endDate = new Date(endDate)
  if (description !== undefined) updateData.description = description

  const updatedLicense = await prisma.license.update({
    where: { id },
    data: updateData,
    include: {
      user: { select: { id: true, name: true, email: true, alias: true } },
      season: { select: { id: true, name: true } },
    },
  })

  // Audit log
  await createAuditLog({
    action: "LICENCIA_MODIFICADA",
    entityType: "License",
    entityId: id,
    userId: session.user.id,
    targetUserId: license.userId,
    details: {
      cambios: updateData,
    },
  })

  return NextResponse.json(updatedLicense)
}

// DELETE /api/licencias/[id] - Eliminar licencia (solo admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Solo admin puede eliminar licencias
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden eliminar licencias" },
      { status: 403 }
    )
  }

  const { id } = await params

  const license = await prisma.license.findUnique({
    where: { id },
  })

  if (!license) {
    return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 })
  }

  // Revertir el balance
  await prisma.userSeasonBalance.update({
    where: {
      userId_seasonId: {
        userId: license.userId,
        seasonId: license.seasonId,
      },
    },
    data: {
      rotativosPorLicencia: {
        decrement: license.rotativosCalculados,
      },
    },
  })

  await prisma.license.delete({
    where: { id },
  })

  // Audit log
  await createAuditLog({
    action: "LICENCIA_ELIMINADA",
    entityType: "License",
    entityId: id,
    userId: session.user.id,
    targetUserId: license.userId,
    details: {
      rotativosRevertidos: license.rotativosCalculados,
    },
  })

  return NextResponse.json({ success: true })
}
