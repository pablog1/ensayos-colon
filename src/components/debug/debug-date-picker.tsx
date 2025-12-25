"use client"

import { useDebugDate } from "@/contexts/debug-date-context"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Bug } from "lucide-react"

export function DebugDatePicker() {
  const { debugDate, setDebugDate, isDebugMode } = useDebugDate()

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value + "T12:00:00")
    setDebugDate(newDate)
  }

  const resetToToday = () => {
    setDebugDate(new Date())
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Bug className={`h-4 w-4 ${isDebugMode ? "text-yellow-400" : "text-gray-400"}`} />
        <span className="text-xs text-gray-300 hidden lg:inline">Fecha:</span>
      </div>
      <input
        type="date"
        value={format(debugDate, "yyyy-MM-dd")}
        onChange={handleDateChange}
        className={`
          text-xs px-2 py-1 rounded border
          ${isDebugMode
            ? "bg-yellow-900/50 border-yellow-500 text-yellow-100"
            : "bg-white/10 border-white/20 text-white"
          }
          focus:outline-none focus:ring-1 focus:ring-[var(--gold)]
        `}
        title={`Fecha de debug: ${format(debugDate, "EEEE d 'de' MMMM yyyy", { locale: es })}`}
      />
      {isDebugMode && (
        <button
          onClick={resetToToday}
          className="text-xs text-yellow-400 hover:text-yellow-300 underline"
          title="Volver a la fecha real"
        >
          Reset
        </button>
      )}
    </div>
  )
}
