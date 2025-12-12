"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
    return <p>Cargando estadisticas...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Estadisticas</h1>
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
                <CardTitle className="text-sm text-gray-500">
                  Total Integrantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.totalIntegrantes}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">
                  Promedio Descansos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.promedioDescansos}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">
                  Limite Maximo (5%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.limiteMaximo}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500">
                  Casos Pendientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-yellow-600">
                  {stats.solicitudesPendientes}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Descansos por Integrante</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Descansos</TableHead>
                    <TableHead>% vs Promedio</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.integrantes.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.nombre}</TableCell>
                      <TableCell>{i.email}</TableCell>
                      <TableCell>{i.descansosAprobados}</TableCell>
                      <TableCell>
                        <span
                          className={
                            i.porcentajeVsPromedio > 5
                              ? "text-red-600"
                              : i.porcentajeVsPromedio > 0
                                ? "text-yellow-600"
                                : "text-green-600"
                          }
                        >
                          {i.porcentajeVsPromedio > 0 ? "+" : ""}
                          {i.porcentajeVsPromedio}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {i.puedesolicitarMas ? (
                          <Badge>OK</Badge>
                        ) : (
                          <Badge variant="destructive">Limite</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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
              <CardTitle>Tus Estadisticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Descansos aprobados</span>
                <span className="font-bold">
                  {stats.personal.descansosAprobados}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">% vs Promedio</span>
                <span
                  className={`font-bold ${
                    stats.personal.porcentajeVsPromedio > 5
                      ? "text-red-600"
                      : stats.personal.porcentajeVsPromedio > 0
                        ? "text-yellow-600"
                        : "text-green-600"
                  }`}
                >
                  {stats.personal.porcentajeVsPromedio > 0 ? "+" : ""}
                  {stats.personal.porcentajeVsPromedio}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Descansos restantes</span>
                <span className="font-bold">
                  {stats.personal.descansosRestantesPermitidos}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estado</span>
                {stats.personal.puedesolicitarMas ? (
                  <Badge>Puedes solicitar</Badge>
                ) : (
                  <Badge variant="destructive">En el limite</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estadisticas del Grupo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Promedio de descansos</span>
                <span className="font-bold">
                  {stats.grupo.promedioDescansos}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Limite maximo (5%)</span>
                <span className="font-bold">{stats.grupo.limiteMaximo}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
