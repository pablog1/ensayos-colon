"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatInArgentina, toISOFromArgentina } from "@/lib/date-utils"
import { useDebugDate } from "@/contexts/debug-date-context"
import {
  Plus,
  Pencil,
  Trash2,
  Music,
  Theater,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Calendar,
  Clock,
  Users,
  PanelRightClose,
  PanelRightOpen,
  AlertTriangle,
  Loader2,
  Layers,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface Evento {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  eventoType: "ENSAYO" | "FUNCION"
  tituloId: string
  tituloName: string
  tituloType: string
  tituloColor: string | null
  cupoEfectivo: number
  cupoOverride: number | null
  rotativosUsados: number
  cupoDisponible: number
  rotativos: {
    id: string
    estado: string
    motivo: string | null
    validationResults: Record<string, unknown> | null
    user: {
      id: string
      name: string
      alias: string | null
    }
  }[]
}

interface Solicitud {
  id: string
  fecha: string
  estado: string
  user: {
    id: string
    name: string
    alias: string | null
  }
}

interface Titulo {
  id: string
  name: string
  type: string
  color: string | null
  cupo?: number // opcional para compatibilidad con datos cacheados
  startDate?: string
  endDate?: string
}

interface TituloRange {
  id: string
  name: string
  color: string | null
  startDate: string
  endDate: string
}

type EventosPorFecha = Record<string, Evento[]>

type SidebarMode =
  | "rotativos"
  | "eventos"
  | "titulos"
  | "nuevo-titulo"
  | "editar-titulo"
  | "nuevo-evento"
  | "editar-evento"
  | "detalle-evento"

export default function DashboardPage() {
  const { data: session } = useSession()
  const { debugDate } = useDebugDate()
  const isAdmin = session?.user?.role === "ADMIN"
  const userId = session?.user?.id

  const [eventos, setEventos] = useState<Evento[]>([])
  const [eventosPorFecha, setEventosPorFecha] = useState<EventosPorFecha>({})
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [titulos, setTitulos] = useState<Titulo[]>([])
  const [loading, setLoading] = useState(true)
  const [mesActual, setMesActual] = useState(new Date())

  // Actualizar mesActual cuando cambia la fecha de debug
  useEffect(() => {
    setMesActual(new Date(debugDate))
  }, [debugDate])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null)
  const [vistaCalendario, setVistaCalendario] = useState<"mes" | "semana">("mes")
  const [modoLista, setModoLista] = useState(false)
  const [tituloRanges, setTituloRanges] = useState<TituloRange[]>([])

  // Sidebar state
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("rotativos")
  const [editingTitulo, setEditingTitulo] = useState<Titulo | null>(null)
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null)
  const [verSoloMios, setVerSoloMios] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  // Configuración por defecto según dispositivo
  useEffect(() => {
    const isMobile = window.innerWidth < 768
    // En móvil, vista lista por defecto
    if (isMobile) {
      setModoLista(true)
    } else {
      setRightSidebarOpen(true)
    }
  }, [])

  // Form states
  const [tituloForm, setTituloForm] = useState({
    name: "",
    type: "OPERA" as string,
    color: "#3b82f6",
    cupo: 4,
    startDate: "",
    endDate: "",
  })

  const [eventoForm, setEventoForm] = useState({
    tituloId: "",
    eventoType: "ENSAYO" as "ENSAYO" | "FUNCION",
    ensayoTipo: "ENSAYO" as "ENSAYO" | "PRE_GENERAL" | "GENERAL",
    date: "",
    startTime: "14:00",
    endTime: "17:00",
    cupoOverride: null as number | null,
  })
  const [cupoInputValue, setCupoInputValue] = useState("")
  const [horarioCustom, setHorarioCustom] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  // Estado para el diálogo de confirmación de rotativo
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmMotivo, setConfirmMotivo] = useState<string | null>(null)
  const [confirmEventId, setConfirmEventId] = useState<string | null>(null)

  // Estado para mostrar progreso de validación
  const [validatingRule, setValidatingRule] = useState<string | null>(null)

  // Ref para cancelar fetches anteriores y evitar race conditions
  const abortControllerRef = useRef<AbortController | null>(null)

  // Estado para el diálogo de eliminación de evento con doble confirmación
  const [deleteEventoDialogOpen, setDeleteEventoDialogOpen] = useState(false)
  const [deleteEventoTarget, setDeleteEventoTarget] = useState<Evento | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  // Estado para el diálogo de bloque completo
  const [bloqueDialogOpen, setBloqueDialogOpen] = useState(false)
  const [bloqueInfo, setBloqueInfo] = useState<{
    tituloId: string
    tituloName: string
    totalEventos: number
    requiereAprobacion: boolean
    motivos: string[]
  } | null>(null)
  const [loadingBloque, setLoadingBloque] = useState(false)

  // Lista de reglas para mostrar durante validación
  const reglasValidacion = [
    "Verificando plazo de solicitud...",
    "Verificando fines de semana...",
    "Verificando límite anual...",
    "Verificando ensayos dobles...",
    "Verificando funciones por título...",
  ]

  // Horarios predefinidos según tipo de evento
  const getHorariosPredefinidos = (tipo: "ENSAYO" | "FUNCION", fecha?: string) => {
    // Determinar día de la semana (0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab)
    let dayOfWeek = -1
    if (fecha) {
      const date = new Date(fecha + "T12:00:00") // Usar mediodía para evitar problemas de timezone
      dayOfWeek = date.getDay()
    }

    const esLunes = dayOfWeek === 1
    const esMartesASabado = dayOfWeek >= 2 && dayOfWeek <= 6
    const esDomingo = dayOfWeek === 0

    // Lunes no hay actividades
    if (esLunes) return []

    if (tipo === "FUNCION") {
      if (esDomingo) {
        return [{ start: "17:00", end: "20:00", label: "17:00" }]
      }
      if (esMartesASabado) {
        return [{ start: "20:00", end: "23:00", label: "20:00" }]
      }
      return []
    }

    // ENSAYO
    if (esDomingo) {
      // Domingos: solo Pre General o General a las 17:00
      return [{ start: "17:00", end: "20:00", label: "17:00" }]
    }
    if (esMartesASabado) {
      return [
        { start: "14:00", end: "17:00", label: "14:00" },
        { start: "20:00", end: "23:00", label: "20:00" },
      ]
    }
    return []
  }

  // Determina si es domingo basado en la fecha
  const esDomingo = (fecha: string) => {
    if (!fecha) return false
    const date = new Date(fecha + "T12:00:00")
    return date.getDay() === 0
  }

  const lastFetchedYearRef = useRef<number | null>(null)

  const fetchTitulos = useCallback(async (year: number) => {
    if (year === lastFetchedYearRef.current) return // No re-fetch si es el mismo año
    const res = await fetch(`/api/titulos?year=${year}`)
    if (res.ok) {
      const data = await res.json()
      setTitulos(data)
      lastFetchedYearRef.current = year
    }
  }, [])

  const fetchSolicitudes = useCallback(async (mes: Date) => {
    const mesStr = format(mes, "yyyy-MM")
    const res = await fetch(`/api/solicitudes?mes=${mesStr}&todas=true`)
    if (res.ok) {
      const data = await res.json()
      setSolicitudes(data)
    }
  }, [])

  const fetchEventos = useCallback(async (mes: Date) => {
    // Cancelar fetch anterior si existe para evitar race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Crear nuevo AbortController para este fetch
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    const mesStr = format(mes, "yyyy-MM")
    try {
      const res = await fetch(`/api/calendario?mes=${mesStr}`, { signal })

      // Si fue abortado, no actualizar estado
      if (signal.aborted) return

      if (res.ok) {
        const data = await res.json()
        // Handle new API response format (object with eventos and titulos)
        const eventosData = data.eventos || data
        setEventos(eventosData)
        setTituloRanges(data.titulos || [])

        const porFecha: EventosPorFecha = {}
        for (const evento of eventosData) {
          const fechaKey = evento.date.substring(0, 10)
          if (!porFecha[fechaKey]) {
            porFecha[fechaKey] = []
          }
          porFecha[fechaKey].push(evento)
        }
        setEventosPorFecha(porFecha)
      }
      setLoading(false)
    } catch (error) {
      // Ignorar errores de abort (son esperados)
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('Error fetching eventos:', error)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEventos(mesActual)
    fetchSolicitudes(mesActual)
    fetchTitulos(mesActual.getFullYear())
  }, [mesActual, fetchEventos, fetchSolicitudes, fetchTitulos])

  const getEventosDelDia = (date: Date): Evento[] => {
    const fechaKey = format(date, "yyyy-MM-dd")
    return eventosPorFecha[fechaKey] || []
  }


  const getEventColor = (evento: Evento) => {
    if (evento.tituloColor) {
      return evento.tituloColor
    }
    return evento.eventoType === "ENSAYO" ? "#3b82f6" : "#f59e0b"
  }

  // Extrae la etiqueta del tipo de evento desde el título
  const getEventTypeLabel = (evento: Evento) => {
    if (evento.eventoType === "FUNCION") {
      return "Función"
    }
    // Para ensayos, extraer del título
    if (evento.title.includes("Pre General")) {
      return "Pre General"
    }
    if (evento.title.includes("Ensayo General")) {
      return "Ensayo General"
    }
    return "Ensayo"
  }

  // Color del badge E/F según horario
  const getBadgeColor = (evento: Evento) => {
    const hour = new Date(evento.startTime).getHours()
    const eventDate = new Date(evento.date + "T12:00:00")
    const isSunday = eventDate.getDay() === 0

    if (evento.eventoType === "FUNCION") {
      // F siempre rojo (20:00 o domingo 17:00)
      return "bg-red-500 text-white"
    }
    // Ensayos
    if (hour >= 19) {
      // E a las 20:00 → azul
      return "bg-blue-500 text-white"
    }
    if (hour >= 13 && hour < 19) {
      // E a las 14:00 → naranja/amarillo
      return "bg-amber-500 text-white"
    }
    // Por defecto (mañana u otro horario)
    return "bg-gray-500 text-white"
  }

  const getDayBgColor = (date: Date) => {
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return "bg-gray-100"
    }
    const weekNumber = Math.floor((date.getDate() - 1) / 7)
    return weekNumber % 2 === 0 ? "bg-white" : "bg-gray-50"
  }

  const formatTime = (isoString: string) => {
    if (!isoString) return ""
    try {
      return formatInArgentina(isoString, "HH:mm")
    } catch {
      // Fallback si formatInArgentina falla
      try {
        const date = new Date(isoString)
        return format(date, "HH:mm")
      } catch {
        return ""
      }
    }
  }

  // Verificar si el usuario ya tiene rotativo activo en este evento
  // (excluir rechazados y cancelados)
  const userHasRotativo = (evento: Evento) => {
    return evento.rotativos?.some(r =>
      r.user.id === userId &&
      r.estado !== "RECHAZADO" &&
      r.estado !== "CANCELADO"
    )
  }

  // Helper para obtener colores de títulos para una fecha
  const getTituloColorsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    return tituloRanges.filter(t =>
      dateStr >= t.startDate && dateStr <= t.endDate
    )
  }

  // Handlers para títulos
  const handleCreateTitulo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tituloForm.startDate || !tituloForm.endDate) {
      toast.error("Las fechas de inicio y fin son requeridas")
      return
    }
    setSubmitting(true)

    const res = await fetch("/api/titulos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tituloForm),
    })

    if (res.ok) {
      toast.success("Título creado")
      lastFetchedYearRef.current = null // Forzar re-fetch
      fetchTitulos(mesActual.getFullYear())
      fetchEventos(mesActual)
      setSidebarMode("titulos")
      setTituloForm({ name: "", type: "OPERA", color: "#3b82f6", cupo: 4, startDate: "", endDate: "" })
    } else {
      const error = await res.json()
      toast.error(error.error || "Error al crear título")
    }
    setSubmitting(false)
  }

  const handleUpdateTitulo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTitulo) return
    if (!tituloForm.startDate || !tituloForm.endDate) {
      toast.error("Las fechas de inicio y fin son requeridas")
      return
    }
    setSubmitting(true)

    const res = await fetch(`/api/titulos/${editingTitulo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tituloForm),
    })

    if (res.ok) {
      toast.success("Título actualizado")
      lastFetchedYearRef.current = null // Forzar re-fetch
      fetchTitulos(mesActual.getFullYear())
      fetchEventos(mesActual)
      setSidebarMode("titulos")
      setEditingTitulo(null)
    } else {
      const error = await res.json()
      toast.error(error.error || "Error al actualizar")
    }
    setSubmitting(false)
  }

  const handleDeleteTitulo = async (titulo: Titulo) => {
    // Validar que la fecha de fin del titulo no haya pasado (si está disponible)
    if (titulo.endDate) {
      const now = new Date(debugDate)
      now.setHours(0, 0, 0, 0)
      const tituloEndDate = new Date(titulo.endDate)
      tituloEndDate.setHours(0, 0, 0, 0)

      if (tituloEndDate < now) {
        toast.error("No se puede eliminar un título cuya fecha de fin ya pasó")
        return
      }
    }

    if (!confirm(`¿Eliminar "${titulo.name}"? Se eliminarán todos sus eventos.`)) return

    const res = await fetch(`/api/titulos/${titulo.id}`, { method: "DELETE" })

    if (res.ok) {
      toast.success("Título eliminado")
      lastFetchedYearRef.current = null // Forzar re-fetch
      fetchTitulos(mesActual.getFullYear())
      fetchEventos(mesActual)
    } else {
      const error = await res.json()
      toast.error(error.error || "Error al eliminar")
    }
  }

  // Handlers para eventos
  const handleCreateEvento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventoForm.tituloId || !eventoForm.date) {
      toast.error("Completa todos los campos")
      return
    }
    setSubmitting(true)

    try {
      const res = await fetch(`/api/titulos/${eventoForm.tituloId}/eventos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: eventoForm.date,
          eventoType: eventoForm.eventoType,
          ensayoTipo: eventoForm.eventoType === "ENSAYO" ? eventoForm.ensayoTipo : undefined,
          startTime: toISOFromArgentina(eventoForm.date, eventoForm.startTime),
          endTime: toISOFromArgentina(eventoForm.date, eventoForm.endTime),
          cupoOverride: eventoForm.cupoOverride,
        }),
      })

      if (res.ok) {
        toast.success("Evento creado")
        fetchEventos(mesActual)
        setSidebarMode("eventos")
      } else {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Error al crear evento")
      }
    } catch (err) {
      toast.error("Error de conexión")
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateEvento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEvento) return
    setSubmitting(true)

    const res = await fetch(`/api/calendario/${editingEvento.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventoType: eventoForm.eventoType,
        ensayoTipo: eventoForm.eventoType === "ENSAYO" ? eventoForm.ensayoTipo : undefined,
        date: eventoForm.date,
        startTime: toISOFromArgentina(eventoForm.date, eventoForm.startTime),
        endTime: toISOFromArgentina(eventoForm.date, eventoForm.endTime),
        cupoOverride: eventoForm.cupoOverride,
      }),
    })

    if (res.ok) {
      toast.success("Evento actualizado")
      fetchEventos(mesActual)
      setSidebarMode("eventos")
      setEditingEvento(null)
    } else {
      const error = await res.json()
      toast.error(error.error || "Error al actualizar")
    }
    setSubmitting(false)
  }

  const handleDeleteEvento = async (evento: Evento) => {
    // Validar que el evento no haya pasado
    const now = new Date(debugDate)
    now.setHours(0, 0, 0, 0)
    const eventoDate = new Date(evento.date)
    eventoDate.setHours(0, 0, 0, 0)

    if (eventoDate < now) {
      toast.error("No se puede eliminar un evento cuya fecha ya pasó")
      return
    }

    // Abrir diálogo de confirmación doble
    setDeleteEventoTarget(evento)
    setDeleteConfirmText("")
    setDeleteEventoDialogOpen(true)
  }

  const confirmDeleteEvento = async () => {
    if (!deleteEventoTarget) return

    const res = await fetch(`/api/calendario/${deleteEventoTarget.id}`, { method: "DELETE" })

    if (res.ok) {
      const rotativosCount = deleteEventoTarget.rotativos?.length || 0
      toast.success(
        rotativosCount > 0
          ? `Evento eliminado junto con ${rotativosCount} rotativo${rotativosCount > 1 ? 's' : ''}`
          : "Evento eliminado"
      )
      fetchEventos(mesActual)
      setSelectedEvento(null)
      setSidebarMode("eventos")
    } else {
      const error = await res.json()
      toast.error(error.error || "Error al eliminar")
    }

    setDeleteEventoDialogOpen(false)
    setDeleteEventoTarget(null)
    setDeleteConfirmText("")
  }

  // Handler para solicitar rotativo - primero valida, luego pide confirmación si es necesario
  const handleSolicitarRotativo = async (evento: Evento) => {
    if (userHasRotativo(evento)) {
      toast.error("Ya tienes un rotativo en este evento")
      return
    }

    if (evento.cupoDisponible <= 0) {
      toast.error("No hay cupo disponible")
      return
    }

    setSubmitting(true)

    try {
      // Mostrar progreso de validación de reglas
      const showRulesProgress = async () => {
        for (const regla of reglasValidacion) {
          setValidatingRule(regla)
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      // Ejecutar validación y animación en paralelo
      const [validationRes] = await Promise.all([
        fetch("/api/solicitudes/validar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: evento.id }),
        }),
        showRulesProgress(),
      ])

      setValidatingRule(null)

      if (!validationRes.ok) {
        try {
          const error = await validationRes.json()
          toast.error(error.error || "Error al validar")
        } catch {
          toast.error("Error al procesar la respuesta del servidor")
        }
        setSubmitting(false)
        return
      }

      const validation = await validationRes.json()

      // Si requiere aprobación, mostrar diálogo de confirmación
      if (validation.requiereAprobacion) {
        setConfirmMotivo(validation.motivoTexto)
        setConfirmEventId(evento.id)
        setConfirmDialogOpen(true)
        setSubmitting(false)
        return
      }

      // Si no requiere aprobación, crear directamente
      await crearRotativo(evento.id, false, null)
    } catch (error) {
      console.error("Error en handleSolicitarRotativo:", error)
      toast.error("Error de conexión. Verifica tu conexión a internet.")
      setValidatingRule(null)
      setSubmitting(false)
    }
  }

  // Función para crear el rotativo (después de validación o confirmación)
  const crearRotativo = async (eventId: string, requiereAprobacion: boolean, motivo: string | null) => {
    setSubmitting(true)

    try {
      const res = await fetch("/api/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, requiereAprobacion, motivo }),
      })

      if (res.ok) {
        const data = await res.json()
        await fetchEventos(mesActual)
        setSidebarMode("rotativos")
        setSelectedEvento(null)

        if (data.estado === "PENDIENTE") {
          toast.success("Solicitud enviada para aprobación")
        } else {
          toast.success("Rotativo aprobado")
        }
      } else {
        try {
          const error = await res.json()
          toast.error(error.error || "Error al solicitar")
        } catch {
          toast.error("Error al procesar la respuesta del servidor")
        }
      }
    } catch (error) {
      console.error("Error en crearRotativo:", error)
      toast.error("Error de conexión. Verifica tu conexión a internet y recarga la página.")
    } finally {
      setSubmitting(false)
    }
  }

  // Handler para confirmar solicitud de aprobación
  const handleConfirmarSolicitud = async () => {
    if (!confirmEventId) return
    setConfirmDialogOpen(false)
    await crearRotativo(confirmEventId, true, confirmMotivo)
    setConfirmEventId(null)
    setConfirmMotivo(null)
  }

  // Handler para cancelar solicitud de aprobación
  const handleCancelarSolicitud = () => {
    setConfirmDialogOpen(false)
    setConfirmEventId(null)
    setConfirmMotivo(null)
  }

  // Handler para abrir diálogo de bloque completo
  const handleSolicitarBloque = async (tituloId: string, tituloName: string) => {
    setLoadingBloque(true)
    setBloqueDialogOpen(true)

    try {
      const res = await fetch("/api/bloques/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tituloId, validate: true }),
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || "Error al validar bloque")
        setBloqueDialogOpen(false)
        setLoadingBloque(false)
        return
      }

      const data = await res.json()
      setBloqueInfo({
        tituloId,
        tituloName,
        totalEventos: data.totalEventos,
        requiereAprobacion: data.requiereAprobacion,
        motivos: data.motivos || [],
      })
    } catch {
      toast.error("Error de conexión")
      setBloqueDialogOpen(false)
    }
    setLoadingBloque(false)
  }

  // Handler para confirmar solicitud de bloque
  const handleConfirmarBloque = async () => {
    if (!bloqueInfo) return
    setLoadingBloque(true)

    try {
      const res = await fetch("/api/bloques/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tituloId: bloqueInfo.tituloId, validate: false }),
      })

      if (res.ok) {
        const data = await res.json()
        await fetchEventos(mesActual)
        setSidebarMode("rotativos")
        setSelectedEvento(null)
        toast.success(data.message)
      } else {
        const error = await res.json()
        toast.error(error.error || "Error al solicitar bloque")
      }
    } catch {
      toast.error("Error de conexión")
    }

    setBloqueDialogOpen(false)
    setBloqueInfo(null)
    setLoadingBloque(false)
  }

  // Handler para cancelar solicitud de bloque
  const handleCancelarBloque = () => {
    setBloqueDialogOpen(false)
    setBloqueInfo(null)
  }

  // Handler para cancelar rotativo
  const handleCancelarRotativo = async (evento: Evento) => {
    const miRotativo = evento.rotativos?.find(r => r.user.id === userId)
    if (!miRotativo) return

    if (!confirm("¿Cancelar tu rotativo en este evento?")) return

    setSubmitting(true)
    const res = await fetch(`/api/solicitudes/${miRotativo.id}`, {
      method: "DELETE",
    })

    if (res.ok) {
      toast.success("Rotativo cancelado")
      await fetchEventos(mesActual)
      setSidebarMode("rotativos")
      setSelectedEvento(null)
    } else {
      const error = await res.json()
      toast.error(error.error || "Error al cancelar")
    }
    setSubmitting(false)
  }

  const openEditTitulo = (titulo: Titulo) => {
    setEditingTitulo(titulo)
    // Fallback para datos cacheados que pueden tener cupoEnsayo/cupoFuncion en lugar de cupo
    const defaultCupos: Record<string, number> = { OPERA: 4, BALLET: 4, CONCIERTO: 2 }
    const cupoValue = titulo.cupo ?? defaultCupos[titulo.type] ?? 4
    setTituloForm({
      name: titulo.name,
      type: titulo.type,
      color: titulo.color || "#3b82f6",
      cupo: cupoValue,
      startDate: titulo.startDate?.substring(0, 10) || "",
      endDate: titulo.endDate?.substring(0, 10) || "",
    })
    setSidebarMode("editar-titulo")
  }

  const openEditEvento = (evento: Evento) => {
    setEditingEvento(evento)
    const startTime = formatTime(evento.startTime) || "14:00"
    const endTime = formatTime(evento.endTime) || "17:00"

    // Determinar ensayoTipo basado en el título
    let ensayoTipo: "ENSAYO" | "PRE_GENERAL" | "GENERAL" = "ENSAYO"
    if (evento.title.includes("Pre General")) {
      ensayoTipo = "PRE_GENERAL"
    } else if (evento.title.includes("Ensayo General") || evento.title === "General") {
      ensayoTipo = "GENERAL"
    }

    setEventoForm({
      tituloId: evento.tituloId,
      eventoType: evento.eventoType,
      ensayoTipo,
      date: evento.date.substring(0, 10),
      startTime,
      endTime,
      cupoOverride: evento.cupoOverride ?? null,
    })
    // Verificar si es un horario predefinido
    const fechaEvento = evento.date.substring(0, 10)
    const predefinidos = getHorariosPredefinidos(evento.eventoType, fechaEvento)
    const esPredefinido = predefinidos.some(h => h.start === startTime)
    setHorarioCustom(!esPredefinido || predefinidos.length === 0)
    setSidebarMode("editar-evento")
  }

  const openNuevoEvento = (date?: Date) => {
    const fechaStr = date ? format(date, "yyyy-MM-dd") : ""
    const horarios = getHorariosPredefinidos("ENSAYO", fechaStr)
    const tieneHorariosPredefinidos = horarios.length > 0
    // En domingos no hay ensayos comunes, default a GENERAL
    const ensayoTipoDefault = esDomingo(fechaStr) ? "GENERAL" : "ENSAYO"

    setEventoForm({
      tituloId: "",
      eventoType: "ENSAYO",
      ensayoTipo: ensayoTipoDefault,
      date: fechaStr,
      startTime: tieneHorariosPredefinidos ? horarios[0].start : "14:00",
      endTime: tieneHorariosPredefinidos ? horarios[0].end : "17:00",
      cupoOverride: null,
    })
    setHorarioCustom(!tieneHorariosPredefinidos)
    setSidebarMode("nuevo-evento")
  }

  const openDetalleEvento = (evento: Evento) => {
    setSelectedEvento(evento)
    setSidebarMode("detalle-evento")
    // En mobile, abrir el sidebar automáticamente
    if (window.innerWidth < 768) {
      setRightSidebarOpen(true)
    }
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    setSelectedEvento(null)
    setSidebarMode("eventos")
    // En mobile, abrir el sidebar automáticamente
    if (window.innerWidth < 768) {
      setRightSidebarOpen(true)
    }
  }

  // Obtener las fechas de la semana actual (martes a domingo, sin lunes)
  const getSemanaActual = () => {
    const fechaBase = selectedDate || new Date(debugDate)
    const dayOfWeek = fechaBase.getDay()
    // Ajustar para que martes sea el primer día
    const diff = dayOfWeek === 0 ? -5 : dayOfWeek === 1 ? 1 : 2 - dayOfWeek
    const martes = new Date(fechaBase)
    martes.setDate(fechaBase.getDate() + diff)

    const dias: Date[] = []
    for (let i = 0; i < 6; i++) { // 6 días: martes a domingo
      const dia = new Date(martes)
      dia.setDate(martes.getDate() + i)
      dias.push(dia)
    }
    return dias
  }

  const navegarSemana = (direccion: number) => {
    const nuevaFecha = new Date(selectedDate || new Date(debugDate))
    nuevaFecha.setDate(nuevaFecha.getDate() + (direccion * 7))
    setSelectedDate(nuevaFecha)
    // Actualizar mes si cambia
    if (nuevaFecha.getMonth() !== mesActual.getMonth() || nuevaFecha.getFullYear() !== mesActual.getFullYear()) {
      setMesActual(new Date(nuevaFecha.getFullYear(), nuevaFecha.getMonth(), 1))
    }
  }

  // Renderizado para vista de mes (compacto)
  const renderDayContentMes = (date: Date) => {
    const eventosDelDia = getEventosDelDia(date)
    const tituloColors = getTituloColorsForDate(date)

    const tieneContenido = eventosDelDia.length > 0

    return (
      <div className="relative w-full h-full flex flex-col py-1 overflow-hidden">
        {/* Fondo con colores de títulos (transparente) */}
        {tituloColors.length > 0 && (
          <div className="absolute inset-0 flex pointer-events-none">
            {tituloColors.map(t => (
              <div
                key={t.id}
                className="flex-1"
                style={{ backgroundColor: t.color || "#6b7280", opacity: 0.12 }}
              />
            ))}
          </div>
        )}
        <span className="relative font-semibold text-base pl-1.5">{date.getDate()}</span>
        {tieneContenido && (
          <div className="flex flex-col gap-1.5 mt-1 w-full px-1 overflow-y-auto flex-1">
            {/* Eventos con sus rotativos */}
            {eventosDelDia.map((e, i) => (
              <div
                key={`evento-${i}`}
                className="flex flex-col"
              >
                {/* Evento */}
                <div
                  className="text-[11px] leading-snug px-1.5 py-1 rounded-t text-white font-medium"
                  style={{ backgroundColor: getEventColor(e) }}
                >
                  <div className="flex items-center gap-1">
                    <span className={`font-black rounded px-1 ${getBadgeColor(e)}`}>{e.eventoType === "FUNCION" ? "F" : "E"}</span>
                    <span>{formatTime(e.startTime)} · {getEventTypeLabel(e)}</span>
                    <span className="ml-auto bg-white/30 rounded px-1">{e.rotativosUsados}/{e.cupoEfectivo}</span>
                  </div>
                  <div className="line-clamp-2">{e.tituloName}</div>
                </div>
                {/* Rotativos del evento */}
                {e.rotativos && e.rotativos.length > 0 && (
                  <div className="bg-gray-100 rounded-b px-1.5 py-1 flex flex-wrap gap-1">
                    {e.rotativos.slice(0, 4).map((r, j) => {
                      const tieneExcepcion = r.estado === "APROBADO" && r.motivo && r.motivo !== "Validado por la fila"
                      return (
                        <span
                          key={j}
                          className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                            tieneExcepcion
                              ? "bg-amber-200 text-amber-800"
                              : r.estado === "APROBADO"
                                ? "bg-green-200 text-green-800"
                                : "bg-yellow-200 text-yellow-800"
                          }`}
                          title={tieneExcepcion ? r.motivo || "" : ""}
                        >
                          {r.user.alias || r.user.name.split(" ")[0]}
                          {tieneExcepcion && <AlertTriangle className="w-2.5 h-2.5" />}
                        </span>
                      )
                    })}
                    {e.rotativos.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{e.rotativos.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Eventos del día seleccionado
  const eventosDelDiaSeleccionado = selectedDate ? getEventosDelDia(selectedDate) : []

  // Obtener rotativos de eventos (nuevo sistema)
  const rotativosDeEventos = eventos.flatMap(e =>
    (e.rotativos || []).map(r => ({
      id: r.id,
      tipo: "evento" as const,
      fecha: e.date,
      estado: r.estado,
      motivo: r.motivo,
      user: r.user,
      evento: e,
    }))
  )

  // Ordenar rotativos por fecha
  const todosLosRotativos = rotativosDeEventos
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

  // Filtrar rotativos según la vista
  const rotativosFiltrados = verSoloMios
    ? todosLosRotativos.filter(r => r.user.id === userId)
    : todosLosRotativos

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Calendar className="w-8 h-8 text-primary" />
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Eventos, ensayos, funciones y rotativos
          </p>
        </div>
        {/* Botón para abrir sidebar en móvil */}
        {!rightSidebarOpen && (
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setRightSidebarOpen(true)}
          >
            <PanelRightOpen className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="flex gap-4">
        {/* Calendario - flexible */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="p-2 pt-1.5 md:p-4">
              <div className={`transition-opacity duration-200 ${loading ? "opacity-60" : ""}`}>
                {/* Header del calendario - Compacto en móvil */}
                <div className="flex flex-col gap-3 mb-3 md:gap-2 md:mb-4">
                  {/* Navegación de fecha */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      className="p-2.5 hover:bg-muted rounded-lg transition-colors active:bg-muted/80"
                      onClick={() => vistaCalendario === "mes"
                        ? setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() - 1))
                        : navegarSemana(-1)
                      }
                    >
                      <ChevronLeft className="h-5 w-5 md:h-5 md:w-5" />
                    </button>
                    <h2 className="text-base md:text-xl font-semibold text-center min-w-[160px]">
                      {vistaCalendario === "mes"
                        ? format(mesActual, "LLLL yyyy", { locale: es }).replace(/^\w/, c => c.toUpperCase())
                        : (() => {
                            const semana = getSemanaActual()
                            const inicio = semana[0]
                            const fin = semana[5] // Ahora son 6 días (índices 0-5)
                            if (inicio.getMonth() === fin.getMonth()) {
                              return `${inicio.getDate()} - ${fin.getDate()} ${format(fin, "MMMM yyyy", { locale: es })}`
                            }
                            return `${inicio.getDate()} ${format(inicio, "MMM", { locale: es })} - ${fin.getDate()} ${format(fin, "MMM yyyy", { locale: es })}`
                          })()
                      }
                    </h2>
                    <button
                      className="p-2.5 hover:bg-muted rounded-lg transition-colors active:bg-muted/80"
                      onClick={() => vistaCalendario === "mes"
                        ? setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + 1))
                        : navegarSemana(1)
                      }
                    >
                      <ChevronRight className="h-5 w-5 md:h-5 md:w-5" />
                    </button>
                  </div>

                  {/* Controles: botones de vista y toggle en una fila */}
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant={vistaCalendario === "mes" ? "default" : "outline"}
                        size="sm"
                        className="h-8 px-3 text-xs md:h-9 md:px-3 md:text-sm"
                        onClick={() => setVistaCalendario("mes")}
                      >
                        Mes
                      </Button>
                      <Button
                        variant={vistaCalendario === "semana" ? "default" : "outline"}
                        size="sm"
                        className="h-8 px-3 text-xs md:h-9 md:px-3 md:text-sm"
                        onClick={() => setVistaCalendario("semana")}
                      >
                        Semana
                      </Button>
                      <button
                        className="text-xs md:text-sm text-primary hover:underline font-medium px-2 py-1"
                        onClick={() => {
                          const hoy = new Date(debugDate)
                          setSelectedDate(hoy)
                          setMesActual(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
                        }}
                      >
                        Hoy
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs md:text-sm">
                      <span className={!modoLista ? "font-medium" : "text-muted-foreground"}>Grilla</span>
                      <Switch
                        checked={modoLista}
                        onCheckedChange={setModoLista}
                      />
                      <span className={modoLista ? "font-medium" : "text-muted-foreground"}>Lista</span>
                    </div>
                  </div>
                </div>

                {/* Grilla del calendario */}
                <div className="w-full mt-3 md:mt-4">
                  {modoLista ? (
                    <>
                      {/* Vista de Lista - un día por fila */}
                      <div className="space-y-2">
                        {(() => {
                          // Obtener días según la vista (mes o semana)
                          const diasAMostrar: Date[] = []

                          if (vistaCalendario === "mes") {
                            const firstDay = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1)
                            const lastDay = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0)
                            for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
                              diasAMostrar.push(new Date(d))
                            }
                          } else {
                            // Semana
                            for (const dia of getSemanaActual()) {
                              diasAMostrar.push(dia)
                            }
                          }

                          const diasConEventos = diasAMostrar
                            .map(date => ({ date, eventos: getEventosDelDia(date) }))
                            .filter(({ eventos }) => eventos.length > 0)

                          if (diasConEventos.length === 0) {
                            return (
                              <div className="text-center py-8 text-muted-foreground">
                                No hay eventos {vistaCalendario === "mes" ? "este mes" : "esta semana"}
                              </div>
                            )
                          }

                          return diasConEventos.map(({ date, eventos }) => {
                            const isToday = date.toDateString() === debugDate.toDateString()
                            const tituloColors = getTituloColorsForDate(date)

                            return (
                              <div
                                key={date.toISOString()}
                                className={`border rounded-lg overflow-hidden ${
                                  isToday ? "ring-2 ring-amber-400" : ""
                                }`}
                              >
                                {/* Header con fecha y bandas de color de títulos */}
                                <div
                                  className="relative bg-muted/50 px-4 py-2 border-b cursor-pointer hover:bg-muted/70 transition-colors"
                                  onClick={() => handleDayClick(date)}
                                >
                                  {tituloColors.length > 0 && (
                                    <div className="absolute inset-0 flex pointer-events-none">
                                      {tituloColors.map(t => (
                                        <div
                                          key={t.id}
                                          className="flex-1"
                                          style={{ backgroundColor: t.color || "#6b7280", opacity: 0.15 }}
                                        />
                                      ))}
                                    </div>
                                  )}
                                  <div className="relative flex items-baseline gap-1">
                                    <span className="font-semibold text-base">{date.getDate()}</span>
                                    <span className="text-sm text-muted-foreground">
                                      {format(date, "EEE", { locale: es }).toLowerCase()}
                                    </span>
                                    {tituloColors.length > 0 && (
                                      <span className="text-xs text-muted-foreground ml-auto">
                                        {tituloColors.map(t => t.name).join(", ")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Lista de eventos */}
                                <div className="divide-y cursor-pointer" onClick={() => handleDayClick(date)}>
                                  {eventos.map(evento => (
                                    <div
                                      key={evento.id}
                                      className="p-3 hover:bg-muted/50 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div
                                          className="w-1 self-stretch rounded"
                                          style={{ backgroundColor: getEventColor(evento) }}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className={`font-black rounded px-1 ${getBadgeColor(evento)}`}>{evento.eventoType === "FUNCION" ? "F" : "E"}</span>
                                            <p className="font-medium truncate">{evento.tituloName}</p>
                                            <Badge variant={evento.cupoDisponible > 0 ? "outline" : "secondary"} className="ml-auto">
                                              {evento.rotativosUsados}/{evento.cupoEfectivo} rot.
                                            </Badge>
                                          </div>
                                          <p className="text-sm text-muted-foreground">
                                            {getEventTypeLabel(evento)} · {formatTime(evento.startTime)}
                                          </p>
                                          {/* Nombres completos de rotativos en vista lista */}
                                          {evento.rotativos && evento.rotativos.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                              {evento.rotativos.map((r) => {
                                                const tieneExcepcion = r.estado === "APROBADO" && r.motivo && r.motivo !== "Validado por la fila"
                                                return (
                                                  <span
                                                    key={r.id}
                                                    className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                                                      tieneExcepcion
                                                        ? "bg-amber-100 text-amber-800"
                                                        : r.estado === "APROBADO"
                                                          ? "bg-green-100 text-green-800"
                                                          : "bg-yellow-100 text-yellow-800"
                                                    }`}
                                                    title={tieneExcepcion ? r.motivo || "" : ""}
                                                  >
                                                    {r.user.alias || r.user.name.split(" ")[0]}
                                                    {tieneExcepcion && <AlertTriangle className="w-3 h-3" />}
                                                  </span>
                                                )
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </>
                  ) : vistaCalendario === "mes" ? (
                    <>
                      {/* Vista de Mes */}
                      {/* Días de la semana */}
                      <div className="grid grid-cols-6 border border-border">
                        {["ma", "mi", "ju", "vi", "sá", "do"].map((dia) => (
                          <div key={dia} className="text-muted-foreground font-medium text-sm py-2 text-center bg-muted/50 border-r border-border last:border-r-0">
                            {dia}
                          </div>
                        ))}
                      </div>
                      {/* Celdas del calendario (sin lunes) */}
                      <div className="grid grid-cols-6 border-l border-r border-b border-border">
                        {(() => {
                          const firstDay = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1)
                          const lastDay = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0)
                          // Calcular día de inicio (martes=0, mie=1, jue=2, vie=3, sab=4, dom=5)
                          const jsDay = firstDay.getDay() // dom=0, lun=1, mar=2...
                          // Convertir: mar=0, mie=1, jue=2, vie=3, sab=4, dom=5, lun se salta
                          const startDayOfWeek = jsDay === 0 ? 5 : jsDay === 1 ? 0 : jsDay - 2
                          const daysInMonth = lastDay.getDate()
                          const prevMonth = new Date(mesActual.getFullYear(), mesActual.getMonth(), 0)
                          const daysInPrevMonth = prevMonth.getDate()

                          const cells: { date: Date; isOutside: boolean }[] = []

                          // Días del mes anterior (excluyendo lunes)
                          let daysToAdd = startDayOfWeek
                          let prevDay = daysInPrevMonth
                          const prevDays: { date: Date; isOutside: boolean }[] = []
                          while (daysToAdd > 0) {
                            const date = new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, prevDay)
                            if (date.getDay() !== 1) { // No es lunes
                              prevDays.unshift({ date, isOutside: true })
                              daysToAdd--
                            }
                            prevDay--
                          }
                          cells.push(...prevDays)

                          // Días del mes actual (excluyendo lunes)
                          for (let day = 1; day <= daysInMonth; day++) {
                            const date = new Date(mesActual.getFullYear(), mesActual.getMonth(), day)
                            if (date.getDay() !== 1) { // No es lunes
                              cells.push({ date, isOutside: false })
                            }
                          }

                          // Días del mes siguiente para completar la grilla (6 filas x 6 cols = 36)
                          let nextDay = 1
                          while (cells.length < 36) {
                            const date = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, nextDay)
                            if (date.getDay() !== 1) { // No es lunes
                              cells.push({ date, isOutside: true })
                            }
                            nextDay++
                          }

                          return cells.map((cell, idx) => {
                            const isToday = cell.date.toDateString() === debugDate.toDateString()
                            const isSelected = selectedDate?.toDateString() === cell.date.toDateString()

                            return (
                              <div
                                key={idx}
                                className={`h-36 border-b border-r border-border overflow-hidden cursor-pointer transition-all ${
                                  cell.isOutside ? "bg-gray-100/50 text-muted-foreground/50" : getDayBgColor(cell.date)
                                } ${isToday ? "ring-2 ring-inset ring-amber-400" : ""} ${
                                  isSelected ? "ring-2 ring-inset ring-primary" : ""
                                } hover:bg-muted/50`}
                                onClick={() => handleDayClick(cell.date)}
                              >
                                {renderDayContentMes(cell.date)}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Vista de Semana (sin lunes) */}
                      {/* Días de la semana */}
                      <div className="grid grid-cols-6 border border-border">
                        {["ma", "mi", "ju", "vi", "sá", "do"].map((dia) => (
                          <div key={dia} className="text-muted-foreground font-medium text-sm py-2 text-center bg-muted/50 border-r border-border last:border-r-0">
                            {dia}
                          </div>
                        ))}
                      </div>
                      {/* Celdas de la semana */}
                      <div className="grid grid-cols-6 border-l border-r border-b border-border">
                        {getSemanaActual().filter(dia => dia.getDay() !== 1).map((dia, idx) => {
                          const isToday = dia.toDateString() === debugDate.toDateString()
                          const isSelected = selectedDate?.toDateString() === dia.toDateString()

                          return (
                            <div
                              key={idx}
                              className={`min-h-[120px] border-b border-r border-border overflow-hidden cursor-pointer transition-all ${
                                getDayBgColor(dia)
                              } ${isToday ? "ring-2 ring-inset ring-amber-400" : ""} ${
                                isSelected ? "ring-2 ring-inset ring-primary" : ""
                              } hover:bg-muted/50`}
                              onClick={() => handleDayClick(dia)}
                            >
                              {renderDayContentMes(dia)}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Botón para abrir sidebar derecho cuando está cerrado (desktop) */}
        {!rightSidebarOpen && (
          <Button
            variant="outline"
            size="icon"
            className="hidden md:flex h-10 w-10 flex-shrink-0 self-start sticky top-4"
            onClick={() => setRightSidebarOpen(true)}
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        )}

        {/* Overlay para mobile */}
        {rightSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setRightSidebarOpen(false)}
          />
        )}

        {/* Sidebar derecho */}
        <div className={`
          ${rightSidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
          ${rightSidebarOpen ? "md:w-80 md:min-w-80" : "md:w-0 md:min-w-0 md:overflow-hidden"}
          fixed md:relative right-0 top-0 md:top-auto h-full md:h-auto w-[85vw] max-w-sm md:max-w-none
          transition-all duration-300 z-50 md:z-auto
        `}>
          {rightSidebarOpen && (
          <Card className="h-full md:h-auto md:sticky md:top-4 rounded-none md:rounded-lg overflow-y-auto">
            <CardHeader className="pb-3">
              {/* Botón cerrar sidebar */}
              <div className="flex justify-end -mt-2 -mr-2 mb-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRightSidebarOpen(false)}>
                  <X className="h-4 w-4 md:hidden" />
                  <PanelRightClose className="h-4 w-4 hidden md:block" />
                </Button>
              </div>
              {/* Menu de navegación */}
              {["rotativos", "titulos", "eventos"].includes(sidebarMode) && (
                <nav className="flex gap-4 mb-3 border-b">
                  <button
                    className={`flex items-center gap-1.5 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      sidebarMode === "rotativos"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setSidebarMode("rotativos")}
                  >
                    <Users className="w-4 h-4" />
                    Rotativos
                  </button>
                  <button
                    className={`flex items-center gap-1.5 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      sidebarMode === "eventos"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setSidebarMode("eventos")}
                  >
                    <Theater className="w-4 h-4" />
                    Eventos
                  </button>
                  <button
                    className={`flex items-center gap-1.5 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      sidebarMode === "titulos"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setSidebarMode("titulos")}
                  >
                    <Music className="w-4 h-4" />
                    Títulos
                  </button>
                </nav>
              )}
              {/* Título ABAJO */}
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {sidebarMode === "rotativos" && (
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1 hover:bg-muted rounded transition-colors"
                        onClick={() => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="min-w-[120px] text-center">
                        {format(mesActual, "MMMM yyyy", { locale: es }).replace(/^\w/, c => c.toUpperCase())}
                      </span>
                      <button
                        className="p-1 hover:bg-muted rounded transition-colors"
                        onClick={() => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {sidebarMode === "titulos" && "Títulos"}
                  {sidebarMode === "eventos" && (selectedDate ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es }) : "Eventos del día")}
                  {sidebarMode === "nuevo-titulo" && "Nuevo Título"}
                  {sidebarMode === "editar-titulo" && "Editar Título"}
                  {sidebarMode === "nuevo-evento" && "Nuevo Evento"}
                  {sidebarMode === "editar-evento" && "Editar Evento"}
                  {sidebarMode === "detalle-evento" && selectedEvento?.tituloName}
                </CardTitle>
                {!["rotativos", "titulos", "eventos"].includes(sidebarMode) && (
                  <Button variant="ghost" size="icon" onClick={() => {
                    setSelectedEvento(null)
                    setSidebarMode("rotativos")
                  }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              {/* Vista de rotativos del mes */}
              {sidebarMode === "rotativos" && (
                <div className="space-y-3">
                  {/* Toggle mis rotativos / todos */}
                  <div className="flex gap-1">
                    <Button
                      variant={verSoloMios ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setVerSoloMios(true)}
                    >
                      Mis rotativos
                    </Button>
                    <Button
                      variant={!verSoloMios ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setVerSoloMios(false)}
                    >
                      Todos
                    </Button>
                  </div>

                  {/* Texto de ayuda */}
                  <p className="text-xs text-muted-foreground">
                    Para solicitar un rotativo, seleccioná un día en el calendario y elegí el evento desde la pestaña Eventos.
                  </p>

                  {/* Lista de rotativos */}
                  {rotativosFiltrados.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      {verSoloMios ? "No tienes rotativos este mes" : "No hay rotativos este mes"}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {rotativosFiltrados.map((r) => {
                        const tieneExcepcion = (r.estado === "APROBADO" || r.estado === "APROBADA") && r.motivo && r.motivo !== "Validado por la fila"
                        return (
                          <div
                            key={r.id}
                            className={`p-3 rounded-lg border ${r.evento ? "cursor-pointer hover:bg-muted/50" : ""} transition-colors ${
                              tieneExcepcion ? "bg-amber-50 border-amber-200" : ""
                            }`}
                            style={{
                              borderLeftColor: tieneExcepcion
                                ? "#f59e0b"
                                : r.evento
                                  ? getEventColor(r.evento)
                                  : (r.estado === "APROBADA" ? "#22c55e" : "#eab308"),
                              borderLeftWidth: 4
                            }}
                            onClick={() => r.evento && openDetalleEvento(r.evento)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {r.evento && (
                                    <span className={`font-black text-xs rounded px-1 ${getBadgeColor(r.evento)}`}>
                                      {r.evento.eventoType === "FUNCION" ? "F" : "E"}
                                    </span>
                                  )}
                                  <span className="font-medium text-sm truncate">
                                    {r.user.alias || r.user.name}
                                  </span>
                                  {tieneExcepcion && <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatInArgentina(r.fecha, "EEEE d MMM")}
                                  {r.evento && (
                                    <> · {formatTime(r.evento.startTime)} · {r.evento.tituloName}</>
                                  )}
                                </p>
                                {tieneExcepcion && r.motivo && (
                                  <p className="text-xs text-amber-700 mt-1">{r.motivo}</p>
                                )}
                              </div>
                              <Badge
                                variant={r.estado === "APROBADO" || r.estado === "APROBADA" ? "default" : "secondary"}
                                className="text-xs flex-shrink-0"
                              >
                                {r.estado === "APROBADA" ? "APROBADO" : r.estado}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Detalle del día seleccionado */}
              {sidebarMode === "eventos" && (
                <div className="space-y-4">
                  {!selectedDate ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      Selecciona un día del calendario
                    </p>
                  ) : (
                    <>
                      {/* Acciones del día */}
                      {isAdmin && (
                        <div className="flex gap-2">
                          <Button className="flex-1" size="sm" onClick={() => openNuevoEvento(selectedDate)}>
                            <Plus className="w-4 h-4 mr-1" />
                            Evento
                          </Button>
                        </div>
                      )}

                      {/* Link para solicitar bloque completo - solo títulos cuyo rango incluye la fecha seleccionada y el usuario no tiene rotativos */}
                      {(() => {
                        const titulosEnRango = titulos.filter(titulo => {
                          if (!titulo.startDate || !titulo.endDate || !selectedDate) return false
                          // Las fechas vienen como ISO strings, crear Date objects
                          const start = new Date(titulo.startDate)
                          start.setHours(0, 0, 0, 0)
                          const end = new Date(titulo.endDate)
                          end.setHours(23, 59, 59, 999)
                          // Normalizar selectedDate también
                          const selected = new Date(selectedDate)
                          selected.setHours(12, 0, 0, 0)
                          if (!(selected >= start && selected <= end)) return false

                          // Verificar si el usuario ya tiene rotativos en eventos de este título
                          const tieneRotativosEnTitulo = eventos.some(evento =>
                            evento.tituloId === titulo.id &&
                            evento.rotativos?.some(r => r.user.id === userId)
                          )
                          return !tieneRotativosEnTitulo
                        })
                        if (titulosEnRango.length === 0) return null
                        return (
                          <div className="space-y-1">
                            {titulosEnRango.map(titulo => (
                              <button
                                key={titulo.id}
                                onClick={() => handleSolicitarBloque(titulo.id, titulo.name)}
                                disabled={loadingBloque}
                                className="w-full text-center text-sm text-primary hover:underline flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                              >
                                <Layers className="w-4 h-4" />
                                Solicitar bloque completo de {titulo.name}
                              </button>
                            ))}
                          </div>
                        )
                      })()}

                      {/* Eventos del día */}
                      {eventosDelDiaSeleccionado.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Theater className="w-4 h-4" />
                            Eventos ({eventosDelDiaSeleccionado.length})
                          </h4>
                          <div className="space-y-2">
                            {eventosDelDiaSeleccionado.map((evento) => (
                              <div
                                key={evento.id}
                                className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                                style={{ borderLeftColor: getEventColor(evento), borderLeftWidth: 4 }}
                                onClick={() => openDetalleEvento(evento)}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`font-black rounded px-1 ${getBadgeColor(evento)}`}>{evento.eventoType === "FUNCION" ? "F" : "E"}</span>
                                  <p className="font-medium text-sm">{evento.tituloName}</p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>{getEventTypeLabel(evento)}</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTime(evento.startTime)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {evento.rotativosUsados}/{evento.cupoEfectivo}
                                  </span>
                                </div>
                                {/* Rotativos del evento */}
                                {evento.rotativos && evento.rotativos.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {evento.rotativos.map((r) => {
                                      const tieneExcepcion = r.estado === "APROBADO" && r.motivo && r.motivo !== "Validado por la fila"
                                      return (
                                        <span
                                          key={r.id}
                                          className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                                            tieneExcepcion
                                              ? "bg-amber-100 text-amber-800"
                                              : r.estado === "APROBADO"
                                                ? "bg-green-100 text-green-800"
                                                : "bg-yellow-100 text-yellow-800"
                                          }`}
                                          title={tieneExcepcion ? r.motivo || "" : ""}
                                        >
                                          {r.user.alias || r.user.name.split(" ")[0]}
                                          {tieneExcepcion && <AlertTriangle className="w-3 h-3" />}
                                        </span>
                                      )
                                    })}
                                  </div>
                                )}
                                {/* Mostrar cupo disponible */}
                                {evento.cupoDisponible > 0 && (
                                  <p className="text-xs text-green-600 mt-1">
                                    {evento.cupoDisponible} {evento.cupoDisponible === 1 ? "lugar disponible" : "lugares disponibles"}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mensaje si no hay nada */}
                      {eventosDelDiaSeleccionado.length === 0 && (
                        <p className="text-muted-foreground text-sm text-center py-4">
                          No hay eventos este día
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Detalle de evento */}
              {sidebarMode === "detalle-evento" && selectedEvento && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: getEventColor(selectedEvento) + "20" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-2xl font-black rounded-lg px-2 py-1 ${getBadgeColor(selectedEvento)}`}>{selectedEvento.eventoType === "FUNCION" ? "F" : "E"}</span>
                      <div>
                        <p className="font-semibold">{selectedEvento.tituloName}</p>
                        <p className="text-sm text-muted-foreground">
                          {getEventTypeLabel(selectedEvento)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span className="capitalize">{format(new Date(selectedEvento.date + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{formatTime(selectedEvento.startTime)}</span>
                    </div>
                  </div>

                  {/* Cupo y rotativos */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Rotativos ({selectedEvento.rotativosUsados}/{selectedEvento.cupoEfectivo})
                      </p>
                      {selectedEvento.cupoDisponible > 0 && (
                        <Badge variant="outline" className="text-green-600">
                          {selectedEvento.cupoDisponible} disponibles
                        </Badge>
                      )}
                    </div>

                    {selectedEvento.rotativos && selectedEvento.rotativos.length > 0 ? (
                      <div className="space-y-2">
                        {selectedEvento.rotativos.map((r) => {
                          const tieneExcepcion = r.estado === "APROBADO" && r.motivo && r.motivo !== "Validado por la fila"
                          return (
                            <div
                              key={r.id}
                              className={`p-2 rounded border ${
                                tieneExcepcion
                                  ? "bg-amber-50 border-amber-200"
                                  : r.estado === "APROBADO"
                                    ? "bg-green-50 border-green-200"
                                    : "bg-yellow-50 border-yellow-200"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {r.user.alias || r.user.name}
                                  </span>
                                  {tieneExcepcion && (
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                  )}
                                </div>
                                <Badge variant={r.estado === "APROBADO" ? "default" : "secondary"} className="text-xs">
                                  {r.estado}
                                </Badge>
                              </div>
                              {tieneExcepcion && r.motivo && (
                                <p className="text-xs text-amber-700 mt-1 pl-6">
                                  {r.motivo}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin rotativos asignados</p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="space-y-2 pt-2 border-t">
                    {!userHasRotativo(selectedEvento) && selectedEvento.cupoDisponible > 0 && (
                      <div className="space-y-2">
                        <Button
                          className="w-full"
                          onClick={() => handleSolicitarRotativo(selectedEvento)}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Validando...
                            </>
                          ) : (
                            "Solicitar Rotativo"
                          )}
                        </Button>
                        {validatingRule && (
                          <p className="text-xs text-muted-foreground text-center animate-pulse">
                            {validatingRule}
                          </p>
                        )}
                      </div>
                    )}
                    {userHasRotativo(selectedEvento) && (
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => handleCancelarRotativo(selectedEvento)}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Cancelando...
                          </>
                        ) : (
                          "Cancelar mi Rotativo"
                        )}
                      </Button>
                    )}
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => openEditEvento(selectedEvento)}>
                          <Pencil className="w-4 h-4 mr-1" />
                          Editar Evento
                        </Button>
                        <Button variant="destructive" className="flex-1" onClick={() => handleDeleteEvento(selectedEvento)}>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar Evento
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de títulos */}
              {sidebarMode === "titulos" && (() => {
                const hoy = new Date(debugDate)
                hoy.setHours(0, 0, 0, 0)

                // Ordenar por startDate (de más viejo a más nuevo)
                const titulosOrdenados = [...titulos].sort((a, b) => {
                  const dateA = a.startDate ? new Date(a.startDate).getTime() : 0
                  const dateB = b.startDate ? new Date(b.startDate).getTime() : 0
                  return dateA - dateB
                })

                // Separar vigentes y pasados
                const titulosVigentes = titulosOrdenados.filter(t => {
                  if (!t.endDate) return true
                  const endDate = new Date(t.endDate)
                  endDate.setHours(0, 0, 0, 0)
                  return endDate >= hoy
                })

                const titulosPasados = titulosOrdenados.filter(t => {
                  if (!t.endDate) return false
                  const endDate = new Date(t.endDate)
                  endDate.setHours(0, 0, 0, 0)
                  return endDate < hoy
                })

                const renderTitulo = (titulo: typeof titulos[0]) => (
                  <div
                    key={titulo.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: titulo.color || "#6b7280" }}
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{titulo.name}</p>
                        {titulo.startDate && titulo.endDate && (
                          <p className="text-xs text-muted-foreground">
                            {titulo.startDate.substring(0, 10).split('-').reverse().join('-')} → {titulo.endDate.substring(0, 10).split('-').reverse().join('-')}
                          </p>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditTitulo(titulo)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteTitulo(titulo)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )

                return (
                  <div className="space-y-2">
                    {isAdmin && (
                      <Button
                        className="w-full mb-3"
                        onClick={() => {
                          setTituloForm({ name: "", type: "OPERA", color: "#3b82f6", cupo: 4, startDate: "", endDate: "" })
                          setSidebarMode("nuevo-titulo")
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Título
                      </Button>
                    )}
                    {titulos.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-4">
                        No hay títulos creados
                      </p>
                    ) : (
                      <>
                        {/* Títulos vigentes */}
                        {titulosVigentes.map(renderTitulo)}

                        {/* Títulos pasados en colapsable */}
                        {titulosPasados.length > 0 && (
                          <Collapsible className="mt-4">
                            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                              <ChevronDown className="w-4 h-4 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                              <span>Títulos pasados ({titulosPasados.length})</span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-2 pt-2">
                              {titulosPasados.map(renderTitulo)}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </>
                    )}
                  </div>
                )
              })()}

              {/* Formulario nuevo título */}
              {sidebarMode === "nuevo-titulo" && isAdmin && (
                <form onSubmit={handleCreateTitulo} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={tituloForm.name}
                      onChange={(e) => setTituloForm({ ...tituloForm, name: e.target.value })}
                      placeholder="Ej: La Traviata"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={tituloForm.type} onValueChange={(v) => {
                      const defaultCupos: Record<string, number> = { OPERA: 4, BALLET: 4, CONCIERTO: 2 }
                      setTituloForm({ ...tituloForm, type: v, cupo: defaultCupos[v] ?? 4 })
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPERA">Ópera</SelectItem>
                        <SelectItem value="BALLET">Ballet</SelectItem>
                        <SelectItem value="CONCIERTO">Concierto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="grid grid-cols-8 gap-2">
                      {["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6",
                        "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"
                      ].map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${tituloForm.color === color ? "border-foreground ring-2 ring-offset-2 ring-foreground" : "border-transparent"}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setTituloForm({ ...tituloForm, color })}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cupo de rotativos</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={tituloForm.cupo === 0 ? "" : String(tituloForm.cupo)}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "")
                        setTituloForm({ ...tituloForm, cupo: val === "" ? 0 : Math.min(20, parseInt(val)) })
                      }}
                      className="w-20"
                    />
                    <p className="text-xs text-muted-foreground">
                      Se ajusta automáticamente según el tipo seleccionado
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Fecha inicio</Label>
                      <Input
                        type="date"
                        value={tituloForm.startDate}
                        onChange={(e) => setTituloForm({ ...tituloForm, startDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fecha fin</Label>
                      <Input
                        type="date"
                        value={tituloForm.endDate}
                        onChange={(e) => setTituloForm({ ...tituloForm, endDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setSidebarMode("titulos")}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1" disabled={submitting}>
                      {submitting ? "Creando..." : "Crear"}
                    </Button>
                  </div>
                </form>
              )}

              {/* Formulario editar título */}
              {sidebarMode === "editar-titulo" && isAdmin && editingTitulo && (
                <form onSubmit={handleUpdateTitulo} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={tituloForm.name}
                      onChange={(e) => setTituloForm({ ...tituloForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={tituloForm.type} onValueChange={(v) => {
                      const defaultCupos: Record<string, number> = { OPERA: 4, BALLET: 4, CONCIERTO: 2 }
                      setTituloForm({ ...tituloForm, type: v, cupo: defaultCupos[v] ?? 4 })
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPERA">Ópera</SelectItem>
                        <SelectItem value="BALLET">Ballet</SelectItem>
                        <SelectItem value="CONCIERTO">Concierto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="grid grid-cols-8 gap-2">
                      {["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6",
                        "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"
                      ].map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${tituloForm.color === color ? "border-foreground ring-2 ring-offset-2 ring-foreground" : "border-transparent"}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setTituloForm({ ...tituloForm, color })}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cupo de rotativos</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={tituloForm.cupo === 0 ? "" : String(tituloForm.cupo)}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "")
                        setTituloForm({ ...tituloForm, cupo: val === "" ? 0 : Math.min(20, parseInt(val)) })
                      }}
                      className="w-20"
                    />
                    <p className="text-xs text-muted-foreground">
                      Se ajusta automáticamente según el tipo seleccionado
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Fecha inicio</Label>
                      <Input
                        type="date"
                        value={tituloForm.startDate}
                        onChange={(e) => setTituloForm({ ...tituloForm, startDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fecha fin</Label>
                      <Input
                        type="date"
                        value={tituloForm.endDate}
                        onChange={(e) => setTituloForm({ ...tituloForm, endDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setSidebarMode("titulos")}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1" disabled={submitting}>
                      {submitting ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </form>
              )}

              {/* Formulario nuevo evento */}
              {sidebarMode === "nuevo-evento" && isAdmin && (
                <form onSubmit={handleCreateEvento} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={eventoForm.date}
                      onChange={async (e) => {
                        const newDate = e.target.value
                        // Si el año de la fecha seleccionada es diferente al cargado, cargar títulos de ese año
                        if (newDate) {
                          const selectedYear = parseInt(newDate.substring(0, 4))
                          if (selectedYear !== lastFetchedYearRef.current) {
                            lastFetchedYearRef.current = null // Forzar re-fetch
                            await fetchTitulos(selectedYear)
                          }
                        }
                        // Verificar si el título actual sigue siendo válido para la nueva fecha
                        const tituloActual = titulos.find((t) => t.id === eventoForm.tituloId)
                        const tituloSigueValido = tituloActual?.startDate && tituloActual?.endDate &&
                          newDate >= tituloActual.startDate.substring(0, 10) &&
                          newDate <= tituloActual.endDate.substring(0, 10)
                        // En domingos no hay ensayos comunes, cambiar a GENERAL si estaba en ENSAYO
                        const ensayoTipoNuevo = esDomingo(newDate) && eventoForm.ensayoTipo === "ENSAYO" ? "GENERAL" : eventoForm.ensayoTipo
                        setEventoForm({
                          ...eventoForm,
                          date: newDate,
                          tituloId: tituloSigueValido ? eventoForm.tituloId : "",
                          ensayoTipo: ensayoTipoNuevo
                        })
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    {(() => {
                      const titulosDisponibles = eventoForm.date
                        ? titulos.filter((t) => {
                            if (!t.startDate || !t.endDate) return false
                            const fecha = eventoForm.date
                            const start = t.startDate.substring(0, 10)
                            const end = t.endDate.substring(0, 10)
                            return fecha >= start && fecha <= end
                          })
                        : []
                      return (
                        <>
                          <Select
                            value={eventoForm.tituloId}
                            onValueChange={(v) => {
                              const titulo = titulos.find(t => t.id === v)
                              const defaultCupo = titulo?.cupo ?? 0
                              setCupoInputValue(String(defaultCupo))
                              setEventoForm({ ...eventoForm, tituloId: v, cupoOverride: null })
                            }}
                            disabled={!eventoForm.date}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={eventoForm.date ? "Selecciona un título" : "Primero selecciona fecha"} />
                            </SelectTrigger>
                            <SelectContent>
                              {titulosDisponibles.map((titulo) => (
                                <SelectItem key={titulo.id} value={titulo.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: titulo.color || "#6b7280" }} />
                                    {titulo.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {eventoForm.date && titulosDisponibles.length === 0 && (
                            <p className="text-sm text-muted-foreground">No hay títulos disponibles para esta fecha</p>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={eventoForm.eventoType === "ENSAYO" ? "default" : "outline"}
                        onClick={() => {
                          const horarios = getHorariosPredefinidos("ENSAYO", eventoForm.date)
                          // En domingos no hay ensayos comunes, default a GENERAL
                          const ensayoTipo = esDomingo(eventoForm.date) ? "GENERAL" : "ENSAYO"
                          if (horarios.length > 0 && !horarioCustom) {
                            setEventoForm({ ...eventoForm, eventoType: "ENSAYO", ensayoTipo, startTime: horarios[0].start, endTime: horarios[0].end })
                          } else {
                            setEventoForm({ ...eventoForm, eventoType: "ENSAYO", ensayoTipo })
                            setHorarioCustom(horarios.length === 0)
                          }
                        }}
                        className="flex-1"
                      >
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-white rounded-full mr-1.5 text-sm font-bold text-black">E</span>
                        Ensayo
                      </Button>
                      <Button
                        type="button"
                        variant={eventoForm.eventoType === "FUNCION" ? "default" : "outline"}
                        onClick={() => {
                          const horarios = getHorariosPredefinidos("FUNCION", eventoForm.date)
                          if (horarios.length > 0 && !horarioCustom) {
                            setEventoForm({ ...eventoForm, eventoType: "FUNCION", startTime: horarios[0].start, endTime: horarios[0].end })
                          } else {
                            setEventoForm({ ...eventoForm, eventoType: "FUNCION" })
                            setHorarioCustom(horarios.length === 0)
                          }
                        }}
                        className="flex-1"
                      >
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-white rounded-full mr-1.5 text-sm font-bold text-black">F</span>
                        Función
                      </Button>
                    </div>
                    {eventoForm.eventoType === "ENSAYO" && (
                      <div className="flex gap-1 mt-2">
                        {/* En domingos no hay ensayos comunes, solo Pre General y General */}
                        {!esDomingo(eventoForm.date) && (
                          <Button
                            type="button"
                            size="sm"
                            variant={eventoForm.ensayoTipo === "ENSAYO" ? "default" : "outline"}
                            onClick={() => setEventoForm({ ...eventoForm, ensayoTipo: "ENSAYO" })}
                            className="flex-1 text-xs"
                          >
                            Ensayo
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant={eventoForm.ensayoTipo === "PRE_GENERAL" ? "default" : "outline"}
                          onClick={() => setEventoForm({ ...eventoForm, ensayoTipo: "PRE_GENERAL" })}
                          className="flex-1 text-xs"
                        >
                          Pre General
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={eventoForm.ensayoTipo === "GENERAL" ? "default" : "outline"}
                          onClick={() => setEventoForm({ ...eventoForm, ensayoTipo: "GENERAL" })}
                          className="flex-1 text-xs"
                        >
                          General
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Horario</Label>
                    {(() => {
                      const horariosPredefinidos = getHorariosPredefinidos(eventoForm.eventoType, eventoForm.date)
                      const tieneHorarios = horariosPredefinidos.length > 0

                      if (!horarioCustom && tieneHorarios) {
                        return (
                          <>
                            <div className="flex gap-2">
                              {horariosPredefinidos.map((h) => (
                                <Button
                                  key={h.start}
                                  type="button"
                                  variant={eventoForm.startTime === h.start ? "default" : "outline"}
                                  className="flex-1"
                                  onClick={() => setEventoForm({ ...eventoForm, startTime: h.start, endTime: h.end })}
                                >
                                  {h.label}
                                </Button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground underline"
                              onClick={() => setHorarioCustom(true)}
                            >
                              Usar horario personalizado
                            </button>
                          </>
                        )
                      }

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Inicio</Label>
                              <Input
                                type="time"
                                value={eventoForm.startTime}
                                onChange={(e) => setEventoForm({ ...eventoForm, startTime: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Fin</Label>
                              <Input
                                type="time"
                                value={eventoForm.endTime}
                                onChange={(e) => setEventoForm({ ...eventoForm, endTime: e.target.value })}
                                required
                              />
                            </div>
                          </div>
                          {tieneHorarios && (
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground underline"
                              onClick={() => {
                                setHorarioCustom(false)
                                setEventoForm({ ...eventoForm, startTime: horariosPredefinidos[0].start, endTime: horariosPredefinidos[0].end })
                              }}
                            >
                              Usar horario predefinido
                            </button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  {eventoForm.tituloId && (
                    <div className="space-y-2">
                      <Label>Cupo de rotativos</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={cupoInputValue}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, "")
                            setCupoInputValue(val)
                            const defaultCupo = titulos.find((t) => t.id === eventoForm.tituloId)?.cupo ?? 0
                            if (val === "" || val === String(defaultCupo)) {
                              setEventoForm({ ...eventoForm, cupoOverride: null })
                            } else {
                              setEventoForm({ ...eventoForm, cupoOverride: val ? Math.min(20, parseInt(val)) : null })
                            }
                          }}
                          className="w-20"
                        />
                        {cupoInputValue !== String(titulos.find((t) => t.id === eventoForm.tituloId)?.cupo ?? 0) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const defaultCupo = titulos.find((t) => t.id === eventoForm.tituloId)?.cupo ?? 0
                              setCupoInputValue(String(defaultCupo))
                              setEventoForm({ ...eventoForm, cupoOverride: null })
                            }}
                          >
                            Restablecer
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Default del título: {titulos.find((t) => t.id === eventoForm.tituloId)?.cupo || 0}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setSidebarMode("eventos")}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1" disabled={submitting || !eventoForm.tituloId}>
                      {submitting ? "Creando..." : "Crear"}
                    </Button>
                  </div>
                </form>
              )}

              {/* Formulario editar evento */}
              {sidebarMode === "editar-evento" && isAdmin && editingEvento && (
                <form onSubmit={handleUpdateEvento} className="space-y-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium">{editingEvento.tituloName}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={eventoForm.date}
                      onChange={(e) => setEventoForm({ ...eventoForm, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={eventoForm.eventoType === "ENSAYO" ? "default" : "outline"}
                        onClick={() => {
                          const horarios = getHorariosPredefinidos("ENSAYO", eventoForm.date)
                          // En domingos no hay ensayos comunes, cambiar a GENERAL si estaba en ENSAYO
                          const ensayoTipo = esDomingo(eventoForm.date) && eventoForm.ensayoTipo === "ENSAYO" ? "GENERAL" : (eventoForm.ensayoTipo || "ENSAYO")
                          if (horarios.length > 0 && !horarioCustom) {
                            setEventoForm({ ...eventoForm, eventoType: "ENSAYO", ensayoTipo, startTime: horarios[0].start, endTime: horarios[0].end })
                          } else {
                            setEventoForm({ ...eventoForm, eventoType: "ENSAYO", ensayoTipo })
                            setHorarioCustom(horarios.length === 0)
                          }
                        }}
                        className="flex-1"
                      >
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-white rounded-full mr-1.5 text-sm font-bold text-black">E</span>
                        Ensayo
                      </Button>
                      <Button
                        type="button"
                        variant={eventoForm.eventoType === "FUNCION" ? "default" : "outline"}
                        onClick={() => {
                          const horarios = getHorariosPredefinidos("FUNCION", eventoForm.date)
                          if (horarios.length > 0 && !horarioCustom) {
                            setEventoForm({ ...eventoForm, eventoType: "FUNCION", startTime: horarios[0].start, endTime: horarios[0].end })
                          } else {
                            setEventoForm({ ...eventoForm, eventoType: "FUNCION" })
                            setHorarioCustom(horarios.length === 0)
                          }
                        }}
                        className="flex-1"
                      >
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-white rounded-full mr-1.5 text-sm font-bold text-black">F</span>
                        Función
                      </Button>
                    </div>
                    {eventoForm.eventoType === "ENSAYO" && (
                      <div className="flex gap-1 mt-2">
                        {/* En domingos no hay ensayos comunes, solo Pre General y General */}
                        {!esDomingo(eventoForm.date) && (
                          <Button
                            type="button"
                            size="sm"
                            variant={eventoForm.ensayoTipo === "ENSAYO" ? "default" : "outline"}
                            onClick={() => setEventoForm({ ...eventoForm, ensayoTipo: "ENSAYO" })}
                            className="flex-1 text-xs"
                          >
                            Ensayo
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant={eventoForm.ensayoTipo === "PRE_GENERAL" ? "default" : "outline"}
                          onClick={() => setEventoForm({ ...eventoForm, ensayoTipo: "PRE_GENERAL" })}
                          className="flex-1 text-xs"
                        >
                          Pre General
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={eventoForm.ensayoTipo === "GENERAL" ? "default" : "outline"}
                          onClick={() => setEventoForm({ ...eventoForm, ensayoTipo: "GENERAL" })}
                          className="flex-1 text-xs"
                        >
                          General
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Horario</Label>
                    {(() => {
                      const horariosPredefinidos = getHorariosPredefinidos(eventoForm.eventoType, eventoForm.date)
                      const tieneHorarios = horariosPredefinidos.length > 0

                      if (!horarioCustom && tieneHorarios) {
                        return (
                          <>
                            <div className="flex gap-2">
                              {horariosPredefinidos.map((h) => (
                                <Button
                                  key={h.start}
                                  type="button"
                                  variant={eventoForm.startTime === h.start ? "default" : "outline"}
                                  className="flex-1"
                                  onClick={() => setEventoForm({ ...eventoForm, startTime: h.start, endTime: h.end })}
                                >
                                  {h.label}
                                </Button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground underline"
                              onClick={() => setHorarioCustom(true)}
                            >
                              Usar horario personalizado
                            </button>
                          </>
                        )
                      }

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Inicio</Label>
                              <Input
                                type="time"
                                value={eventoForm.startTime}
                                onChange={(e) => setEventoForm({ ...eventoForm, startTime: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Fin</Label>
                              <Input
                                type="time"
                                value={eventoForm.endTime}
                                onChange={(e) => setEventoForm({ ...eventoForm, endTime: e.target.value })}
                                required
                              />
                            </div>
                          </div>
                          {tieneHorarios && (
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground underline"
                              onClick={() => {
                                setHorarioCustom(false)
                                setEventoForm({ ...eventoForm, startTime: horariosPredefinidos[0].start, endTime: horariosPredefinidos[0].end })
                              }}
                            >
                              Usar horario predefinido
                            </button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  <div className="space-y-2">
                    <Label>Cupo de rotativos</Label>
                    {(() => {
                      const tituloDelEvento = titulos.find((t) => t.id === editingEvento.tituloId)
                      const cupoDefault = tituloDelEvento?.cupo ?? editingEvento.cupoEfectivo
                      return (
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={String(eventoForm.cupoOverride ?? cupoDefault)}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "")
                              setEventoForm({ ...eventoForm, cupoOverride: val ? Math.min(20, parseInt(val)) : null })
                            }}
                            className="w-20"
                          />
                          {eventoForm.cupoOverride !== null && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEventoForm({ ...eventoForm, cupoOverride: null })}
                            >
                              Restablecer
                            </Button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setSidebarMode("eventos")}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1" disabled={submitting}>
                      {submitting ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
          )}
        </div>
      </div>

      {/* Dialog de confirmación para solicitar aprobación */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <DialogTitle className="text-xl">Confirmación requerida</DialogTitle>
            <DialogDescription className="text-base mt-2">
              Tu solicitud precisaría aprobación, ¿confirmás que deseás continuar con la misma?
            </DialogDescription>
          </DialogHeader>

          {confirmMotivo && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-2">
              <p className="text-sm font-medium text-amber-800 mb-1">Motivo:</p>
              <p className="text-sm text-amber-700">{confirmMotivo}</p>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleCancelarSolicitud}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarSolicitud}
              className="w-full sm:w-auto"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Solicitando...
                </>
              ) : (
                "Solicitar aprobación"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para solicitar bloque completo */}
      <Dialog open={bloqueDialogOpen} onOpenChange={setBloqueDialogOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Layers className="h-8 w-8 text-blue-600" />
            </div>
            <DialogTitle className="text-xl">Solicitar bloque completo</DialogTitle>
            {loadingBloque ? (
              <DialogDescription className="text-base mt-2">
                Validando disponibilidad...
              </DialogDescription>
            ) : bloqueInfo ? (
              <DialogDescription className="text-base mt-2">
                Vas a solicitar rotativos para todas las funciones de{" "}
                <strong>{bloqueInfo.tituloName}</strong>
              </DialogDescription>
            ) : null}
          </DialogHeader>

          {loadingBloque ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : bloqueInfo ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-2">
                <p className="text-sm font-medium text-blue-800">
                  Total de eventos: {bloqueInfo.totalEventos}
                </p>
              </div>

              {bloqueInfo.requiereAprobacion && bloqueInfo.motivos.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    Esta solicitud requerirá aprobación:
                  </p>
                  <ul className="text-sm text-amber-700 list-disc list-inside">
                    {bloqueInfo.motivos.map((motivo, i) => (
                      <li key={i}>{motivo}</li>
                    ))}
                  </ul>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={handleCancelarBloque}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarBloque}
                  className="w-full sm:w-auto"
                  disabled={loadingBloque}
                >
                  {loadingBloque ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Solicitando...
                    </>
                  ) : bloqueInfo.requiereAprobacion ? (
                    "Solicitar aprobación"
                  ) : (
                    "Confirmar solicitud"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para eliminar evento */}
      <Dialog open={deleteEventoDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setDeleteEventoDialogOpen(false)
          setDeleteEventoTarget(null)
          setDeleteConfirmText("")
        }
      }}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-8 w-8 text-red-600" />
            </div>
            <DialogTitle className="text-xl">Eliminar Evento</DialogTitle>
            <DialogDescription className="text-base mt-2">
              {deleteEventoTarget && (
                <>
                  ¿Estás seguro de eliminar el evento <strong>{deleteEventoTarget.tituloName}</strong> del{" "}
                  <strong>{formatInArgentina(deleteEventoTarget.date, "d 'de' MMMM")}</strong>?
                  {deleteEventoTarget.rotativos && deleteEventoTarget.rotativos.length > 0 && (
                    <span className="block mt-2 text-red-600 font-medium">
                      Se eliminarán también {deleteEventoTarget.rotativos.length} rotativo{deleteEventoTarget.rotativos.length > 1 ? 's' : ''} asociado{deleteEventoTarget.rotativos.length > 1 ? 's' : ''}.
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-4">
            <p className="text-sm text-muted-foreground text-center">
              Para confirmar, escribe <strong className="text-foreground">Eliminar</strong> en el campo:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Escribe 'Eliminar' para confirmar"
              className="text-center"
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteEventoDialogOpen(false)
                setDeleteEventoTarget(null)
                setDeleteConfirmText("")
              }}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteEvento}
              disabled={deleteConfirmText !== "Eliminar"}
              className="w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
