"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Users, UserPlus, Shield, User, Pencil, Key, Eye, EyeOff, MoreVertical, Trash2 } from "lucide-react"

interface Integrante {
  id: string
  email: string
  name: string
  alias?: string
  role: "ADMIN" | "INTEGRANTE"
  joinDate?: string
  createdAt: string
  _count: {
    solicitudes: number
  }
}

export default function IntegrantesPage() {
  const { data: session } = useSession()
  const [integrantes, setIntegrantes] = useState<Integrante[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Integrante | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "INTEGRANTE" as "ADMIN" | "INTEGRANTE",
    joinDate: "",
  })
  const [editFormData, setEditFormData] = useState({
    role: "INTEGRANTE" as "ADMIN" | "INTEGRANTE",
  })
  const [submitting, setSubmitting] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [passwordUser, setPasswordUser] = useState<Integrante | null>(null)
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  })
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false,
  })

  useEffect(() => {
    fetchIntegrantes()
  }, [])

  const fetchIntegrantes = async () => {
    const res = await fetch("/api/integrantes")
    const data = await res.json()
    setIntegrantes(data)
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const res = await fetch("/api/integrantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })

    if (res.ok) {
      toast.success("Usuario creado exitosamente")
      setDialogOpen(false)
      setFormData({ name: "", email: "", password: "", role: "INTEGRANTE", joinDate: "" })
      fetchIntegrantes()
    } else {
      const error = await res.json()
      toast.error(error.error)
    }

    setSubmitting(false)
  }

  const handleDelete = async (id: string, name: string) => {
    // No permitir eliminar al usuario actual
    if (id === session?.user?.id) {
      toast.error("No podés eliminarte a vos mismo")
      return
    }

    if (
      !confirm(
        `¿Estás seguro de eliminar a ${name}? Se eliminarán todas sus solicitudes.`
      )
    )
      return

    const res = await fetch(`/api/integrantes/${id}`, {
      method: "DELETE",
    })

    if (res.ok) {
      toast.success("Usuario eliminado")
      fetchIntegrantes()
    } else {
      const error = await res.json()
      toast.error(error.error)
    }
  }

  const openEditDialog = (user: Integrante) => {
    setEditingUser(user)
    setEditFormData({ role: user.role })
    setEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setSubmitting(true)

    const res = await fetch(`/api/integrantes/${editingUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: editFormData.role }),
    })

    if (res.ok) {
      toast.success("Rol actualizado exitosamente")
      setEditDialogOpen(false)
      setEditingUser(null)
      fetchIntegrantes()
    } else {
      const error = await res.json()
      toast.error(error.error)
    }

    setSubmitting(false)
  }

  const openPasswordDialog = (user: Integrante) => {
    setPasswordUser(user)
    setPasswordData({ newPassword: "", confirmPassword: "" })
    setShowPasswords({ new: false, confirm: false })
    setPasswordDialogOpen(true)
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordUser) return

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Las contraseñas no coinciden")
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres")
      return
    }

    setSubmitting(true)

    const res = await fetch(`/api/integrantes/${passwordUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordData.newPassword }),
    })

    if (res.ok) {
      toast.success("Contraseña reseteada exitosamente")
      setPasswordDialogOpen(false)
      setPasswordUser(null)
      setPasswordData({ newPassword: "", confirmPassword: "" })
    } else {
      const error = await res.json()
      toast.error(error.error)
    }

    setSubmitting(false)
  }

  const admins = integrantes.filter((i) => i.role === "ADMIN")
  const miembros = integrantes.filter((i) => i.role === "INTEGRANTE")

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Usuarios</h1>
            <p className="text-muted-foreground">
              Administradores e integrantes del sistema
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Agregar Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Usuario</DialogTitle>
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
                  placeholder="Nombre completo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="correo@ejemplo.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: "ADMIN" | "INTEGRANTE") =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTEGRANTE">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Integrante
                      </div>
                    </SelectItem>
                    <SelectItem value="ADMIN">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Administrador
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Los administradores pueden gestionar usuarios, aprobar solicitudes y configurar reglas.
                </p>
              </div>
              {formData.role === "INTEGRANTE" && (
                <div className="space-y-2">
                  <Label htmlFor="joinDate">Fecha de inicio de actividad</Label>
                  <Input
                    id="joinDate"
                    type="date"
                    value={formData.joinDate}
                    onChange={(e) =>
                      setFormData({ ...formData, joinDate: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    El sistema calculará automáticamente los rotativos asignados en base a esta fecha.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creando..." : "Crear Usuario"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg shrink-0">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">{admins.length}</p>
                <p className="text-sm text-muted-foreground truncate">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">{miembros.length}</p>
                <p className="text-sm text-muted-foreground truncate">Integrantes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos los usuarios ({integrantes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : integrantes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay usuarios registrados
            </p>
          ) : (
            <div className="space-y-3">
              {integrantes.map((i) => {
                const isCurrentUser = i.id === session?.user?.id

                return (
                  <div
                    key={i.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    {/* Header: Nombre y Rol */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{i.name}</span>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Vos
                          </Badge>
                        )}
                      </div>
                      {i.role === "ADMIN" ? (
                        <Badge className="bg-purple-100 text-purple-800 shrink-0">
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          <User className="w-3 h-3 mr-1" />
                          Integrante
                        </Badge>
                      )}
                    </div>

                    {/* Info */}
                    <div className="text-sm text-muted-foreground truncate">
                      {i.email}
                    </div>

                    {/* Stats */}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Registro: </span>
                      <span>{new Date(i.createdAt).toLocaleDateString("es-ES")}</span>
                    </div>

                    {/* Acciones */}
                    {!isCurrentUser && (
                      <div className="pt-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                              <span className="ml-1">Acciones</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => openEditDialog(i)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar rol
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPasswordDialog(i)}>
                              <Key className="w-4 h-4 mr-2" />
                              Resetear contraseña
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(i.id, i.name)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para editar rol */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Rol de Usuario</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Usuario</Label>
                <p className="text-sm font-medium">{editingUser.name}</p>
                <p className="text-xs text-muted-foreground">{editingUser.email}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editRole">Rol</Label>
                <Select
                  value={editFormData.role}
                  onValueChange={(value: "ADMIN" | "INTEGRANTE") =>
                    setEditFormData({ ...editFormData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTEGRANTE">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Integrante
                      </div>
                    </SelectItem>
                    <SelectItem value="ADMIN">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Administrador
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Los administradores pueden gestionar usuarios, aprobar solicitudes y configurar reglas.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting || editFormData.role === editingUser.role}>
                  {submitting ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para resetear contraseña */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetear Contraseña</DialogTitle>
          </DialogHeader>
          {passwordUser && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label>Usuario</Label>
                <p className="text-sm font-medium">{passwordUser.name}</p>
                <p className="text-xs text-muted-foreground">{passwordUser.email}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPasswordReset">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="newPasswordReset"
                    type={showPasswords.new ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPasswordReset">Confirmar contraseña</Label>
                <div className="relative">
                  <Input
                    id="confirmPasswordReset"
                    type={showPasswords.confirm ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    placeholder="Repetir contraseña"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Deberás comunicar la nueva contraseña al usuario fuera del sistema.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPasswordDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Reseteando..." : "Resetear Contraseña"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
