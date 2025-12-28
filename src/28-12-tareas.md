# Tareas - 28/12/2024

## Sistema de Licencias

### Gestión de Licencias
**Prioridad:** Alta

**Descripción:**
Implementar un sistema de licencias que permita su registro tanto por el usuario que la solicita como por un administrador.

**Requisitos funcionales:**
- [ ] Permitir que el usuario registre su propia licencia
- [ ] Permitir que un administrador registre licencias en nombre de cualquier usuario
- [ ] Toda licencia debe ser aprobada por un administrador antes de hacerse efectiva
- [ ] Implementar flujo de aprobación para licencias pendientes

**Regla de cálculo:**
La licencia debe restar días de rotativos disponibles de forma **proporcional** a los cupos existentes durante el período de dicha licencia.

> **Ejemplo:** Si un usuario tiene licencia durante un período donde hay 10 cupos de rotativos disponibles, se le descuentan los días proporcionales según esos cupos.

---

## Sistema de Notas

### Notas en Calendario
**Prioridad:** Media

**Descripción:**
Permitir a los administradores agregar notas vinculadas a fechas específicas del calendario, independientemente de si existe un evento en esa fecha.

**Requisitos funcionales:**
- [ ] Permitir crear notas asociadas a cualquier día del calendario
- [ ] Permitir asociar notas a eventos existentes (opcional)
- [ ] Mostrar el título de la nota directamente en el calendario
- [ ] Mostrar la descripción completa de la nota en el sidebar al seleccionar el día
- [ ] Implementar selector de color para personalizar la apariencia de cada nota

**Campos de la nota:**
- Fecha
- Título (visible en calendario)
- Descripción (visible en sidebar)
- Color (personalizable)
- Evento asociado (opcional)

---

## Reglas de Rotativos

### Cancelación de Rotativos
**Prioridad:** Alta

**Descripción:**
Modificar las reglas de cancelación de rotativos para incluir un período mínimo de anticipación.

**Regla actual a implementar:**
- Los rotativos se pueden cancelar libremente **con más de 1 día de anticipación**
- Si la cancelación se solicita con **menos de 1 día de anticipación**, la cancelación queda en estado **pendiente de aprobación** por un administrador

**Requisitos funcionales:**
- [ ] Validar la fecha de cancelación contra la fecha del rotativo
- [ ] Si anticipación > 1 día: cancelar automáticamente
- [ ] Si anticipación <= 1 día: crear solicitud de cancelación pendiente
- [ ] Implementar flujo de aprobación/rechazo para cancelaciones pendientes
- [ ] Notificar al usuario y al admin  del estado de su solicitud de cancelación

---

### Alta de Nuevos Integrantes
**Prioridad:** Media

**Descripción:**
Definir cómo se asignan los rotativos cuando un nuevo músico se incorpora al grupo.

**Regla de asignación:**
El nuevo integrante recibe una cantidad de rotativos calculada para que no tenga **ni beneficio ni perjuicio** respecto al resto del grupo, basándose en los rotativos existentes a la fecha de su incorporación.

**Consideraciones importantes:**
- [ ] Calcular los rotativos proporcionales según la fecha de ingreso
- [ ] Evaluar si el nuevo integrante reemplaza a alguien que salió
- [ ] Si hay reemplazo, considerar la diferencia de rotativos entre quien sale y quien entra
- [ ] **Recalcular rotativos del resto del grupo** si el balance general se ve afectado
- [ ] Documentar el cálculo realizado para auditoría

**Impacto potencial:**
La entrada de un nuevo integrante (especialmente si reemplaza a alguien) puede requerir **ajustar los rotativos de todos los demás integrantes** para mantener la equidad del sistema.

> **Ejemplo:** Si el músico saliente tenía 5 rotativos utilizados y el entrante recibe 3 según el cálculo proporcional, puede ser necesario redistribuir la diferencia entre el resto del grupo.

---

## Notas Técnicas

- Todas las operaciones de aprobación requieren rol de administrador
- Los cálculos proporcionales deben documentarse para trazabilidad
- Considerar notificaciones push para cambios de estado en solicitudes
