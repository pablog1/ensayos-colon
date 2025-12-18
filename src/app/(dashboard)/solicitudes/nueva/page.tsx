"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  getArgentinaDateKey,
  formatFullDate,
} from "@/lib/date-utils"
import { CalendarPlus, Info } from "lucide-react"

interface Stats {
  personal: {
    descansosAprobados: number
    porcentajeVsPromedio: number
    puedesolicitarMas: boolean
    descansosRestantesPermitidos: number
  }
  grupo: {
    promedioDescansos: number
    limiteMaximo: number
  }
}

interface DescansoInfo {
  id: string
  userName: string
  estado: string
}

type DescansosCalendario = Record<string, DescansoInfo[]>

export default function NuevaSolicitudPage() {
  const router = useRouter()
  const [fecha, setFecha] = useState<Date | undefined>()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [mesActual, setMesActual] = useState(new Date())
  const [descansos, setDescansos] = useState<DescansosCalendario>({})
  const [popoverFecha, setPopoverFecha] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchDescansos = useCallback(async (mes: Date) => {
    const mesStr = format(mes, "yyyy-MM")
    const res = await fetch(`/api/solicitudes/calendario?mes=${mesStr}`)
    if (res.ok) {
      const data = await res.json()
      setDescansos(data)
    }
  }, [])

  useEffect(() => {
    fetchDescansos(mesActual)
  }, [mesActual, fetchDescansos])

  const fetchStats = async () => {
    const res = await fetch("/api/estadisticas")
    const data = await res.json()
    setStats(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fecha) {
      toast.error("Seleccioná una fecha")
      return
    }

    setLoading(true)

    const res = await fetch("/api/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha: fecha.toISOString().split("T")[0],
      }),
    })

    const data = await res.json()

    if (res.ok) {
      if (data.validacion.esCasoEspecial) {
        toast.warning(
          "Solicitud creada. Requiere aprobación del administrador."
        )
      } else {
        toast.success("¡Rotativo aprobado!")
      }
      router.push("/solicitudes")
    } else {
      toast.error(data.error)
    }

    setLoading(false)
  }

  const noPuedesSolicitar = stats?.personal && !stats.personal.puedesolicitarMas

  const getDescansosDelDia = (date: Date): DescansoInfo[] => {
    const fechaKey = getArgentinaDateKey(date)
    return descansos[fechaKey] || []
  }

  const isSelected = (date: Date): boolean => {
    if (!fecha) return false
    return (
      fecha.getDate() === date.getDate() &&
      fecha.getMonth() === date.getMonth() &&
      fecha.getFullYear() === date.getFullYear()
    )
  }

  const renderDay = (date: Date) => {
    const descansosDelDia = getDescansosDelDia(date)
    const fechaKey = getArgentinaDateKey(date)
    const cantidadDescansos = descansosDelDia.length
    const selected = isSelected(date)

    if (cantidadDescansos === 0) {
      return (
        <span
          className={
            selected
              ? "flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground"
              : ""
          }
        >
          {date.getDate()}
        </span>
      )
    }

    return (
      <Popover
        open={popoverFecha === fechaKey}
        onOpenChange={(open) => setPopoverFecha(open ? fechaKey : null)}
      >
        <PopoverTrigger asChild>
          <div
            className={`relative w-full h-full flex flex-col items-center justify-center cursor-pointer rounded-md ${
              selected ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            <span>{date.getDate()}</span>
            <div className="flex gap-0.5 mt-0.5">
              {cantidadDescansos <= 3 ? (
                descansosDelDia.map((d, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${
                      d.estado === "APROBADA" ? "bg-green-500" : "bg-yellow-500"
                    }`}
                  />
                ))
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] text-muted-foreground">
                    +{cantidadDescansos - 1}
                  </span>
                </>
              )}
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="center">
          <div className="space-y-2">
            <p className="font-medium text-sm">
              {formatFullDate(date)}
            </p>
            <p className="text-xs text-muted-foreground">
              {cantidadDescansos} rotativo{cantidadDescansos > 1 ? "s" : ""}
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {descansosDelDia.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 text-sm py-1 border-b last:border-0"
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      d.estado === "APROBADA" ? "bg-green-500" : "bg-yellow-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d.userName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Calcular progreso
  const maxAnual = 50
  const tomados = stats?.personal?.descansosAprobados || 0
  const disponibles = stats?.personal?.descansosRestantesPermitidos || 0
  const progreso = Math.min(100, (tomados / maxAnual) * 100)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <CalendarPlus className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Solicitar Rotativo</h1>
          <p className="text-muted-foreground">
            Elegí la fecha y enviá tu solicitud
          </p>
        </div>
      </div>

      {/* Resumen de estado */}
      {stats?.personal && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Progreso visual */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tu progreso anual</span>
                  <span className="font-medium">{tomados} de ~{maxAnual}</span>
                </div>
                <Progress value={progreso} className="h-2" />
              </div>

              {/* Números clave */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{tomados}</div>
                  <div className="text-xs text-muted-foreground">Tomados</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{disponibles}</div>
                  <div className="text-xs text-green-600">Disponibles</div>
                </div>
              </div>

              {/* Estado */}
              {noPuedesSolicitar ? (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg text-sm">
                  <Info className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                  <div className="text-yellow-800">
                    <strong>Alcanzaste tu límite anual.</strong> Podés seguir solicitando, pero requerirá aprobación del administrador.
                  </div>
                </div>
              ) : (
                <Badge className="bg-green-100 text-green-800">
                  Podés solicitar rotativos
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Elegí la fecha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Aprobado
                <span className="w-2 h-2 rounded-full bg-yellow-500 ml-2"></span>
                Pendiente
              </p>
              <Calendar
                mode="single"
                selected={fecha}
                onSelect={setFecha}
                month={mesActual}
                onMonthChange={setMesActual}
                disabled={(date) => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  return date < today
                }}
                className="rounded-md border"
                components={{
                  DayButton: ({ day, ...props }) => (
                    <button
                      {...props}
                      className={`${props.className} relative`}
                    >
                      {renderDay(day.date)}
                    </button>
                  ),
                }}
              />
            </div>

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={loading || !fecha}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? "Enviando..." : "Solicitar rotativo"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
