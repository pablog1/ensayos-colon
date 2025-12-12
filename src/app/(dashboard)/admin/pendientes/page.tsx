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

interface SolicitudPendiente {
  id: string
  fecha: string
  motivo: string | null
  esCasoEspecial: boolean
  porcentajeAlMomento: number | null
  createdAt: string
  user: {
    id: string
    name: string
    email: string
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
    // Filtrar solo pendientes y casos especiales
    const pendientes = data.filter(
      (s: SolicitudPendiente) => s.esCasoEspecial && s.porcentajeAlMomento !== null
    ).filter((s: { estado: string }) => s.estado === "PENDIENTE")
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
    if (!confirm("¿Estas seguro de rechazar esta solicitud?")) return

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
      <h1 className="text-2xl font-bold">Casos Especiales Pendientes</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            Solicitudes que exceden el 5% ({solicitudes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : solicitudes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay casos pendientes</p>
              <p className="text-sm text-gray-400 mt-2">
                Los casos especiales aparecen cuando un integrante solicita un
                descanso que excede el 5% sobre el promedio del grupo.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integrante</TableHead>
                  <TableHead>Fecha Solicitada</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>% sobre promedio</TableHead>
                  <TableHead>Solicitado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitudes.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{s.user.name}</p>
                        <p className="text-sm text-gray-500">{s.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(s.fecha).toLocaleDateString("es-ES", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </TableCell>
                    <TableCell>{s.motivo || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        +{s.porcentajeAlMomento?.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(s.createdAt).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => aprobar(s.id)}>
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rechazar(s.id)}
                        >
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
