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

interface StatsAdmin {
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
}

interface StatsIntegrante {
  mes: string
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

export default function EstadisticasPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<StatsAdmin | StatsIntegrante | null>(null)
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

  const isAdmin = session?.user?.role === "ADMIN"

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      }),
    }
  })

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

      {isAdmin && stats && "integrantes" in stats ? (
        // Vista Admin
        <>
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

          <Card>
            <CardHeader>
              <CardTitle>Rotativos por integrante</CardTitle>
            </CardHeader>
            <CardContent>
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
                    // Calcular progreso basado en ~50 rotativos anuales
                    const maxAnual = 50
                    const progreso = Math.min(100, (i.descansosAprobados / maxAnual) * 100)

                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.nombre}</TableCell>
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
            </CardContent>
          </Card>
        </>
      ) : stats && "personal" in stats ? (
        // Vista Integrante
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Tus rotativos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progreso visual */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progreso anual</span>
                  <span className="font-medium">
                    {stats.personal.descansosAprobados} de ~50
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (stats.personal.descansosAprobados / 50) * 100)}
                  className="h-3"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <div className="text-3xl font-bold text-primary">
                    {stats.personal.descansosAprobados}
                  </div>
                  <div className="text-sm text-muted-foreground">Tomados</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {stats.personal.descansosRestantesPermitidos}
                  </div>
                  <div className="text-sm text-muted-foreground">Disponibles</div>
                </div>
              </div>

              <div className="pt-2">
                {stats.personal.puedesolicitarMas ? (
                  <Badge className="bg-green-100 text-green-800 text-sm py-1 px-3">
                    Podés solicitar más rotativos
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-sm py-1 px-3">
                    Alcanzaste tu límite anual
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estadísticas del grupo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-blue-800">Promedio del grupo</span>
                  <span className="text-2xl font-bold text-blue-700">
                    {stats.grupo.promedioDescansos}
                  </span>
                </div>
                <p className="text-sm text-blue-600 mt-1">
                  rotativos tomados este mes
                </p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Máximo por temporada</span>
                  <span className="text-2xl font-bold">~50</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  rotativos por año por persona
                </p>
              </div>

              <p className="text-xs text-muted-foreground pt-2">
                El máximo se calcula automáticamente para que todos tengan las mismas oportunidades.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
