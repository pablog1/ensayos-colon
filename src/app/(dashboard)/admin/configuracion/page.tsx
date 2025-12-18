"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  Settings,
  Save,
  RotateCcw,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  Info,
  Music,
  CalendarDays,
  UserPlus,
  Bell,
  Shuffle,
  Shield,
  ListOrdered,
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

// Configuración de UI amigable para cada regla
const ruleUIConfig: Record<string, {
  icon: React.ElementType
  friendlyName: string
  shortDescription: string
  explanation: string
  editable: boolean
  editableFields?: string[]
  renderValue?: (value: unknown) => React.ReactNode
  renderEditor?: (value: unknown, onChange: (val: unknown) => void) => React.ReactNode
}> = {
  CUPO_DIARIO: {
    icon: Users,
    friendlyName: "Cupos por tipo de evento",
    shortDescription: "Cuántos músicos pueden tomar rotativo en cada tipo de evento",
    explanation: "Define cuántas personas pueden pedir rotativo simultáneamente según el tipo de actividad. Por ejemplo, en una Ópera pueden faltar más músicos que en un Ensayo.",
    editable: true,
    renderValue: (value) => {
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Object.entries(cupos).map(([tipo, cantidad]) => (
            <div key={tipo} className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{cantidad}</div>
              <div className="text-xs text-muted-foreground mt-1">{labels[tipo] || tipo}</div>
            </div>
          ))}
        </div>
      )
    },
    renderEditor: (value, onChange) => {
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {Object.entries(cupos).map(([tipo, cantidad]) => (
            <div key={tipo} className="space-y-2">
              <Label className="text-sm">{labels[tipo] || tipo}</Label>
              <Input
                type="number"
                min={0}
                value={cantidad}
                onChange={(e) => {
                  const newCupos = { ...cupos, [tipo]: parseInt(e.target.value) || 0 }
                  onChange(newCupos)
                }}
                className="text-center text-lg font-semibold"
              />
            </div>
          ))}
        </div>
      )
    },
  },
  MAX_PROYECTADO: {
    icon: Calendar,
    friendlyName: "Máximo de rotativos por temporada",
    shortDescription: "Límite anual calculado automáticamente para cada músico",
    explanation: "Este número se calcula automáticamente usando la fórmula: (Días de trabajo × Cupo diario) ÷ Cantidad de músicos. Actualmente es aproximadamente 50 rotativos por año. Este cálculo asegura que todos tengan las mismas oportunidades.",
    editable: false,
    renderValue: (value) => {
      if (!value || typeof value !== "object") return null
      const config = value as { baseAnual: number }
      return (
        <div className="flex items-center gap-4">
          <div className="text-center p-4 bg-primary/10 rounded-lg">
            <div className="text-3xl font-bold text-primary">~{config.baseAnual}</div>
            <div className="text-sm text-muted-foreground">rotativos/año</div>
          </div>
          <div className="text-sm text-muted-foreground flex-1">
            <p className="font-medium mb-1">Cálculo automático:</p>
            <p>Días de trabajo × Cupo ÷ Músicos</p>
          </div>
        </div>
      )
    },
  },
  FINES_SEMANA_MAX: {
    icon: CalendarDays,
    friendlyName: "Fines de semana por mes",
    shortDescription: "Máximo de fines de semana con rotativo por mes",
    explanation: "Limita cuántos fines de semana puede tomar rotativo cada músico en un mismo mes. Si tomás un sábado, cuenta como tu fin de semana del mes aunque no tomes el domingo.",
    editable: true,
    renderValue: (value) => (
      <div className="flex items-center gap-3">
        <div className="text-center p-4 bg-primary/10 rounded-lg">
          <div className="text-3xl font-bold text-primary">{String(value)}</div>
          <div className="text-sm text-muted-foreground">por mes</div>
        </div>
      </div>
    ),
    renderEditor: (value, onChange) => (
      <div className="flex items-center gap-4">
        <Input
          type="number"
          min={0}
          max={4}
          value={String(value)}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="w-24 text-center text-xl font-semibold"
        />
        <span className="text-muted-foreground">fines de semana por mes</span>
      </div>
    ),
  },
  BLOQUE_EXCLUSIVO: {
    icon: Music,
    friendlyName: "Bloques de producción",
    shortDescription: "Configuración para ausencias en producciones completas",
    explanation: "Un bloque permite ausentarse durante toda una producción (ej: \"La Traviata\"). Cada músico puede tomar un bloque por año. Una vez que comienza el bloque, no se puede cancelar para garantizar la planificación.",
    editable: false,
    renderValue: (value) => {
      if (!value || typeof value !== "object") return null
      const config = value as { maxPorPersona: number; permiteCancel: boolean }
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-base px-3 py-1">
              {config.maxPorPersona} bloque por año
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {config.permiteCancel
              ? "Se puede cancelar antes de iniciar"
              : "Una vez iniciado, no se puede cancelar"}
          </p>
        </div>
      )
    },
  },
  LISTA_ESPERA: {
    icon: ListOrdered,
    friendlyName: "Lista de espera",
    shortDescription: "Cómo funciona la cola cuando no hay cupo",
    explanation: "Cuando no hay cupo disponible, podés anotarte en la lista de espera. Funciona por orden de llegada: el primero que se anotó es el primero en recibir el cupo cuando se libera. La lista se vacía al final de cada temporada.",
    editable: false,
    renderValue: (value) => {
      if (!value || typeof value !== "object") return null
      const config = value as { tipo: string; vencimiento: string | null }
      return (
        <div className="space-y-2">
          <Badge variant="outline" className="text-base">
            Orden de llegada (FIFO)
          </Badge>
          <p className="text-sm text-muted-foreground">
            {config.vencimiento
              ? `Vence después de ${config.vencimiento}`
              : "Sin vencimiento - se mantiene hasta fin de temporada"}
          </p>
        </div>
      )
    },
  },
  PLAZO_SOLICITUD: {
    icon: Clock,
    friendlyName: "Plazos para solicitar",
    shortDescription: "Cuándo se puede pedir rotativo y cómo se aprueba",
    explanation: "Si pedís el rotativo con al menos un día de anticipación, se aprueba automáticamente (si hay cupo). Si lo pedís el mismo día del evento, siempre queda pendiente de aprobación del administrador.",
    editable: false,
    renderValue: () => (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <div>
            <p className="font-medium text-green-800">Hasta el día anterior</p>
            <p className="text-sm text-green-600">Aprobación automática si hay cupo</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
          <div>
            <p className="font-medium text-yellow-800">El mismo día</p>
            <p className="text-sm text-yellow-600">Requiere aprobación del administrador</p>
          </div>
        </div>
      </div>
    ),
  },
  ROTACION_OBLIGATORIA: {
    icon: Shuffle,
    friendlyName: "Rotación obligatoria",
    shortDescription: "Asignación automática cuando no hay voluntarios",
    explanation: "Si faltan 5 días para un evento y no se llenó el cupo con voluntarios, el sistema asigna automáticamente a quienes menos rotativos hayan tomado. Esto asegura que todos participen de forma equitativa.",
    editable: true,
    renderValue: (value) => {
      if (!value || typeof value !== "object") return null
      const config = value as { diasAntes: number; criterio: string }
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-base px-3 py-1">
              {config.diasAntes} días antes
            </Badge>
            <span className="text-muted-foreground">se activa la asignación</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Se asigna a quienes <strong>menos rotativos</strong> hayan tomado
          </p>
        </div>
      )
    },
    renderEditor: (value, onChange) => {
      if (!value || typeof value !== "object") return null
      const config = value as { diasAntes: number; criterio: string }
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Días de anticipación:</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={config.diasAntes}
              onChange={(e) => {
                onChange({ ...config, diasAntes: parseInt(e.target.value) || 5 })
              }}
              className="w-20 text-center"
            />
            <span className="text-muted-foreground">días antes del evento</span>
          </div>
        </div>
      )
    },
  },
  COBERTURA_EXTERNA: {
    icon: Shield,
    friendlyName: "Cobertura por causas externas",
    shortDescription: "Quién cubre cuando alguien no puede asistir",
    explanation: "Si alguien tiene una emergencia y no puede asistir, se busca cobertura entre quienes más rotativos hayan tomado. Así, quien cubre \"devuelve\" parte de sus rotativos acumulados.",
    editable: false,
    renderValue: () => (
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-blue-800">
          Se prioriza a quienes <strong>más rotativos</strong> hayan tomado
        </p>
        <p className="text-sm text-blue-600 mt-1">
          Así se equilibra el balance de rotativos del grupo
        </p>
      </div>
    ),
  },
  LICENCIAS: {
    icon: Calendar,
    friendlyName: "Licencias prolongadas",
    shortDescription: "Cómo se calculan los rotativos durante una licencia",
    explanation: "Si tomás una licencia médica, por estudio u otra razón, al volver se te suma al contador el promedio de rotativos que tomaron los demás durante tu ausencia. Esto evita que quienes tomaron licencia queden con ventaja o desventaja.",
    editable: false,
    renderValue: () => (
      <div className="p-3 bg-muted/50 rounded-lg">
        <p className="font-medium">Al reincorporarse:</p>
        <p className="text-sm text-muted-foreground mt-1">
          Se suma al contador el promedio de rotativos del grupo durante la licencia
        </p>
      </div>
    ),
  },
  INTEGRANTE_NUEVO: {
    icon: UserPlus,
    friendlyName: "Nuevos integrantes",
    shortDescription: "Cómo se calcula el límite para músicos nuevos",
    explanation: "Cuando un músico nuevo se incorpora a mitad de temporada, su máximo de rotativos se calcula como el promedio actual del grupo. El administrador puede ajustar este número si es necesario.",
    editable: false,
    renderValue: () => (
      <div className="space-y-2">
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="font-medium">Máximo inicial = Promedio del grupo</p>
        </div>
        <p className="text-sm text-muted-foreground">
          El administrador puede modificar este valor caso por caso
        </p>
      </div>
    ),
  },
  ALERTA_UMBRAL: {
    icon: Bell,
    friendlyName: "Alerta de cercanía al máximo",
    shortDescription: "Cuándo avisar que estás cerca del límite",
    explanation: "Cuando alcanzás este porcentaje de tu máximo anual, recibís una notificación de advertencia. También se notifica al administrador para que esté al tanto.",
    editable: true,
    renderValue: (value) => (
      <div className="flex items-center gap-4">
        <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-3xl font-bold text-yellow-600">{String(value)}%</div>
          <div className="text-sm text-yellow-600">del máximo</div>
        </div>
        <p className="text-sm text-muted-foreground">
          Se envía alerta cuando llegás a este porcentaje de tu límite anual
        </p>
      </div>
    ),
    renderEditor: (value, onChange) => (
      <div className="flex items-center gap-4">
        <Input
          type="number"
          min={50}
          max={100}
          value={String(value)}
          onChange={(e) => onChange(parseInt(e.target.value) || 90)}
          className="w-24 text-center text-xl font-semibold"
        />
        <span className="text-muted-foreground">% del máximo anual</span>
      </div>
    ),
  },
}

export default function ConfiguracionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [rules, setRules] = useState<RuleConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editedValues, setEditedValues] = useState<Record<string, unknown>>({})
  const [editedEnabled, setEditedEnabled] = useState<Record<string, boolean>>({})
  const [editingRule, setEditingRule] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return
    if (!session?.user || session.user.role !== "ADMIN") {
      router.push("/")
      return
    }
    fetchRules()
  }, [session, status, router])

  async function fetchRules() {
    try {
      const res = await fetch("/api/configuracion/reglas")
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules)
      }
    } catch (error) {
      console.error("Error cargando reglas:", error)
      toast.error("Error al cargar configuraciones")
    } finally {
      setLoading(false)
    }
  }

  function handleValueChange(configKey: string, value: unknown) {
    setEditedValues((prev) => ({ ...prev, [configKey]: value }))
  }

  function handleEnabledChange(configKey: string, enabled: boolean) {
    setEditedEnabled((prev) => ({ ...prev, [configKey]: enabled }))
  }

  async function saveChanges() {
    setSaving(true)

    const updates: Array<{
      key: string
      value?: unknown
      enabled?: boolean
    }> = []

    for (const rule of rules) {
      const update: { key: string; value?: unknown; enabled?: boolean } = {
        key: rule.configKey,
      }

      if (editedValues[rule.configKey] !== undefined) {
        update.value = editedValues[rule.configKey]
      }

      if (editedEnabled[rule.configKey] !== undefined) {
        update.enabled = editedEnabled[rule.configKey]
      }

      if (update.value !== undefined || update.enabled !== undefined) {
        updates.push(update)
      }
    }

    if (updates.length === 0) {
      toast.info("No hay cambios para guardar")
      setSaving(false)
      return
    }

    try {
      const res = await fetch("/api/configuracion/reglas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })

      if (res.ok) {
        toast.success("Configuración guardada correctamente")
        setEditedValues({})
        setEditedEnabled({})
        setEditingRule(null)
        fetchRules()
      } else {
        const error = await res.json()
        toast.error(error.error || "Error al guardar")
      }
    } catch (error) {
      console.error("Error guardando:", error)
      toast.error("Error al guardar configuraciones")
    } finally {
      setSaving(false)
    }
  }

  function resetChanges() {
    setEditedValues({})
    setEditedEnabled({})
    setEditingRule(null)
    toast.info("Cambios descartados")
  }

  const hasChanges =
    Object.keys(editedValues).length > 0 ||
    Object.keys(editedEnabled).length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Agrupar reglas por categoría
  const categories = {
    cupo: { name: "Cupos y disponibilidad", rules: [] as RuleConfig[] },
    restriccion: { name: "Límites y restricciones", rules: [] as RuleConfig[] },
    rotacion: { name: "Rotación y cobertura", rules: [] as RuleConfig[] },
    bloque: { name: "Bloques de producción", rules: [] as RuleConfig[] },
    alerta: { name: "Notificaciones", rules: [] as RuleConfig[] },
  }

  rules.forEach((rule) => {
    const cat = categories[rule.category as keyof typeof categories]
    if (cat) {
      cat.rules.push(rule)
    }
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Configuración del Sistema</h1>
            <p className="text-muted-foreground">
              Ajustá las reglas de gestión de rotativos
            </p>
          </div>
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={resetChanges}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Descartar
            </Button>
            <Button onClick={saveChanges} disabled={saving} size="lg">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        )}
      </div>

      {/* Reglas por categoría */}
      {Object.entries(categories).map(([catKey, category]) => {
        if (category.rules.length === 0) return null

        return (
          <div key={catKey} className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground">
              {category.name}
            </h2>

            <div className="grid gap-4">
              {category.rules
                .sort((a, b) => a.priority - b.priority)
                .map((rule) => {
                  const uiConfig = ruleUIConfig[rule.configKey]
                  if (!uiConfig) return null

                  const Icon = uiConfig.icon
                  const currentEnabled = editedEnabled[rule.configKey] ?? rule.enabled
                  const currentValue = editedValues[rule.configKey] ?? rule.currentValue
                  const isEditing = editingRule === rule.configKey

                  const hasRuleChanges =
                    editedValues[rule.configKey] !== undefined ||
                    editedEnabled[rule.configKey] !== undefined

                  return (
                    <Card
                      key={rule.id}
                      className={`transition-all ${hasRuleChanges ? "ring-2 ring-primary" : ""} ${!currentEnabled ? "opacity-60" : ""}`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg flex items-center gap-2">
                                {uiConfig.friendlyName}
                                {hasRuleChanges && (
                                  <Badge className="bg-primary/20 text-primary text-xs">
                                    Modificado
                                  </Badge>
                                )}
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {uiConfig.shortDescription}
                              </CardDescription>
                            </div>
                          </div>

                          {/* Switch grande */}
                          <div className="flex flex-col items-center gap-1">
                            <Switch
                              checked={currentEnabled}
                              onCheckedChange={(checked: boolean) =>
                                handleEnabledChange(rule.configKey, checked)
                              }
                              className="scale-125 data-[state=checked]:bg-green-600"
                            />
                            <span className={`text-xs font-medium ${currentEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                              {currentEnabled ? "Activa" : "Inactiva"}
                            </span>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Explicación */}
                        <div className="flex gap-2 p-3 bg-blue-50 rounded-lg text-sm">
                          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <p className="text-blue-800">{uiConfig.explanation}</p>
                        </div>

                        <Separator />

                        {/* Valor actual o editor */}
                        {isEditing && uiConfig.editable && uiConfig.renderEditor ? (
                          <div className="space-y-4">
                            <Label className="text-base font-semibold">Modificar configuración</Label>
                            {uiConfig.renderEditor(currentValue, (val) =>
                              handleValueChange(rule.configKey, val)
                            )}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingRule(null)
                                  // Descartar cambios de esta regla
                                  setEditedValues((prev) => {
                                    const newValues = { ...prev }
                                    delete newValues[rule.configKey]
                                    return newValues
                                  })
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-base font-semibold">Configuración actual</Label>
                              {uiConfig.editable && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingRule(rule.configKey)}
                                >
                                  Modificar
                                </Button>
                              )}
                            </div>
                            {uiConfig.renderValue
                              ? uiConfig.renderValue(currentValue)
                              : <span className="text-2xl font-bold">{String(currentValue)}</span>
                            }
                          </div>
                        )}

                        {/* Mensaje para reglas no editables */}
                        {!uiConfig.editable && (
                          <div className="flex gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                            <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                            <p className="text-muted-foreground">
                              Esta configuración es automática y no requiere ajustes manuales.
                              Si necesitás modificarla, contactá al equipo técnico.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
