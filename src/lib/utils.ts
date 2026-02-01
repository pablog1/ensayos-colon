import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper para parsear fechas sin desfase de timezone
export function parseDateSafe(dateString: string): Date {
  // Si es ISO string completo, extraer solo la parte de fecha
  const dateOnly = dateString.includes("T") ? dateString.split("T")[0] : dateString
  const [year, month, day] = dateOnly.split("-").map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

// Zona horaria de Argentina
const TIMEZONE_AR = "America/Buenos_Aires"

/**
 * Formatea una hora en zona horaria Argentina (HH:mm)
 */
export function formatTimeAR(date: Date | null | undefined): string | null {
  if (!date) return null
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE_AR,
  })
}

/**
 * Formatea una fecha larga en zona horaria Argentina (ej: "lunes 15 de enero")
 */
export function formatDateLongAR(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIMEZONE_AR,
  })
}

/**
 * Formatea una fecha corta en zona horaria Argentina (ej: "15/01")
 */
export function formatDateShortAR(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TIMEZONE_AR,
  })
}

/**
 * Formatea una fecha en zona horaria Argentina (ej: "lun 15 ene")
 */
export function formatDateMediumAR(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TIMEZONE_AR,
  })
}

/**
 * Formatea una fecha simple en zona horaria Argentina (ej: "15/1/2024")
 */
export function formatDateAR(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    timeZone: TIMEZONE_AR,
  })
}
