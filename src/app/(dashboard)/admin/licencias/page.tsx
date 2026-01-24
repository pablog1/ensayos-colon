"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  RefreshCw,
  Plus,
  Calendar,
  Trash2,
} from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { parseDateSafe } from "@/lib/utils"

interface DetallesCalculo {
  totalCupos: number
  totalIntegrantes: number
  resultadoExacto: number
  resultadoRedondeado: number
}

interface License {
  id: string
  userId: string
  startDate: string
  endDate: string
  description: string | null
  rotativosCalculados: number
  detallesCalculo: DetallesCalculo | null
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    alias: string | null
  }
  season: {
    id: string
    name: string
  }
  createdBy: {
    id: string
    name: string
  } | null
}

interface User {
  id: string
  name: string
  alias: string | null
}

export default function LicenciasPage() {
  const [licencias, setLicencias] = useState<License[]>([])
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Dialog para crear licencia
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    userId: "",
    startDate: "",
    endDate: "",
    description: "",
  })
  const [creando, setCreando] = useState(false)

  // Dialog para eliminar
  const [eliminarDialog, setEliminarDialog] = useState<{
    open: boolean
    licencia: License | null
  }>({ open: false, licencia: null })
  const [procesando, setProcesando] = useState(false)

  const fetchLicencias = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const res = await fetch("/api/licencias")
      const data = await res.json()
      setLicencias(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const fetchUsuarios = useCallback(async () => {
    const res = await fetch("/api/integrantes")
    const data = await res.json()
    setUsuarios(data.filter((u: { role: string }) => u.role === "INTEGRANTE"))
  }, [])

  useEffect(() => {
    fetchLicencias()
    fetchUsuarios()
    const interval = setInterval(() => fetchLicencias(), 30000)
    return () => clearInterval(interval)
  }, [fetchLicencias, fetchUsuarios])

  const handleCrearLicencia = async () => {
    if (!formData.userId || !formData.startDate || !formData.endDate) {
      toast.error("Completa todos los campos requeridos")
      return
    }

    setCreando(true)
    try {
      const res = await fetch("/api/licencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Licencia registrada correctamente")
        setDialogOpen(false)
        setFormData({
          userId: "",
          startDate: "",
          endDate: "",
          description: "",
        })
        fetchLicencias()
      } else {
        const error = await res.json()
        toast.error(error.error || "Error al registrar licencia")
      }
    } finally {
      setCreando(false)
    }
  }

  const handleEliminar = async () => {
    if (!eliminarDialog.licencia) return

    setProcesando(true)
    try {
      const res = await fetch(`/api/licencias/${eliminarDialog.licencia.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Licencia eliminada")
        setEliminarDialog({ open: false, licencia: null })
        fetchLicencias()
      } else {
        const error = await res.json()
        toast.error(error.error || "Error al eliminar licencia")
      }
    } finally {
      setProcesando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Licencias</h1>
          <p className="text-muted-foreground">
            Registra licencias de los integrantes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLicencias(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Licencia
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{licencias.length}</p>
              <p className="text-xs text-muted-foreground">Licencias registradas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de licencias */}
      <Card>
        <CardHeader>
          <CardTitle>Licencias registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {licencias.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay licencias registradas
            </p>
          ) : (
            <div className="space-y-3">
              {licencias.map((licencia) => (
                <div
                  key={licencia.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {licencia.user.alias || licencia.user.name}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(parseDateSafe(licencia.startDate), "dd/MM/yyyy", { locale: es })} -{" "}
                      {format(parseDateSafe(licencia.endDate), "dd/MM/yyyy", { locale: es })}
                      {licencia.description && (
                        <span className="ml-2">- {licencia.description}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-medium text-foreground">
                          Rotativos sumados: {Math.floor(licencia.rotativosCalculados)}
                        </span>
                        {licencia.createdBy && (
                          <span className="ml-2">
                            - Registrada por: {licencia.createdBy.name}
                          </span>
                        )}
                      </div>
                      {licencia.detallesCalculo && (
                        <div className="text-xs text-muted-foreground/80 italic">
                          Cálculo: {licencia.detallesCalculo.totalCupos} cupos en el período ÷ {licencia.detallesCalculo.totalIntegrantes} integrantes = {licencia.detallesCalculo.resultadoExacto}
                          {licencia.detallesCalculo.resultadoExacto !== licencia.detallesCalculo.resultadoRedondeado && (
                            <> → redondeado: {licencia.detallesCalculo.resultadoRedondeado}</>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setEliminarDialog({ open: true, licencia })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog crear licencia */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Licencia</DialogTitle>
            <DialogDescription>
              Registra una licencia para un integrante
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Integrante</Label>
              <Select
                value={formData.userId}
                onValueChange={(value) =>
                  setFormData({ ...formData, userId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar integrante" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.alias || user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha inicio</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha fin</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripcion (opcional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCrearLicencia} disabled={creando}>
              {creando ? "Registrando..." : "Registrar Licencia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog eliminar */}
      <Dialog
        open={eliminarDialog.open}
        onOpenChange={(open) => setEliminarDialog({ ...eliminarDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Licencia</DialogTitle>
            <DialogDescription>
              Esta accion no se puede deshacer.
              {eliminarDialog.licencia && (
                <p className="mt-2 text-amber-600">
                  Se revertirán los{" "}
                  {Math.floor(eliminarDialog.licencia.rotativosCalculados)}{" "}
                  rotativos sumados.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEliminarDialog({ open: false, licencia: null })}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleEliminar}
              disabled={procesando}
            >
              {procesando ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
