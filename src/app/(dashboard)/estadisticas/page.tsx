"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BarChart3, Users, Calendar, Clock } from "lucide-react"

interface Stats {
  mes: string
  totalIntegrantes: number
  promedioDescansos: number
  limiteMaximo: number
  solicitudesPendientes: number
  integrantes: {
    id: string
    nombre: string
    email: string
    descansosAprobados: number
    porcentajeVsPromedio: number
    puedesolicitarMas: boolean
  }[]
  // Solo para integrantes (no admin)
  currentUserId?: string
  personal?: {
    descansosAprobados: number
    porcentajeVsPromedio: number
    puedesolicitarMas: boolean
    descansosRestantesPermitidos: number
  }
  grupo?: {
    promedioDescansos: number
    limiteMaximo: number
  }
}

export default function EstadisticasPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  useEffect(() => {
    fetchStats()
  }, [selectedMonth])

  const fetchStats = async () => {
    setLoading(true)
    const res = await fetch(`/api/estadisticas?mes=${selectedMonth}`)
    const data = await res.json()
    setStats(data)
    setLoading(false)
  }

  // Generar meses: 12 meses hacia atrás + todos los meses hasta diciembre 2026
  const months = (() => {
    const result: { value: string; label: string }[] = []
    const now = new Date()

    // Meses futuros hasta diciembre 2026
    const endDate = new Date(2026, 11) // Diciembre 2026
    const futureDate = new Date(now.getFullYear(), now.getMonth())
    while (futureDate <= endDate) {
      result.push({
        value: `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`,
        label: futureDate.toLocaleDateString("es-ES", {
          month: "long",
          year: "numeric",
        }),
      })
      futureDate.setMonth(futureDate.getMonth() + 1)
    }

    // Meses pasados (12 meses hacia atrás desde el mes anterior al actual)
    const pastDate = new Date(now.getFullYear(), now.getMonth() - 1)
    for (let i = 0; i < 12; i++) {
      result.push({
        value: `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, "0")}`,
        label: pastDate.toLocaleDateString("es-ES", {
          month: "long",
          year: "numeric",
        }),
      })
      pastDate.setMonth(pastDate.getMonth() - 1)
    }

    return result
  })()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Estadísticas</h1>
            <p className="text-muted-foreground">
              Resumen de rotativos del período
            </p>
          </div>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stats && (
        <>
          {/* Cards de estadísticas generales - visible para todos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Total Integrantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.totalIntegrantes}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Promedio del grupo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.promedioDescansos}</p>
                <p className="text-xs text-muted-foreground">rotativos este mes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Máximo por temporada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">~50</p>
                <p className="text-xs text-muted-foreground">rotativos por año</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Pendientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-yellow-600">
                  {stats.solicitudesPendientes}
                </p>
                <p className="text-xs text-muted-foreground">solicitudes por revisar</p>
              </CardContent>
            </Card>
          </div>

          {/* Card personal para integrantes (no admin) */}
          {stats.personal && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-primary">Tus rotativos</span>
                  {stats.personal.puedesolicitarMas ? (
                    <Badge className="bg-green-100 text-green-800">Podés solicitar más</Badge>
                  ) : (
                    <Badge variant="destructive">En el límite</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-background rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">
                      {stats.personal.descansosAprobados}
                    </div>
                    <div className="text-xs text-muted-foreground">Tomados</div>
                  </div>
                  <div className="p-3 bg-background rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.personal.descansosRestantesPermitidos}
                    </div>
                    <div className="text-xs text-muted-foreground">Disponibles</div>
                  </div>
                  <div className="p-3 bg-background rounded-lg text-center col-span-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Progreso anual</span>
                        <span>{stats.personal.descansosAprobados} de ~50</span>
                      </div>
                      <Progress
                        value={Math.min(100, (stats.personal.descansosAprobados / 50) * 100)}
                        className="h-2"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabla de todos los integrantes - visible para todos */}
          <Card>
            <CardHeader>
              <CardTitle>Rotativos por integrante</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Vista mobile: Cards */}
              <div className="md:hidden space-y-3">
                {stats.integrantes.map((i) => {
                  const maxAnual = 50
                  const progreso = Math.min(100, (i.descansosAprobados / maxAnual) * 100)
                  const isCurrentUser = stats.currentUserId === i.id

                  return (
                    <div
                      key={i.id}
                      className={`border rounded-lg p-4 space-y-3 ${isCurrentUser ? "border-primary bg-primary/5" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            {i.nombre}
                            {isCurrentUser && <span className="text-primary ml-2">(Vos)</span>}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">{i.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold">{i.descansosAprobados}</span>
                          <p className="text-xs text-muted-foreground">rotativos</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Progress value={progreso} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-10">
                            {progreso.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div>
                        {i.puedesolicitarMas ? (
                          <Badge className="bg-green-100 text-green-800">Disponible</Badge>
                        ) : (
                          <Badge variant="destructive">En el límite</Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Vista desktop: Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Rotativos</TableHead>
                      <TableHead className="text-center">Progreso anual</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.integrantes.map((i) => {
                      const maxAnual = 50
                      const progreso = Math.min(100, (i.descansosAprobados / maxAnual) * 100)
                      const isCurrentUser = stats.currentUserId === i.id

                      return (
                        <TableRow key={i.id} className={isCurrentUser ? "bg-primary/10" : ""}>
                          <TableCell className="font-medium">
                            {i.nombre}
                            {isCurrentUser && <span className="text-primary ml-2">(Vos)</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{i.email}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-lg font-semibold">{i.descansosAprobados}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={progreso} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground w-12">
                                {progreso.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {i.puedesolicitarMas ? (
                              <Badge className="bg-green-100 text-green-800">Disponible</Badge>
                            ) : (
                              <Badge variant="destructive">En el límite</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
