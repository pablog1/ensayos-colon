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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  Music,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Users,
  Hash,
} from "lucide-react"

interface Titulo {
  id: string
  name: string
  type: "OPERA" | "CONCIERTO" | "BALLET" | "RECITAL" | "OTRO"
  cupo: number
  description: string | null
  color: string | null
  totalEventos: number
  totalEnsayos: number
  totalFunciones: number
  totalRotativos: number
}

interface SeasonStats {
  season: { id: string; name: string }
  titulos: { total: number; porTipo: Record<string, number> }
  eventos: { total: number; ensayos: number; funciones: number }
  rotativos: { totalDisponibles: number; totalIntegrantes: number; promedioPorintegrante: number }
}

const TIPO_LABELS: Record<string, string> = {
  OPERA: "Opera",
  CONCIERTO: "Concierto",
  BALLET: "Ballet",
  RECITAL: "Recital",
  OTRO: "Otro",
}

const TIPO_COLORS: Record<string, string> = {
  OPERA: "bg-red-100 text-red-800",
  CONCIERTO: "bg-blue-100 text-blue-800",
  BALLET: "bg-pink-100 text-pink-800",
  RECITAL: "bg-green-100 text-green-800",
  OTRO: "bg-gray-100 text-gray-800",
}

export default function TitulosPage() {
  const [titulos, setTitulos] = useState<Titulo[]>([])
  const [stats, setStats] = useState<SeasonStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTitulo, setEditingTitulo] = useState<Titulo | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "OPERA" as Titulo["type"],
    cupo: 4,
    description: "",
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [titulosRes, statsRes] = await Promise.all([
      fetch("/api/titulos"),
      fetch("/api/temporada/stats"),
    ])

    if (titulosRes.ok) {
      const data = await titulosRes.json()
      setTitulos(data)
    }

    if (statsRes.ok) {
      const data = await statsRes.json()
      setStats(data)
    }

    setLoading(false)
  }

  const openCreateDialog = () => {
    setEditingTitulo(null)
    setFormData({
      name: "",
      type: "OPERA",
      cupo: 4,
      description: "",
    })
    setDialogOpen(true)
  }

  const openEditDialog = (titulo: Titulo) => {
    setEditingTitulo(titulo)
    setFormData({
      name: titulo.name,
      type: titulo.type,
      cupo: titulo.cupo,
      description: titulo.description || "",
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const url = editingTitulo
      ? `/api/titulos/${editingTitulo.id}`
      : "/api/titulos"
    const method = editingTitulo ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })

    if (res.ok) {
      toast.success(editingTitulo ? "Titulo actualizado" : "Titulo creado")
      setDialogOpen(false)
      fetchData()
    } else {
      const error = await res.json()
      toast.error(error.error)
    }

    setSubmitting(false)
  }

  const handleDelete = async (titulo: Titulo) => {
    // Nota: El título no tiene endDate en esta interfaz, pero la validación se hace en el backend
    // La API rechazará la eliminación si la fecha de fin ya pasó
    if (
      !confirm(
        `¿Eliminar "${titulo.name}"? Se eliminarán todos sus eventos (${titulo.totalEventos}).`
      )
    )
      return

    const res = await fetch(`/api/titulos/${titulo.id}`, {
      method: "DELETE",
    })

    if (res.ok) {
      toast.success("Titulo eliminado")
      fetchData()
    } else {
      const error = await res.json()
      toast.error(error.error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Music className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Titulos de la Temporada</h1>
            <p className="text-muted-foreground">
              {stats?.season?.name || "Cargando..."}
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Titulo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTitulo ? "Editar Titulo" : "Nuevo Titulo"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ej: La Traviata, Concierto de Primavera"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: Titulo["type"]) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERA">Ópera</SelectItem>
                    <SelectItem value="CONCIERTO">Concierto</SelectItem>
                    <SelectItem value="BALLET">Ballet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cupo">Cupo de rotativos</Label>
                <Input
                  id="cupo"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-20"
                  value={formData.cupo === 0 ? "" : String(formData.cupo)}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "")
                    setFormData({
                      ...formData,
                      cupo: val === "" ? 0 : Math.min(20, parseInt(val)),
                    })
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Se ajusta automáticamente según el tipo seleccionado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripcion (opcional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Notas adicionales..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? "Guardando..."
                    : editingTitulo
                      ? "Guardar Cambios"
                      : "Crear Titulo"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Music className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.titulos.total}</p>
                  <p className="text-sm text-muted-foreground">Titulos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.eventos.total}</p>
                  <p className="text-sm text-muted-foreground">
                    Eventos ({stats.eventos.ensayos}E / {stats.eventos.funciones}F)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Hash className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.rotativos.totalDisponibles}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Rotativos Totales
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Users className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    ~{stats.rotativos.promedioPorintegrante}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Por Integrante
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Titulos Table */}
      <Card>
        <CardHeader>
          <CardTitle>Todos los Titulos ({titulos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : titulos.length === 0 ? (
            <div className="text-center py-8">
              <Music className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No hay titulos cargados para esta temporada
              </p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Primer Titulo
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Cupo</TableHead>
                  <TableHead className="text-center">Eventos</TableHead>
                  <TableHead className="text-center">Rotativos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {titulos.map((titulo) => (
                  <TableRow key={titulo.id}>
                    <TableCell className="font-medium">{titulo.name}</TableCell>
                    <TableCell>
                      <Badge className={TIPO_COLORS[titulo.type]}>
                        {TIPO_LABELS[titulo.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {titulo.cupo}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-muted-foreground">
                        {titulo.totalEnsayos}E / {titulo.totalFunciones}F
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {titulo.totalRotativos}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(titulo)}
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(titulo)}
                        >
                          <Trash2 className="w-3 h-3" />
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
