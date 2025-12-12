import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/solicitudes/[id]/rechazar - Rechazar caso especial (solo admin)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden rechazar casos especiales" },
      { status: 403 }
    )
  }

  const { id } = await params

  const solicitud = await prisma.solicitud.findUnique({
    where: { id },
  })

  if (!solicitud) {
    return NextResponse.json(
      { error: "Solicitud no encontrada" },
      { status: 404 }
    )
  }

  if (solicitud.estado !== "PENDIENTE") {
    return NextResponse.json(
      { error: "Solo se pueden rechazar solicitudes pendientes" },
      { status: 400 }
    )
  }

  const updated = await prisma.solicitud.update({
    where: { id },
    data: {
      estado: "RECHAZADA",
      aprobadoPor: session.user.id,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return NextResponse.json(updated)
}
