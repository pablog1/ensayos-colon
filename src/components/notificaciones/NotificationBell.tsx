"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  data?: Record<string, unknown>
}

const typeColors: Record<string, string> = {
  ROTATIVO_APROBADO: "bg-green-100 text-green-800",
  ROTATIVO_RECHAZADO: "bg-red-100 text-red-800",
  LISTA_ESPERA_CUPO: "bg-blue-100 text-blue-800",
  ROTACION_OBLIGATORIA: "bg-orange-100 text-orange-800",
  ALERTA_CERCANIA_MAXIMO: "bg-yellow-100 text-yellow-800",
  CONSENSO_PENDIENTE: "bg-purple-100 text-purple-800",
  BLOQUE_APROBADO: "bg-green-100 text-green-800",
  LICENCIA_REGISTRADA: "bg-gray-100 text-gray-800",
  SISTEMA: "bg-gray-100 text-gray-800",
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchNotifications()

    // Polling cada 30 segundos
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notificaciones?limit=10")
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error("Error cargando notificaciones:", error)
    }
  }

  async function markAsRead(id: string) {
    try {
      await fetch(`/api/notificaciones/${id}/leer`, { method: "POST" })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error("Error marcando como leída:", error)
    }
  }

  async function markAllAsRead() {
    setLoading(true)
    try {
      await fetch("/api/notificaciones/leer-todas", { method: "POST" })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error("Error marcando todas como leídas:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">Notificaciones</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={loading}
            >
              Marcar todas leídas
            </Button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No hay notificaciones
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${
                  !notification.read ? "bg-blue-50" : ""
                }`}
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        className={`text-xs ${typeColors[notification.type] || ""}`}
                        variant="secondary"
                      >
                        {notification.type.replace(/_/g, " ")}
                      </Badge>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                    <p className="font-medium text-sm truncate">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setOpen(false)
                window.location.href = "/notificaciones"
              }}
            >
              Ver todas
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
