"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface DebugDateContextType {
  debugDate: Date
  setDebugDate: (date: Date) => void
  isDebugMode: boolean
}

const DebugDateContext = createContext<DebugDateContextType | undefined>(undefined)

export function DebugDateProvider({ children }: { children: ReactNode }) {
  const [debugDate, setDebugDate] = useState<Date>(new Date())

  // Solo activar modo debug si la fecha es diferente a hoy
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const debugDateNormalized = new Date(debugDate)
  debugDateNormalized.setHours(0, 0, 0, 0)
  const isDebugMode = debugDateNormalized.getTime() !== today.getTime()

  return (
    <DebugDateContext.Provider value={{ debugDate, setDebugDate, isDebugMode }}>
      {children}
    </DebugDateContext.Provider>
  )
}

export function useDebugDate() {
  const context = useContext(DebugDateContext)
  if (context === undefined) {
    throw new Error("useDebugDate must be used within a DebugDateProvider")
  }
  return context
}
