import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/equidad/candidatos-rotacion - Obtener candidatos para rotación obligatoria
// Ordena usuarios por cantidad de rotativos (menos rotativos primero)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden ver candidatos" },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get("eventId")

  // Obtener temporada activa
  const temporadaActiva = await prisma.season.findFirst({
    where: { isActive: true },
  })

  if (!temporadaActiva) {
    return NextResponse.json(
      { error: "No hay temporada activa" },
      { status: 400 }
    )
  }

  // Si hay eventId, excluir usuarios que ya tienen rotativo en ese evento
  let usuariosExcluidos: string[] = []
  let eventoInfo = null

  if (eventId) {
    const evento = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        rotativos: {
          where: {
            estado: { notIn: ["RECHAZADO", "CANCELADO"] },
          },
          select: { userId: true },
        },
        titulo: {
          select: { name: true },
        },
      },
    })

    if (evento) {
      usuariosExcluidos = evento.rotativos.map((r) => r.userId)
      eventoInfo = {
        id: evento.id,
        title: evento.title,
        date: evento.date,
        titulo: evento.titulo?.name,
        rotativosActuales: evento.rotativos.length,
      }
    }
  }

  // Obtener balances de integrantes (excluyendo admins)
  const balances = await prisma.userSeasonBalance.findMany({
    where: {
      seasonId: temporadaActiva.id,
      user: {
        role: "INTEGRANTE",
        ...(usuariosExcluidos.length > 0
          ? { id: { notIn: usuariosExcluidos } }
          : {}),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          alias: true,
          email: true,
        },
      },
    },
  })

  // Calcular máximo proyectado en tiempo real
  const titulos = await prisma.titulo.findMany({
    where: { seasonId: temporadaActiva.id },
    include: { events: { select: { cupoOverride: true } } },
  })
  let totalCuposDisponibles = 0
  for (const titulo of titulos) {
    for (const ev of titulo.events) {
      totalCuposDisponibles += ev.cupoOverride ?? titulo.cupo
    }
  }
  const totalIntegrantes = await prisma.user.count()
  const maxProyectadoCalculado = totalIntegrantes > 0
    ? Math.max(1, Math.floor(totalCuposDisponibles / totalIntegrantes))
    : 1

  // Calcular totales y ordenar por menor cantidad de rotativos
  const candidatos = balances
    .map((b) => ({
      userId: b.userId,
      userName: b.user.alias || b.user.name || b.user.email,
      email: b.user.email,
      total: b.rotativosTomados + b.rotativosObligatorios + b.rotativosPorLicencia,
      rotativosTomados: b.rotativosTomados,
      rotativosObligatorios: b.rotativosObligatorios,
      rotativosPorLicencia: b.rotativosPorLicencia,
      maxProyectado: b.maxAjustadoManual ?? maxProyectadoCalculado,
    }))
    .sort((a, b) => a.total - b.total) // Ordenar de menor a mayor

  // Calcular promedio para contexto
  const totales = candidatos.map((c) => c.total)
  const promedio =
    totales.length > 0
      ? totales.reduce((a, b) => a + b, 0) / totales.length
      : 0

  // Marcar si están por debajo del promedio
  const candidatosConInfo = candidatos.map((c) => ({
    ...c,
    porDebajoDelPromedio: c.total < promedio,
    diferenciaConPromedio: Math.round(promedio - c.total),
  }))

  return NextResponse.json({
    evento: eventoInfo,
    temporada: temporadaActiva.name,
    promedioGrupo: Math.round(promedio * 10) / 10,
    totalCandidatos: candidatosConInfo.length,
    candidatos: candidatosConInfo,
    criterio: "MENOS_ROTATIVOS",
    nota: "Los candidatos están ordenados de menor a mayor cantidad de rotativos. Se recomienda asignar a quienes tienen menos rotativos para mantener la equidad.",
  })
}
