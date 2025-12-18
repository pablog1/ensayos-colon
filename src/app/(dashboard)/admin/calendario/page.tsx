"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Music,
} from "lucide-react"

interface Evento {
  id: string
  title: string
  date: string
  eventoType: "ENSAYO" | "FUNCION"
  tituloId: string
  tituloName: string
  tituloType: string
  tituloColor: string | null
  cupoEfectivo: number
  rotativosUsados: number
  cupoDisponible: number
}

interface Titulo {
  id: string
  name: string
  type: string
  cupoEnsayo: number
  cupoFuncion: number
}

type EventosPorFecha = Record<string, Evento[]>

export default function CalendarioPage() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [eventosPorFecha, setEventosPorFecha] = useState<EventosPorFecha>({})
  const [titulos, setTitulos] = useState<Titulo[]>([])
  const [loading, setLoading] = useState(true)
  const [mesActual, setMesActual] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null)
  const [popoverFecha, setPopoverFecha] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    tituloId: "",
    eventoType: "ENSAYO" as "ENSAYO" | "FUNCION",
    date: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [filtroTitulo, setFiltroTitulo] = useState<string>("all")

  const fetchTitulos = useCallback(async () => {
    const res = await fetch("/api/titulos")
    if (res.ok) {
      const data = await res.json()
      setTitulos(data)
    }
  }, [])

  const fetchEventos = useCallback(async (mes: Date) => {
    const mesStr = format(mes, "yyyy-MM")
    let url = `/api/calendario?mes=${mesStr}`
    if (filtroTitulo && filtroTitulo !== "all") {
      url += `&tituloId=${filtroTitulo}`
    }
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setEventos(data)

      // Agrupar por fecha
      const porFecha: EventosPorFecha = {}
      for (const evento of data) {
        const fechaKey = format(new Date(evento.date), "yyyy-MM-dd")
        if (!porFecha[fechaKey]) {
          porFecha[fechaKey] = []
        }
        porFecha[fechaKey].push(evento)
      }
      setEventosPorFecha(porFecha)
    }
    setLoading(false)
  }, [filtroTitulo])

  useEffect(() => {
    fetchTitulos()
  }, [fetchTitulos])

  useEffect(() => {
    fetchEventos(mesActual)
  }, [mesActual, fetchEventos, filtroTitulo])

  const openCreateDialog = (date: Date) => {
    setEditingEvento(null)
    setSelectedDate(date)
    setFormData({
      tituloId: titulos[0]?.id || "",
      eventoType: "ENSAYO",
      date: format(date, "yyyy-MM-dd"),
    })
    setDialogOpen(true)
  }

  const openEditDialog = (evento: Evento) => {
    setEditingEvento(evento)
    setSelectedDate(new Date(evento.date))
    setFormData({
      tituloId: evento.tituloId,
      eventoType: evento.eventoType,
      date: format(new Date(evento.date), "yyyy-MM-dd"),
    })
    setDialogOpen(true)
    setPopoverFecha(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.tituloId) {
      toast.error("Selecciona un titulo")
      return
    }
    setSubmitting(true)

    if (editingEvento) {
      // Actualizar evento
      const res = await fetch(`/api/calendario/${editingEvento.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventoType: formData.eventoType,
          date: formData.date,
        }),
      })

      if (res.ok) {
        toast.success("Evento actualizado")
        setDialogOpen(false)
        fetchEventos(mesActual)
      } else {
        const error = await res.json()
        toast.error(error.error)
      }
    } else {
      // Crear evento
      const res = await fetch(`/api/titulos/${formData.tituloId}/eventos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formData.date,
          eventoType: formData.eventoType,
        }),
      })

      if (res.ok) {
        toast.success("Evento creado")
        setDialogOpen(false)
        fetchEventos(mesActual)
      } else {
        const error = await res.json()
        toast.error(error.error)
      }
    }

    setSubmitting(false)
  }

  const handleDelete = async (evento: Evento) => {
    if (!confirm(`¿Eliminar este evento de "${evento.tituloName}"?`)) return

    const res = await fetch(`/api/calendario/${evento.id}`, {
      method: "DELETE",
    })

    if (res.ok) {
      toast.success("Evento eliminado")
      setPopoverFecha(null)
      fetchEventos(mesActual)
    } else {
      const error = await res.json()
      toast.error(error.error)
    }
  }

  const getEventosDelDia = (date: Date): Evento[] => {
    const fechaKey = format(date, "yyyy-MM-dd")
    return eventosPorFecha[fechaKey] || []
  }

  const renderDay = (date: Date) => {
    const eventosDelDia = getEventosDelDia(date)
    const fechaKey = format(date, "yyyy-MM-dd")
    const cantidadEventos = eventosDelDia.length

    if (cantidadEventos === 0) {
      return (
        <div
          className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-muted/50 rounded"
          onClick={() => openCreateDialog(date)}
        >
          {date.getDate()}
        </div>
      )
    }

    const ensayos = eventosDelDia.filter((e) => e.eventoType === "ENSAYO").length
    const funciones = eventosDelDia.filter((e) => e.eventoType === "FUNCION").length

    return (
      <Popover
        open={popoverFecha === fechaKey}
        onOpenChange={(open) => setPopoverFecha(open ? fechaKey : null)}
      >
        <PopoverTrigger asChild>
          <div className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer">
            <span>{date.getDate()}</span>
            <div className="flex gap-0.5 mt-0.5">
              {ensayos > 0 && (
                <div className="w-2 h-2 rounded-full bg-blue-500" title="Ensayo" />
              )}
              {funciones > 0 && (
                <div className="w-2 h-2 rounded-full bg-amber-500" title="Funcion" />
              )}
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="center">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="font-medium">
                {format(date, "d 'de' MMMM", { locale: es })}
              </p>
              <Button size="sm" variant="outline" onClick={() => openCreateDialog(date)}>
                <Plus className="w-3 h-3 mr-1" />
                Agregar
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {eventosDelDia.map((evento) => (
                <div
                  key={evento.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        evento.eventoType === "ENSAYO" ? "bg-blue-500" : "bg-amber-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {evento.tituloName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {evento.eventoType === "ENSAYO" ? "Ensayo" : "Funcion"} · Cupo: {evento.cupoDisponible}/{evento.cupoEfectivo}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEditDialog(evento)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(evento)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Calendario de Eventos</h1>
            <p className="text-muted-foreground">
              Ensayos y funciones de la temporada
            </p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <Select value={filtroTitulo} onValueChange={setFiltroTitulo}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por titulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los titulos</SelectItem>
              {titulos.map((titulo) => (
                <SelectItem key={titulo.id} value={titulo.id}>
                  {titulo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Ensayo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Funcion</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            {format(mesActual, "MMMM yyyy", { locale: es })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : titulos.length === 0 ? (
            <div className="text-center py-8">
              <Music className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                No hay titulos creados
              </p>
              <p className="text-sm text-muted-foreground">
                Primero crea titulos en la seccion de Titulos
              </p>
            </div>
          ) : (
            <Calendar
              mode="single"
              month={mesActual}
              onMonthChange={setMesActual}
              className="rounded-md border w-full"
              classNames={{
                months: "w-full",
                month: "w-full",
                table: "w-full",
                head_row: "flex w-full",
                head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "h-14 w-full text-center text-sm p-0 relative",
                day: "h-14 w-full p-0 font-normal",
                day_today: "bg-accent text-accent-foreground",
              }}
              components={{
                DayButton: ({ day, ...props }) => (
                  <button {...props} className={`${props.className} w-full h-full`}>
                    {renderDay(day.date)}
                  </button>
                ),
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Resumen del mes */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-6">
            <div>
              <p className="text-2xl font-bold">{eventos.length}</p>
              <p className="text-sm text-muted-foreground">Eventos del mes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {eventos.filter((e) => e.eventoType === "ENSAYO").length}
              </p>
              <p className="text-sm text-muted-foreground">Ensayos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">
                {eventos.filter((e) => e.eventoType === "FUNCION").length}
              </p>
              <p className="text-sm text-muted-foreground">Funciones</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {eventos.reduce((sum, e) => sum + e.cupoEfectivo, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Rotativos disponibles</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para crear/editar evento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEvento ? "Editar Evento" : "Nuevo Evento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedDate && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">
                  {format(selectedDate, "EEEE d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            )}

            {!editingEvento && (
              <div className="space-y-2">
                <Label htmlFor="titulo">Titulo</Label>
                <Select
                  value={formData.tituloId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tituloId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un titulo" />
                  </SelectTrigger>
                  <SelectContent>
                    {titulos.map((titulo) => (
                      <SelectItem key={titulo.id} value={titulo.id}>
                        {titulo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editingEvento && (
              <div className="space-y-2">
                <Label>Titulo</Label>
                <p className="text-sm font-medium">{editingEvento.tituloName}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de Evento</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.eventoType === "ENSAYO" ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, eventoType: "ENSAYO" })}
                  className="flex-1"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                  Ensayo
                </Button>
                <Button
                  type="button"
                  variant={formData.eventoType === "FUNCION" ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, eventoType: "FUNCION" })}
                  className="flex-1"
                >
                  <div className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                  Funcion
                </Button>
              </div>
            </div>

            {/* Mostrar cupo */}
            {formData.tituloId && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p>
                  Cupo para este {formData.eventoType === "ENSAYO" ? "ensayo" : "funcion"}:{" "}
                  <span className="font-medium">
                    {titulos.find((t) => t.id === formData.tituloId)?.[
                      formData.eventoType === "ENSAYO" ? "cupoEnsayo" : "cupoFuncion"
                    ] || 0}{" "}
                    rotativos
                  </span>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !formData.tituloId}>
                {submitting
                  ? "Guardando..."
                  : editingEvento
                    ? "Guardar Cambios"
                    : "Crear Evento"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
