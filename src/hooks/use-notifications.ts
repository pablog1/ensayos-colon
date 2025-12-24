"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"

interface NotificationCounts {
  pendingRequests: number  // For admins: pending rotativos to approve
  loading: boolean
}

export function useNotifications(): NotificationCounts {
  const { data: session } = useSession()
  const [pendingRequests, setPendingRequests] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchCounts = useCallback(async () => {
    if (!session?.user) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/solicitudes")
      if (res.ok) {
        const data = await res.json()
        // Count pending requests
        const pending = data.filter(
          (s: { estado: string }) => s.estado === "PENDIENTE"
        ).length
        setPendingRequests(pending)
      }
    } catch (error) {
      console.error("Error fetching notification counts:", error)
    } finally {
      setLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    fetchCounts()
    // Refresh every 30 seconds
    const interval = setInterval(fetchCounts, 30000)
    return () => clearInterval(interval)
  }, [fetchCounts])

  return {
    pendingRequests,
    loading,
  }
}
