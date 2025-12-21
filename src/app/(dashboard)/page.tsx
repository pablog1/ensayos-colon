"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { formatInArgentina } from "@/lib/date-utils"
import {
  Plus,
  Pencil,
  Trash2,
  Music,
  Theater,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Clock,
  Users,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react"

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
  rotativosUsados: number
  cupoDisponible: number
  rotativos: {
    id: string
    estado: string
    user: {
      id: string
      name: string
      alias: string | null
      avatar: string | null
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
    avatar: string | null
  }
}

interface Titulo {
  id: string
  name: string
  type: string
  color: string | null
  cupoEnsayo: number
  cupoFuncion: number
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
  | "solicitar-rotativo"

export default function DashboardPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const userId = session?.user?.id

  const [eventos, setEventos] = useState<Evento[]>([])
  const [eventosPorFecha, setEventosPorFecha] = useState<EventosPorFecha>({})
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [titulos, setTitulos] = useState<Titulo[]>([])
  const [loading, setLoading] = useState(true)
  const [mesActual, setMesActual] = useState(new Date())
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
    cupoEnsayo: 2,
    cupoFuncion: 4,
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
  })
  const [horarioCustom, setHorarioCustom] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  // Horarios predefinidos según tipo de evento
  const getHorariosPredefinidos = (tipo: "ENSAYO" | "FUNCION", fecha?: string) => {
    // Determinar día de la semana (0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab)
    let dayOfWeek = -1
    if (fecha) {
      const date = new Date(fecha + "T12:00:00") // Usar mediodía para evitar problemas de timezone
      dayOfWeek = date.getDay()
    }

    const esMartesSabado = dayOfWeek >= 2 && dayOfWeek <= 6
    const esDomingo = dayOfWeek === 0

    if (tipo === "FUNCION") {
      if (esDomingo) {
        return [{ start: "17:00", end: "20:00", label: "17:00" }]
      }
      if (esMartesSabado) {
        return [{ start: "20:00", end: "23:00", label: "20:00" }]
      }
      // Lunes u otro día: sin horarios predefinidos
      return []
    }

    // ENSAYO
    if (esDomingo) {
      // Domingos: solo Ensayo General a las 17:00
      return [{ start: "17:00", end: "20:00", label: "17:00" }]
    }
    if (esMartesSabado) {
      return [
        { start: "14:00", end: "17:00", label: "14:00" },
        { start: "20:00", end: "23:00", label: "20:00" },
      ]
    }
    // Lunes u otro día: sin horarios predefinidos
    return []
  }

  // Determina si es domingo basado en la fecha
  const esDomingo = (fecha: string) => {
    if (!fecha) return false
    const date = new Date(fecha + "T12:00:00")
    return date.getDay() === 0
  }

  const fetchTitulos = useCallback(async (mes: Date) => {
    const year = mes.getFullYear()
    const res = await fetch(`/api/titulos?year=${year}`)
    if (res.ok) {
      const data = await res.json()
      setTitulos(data)
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
    const mesStr = format(mes, "yyyy-MM")
    const res = await fetch(`/api/calendario?mes=${mesStr}`)
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
  }, [])

  useEffect(() => {
    fetchEventos(mesActual)
    fetchSolicitudes(mesActual)
    fetchTitulos(mesActual)
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
    const date = new Date(isoString)
    return format(date, "HH:mm")
  }

  // Verificar si el usuario ya tiene rotativo en este evento
  const userHasRotativo = (evento: Evento) => {
    return evento.rotativos?.some(r => r.user.id === userId)
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
      fetchTitulos(mesActual)
      fetchEventos(mesActual)
      setSidebarMode("titulos")
      setTituloForm({ name: "", type: "OPERA", color: "#3b82f6", cupoEnsayo: 2, cupoFuncion: 4, startDate: "", endDate: "" })
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
      fetchTitulos(mesActual)
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
    if (!confirm(`¿Eliminar "${titulo.name}"? Se eliminarán todos sus eventos.`)) return

    const res = await fetch(`/api/titulos/${titulo.id}`, { method: "DELETE" })

    if (res.ok) {
      toast.success("Título eliminado")
      fetchTitulos(mesActual)
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

    const res = await fetch(`/api/titulos/${eventoForm.tituloId}/eventos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: eventoForm.date,
        eventoType: eventoForm.eventoType,
        ensayoTipo: eventoForm.eventoType === "ENSAYO" ? eventoForm.ensayoTipo : undefined,
        startTime: `${eventoForm.date}T${eventoForm.startTime}:00`,
        endTime: `${eventoForm.date}T${eventoForm.endTime}:00`,
      }),
    })

    if (res.ok) {
      toast.success("Evento creado")
      fetchEventos(mesActual)
      setSidebarMode("eventos")
    } else {
      const error = await res.json()
      toast.error(error.error || "Error al crear evento")
    }
    setSubmitting(false)
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
        startTime: `${eventoForm.date}T${eventoForm.startTime}:00`,
        endTime: `${eventoForm.date}T${eventoForm.endTime}:00`,
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
    if (!confirm(`¿Eliminar este evento de "${evento.tituloName}"?`)) return

    const res = await fetch(`/api/calendario/${evento.id}`, { method: "DELETE" })

    if (res.ok) {
      toast.success("Evento eliminado")
      fetchEventos(mesActual)
      setSelectedEvento(null)
      setSidebarMode("eventos")
    } else {
      const error = await res.json()
      toast.error(error.error || "Error al eliminar")
    }
  }

  // Handler para solicitar rotativo
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
    const res = await fetch("/api/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: evento.id,
      }),
    })

    if (res.ok) {
      toast.success("Rotativo solicitado")
      await fetchEventos(mesActual)
      setSidebarMode("rotativos")
      setSelectedEvento(null)
    } else {
      const error = await res.json()
      toast.error(error.error || "Error al solicitar")
    }
    setSubmitting(false)
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
    setTituloForm({
      name: titulo.name,
      type: titulo.type,
      color: titulo.color || "#3b82f6",
      cupoEnsayo: titulo.cupoEnsayo,
      cupoFuncion: titulo.cupoFuncion,
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
    // En domingos, forzar ensayoTipo a GENERAL
    const ensayoTipoDefault = esDomingo(fechaStr) ? "GENERAL" : "ENSAYO"

    setEventoForm({
      tituloId: "",
      eventoType: "ENSAYO",
      ensayoTipo: ensayoTipoDefault,
      date: fechaStr,
      startTime: tieneHorariosPredefinidos ? horarios[0].start : "14:00",
      endTime: tieneHorariosPredefinidos ? horarios[0].end : "17:00",
    })
    setHorarioCustom(!tieneHorariosPredefinidos)
    setSidebarMode("nuevo-evento")
  }

  const openDetalleEvento = (evento: Evento) => {
    setSelectedEvento(evento)
    setSidebarMode("detalle-evento")
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    setSelectedEvento(null)
    setSidebarMode("eventos")
  }

  // Obtener las fechas de la semana actual (lunes a domingo)
  const getSemanaActual = () => {
    const fechaBase = selectedDate || new Date()
    const dayOfWeek = fechaBase.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Ajustar para que lunes sea el primer día
    const lunes = new Date(fechaBase)
    lunes.setDate(fechaBase.getDate() + diff)

    const dias: Date[] = []
    for (let i = 0; i < 7; i++) {
      const dia = new Date(lunes)
      dia.setDate(lunes.getDate() + i)
      dias.push(dia)
    }
    return dias
  }

  const navegarSemana = (direccion: number) => {
    const nuevaFecha = new Date(selectedDate || new Date())
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
              <div key={`evento-${i}`} className="flex flex-col">
                {/* Evento */}
                <div
                  className="text-[11px] leading-snug px-1.5 py-1 rounded-t text-white font-medium"
                  style={{ backgroundColor: getEventColor(e) }}
                >
                  <div className="flex items-center gap-1">
                    <span>{e.eventoType === "FUNCION" ? "🎭" : "🎵"}</span>
                    <span>{formatTime(e.startTime)} · {getEventTypeLabel(e)}</span>
                  </div>
                  <div className="line-clamp-2">{e.tituloName}</div>
                </div>
                {/* Rotativos del evento */}
                {e.rotativos && e.rotativos.length > 0 && (
                  <div className="bg-gray-100 rounded-b px-1.5 py-1 flex flex-wrap gap-1">
                    {e.rotativos.slice(0, 4).map((r, j) => (
                      <span
                        key={j}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          r.estado === "APROBADO" ? "bg-green-200 text-green-800" : "bg-yellow-200 text-yellow-800"
                        }`}
                      >
                        {r.user.avatar || ""}{r.user.alias || r.user.name.split(" ")[0]}
                      </span>
                    ))}
                    {e.rotativos.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{e.rotativos.length - 4}</span>
                    )}
                  </div>
                )}
                {/* Cupo disponible */}
                {e.cupoDisponible > 0 && (!e.rotativos || e.rotativos.length === 0) && (
                  <div className="bg-gray-50 rounded-b px-1.5 py-0.5">
                    <span className="text-[10px] text-muted-foreground">{e.cupoDisponible} disp.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Renderizado para vista de semana (expandido, más limpio)
  const renderDayContentSemana = (date: Date) => {
    const eventosDelDia = getEventosDelDia(date)
    const tituloColors = getTituloColorsForDate(date)

    return (
      <div className="relative w-full h-full flex flex-col overflow-hidden">
        {/* Fondo con colores de títulos (transparente) */}
        {tituloColors.length > 0 && (
          <div className="absolute inset-0 flex pointer-events-none">
            {tituloColors.map(t => (
              <div
                key={t.id}
                className="flex-1"
                style={{ backgroundColor: t.color || "#6b7280", opacity: 0.10 }}
              />
            ))}
          </div>
        )}
        {/* Header del día */}
        <div className="relative flex items-baseline gap-1 px-2 py-1.5 border-b bg-muted/30">
          <span className="font-semibold text-base">{date.getDate()}</span>
          <span className="text-sm text-muted-foreground">
            {format(date, "EEE", { locale: es }).toLowerCase()}
          </span>
        </div>

        {/* Contenido */}
        <div className="flex flex-col gap-3 p-3 overflow-y-auto flex-1">
          {/* Eventos */}
          {eventosDelDia.map((e, i) => (
            <div
              key={`evento-${i}`}
              className="rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow border"
              onClick={(ev) => { ev.stopPropagation(); openDetalleEvento(e) }}
            >
              {/* Header del evento */}
              <div
                className="px-3 py-2 text-white"
                style={{ backgroundColor: getEventColor(e) }}
              >
                <p className="font-semibold text-sm leading-tight">{e.tituloName}</p>
                <p className="text-xs opacity-90 mt-0.5">
                  {getEventTypeLabel(e)} · {formatTime(e.startTime)} · {e.rotativosUsados}/{e.cupoEfectivo}
                </p>
              </div>

              {/* Rotativos asignados */}
              {e.rotativos && e.rotativos.length > 0 && (
                <div className="px-3 py-2 bg-white border-t">
                  <div className="flex flex-wrap gap-1">
                    {e.rotativos.map((r, j) => (
                      <span
                        key={j}
                        className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800"
                      >
                        {r.user.avatar || ""} {r.user.alias || r.user.name.split(" ")[0]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Indicador de cupo */}
              {e.cupoDisponible > 0 && (
                <div className="px-3 py-1.5 bg-green-50 text-green-700 text-xs border-t">
                  {e.cupoDisponible} {e.cupoDisponible === 1 ? "lugar" : "lugares"} disponible{e.cupoDisponible > 1 ? "s" : ""}
                </div>
              )}
            </div>
          ))}

          {/* Sin contenido */}
          {eventosDelDia.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Sin eventos</p>
            </div>
          )}
        </div>
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

  // Eventos con cupo disponible para solicitar
  const eventosConCupo = eventos.filter(e => e.cupoDisponible > 0 && !userHasRotativo(e))

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
                            const fin = semana[6]
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
                          const hoy = new Date()
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
                            const isToday = date.toDateString() === new Date().toDateString()
                            const tituloColors = getTituloColorsForDate(date)

                            return (
                              <div
                                key={date.toISOString()}
                                className={`border rounded-lg overflow-hidden ${
                                  isToday ? "ring-2 ring-amber-400" : ""
                                }`}
                              >
                                {/* Header con fecha y bandas de color de títulos */}
                                <div className="relative bg-muted/50 px-4 py-2 border-b">
                                  {tituloColors.length > 0 && (
                                    <div className="absolute inset-0 flex">
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
                                <div className="divide-y">
                                  {eventos.map(evento => (
                                    <div
                                      key={evento.id}
                                      className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                      onClick={() => openDetalleEvento(evento)}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div
                                          className="w-1 self-stretch rounded"
                                          style={{ backgroundColor: getEventColor(evento) }}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span>{evento.eventoType === "FUNCION" ? "🎭" : "🎵"}</span>
                                            <p className="font-medium truncate">{evento.tituloName}</p>
                                            <Badge variant={evento.cupoDisponible > 0 ? "outline" : "secondary"} className="ml-auto">
                                              {evento.rotativosUsados}/{evento.cupoEfectivo} rot.
                                            </Badge>
                                          </div>
                                          <p className="text-sm text-muted-foreground">
                                            {getEventTypeLabel(evento)} · {formatTime(evento.startTime)} - {formatTime(evento.endTime)}
                                          </p>
                                          {/* Nombres completos de rotativos en vista lista */}
                                          {evento.rotativos && evento.rotativos.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                              {evento.rotativos.map((r) => (
                                                <span
                                                  key={r.id}
                                                  className={`text-xs px-2 py-1 rounded-full ${
                                                    r.estado === "APROBADO"
                                                      ? "bg-green-100 text-green-800"
                                                      : "bg-yellow-100 text-yellow-800"
                                                  }`}
                                                >
                                                  {r.user.avatar && <span className="mr-1">{r.user.avatar}</span>}
                                                  {r.user.alias || r.user.name.split(" ")[0]}
                                                </span>
                                              ))}
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
                      <div className="grid grid-cols-7 border border-border">
                        {["lu", "ma", "mi", "ju", "vi", "sá", "do"].map((dia) => (
                          <div key={dia} className="text-muted-foreground font-medium text-sm py-2 text-center bg-muted/50 border-r border-border last:border-r-0">
                            {dia}
                          </div>
                        ))}
                      </div>
                      {/* Celdas del calendario */}
                      <div className="grid grid-cols-7 border-l border-r border-b border-border">
                        {(() => {
                          const firstDay = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1)
                          const lastDay = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0)
                          const startDayOfWeek = (firstDay.getDay() + 6) % 7
                          const daysInMonth = lastDay.getDate()
                          const prevMonth = new Date(mesActual.getFullYear(), mesActual.getMonth(), 0)
                          const daysInPrevMonth = prevMonth.getDate()

                          const cells: { date: Date; isOutside: boolean }[] = []

                          for (let i = startDayOfWeek - 1; i >= 0; i--) {
                            const day = daysInPrevMonth - i
                            cells.push({ date: new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, day), isOutside: true })
                          }

                          for (let day = 1; day <= daysInMonth; day++) {
                            cells.push({ date: new Date(mesActual.getFullYear(), mesActual.getMonth(), day), isOutside: false })
                          }

                          const remaining = 42 - cells.length
                          for (let day = 1; day <= remaining; day++) {
                            cells.push({ date: new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, day), isOutside: true })
                          }

                          return cells.map((cell, idx) => {
                            const isToday = cell.date.toDateString() === new Date().toDateString()
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
                      {/* Vista de Semana - Igual que mes pero sin límite de altura */}
                      {/* Días de la semana */}
                      <div className="grid grid-cols-7 border border-border">
                        {["lu", "ma", "mi", "ju", "vi", "sá", "do"].map((dia) => (
                          <div key={dia} className="text-muted-foreground font-medium text-sm py-2 text-center bg-muted/50 border-r border-border last:border-r-0">
                            {dia}
                          </div>
                        ))}
                      </div>
                      {/* Celdas de la semana */}
                      <div className="grid grid-cols-7 border-l border-r border-b border-border">
                        {getSemanaActual().map((dia, idx) => {
                          const isToday = dia.toDateString() === new Date().toDateString()
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
                  {isAdmin && (
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
                  )}
                </nav>
              )}
              {/* Título ABAJO */}
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {sidebarMode === "rotativos" && "Rotativos del Mes"}
                  {sidebarMode === "titulos" && "Títulos"}
                  {sidebarMode === "eventos" && (selectedDate ? format(selectedDate, "d 'de' MMMM", { locale: es }) : "Eventos del día")}
                  {sidebarMode === "solicitar-rotativo" && "Solicitar Rotativo"}
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
                  {/* Botón solicitar */}
                  <Button
                    className="w-full"
                    onClick={() => setSidebarMode("solicitar-rotativo")}
                    disabled={eventosConCupo.length === 0}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Solicitar Rotativo
                  </Button>

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

                  {/* Lista de rotativos */}
                  {rotativosFiltrados.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      {verSoloMios ? "No tienes rotativos este mes" : "No hay rotativos este mes"}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {rotativosFiltrados.map((r) => (
                        <div
                          key={r.id}
                          className={`p-3 rounded-lg border ${r.evento ? "cursor-pointer hover:bg-muted/50" : ""} transition-colors`}
                          style={{
                            borderLeftColor: r.evento ? getEventColor(r.evento) : (r.estado === "APROBADA" ? "#22c55e" : "#eab308"),
                            borderLeftWidth: 4
                          }}
                          onClick={() => r.evento && openDetalleEvento(r.evento)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {r.user.avatar && <span>{r.user.avatar}</span>}
                                <span className="font-medium text-sm truncate">
                                  {r.user.alias || r.user.name}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatInArgentina(r.fecha, "EEEE d MMM")}
                                {r.evento && (
                                  <> · {formatTime(r.evento.startTime)} · {r.evento.tituloName}</>
                                )}
                              </p>
                            </div>
                            <Badge
                              variant={r.estado === "APROBADO" || r.estado === "APROBADA" ? "default" : "secondary"}
                              className="text-xs flex-shrink-0"
                            >
                              {r.estado === "APROBADA" ? "APROBADO" : r.estado}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Solicitar rotativo - lista de eventos disponibles */}
              {sidebarMode === "solicitar-rotativo" && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    Selecciona un evento para solicitar rotativo:
                  </p>
                  {eventosConCupo.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      No hay eventos con cupo disponible
                    </p>
                  ) : (
                    eventosConCupo.map((evento) => (
                      <div
                        key={evento.id}
                        className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        style={{ borderLeftColor: getEventColor(evento), borderLeftWidth: 4 }}
                        onClick={() => handleSolicitarRotativo(evento)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span>{evento.eventoType === "FUNCION" ? "🎭" : "🎵"}</span>
                              <p className="font-medium text-sm">{evento.tituloName}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {getEventTypeLabel(evento)} · {formatInArgentina(evento.date, "EEEE d MMM")} · {formatTime(evento.startTime)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-green-600 text-xs">
                            {evento.cupoDisponible} disp.
                          </Badge>
                        </div>
                      </div>
                    ))
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
                      <div className="flex gap-2">
                        {isAdmin && (
                          <Button className="flex-1" size="sm" onClick={() => openNuevoEvento(selectedDate)}>
                            <Plus className="w-4 h-4 mr-1" />
                            Evento
                          </Button>
                        )}
                        {eventosDelDiaSeleccionado.some(e => e.cupoDisponible > 0 && !userHasRotativo(e)) && (
                          <Button variant="outline" className="flex-1" size="sm" onClick={() => setSidebarMode("solicitar-rotativo")}>
                            <Plus className="w-4 h-4 mr-1" />
                            Rotativo
                          </Button>
                        )}
                      </div>

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
                                  <span>{evento.eventoType === "FUNCION" ? "🎭" : "🎵"}</span>
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
                                    {evento.rotativos.map((r) => (
                                      <span
                                        key={r.id}
                                        className={`text-xs px-2 py-0.5 rounded ${
                                          r.estado === "APROBADO" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                        }`}
                                      >
                                        {r.user.avatar || ""} {r.user.alias || r.user.name.split(" ")[0]}
                                      </span>
                                    ))}
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
                      <span className="text-2xl">{selectedEvento.eventoType === "FUNCION" ? "🎭" : "🎵"}</span>
                      <div>
                        <p className="font-semibold">{selectedEvento.tituloName}</p>
                        <p className="text-sm text-muted-foreground">
                          {getEventTypeLabel(selectedEvento)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{formatTime(selectedEvento.startTime)} - {formatTime(selectedEvento.endTime)}</span>
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
                      <div className="space-y-1">
                        {selectedEvento.rotativos.map((r) => (
                          <div
                            key={r.id}
                            className={`flex items-center justify-between p-2 rounded ${
                              r.estado === "APROBADO" ? "bg-green-50" : "bg-yellow-50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {r.user.avatar && <span>{r.user.avatar}</span>}
                              <span className="text-sm font-medium">
                                {r.user.alias || r.user.name}
                              </span>
                            </div>
                            <Badge variant={r.estado === "APROBADO" ? "default" : "secondary"} className="text-xs">
                              {r.estado}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin rotativos asignados</p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="space-y-2 pt-2 border-t">
                    {!userHasRotativo(selectedEvento) && selectedEvento.cupoDisponible > 0 && (
                      <Button
                        className="w-full"
                        onClick={() => handleSolicitarRotativo(selectedEvento)}
                        disabled={submitting}
                      >
                        {submitting ? "Solicitando..." : "Solicitar Rotativo"}
                      </Button>
                    )}
                    {userHasRotativo(selectedEvento) && (
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => handleCancelarRotativo(selectedEvento)}
                        disabled={submitting}
                      >
                        {submitting ? "Cancelando..." : "Cancelar mi Rotativo"}
                      </Button>
                    )}
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => openEditEvento(selectedEvento)}>
                          <Pencil className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button variant="destructive" className="flex-1" onClick={() => handleDeleteEvento(selectedEvento)}>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de títulos */}
              {sidebarMode === "titulos" && isAdmin && (
                <div className="space-y-2">
                  <Button
                    className="w-full mb-3"
                    onClick={() => {
                      setTituloForm({ name: "", type: "OPERA", color: "#3b82f6", cupoEnsayo: 2, cupoFuncion: 4, startDate: "", endDate: "" })
                      setSidebarMode("nuevo-titulo")
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Título
                  </Button>
                  {titulos.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      No hay títulos creados
                    </p>
                  ) : (
                    titulos.map((titulo) => (
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
                                {titulo.startDate.substring(0, 10)} → {titulo.endDate.substring(0, 10)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditTitulo(titulo)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteTitulo(titulo)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

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
                    <Select value={tituloForm.type} onValueChange={(v) => setTituloForm({ ...tituloForm, type: v })}>
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
                    <Select value={tituloForm.type} onValueChange={(v) => setTituloForm({ ...tituloForm, type: v })}>
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
                      onChange={(e) => {
                        const newDate = e.target.value
                        // Verificar si el título actual sigue siendo válido para la nueva fecha
                        const tituloActual = titulos.find((t) => t.id === eventoForm.tituloId)
                        const tituloSigueValido = tituloActual?.startDate && tituloActual?.endDate &&
                          newDate >= tituloActual.startDate.substring(0, 10) &&
                          newDate <= tituloActual.endDate.substring(0, 10)
                        // En domingos, forzar ensayoTipo a GENERAL
                        const ensayoTipoNuevo = esDomingo(newDate) ? "GENERAL" : eventoForm.ensayoTipo
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
                            onValueChange={(v) => setEventoForm({ ...eventoForm, tituloId: v })}
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
                          // En domingos, forzar ensayoTipo a GENERAL
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
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-white rounded-full mr-1.5 text-sm">🎵</span>
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
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-white rounded-full mr-1.5 text-sm">🎭</span>
                        Función
                      </Button>
                    </div>
                    {eventoForm.eventoType === "ENSAYO" && (
                      <div className="flex gap-1 mt-2">
                        {/* En domingos solo Ensayo General */}
                        {esDomingo(eventoForm.date) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="flex-1 text-xs"
                            disabled
                          >
                            Ensayo General (único en domingos)
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant={eventoForm.ensayoTipo === "ENSAYO" ? "default" : "outline"}
                              onClick={() => setEventoForm({ ...eventoForm, ensayoTipo: "ENSAYO" })}
                              className="flex-1 text-xs"
                            >
                              Ensayo
                            </Button>
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
                          </>
                        )}
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
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      Cupo: {titulos.find((t) => t.id === eventoForm.tituloId)?.[eventoForm.eventoType === "ENSAYO" ? "cupoEnsayo" : "cupoFuncion"] || 0} rotativos
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
                          // En domingos, forzar ensayoTipo a GENERAL
                          const ensayoTipo = esDomingo(eventoForm.date) ? "GENERAL" : (eventoForm.ensayoTipo || "ENSAYO")
                          if (horarios.length > 0 && !horarioCustom) {
                            setEventoForm({ ...eventoForm, eventoType: "ENSAYO", ensayoTipo, startTime: horarios[0].start, endTime: horarios[0].end })
                          } else {
                            setEventoForm({ ...eventoForm, eventoType: "ENSAYO", ensayoTipo })
                            setHorarioCustom(horarios.length === 0)
                          }
                        }}
                        className="flex-1"
                      >
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-white rounded-full mr-1.5 text-sm">🎵</span>
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
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-white rounded-full mr-1.5 text-sm">🎭</span>
                        Función
                      </Button>
                    </div>
                    {eventoForm.eventoType === "ENSAYO" && (
                      <div className="flex gap-1 mt-2">
                        {/* En domingos solo Ensayo General */}
                        {esDomingo(eventoForm.date) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="flex-1 text-xs"
                            disabled
                          >
                            Ensayo General (único en domingos)
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant={eventoForm.ensayoTipo === "ENSAYO" ? "default" : "outline"}
                              onClick={() => setEventoForm({ ...eventoForm, ensayoTipo: "ENSAYO" })}
                              className="flex-1 text-xs"
                            >
                              Ensayo
                            </Button>
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
                          </>
                        )}
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
    </div>
  )
}
