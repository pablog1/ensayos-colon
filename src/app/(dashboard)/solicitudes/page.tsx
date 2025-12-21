"use client"

import { useState, useEffect } from "react"
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
import { toast } from "sonner"

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
}

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)

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
          <CardTitle>Historial de Solicitudes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : solicitudes.length === 0 ? (
            <p className="text-gray-500">No tienes solicitudes</p>
          ) : (
            <>
              {/* Vista mobile: Cards */}
              <div className="md:hidden space-y-3">
                {solicitudes.map((s) => (
                  <div key={s.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{s.tituloName || s.eventoTitle}</p>
                        <p className="text-sm text-muted-foreground">
                          {s.eventoType === "ENSAYO" ? "Ensayo" : "Función"}
                        </p>
                      </div>
                      <Badge variant={estadoBadgeVariant(s.estado)}>
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
                    {solicitudes.map((s) => (
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
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={estadoBadgeVariant(s.estado)}>
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
