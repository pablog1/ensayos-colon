"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { History, Download, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { format, startOfMonth, endOfMonth, subMonths, addMonths, startOfYear, endOfYear } from "date-fns"
import { es } from "date-fns/locale"

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId: string
  userId: string
  targetUserId: string | null
  details: Record<string, unknown> | null
  createdAt: string
  user?: {
    name: string
    alias: string | null
  }
  targetUser?: {
    name: string
    alias: string | null
  }
}

// Categorías de logs
const LOG_CATEGORIES: Record<string, { label: string; actions: string[] }> = {
  all: {
    label: "Todos",
    actions: [],
  },
  rotativos: {
    label: "Rotativos",
    actions: ["ROTATIVO_CREADO", "ROTATIVO_APROBADO", "ROTATIVO_RECHAZADO", "ROTATIVO_CANCELADO", "ROTATIVO_ASIGNADO"],
  },
  bloques: {
    label: "Bloques",
    actions: ["BLOQUE_SOLICITADO", "BLOQUE_APROBADO", "BLOQUE_CANCELADO"],
  },
  usuarios: {
    label: "Usuarios",
    actions: ["USUARIO_CREADO", "USUARIO_MODIFICADO", "BALANCE_AJUSTADO"],
  },
  configuracion: {
    label: "Configuración",
    actions: ["CONFIG_MODIFICADA"],
  },
  licencias: {
    label: "Licencias",
    actions: ["LICENCIA_CREADA", "LICENCIA_MODIFICADA"],
  },
}

// Función para generar descripción amigable del log
function getLogDescription(log: AuditLog): string {
  const userName = log.user?.alias || log.user?.name || "Alguien"
  const targetName = log.targetUser?.alias || log.targetUser?.name
  const details = log.details || {}

  const evento = details.evento as string || ""
  const titulo = details.titulo as string || ""
  const motivo = details.motivo as string || ""
  const campo = details.campo as string || ""
  const key = details.key as string || ""
  const previousValue = details.previousValue as string | undefined
  const newValue = details.newValue as string | undefined

  switch (log.action) {
    case "ROTATIVO_CREADO":
      return `${userName} solicitó rotativo para ${evento || titulo || "un evento"}`
    case "ROTATIVO_APROBADO":
      return `${userName} aprobó el rotativo de ${targetName || "un usuario"} para ${evento || titulo || "un evento"}`
    case "ROTATIVO_RECHAZADO":
      return `${userName} rechazó el rotativo de ${targetName || "un usuario"} para ${evento || titulo || "un evento"}${motivo ? ` (${motivo})` : ""}`
    case "ROTATIVO_CANCELADO":
      return `${userName} canceló su rotativo para ${evento || titulo || "un evento"}`
    case "ROTATIVO_ASIGNADO":
      return `Se asignó rotativo a ${targetName || "un usuario"} para ${evento || titulo || "un evento"}`

    case "BLOQUE_SOLICITADO":
      return `${userName} solicitó bloque completo de ${titulo || "un título"}`
    case "BLOQUE_APROBADO":
      return `Se aprobó el bloque de ${titulo || "un título"} para ${targetName || userName}`
    case "BLOQUE_CANCELADO":
      return `${userName} canceló el bloque de ${titulo || "un título"}`

    case "USUARIO_CREADO":
      return `Se creó el usuario ${targetName || "nuevo"}`
    case "USUARIO_MODIFICADO":
      if (campo === "password") {
        return `${userName} cambió su contraseña`
      }
      return `Se modificaron los datos de ${targetName || userName}`
    case "BALANCE_AJUSTADO":
      return `Se ajustó el balance de ${targetName || userName}${motivo ? `: ${motivo}` : ""}`

    case "CONFIG_MODIFICADA": {
      const keyLabels: Record<string, string> = {
        "PLAZO_SOLICITUD": "Plazo de solicitud",
        "FINES_SEMANA_MAX": "Máximo fines de semana",
        "MAX_PROYECTADO": "Máximo proyectado",
        "ENSAYOS_DOBLES": "Ensayos dobles",
        "FUNCIONES_POR_TITULO": "Funciones por título",
      }
      const keyLabel = keyLabels[key] || key || "reglas del sistema"

      // Format values for display
      const formatValue = (val: string | undefined): string => {
        if (!val) return "?"
        try {
          const parsed = JSON.parse(val)
          if (typeof parsed === "object") {
            return Object.entries(parsed).map(([k, v]) => `${k}=${v}`).join(", ")
          }
          return String(parsed)
        } catch {
          return val
        }
      }

      if (previousValue !== undefined && newValue !== undefined) {
        return `Se modificó "${keyLabel}": de "${formatValue(previousValue)}" a "${formatValue(newValue)}"`
      }
      return `Se modificó la configuración: ${keyLabel}`
    }

    case "LICENCIA_CREADA":
      return `Se registró licencia para ${targetName || userName}`
    case "LICENCIA_MODIFICADA":
      return `Se modificó licencia de ${targetName || userName}`

    case "LISTA_ESPERA_AGREGADO":
      return `${userName} se agregó a lista de espera`
    case "LISTA_ESPERA_PROMOVIDO":
      return `${userName} fue promovido de la lista de espera`

    case "CONSENSO_INICIADO":
      return `Se inició proceso de consenso`
    case "CONSENSO_RESUELTO":
      return `Se resolvió proceso de consenso`

    default:
      return `${userName} realizó una acción`
  }
}

// Colores de badges por tipo de acción
function getActionColor(action: string): string {
  if (action.includes("CREADO") || action.includes("SOLICITADO")) {
    return "bg-blue-100 text-blue-800"
  }
  if (action.includes("APROBADO") || action.includes("PROMOVIDO")) {
    return "bg-green-100 text-green-800"
  }
  if (action.includes("RECHAZADO")) {
    return "bg-red-100 text-red-800"
  }
  if (action.includes("CANCELADO")) {
    return "bg-gray-100 text-gray-800"
  }
  if (action.includes("MODIFICAD")) {
    return "bg-orange-100 text-orange-800"
  }
  if (action.includes("AJUSTADO")) {
    return "bg-purple-100 text-purple-800"
  }
  return "bg-gray-100 text-gray-800"
}

// Etiqueta corta para el badge
function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    ROTATIVO_CREADO: "Solicitud",
    ROTATIVO_APROBADO: "Aprobado",
    ROTATIVO_RECHAZADO: "Rechazado",
    ROTATIVO_CANCELADO: "Cancelado",
    ROTATIVO_ASIGNADO: "Asignado",
    BLOQUE_SOLICITADO: "Bloque",
    BLOQUE_APROBADO: "Aprobado",
    BLOQUE_CANCELADO: "Cancelado",
    USUARIO_CREADO: "Nuevo usuario",
    USUARIO_MODIFICADO: "Modificación",
    BALANCE_AJUSTADO: "Balance",
    CONFIG_MODIFICADA: "Config",
    LICENCIA_CREADA: "Licencia",
    LICENCIA_MODIFICADA: "Licencia",
    LISTA_ESPERA_AGREGADO: "Espera",
    LISTA_ESPERA_PROMOVIDO: "Promovido",
    CONSENSO_INICIADO: "Consenso",
    CONSENSO_RESUELTO: "Resuelto",
  }
  return labels[action] || action
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>("all")
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [total, setTotal] = useState(0)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = startOfMonth(currentMonth)
      const endDate = endOfMonth(currentMonth)

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: "500",
      })

      const res = await fetch(`/api/auditoria?${params}`)
      if (res.ok) {
        const data = await res.json()

        // Filtrar por categoría del lado del cliente si es necesario
        let filteredLogs = data.logs
        if (category !== "all") {
          const actions = LOG_CATEGORIES[category].actions
          filteredLogs = data.logs.filter((log: AuditLog) => actions.includes(log.action))
        }

        setLogs(filteredLogs)
        setTotal(filteredLogs.length)
      }
    } catch (error) {
      console.error("Error fetching logs:", error)
    }
    setLoading(false)
  }, [category, currentMonth])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handlePrevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1))
  }

  const handleNextMonth = () => {
    const next = addMonths(currentMonth, 1)
    // No permitir ir al futuro
    if (next <= new Date()) {
      setCurrentMonth(next)
    }
  }

  const handleCurrentMonth = () => {
    setCurrentMonth(new Date())
  }

  const isCurrentMonth = format(currentMonth, "yyyy-MM") === format(new Date(), "yyyy-MM")

  const generateCSV = (logsData: AuditLog[], filename: string) => {
    const headers = ["Fecha", "Hora", "Tipo", "Descripción", "Usuario"]
    const rows = logsData.map((log) => {
      const date = new Date(log.createdAt)
      return [
        format(date, "dd/MM/yyyy"),
        format(date, "HH:mm"),
        getActionLabel(log.action),
        getLogDescription(log),
        log.user?.alias || log.user?.name || "",
      ]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map((row: string[]) => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const downloadCSV = () => {
    const filename = `logs_${format(currentMonth, "yyyy-MM")}.csv`
    generateCSV(logs, filename)
  }

  const downloadYearCSV = async () => {
    const year = currentMonth.getFullYear()
    const startDate = startOfYear(currentMonth)
    const endDate = endOfYear(currentMonth)
    const filename = `logs_${year}.csv`

    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: "10000",
      })

      const res = await fetch(`/api/auditoria?${params}`)
      if (res.ok) {
        const data = await res.json()

        // Filtrar por categoría si es necesario
        let filteredLogs = data.logs
        if (category !== "all") {
          const actions = LOG_CATEGORIES[category].actions
          filteredLogs = data.logs.filter((log: AuditLog) => actions.includes(log.action))
        }

        generateCSV(filteredLogs, filename)
      }
    } catch (error) {
      console.error("Error downloading year logs:", error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <History className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Registro de Actividad</h1>
            <p className="text-sm text-muted-foreground">
              Historial de acciones del sistema
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCSV} disabled={logs.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Mes
          </Button>
          <Button variant="outline" size="sm" onClick={downloadYearCSV}>
            <Download className="w-4 h-4 mr-2" />
            Año {currentMonth.getFullYear()}
          </Button>
        </div>
      </div>

      {/* Navegación de mes */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: es })}
              </span>
              {!isCurrentMonth && (
                <Button variant="link" size="sm" onClick={handleCurrentMonth} className="text-primary">
                  (Ir a mes actual)
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtros por categoría */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(LOG_CATEGORIES).map(([key, { label }]) => (
          <Button
            key={key}
            variant={category === key ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Lista de logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {total} {total === 1 ? "registro" : "registros"} en {format(currentMonth, "MMMM", { locale: es })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay registros en este período
            </div>
          ) : (
            <>
              {/* Vista mobile */}
              <div className="md:hidden space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge className={getActionColor(log.action)}>
                        {getActionLabel(log.action)}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.createdAt), "dd/MM HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm">
                      {getLogDescription(log)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Vista desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Fecha</TableHead>
                      <TableHead className="w-[100px]">Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(log.createdAt), "dd/MM HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <Badge className={getActionColor(log.action)}>
                            {getActionLabel(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getLogDescription(log)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
