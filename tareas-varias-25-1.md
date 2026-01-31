# Tareas Varias - 25/1

## Estado de Implementacion

| # | Tarea | Estado |
|---|-------|--------|
| 1 | Justificativo de rotativos para miembros nuevos | Completado |
| 2 | Alerta de cupos no cubiertos antes de eventos | Completado |
| 3 | Signo de alerta en estadisticas cuando cupo completo | Completado |
| 4 | Aclaracion "Titulos completos" | Completado |
| 5 | Aclaracion "Licencias prolongadas" | Completado |
| 6 | Alerta de cercania a limite no funciona | Completado |
| 7 | Aclaracion "Funciones por titulo" | Completado |
| 8 | Eliminar texto de bloque completo | Completado |
| 9 | Completar informacion en logs de rotativos | Completado |
| 10 | Bug: Usuario no puede solicitar titulo disponible | Completado |
| 11 | Completar informacion en alertas | Completado |
| 12 | Bug: Usuario no puede unirse a lista de espera | Completado |

---

## 1. Justificativo de rotativos para miembros nuevos
**Descripcion:** Cuando se incorpora gente nueva, el sistema debe mostrar junto a la lista de miembros en las estadisticas (ver: rotativos x integrante) el justificativo de los rotativos que asigno el sistema (fecha, cantidad, etc.).
- El admin debe poder modificar esta cantidad
- Registrar la fecha de comienzo de actividad de cualquier nuevo miembro
- **Minimo requerido:** Al crear un usuario nuevo, se debe ingresar la fecha de comienzo de actividad

**Estado:** Completado
- Se agrego campo obligatorio de "Fecha de inicio de actividad" al crear usuarios nuevos (integrantes)
- El sistema calcula automaticamente el maximo proyectado basado en el promedio del grupo
- Se guarda justificacion con fecha de ingreso, cantidad asignada y explicacion
- Se muestra el justificativo en la pagina de estadisticas (icono UserPlus y detalle expandible)

---

## 2. Alerta de cupos no cubiertos antes de eventos
**Descripcion:** Si un dia antes de cualquier evento los cupos no estan perfectamente cubiertos, el admin debe recibir alerta y notificacion.
- **Estado:** Fue implementado pero no funciona

**Estado:** Completado
- El endpoint `/api/cron/eventos-sin-cubrir` existe y funciona correctamente
- Se creo archivo `vercel.json` con la configuracion de cron jobs:
  - `/api/cron/eventos-sin-cubrir` - Diario a las 9:00 UTC
  - `/api/cron/verificar-bajo-cupo` - Semanal los lunes a las 10:00 UTC

---

## 3. Signo de alerta en estadisticas cuando cupo esta completo
**Descripcion:** En la seccion de estadisticas falta mostrar un signo de alerta cuando el cupo esta completo.

**Estado:** Completado
- Se agrego icono de alerta (triangulo amarillo) junto al badge "Cupo completo" en vista mobile y desktop

---

## 4. Aclaracion en reglas: "Titulos completos"
**Descripcion:** Agregar un punto mas que diga: "Si hubieran mas titulos disponibles se podran tomar mas titulos por persona, previa revision del admin (con validacion de la fila)."
- Solo cambio de texto, no implica cambio logico

**Estado:** Completado

---

## 5. Aclaracion en reglas: "Licencias prolongadas"
**Descripcion:** Agregar al texto: "independientemente si fueron cubiertas o no".
- Solo cambio de texto, no implica cambio logico

**Estado:** Completado

---

## 6. Alerta de cercania a limite no funciona
**Descripcion:** La notificacion de alerta por cercania al limite no funciona (ej: bajo cupo).
- **Caso de prueba:** Se hizo bajar a un usuario por debajo del limite, aparecio el cartel bajo cupo pero no alerto la campanita (no se emitio la notificacion)

**Estado:** Completado
- Se creo nuevo endpoint `/api/cron/verificar-bajo-cupo` que:
  - Detecta usuarios por debajo del promedio del grupo
  - Notifica a los admins cuando hay casos criticos
  - Se puede ejecutar manualmente o como cron job periodico

---

## 7. Aclaracion en reglas: "Funciones por titulo"
**Descripcion:** Agregar al texto: "con validacion de la fila."
- Solo cambio de texto, no implica cambio logico

**Estado:** Completado

---

## 8. Eliminar texto de bloque completo en listado de titulos
**Descripcion:** En el listado de titulos disponibles para pedir rotativos (a la derecha del calendario), si un usuario esta cerca de haber pedido un bloque completo, sale un texto que dice por ejemplo "Tenes 5 rotativo(s), podes completar el bloque".
- **Accion:** Eliminar este texto

**Estado:** Completado

---

## 9. Completar informacion en logs de rotativos
**Descripcion:** Agregar mas detalles en todos los tipos de registros del log de rotativos.
- **Ejemplo actual:** "Vero solicito rotativo para [titulo] Ensayo"
- **Debe incluir:** fecha, horario, y tipo de evento
- **Otro ejemplo:** "Contratado 1 fue promovido de la lista de espera" - falta dia, tipo de evento, horario, etc.

**Estado:** Completado
- Se modifico la funcion `getLogDescription` para mostrar fecha, hora y tipo de evento
- Se agregaron los campos `horario` y `tipoEvento` a los audit logs de:
  - Creacion de rotativos
  - Aprobacion de rotativos
  - Rechazo de rotativos
  - Lista de espera (agregado y promovido)

---

## 10. Bug: Usuario no puede solicitar titulo disponible
**Descripcion:** El usuario "Contratado 1" no pudo solicitar el titulo "conc fuera de sede" aunque estaba disponible.
- **Estado:** Bug a investigar

**Estado:** Completado
- El bug era causado por `maxProyectado = 0` en el balance del usuario
- Se corrigio la funcion `calcularMaxProyectadoReal` en `/src/lib/services/balance.ts`:
  - Ahora garantiza un minimo de 1 rotativo
  - Evita division por 0 cuando no hay integrantes o cupos

---

## 11. Completar informacion en alertas
**Descripcion:** En las alertas, los mensajes deben incluir: fecha, horario y tipo de evento.

**Estado:** Completado
- Las notificaciones incluyen informacion del evento en el campo `data`
- Los logs muestran esta informacion
- Los mensajes de notificacion push ahora incluyen:
  - Fecha formateada (ej: "viernes, 31 de enero")
  - Horario (ej: "a las 14:30")
  - Tipo de evento (ej: "Ensayo", "Concierto")
- Actualizado en: aprobacion, rechazo, y rotacion obligatoria

---

## 12. Bug: Usuario no puede unirse a lista de espera
**Descripcion:** El usuario "Contratado 1" no pudo solicitar unirse a la lista de espera en el titulo "conc fuera de sede" aunque estaba disponible.
- **Fecha de prueba:** 23 de abril
- **Nota:** Funciono con el usuario "Fernando" el 18 de abril, quien aparentemente tiene la misma situacion
- **Estado:** Bug a investigar
- **Error:** "Excede maximo proyectado anual (3/0). Nota: No hay cupo disponible, quedaras en lista de espera."

**Estado:** Completado
- Mismo bug que la tarea 10 (maxProyectado = 0)
- Corregido con la misma solucion
