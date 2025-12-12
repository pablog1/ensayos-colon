"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"
import {
  getArgentinaDateKey,
  formatFullDate,
} from "@/lib/date-utils"

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
  motivo: string | null
}

type DescansosCalendario = Record<string, DescansoInfo[]>

export default function NuevaSolicitudPage() {
  const router = useRouter()
  const [fecha, setFecha] = useState<Date | undefined>()
  const [motivo, setMotivo] = useState("")
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
      toast.error("Selecciona una fecha")
      return
    }

    setLoading(true)

    const res = await fetch("/api/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha: fecha.toISOString().split("T")[0],
        motivo: motivo || null,
      }),
    })

    const data = await res.json()

    if (res.ok) {
      if (data.validacion.esCasoEspecial) {
        toast.warning(
          "Solicitud creada como caso especial. Requiere aprobacion del admin."
        )
      } else {
        toast.success("Solicitud aprobada automaticamente")
      }
      router.push("/solicitudes")
    } else {
      toast.error(data.error)
    }

    setLoading(false)
  }

  const superaLimite = stats?.personal && !stats.personal.puedesolicitarMas

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
              {cantidadDescansos} descanso{cantidadDescansos > 1 ? "s" : ""}
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
                    {d.motivo && (
                      <p className="text-xs text-muted-foreground truncate">
                        {d.motivo}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Solicitar Descanso</h1>

      {stats?.personal && stats?.grupo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tu situacion actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <span className="font-medium">Descansos aprobados este mes:</span>{" "}
              {stats.personal.descansosAprobados}
            </p>
            <p>
              <span className="font-medium">Promedio del grupo:</span>{" "}
              {stats.grupo.promedioDescansos}
            </p>
            <p>
              <span className="font-medium">Limite maximo (promedio + 5%):</span>{" "}
              {stats.grupo.limiteMaximo}
            </p>
            <p>
              <span className="font-medium">Tu porcentaje vs promedio:</span>{" "}
              <span
                className={
                  stats.personal.porcentajeVsPromedio > 0
                    ? "text-red-600"
                    : "text-green-600"
                }
              >
                {stats.personal.porcentajeVsPromedio > 0 ? "+" : ""}
                {stats.personal.porcentajeVsPromedio}%
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {superaLimite && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-800">
            <strong>Atencion:</strong> Ya has alcanzado el limite del 5% sobre
            el promedio. Tu proxima solicitud sera marcada como{" "}
            <strong>caso especial</strong> y requerira aprobacion del
            administrador.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nueva Solicitud</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Fecha del descanso</Label>
              <p className="text-xs text-muted-foreground">
                Los puntos indican descansos de otros integrantes (verde =
                aprobado, amarillo = pendiente)
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

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo (opcional)</Label>
              <Input
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Cita medica"
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading || !fecha}>
                {loading ? "Enviando..." : "Solicitar"}
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
