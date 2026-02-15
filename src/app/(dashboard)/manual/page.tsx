import { Card, CardContent } from "@/components/ui/card"
import {
  BookOpen,
  LogIn,
  Calendar,
  Hand,
  Layers,
  FileText,
  BookOpenText,
  BarChart3,
  Bell,
  KeyRound,
  ShieldCheck,
  CalendarPlus,
  Users,
  CalendarOff,
  Zap,
  Settings,
  PieChart,
  HelpCircle,
  Lightbulb,
  Headphones,
} from "lucide-react"

export default function ManualPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1
          className="text-2xl md:text-4xl font-bold text-[var(--burgundy)]"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Manual del Sistema de Rotativos
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Teatro Colón - Primeros Violines
        </p>
        <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent mt-4" />
      </div>

      {/* Bienvenida */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <BookOpen className="w-6 h-6 text-[var(--burgundy)] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Bienvenido al Sistema de Rotativos</h2>
              <p className="text-muted-foreground">
                Este sistema te permite gestionar tus rotativos como integrante de la fila de
                Primeros Violines de la Orquesta Estable del Teatro Colón.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Glosario */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BookOpenText className="w-5 h-5 text-[var(--burgundy)]" />
          Conceptos Importantes (Glosario)
        </h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Antes de empezar, es útil conocer algunas palabras que vas a ver en el sistema:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold w-36">Palabra</th>
                    <th className="text-left py-2 font-semibold">Qué significa</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2.5 pr-4 font-medium">Rotativo</td>
                    <td className="py-2.5 text-muted-foreground">Un día de descanso que pedís para no tocar en un ensayo o función</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium">Título o bloque</td>
                    <td className="py-2.5 text-muted-foreground">Una producción (por ejemplo: &ldquo;La Traviata&rdquo;, &ldquo;El Lago de los Cisnes&rdquo;, un concierto) con todos sus ensayos y funciones</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium">Cupo</td>
                    <td className="py-2.5 text-muted-foreground">La cantidad de músicos que pueden pedir rotativo el mismo día</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium">Lista de espera</td>
                    <td className="py-2.5 text-muted-foreground">Si no hay cupo, podés anotarte para que te avisen cuando se libere un lugar</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium">Temporada</td>
                    <td className="py-2.5 text-muted-foreground">El año de actividad (por ejemplo: Temporada 2026)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium">Balance</td>
                    <td className="py-2.5 text-muted-foreground">Tu contador personal de rotativos tomados</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Tipos de usuario */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--burgundy)]" />
          Tipos de Usuario
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3 text-[var(--burgundy)]">INTEGRANTE</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Puede pedir rotativos para sí mismo</li>
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Puede ver sus estadísticas personales</li>
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Puede cancelar sus propias solicitudes</li>
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Puede ver las reglas del sistema</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3 text-[var(--burgundy)]">ADMIN (Administrador)</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Tiene todo lo que puede hacer un INTEGRANTE</li>
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Puede aprobar o rechazar solicitudes de otros</li>
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Puede crear y editar el calendario de eventos</li>
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Puede gestionar usuarios</li>
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Puede registrar licencias</li>
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Puede asignar rotativos vacantes</li>
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Puede configurar las reglas del sistema</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Sección INTEGRANTES */}
      <div className="pt-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-[var(--gold)] to-transparent" />
          <h2
            className="text-lg md:text-xl font-semibold text-[var(--burgundy)] px-3"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Para INTEGRANTES
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-[var(--gold)] to-transparent" />
        </div>
      </div>

      {/* 1. Iniciar sesión */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <LogIn className="w-5 h-5 text-[var(--burgundy)]" />
          1. Iniciar sesión
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Abrí el sistema en tu navegador</li>
              <li>Escribí tu email y contraseña</li>
              <li>Hacé clic en &ldquo;Iniciar sesión&rdquo;</li>
            </ol>
            <p className="text-xs bg-muted/50 rounded-lg p-3">
              <strong>¿Olvidaste tu contraseña?</strong> Contactá al administrador para que te la resetee.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 2. Ver el Calendario */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--burgundy)]" />
          2. Ver el Calendario
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <p>Cuando entrás al sistema, lo primero que ves es el Calendario. Ahí podés:</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Ver todos los ensayos y funciones del mes</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Ver qué días ya pediste rotativo (aparecen marcados)</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Hacer clic en un día para ver los detalles</li>
            </ul>
            <p className="font-medium text-foreground mt-3">Cómo navegar:</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Usá las flechas izquierda/derecha para cambiar de mes</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Los eventos se muestran con colores según el título</li>
            </ul>
            <div className="bg-muted/50 rounded-lg p-3 mt-2">
              <p className="font-medium text-foreground text-xs mb-1.5">Colores de eventos:</p>
              <ul className="space-y-1 text-xs">
                <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> Ensayos a las 14:00 en naranja</li>
                <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Ensayos a las 20:00 en azul</li>
                <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Funciones en rojo</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Pedir un Rotativo */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Hand className="w-5 h-5 text-[var(--burgundy)]" />
          3. Pedir un Rotativo (día de descanso)
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Paso a paso:</p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>En el calendario, hacé clic en el día del evento donde querés pedir rotativo</li>
              <li>Se abre un panel a la derecha con los detalles del evento</li>
              <li>Buscá el botón &ldquo;Solicitar Rotativo&rdquo;</li>
              <li>Si hay cupo disponible, tu rotativo se aprueba automáticamente</li>
              <li>Si no hay cupo, podés elegir anotarte en la &ldquo;Lista de espera&rdquo;</li>
            </ol>
            <div className="bg-muted/50 rounded-lg p-3 mt-2">
              <p className="font-medium text-foreground text-xs mb-1.5">Estados de tu solicitud:</p>
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" /> <strong>Aprobado:</strong> Tu rotativo fue aceptado</li>
                <li className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" /> <strong>Pendiente:</strong> Esperando revisión del admin</li>
                <li className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" /> <strong>En espera:</strong> Estás en la lista de espera</li>
                <li className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" /> <strong>Rechazado:</strong> No se aprobó tu solicitud</li>
                <li className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" /> <strong>Cancelado:</strong> Vos mismo lo cancelaste</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. Pedir un Título Completo */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="w-5 h-5 text-[var(--burgundy)]" />
          4. Pedir un Título Completo (Bloque)
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <p>Si querés ausentarte durante TODO un título (por ejemplo, todas las funciones y ensayos de &ldquo;La Traviata&rdquo;):</p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Buscá el título en el calendario</li>
              <li>Hacé clic en cualquier evento de ese título</li>
              <li>Buscá el botón &ldquo;Solicitar Título Completo&rdquo;</li>
              <li>El sistema te muestra cuántos eventos incluye</li>
              <li>Confirmá tu solicitud</li>
            </ol>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-2 text-xs">
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">Importante:</p>
              <ul className="space-y-1 text-amber-700 dark:text-amber-300">
                <li>&#x2022; Solo podés pedir UN título completo por año. Títulos adicionales quedan sujetos a disponibilidad y validación de la fila.</li>
                <li>&#x2022; Una vez que empieza, no podés cancelarlo</li>
                <li>&#x2022; Los conciertos siempre se piden como título completo</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 5. Ver Mis Solicitudes */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-[var(--burgundy)]" />
          5. Ver Mis Solicitudes
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <p>Para ver todas tus solicitudes (pasadas y futuras):</p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Hacé clic en &ldquo;Solicitudes&rdquo; en el menú de la izquierda</li>
              <li>Ahí ves todas tus solicitudes ordenadas por fecha</li>
              <li>Podés cancelar solicitudes futuras haciendo clic en &ldquo;Cancelar&rdquo;</li>
            </ol>
            <p className="text-xs mt-2">
              Podés ordenar por fecha del evento o por fecha de solicitud.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 6. Ver las Reglas */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[var(--burgundy)]" />
          6. Ver las Reglas
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <p>El sistema tiene reglas para que todo sea justo. Para verlas hacé clic en &ldquo;Reglas&rdquo; en el menú.</p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold w-40">Regla</th>
                    <th className="text-left py-2 font-semibold">Qué significa</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr><td className="py-2 pr-4 font-medium">Cupos por evento</td><td className="py-2">Cuántos músicos pueden pedir rotativo por evento (depende si es ópera, ballet o concierto) y del orgánico requerido</td></tr>
                  <tr><td className="py-2 pr-4 font-medium">Máximo anual</td><td className="py-2">Cuántos rotativos podés pedir en total durante el año</td></tr>
                  <tr><td className="py-2 pr-4 font-medium">Fines de semana</td><td className="py-2">Máximo un rotativo de fin de semana por mes, eventualmente dos según disponibilidad</td></tr>
                  <tr><td className="py-2 pr-4 font-medium">Ensayos dobles</td><td className="py-2">Si hay varios días con ensayos dobles, solo podés pedir un rotativo</td></tr>
                  <tr><td className="py-2 pr-4 font-medium">Funciones por título</td><td className="py-2">Cuántas funciones de un mismo título podés pedir</td></tr>
                  <tr><td className="py-2 pr-4 font-medium">Primer y último título</td><td className="py-2">No podés tomar el primer Y el último título del año</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 7. Ver Mis Estadísticas */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[var(--burgundy)]" />
          7. Ver Mis Estadísticas
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <p>Para ver cuántos rotativos usaste, hacé clic en &ldquo;Estadísticas&rdquo; en el menú. Ahí ves:</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Cuántos rotativos usaste este año</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Cuántos te quedan disponibles</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Cómo estás comparado con tus compañeros</li>
            </ul>
            <div className="bg-muted/50 rounded-lg p-3 mt-2">
              <p className="font-medium text-foreground text-xs mb-1.5">Alertas que podés ver:</p>
              <ul className="space-y-1 text-xs">
                <li><strong>&ldquo;Cerca del límite&rdquo;:</strong> Ya usaste casi todos tus rotativos del año</li>
                <li><strong>&ldquo;Bajo cupo&rdquo;:</strong> Usaste muy pocos rotativos, considerá tomar más</li>
                <li><strong>&ldquo;Podés solicitar más&rdquo;:</strong> Todo bien, tenés rotativos disponibles</li>
                <li><strong>&ldquo;Sobre cupo&rdquo;:</strong> Has superado el cupo máximo anual asignado</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 8. Notificaciones */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5 text-[var(--burgundy)]" />
          8. Notificaciones
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <p>El sistema te avisa cuando pasa algo importante:</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Tu rotativo fue aprobado</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Tu rotativo fue rechazado</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Se liberó un cupo y eras el siguiente en la lista de espera</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Estás cerca del límite anual</li>
            </ul>
            <ol className="list-decimal list-inside space-y-1.5 mt-2">
              <li>Mirá el ícono de campana arriba a la derecha</li>
              <li>Si hay un número, tenés notificaciones sin leer</li>
              <li>Hacé clic para verlas</li>
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* 9. Cambiar mi Contraseña */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[var(--burgundy)]" />
          9. Cambiar mi Contraseña
        </h3>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Hacé clic en tu nombre arriba a la derecha</li>
              <li>Seleccioná &ldquo;Cambiar contraseña&rdquo;</li>
              <li>Escribí tu contraseña actual</li>
              <li>Escribí la nueva contraseña dos veces</li>
              <li>Hacé clic en &ldquo;Guardar&rdquo;</li>
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* Sección ADMINISTRADORES */}
      <div className="pt-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-[var(--gold)] to-transparent" />
          <h2
            className="text-lg md:text-xl font-semibold text-[var(--burgundy)] px-3"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Para ADMINISTRADORES
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-[var(--gold)] to-transparent" />
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Los administradores tienen acceso a funciones extra para gestionar el sistema.
        </p>
      </div>

      {/* Admin 1. Aprobar/Rechazar */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[var(--burgundy)]" />
          1. Aprobar/Rechazar Solicitudes
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <p>Cuando un músico pide un rotativo que necesita revisión:</p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Hacé clic en &ldquo;Pendientes&rdquo; en el menú</li>
              <li>Ves todas las solicitudes esperando tu decisión</li>
              <li>Para cada una podés:
                <ul className="ml-6 mt-1 space-y-1">
                  <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Hacer clic en &ldquo;Aprobar&rdquo; (con motivo &ldquo;Validado por la fila&rdquo;)</li>
                  <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Hacer clic en &ldquo;Rechazar&rdquo; (con motivo &ldquo;No validado por la fila&rdquo;)</li>
                </ul>
              </li>
              <li>Podés agregar un comentario adicional si querés</li>
            </ol>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-2 text-xs">
              <p className="text-amber-700 dark:text-amber-300">
                <strong>Alerta:</strong> Si ves una alerta naranja que dice &ldquo;Evento individual de concierto&rdquo;, tené cuidado: normalmente los conciertos se piden completos.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Admin 2. Gestionar el Calendario */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CalendarPlus className="w-5 h-5 text-[var(--burgundy)]" />
          2. Gestionar el Calendario
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1.5">Crear un nuevo Título (producción):</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Hacé clic en &ldquo;Nuevo Título&rdquo; en el panel derecho</li>
                <li>Completá: nombre, tipo (ópera/ballet/concierto), fechas, cupo</li>
                <li>Hacé clic en &ldquo;Guardar&rdquo;</li>
              </ol>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1.5">Crear eventos (ensayos/funciones):</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Hacé clic en un día del calendario</li>
                <li>Hacé clic en &ldquo;Nuevo Evento&rdquo;</li>
                <li>Seleccioná el título, tipo de evento, horario</li>
                <li>Hacé clic en &ldquo;Guardar&rdquo;</li>
              </ol>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1.5">Editar / Eliminar un evento:</p>
              <ul className="space-y-1">
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Hacé clic en el evento en el calendario</li>
                <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Usá el ícono de lápiz para editar o el de basura para eliminar</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Admin 3. Gestionar Usuarios */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--burgundy)]" />
          3. Gestionar Usuarios (Integrantes)
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-4 text-sm text-muted-foreground">
            <p>Hacé clic en &ldquo;Usuarios&rdquo; en el menú para ver la lista de todos los usuarios.</p>
            <div>
              <p className="font-medium text-foreground mb-1.5">Agregar un nuevo usuario:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Hacé clic en &ldquo;Agregar Usuario&rdquo;</li>
                <li>Completá: nombre, email, contraseña, rol</li>
                <li>Si es integrante, poné la fecha de ingreso</li>
                <li>Hacé clic en &ldquo;Crear Usuario&rdquo;</li>
              </ol>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1.5">Cambiar rol o resetear contraseña:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Buscá al usuario en la lista</li>
                <li>Hacé clic en los tres puntos (menú)</li>
                <li>Seleccioná &ldquo;Editar&rdquo; o &ldquo;Resetear contraseña&rdquo;</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Admin 4. Registrar Licencias */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CalendarOff className="w-5 h-5 text-[var(--burgundy)]" />
          4. Registrar Licencias
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Hacé clic en &ldquo;Licencias&rdquo; en el menú</li>
              <li>Hacé clic en &ldquo;Nueva Licencia&rdquo;</li>
              <li>Seleccioná el integrante</li>
              <li>Poné las fechas de inicio y fin</li>
              <li>Agregá una descripción (opcional)</li>
              <li>Hacé clic en &ldquo;Registrar Licencia&rdquo;</li>
            </ol>
            <p className="text-xs bg-muted/50 rounded-lg p-3">
              El sistema calcula automáticamente cuántos rotativos le corresponden sumar al integrante (basado en el promedio del grupo durante su ausencia).
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Admin 5. Asignar Rotativo Vacante */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-[var(--burgundy)]" />
          5. Asignar Rotativo Vacante
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <p>Cuando nadie quiere tomar rotativo y hay que cubrir un evento:</p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>En el calendario, hacé clic en el evento</li>
              <li>Hacé clic en &ldquo;Gestionar Rotativos&rdquo;</li>
              <li>Seleccioná el integrante a quien asignar</li>
              <li>El sistema te muestra quiénes tienen menos rotativos tomados</li>
              <li>Hacé clic en &ldquo;Asignar&rdquo;</li>
            </ol>
            <p className="text-xs">El integrante recibirá una notificación automática.</p>
          </CardContent>
        </Card>
      </section>

      {/* Admin 6. Configurar Reglas */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5 text-[var(--burgundy)]" />
          6. Configurar Reglas
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Hacé clic en &ldquo;Configuración&rdquo; en el menú</li>
              <li>Ahí ves todas las reglas editables</li>
              <li>Podés cambiar: cupos por tipo de evento, cantidad de fines de semana por mes, umbrales de alerta</li>
            </ol>
            <p className="text-xs bg-muted/50 rounded-lg p-3">
              Algunas reglas NO se pueden editar porque se calculan automáticamente (como el máximo anual por persona).
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Admin 7. Ver Estadísticas del Grupo */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <PieChart className="w-5 h-5 text-[var(--burgundy)]" />
          7. Ver Estadísticas del Grupo
        </h3>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
            <p>En la página de Estadísticas podés ver:</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Cuántos rotativos tomó cada integrante</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Quién está cerca del límite</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>Quién está muy por debajo del promedio</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span>El balance general de la temporada</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <div className="pt-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-[var(--gold)] to-transparent" />
          <h2
            className="text-lg md:text-xl font-semibold text-[var(--burgundy)] px-3"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Preguntas Frecuentes
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-[var(--gold)] to-transparent" />
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-[var(--burgundy)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Pedí un rotativo y dice &ldquo;Pendiente&rdquo;, ¿qué significa?</p>
                <p className="text-muted-foreground mt-1">Tu solicitud necesita aprobación del administrador. Esto pasa cuando ya pediste muchos rotativos de ese título, es un caso especial que necesita revisión, o pediste un evento individual de un concierto. Te llegará una notificación cuando se decida.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-[var(--burgundy)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">No hay cupo para el día que quiero, ¿qué hago?</p>
                <div className="text-muted-foreground mt-1">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Podés anotarte en la Lista de Espera</li>
                    <li>Si alguien cancela, te avisan automáticamente</li>
                    <li>Estás en el orden en que te anotaste (primero en anotarse, primero en recibir el cupo)</li>
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-[var(--burgundy)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">¿Puedo cancelar un rotativo ya aprobado?</p>
                <ul className="text-muted-foreground mt-1 space-y-1">
                  <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span><strong>Si todavía no pasó el evento:</strong> Sí, podés cancelarlo desde &ldquo;Mis Solicitudes&rdquo;</li>
                  <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span><strong>Si falta poco tiempo:</strong> Puede requerir aprobación del admin</li>
                  <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span><strong>Si pediste un título completo y ya empezó:</strong> No, no se puede cancelar</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-[var(--burgundy)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">¿Cuántos rotativos puedo pedir por año?</p>
                <p className="text-muted-foreground mt-1">El sistema calcula tu límite automáticamente para que sea justo para todos. Podés ver tu límite personal en la página de Estadísticas. El cálculo depende de la cantidad total de eventos, el cupo de cada evento y la cantidad de integrantes.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-[var(--burgundy)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">¿Qué pasa si tomo licencia?</p>
                <p className="text-muted-foreground mt-1">Cuando volvés de una licencia, el sistema te suma automáticamente el promedio de rotativos que tomaron los demás durante tu ausencia. Así no quedás ni en ventaja ni en desventaja.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-[var(--burgundy)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">¿Por qué no puedo pedir eventos individuales de un concierto?</p>
                <p className="text-muted-foreground mt-1">Los conciertos tienen un equipo fijo, por eso se piden como &ldquo;título completo&rdquo;. Si necesitás ausentarte de un concierto, tenés que pedir todo el concierto (todos sus ensayos y funciones).</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-[var(--burgundy)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">El sistema me avisa que estoy &ldquo;cerca del límite&rdquo;, ¿qué hago?</p>
                <p className="text-muted-foreground mt-1">Significa que usaste muchos rotativos y te quedan pocos. Podés guardar los que te quedan para cuando más los necesites, o seguir pidiendo sabiendo que te quedan pocos. Es solo un aviso, no te impide pedir más.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-[var(--burgundy)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">¿Qué es &ldquo;rotación vacante&rdquo;?</p>
                <p className="text-muted-foreground mt-1">Cuando un evento necesita cobertura y nadie se ofrece voluntariamente, el administrador puede asignar prioridades de rotativos. Se prioriza a quienes menos rotativos hayan tomado, para mantener el equilibrio.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-[var(--burgundy)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">¿Cómo sé qué título tomé este año?</p>
                <p className="text-muted-foreground mt-1">En la página de Estadísticas podés ver el detalle de todos tus rotativos, incluyendo si tomaste algún título completo.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consejos Útiles */}
      <section className="space-y-3 pt-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-[var(--gold)]" />
          Consejos Útiles
        </h2>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li><strong>Revisá el calendario seguido</strong> &mdash; Así podés planificar tus rotativos con anticipación</li>
              <li><strong>Pedilo con tiempo</strong> &mdash; Si pedís muy cerca de la fecha, puede requerir aprobación especial</li>
              <li><strong>Mirá tus estadísticas</strong> &mdash; Te ayuda a saber cuántos rotativos te quedan</li>
              <li><strong>Activá las notificaciones</strong> &mdash; Así te enterás rápido cuando algo cambia</li>
              <li><strong>Si tenés dudas, preguntá al admin</strong> &mdash; Mejor preguntar antes que cometer un error</li>
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* Ayuda */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Headphones className="w-5 h-5 text-[var(--burgundy)]" />
          ¿Necesitás Ayuda?
        </h2>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span><strong>Problema técnico</strong> (no puedo entrar, la página no carga): Contactá al administrador del sistema</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span><strong>Duda sobre las reglas:</strong> Mirá la página &ldquo;Reglas&rdquo; o preguntá al admin</li>
              <li className="flex items-start gap-2"><span className="text-[var(--gold)]">&#x2022;</span><strong>Olvidaste tu contraseña:</strong> Contactá al administrador para que te la resetee</li>
            </ul>
            <p className="mt-4 text-xs text-center text-muted-foreground/70">
              Este manual fue creado para ayudarte a usar el sistema de la forma más simple posible.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Spacer bottom */}
      <div className="h-8" />
    </div>
  )
}
