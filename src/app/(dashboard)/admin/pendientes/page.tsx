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
import { Clock, CheckCircle, XCircle } from "lucide-react"

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

  useEffect(() => {
    fetchPendientes()
  }, [])

  const fetchPendientes = async () => {
    const res = await fetch("/api/solicitudes")
    const data = await res.json()
    // Filtrar todas las solicitudes pendientes
    const pendientes = data.filter(
      (s: { estado: string }) => s.estado === "PENDIENTE"
    )
    setSolicitudes(pendientes)
    setLoading(false)
  }

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
      <div className="flex items-center gap-3">
        <Clock className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Solicitudes Pendientes</h1>
          <p className="text-muted-foreground">
            Rotativos que requieren tu aprobación
          </p>
        </div>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integrante</TableHead>
                  <TableHead>Fecha del rotativo</TableHead>
                  <TableHead>Solicitado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitudes.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.user.avatar && (
                          <span className="text-xl">{s.user.avatar}</span>
                        )}
                        <div>
                          <p className="font-medium">
                            {s.user.alias || s.user.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {s.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {new Date(s.fecha).toLocaleDateString("es-ES", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => aprobar(s.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rechazar(s.id)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rechazar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
