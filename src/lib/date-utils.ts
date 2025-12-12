import { format as dateFnsFormat } from "date-fns"
import { es } from "date-fns/locale"
import { toZonedTime, format as tzFormat } from "date-fns-tz"

export const TIMEZONE = "America/Argentina/Buenos_Aires"

/**
 * Convierte una fecha a la zona horaria de Argentina
 */
export function toArgentinaTime(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date
  return toZonedTime(d, TIMEZONE)
}

/**
 * Formatea una fecha en la zona horaria de Argentina
 */
export function formatInArgentina(
  date: Date | string,
  formatStr: string
): string {
  const d = typeof date === "string" ? new Date(date) : date
  return tzFormat(d, formatStr, { timeZone: TIMEZONE, locale: es })
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
