"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Clock,
  CheckCircle,
  XCircle,
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

interface License {
  id: string
  userId: string
  startDate: string
  endDate: string
  type: string
  description: string | null
  estado: string
  rotativosCalculados: number
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

const LICENSE_TYPES = [
  { value: "MEDICA", label: "Licencia Medica" },
  { value: "PERSONAL", label: "Personal" },
  { value: "ESTUDIO", label: "Estudio" },
  { value: "MATERNIDAD", label: "Maternidad" },
  { value: "PATERNIDAD", label: "Paternidad" },
  { value: "OTRO", label: "Otro" },
]

const ESTADO_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDIENTE: { label: "Pendiente", variant: "secondary" },
  APROBADA: { label: "Aprobada", variant: "default" },
  RECHAZADA: { label: "Rechazada", variant: "destructive" },
  CANCELADA: { label: "Cancelada", variant: "outline" },
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
    type: "PERSONAL",
    description: "",
  })
  const [creando, setCreando] = useState(false)

  // Dialog para aprobar/rechazar
  const [accionDialog, setAccionDialog] = useState<{
    open: boolean
    tipo: "aprobar" | "rechazar" | null
    licencia: License | null
  }>({ open: false, tipo: null, licencia: null })
  const [procesando, setProcesando] = useState(false)

  // Dialog para eliminar
  const [eliminarDialog, setEliminarDialog] = useState<{
    open: boolean
    licencia: License | null
  }>({ open: false, licencia: null })

  // Filtro de estado
  const [filtroEstado, setFiltroEstado] = useState<string>("todas")

  const fetchLicencias = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (filtroEstado !== "todas") {
        params.set("estado", filtroEstado)
      }
      const res = await fetch(`/api/licencias?${params}`)
      const data = await res.json()
      setLicencias(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filtroEstado])

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
    if (!formData.userId || !formData.startDate || !formData.endDate || !formData.type) {
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
        toast.success("Licencia creada correctamente")
        setDialogOpen(false)
        setFormData({
          userId: "",
          startDate: "",
          endDate: "",
          type: "PERSONAL",
          description: "",
        })
        fetchLicencias()
      } else {
        const error = await res.json()
        toast.error(error.error || "Error al crear licencia")
      }
    } finally {
      setCreando(false)
    }
  }

  const handleAccion = async () => {
    if (!accionDialog.licencia || !accionDialog.tipo) return

    setProcesando(true)
    try {
      const nuevoEstado = accionDialog.tipo === "aprobar" ? "APROBADA" : "RECHAZADA"
      const res = await fetch(`/api/licencias/${accionDialog.licencia.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      })

      if (res.ok) {
        toast.success(
          accionDialog.tipo === "aprobar"
            ? "Licencia aprobada"
            : "Licencia rechazada"
        )
        setAccionDialog({ open: false, tipo: null, licencia: null })
        fetchLicencias()
      } else {
        const error = await res.json()
        toast.error(error.error || "Error al procesar licencia")
      }
    } finally {
      setProcesando(false)
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

  const pendientes = licencias.filter((l) => l.estado === "PENDIENTE")

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
            Gestiona las licencias de los integrantes
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{pendientes.length}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {licencias.filter((l) => l.estado === "APROBADA").length}
                </p>
                <p className="text-xs text-muted-foreground">Aprobadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {licencias.filter((l) => l.estado === "RECHAZADA").length}
                </p>
                <p className="text-xs text-muted-foreground">Rechazadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{licencias.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <Label>Filtrar por estado:</Label>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="PENDIENTE">Pendientes</SelectItem>
            <SelectItem value="APROBADA">Aprobadas</SelectItem>
            <SelectItem value="RECHAZADA">Rechazadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de licencias */}
      <Card>
        <CardHeader>
          <CardTitle>Licencias</CardTitle>
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
                      <Badge variant={ESTADO_BADGES[licencia.estado]?.variant || "secondary"}>
                        {ESTADO_BADGES[licencia.estado]?.label || licencia.estado}
                      </Badge>
                      <Badge variant="outline">
                        {LICENSE_TYPES.find((t) => t.value === licencia.type)?.label || licencia.type}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(licencia.startDate), "dd/MM/yyyy", { locale: es })} -{" "}
                      {format(new Date(licencia.endDate), "dd/MM/yyyy", { locale: es })}
                      {licencia.description && (
                        <span className="ml-2">- {licencia.description}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Rotativos calculados: {licencia.rotativosCalculados.toFixed(2)}
                      {licencia.createdBy && (
                        <span className="ml-2">
                          - Creada por: {licencia.createdBy.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {licencia.estado === "PENDIENTE" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700"
                          onClick={() =>
                            setAccionDialog({
                              open: true,
                              tipo: "aprobar",
                              licencia,
                            })
                          }
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() =>
                            setAccionDialog({
                              open: true,
                              tipo: "rechazar",
                              licencia,
                            })
                          }
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rechazar
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setEliminarDialog({ open: true, licencia })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
              <Label>Tipo de licencia</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LICENSE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {creando ? "Creando..." : "Crear Licencia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog aprobar/rechazar */}
      <Dialog
        open={accionDialog.open}
        onOpenChange={(open) =>
          setAccionDialog({ ...accionDialog, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {accionDialog.tipo === "aprobar" ? "Aprobar" : "Rechazar"} Licencia
            </DialogTitle>
            <DialogDescription>
              {accionDialog.licencia && (
                <>
                  Licencia de{" "}
                  <strong>
                    {accionDialog.licencia.user.alias ||
                      accionDialog.licencia.user.name}
                  </strong>{" "}
                  del{" "}
                  {format(
                    new Date(accionDialog.licencia.startDate),
                    "dd/MM/yyyy"
                  )}{" "}
                  al{" "}
                  {format(
                    new Date(accionDialog.licencia.endDate),
                    "dd/MM/yyyy"
                  )}
                  {accionDialog.tipo === "aprobar" && (
                    <p className="mt-2">
                      Se acreditaran{" "}
                      <strong>
                        {accionDialog.licencia.rotativosCalculados.toFixed(2)}
                      </strong>{" "}
                      rotativos al usuario.
                    </p>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setAccionDialog({ open: false, tipo: null, licencia: null })
              }
            >
              Cancelar
            </Button>
            <Button
              variant={accionDialog.tipo === "aprobar" ? "default" : "destructive"}
              onClick={handleAccion}
              disabled={procesando}
            >
              {procesando
                ? "Procesando..."
                : accionDialog.tipo === "aprobar"
                ? "Aprobar"
                : "Rechazar"}
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
              {eliminarDialog.licencia?.estado === "APROBADA" && (
                <p className="mt-2 text-amber-600">
                  Se revertiran los{" "}
                  {eliminarDialog.licencia.rotativosCalculados.toFixed(2)}{" "}
                  rotativos acreditados.
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
