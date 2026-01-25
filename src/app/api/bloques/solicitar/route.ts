import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCupoParaEvento } from "@/lib/services/cupo-rules"

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

  // 1. Verificar cuántos rotativos ya tiene el usuario en este título
  // y filtrar los eventos donde NO tiene rotativo (para completar el bloque)
  const eventosSinRotativoPropio = eventos.filter((evento) => {
    const tieneRotativo = evento.rotativos.some(
      (r) => r.userId === session.user.id && (r.estado === "APROBADO" || r.estado === "PENDIENTE")
    )
    return !tieneRotativo
  })

  const rotativosExistentes = eventos.length - eventosSinRotativoPropio.length

  // Si ya tiene todos los rotativos del bloque, no puede solicitar más
  if (eventosSinRotativoPropio.length === 0) {
    return NextResponse.json(
      { error: "Ya tienes rotativos en todos los eventos de este título (bloque completo)" },
      { status: 400 }
    )
  }

  // Usar solo los eventos donde no tiene rotativo para el resto del proceso
  const eventosParaSolicitar = eventosSinRotativoPropio

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

  // Obtener cupo para este tipo de título (ej: conciertos = 2)
  const cupoDelTitulo = await getCupoParaEvento(null, titulo.type)

  if (reglaBloqueExclusivo?.enabled) {
    const config = JSON.parse(reglaBloqueExclusivo.value)
    const maxPorPersona = config.maxPorPersona ?? 1

    // Verificar si ya usó su bloque esta temporada - advertir pero permitir
    if (balance?.bloqueUsado) {
      motivosAprobacion.push(
        `Ya utilizaste tu bloque de esta temporada (máximo ${maxPorPersona} por año). Requiere aprobación del administrador.`
      )
    }

    // Verificar cuántos usuarios ya tienen este bloque asignado
    const bloquesAsignados = await prisma.block.findMany({
      where: {
        name: titulo.name,
        seasonId: temporadaActiva.id,
        assignedToId: { not: null },
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    })

    // Filtrar los bloques de otros usuarios (no el propio)
    const bloquesDeOtros = bloquesAsignados.filter(b => b.assignedToId !== session.user.id)

    // Si ya hay tantos bloques asignados como cupo permite, advertir pero permitir
    if (bloquesDeOtros.length >= cupoDelTitulo) {
      const nombresAsignados = bloquesDeOtros.map(b => b.assignedTo?.name).filter(Boolean).join(", ")
      motivosAprobacion.push(
        `Este bloque ya tiene ${bloquesDeOtros.length} asignaciones (cupo: ${cupoDelTitulo}). Asignados a: ${nombresAsignados}. Requiere aprobación del administrador.`
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

    // Verificar si el usuario ya agotó sus rotativos
    if (totalActual >= maxEfectivo) {
      // Usuario sin rotativos disponibles pero solicita bloque completo
      // El bloque solo se puede pedir completo, así que pasa a revisión del admin
      motivosAprobacion.push(
        `Rotativos agotados (${totalActual}/${maxEfectivo}). Solicitud de bloque completo requiere revisión del administrador.`
      )
    } else if (totalActual + eventosParaSolicitar.length > maxEfectivo) {
      motivosAprobacion.push(
        `Excede máximo proyectado anual (${totalActual + eventosParaSolicitar.length}/${maxEfectivo})`
      )
    }
  }

  // 5. Verificar cupo disponible en cada evento (solo los que va a solicitar)
  const eventosSinCupo: string[] = []
  for (const evento of eventosParaSolicitar) {
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
      eventos: eventosParaSolicitar.map((e) => ({
        id: e.id,
        date: e.date,
        startTime: e.startTime,
        eventoType: e.eventoType,
      })),
      totalEventos: eventosParaSolicitar.length,
      rotativosExistentes,
      esCompletarBloque: rotativosExistentes > 0,
    })
  }

  // ============================================
  // CREAR ROTATIVOS
  // ============================================
  const estado = motivosAprobacion.length > 0 ? "PENDIENTE" : "APROBADO"
  const motivoTexto = motivosAprobacion.length > 0 ? motivosAprobacion.join("; ") : null

  // Crear o actualizar bloque para ESTE usuario
  // (pueden existir múltiples bloques del mismo título para diferentes usuarios, según el cupo)
  let bloque = await prisma.block.findFirst({
    where: {
      name: titulo.name,
      seasonId: temporadaActiva.id,
      assignedToId: session.user.id, // Buscar solo el bloque de este usuario
    },
  })

  if (!bloque) {
    // Crear nuevo bloque para este usuario
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
    // Actualizar el bloque existente de este usuario
    bloque = await prisma.block.update({
      where: { id: bloque.id },
      data: {
        estado: estado === "APROBADO" ? "APROBADO" : "SOLICITADO",
      },
    })
  }

  // Crear rotativos para cada evento con cupo disponible (solo los que no tiene)
  const rotativosCreados: string[] = []
  const eventosSaltados: string[] = []

  for (const evento of eventosParaSolicitar) {
    const rotativosActivos = evento.rotativos.filter(
      (r) => r.estado === "APROBADO" || r.estado === "PENDIENTE"
    ).length
    // Usar cupo de reglas (consistente con el calendario) o override del evento
    const cupoDeReglas = await getCupoParaEvento(evento.eventoType, titulo.type)
    const cupoEfectivo = evento.cupoOverride ?? cupoDeReglas

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

  const esCompletarBloque = rotativosExistentes > 0
  const accion = esCompletarBloque ? "completado" : "solicitado"

  return NextResponse.json({
    success: true,
    estado,
    motivo: motivoTexto,
    bloqueId: bloque.id,
    rotativosCreados: rotativosCreados.length,
    rotativosExistentes,
    eventosSaltados: eventosSaltados.length,
    esCompletarBloque,
    message: estado === "APROBADO"
      ? `Bloque ${accion}. ${rotativosCreados.length} rotativos creados${esCompletarBloque ? ` (ya tenías ${rotativosExistentes})` : ""}.`
      : `Bloque pendiente de aprobación. ${rotativosCreados.length} rotativos en espera${esCompletarBloque ? ` (ya tenías ${rotativosExistentes})` : ""}.`,
  })
}
