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
import { Bell, Check, CheckCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  data?: Record<string, unknown>
}

interface NotificationPanelProps {
  unreadCount: number
}

export function NotificationPanel({ unreadCount }: NotificationPanelProps) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notifications?limit=50")
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
      toast.error("Error al cargar notificaciones")
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
      })
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        )
        // Emit custom event to trigger hook refresh
        window.dispatchEvent(new CustomEvent("notificationsRead"))
      }
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
      })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        // Emit custom event to trigger hook refresh
        window.dispatchEvent(new CustomEvent("notificationsRead"))
        toast.success("Todas las notificaciones marcadas como leídas")
      }
    } catch (error) {
      console.error("Error marking all as read:", error)
      toast.error("Error al marcar notificaciones como leídas")
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "ROTATIVO_APROBADO":
        return "✅"
      case "ROTATIVO_RECHAZADO":
        return "❌"
      case "LISTA_ESPERA_CUPO":
        return "🎉"
      case "ROTACION_OBLIGATORIA":
        return "⚠️"
      case "ALERTA_CERCANIA_MAXIMO":
        return "📊"
      case "BLOQUE_APROBADO":
        return "📅"
      case "LICENCIA_REGISTRADA":
        return "🏥"
      default:
        return "ℹ️"
    }
  }

  if (!session?.user) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors">
          <Bell className="w-5 h-5 text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Notificaciones</DialogTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                Marcar todas como leídas
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 -mx-6 px-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Cargando...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">No tienes notificaciones</p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 rounded-lg border transition-colors",
                    notification.read
                      ? "bg-background border-border"
                      : "bg-[var(--gold)]/5 border-[var(--gold)]/20"
                  )}
                >
                  <div className="flex gap-3">
                    <div className="text-2xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm">
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                            title="Marcar como leída"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
