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
import { BarChart3, Users, Calendar, Clock, AlertTriangle, Info, UserPlus } from "lucide-react"
import { useDebugDate } from "@/contexts/debug-date-context"

interface CuposUsuarioTemporada {
  maximoAsignado: number
  consumidos: number
  usadosPasados: number    // Ya utilizados (eventos pasados)
  usadosFuturos: number    // Reservados (eventos futuros)
  rotativosPorLicencia?: number // Restados por licencia
  restantes: number
  porcentajeUsado: number
  cercaDelLimite?: boolean  // Alerta: cerca del límite superior
  porDebajoDelPromedio?: boolean  // Alerta: muy por debajo del promedio
}

interface JustificacionAsignacion {
  fechaIngreso: string
  asignacionInicial: number | null
  justificacion: string | null
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
    esNuevoIntegrante?: boolean
    justificacionAsignacion?: JustificacionAsignacion | null
  }[]
  currentUserId: string
  promedioGrupo?: number
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
              <CardTitle className="flex items-center gap-2 flex-wrap">
                <span className="text-primary">Tus rotativos</span>
                {stats.personal.cuposTemporada.cercaDelLimite && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <Badge className="bg-amber-100 text-amber-800">¡Cerca del límite!</Badge>
                  </span>
                )}
                {stats.personal.cuposTemporada.porDebajoDelPromedio && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <Badge className="bg-orange-100 text-orange-800">¡Bajo cupo!</Badge>
                  </span>
                )}
                {stats.personal.cuposTemporada.restantes > 0 && !stats.personal.cuposTemporada.cercaDelLimite ? (
                  <Badge className="bg-green-100 text-green-800">Podés solicitar más</Badge>
                ) : stats.personal.cuposTemporada.consumidos > stats.personal.cuposTemporada.maximoAsignado ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <Badge className="bg-orange-100 text-orange-800">¡Sobre cupo!</Badge>
                  </span>
                ) : stats.personal.cuposTemporada.restantes === 0 ? (
                  <Badge className="bg-yellow-100 text-yellow-800">Cupo completo</Badge>
                ) : null}
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
                        <div className="min-w-0 flex-1">
                          <p className="font-medium flex items-center gap-1">
                            {i.nombre}
                            {isCurrentUser && <span className="text-primary ml-1">(Vos)</span>}
                            {i.esNuevoIntegrante && (
                              <span className="inline-flex items-center gap-0.5 text-blue-600" title={i.justificacionAsignacion?.justificacion || "Integrante nuevo"}>
                                <UserPlus className="w-3 h-3" />
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">{i.email}</p>
                          {i.esNuevoIntegrante && i.justificacionAsignacion && (
                            <p className="text-xs text-blue-600 mt-1">
                              Ingreso: {new Date(i.justificacionAsignacion.fechaIngreso).toLocaleDateString("es-AR")} - Asignación inicial: {i.justificacionAsignacion.asignacionInicial} rotativos
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {i.cuposTemporada.cercaDelLimite && (
                            <span className="flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <Badge className="bg-amber-100 text-amber-800 text-xs">¡Cerca del límite!</Badge>
                            </span>
                          )}
                          {i.cuposTemporada.porDebajoDelPromedio && (
                            <span className="flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3 text-orange-600" />
                              <Badge className="bg-orange-100 text-orange-800 text-xs">¡Bajo cupo!</Badge>
                            </span>
                          )}
                          {i.cuposTemporada.restantes > 0 && !i.cuposTemporada.cercaDelLimite ? (
                            <Badge className="bg-green-100 text-green-800">Disponible</Badge>
                          ) : i.cuposTemporada.consumidos > i.cuposTemporada.maximoAsignado ? (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-orange-600" />
                              <Badge className="bg-orange-100 text-orange-800">¡Sobre cupo!</Badge>
                            </span>
                          ) : i.cuposTemporada.restantes === 0 ? (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-yellow-600" />
                              <Badge className="bg-yellow-100 text-yellow-800">Cupo completo</Badge>
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className={`grid gap-2 text-center ${(i.cuposTemporada.rotativosPorLicencia ?? 0) > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
                        <div className="p-2 bg-muted/50 rounded">
                          <div className="text-lg font-bold text-muted-foreground">{i.cuposTemporada.usadosPasados}</div>
                          <div className="text-xs text-muted-foreground">Usados</div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded">
                          <div className="text-lg font-bold text-primary">{i.cuposTemporada.usadosFuturos}</div>
                          <div className="text-xs text-muted-foreground">Reservados</div>
                        </div>
                        {(i.cuposTemporada.rotativosPorLicencia ?? 0) > 0 && (
                          <div className="p-2 bg-amber-50 rounded">
                            <div className="text-lg font-bold text-amber-600">+{i.cuposTemporada.rotativosPorLicencia}</div>
                            <div className="text-xs text-amber-700">Licencia</div>
                          </div>
                        )}
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
                      <TableHead className="text-center">Licencia</TableHead>
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
                            <div className="flex items-center gap-1">
                              {i.nombre}
                              {isCurrentUser && <span className="text-primary ml-1">(Vos)</span>}
                              {i.esNuevoIntegrante && (
                                <span className="inline-flex items-center gap-0.5 text-blue-600" title={i.justificacionAsignacion?.justificacion || "Integrante nuevo"}>
                                  <UserPlus className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            {i.esNuevoIntegrante && i.justificacionAsignacion && (
                              <p className="text-xs text-blue-600 font-normal">
                                Ingreso: {new Date(i.justificacionAsignacion.fechaIngreso).toLocaleDateString("es-AR")} (asignación: {i.justificacionAsignacion.asignacionInicial})
                              </p>
                            )}
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
                            {(i.cuposTemporada.rotativosPorLicencia ?? 0) > 0 ? (
                              <span className="text-lg font-semibold text-amber-600">
                                +{i.cuposTemporada.rotativosPorLicencia}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
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
                            <div className="flex flex-wrap gap-1 justify-center">
                              {i.cuposTemporada.cercaDelLimite && (
                                <span className="inline-flex items-center gap-0.5" title="¡Cerca del límite superior!">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <Badge className="bg-amber-100 text-amber-800 text-xs">¡Cerca del límite!</Badge>
                                </span>
                              )}
                              {i.cuposTemporada.porDebajoDelPromedio && (
                                <span className="inline-flex items-center gap-0.5" title="Por debajo del promedio del grupo">
                                  <AlertTriangle className="w-3 h-3 text-orange-600" />
                                  <Badge className="bg-orange-100 text-orange-800 text-xs">¡Bajo cupo!</Badge>
                                </span>
                              )}
                              {i.cuposTemporada.restantes > 0 && !i.cuposTemporada.cercaDelLimite ? (
                                <Badge className="bg-green-100 text-green-800">Disponible</Badge>
                              ) : i.cuposTemporada.consumidos > i.cuposTemporada.maximoAsignado ? (
                                <span className="inline-flex items-center gap-1">
                                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                                  <Badge className="bg-orange-100 text-orange-800">¡Sobre cupo!</Badge>
                                </span>
                              ) : i.cuposTemporada.restantes === 0 ? (
                                <span className="inline-flex items-center gap-1">
                                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                  <Badge className="bg-yellow-100 text-yellow-800">Cupo completo</Badge>
                                </span>
                              ) : null}
                            </div>
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
