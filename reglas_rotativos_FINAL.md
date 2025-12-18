# Sistema de Gestión de Rotativos - VERSIÓN FINAL

## Terminología Oficial
- **Rotativo / Rotación**: Día libre asignado (NUNCA usar "descanso")
- **Bloque**: Título completo de una obra/producción
- **Cupo**: Cantidad máxima de rotativos disponibles por día
- **Artículo**: Ausencia justificada por normativa laboral (no cuenta como rotativo)

---

## 1. Usuarios y Permisos

| Rol | Cantidad (default) | Permisos |
|-----|-------------------|----------|
| Admin | 4 | Lectura, modificación, configuración, aprobación de solicitudes |
| Integrante | 11 | Solo lectura + solicitar rotativos |

- **Total de integrantes:** 15 personas (incluye los 4 admins)
- ⚙️ **Configurable:** La cantidad de usuarios y roles debe ser configurable en el sistema

---

## 2. Cupos Diarios

| Tipo de Evento | Cupo de Rotativos |
|----------------|-------------------|
| Ópera | 4 |
| Concierto | 2 |

- Los admins deben configurar el calendario con los cupos correspondientes

---

## 3. Solicitud de Rotativos

### 3.1 Proceso de Aprobación
- Los pedidos **NO se aprueban automáticamente** (por defecto)
- Entran en una **cola por orden de llegada**
- Si no hay cupo disponible, se informa la razón y pasa a **lista de espera**

> 📝 **Nota (sugerencia de Pablo):** Evaluar aprobación automática si el pedido no infringe ninguna regla.

### 3.2 Plazos de Solicitud

| Momento | Comportamiento |
|---------|----------------|
| Hasta el día anterior | Se puede solicitar si hay cupo disponible |
| El mismo día de la función | Se puede solicitar, pero queda **siempre pendiente de aprobación** |

> ⚠️ **Nota:** En teoría no deberían existir lugares libres el día de la función, ya que se "obliga" a rotar a quienes corresponda con 5 días de anticipación.

### 3.3 Tipos de Pedido

| Tipo | Descripción | Límite |
|------|-------------|--------|
| Por fecha | Día específico | Según cupo y máximo proyectado |
| Por bloque | Título/obra completa | **1 bloque por año por persona** |

#### Reglas de Bloques
- **Exclusividad:** Si alguien pide un bloque (ej: "La Traviata"), nadie más puede pedir ese mismo bloque
- **Contabilización:** Cada función del bloque cuenta individualmente para el máximo anual (~50)
- **Lista de espera:** Un bloque **puede estar en lista de espera**
- **Cancelación:** Si alguien cancela un bloque **antes de que comience**, queda disponible para otros
- **Restricción de cancelación:** ⚠️ **NO se puede cancelar un bloque una vez que comenzó**
- Los admins deben configurar cuáles son los bloques disponibles

### 3.4 Cancelación de Rotativos

| Tipo | ¿Se puede cancelar? | Condición |
|------|---------------------|-----------|
| Rotativo individual | ✅ Sí | Con aprobación del admin |
| Bloque (antes de iniciar) | ✅ Sí | Con aprobación del admin |
| Bloque (ya iniciado) | ❌ No | No permitido |

- No hay penalización por cancelar (cuando está permitido)
- Al cancelarse, el **primer solicitante en lista de espera** pasa al lugar liberado
- Se envía **notificación dentro del sistema** al beneficiado

### 3.5 Restricción de Fines de Semana
- Cada integrante puede tomar **máximo 1 fin de semana por mes**
- El fin de semana depende del calendario de funciones (puede ser sábado solo, o sábado y domingo)
- **Importante:** Si se toma solo el sábado de un fin de semana que incluye sábado y domingo, **cuenta como el fin de semana del mes**

### 3.6 Privacidad
- Los **motivos de los pedidos son siempre privados**

---

## 4. Lista de Espera

| Característica | Comportamiento |
|----------------|----------------|
| Vencimiento | No tiene (se purga al fin de temporada) |
| Múltiples fechas | Sí, se puede estar en lista de espera para varias fechas simultáneamente |
| Bloques | Sí, un bloque puede estar en lista de espera |
| Notificación | Automática dentro del sistema cuando se libera un cupo |
| Orden | Por llegada (FIFO) |

---

## 5. Límites y Cálculo de Máximos

### 5.1 Máximo Proyectado por Persona
```
Máximo = (Días a trabajar × Cupo diario) ÷ Cantidad de integrantes
```
- Aproximado: **~50 rotativos por persona/año**
- Se define al cargar los calendarios de la temporada
- **Este máximo puede excederse por rotación obligatoria** (sin límite de exceso)

### 5.2 Excepción: Bloques y Fines de Semana
- Si un bloque incluye múltiples fines de semana en diferentes meses, **el bloque tiene prioridad**
- La regla de "1 fin de semana por mes" **NO aplica** para bloques

### 5.3 Exceso de Máximo por Rotación Obligatoria
- **No hay límite** al exceso permitido
- El exceso **NO afecta** la participación futura del integrante
- **NO se registra** como excepción especial para el balance de fin de año

---

## 6. Asignación Obligatoria de Rotativos

Cuando **sobra personal** para un día y nadie solicita rotativo:

| Etapa | Plazo | Acción |
|-------|-------|--------|
| 1. Consenso | Más de 5 días antes | Los integrantes elegibles pueden acordar entre ellos |
| 2. Asignación forzada | Faltando 5 días | El sistema asigna automáticamente |

### Criterios de Selección (en orden):
1. **Primero:** Quienes tengan **menos días de rotativo tomados**
2. **En caso de empate:** Selección **al azar por el sistema**

### Registro del Consenso
- El consenso lo **definen y registran los admins**
- **No requiere** confirmación de todos los involucrados, solo de un admin
- Si no hay consenso antes del plazo de 5 días, **se define por azar del sistema**

### Empates Múltiples
- Si hay empate de N personas para M lugares: se sortean **todos los lugares de una vez**
- Ejemplo: 5 personas empatadas para 2 lugares → se sortean los 2 simultáneamente

### Registro de Auditoría
- Las decisiones por azar **quedan registradas** en el sistema

---

## 7. Cobertura por Causas Externas

Si el teatro necesita cubrir lugares por causas externas (ej: baja de personal contratado):

| Prioridad | Criterio |
|-----------|----------|
| 1° | Quienes **más rotativos hayan tomado** hasta el momento |
| 2° | En caso de empate: **consenso o azar** (registrado) |

---

## 8. Tipos de Ausencias y su Contabilización

| Tipo de Ausencia | ¿Cuenta como Rotativo? | ¿Reduce Derecho? | ¿Se Registra? |
|------------------|------------------------|------------------|---------------|
| Rotativo solicitado | ✅ Sí | N/A | ✅ Sí |
| Por "Artículo" | ❌ No | ❌ No | ✅ Sí |
| Falta justificada | ❌ No | ❌ No | ✅ Sí |
| Licencia | ❌ No | ✅ Sí (proporcional) | ✅ Sí |

### 8.1 Impacto de las Licencias en el Derecho a Rotativos

Cuando un integrante toma licencia, se le **suma al contador de rotativos** la cantidad promedio que tomó el resto **durante los días específicos de la licencia**.

#### Fórmula:
```
Rotativos sumados = REDONDEAR_ABAJO(
    Suma de rotativos tomados por el resto durante la licencia ÷ 
    Cantidad de integrantes activos durante la licencia
)
```

#### Momento del Cálculo:
- Se calcula **al momento de reincorporarse**
- El sistema genera una **alerta** si se vislumbran problemas con el balance

#### Ejemplo:
```
Situación: Juan toma licencia del 1 al 30 de marzo
Durante esos 30 días:
  - Total de rotativos tomados por los otros 14 integrantes = 70
  - Promedio = 70 ÷ 14 = 5

Resultado: A Juan se le suman 5 rotativos a su contador
```

### 8.2 Licencia y Bloques

Si un integrante tiene licencia durante **parte de un bloque** que había solicitado:

| Aspecto | Comportamiento |
|---------|----------------|
| Funciones afectadas | Se quitan automáticamente las que coinciden con la licencia |
| Elección del integrante | NO puede elegir cuáles conservar |
| Estado del bloque | Ya NO cuenta como bloque (pasa a ser rotativos individuales) |
| Nuevo bloque | NO puede pedir otro bloque ese año |
| Rechazo retroactivo | NO se rechaza, solo se reduce |

---

## 9. Integrantes Nuevos a Mitad de Temporada

Cuando ingresa un nuevo integrante durante la temporada:

### 9.1 Cálculo de Máximo Proyectado
```
Máximo para nuevo = Promedio de rotativos tomados por el resto al momento del ingreso
```

### 9.2 Ajustes
- El admin **puede modificar** este valor inicial manualmente
- El nuevo integrante participa normalmente en el sistema desde su fecha de ingreso

---

## 10. Requisitos del Calendario

El calendario debe incluir obligatoriamente:

- [ ] Título del evento/obra
- [ ] Horario de la función
- [ ] Tipo de evento (ópera/concierto) → determina el cupo
- [ ] Indicación de ensayo doble (si aplica)
- [ ] Configuración de bloques disponibles
- [ ] Definición de fines de semana según programación

### 10.1 Ensayos Dobles
- Cada ensayo es una **unidad de rotativo independiente**
- Un ensayo doble = **2 unidades de rotativo**

---

## 11. Temporada y Equilibrio

- La temporada es **anual**
- **Objetivo:** Terminar el año de la forma **más equilibrada posible** entre integrantes
- Los límites de rotativos se calculan respecto al **año completo**

### 11.1 Fin de Temporada

| Aspecto | Comportamiento |
|---------|----------------|
| Lista de espera | Se purga al finalizar la temporada |
| Ajuste por desequilibrio | **Sí**, se realiza ajuste final si hay desequilibrio importante |
| Logs | Se conservan solo del año en curso |

---

## 12. Sistema de Notificaciones

Todas las notificaciones se envían **dentro del sistema**:

| Evento | Destinatario |
|--------|-------------|
| Rotativo aprobado | Solicitante |
| Rotativo rechazado (con razón) | Solicitante |
| Paso de lista de espera a aprobado | Solicitante |
| Rotación obligatoria asignada | Integrante afectado |
| Cancelación de rotativo | Admin + siguiente en lista de espera |
| Alerta por problemas de balance post-licencia | Admin |
| Alerta por cercanía al máximo (90%) | Integrante + Admin |

---

## 13. Sistema de Alertas

### 13.1 Alerta de Cercanía al Máximo

| Parámetro | Valor (default) | Configurable |
|-----------|-----------------|--------------|
| Umbral de alerta | **90%** del máximo proyectado | ✅ Sí |

- Se notifica al integrante y al admin cuando se alcanza el umbral

### 13.2 Alerta Post-Licencia
- Se genera si el cálculo de rotativos sumados genera desequilibrio potencial

---

## 14. Configuraciones del Admin

| Configuración | Descripción | Default |
|---------------|-------------|---------|
| Calendario de funciones | Títulos, horarios, tipos, ensayos dobles | - |
| Bloques disponibles | Qué obras pueden pedirse como bloque | - |
| Cupos por tipo de evento | Ópera / Concierto | 4 / 2 |
| Fechas límite | Para diferentes tipos de solicitudes | - |
| Jerarquía de reglas | Orden de prioridad cuando hay conflictos | Ver sección 15 |
| Cantidad de usuarios/roles | Admins e integrantes | 4 / 11 |
| Umbral de alerta de máximo | Porcentaje para disparar alerta | 90% |
| Días para consenso antes de azar | Plazo para rotación obligatoria | 5 días |
| Máximo de integrante nuevo | Ajuste manual del promedio calculado | Promedio actual |

> ⚙️ **Nota:** Todos los valores numéricos deben ser configurables por el admin.

---

## 15. Jerarquía de Reglas (cuando hay conflicto)

> ⚙️ **Configurable por admin.** Orden sugerido por defecto:

1. **Cupo diario** (si no hay cupo, no hay rotativo)
2. **Bloque aprobado** (tiene prioridad sobre regla de fines de semana)
3. **Rotación obligatoria** (puede exceder máximo proyectado sin límite)
4. **Máximo proyectado anual**
5. **Restricción de fines de semana** (1 por mes)
6. **Orden de llegada** (para empates en cola)

---

## 16. Logs de Auditoría

| Aspecto | Definición |
|---------|------------|
| Eventos registrados | **Todos** los eventos del sistema |
| Acceso | **Todos** los usuarios (admins e integrantes) |
| Retención | **Año en curso** (se purgan al iniciar nueva temporada) |

### Eventos Registrados (incluye pero no se limita a):
- Solicitudes de rotativo (aprobadas, rechazadas, en espera)
- Cancelaciones
- Asignaciones por azar (con resultado del sorteo)
- Consensos registrados por admin
- Cambios de configuración
- Licencias y su impacto calculado
- Alertas generadas
- Ajustes de fin de temporada

---

## 17. Funcionalidades Requeridas del Dashboard

### 17.1 Para Integrantes
- [ ] Historial personal de rotativos
- [ ] Estado actual vs. máximo proyectado
- [ ] Rotativos en lista de espera
- [ ] Alertas personales

### 17.2 Para Admins
- [ ] **Dashboard de balance:** Estado de rotativos de cada integrante vs. promedio general
- [ ] **Alertas preventivas:** Cuando un integrante se acerca al máximo
- [ ] Vista general de solicitudes pendientes
- [ ] Gestión de consensos en rotación obligatoria
- [ ] Panel de configuración de parámetros

---

## 18. Proceso de Apelación

- **NO existe proceso de apelación formal en el sistema**
- Si un integrante desea apelar un rotativo rechazado, debe hacerlo **fuera del sistema**
- El admin evaluará caso por caso y tomará las acciones que correspondan manualmente

---

---

# ✅ DOCUMENTO COMPLETO

Todas las reglas han sido definidas. Este documento está listo para ser utilizado como especificación funcional del sistema.

## Resumen de Secciones

| # | Sección | Estado |
|---|---------|--------|
| 1 | Usuarios y Permisos | ✅ |
| 2 | Cupos Diarios | ✅ |
| 3 | Solicitud de Rotativos | ✅ |
| 4 | Lista de Espera | ✅ |
| 5 | Límites y Cálculo de Máximos | ✅ |
| 6 | Asignación Obligatoria | ✅ |
| 7 | Cobertura Externa | ✅ |
| 8 | Tipos de Ausencias | ✅ |
| 9 | Integrantes Nuevos | ✅ |
| 10 | Requisitos del Calendario | ✅ |
| 11 | Temporada y Equilibrio | ✅ |
| 12 | Notificaciones | ✅ |
| 13 | Sistema de Alertas | ✅ |
| 14 | Configuraciones del Admin | ✅ |
| 15 | Jerarquía de Reglas | ✅ |
| 16 | Logs de Auditoría | ✅ |
| 17 | Dashboard Requerido | ✅ |
| 18 | Proceso de Apelación | ✅ |

---

*Versión Final - Documento completo y validado*
*Fecha de última actualización: Diciembre 2024*
