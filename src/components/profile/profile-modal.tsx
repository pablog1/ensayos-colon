"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { User } from "lucide-react"
import { cn } from "@/lib/utils"

const AVATARS = [
  "🎻", "🎺", "🎷", "🎸", "🎹", "🥁",
  "🎵", "🎶", "🎼", "🪕", "🪗", "🪘",
]

interface ProfileData {
  alias: string | null
  avatar: string | null
}

export function ProfileModal() {
  const { data: session, update } = useSession()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({
    alias: "",
    avatar: null,
  })

  useEffect(() => {
    if (open) {
      fetchProfile()
    }
  }, [open])

  const fetchProfile = async () => {
    const res = await fetch("/api/user/profile")
    const data = await res.json()
    if (data.user) {
      setProfile({
        alias: data.user.alias || "",
        avatar: data.user.avatar || null,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error)
      }

      await update()
      toast.success("Perfil actualizado correctamente")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar perfil")
    } finally {
      setLoading(false)
    }
  }

  const userName = session?.user?.name?.split(" ")[0] || "Usuario"
  const userAlias = session?.user?.alias
  const displayAvatar = session?.user?.avatar
  const roleLabel = session?.user?.role === "ADMIN" ? "Admin" : "Integrante"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
            {displayAvatar ? (
              <span className="text-lg">{displayAvatar}</span>
            ) : (
              <User className="w-4 h-4 text-[var(--burgundy)]" />
            )}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-white/90">
              {userName}{userAlias && <span className="text-white/60"> ({userAlias})</span>}
            </p>
            <p className="text-[10px] text-[var(--gold)]">{roleLabel}</p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mi Perfil</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="alias">Alias (nombre corto)</Label>
            <Input
              id="alias"
              value={profile.alias || ""}
              onChange={(e) => setProfile({ ...profile, alias: e.target.value })}
              placeholder="Ej: Mari, Juan, Pete..."
              maxLength={15}
            />
            <p className="text-xs text-muted-foreground">
              Se mostrará en el calendario en lugar de tu nombre completo
            </p>
          </div>

          <div className="space-y-2">
            <Label>Avatar</Label>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  onClick={() => setProfile({ ...profile, avatar })}
                  className={cn(
                    "text-2xl p-2 rounded-lg border-2 transition-all hover:scale-110",
                    profile.avatar === avatar
                      ? "border-[var(--gold)] bg-[var(--gold)]/10"
                      : "border-transparent hover:border-gray-300"
                  )}
                >
                  {avatar}
                </button>
              ))}
            </div>
            {profile.avatar && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setProfile({ ...profile, avatar: null })}
              >
                Quitar avatar
              </Button>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
