# Gasto Deejota

Control de gastos personales y familiares. React + TypeScript + Vite + Tailwind + Supabase.

Módulos: Dashboard · Gastos · Fondos presupuestales · Catálogo · Salud financiera · Configuración (acceso, sesión y perfil).

## Requisitos

- Node.js 22 o superior (`node -v`)
- Docker Desktop abierto (para Supabase local)

## Puesta en marcha

PowerShell o Bash (igual):

```
npm install
npx playwright install chromium     # solo la primera vez, para pruebas E2E
npm run db:start                    # Supabase local; imprime URL y clave publishable
```

Crea `.env.local` a partir de `.env.example` con la URL y la clave **publishable** que imprime `db:start` (o `npx supabase status`). Nunca uses claves `service_role` ni de producción aquí.

```
npm run dev                         # http://127.0.0.1:5173
```

Usuario demo local (solo desarrollo): `demo@gastodeejota.local` / `DemoLocal123`. Lo crea `supabase/seed.sql` junto con fondos, plantillas y tres meses de gastos marcados como **DEMO**. No hay registro público: para crear otro usuario local usa Studio (http://127.0.0.1:54323 → Authentication → Add user → *Auto Confirm*).

Para las pruebas E2E añade a `.env.local` (no versionado) `E2E_USER_EMAIL` y `E2E_USER_PASSWORD` con **credenciales propias para ese usuario de pruebas** (cualquier correo y contraseña locales; no uses las del usuario demo). Para `npm run verify:seed` añade `DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD` con las del usuario demo.

## Reiniciar la base local y volver a sembrar los datos demo

```
npm run db:reset                    # recrea la base, aplica migraciones y seed.sql
```

**Cuándo necesitas `npm run db:reset`:**

- Tras cambiar migraciones o `seed.sql`, o al actualizar el repositorio con migraciones nuevas.
- Si el usuario demo no puede iniciar sesión (por ejemplo, tras reiniciar Docker con volúmenes nuevos).
- Si `npm run verify:seed` informa datos mezclados o faltantes.
- **No** lo necesitas por ejecutar las pruebas: las E2E usan su propio usuario y hogar, que se reinician antes y después de cada prueba (también si falla). El usuario demo no se toca.

Tras cambiar el esquema: `npm run db:types` regenera `src/lib/database.types.ts`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck y build de producción |
| `npm run check` | Typecheck, lint y pruebas unitarias |
| `npm test` | Vitest (lógica de dominio, formularios, sesión) |
| `npm run test:e2e` | Playwright (requiere `db:start` y `.env.local` con credenciales E2E) |
| `npm run db:start` / `db:stop` | Arranca o detiene Supabase local |
| `npm run db:reset` | Recrea la base con migraciones y datos demo |
| `npm run db:test` | Pruebas pgTAP: RLS, jerarquía, motor de fondos, idempotencia, períodos cerrados |
| `npm run db:types` | Regenera los tipos TypeScript desde el esquema |
| `npm run verify:seed` | Comprueba que el seed demo sigue usable y sin datos de prueba mezclados |
| `npm run verify:security` | Comprueba ausencia de secretos versionados, que las migraciones no crean usuarios ni datos demo y que el build de producción no incrusta URLs locales |
| `npm run test:all` | Typecheck, lint, Vitest, pgTAP, E2E (incluye axe), verificación del seed y de seguridad |

Studio local: http://127.0.0.1:54323 · Correos de prueba (Mailpit): http://127.0.0.1:54324

**Aislamiento de las pruebas E2E:** `e2e/global-setup.ts` y el fixture de `e2e/fixtures.ts` crean y reinician (borrado en cascada y nuevo seed) el hogar de un usuario **propio** de pruebas mediante `public.dev_reset_user`, una función que solo existe en bases locales (la define `seed.sql`, no una migración) y que la API no puede invocar. Así ningún fondo, gasto o catálogo de prueba se mezcla con el seed demo. Requiere Docker y Supabase local en marcha. Las capturas de `e2e/visual.spec.ts` se guardan en `capturas/` (no versionado).

## Entorno seguro

`VITE_APP_ENV` es obligatorio. `src/lib/env.ts` bloquea el modo desarrollo contra cualquier URL que no sea local, y producción contra localhost.

## Documentación

- [Arquitectura y modelo de datos](docs/arquitectura.md)
- [Accesibilidad](docs/accesibilidad.md)
- [Reglas de asignación de fondos](docs/reglas-fondos.md)
- [Decisiones técnicas](docs/decisiones.md)
- [Preparación para publicar](docs/despliegue.md) (pendiente de tu aprobación)
