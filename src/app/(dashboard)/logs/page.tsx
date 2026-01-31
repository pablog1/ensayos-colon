"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
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
import { History, RefreshCw, ChevronLeft, ChevronRight, FileText, Upload, FileDown } from "lucide-react"
import { jsPDF } from "jspdf"
import { toast } from "sonner"
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns"
import { es } from "date-fns/locale"

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId: string
  userId: string
  targetUserId: string | null
  details: Record<string, unknown> | null
  isCritical: boolean
  createdAt: string
  user?: {
    name: string
    alias: string | null
    email: string
  }
  targetUser?: {
    name: string
    alias: string | null
    email: string
  }
}

// Categorías de logs
const LOG_CATEGORIES: Record<string, { label: string; actions: string[]; isCritical?: boolean }> = {
  all: {
    label: "Todos",
    actions: [],
  },
  critical: {
    label: "Críticos",
    actions: [],
    isCritical: true,
  },
  rotativos: {
    label: "Rotativos",
    actions: ["ROTATIVO_CREADO", "ROTATIVO_APROBADO", "ROTATIVO_RECHAZADO", "ROTATIVO_CANCELADO", "ROTATIVO_ASIGNADO", "ROTATIVO_CREADO_EN_NOMBRE", "ROTATIVO_ELIMINADO_ADMIN", "ROTATIVO_PASADO_CREADO", "ROTATIVO_PASADO_ELIMINADO"],
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

// Función auxiliar para formatear fecha y hora del evento
function formatEventDateTime(details: Record<string, unknown>): string {
  const fecha = details.fecha as string | undefined
  const horario = details.horario as string | undefined
  const tipoEvento = details.tipoEvento as string | undefined

  if (!fecha) return ""

  const parts: string[] = []

  try {
    const fechaObj = new Date(fecha)
    parts.push(fechaObj.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }))
  } catch {
    // Si no se puede parsear, usar el string original
    if (typeof fecha === "string" && fecha.includes("T")) {
      parts.push(fecha.split("T")[0])
    }
  }

  if (horario) {
    parts.push(`a las ${horario}`)
  }

  if (tipoEvento) {
    const tiposLabel: Record<string, string> = {
      FUNCION: "Función",
      ENSAYO: "Ensayo",
      ENSAYO_GENERAL: "Ensayo General",
      ENSAYO_PIANO: "Ensayo Piano",
      PROBA: "Proba",
    }
    parts.push(`(${tiposLabel[tipoEvento] || tipoEvento})`)
  }

  return parts.length > 0 ? ` - ${parts.join(" ")}` : ""
}

// Función para generar descripción amigable del log
function getLogDescription(log: AuditLog): string {
  const details = log.details || {}
  // Usar alias, name, email (parte antes de @), o realizadoPor de details como fallback
  const realizadoPor = details.realizadoPor as string | undefined
  const getEmailName = (email?: string) => email?.split("@")[0] || null
  const userName = log.user?.alias || log.user?.name || getEmailName(log.user?.email) || realizadoPor || "Alguien"
  const targetName = log.targetUser?.alias || log.targetUser?.name || getEmailName(log.targetUser?.email)

  const evento = details.evento as string || ""
  const titulo = details.titulo as string || ""
  const motivo = details.motivo as string || ""
  const campo = details.campo as string || ""
  const key = details.key as string || ""
  const previousValue = details.previousValue as string | undefined
  const newValue = details.newValue as string | undefined

  // Obtener información de fecha/hora/tipo del evento
  const eventInfo = formatEventDateTime(details)

  switch (log.action) {
    case "ROTATIVO_CREADO":
      return `${userName} solicitó rotativo para ${evento || titulo || "un evento"}${eventInfo}`
    case "ROTATIVO_APROBADO":
      return `${userName} aprobó el rotativo de ${targetName || "un usuario"} para ${evento || titulo || "un evento"}${eventInfo}`
    case "ROTATIVO_RECHAZADO":
      return `${userName} rechazó el rotativo de ${targetName || "un usuario"} para ${evento || titulo || "un evento"}${eventInfo}${motivo ? ` - Motivo: ${motivo}` : ""}`
    case "ROTATIVO_CANCELADO":
      return `${userName} canceló su rotativo para ${evento || titulo || "un evento"}${eventInfo}`
    case "ROTATIVO_ASIGNADO":
      return `Se asignó rotativo a ${targetName || "un usuario"} para ${evento || titulo || "un evento"}${eventInfo}`
    case "ROTATIVO_CREADO_EN_NOMBRE":
      return `${userName} creó rotativo para ${targetName || "un usuario"} en ${evento || titulo || "un evento"}${eventInfo}`
    case "ROTATIVO_ELIMINADO_ADMIN":
      return `${userName} eliminó el rotativo de ${targetName || "un usuario"} en ${evento || titulo || "un evento"}${eventInfo}${motivo ? ` - Motivo: ${motivo}` : ""}`
    case "ROTATIVO_PASADO_CREADO":
      return `${userName} creó rotativo retroactivo para ${targetName || "un usuario"} en ${evento || titulo || "un evento"}${eventInfo}`
    case "ROTATIVO_PASADO_ELIMINADO":
      return `${userName} eliminó rotativo pasado de ${targetName || "un usuario"} en ${evento || titulo || "un evento"}${eventInfo}${motivo ? ` - Motivo: ${motivo}` : ""}`

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
      return `${userName} registró licencia para ${targetName || "un integrante"}`
    case "LICENCIA_MODIFICADA":
      return `${userName} modificó licencia de ${targetName || "un integrante"}`
    case "LICENCIA_ELIMINADA":
      return `${userName} eliminó licencia de ${targetName || "un integrante"}`

    case "LISTA_ESPERA_AGREGADO":
      return `${userName} se agregó a lista de espera para ${evento || titulo || "un evento"}${eventInfo}`
    case "LISTA_ESPERA_PROMOVIDO":
      return `${userName} fue promovido de la lista de espera para ${evento || titulo || "un evento"}${eventInfo}`

    case "CONSENSO_INICIADO":
      return `Se inició proceso de consenso`
    case "CONSENSO_RESUELTO":
      return `Se resolvió proceso de consenso`

    default:
      return `${userName} realizó una acción`
  }
}

// Colores de badges por tipo de acción
function getActionColor(action: string, isCritical?: boolean): string {
  // Acciones críticas de admin tienen color especial
  if (isCritical || action.includes("_ADMIN") || action.includes("_PASADO_") || action.includes("_EN_NOMBRE")) {
    return "bg-red-100 text-red-800 border border-red-300"
  }
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
    ROTATIVO_CREADO_EN_NOMBRE: "Admin creó",
    ROTATIVO_ELIMINADO_ADMIN: "Admin eliminó",
    ROTATIVO_PASADO_CREADO: "Retroactivo",
    ROTATIVO_PASADO_ELIMINADO: "Eliminado pasado",
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
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
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

      // Si es categoría crítica, filtrar por isCritical en el servidor
      const categoryConfig = LOG_CATEGORIES[category]
      if (categoryConfig?.isCritical) {
        params.set("isCritical", "true")
      }

      const res = await fetch(`/api/auditoria?${params}`)
      if (res.ok) {
        const data = await res.json()

        // Filtrar por categoría del lado del cliente si es necesario
        let filteredLogs = data.logs
        if (category !== "all" && !categoryConfig?.isCritical) {
          const actions = categoryConfig.actions
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

  const downloadPDF = () => {
    if (logs.length === 0) return

    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 14
    let yPosition = 22

    // Título
    pdf.setFontSize(18)
    pdf.text(`Registro de Actividad - ${format(currentMonth, "MMMM yyyy", { locale: es })}`, margin, yPosition)
    yPosition += 10

    // Subtítulo con categoría
    pdf.setFontSize(10)
    pdf.setTextColor(100)
    const categoryLabel = LOG_CATEGORIES[category]?.label || "Todos"
    pdf.text(`Categoría: ${categoryLabel} | Total: ${logs.length} registros`, margin, yPosition)
    pdf.setTextColor(0)
    yPosition += 10

    // Línea separadora
    pdf.setLineWidth(0.5)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 8

    // Logs
    pdf.setFontSize(9)
    logs.forEach((log) => {
      // Verificar si necesitamos nueva página
      if (yPosition > pageHeight - 30) {
        pdf.addPage()
        yPosition = 20
      }

      const date = new Date(log.createdAt)
      const dateStr = format(date, "dd/MM/yyyy HH:mm")
      const typeStr = getActionLabel(log.action)
      const description = getLogDescription(log)

      // Fecha y tipo
      pdf.setFont("helvetica", "bold")
      pdf.text(`${dateStr} - ${typeStr}${log.isCritical ? " [!]" : ""}`, margin, yPosition)
      yPosition += 5

      // Descripción (puede necesitar wrap)
      pdf.setFont("helvetica", "normal")
      const splitDescription = pdf.splitTextToSize(description, pageWidth - margin * 2)
      pdf.text(splitDescription, margin, yPosition)
      yPosition += splitDescription.length * 4 + 4
    })

    // Guardar
    pdf.save(`logs_${format(currentMonth, "yyyy-MM")}.pdf`)
  }

  const exportBackup = async () => {
    try {
      const res = await fetch("/api/auditoria/export")
      if (res.ok) {
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `backup_logs_${format(new Date(), "yyyy-MM-dd")}.json`
        link.click()
        toast.success("Backup exportado correctamente")
      } else {
        toast.error("Error al exportar backup")
      }
    } catch (error) {
      console.error("Error exporting backup:", error)
      toast.error("Error al exportar backup")
    }
  }

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const res = await fetch("/api/auditoria/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const result = await res.json()
        toast.success(`Backup restaurado: ${result.imported} registros importados`)
        fetchLogs()
      } else {
        const error = await res.json()
        toast.error(error.error || "Error al importar backup")
      }
    } catch (error) {
      console.error("Error importing backup:", error)
      toast.error("Error al leer el archivo de backup")
    }

    // Limpiar input
    event.target.value = ""
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
          <Button variant="outline" size="sm" onClick={downloadPDF} disabled={logs.length === 0}>
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportBackup}>
            <FileDown className="w-4 h-4 mr-2" />
            Backup
          </Button>
          {isAdmin && (
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Restaurar
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          )}
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
                  <div key={log.id} className={`border rounded-lg p-3 space-y-2 ${log.isCritical ? "bg-red-50 border-red-200" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {log.isCritical && <span className="text-red-600 font-bold text-sm">!</span>}
                        <Badge className={getActionColor(log.action, log.isCritical)}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </div>
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
                      <TableRow key={log.id} className={log.isCritical ? "bg-red-50" : ""}>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(log.createdAt), "dd/MM HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {log.isCritical && <span className="text-red-600 font-bold">!</span>}
                            <Badge className={getActionColor(log.action, log.isCritical)}>
                              {getActionLabel(log.action)}
                            </Badge>
                          </div>
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
