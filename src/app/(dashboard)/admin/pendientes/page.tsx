"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react"

interface SolicitudPendiente {
  id: string
  fecha: string
  esCasoEspecial: boolean
  porcentajeAlMomento: number | null
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    alias?: string | null
    avatar?: string | null
  }
}

export default function PendientesPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPendientes = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const res = await fetch("/api/solicitudes")
      const data = await res.json()
      // Filtrar todas las solicitudes pendientes
      const pendientes = data.filter(
        (s: { estado: string }) => s.estado === "PENDIENTE"
      )
      setSolicitudes(pendientes)
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

  const aprobar = async (id: string) => {
    const res = await fetch(`/api/solicitudes/${id}/aprobar`, {
      method: "POST",
    })

    if (res.ok) {
      toast.success("Solicitud aprobada")
      fetchPendientes()
    } else {
      const error = await res.json()
      toast.error(error.error)
    }
  }

  const rechazar = async (id: string) => {
    if (!confirm("¿Estás seguro de rechazar esta solicitud?")) return

    const res = await fetch(`/api/solicitudes/${id}/rechazar`, {
      method: "POST",
    })

    if (res.ok) {
      toast.success("Solicitud rechazada")
      fetchPendientes()
    } else {
      const error = await res.json()
      toast.error(error.error)
    }
  }

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
            solicitudes esperando revisión
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
                    {s.user.avatar && (
                      <span className="text-2xl">{s.user.avatar}</span>
                    )}
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

                  {/* Acciones */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => aprobar(s.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => rechazar(s.id)}
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
    </div>
  )
}
