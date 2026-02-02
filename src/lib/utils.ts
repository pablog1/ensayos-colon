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
 * NOTA: Para fechas que vienen de la BD como @db.Date (medianoche UTC),
 * extraemos los componentes UTC para evitar desfase de día por timezone.
 */
export function formatDateLongAR(date: Date): string {
  // Extraer componentes UTC para evitar que medianoche UTC se convierta al día anterior
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()

  // Crear fecha a mediodía para formatear sin problemas de timezone
  const safeDate = new Date(year, month, day, 12, 0, 0)

  return safeDate.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

/**
 * Formatea una fecha corta en zona horaria Argentina (ej: "15/01")
 * NOTA: Para fechas que vienen de la BD como @db.Date, usa componentes UTC.
 */
export function formatDateShortAR(date: Date): string {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const safeDate = new Date(year, month, day, 12, 0, 0)

  return safeDate.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  })
}

/**
 * Formatea una fecha en zona horaria Argentina (ej: "lun 15 ene")
 * NOTA: Para fechas que vienen de la BD como @db.Date, usa componentes UTC.
 */
export function formatDateMediumAR(date: Date): string {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const safeDate = new Date(year, month, day, 12, 0, 0)

  return safeDate.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/**
 * Formatea una fecha simple en zona horaria Argentina (ej: "15/1/2024")
 * NOTA: Para fechas que vienen de la BD como @db.Date, usa componentes UTC.
 */
export function formatDateAR(date: Date): string {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const safeDate = new Date(year, month, day, 12, 0, 0)

  return safeDate.toLocaleDateString("es-AR")
}
