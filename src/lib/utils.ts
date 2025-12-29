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
