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

// PUT /api/licencias/[id] - Actualizar licencia (aprobar/rechazar)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { estado, startDate, endDate, type, description } = body

  const license = await prisma.license.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
    },
  })

  if (!license) {
    return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 })
  }

  // Solo admin puede aprobar/rechazar
  if (estado && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden aprobar/rechazar licencias" },
      { status: 403 }
    )
  }

  // Si el usuario quiere editar su propia licencia pendiente
  if (!estado && license.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // No se puede editar licencia ya procesada (solo admin puede cambiar estado)
  if (license.estado !== "PENDIENTE" && !estado) {
    return NextResponse.json(
      { error: "No se puede editar una licencia ya procesada" },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = {}

  // Actualizar campos si se proporcionan
  if (startDate) updateData.startDate = new Date(startDate)
  if (endDate) updateData.endDate = new Date(endDate)
  if (type) updateData.type = type
  if (description !== undefined) updateData.description = description
  if (estado) updateData.estado = estado

  // Si se aprueba, calcular rotativos y actualizar balance
  if (estado === "APROBADA" && license.estado === "PENDIENTE") {
    // Actualizar balance del usuario
    await prisma.userSeasonBalance.upsert({
      where: {
        userId_seasonId: {
          userId: license.userId,
          seasonId: license.seasonId,
        },
      },
      update: {
        rotativosPorLicencia: {
          increment: license.rotativosCalculados,
        },
      },
      create: {
        userId: license.userId,
        seasonId: license.seasonId,
        rotativosPorLicencia: license.rotativosCalculados,
        maxProyectado: 0,
      },
    })
  }

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
    action: estado ? "LICENCIA_MODIFICADA" : "LICENCIA_MODIFICADA",
    entityType: "License",
    entityId: id,
    userId: session.user.id,
    targetUserId: license.userId,
    details: {
      cambios: updateData,
      estadoAnterior: license.estado,
    },
  })

  // Notificar al usuario si cambió el estado
  if (estado && estado !== license.estado) {
    const mensaje = estado === "APROBADA"
      ? `Tu licencia del ${new Date(license.startDate).toLocaleDateString()} al ${new Date(license.endDate).toLocaleDateString()} ha sido aprobada. Se te acreditaron ${license.rotativosCalculados.toFixed(2)} rotativos.`
      : `Tu licencia del ${new Date(license.startDate).toLocaleDateString()} al ${new Date(license.endDate).toLocaleDateString()} ha sido rechazada.`

    await createNotification({
      userId: license.userId,
      type: "LICENCIA_REGISTRADA",
      title: estado === "APROBADA" ? "Licencia aprobada" : "Licencia rechazada",
      message: mensaje,
    })
  }

  return NextResponse.json(updatedLicense)
}

// DELETE /api/licencias/[id] - Eliminar licencia
export async function DELETE(
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
  })

  if (!license) {
    return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 })
  }

  // Solo admin puede eliminar cualquier licencia
  // Usuario solo puede eliminar sus propias licencias pendientes
  if (session.user.role !== "ADMIN") {
    if (license.userId !== session.user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    if (license.estado !== "PENDIENTE") {
      return NextResponse.json(
        { error: "Solo se pueden cancelar licencias pendientes" },
        { status: 400 }
      )
    }
  }

  // Si la licencia estaba aprobada, revertir el balance
  if (license.estado === "APROBADA") {
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
  }

  await prisma.license.delete({
    where: { id },
  })

  // Audit log
  await createAuditLog({
    action: "LICENCIA_MODIFICADA",
    entityType: "License",
    entityId: id,
    userId: session.user.id,
    targetUserId: license.userId,
    details: {
      accion: "eliminada",
      estado: license.estado,
    },
  })

  return NextResponse.json({ success: true })
}
