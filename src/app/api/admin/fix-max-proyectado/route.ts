import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/admin/fix-max-proyectado - Recalcular maxProyectado para todos los usuarios
// Parámetro opcional: ?all=true para recalcular todos, sin parámetro solo los que tienen 0
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const recalcularTodos = searchParams.get("all") === "true"

  // Obtener temporada activa
  const temporadaActiva = await prisma.season.findFirst({
    where: { isActive: true },
  })

  if (!temporadaActiva) {
    return NextResponse.json({ error: "No hay temporada activa" }, { status: 400 })
  }

  // Calcular el máximo proyectado correcto
  const titulos = await prisma.titulo.findMany({
    where: { seasonId: temporadaActiva.id },
    include: { events: { select: { cupoOverride: true } } },
  })

  let totalCupos = 0
  for (const t of titulos) {
    for (const e of t.events) {
      totalCupos += e.cupoOverride ?? t.cupo
    }
  }

  const totalIntegrantes = await prisma.user.count()
  const maxProyectadoCorrecto = totalIntegrantes > 0
    ? Math.max(1, Math.round(totalCupos / totalIntegrantes))
    : 1

  // Determinar qué registros actualizar
  const whereCondition = recalcularTodos
    ? {
        seasonId: temporadaActiva.id,
        maxAjustadoManual: null, // No tocar los que tienen ajuste manual
      }
    : {
        seasonId: temporadaActiva.id,
        maxProyectado: 0,
        maxAjustadoManual: null,
      }

  // Obtener registros antes de actualizar
  const registrosAActualizar = await prisma.userSeasonBalance.findMany({
    where: whereCondition,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  })

  if (registrosAActualizar.length === 0) {
    return NextResponse.json({
      message: "No hay registros que actualizar",
      maxProyectadoCalculado: maxProyectadoCorrecto,
      totalCupos,
      totalIntegrantes,
    })
  }

  // Actualizar registros
  const updateResult = await prisma.userSeasonBalance.updateMany({
    where: whereCondition,
    data: {
      maxProyectado: maxProyectadoCorrecto,
    },
  })

  return NextResponse.json({
    message: `Se actualizaron ${updateResult.count} registros`,
    maxProyectadoAsignado: maxProyectadoCorrecto,
    totalCupos,
    totalIntegrantes,
    modo: recalcularTodos ? "todos" : "solo con valor 0",
    usuariosActualizados: registrosAActualizar.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      maxProyectadoAnterior: r.maxProyectado,
    })),
  })
}

// GET /api/admin/fix-max-proyectado - Ver estado actual de todos los balances
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
  }

  const temporadaActiva = await prisma.season.findFirst({
    where: { isActive: true },
  })

  if (!temporadaActiva) {
    return NextResponse.json({ error: "No hay temporada activa" }, { status: 400 })
  }

  // Calcular el máximo proyectado correcto
  const titulos = await prisma.titulo.findMany({
    where: { seasonId: temporadaActiva.id },
    include: { events: { select: { cupoOverride: true } } },
  })

  let totalCupos = 0
  let totalEventos = 0
  for (const t of titulos) {
    for (const e of t.events) {
      totalCupos += e.cupoOverride ?? t.cupo
      totalEventos++
    }
  }

  const totalIntegrantes = await prisma.user.count()
  const maxProyectadoCorrecto = totalIntegrantes > 0
    ? Math.max(1, Math.round(totalCupos / totalIntegrantes))
    : 1

  // Obtener todos los balances de la temporada
  const balances = await prisma.userSeasonBalance.findMany({
    where: { seasonId: temporadaActiva.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  })

  // Contar problemas
  const conMaxCero = balances.filter(b => b.maxProyectado === 0 && !b.maxAjustadoManual)
  const conMaxIncorrecto = balances.filter(b =>
    b.maxProyectado !== maxProyectadoCorrecto &&
    !b.maxAjustadoManual
  )

  return NextResponse.json({
    temporada: temporadaActiva.name,
    estadisticas: {
      totalTitulos: titulos.length,
      totalEventos,
      totalCupos,
      totalIntegrantes,
      maxProyectadoCorrecto,
    },
    problemas: {
      conMaxCero: conMaxCero.length,
      conMaxIncorrecto: conMaxIncorrecto.length,
    },
    balances: balances.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      maxProyectado: r.maxProyectado,
      maxAjustadoManual: r.maxAjustadoManual,
      rotativosTomados: r.rotativosTomados,
      esCorrecto: r.maxAjustadoManual !== null || r.maxProyectado === maxProyectadoCorrecto,
    })),
  })
}
