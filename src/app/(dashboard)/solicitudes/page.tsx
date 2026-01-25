"use client"

import { useState, useEffect, useMemo } from "react"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { ChevronDown, ArrowUpDown } from "lucide-react"
import { useDebugDate } from "@/contexts/debug-date-context"

interface Solicitud {
  id: string
  fecha: string
  estado: string
  esCasoEspecial: boolean
  createdAt: string
  eventoId: string
  eventoTitle: string
  eventoType: string
  tituloName?: string
  tituloColor?: string
  motivo?: string | null
  posicionEnCola?: number | null
}

// Helper para formatear el estado
const formatEstado = (estado: string, posicionEnCola?: number | null): string => {
  switch (estado) {
    case "EN_ESPERA":
      return posicionEnCola ? `En espera (puesto ${posicionEnCola})` : "En espera"
    case "APROBADO":
      return "Aprobado"
    case "PENDIENTE":
      return "Pendiente"
    case "RECHAZADO":
      return "Rechazado"
    case "CANCELADO":
      return "Cancelado"
    default:
      return estado
  }
}

type SortField = "createdAt" | "fecha"

export default function SolicitudesPage() {
  const { debugDate } = useDebugDate()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [showPastRequests, setShowPastRequests] = useState(false)
  // Ordenamiento: por defecto por fecha de solicitud (createdAt), descendente (más recientes primero)
  const [futureSortField, setFutureSortField] = useState<SortField>("createdAt")
  const [futureAscending, setFutureAscending] = useState(false)
  const [pastSortField, setPastSortField] = useState<SortField>("createdAt")
  const [pastAscending, setPastAscending] = useState(false)

  useEffect(() => {
    fetchSolicitudes()

    // Polling para actualizar automáticamente cada 30 segundos
    const interval = setInterval(fetchSolicitudes, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchSolicitudes = async () => {
    const res = await fetch("/api/solicitudes")
    const data = await res.json()
    setSolicitudes(data)
    setLoading(false)
  }

  const cancelarSolicitud = async (id: string) => {
    if (!confirm("¿Estas seguro de cancelar esta solicitud?")) return

    const res = await fetch(`/api/solicitudes/${id}`, {
      method: "DELETE",
    })

    if (res.ok) {
      toast.success("Solicitud cancelada")
      fetchSolicitudes()
    } else {
      const error = await res.json()
      toast.error(error.error)
    }
  }

  // Separate future and past requests, sorted by selected field
  const { futureSolicitudes, pastSolicitudes } = useMemo(() => {
    const today = new Date(debugDate)
    today.setHours(0, 0, 0, 0)
    const currentYear = today.getFullYear()

    const future: Solicitud[] = []
    const past: Solicitud[] = []

    solicitudes.forEach((s) => {
      const requestDate = new Date(s.fecha + "T12:00:00")
      const requestYear = requestDate.getFullYear()

      if (requestDate >= today) {
        future.push(s)
      } else if (requestYear === currentYear) {
        past.push(s)
      }
    })

    // Sort by selected field
    const sortByField = (a: Solicitud, b: Solicitud, field: SortField, ascending: boolean) => {
      let dateA: number, dateB: number
      if (field === "createdAt") {
        dateA = new Date(a.createdAt).getTime()
        dateB = new Date(b.createdAt).getTime()
      } else {
        dateA = new Date(a.fecha + "T12:00:00").getTime()
        dateB = new Date(b.fecha + "T12:00:00").getTime()
      }
      return ascending ? dateA - dateB : dateB - dateA
    }

    future.sort((a, b) => sortByField(a, b, futureSortField, futureAscending))
    past.sort((a, b) => sortByField(a, b, pastSortField, pastAscending))

    return { futureSolicitudes: future, pastSolicitudes: past }
  }, [solicitudes, futureSortField, futureAscending, pastSortField, pastAscending, debugDate])

  const estadoBadgeVariant = (estado: string) => {
    switch (estado) {
      case "APROBADO":
        return "default"
      case "PENDIENTE":
        return "secondary"
      case "RECHAZADO":
        return "destructive"
      case "CANCELADO":
        return "outline"
      default:
        return "secondary"
    }
  }

  const getBadgeClassName = (estado: string) => {
    switch (estado) {
      case "APROBADO":
        return "bg-green-500 hover:bg-green-600 text-white"
      case "PENDIENTE":
        return "bg-red-500 hover:bg-red-600 text-white"
      case "EN_ESPERA":
        return "bg-yellow-500 hover:bg-yellow-600 text-white"
      case "RECHAZADO":
        return "bg-red-500 hover:bg-red-600 text-white"
      case "CANCELADO":
        return "bg-gray-500 hover:bg-gray-600 text-white"
      default:
        return ""
    }
  }

  // Component to render solicitud card (mobile)
  const SolicitudCard = ({ s }: { s: Solicitud }) => (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{s.tituloName || s.eventoTitle}</p>
          <p className="text-sm text-muted-foreground">
            {s.eventoType === "ENSAYO" ? "Ensayo" : "Función"}
          </p>
        </div>
        <Badge variant={estadoBadgeVariant(s.estado)} className={getBadgeClassName(s.estado)}>
          {formatEstado(s.estado, s.posicionEnCola)}
        </Badge>
      </div>
      <div className="text-sm space-y-1">
        <div className="text-muted-foreground">
          <span className="font-medium">Evento: </span>
          {new Date(s.fecha + "T12:00:00").toLocaleDateString("es-ES", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
        <div className="text-muted-foreground text-xs">
          <span className="font-medium">Solicitado: </span>
          {new Date(s.createdAt).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
          })}
        </div>
      </div>
      {s.motivo && (
        <div className={`text-sm p-2 rounded ${
          s.estado === "RECHAZADO"
            ? "text-red-600 bg-red-50"
            : s.estado === "APROBADO"
              ? "text-green-600 bg-green-50"
              : "text-muted-foreground bg-muted"
        }`}>
          <span className="font-medium">Motivo: </span>
          {s.motivo}
        </div>
      )}
      {(s.estado === "PENDIENTE" || s.estado === "APROBADO" || s.estado === "EN_ESPERA") &&
        new Date(s.fecha) >= new Date() && (
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => cancelarSolicitud(s.id)}
          >
            Cancelar
          </Button>
        )}
    </div>
  )

  // Component to render solicitud row (desktop)
  const SolicitudRow = ({ s }: { s: Solicitud }) => (
    <TableRow key={s.id}>
      <TableCell className="text-muted-foreground text-sm">
        {new Date(s.createdAt).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
        })}
      </TableCell>
      <TableCell>
        {new Date(s.fecha + "T12:00:00").toLocaleDateString("es-ES", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">
            {s.tituloName || s.eventoTitle}
          </span>
          <span className="text-xs text-muted-foreground">
            {s.eventoType === "ENSAYO" ? "Ensayo" : "Función"}
          </span>
          {s.motivo && (
            <span className={`text-xs mt-1 ${
              s.estado === "RECHAZADO"
                ? "text-red-600"
                : s.estado === "APROBADO"
                  ? "text-green-600"
                  : "text-muted-foreground"
            }`}>
              <span className="font-medium">Motivo: </span>
              {s.motivo}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={estadoBadgeVariant(s.estado)} className={`${getBadgeClassName(s.estado)} whitespace-nowrap`}>
          {formatEstado(s.estado, s.posicionEnCola)}
        </Badge>
      </TableCell>
      <TableCell>
        {(s.estado === "PENDIENTE" || s.estado === "APROBADO" || s.estado === "EN_ESPERA") &&
          new Date(s.fecha) >= new Date() && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancelarSolicitud(s.id)}
            >
              Cancelar
            </Button>
          )}
      </TableCell>
    </TableRow>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Mis Solicitudes</h1>
        <p className="text-sm text-muted-foreground">
          Para solicitar un rotativo, seleccioná un evento en el calendario
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Solicitudes Futuras</CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={futureSortField}
                onValueChange={(value: SortField) => setFutureSortField(value)}
              >
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Fecha solicitud</SelectItem>
                  <SelectItem value="fecha">Fecha evento</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFutureAscending(!futureAscending)}
                className="gap-1 text-muted-foreground"
                title={futureAscending ? "Antiguas primero" : "Recientes primero"}
              >
                <ArrowUpDown className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">
                  {futureAscending ? "Antiguas primero" : "Recientes primero"}
                </span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : futureSolicitudes.length === 0 ? (
            <p className="text-gray-500">No tienes solicitudes futuras</p>
          ) : (
            <>
              {/* Vista mobile: Cards */}
              <div className="md:hidden space-y-3">
                {futureSolicitudes.map((s) => (
                  <SolicitudCard key={s.id} s={s} />
                ))}
              </div>

              {/* Vista desktop: Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Solicitado</TableHead>
                      <TableHead className="w-28">Fecha Evento</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead className="w-32">Estado</TableHead>
                      <TableHead className="w-24">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {futureSolicitudes.map((s) => (
                      <SolicitudRow key={s.id} s={s} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Past requests collapsible section */}
      {!loading && pastSolicitudes.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Collapsible open={showPastRequests} onOpenChange={setShowPastRequests}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex justify-between items-center">
                  <span className="font-medium">Ver solicitudes pasadas ({pastSolicitudes.length})</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showPastRequests ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="flex justify-end mb-3 gap-2">
                  <Select
                    value={pastSortField}
                    onValueChange={(value: SortField) => setPastSortField(value)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="createdAt">Fecha solicitud</SelectItem>
                      <SelectItem value="fecha">Fecha evento</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPastAscending(!pastAscending)}
                    className="gap-1 text-muted-foreground"
                    title={pastAscending ? "Antiguas primero" : "Recientes primero"}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    <span className="text-xs hidden sm:inline">
                      {pastAscending ? "Antiguas primero" : "Recientes primero"}
                    </span>
                  </Button>
                </div>
                {/* Vista mobile: Cards */}
                <div className="md:hidden space-y-3">
                  {pastSolicitudes.map((s) => (
                    <SolicitudCard key={s.id} s={s} />
                  ))}
                </div>

                {/* Vista desktop: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Solicitado</TableHead>
                        <TableHead className="w-28">Fecha Evento</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead className="w-32">Estado</TableHead>
                        <TableHead className="w-24">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pastSolicitudes.map((s) => (
                        <SolicitudRow key={s.id} s={s} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
