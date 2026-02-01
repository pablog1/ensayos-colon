import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/equidad/verificar - Verificar equilibrio de rotativos y detectar usuarios por debajo
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden verificar la equidad" },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(req.url)
  const umbralDiferencia = parseInt(searchParams.get("umbral") || "5")

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

  // Obtener todos los balances de la temporada
  const balances = await prisma.userSeasonBalance.findMany({
    where: { seasonId: temporadaActiva.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          alias: true,
          email: true,
          role: true,
        },
      },
    },
  })

  // Filtrar solo integrantes (excluir admins del cálculo de equidad)
  const balancesIntegrantes = balances.filter(
    (b) => b.user.role === "INTEGRANTE"
  )

  if (balancesIntegrantes.length === 0) {
    return NextResponse.json({
      message: "No hay integrantes con balance en esta temporada",
      usuariosPorDebajo: [],
      estadisticas: null,
    })
  }

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

  // Calcular totales de cada usuario
  const usuariosConTotales = balancesIntegrantes.map((b) => ({
    userId: b.userId,
    userName: b.user.alias || b.user.name || b.user.email,
    total: b.rotativosTomados + b.rotativosObligatorios + b.rotativosPorLicencia,
    rotativosTomados: b.rotativosTomados,
    rotativosObligatorios: b.rotativosObligatorios,
    rotativosPorLicencia: b.rotativosPorLicencia,
    maxProyectado: maxProyectadoCalculado, // Siempre usar el calculado en tiempo real
  }))

  // Calcular estadísticas del grupo
  const totales = usuariosConTotales.map((u) => u.total)
  const promedio = totales.reduce((a, b) => a + b, 0) / totales.length
  const maximo = Math.max(...totales)
  const minimo = Math.min(...totales)

  // Detectar usuarios por debajo del promedio (según umbral)
  const usuariosPorDebajo = usuariosConTotales
    .filter((u) => promedio - u.total >= umbralDiferencia)
    .map((u) => ({
      ...u,
      diferencia: Math.round(promedio - u.total),
      porcentajeDelPromedio: Math.round((u.total / promedio) * 100),
    }))
    .sort((a, b) => a.total - b.total) // Ordenar de menor a mayor

  // Detectar usuarios por encima del promedio
  const usuariosPorEncima = usuariosConTotales
    .filter((u) => u.total - promedio >= umbralDiferencia)
    .map((u) => ({
      ...u,
      diferencia: Math.round(u.total - promedio),
      porcentajeDelPromedio: Math.round((u.total / promedio) * 100),
    }))
    .sort((a, b) => b.total - a.total) // Ordenar de mayor a menor

  return NextResponse.json({
    temporada: temporadaActiva.name,
    estadisticas: {
      totalIntegrantes: balancesIntegrantes.length,
      promedio: Math.round(promedio * 10) / 10,
      maximo,
      minimo,
      rangoEquidad: maximo - minimo,
    },
    usuariosPorDebajo,
    usuariosPorEncima,
    todosLosUsuarios: usuariosConTotales.sort((a, b) => a.total - b.total),
  })
}

// POST /api/equidad/verificar - Ejecutar verificación y enviar notificaciones
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo administradores pueden ejecutar verificación de equidad" },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { umbralDiferencia = 5 } = body

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

  // Obtener balances de integrantes
  const balances = await prisma.userSeasonBalance.findMany({
    where: { seasonId: temporadaActiva.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          alias: true,
          email: true,
          role: true,
        },
      },
    },
  })

  const balancesIntegrantes = balances.filter(
    (b) => b.user.role === "INTEGRANTE"
  )

  if (balancesIntegrantes.length === 0) {
    return NextResponse.json({
      message: "No hay integrantes para verificar",
      notificacionesEnviadas: 0,
    })
  }

  // Calcular totales y promedio
  const usuariosConTotales = balancesIntegrantes.map((b) => ({
    userId: b.userId,
    userName: b.user.alias || b.user.name || b.user.email,
    total: b.rotativosTomados + b.rotativosObligatorios + b.rotativosPorLicencia,
  }))

  const totales = usuariosConTotales.map((u) => u.total)
  const promedio = totales.reduce((a, b) => a + b, 0) / totales.length

  // Detectar usuarios por debajo
  const usuariosPorDebajo = usuariosConTotales.filter(
    (u) => promedio - u.total >= umbralDiferencia
  )

  return NextResponse.json({
    success: true,
    message: `Se verificó la equidad de ${balancesIntegrantes.length} integrantes`,
    promedio: Math.round(promedio * 10) / 10,
    usuariosPorDebajo: usuariosPorDebajo.map((u) => ({
      nombre: u.userName,
      total: u.total,
      diferencia: Math.round(promedio - u.total),
    })),
  })
}
