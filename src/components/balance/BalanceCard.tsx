"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, Info, TrendingUp } from "lucide-react"

interface BalanceCardProps {
  balance: {
    rotativosTomados: number
    rotativosObligatorios: number
    rotativosPorLicencia: number
    maxProyectado: number
    maxAjustadoManual?: number | null
    bloqueUsado: boolean
    finesDeSemanaMesActual: number
  }
  alertaUmbral?: number
}

export function BalanceCard({ balance, alertaUmbral = 90 }: BalanceCardProps) {
  const maxEfectivo = balance.maxAjustadoManual ?? balance.maxProyectado
  const totalRotativos =
    balance.rotativosTomados +
    balance.rotativosObligatorios +
    balance.rotativosPorLicencia
  const porcentaje = maxEfectivo > 0 ? (totalRotativos / maxEfectivo) * 100 : 0
  const superaUmbral = porcentaje >= alertaUmbral
  const superaMaximo = totalRotativos >= maxEfectivo

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Mi Balance
          </span>
          {superaMaximo ? (
            <Badge variant="destructive">En límite</Badge>
          ) : superaUmbral ? (
            <Badge className="bg-yellow-100 text-yellow-800">
              Cerca del límite
            </Badge>
          ) : (
            <Badge variant="default">OK</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Barra de progreso */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Rotativos usados</span>
            <span className="font-semibold">
              {totalRotativos} / {maxEfectivo}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                superaMaximo
                  ? "bg-red-500"
                  : superaUmbral
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${Math.min(porcentaje, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span className="text-yellow-600">{alertaUmbral}%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Desglose */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Voluntarios</span>
            <span>{balance.rotativosTomados}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Obligatorios</span>
            <span>{balance.rotativosObligatorios}</span>
          </div>
          {balance.rotativosPorLicencia > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>Restados por licencia</span>
              <span>+{Math.floor(balance.rotativosPorLicencia)}</span>
            </div>
          )}
        </div>

        {/* Estado bloque */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-sm">
            {balance.bloqueUsado ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Bloque utilizado esta temporada</span>
              </>
            ) : (
              <>
                <Info className="w-4 h-4 text-blue-500" />
                <span>Bloque disponible</span>
              </>
            )}
          </div>
        </div>

        {/* Fines de semana */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Fines de semana este mes</span>
          <span>{balance.finesDeSemanaMesActual} / 1</span>
        </div>

        {/* Alerta si aplica */}
        {superaUmbral && !superaMaximo && (
          <div className="flex items-start gap-2 p-2 bg-yellow-50 rounded-md text-sm">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
            <span className="text-yellow-800">
              Estás cerca del límite. Las próximas solicitudes requerirán
              aprobación.
            </span>
          </div>
        )}

        {superaMaximo && (
          <div className="flex items-start gap-2 p-2 bg-red-50 rounded-md text-sm">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
            <span className="text-red-800">
              Has alcanzado el máximo proyectado. Nuevas solicitudes requerirán
              aprobación especial.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
