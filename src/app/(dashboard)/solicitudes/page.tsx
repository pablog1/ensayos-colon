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
import { toast } from "sonner"
import { ChevronDown, ArrowUpDown } from "lucide-react"

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
}

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [showPastRequests, setShowPastRequests] = useState(false)
  // true = ascendente (próximas primero), false = descendente (lejanas primero)
  const [futureAscending, setFutureAscending] = useState(true)
  const [pastAscending, setPastAscending] = useState(false)

  useEffect(() => {
    fetchSolicitudes()
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

  // Separate future and past requests, sorted by event date
  const { futureSolicitudes, pastSolicitudes } = useMemo(() => {
    const today = new Date()
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

    // Sort by event date
    const sortByDate = (a: Solicitud, b: Solicitud, ascending: boolean) => {
      const dateA = new Date(a.fecha + "T12:00:00").getTime()
      const dateB = new Date(b.fecha + "T12:00:00").getTime()
      return ascending ? dateA - dateB : dateB - dateA
    }

    future.sort((a, b) => sortByDate(a, b, futureAscending))
    past.sort((a, b) => sortByDate(a, b, pastAscending))

    return { futureSolicitudes: future, pastSolicitudes: past }
  }, [solicitudes, futureAscending, pastAscending])

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
          {s.estado}
        </Badge>
      </div>
      <div className="text-sm text-muted-foreground">
        {new Date(s.fecha + "T12:00:00").toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </div>
      {s.estado === "RECHAZADO" && s.motivo && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          <span className="font-medium">Motivo: </span>
          {s.motivo}
        </div>
      )}
      {(s.estado === "PENDIENTE" || s.estado === "APROBADO") &&
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
          {s.estado === "RECHAZADO" && s.motivo && (
            <span className="text-xs text-red-600 mt-1">
              <span className="font-medium">Motivo: </span>
              {s.motivo}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={estadoBadgeVariant(s.estado)} className={getBadgeClassName(s.estado)}>
          {s.estado}
        </Badge>
      </TableCell>
      <TableCell>
        {(s.estado === "PENDIENTE" || s.estado === "APROBADO") &&
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
          <div className="flex items-center justify-between">
            <CardTitle>Solicitudes Futuras</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFutureAscending(!futureAscending)}
              className="gap-1 text-muted-foreground"
              title={futureAscending ? "Mostrando próximas primero" : "Mostrando lejanas primero"}
            >
              <ArrowUpDown className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">
                {futureAscending ? "Próximas primero" : "Lejanas primero"}
              </span>
            </Button>
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
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
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
                <div className="flex justify-end mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPastAscending(!pastAscending)}
                    className="gap-1 text-muted-foreground"
                    title={pastAscending ? "Mostrando antiguas primero" : "Mostrando recientes primero"}
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
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
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
