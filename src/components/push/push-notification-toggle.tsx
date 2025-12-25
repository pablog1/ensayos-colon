"use client"

import { useState, useEffect } from "react"
import { Bell, BellOff, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function PushNotificationToggle() {
  const [isSupported, setIsSupported] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isTesting, setIsTesting] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")

  useEffect(() => {
    // Verificar soporte
    const supported = "serviceWorker" in navigator && "PushManager" in window
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)
      checkSubscriptionStatus()
    } else {
      setIsLoading(false)
    }
  }, [])

  const checkSubscriptionStatus = async () => {
    try {
      const res = await fetch("/api/push/subscribe")
      if (res.ok) {
        const data = await res.json()
        setIsEnabled(data.enabled)
      }
    } catch (error) {
      console.error("Error verificando estado:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const registerServiceWorker = async () => {
    const registration = await navigator.serviceWorker.register("/sw.js")
    await navigator.serviceWorker.ready
    return registration
  }

  const subscribeToPush = async () => {
    setIsLoading(true)

    try {
      // Pedir permiso
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)

      if (permissionResult !== "granted") {
        toast.error("Necesitás permitir las notificaciones para activarlas")
        setIsLoading(false)
        return
      }

      // Registrar service worker
      const registration = await registerServiceWorker()

      // Obtener suscripción
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        throw new Error("VAPID key no configurada")
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      // Guardar en servidor
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      })

      if (res.ok) {
        setIsEnabled(true)
        toast.success("Notificaciones activadas")
      } else {
        throw new Error("Error al guardar suscripción")
      }
    } catch (error) {
      console.error("Error al suscribir:", error)
      toast.error("Error al activar notificaciones")
    } finally {
      setIsLoading(false)
    }
  }

  const unsubscribeFromPush = async () => {
    setIsLoading(true)

    try {
      // Desuscribir del servidor
      const res = await fetch("/api/push/subscribe", {
        method: "DELETE",
      })

      if (res.ok) {
        // Desuscribir del navegador
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
        }

        setIsEnabled(false)
        toast.success("Notificaciones desactivadas")
      } else {
        throw new Error("Error al desactivar")
      }
    } catch (error) {
      console.error("Error al desuscribir:", error)
      toast.error("Error al desactivar notificaciones")
    } finally {
      setIsLoading(false)
    }
  }

  const testPush = async () => {
    setIsTesting(true)

    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
      })

      if (res.ok) {
        toast.success("Notificación de prueba enviada")
      } else {
        const data = await res.json()
        toast.error(data.error || "Error al enviar prueba")
      }
    } catch (error) {
      console.error("Error al testear:", error)
      toast.error("Error al enviar notificación de prueba")
    } finally {
      setIsTesting(false)
    }
  }

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BellOff className="h-4 w-4" />
        <span>Tu navegador no soporta notificaciones</span>
      </div>
    )
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BellOff className="h-4 w-4" />
        <span>Notificaciones bloqueadas en tu navegador</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isEnabled ? "outline" : "default"}
        size="sm"
        onClick={isEnabled ? unsubscribeFromPush : subscribeToPush}
        disabled={isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isEnabled ? (
          <Bell className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
        {isLoading
          ? "Procesando..."
          : isEnabled
            ? "Activas"
            : "Activar"}
      </Button>
      {isEnabled && (
        <button
          onClick={testPush}
          disabled={isTesting}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          {isTesting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          Probar
        </button>
      )}
    </div>
  )
}

// Helper para convertir VAPID key
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}
