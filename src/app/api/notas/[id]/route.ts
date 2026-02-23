import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit"
import { formatDateAR } from "@/lib/utils"

// GET /api/notas/[id] - Obtener nota especifica
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  const nota = await prisma.note.findUnique({
    where: { id },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          date: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!nota) {
    return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 })
  }

  return NextResponse.json(nota)
}

// PUT /api/notas/[id] - Actualizar nota (solo admin)
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
      { error: "Solo administradores pueden editar notas" },
      { status: 403 }
    )
  }

  const { id } = await params
  const body = await req.json()
  const { date, title, description, color, eventId } = body

  const nota = await prisma.note.findUnique({
    where: { id },
  })

  if (!nota) {
    return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 })
  }

  // Construir datos de actualizacion
  const updateData: Record<string, unknown> = {}
  if (date) updateData.date = new Date(date)
  if (title) updateData.title = title
  if (description !== undefined) updateData.description = description
  if (color) updateData.color = color
  if (eventId !== undefined) updateData.eventId = eventId || null

  // Calcular cambios para el audit log
  const cambios: Record<string, { anterior: unknown; nuevo: unknown }> = {}
  if (date && new Date(date).toISOString() !== nota.date.toISOString()) {
    cambios.fecha = { anterior: nota.date.toISOString(), nuevo: new Date(date).toISOString() }
  }
  if (title && title !== nota.title) {
    cambios.titulo = { anterior: nota.title, nuevo: title }
  }
  if (description !== undefined && description !== (nota.description || "")) {
    cambios.descripcion = { anterior: nota.description || null, nuevo: description || null }
  }
  if (color && color !== nota.color) {
    cambios.color = { anterior: nota.color, nuevo: color }
  }

  const notaActualizada = await prisma.note.update({
    where: { id },
    data: updateData,
    include: {
      event: {
        select: {
          id: true,
          title: true,
          date: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  // Audit log si hubo cambios
  if (Object.keys(cambios).length > 0) {
    await createAuditLog({
      action: "NOTA_EDITADA",
      entityType: "Note",
      entityId: id,
      userId: session.user.id,
      details: {
        titulo: nota.title,
        fecha: nota.date.toISOString(),
        cambios,
      },
    })
  }

  return NextResponse.json(notaActualizada)
}

// DELETE /api/notas/[id] - Eliminar nota (solo admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden eliminar notas" },
      { status: 403 }
    )
  }

  const { id } = await params

  const nota = await prisma.note.findUnique({
    where: { id },
  })

  if (!nota) {
    return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 })
  }

  // Audit log antes de eliminar
  await createAuditLog({
    action: "NOTA_ELIMINADA",
    entityType: "Note",
    entityId: id,
    userId: session.user.id,
    details: {
      titulo: nota.title,
      descripcion: nota.description || null,
      fecha: nota.date.toISOString(),
    },
  })

  await prisma.note.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
