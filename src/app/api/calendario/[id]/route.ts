import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCupoParaEvento } from "@/lib/services/cupo-rules"

// GET /api/calendario/[id] - Obtener evento individual
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  const evento = await prisma.event.findUnique({
    where: { id },
    include: {
      titulo: {
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
        },
      },
      rotativos: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              alias: true,
            },
          },
        },
      },
    },
  })

  if (!evento) {
    return NextResponse.json(
      { error: "Evento no encontrado" },
      { status: 404 }
    )
  }

  // Obtener cupo de reglas
  const cupoDeReglas = await getCupoParaEvento(
    evento.eventoType,
    evento.titulo?.type ?? null
  )
  const cupoEfectivo = evento.cupoOverride ?? cupoDeReglas

  return NextResponse.json({
    ...evento,
    cupoEfectivo,
    cupoDisponible: cupoEfectivo - evento.rotativos.length,
  })
}

// PUT /api/calendario/[id] - Actualizar evento (solo admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { date, eventoType, ensayoTipo, cupoOverride, notes, startTime, endTime } = body

    const evento = await prisma.event.findUnique({
      where: { id },
      include: { titulo: true },
    })

    if (!evento) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 }
      )
    }

    const updateData: {
      date?: Date
      eventoType?: "ENSAYO" | "FUNCION"
      cupoOverride?: number | null
      description?: string | null
      startTime?: Date
      endTime?: Date
      title?: string
    } = {}

    if (date) {
      // Parsear fecha como mediodía UTC para evitar problemas de timezone
      const [year, month, day] = date.split('-').map(Number)
      const newDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

      // Si el evento pertenece a un título, validar que la nueva fecha esté dentro del rango
      if (evento.titulo) {
        const tituloStart = new Date(evento.titulo.startDate)
        const tituloEnd = new Date(evento.titulo.endDate)

        const newDateStr = newDate.toISOString().split('T')[0]
        const tituloStartStr = tituloStart.toISOString().split('T')[0]
        const tituloEndStr = tituloEnd.toISOString().split('T')[0]

        if (newDateStr < tituloStartStr || newDateStr > tituloEndStr) {
          return NextResponse.json(
            { error: `La fecha debe estar dentro del rango del título (${tituloStartStr} - ${tituloEndStr})` },
            { status: 400 }
          )
        }
      }

      updateData.date = newDate
    }

    if (eventoType) {
      if (!["ENSAYO", "FUNCION"].includes(eventoType)) {
        return NextResponse.json(
          { error: "Tipo de evento invalido" },
          { status: 400 }
        )
      }
      updateData.eventoType = eventoType
      // Actualizar titulo del evento
      if (evento.titulo) {
        if (eventoType === "FUNCION") {
          updateData.title = `${evento.titulo.name} - Función`
        } else {
          // Para ensayos, usar el subtipo
          const ensayoLabel = ensayoTipo === "PRE_GENERAL" ? "Pre General"
                            : ensayoTipo === "GENERAL" ? "Ensayo General"
                            : "Ensayo"
          updateData.title = `${evento.titulo.name} - ${ensayoLabel}`
        }
      }
    }

    if (cupoOverride !== undefined) {
      updateData.cupoOverride = cupoOverride === null ? null : cupoOverride
    }

    if (notes !== undefined) {
      updateData.description = notes || null
    }

    if (startTime) {
      updateData.startTime = new Date(startTime)
    }

    if (endTime) {
      updateData.endTime = new Date(endTime)
    }

    // Verificar que no exista otro evento a la misma hora en la misma fecha (excluyendo el actual)
    const fechaVerificar = updateData.date || evento.date
    const horaVerificar = updateData.startTime || evento.startTime

    const eventoConflicto = await prisma.event.findFirst({
      where: {
        id: { not: id },
        date: fechaVerificar,
        startTime: horaVerificar,
      },
    })

    if (eventoConflicto) {
      return NextResponse.json(
        { error: "Ya existe un evento a la misma hora en esta fecha" },
        { status: 400 }
      )
    }

    const updated = await prisma.event.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error actualizando evento:", error)
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    return NextResponse.json(
      { error: `Error interno: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// DELETE /api/calendario/[id] - Eliminar evento (solo admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { id } = await params

    const evento = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: { select: { rotativos: true } },
      },
    })

    if (!evento) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 }
      )
    }

    // Advertir si hay rotativos asignados
    if (evento._count.rotativos > 0) {
      // Eliminar rotativos asociados primero
      await prisma.rotativo.deleteMany({
        where: { eventId: id },
      })
    }

    await prisma.event.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error eliminando evento:", error)
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    return NextResponse.json(
      { error: `Error interno: ${errorMessage}` },
      { status: 500 }
    )
  }
}
