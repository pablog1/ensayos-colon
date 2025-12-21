# Orquesta - Sistema de Gestion de Rotativos

Sistema web para administrar rotativos de integrantes de una orquesta, con regla automatica del 5% sobre el promedio mensual.

**Produccion:** https://ensayos-colon-production.up.railway.app

## Stack Tecnologico

- **Next.js 16** (App Router)
- **Prisma** + PostgreSQL
- **NextAuth v5** (Credentials)
- **Tailwind CSS** + shadcn/ui

## Reglas de Negocio

- **Regla del 5%**: Ningun integrante puede exceder el promedio de rotativos del grupo + 5%
- **Periodo**: Mensual
- **Aprobacion**: Automatica si cumple la regla; casos especiales requieren aprobacion del admin

## Requisitos Previos

- Node.js 18+
- PostgreSQL (local o remoto)

## Instalacion

1. **Clonar e instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
```

Editar `.env` con tu configuracion de PostgreSQL:
```
DATABASE_URL="postgresql://usuario:password@localhost:5432/ensayos_colon?schema=public"
AUTH_SECRET="tu-secret-key-segura"
NEXTAUTH_URL="http://localhost:3000"
```

3. **Crear la base de datos y ejecutar migraciones:**
```bash
npm run db:push
```

4. **Cargar datos iniciales (admin y usuarios de prueba):**
```bash
npm run db:seed
```

## Credenciales de Prueba

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@orquesta.com | admin123 |
| Integrante | violin1@orquesta.com | integrante123 |
| Integrante | viola1@orquesta.com | integrante123 |

## Ejecucion

```bash
# Desarrollo
npm run dev

# Produccion
npm run build
npm start
```

Abrir [http://localhost:3000](http://localhost:3000)

## Funcionalidades

### Para Integrantes
- Ver calendario mensual con rotativos
- Solicitar nuevos rotativos
- Ver historial de solicitudes
- Ver estadisticas personales y del grupo

### Para Admin
- Todo lo anterior +
- Gestionar integrantes (crear, editar, eliminar)
- Aprobar/rechazar casos especiales (solicitudes que exceden el 5%)
- Ver estadisticas detalladas de todos los integrantes

## Comandos Utiles

```bash
npm run dev          # Iniciar en desarrollo
npm run build        # Build de produccion
npm run db:generate  # Generar cliente Prisma
npm run db:push      # Sincronizar schema con BD
npm run db:migrate   # Crear migracion
npm run db:seed      # Cargar datos iniciales
npm run db:studio    # Abrir Prisma Studio
```
