"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BookOpen,
  Users,
  Calendar,
  CalendarDays,
  Clock,
  Music,
  ListOrdered,
  Shuffle,
  Shield,
  UserPlus,
  Bell,
  CheckCircle,
  Info,
} from "lucide-react"

interface RuleConfig {
  id: string
  name: string
  description: string
  category: string
  priority: number
  enabled: boolean
  configKey: string
  currentValue: unknown
  valueType: string
}

// Configuración amigable para cada regla
const friendlyRules: Record<string, {
  icon: React.ElementType
  title: string
  summary: string
  details: string[]
  getValue?: (value: unknown) => React.ReactNode
}> = {
  CUPO_DIARIO: {
    icon: Users,
    title: "Cupos disponibles",
    summary: "Cantidad de músicos que pueden tomar rotativo por tipo de evento",
    details: [
      "Cada tipo de evento tiene un cupo diferente",
      "Los cupos se definen según las necesidades de cada actividad",
    ],
    getValue: (value) => {
      if (!value || typeof value !== "object") return null
      const cupos = value as Record<string, number>
      const labels: Record<string, string> = {
        OPERA: "Ópera",
        CONCIERTO: "Concierto",
        ENSAYO: "Ensayo",
        ENSAYO_DOBLE: "Ensayo doble",
        OTRO: "Otro",
      }
      return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
          {Object.entries(cupos).map(([tipo, cantidad]) => (
            <div key={tipo} className="text-center p-2 bg-blue-50 rounded-lg">
              <div className="text-xl font-bold text-blue-700">{cantidad}</div>
              <div className="text-xs text-blue-600">{labels[tipo] || tipo}</div>
            </div>
          ))}
        </div>
      )
    },
  },
  MAX_PROYECTADO: {
    icon: Calendar,
    title: "Límite anual",
    summary: "Máximo de rotativos que podés tomar en una temporada",
    details: [
      "Se calcula automáticamente para que sea justo para todos",
      "El número es aproximadamente 50 rotativos por año",
      "Depende de los días de trabajo y la cantidad de músicos",
    ],
    getValue: (value) => {
      if (!value || typeof value !== "object") return null
      const config = value as { baseAnual: number }
      return (
        <div className="flex items-center gap-3 mt-3">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-700">~{config.baseAnual}</div>
            <div className="text-xs text-green-600">por año</div>
          </div>
        </div>
      )
    },
  },
  FINES_SEMANA_MAX: {
    icon: CalendarDays,
    title: "Fines de semana",
    summary: "Límite de fines de semana con rotativo por mes",
    details: [
      "Si tomás un sábado, cuenta como el fin de semana del mes",
      "Esto ayuda a distribuir los fines de semana entre todos",
    ],
    getValue: (value) => (
      <div className="flex items-center gap-3 mt-3">
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-700">{String(value)}</div>
          <div className="text-xs text-purple-600">por mes</div>
        </div>
      </div>
    ),
  },
  BLOQUE_EXCLUSIVO: {
    icon: Music,
    title: "Bloques de producción",
    summary: "Podés ausentarte durante una producción completa",
    details: [
      "Un bloque por persona por temporada",
      "Una vez iniciado, no se puede cancelar",
      "Ideal para compromisos que abarcan varios días seguidos",
    ],
    getValue: (value) => {
      if (!value || typeof value !== "object") return null
      const config = value as { maxPorPersona: number }
      return (
        <div className="flex items-center gap-3 mt-3">
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-700">{config.maxPorPersona}</div>
            <div className="text-xs text-orange-600">bloque por año</div>
          </div>
        </div>
      )
    },
  },
  LISTA_ESPERA: {
    icon: ListOrdered,
    title: "Lista de espera",
    summary: "Si no hay cupo, podés anotarte para cuando se libere",
    details: [
      "Funciona por orden de llegada",
      "El primero en anotarse es el primero en recibir el cupo",
      "Se mantiene hasta el fin de la temporada",
    ],
  },
  PLAZO_SOLICITUD: {
    icon: Clock,
    title: "Plazos para pedir rotativo",
    summary: "Cuándo podés solicitar y cómo se aprueba",
    details: [
      "Con un día de anticipación: aprobación automática si hay cupo",
      "El mismo día: queda pendiente de aprobación del administrador",
    ],
    getValue: () => (
      <div className="space-y-2 mt-3">
        <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-800">Hasta el día anterior = Automático</span>
        </div>
        <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
          <Clock className="w-4 h-4 text-yellow-600" />
          <span className="text-sm text-yellow-800">Mismo día = Requiere aprobación</span>
        </div>
      </div>
    ),
  },
  ROTACION_OBLIGATORIA: {
    icon: Shuffle,
    title: "Rotación obligatoria",
    summary: "Asignación automática cuando faltan voluntarios",
    details: [
      "Si nadie se ofrece, el sistema asigna automáticamente",
      "Se asigna a quienes menos rotativos hayan tomado",
      "Garantiza que todos participen de forma equitativa",
    ],
    getValue: (value) => {
      if (!value || typeof value !== "object") return null
      const config = value as { diasAntes: number }
      return (
        <div className="flex items-center gap-3 mt-3">
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <div className="text-2xl font-bold text-amber-700">{config.diasAntes}</div>
            <div className="text-xs text-amber-600">días antes</div>
          </div>
          <span className="text-sm text-muted-foreground">se activa si no hay voluntarios</span>
        </div>
      )
    },
  },
  COBERTURA_EXTERNA: {
    icon: Shield,
    title: "Cobertura por emergencias",
    summary: "Quién cubre cuando alguien no puede asistir de urgencia",
    details: [
      "Se busca entre quienes más rotativos hayan tomado",
      "Así se equilibra el balance del grupo",
      "La cobertura se descuenta del contador de rotativos",
    ],
  },
  LICENCIAS: {
    icon: Calendar,
    title: "Licencias prolongadas",
    summary: "Cómo se manejan las ausencias extendidas",
    details: [
      "Al volver, se te suma el promedio del grupo durante tu ausencia",
      "Esto evita ventajas o desventajas por haber tomado licencia",
      "Aplica para licencias médicas, de estudio, maternidad, etc.",
    ],
  },
  INTEGRANTE_NUEVO: {
    icon: UserPlus,
    title: "Músicos nuevos",
    summary: "Cómo se calcula el límite para quienes recién ingresan",
    details: [
      "El máximo inicial es el promedio actual del grupo",
      "El administrador puede ajustarlo si es necesario",
      "Se adapta a la fecha de ingreso en la temporada",
    ],
  },
  ALERTA_UMBRAL: {
    icon: Bell,
    title: "Alertas de cercanía al límite",
    summary: "Recibís aviso cuando te acercás a tu máximo",
    details: [
      "Te notificamos para que puedas planificar mejor",
      "También se notifica al administrador",
    ],
    getValue: (value) => (
      <div className="flex items-center gap-3 mt-3">
        <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-700">{String(value)}%</div>
          <div className="text-xs text-yellow-600">del máximo</div>
        </div>
        <span className="text-sm text-muted-foreground">se envía alerta</span>
      </div>
    ),
  },
}

export default function ReglasPage() {
  const [rules, setRules] = useState<RuleConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRules() {
      try {
        const res = await fetch("/api/configuracion/reglas")
        if (res.ok) {
          const data = await res.json()
          setRules(data.rules)
        }
      } catch (error) {
        console.error("Error cargando reglas:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRules()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Obtener solo reglas activas
  const activeRules = rules.filter(r => r.enabled)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Cómo funcionan los rotativos</h1>
          <p className="text-muted-foreground">
            Todo lo que necesitás saber sobre el sistema
          </p>
        </div>
      </div>

      {/* Resumen rápido */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-2">Resumen rápido</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Cada tipo de evento tiene un cupo de rotativos disponibles</li>
                <li>• Hay un límite anual para que todos tengan las mismas oportunidades</li>
                <li>• Si pedís con anticipación, se aprueba automáticamente</li>
                <li>• Si no hay cupo, podés anotarte en lista de espera</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reglas en formato amigable */}
      <div className="grid gap-4 md:grid-cols-2">
        {activeRules.map((rule) => {
          const friendly = friendlyRules[rule.configKey]
          if (!friendly) return null

          const Icon = friendly.icon

          return (
            <Card key={rule.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  {friendly.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-foreground mb-2">
                  {friendly.summary}
                </p>
                <ul className="space-y-1">
                  {friendly.details.map((detail, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {detail}
                    </li>
                  ))}
                </ul>
                {friendly.getValue && friendly.getValue(rule.currentValue)}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Información adicional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Información importante
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">Temporada</h4>
              <p className="text-sm text-muted-foreground">
                La temporada es anual. El objetivo es terminar el año de forma equilibrada entre todos los músicos.
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">Artículos</h4>
              <p className="text-sm text-muted-foreground">
                Las ausencias por normativa laboral (artículos) no cuentan como rotativo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Glosario */}
      <Card>
        <CardHeader>
          <CardTitle>Glosario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">Rotativo</Badge>
              <span className="text-sm text-muted-foreground">Día libre asignado dentro del sistema</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">Bloque</Badge>
              <span className="text-sm text-muted-foreground">Producción completa (ej: una ópera entera)</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">Cupo</Badge>
              <span className="text-sm text-muted-foreground">Cantidad de rotativos disponibles por día</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">Artículo</Badge>
              <span className="text-sm text-muted-foreground">Ausencia por normativa laboral (no cuenta)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
