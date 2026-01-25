"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Clock, CheckCircle, XCircle, RefreshCw, Ban, Hourglass } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface SolicitudPendiente {
  id: string
  fecha: string
  esCasoEspecial: boolean
  porcentajeAlMomento: number | null
  createdAt: string
  motivo?: string | null
  user: {
    id: string
    name: string
    email: string
    alias?: string | null
  }
}

interface CancelacionPendiente {
  id: string
  motivo: string | null
  createdAt: string
  user: {
    id: string
    name: string
    alias: string | null
  }
  event: {
    id: string
    title: string
    date: string
  }
}

interface EnEspera {
  id: string
  fecha: string
  posicionEnCola: number | null
  createdAt: string
  user: {
    id: string
    name: string
    alias?: string | null
  }
  tituloName?: string
  eventoType?: string
}

type AccionPendiente = {
  tipo: "aprobar" | "rechazar"
  solicitud: SolicitudPendiente
} | null

type AccionCancelacion = {
  tipo: "aprobar" | "rechazar"
  cancelacion: CancelacionPendiente
} | null

const MOTIVO_APROBACION_DEFAULT = "Validado por la fila"
const MOTIVO_RECHAZO_DEFAULT = "No validado por la fila"

export default function PendientesPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudPendiente[]>([])
  const [cancelaciones, setCancelaciones] = useState<CancelacionPendiente[]>([])
  const [enEspera, setEnEspera] = useState<EnEspera[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [accionPendiente, setAccionPendiente] = useState<AccionPendiente>(null)
  const [motivoAdicional, setMotivoAdicional] = useState("")
  const [procesando, setProcesando] = useState(false)

  const [accionCancelacion, setAccionCancelacion] = useState<AccionCancelacion>(null)

  const fetchPendientes = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const res = await fetch("/api/solicitudes")
      const data = await res.json()
      // Filtrar solicitudes pendientes de aprobacion
      const pendientes = data.filter(
        (s: { estado: string }) => s.estado === "PENDIENTE"
      )
      setSolicitudes(pendientes)

      // Filtrar cancelaciones tardias pendientes
      const cancelacionesPendientes = data.filter(
        (s: { estado: string }) => s.estado === "CANCELACION_PENDIENTE"
      )
      setCancelaciones(cancelacionesPendientes)

      // Filtrar en espera (informativo)
      const esperando = data.filter(
        (s: { estado: string }) => s.estado === "EN_ESPERA"
      )
      setEnEspera(esperando)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchPendientes()
    // Auto-refresh cada 15 segundos
    const interval = setInterval(() => fetchPendientes(), 15000)
    return () => clearInterval(interval)
  }, [fetchPendientes])

  const handleCancelacionAccion = async (tipo: "aprobar" | "rechazar", cancelacion: CancelacionPendiente) => {
    setProcesando(true)
    try {
      const res = await fetch(`/api/solicitudes/${cancelacion.id}/aprobar-cancelacion`, {
        method: tipo === "aprobar" ? "POST" : "DELETE",
      })

      if (res.ok) {
        toast.success(tipo === "aprobar" ? "Cancelacion aprobada" : "Cancelacion rechazada")
        fetchPendientes()
      } else {
        const error = await res.json()
        toast.error(error.error)
      }
    } finally {
      setProcesando(false)
      setAccionCancelacion(null)
    }
  }

  const abrirDialogAccion = (tipo: "aprobar" | "rechazar", solicitud: SolicitudPendiente) => {
    setAccionPendiente({ tipo, solicitud })
    setMotivoAdicional("")
  }

  const cerrarDialog = () => {
    setAccionPendiente(null)
    setMotivoAdicional("")
  }

  const confirmarAccion = async () => {
    if (!accionPendiente) return

    setProcesando(true)
    const { tipo, solicitud } = accionPendiente
    const motivoDefault = tipo === "aprobar" ? MOTIVO_APROBACION_DEFAULT : MOTIVO_RECHAZO_DEFAULT
    const motivoFinal = motivoAdicional.trim()
      ? `${motivoDefault}. ${motivoAdicional.trim()}`
      : motivoDefault

    try {
      const endpoint = tipo === "aprobar" ? "aprobar" : "rechazar"
      const res = await fetch(`/api/solicitudes/${solicitud.id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoFinal }),
      })

      if (res.ok) {
        toast.success(tipo === "aprobar" ? "Solicitud aprobada" : "Solicitud rechazada")
        fetchPendientes()
        cerrarDialog()
      } else {
        const error = await res.json()
        toast.error(error.error)
      }
    } finally {
      setProcesando(false)
    }
  }

  const motivoDefault = accionPendiente?.tipo === "aprobar"
    ? MOTIVO_APROBACION_DEFAULT
    : MOTIVO_RECHAZO_DEFAULT

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Solicitudes Pendientes</h1>
            <p className="text-muted-foreground">
              Rotativos que requieren tu aprobación
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchPendientes(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="text-base px-3 py-1">
              {solicitudes.length}
            </Badge>
            Solicitudes Esperando Revisión
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700">
                No hay solicitudes pendientes
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Todas las solicitudes han sido procesadas
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {solicitudes.map((s) => (
                <div
                  key={s.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  {/* Header: Usuario */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {s.user.alias || s.user.name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {s.user.email}
                      </p>
                    </div>
                  </div>

                  {/* Info: Fechas */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Rotativo: </span>
                      <span className="font-medium">
                        {new Date(s.fecha + "T12:00:00").toLocaleDateString("es-ES", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Solicitado: </span>
                      <span>
                        {new Date(s.createdAt).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Motivo de la solicitud */}
                  {s.motivo && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-sm">
                      <span className="text-amber-800 font-medium">Motivo: </span>
                      <span className="text-amber-700">{s.motivo}</span>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => abrirDialogAccion("aprobar", s)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => abrirDialogAccion("rechazar", s)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancelaciones tardias pendientes */}
      {cancelaciones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-amber-500" />
              <Badge variant="secondary" className="text-base px-3 py-1">
                {cancelaciones.length}
              </Badge>
              cancelaciones tardias pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cancelaciones.map((c) => (
                <div
                  key={c.id}
                  className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {c.user.alias || c.user.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Evento: {c.event.title} -{" "}
                        {format(new Date(c.event.date), "EEEE d 'de' MMMM", { locale: es })}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                      Cancelacion tardia
                    </Badge>
                  </div>

                  {c.motivo && (
                    <div className="text-sm text-amber-700">
                      <span className="font-medium">Motivo: </span>
                      {c.motivo}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleCancelacionAccion("aprobar", c)}
                      disabled={procesando}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprobar cancelacion
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleCancelacionAccion("rechazar", c)}
                      disabled={procesando}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rechazar (mantener rotativo)
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* En espera (informativo) */}
      {enEspera.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hourglass className="w-5 h-5 text-yellow-500" />
              <Badge variant="secondary" className="text-base px-3 py-1 bg-yellow-100 text-yellow-800">
                {enEspera.length}
              </Badge>
              En Lista de Espera
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Usuarios esperando que se libere un cupo. No requieren acción.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {enEspera.map((e) => (
                <div
                  key={e.id}
                  className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 font-mono">
                      P{e.posicionEnCola || "?"}
                    </Badge>
                    <div>
                      <p className="font-medium">
                        {e.user.alias || e.user.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.fecha + "T12:00:00").toLocaleDateString("es-ES", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                        {e.tituloName && <> · {e.tituloName}</>}
                        {e.eventoType && <> · {e.eventoType === "FUNCION" ? "Función" : "Ensayo"}</>}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Solicitado {new Date(e.createdAt).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmación */}
      <Dialog open={accionPendiente !== null} onOpenChange={(open) => !open && cerrarDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {accionPendiente?.tipo === "aprobar" ? "Aprobar solicitud" : "Rechazar solicitud"}
            </DialogTitle>
            <DialogDescription>
              {accionPendiente && (
                <>
                  Solicitud de <strong>{accionPendiente.solicitud.user.alias || accionPendiente.solicitud.user.name}</strong> para el{" "}
                  <strong>
                    {new Date(accionPendiente.solicitud.fecha + "T12:00:00").toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo por defecto</Label>
              <div className={`p-3 rounded-md text-sm font-medium ${
                accionPendiente?.tipo === "aprobar"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {motivoDefault}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo-adicional">Aclaración adicional (opcional)</Label>
              <Textarea
                id="motivo-adicional"
                placeholder="Si necesitas agregar alguna aclaración..."
                value={motivoAdicional}
                onChange={(e) => setMotivoAdicional(e.target.value)}
                rows={3}
              />
            </div>

            {motivoAdicional.trim() && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Motivo final</Label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {motivoDefault}. {motivoAdicional.trim()}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cerrarDialog} disabled={procesando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarAccion}
              disabled={procesando}
              className={accionPendiente?.tipo === "aprobar"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-destructive hover:bg-destructive/90"
              }
            >
              {procesando ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : accionPendiente?.tipo === "aprobar" ? (
                <CheckCircle className="w-4 h-4 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              {accionPendiente?.tipo === "aprobar" ? "Confirmar aprobación" : "Confirmar rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
