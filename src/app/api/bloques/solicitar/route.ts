import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/bloques/solicitar - Solicitar bloque completo de un título
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()
  const { tituloId, validate } = body

  if (!tituloId) {
    return NextResponse.json({ error: "tituloId es requerido" }, { status: 400 })
  }

  // Obtener el título con TODOS sus eventos (funciones y ensayos)
  const titulo = await prisma.titulo.findUnique({
    where: { id: tituloId },
    include: {
      events: {
        include: {
          rotativos: {
            select: { userId: true, estado: true },
          },
        },
        orderBy: { date: "asc" },
      },
      season: true,
    },
  })

  if (!titulo) {
    return NextResponse.json({ error: "Título no encontrado" }, { status: 404 })
  }

  const eventos = titulo.events
  if (eventos.length === 0) {
    return NextResponse.json(
      { error: "Este título no tiene eventos programados" },
      { status: 400 }
    )
  }

  // Verificar temporada activa
  const temporadaActiva = await prisma.season.findFirst({
    where: { isActive: true },
  })

  if (!temporadaActiva) {
    return NextResponse.json(
      { error: "No hay temporada activa" },
      { status: 400 }
    )
  }

  // ============================================
  // VALIDACIONES
  // ============================================
  const motivosAprobacion: string[] = []

  // 1. Verificar si el usuario ya tiene rotativos en eventos de este título
  const rotativosEnTitulo = eventos.reduce((count, evento) => {
    const tieneRotativo = evento.rotativos.some(
      (r) => r.userId === session.user.id && (r.estado === "APROBADO" || r.estado === "PENDIENTE")
    )
    return count + (tieneRotativo ? 1 : 0)
  }, 0)

  if (rotativosEnTitulo > 0) {
    return NextResponse.json(
      { error: `Ya tienes ${rotativosEnTitulo} rotativo(s) en eventos de este título` },
      { status: 400 }
    )
  }

  // 2. Verificar balance del usuario para la temporada
  const balance = await prisma.userSeasonBalance.findUnique({
    where: {
      userId_seasonId: {
        userId: session.user.id,
        seasonId: temporadaActiva.id,
      },
    },
  })

  // 3. Verificar regla BLOQUE_EXCLUSIVO
  const reglaBloqueExclusivo = await prisma.ruleConfig.findUnique({
    where: { key: "BLOQUE_EXCLUSIVO" },
  })

  if (reglaBloqueExclusivo?.enabled) {
    const config = JSON.parse(reglaBloqueExclusivo.value)
    const maxPorPersona = config.maxPorPersona ?? 1

    // Verificar si ya usó su bloque esta temporada
    if (balance?.bloqueUsado) {
      return NextResponse.json(
        { error: `Ya utilizaste tu bloque de esta temporada (máximo ${maxPorPersona} por año)` },
        { status: 400 }
      )
    }

    // Verificar si el bloque ya está asignado a otro usuario
    const bloqueExistente = await prisma.block.findFirst({
      where: {
        name: titulo.name,
        seasonId: temporadaActiva.id,
        assignedToId: { not: null },
      },
      include: {
        assignedTo: { select: { name: true } },
      },
    })

    if (bloqueExistente && bloqueExistente.assignedToId !== session.user.id) {
      return NextResponse.json(
        { error: `Este bloque ya fue solicitado por ${bloqueExistente.assignedTo?.name ?? "otro integrante"}` },
        { status: 400 }
      )
    }
  }

  // 4. Verificar MAX_PROYECTADO (cada función del bloque cuenta)
  const reglaMaxProyectado = await prisma.ruleConfig.findUnique({
    where: { key: "MAX_PROYECTADO" },
  })

  if (reglaMaxProyectado?.enabled && balance) {
    const maxEfectivo = balance.maxAjustadoManual ?? balance.maxProyectado
    const totalActual =
      balance.rotativosTomados +
      balance.rotativosObligatorios +
      balance.rotativosPorLicencia

    if (totalActual + eventos.length > maxEfectivo) {
      motivosAprobacion.push(
        `Excede máximo proyectado anual (${totalActual + eventos.length}/${maxEfectivo})`
      )
    }
  }

  // 5. Verificar cupo disponible en cada evento
  const eventosSinCupo: string[] = []
  for (const evento of eventos) {
    const rotativosActivos = evento.rotativos.filter(
      (r) => r.estado === "APROBADO" || r.estado === "PENDIENTE"
    ).length
    const cupoEfectivo = evento.cupoOverride ?? titulo.cupo
    if (rotativosActivos >= cupoEfectivo) {
      eventosSinCupo.push(
        new Date(evento.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
      )
    }
  }

  if (eventosSinCupo.length > 0) {
    motivosAprobacion.push(
      `Sin cupo disponible en ${eventosSinCupo.length} evento(s): ${eventosSinCupo.slice(0, 3).join(", ")}${eventosSinCupo.length > 3 ? "..." : ""}`
    )
  }

  // Si solo es validación, retornar resultado
  if (validate) {
    const requiereAprobacion = motivosAprobacion.length > 0
    return NextResponse.json({
      requiereAprobacion,
      motivos: motivosAprobacion,
      motivoTexto: motivosAprobacion.join("; "),
      eventos: eventos.map((e) => ({
        id: e.id,
        date: e.date,
        startTime: e.startTime,
        eventoType: e.eventoType,
      })),
      totalEventos: eventos.length,
    })
  }

  // ============================================
  // CREAR ROTATIVOS
  // ============================================
  const estado = motivosAprobacion.length > 0 ? "PENDIENTE" : "APROBADO"
  const motivoTexto = motivosAprobacion.length > 0 ? motivosAprobacion.join("; ") : null

  // Crear o actualizar bloque
  let bloque = await prisma.block.findFirst({
    where: {
      name: titulo.name,
      seasonId: temporadaActiva.id,
    },
  })

  if (!bloque) {
    bloque = await prisma.block.create({
      data: {
        name: titulo.name,
        seasonId: temporadaActiva.id,
        startDate: titulo.startDate,
        endDate: titulo.endDate,
        assignedToId: session.user.id,
        estado: estado === "APROBADO" ? "APROBADO" : "SOLICITADO",
      },
    })
  } else {
    bloque = await prisma.block.update({
      where: { id: bloque.id },
      data: {
        assignedToId: session.user.id,
        estado: estado === "APROBADO" ? "APROBADO" : "SOLICITADO",
      },
    })
  }

  // Crear rotativos para cada evento con cupo disponible
  const rotativosCreados: string[] = []
  const eventosSaltados: string[] = []

  for (const evento of eventos) {
    const rotativosActivos = evento.rotativos.filter(
      (r) => r.estado === "APROBADO" || r.estado === "PENDIENTE"
    ).length
    const cupoEfectivo = evento.cupoOverride ?? titulo.cupo

    if (rotativosActivos < cupoEfectivo) {
      await prisma.rotativo.create({
        data: {
          userId: session.user.id,
          eventId: evento.id,
          esParteDeBloqueId: bloque.id,
          estado,
          motivo: motivoTexto,
        },
      })
      rotativosCreados.push(evento.id)
    } else {
      eventosSaltados.push(evento.id)
    }
  }

  // Marcar que el usuario usó su bloque si fue aprobado
  if (estado === "APROBADO" && balance) {
    await prisma.userSeasonBalance.update({
      where: { id: balance.id },
      data: { bloqueUsado: true },
    })
  }

  return NextResponse.json({
    success: true,
    estado,
    motivo: motivoTexto,
    bloqueId: bloque.id,
    rotativosCreados: rotativosCreados.length,
    eventosSaltados: eventosSaltados.length,
    message: estado === "APROBADO"
      ? `Bloque aprobado. ${rotativosCreados.length} rotativos creados.`
      : `Bloque pendiente de aprobación. ${rotativosCreados.length} rotativos en espera.`,
  })
}
