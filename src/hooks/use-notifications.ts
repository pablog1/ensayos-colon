"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"

interface NotificationCounts {
  pendingRequests: number  // For admins: pending rotativos to approve
  userNotifications: number  // For all users: unread notifications
  loading: boolean
}

export function useNotifications(): NotificationCounts {
  const { data: session } = useSession()
  const [pendingRequests, setPendingRequests] = useState(0)
  const [userNotifications, setUserNotifications] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchCounts = useCallback(async () => {
    if (!session?.user) {
      setLoading(false)
      return
    }

    try {
      // Fetch pending requests (for admins)
      if (session.user.role === "ADMIN") {
        const res = await fetch("/api/solicitudes")
        if (res.ok) {
          const data = await res.json()
          // Count pending requests
          const pending = data.filter(
            (s: { estado: string }) => s.estado === "PENDIENTE"
          ).length
          setPendingRequests(pending)
        }
      }

      // Fetch user notifications (for all users)
      const notifRes = await fetch("/api/notifications")
      if (notifRes.ok) {
        const data = await notifRes.json()
        setUserNotifications(data.unreadCount || 0)
      }
    } catch (error) {
      console.error("Error fetching notification counts:", error)
    } finally {
      setLoading(false)
    }
  }, [session?.user, session?.user?.role])

  useEffect(() => {
    fetchCounts()
    // Refresh every 30 seconds
    const interval = setInterval(fetchCounts, 30000)

    // Listen for custom event when notifications are read
    const handleNotificationsRead = () => {
      fetchCounts()
    }
    window.addEventListener("notificationsRead", handleNotificationsRead)

    return () => {
      clearInterval(interval)
      window.removeEventListener("notificationsRead", handleNotificationsRead)
    }
  }, [fetchCounts])

  return {
    pendingRequests,
    userNotifications,
    loading,
  }
}
