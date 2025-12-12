import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validarSolicitud } from "@/lib/rules/descanso-rules"

// GET /api/solicitudes - Lista solicitudes
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get("mes")
  const userId = searchParams.get("userId")
  const verTodas = searchParams.get("todas") === "true"

  let fechaFilter = {}
  if (mes) {
    const [year, month] = mes.split("-").map(Number)
    const inicioMes = new Date(year, month - 1, 1)
    const finMes = new Date(year, month, 0)
    fechaFilter = {
      fecha: {
        gte: inicioMes,
        lte: finMes,
      },
    }
  }

  // Si todas=true, mostrar todas las solicitudes (para calendario general)
  // Si no, admin puede ver todas, integrante solo las suyas
  let userFilter = {}
  if (!verTodas) {
    userFilter =
      session.user.role === "ADMIN"
        ? userId
          ? { userId }
          : {}
        : { userId: session.user.id }
  }

  const solicitudes = await prisma.solicitud.findMany({
    where: {
      ...fechaFilter,
      ...userFilter,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          alias: true,
          avatar: true,
        },
      },
    },
    orderBy: { fecha: "desc" },
  })

  return NextResponse.json(solicitudes)
}

// POST /api/solicitudes - Crear solicitud
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()
  const { fecha, motivo } = body

  if (!fecha) {
    return NextResponse.json({ error: "Fecha es requerida" }, { status: 400 })
  }

  const fechaDate = new Date(fecha)

  // Verificar que la fecha no sea pasada
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  if (fechaDate < hoy) {
    return NextResponse.json(
      { error: "No se pueden solicitar descansos en fechas pasadas" },
      { status: 400 }
    )
  }

  // Verificar que no exista una solicitud para esa fecha
  const existente = await prisma.solicitud.findUnique({
    where: {
      userId_fecha: {
        userId: session.user.id,
        fecha: fechaDate,
      },
    },
  })

  if (existente) {
    return NextResponse.json(
      { error: "Ya existe una solicitud para esta fecha" },
      { status: 400 }
    )
  }

  // Validar regla del 5%
  const validacion = await validarSolicitud(session.user.id, fechaDate)

  const solicitud = await prisma.solicitud.create({
    data: {
      userId: session.user.id,
      fecha: fechaDate,
      motivo: motivo || null,
      estado: validacion.autoApprove ? "APROBADA" : "PENDIENTE",
      esCasoEspecial: validacion.esCasoEspecial,
      porcentajeAlMomento: validacion.porcentaje,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          alias: true,
          avatar: true,
        },
      },
    },
  })

  return NextResponse.json({
    solicitud,
    validacion,
  })
}
