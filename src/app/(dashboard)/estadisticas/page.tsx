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
import { BarChart3, Users, Calendar, Clock, AlertTriangle } from "lucide-react"
import { useDebugDate } from "@/contexts/debug-date-context"

interface CuposUsuarioTemporada {
  maximoAsignado: number
  consumidos: number
  usadosPasados: number    // Ya utilizados (eventos pasados)
  usadosFuturos: number    // Reservados (eventos futuros)
  restantes: number
  porcentajeUsado: number
}

interface Stats {
  temporada: {
    id: string
    name: string
    year: number
  } | null
  totalIntegrantes: number
  solicitudesPendientes: number
  integrantes: {
    id: string
    nombre: string
    email: string
    cuposTemporada: CuposUsuarioTemporada
  }[]
  currentUserId: string
  cuposTemporada: {
    totalCuposDisponibles: number
    cuposConsumidos: number
    cuposUsadosPasados: number
    cuposUsadosFuturos: number
    cuposRestantes: number
    maximoPorIntegrante: number
    porcentajeUsado: number
  }
  personal: {
    cuposTemporada: CuposUsuarioTemporada
  }
}

export default function EstadisticasPage() {
  const { data: session } = useSession()
  const { debugDate } = useDebugDate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const currentYear = debugDate.getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear.toString())

  useEffect(() => {
    fetchStats()
  }, [selectedYear, debugDate])

  const fetchStats = async () => {
    setLoading(true)
    const debugDateStr = debugDate.toISOString().split('T')[0]
    const res = await fetch(`/api/estadisticas?year=${selectedYear}&debugDate=${debugDateStr}`)
    const data = await res.json()
    setStats(data)
    setLoading(false)
  }

  // Generar años: anterior, actual, siguiente
  const years = [
    { value: (currentYear - 1).toString(), label: `Temporada ${currentYear - 1}` },
    { value: currentYear.toString(), label: `Temporada ${currentYear}` },
    { value: (currentYear + 1).toString(), label: `Temporada ${currentYear + 1}` },
  ]

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
              Resumen de rotativos de la temporada
            </p>
          </div>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y.value} value={y.value}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stats && !stats.temporada && (
        <Card>
          <CardContent className="py-8 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No hay temporada para el año {selectedYear}</p>
            <p className="text-muted-foreground">Seleccioná otro año o esperá a que se cree la temporada.</p>
          </CardContent>
        </Card>
      )}

      {stats && stats.temporada && (
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
                  Máximo por integrante
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-bold">{stats.cuposTemporada.maximoPorIntegrante}</p>
                <div className="space-y-2">
                  <Progress value={stats.personal.cuposTemporada.porcentajeUsado} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="text-primary font-medium">{stats.personal.cuposTemporada.consumidos} usados</span>
                    <span className="text-green-600 font-medium">{stats.personal.cuposTemporada.restantes} disponibles</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Cupos temporada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-bold">{stats.cuposTemporada.totalCuposDisponibles}</p>
                <div className="space-y-2">
                  <Progress value={stats.cuposTemporada.porcentajeUsado} className="h-2" />
                  <div className="grid grid-cols-3 text-xs text-muted-foreground">
                    <span title="Rotativos de eventos ya pasados">{stats.cuposTemporada.cuposUsadosPasados} usados</span>
                    <span title="Rotativos de eventos futuros" className="text-center">{stats.cuposTemporada.cuposUsadosFuturos} reservados</span>
                    <span className="text-green-600 text-right">{stats.cuposTemporada.cuposRestantes} disponibles</span>
                  </div>
                </div>
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

          {/* Card personal para todos (ADMIN e INTEGRANTE) */}
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-primary">Tus rotativos</span>
                {stats.personal.cuposTemporada.restantes > 0 ? (
                  <Badge className="bg-green-100 text-green-800">Podés solicitar más</Badge>
                ) : stats.personal.cuposTemporada.consumidos > stats.personal.cuposTemporada.maximoAsignado ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <Badge className="bg-orange-100 text-orange-800">Sobre cupo</Badge>
                  </span>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-800">Cupo completo</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-background rounded-lg text-center">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {stats.personal.cuposTemporada.usadosPasados}
                  </div>
                  <div className="text-xs text-muted-foreground">Usados</div>
                </div>
                <div className="p-3 bg-background rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">
                    {stats.personal.cuposTemporada.usadosFuturos}
                  </div>
                  <div className="text-xs text-muted-foreground">Reservados</div>
                </div>
                <div className="p-3 bg-background rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.personal.cuposTemporada.restantes}
                  </div>
                  <div className="text-xs text-muted-foreground">Disponibles</div>
                </div>
                <div className="p-3 bg-background rounded-lg text-center">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progreso</span>
                      <span>{stats.personal.cuposTemporada.consumidos} de {stats.cuposTemporada.maximoPorIntegrante}</span>
                    </div>
                    <Progress
                      value={Math.min(100, stats.personal.cuposTemporada.porcentajeUsado)}
                      className="h-2"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de todos los integrantes - visible para todos */}
          <Card>
            <CardHeader>
              <CardTitle>Rotativos por integrante</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Vista mobile: Cards */}
              <div className="md:hidden space-y-3">
                {stats.integrantes.map((i) => {
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
                        {i.cuposTemporada.restantes > 0 ? (
                          <Badge className="bg-green-100 text-green-800">Disponible</Badge>
                        ) : i.cuposTemporada.consumidos > i.cuposTemporada.maximoAsignado ? (
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <Badge className="bg-orange-100 text-orange-800">Sobre cupo</Badge>
                          </span>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">Cupo completo</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-muted/50 rounded">
                          <div className="text-lg font-bold text-muted-foreground">{i.cuposTemporada.usadosPasados}</div>
                          <div className="text-xs text-muted-foreground">Usados</div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded">
                          <div className="text-lg font-bold text-primary">{i.cuposTemporada.usadosFuturos}</div>
                          <div className="text-xs text-muted-foreground">Reservados</div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded">
                          <div className="text-lg font-bold text-green-600">{i.cuposTemporada.restantes}</div>
                          <div className="text-xs text-muted-foreground">Libres</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progreso</span>
                          <span>{i.cuposTemporada.consumidos} de {i.cuposTemporada.maximoAsignado}</span>
                        </div>
                        <Progress value={Math.min(100, i.cuposTemporada.porcentajeUsado)} className="h-2" />
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
                      <TableHead className="text-center">Usados</TableHead>
                      <TableHead className="text-center">Reservados</TableHead>
                      <TableHead className="text-center">Libres</TableHead>
                      <TableHead className="text-center">Progreso</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.integrantes.map((i) => {
                      const isCurrentUser = stats.currentUserId === i.id

                      return (
                        <TableRow key={i.id} className={isCurrentUser ? "bg-primary/10" : ""}>
                          <TableCell className="font-medium">
                            {i.nombre}
                            {isCurrentUser && <span className="text-primary ml-2">(Vos)</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-lg font-semibold text-muted-foreground">
                              {i.cuposTemporada.usadosPasados}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-lg font-semibold text-primary">
                              {i.cuposTemporada.usadosFuturos}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-lg font-semibold text-green-600">
                              {i.cuposTemporada.restantes}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(100, i.cuposTemporada.porcentajeUsado)} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground w-16">
                                {i.cuposTemporada.consumidos}/{i.cuposTemporada.maximoAsignado}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {i.cuposTemporada.restantes > 0 ? (
                              <Badge className="bg-green-100 text-green-800">Disponible</Badge>
                            ) : i.cuposTemporada.consumidos > i.cuposTemporada.maximoAsignado ? (
                              <span className="inline-flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                                <Badge className="bg-orange-100 text-orange-800">Sobre cupo</Badge>
                              </span>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800">Cupo completo</Badge>
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
