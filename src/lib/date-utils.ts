import { format as dateFnsFormat } from "date-fns"
import { es } from "date-fns/locale"
import { toZonedTime, format as tzFormat } from "date-fns-tz"

export const TIMEZONE = "America/Argentina/Buenos_Aires"

/**
 * Convierte una fecha a la zona horaria de Argentina
 * Para strings de solo fecha (YYYY-MM-DD), agrega T12:00:00 para evitar
 * problemas de timezone donde el día podría cambiar
 */
export function toArgentinaTime(date: Date | string): Date {
  let d: Date
  if (typeof date === "string") {
    // Si es solo fecha (YYYY-MM-DD), agregar T12:00:00 para evitar desfase de día
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      d = new Date(date + "T12:00:00")
    } else {
      d = new Date(date)
    }
  } else {
    d = date
  }
  return toZonedTime(d, TIMEZONE)
}

/**
 * Formatea una fecha en la zona horaria de Argentina
 * Para strings de solo fecha (YYYY-MM-DD), los parseamos como fecha en Argentina
 */
export function formatInArgentina(
  date: Date | string,
  formatStr: string
): string {
  if (typeof date === "string") {
    // Si es solo fecha (YYYY-MM-DD), parsear los componentes directamente
    // y formatear sin conversión de timezone
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split("-").map(Number)
      // Crear fecha usando UTC para evitar cualquier conversión de timezone
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
      return tzFormat(d, formatStr, { timeZone: "UTC", locale: es })
    }
    return tzFormat(new Date(date), formatStr, { timeZone: TIMEZONE, locale: es })
  }
  return tzFormat(date, formatStr, { timeZone: TIMEZONE, locale: es })
}

/**
 * Obtiene la fecha (YYYY-MM-DD) en zona horaria de Argentina
 */
export function getArgentinaDateKey(date: Date | string): string {
  return formatInArgentina(date, "yyyy-MM-dd")
}

/**
 * Formatea una fecha para mostrar día y mes en español
 */
export function formatDayMonth(date: Date | string): string {
  return formatInArgentina(date, "d MMM")
}

/**
 * Formatea una fecha completa en español
 */
export function formatFullDate(date: Date | string): string {
  return formatInArgentina(date, "EEEE d 'de' MMMM")
}

/**
 * Obtiene el día del mes en zona horaria de Argentina
 */
export function getArgentinaDay(date: Date | string): number {
  const argDate = toArgentinaTime(date)
  return argDate.getDate()
}

/**
 * Obtiene la fecha de hoy en Argentina (solo fecha, sin hora)
 */
export function getTodayInArgentina(): Date {
  const now = new Date()
  const argNow = toArgentinaTime(now)
  return new Date(argNow.getFullYear(), argNow.getMonth(), argNow.getDate())
}
