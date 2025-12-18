"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import Link from "next/link"
import {
  getArgentinaDateKey,
  formatFullDate,
  formatDayMonth,
} from "@/lib/date-utils"
import { es } from "date-fns/locale"
import { format } from "date-fns"

interface Solicitud {
  id: string
  fecha: string
  estado: string
  esCasoEspecial: boolean
  user: {
    id: string
    name: string
    alias: string | null
    avatar: string | null
  }
}

interface DescansosPorFecha {
  [fecha: string]: Solicitud[]
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [popoverFecha, setPopoverFecha] = useState<string | null>(null)
  const [verSoloMios, setVerSoloMios] = useState(true)

  // Filtrar solicitudes para la lista lateral
  const solicitudesFiltradas = verSoloMios
    ? solicitudes.filter((s) => s.user.id === session?.user?.id)
    : solicitudes

  const fetchSolicitudes = useCallback(async () => {
    setLoading(true)
    const mes = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`
    // todas=true para mostrar solicitudes de todos los integrantes en el calendario
    const res = await fetch(`/api/solicitudes?mes=${mes}&todas=true`)
    const data = await res.json()
    setSolicitudes(data)
    setLoading(false)
  }, [selectedMonth])

  useEffect(() => {
    fetchSolicitudes()
  }, [fetchSolicitudes])

  // Agrupar solicitudes por fecha (usando timezone de Argentina)
  const descansosPorFecha: DescansosPorFecha = solicitudes.reduce(
    (acc, sol) => {
      const fechaKey = getArgentinaDateKey(sol.fecha)
      if (!acc[fechaKey]) {
        acc[fechaKey] = []
      }
      acc[fechaKey].push(sol)
      return acc
    },
    {} as DescansosPorFecha
  )

  const getDescansosDelDia = (date: Date): Solicitud[] => {
    const fechaKey = getArgentinaDateKey(date)
    return descansosPorFecha[fechaKey] || []
  }

  const renderDay = (date: Date) => {
    const descansosDelDia = getDescansosDelDia(date)
    const fechaKey = getArgentinaDateKey(date)

    if (descansosDelDia.length === 0) {
      return <span>{date.getDate()}</span>
    }

    const aprobados = descansosDelDia.filter((d) => d.estado === "APROBADA")
    const pendientes = descansosDelDia.filter((d) => d.estado === "PENDIENTE")

    return (
      <Popover
        open={popoverFecha === fechaKey}
        onOpenChange={(open) => setPopoverFecha(open ? fechaKey : null)}
      >
        <PopoverTrigger asChild>
          <div className="relative w-full h-full flex flex-col items-center cursor-pointer py-1">
            <span className="font-medium text-sm md:text-base">{date.getDate()}</span>
            {/* Mobile: solo puntos */}
            <div className="flex gap-0.5 mt-1 md:hidden">
              {descansosDelDia.slice(0, 3).map((d, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${
                    d.estado === "APROBADA" ? "bg-green-500" : "bg-yellow-500"
                  }`}
                />
              ))}
              {descansosDelDia.length > 3 && (
                <span className="text-[8px] text-muted-foreground">+{descansosDelDia.length - 3}</span>
              )}
            </div>
            {/* Desktop: nombres con avatares */}
            <div className="hidden md:flex flex-col gap-0.5 mt-1 w-full px-0.5">
              {descansosDelDia.slice(0, 2).map((d, i) => (
                <div
                  key={i}
                  className={`text-[9px] leading-tight truncate px-1 py-0.5 rounded flex items-center gap-0.5 ${
                    d.estado === "APROBADA"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {d.user.avatar && <span className="text-[10px]">{d.user.avatar}</span>}
                  {d.user.alias || d.user.name.split(" ")[0]}
                </div>
              ))}
              {descansosDelDia.length > 2 && (
                <div className="text-[9px] text-muted-foreground text-center">
                  +{descansosDelDia.length - 2} más
                </div>
              )}
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4" align="center">
          <div className="space-y-3">
            <div>
              <p className="font-semibold">
                {formatFullDate(date)}
              </p>
              <p className="text-sm text-muted-foreground">
                {descansosDelDia.length} rotativo
                {descansosDelDia.length > 1 ? "s" : ""}
              </p>
            </div>

            {aprobados.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-700 mb-1">
                  Aprobados ({aprobados.length})
                </p>
                <div className="space-y-1">
                  {aprobados.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 text-sm bg-green-50 p-2 rounded"
                    >
                      {d.user.avatar ? (
                        <span className="text-lg flex-shrink-0">{d.user.avatar}</span>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {d.user.alias || d.user.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendientes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-yellow-700 mb-1">
                  Pendientes ({pendientes.length})
                </p>
                <div className="space-y-1">
                  {pendientes.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 text-sm bg-yellow-50 p-2 rounded"
                    >
                      {d.user.avatar ? (
                        <span className="text-lg flex-shrink-0">{d.user.avatar}</span>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {d.user.alias || d.user.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl md:text-2xl font-bold">Calendario de Rotativos</h1>
        <Link href="/solicitudes/nueva">
          <Button size="sm" className="w-full sm:w-auto">Solicitar Rotativo</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardContent className="p-2 md:p-6 pt-4 md:pt-6">
            <Calendar
              mode="multiple"
              selected={[]}
              month={selectedMonth}
              onMonthChange={setSelectedMonth}
              locale={es}
              formatters={{
                formatCaption: (date) => {
                  const month = format(date, "LLLL", { locale: es })
                  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`
                },
              }}
              className="rounded-md border w-full [--cell-size:theme(spacing.12)] md:[--cell-size:theme(spacing.20)]"
              components={{
                DayButton: ({ day, ...props }) => (
                  <button
                    {...props}
                    className={`${props.className} !h-auto min-h-12 md:min-h-20 w-full`}
                  >
                    {renderDay(day.date)}
                  </button>
                ),
              }}
            />
            <div className="flex gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
                <span>Aprobado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
                <span>Pendiente</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rotativos del Mes</CardTitle>
            <div className="flex gap-1 mt-2">
              <Button
                variant={verSoloMios ? "default" : "outline"}
                size="sm"
                onClick={() => setVerSoloMios(true)}
              >
                Mis rotativos
              </Button>
              <Button
                variant={!verSoloMios ? "default" : "outline"}
                size="sm"
                onClick={() => setVerSoloMios(false)}
              >
                Todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : solicitudesFiltradas.length === 0 ? (
              <p className="text-gray-500">
                {verSoloMios
                  ? "No tienes rotativos este mes"
                  : "No hay rotativos este mes"}
              </p>
            ) : (
              <ul className="space-y-3 max-h-[500px] overflow-y-auto">
                {solicitudesFiltradas.map((s) => (
                  <li
                    key={s.id}
                    className="flex justify-between items-center p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      {s.user.avatar && (
                        <span className="text-lg">{s.user.avatar}</span>
                      )}
                      <div>
                        <p className="font-medium">{formatDayMonth(s.fecha)}</p>
                        <p className="text-sm text-gray-500">
                          {s.user.alias || s.user.name}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        s.estado === "APROBADA"
                          ? "default"
                          : s.estado === "PENDIENTE"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {s.estado}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
