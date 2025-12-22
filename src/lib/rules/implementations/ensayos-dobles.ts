import { prisma } from "@/lib/prisma"
import type {
  RuleDefinition,
  ValidationContext,
  ValidationResult,
  RuleConfigValue,
  EnsayosDoblesConfig,
} from "../types"

const DEFAULT_CONFIG: EnsayosDoblesConfig = {
  enabled: true,
  maxRotativosPorTitulo: 1,
}

export const ensayosDoblesRule: RuleDefinition = {
  id: "R12_ENSAYOS_DOBLES",
  name: "Límite en días con ensayos dobles",
  description:
    "En días con ensayo doble del mismo título, cada integrante solo puede pedir rotativo para un ensayo en uno de esos días. Si ya tiene uno, las siguientes solicitudes van a revisión del admin.",
  category: "restriccion",
  priority: 15, // Después de cupo diario (10), antes de bloque exclusivo (20)
  enabled: true,
  configKey: "ENSAYOS_DOBLES",

  async validate(
    context: ValidationContext,
    config: RuleConfigValue
  ): Promise<ValidationResult> {
    const cfg = (config.value as EnsayosDoblesConfig) ?? DEFAULT_CONFIG

    // Solo aplica a eventos tipo ENSAYO
    if (context.eventType !== "ENSAYO") {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No aplica: el evento no es un ensayo",
      }
    }

    // Obtener el evento con su título
    const evento = await prisma.event.findUnique({
      where: { id: context.eventId },
      select: {
        id: true,
        date: true,
        tituloId: true,
        titulo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!evento?.tituloId) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No aplica: el evento no tiene título asociado",
      }
    }

    // Obtener todos los ensayos del mismo título
    const ensayosDelTitulo = await prisma.event.findMany({
      where: {
        tituloId: evento.tituloId,
        eventoType: "ENSAYO",
      },
      select: {
        id: true,
        date: true,
      },
    })

    // Agrupar ensayos por fecha para identificar días dobles
    const ensayosPorFecha: Record<string, string[]> = {}
    for (const ensayo of ensayosDelTitulo) {
      // Usar UTC para evitar problemas de timezone
      const fechaKey = `${ensayo.date.getUTCFullYear()}-${String(ensayo.date.getUTCMonth() + 1).padStart(2, "0")}-${String(ensayo.date.getUTCDate()).padStart(2, "0")}`
      if (!ensayosPorFecha[fechaKey]) {
        ensayosPorFecha[fechaKey] = []
      }
      ensayosPorFecha[fechaKey].push(ensayo.id)
    }

    // Identificar días dobles (más de un ensayo)
    const diasDobles: { fecha: string; eventIds: string[] }[] = []
    for (const [fecha, eventIds] of Object.entries(ensayosPorFecha)) {
      if (eventIds.length > 1) {
        diasDobles.push({ fecha, eventIds })
      }
    }

    // Si no hay días dobles en este título, la regla no aplica
    if (diasDobles.length === 0) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No aplica: el título no tiene días con ensayos dobles",
      }
    }

    // Verificar si el evento actual está en un día doble
    const fechaEventoActual = `${evento.date.getUTCFullYear()}-${String(evento.date.getUTCMonth() + 1).padStart(2, "0")}-${String(evento.date.getUTCDate()).padStart(2, "0")}`
    const esDiaDoble = diasDobles.some((d) => d.fecha === fechaEventoActual)

    if (!esDiaDoble) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: true,
        blocking: false,
        message: "No aplica: este ensayo no está en un día doble",
      }
    }

    // Obtener todos los IDs de eventos en días dobles
    const eventIdsEnDiasDobles = diasDobles.flatMap((d) => d.eventIds)

    // Buscar rotativos del usuario en cualquier ensayo de los días dobles de este título
    const rotativosEnDiasDobles = await prisma.rotativo.findMany({
      where: {
        userId: context.userId,
        eventId: { in: eventIdsEnDiasDobles },
        estado: { in: ["APROBADO", "PENDIENTE"] },
      },
      select: {
        id: true,
        eventId: true,
        estado: true,
        event: {
          select: {
            date: true,
          },
        },
      },
    })

    const cantidadRotativosEnDiasDobles = rotativosEnDiasDobles.length

    // Si ya tiene el máximo permitido de rotativos en días dobles, enviar a revisión
    if (cantidadRotativosEnDiasDobles >= cfg.maxRotativosPorTitulo) {
      const fechasConRotativo = rotativosEnDiasDobles.map((r) => {
        const d = r.event.date
        return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
      })

      return {
        ruleId: this.id,
        ruleName: this.name,
        passed: false,
        blocking: false, // No bloquea, va a revisión del admin
        message: `Ya tenés ${cantidadRotativosEnDiasDobles} rotativo(s) en días con ensayos dobles de "${evento.titulo?.name}". Solicitud enviada a revisión.`,
        details: {
          tituloId: evento.tituloId,
          tituloName: evento.titulo?.name,
          diasDobles: diasDobles.length,
          rotativosEnDiasDobles: cantidadRotativosEnDiasDobles,
          maxPermitido: cfg.maxRotativosPorTitulo,
          fechasConRotativo,
        },
        suggestedAction: "PENDING_ADMIN",
      }
    }

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: true,
      blocking: false,
      message: `Podés solicitar rotativo en días dobles de "${evento.titulo?.name}" (${cantidadRotativosEnDiasDobles}/${cfg.maxRotativosPorTitulo} usado)`,
      details: {
        tituloId: evento.tituloId,
        tituloName: evento.titulo?.name,
        diasDobles: diasDobles.length,
        rotativosEnDiasDobles: cantidadRotativosEnDiasDobles,
        maxPermitido: cfg.maxRotativosPorTitulo,
      },
    }
  },
}
