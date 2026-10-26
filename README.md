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

Cuenta de acceso local (solo desarrollo): `demo@gastodeejota.local` / `DemoLocal123`. La crea `supabase/seed.sql` y **nada más**: la aplicación arranca **vacía** (sin ámbitos, categorías, subcategorías, medios de pago, fondos, presupuestos, plantillas ni gastos). Configura todo desde la interfaz: Catálogo → Fondos (con presupuesto) → primer gasto. El alta de cualquier usuario crea solo lo técnico (hogar, membresía y perfil).

Para las pruebas E2E añade a `.env.local` (no versionado) `E2E_USER_EMAIL` y `E2E_USER_PASSWORD` con **credenciales propias para ese usuario de pruebas** (cualquier correo y contraseña locales; no uses las del usuario demo). Para `npm run verify:seed` añade `DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD` con las del usuario demo.

## Reiniciar la base local

```
npm run db:reset                    # recrea la base, aplica migraciones y seed.sql (solo la cuenta de acceso, sin datos)
```

**Cuándo necesitas `npm run db:reset`:**

- Tras cambiar migraciones o `seed.sql`, o al actualizar el repositorio con migraciones nuevas.
- Si la cuenta de acceso no puede iniciar sesión (por ejemplo, tras reiniciar Docker con volúmenes nuevos). **Ojo:** vuelve a dejar la contraseña de desarrollo del seed.
- Si `npm run verify:seed` informa datos inesperados.
- **No** lo necesitas por ejecutar las pruebas: las E2E cargan sus fixtures (`supabase/fixtures/e2e.sql`) al empezar, usan su propio usuario y hogar, y al terminar eliminan ese usuario, sus datos y las funciones de fixtures. La cuenta de acceso no se toca.

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
| `npm run db:reset` | Recrea la base con migraciones y la cuenta de acceso (sin datos) |
| `npm run db:test` | Pruebas pgTAP: RLS, jerarquía, motor de fondos, idempotencia, períodos cerrados |
| `npm run db:types` | Regenera los tipos TypeScript desde el esquema |
| `npm run verify:seed` | Comprueba que la base local está vacía, que la cuenta de acceso funciona y que no quedan rastros de pruebas |
| `npm run verify:security` | Comprueba ausencia de secretos versionados, que las migraciones no crean usuarios ni datos demo y que el build de producción no incrusta URLs locales |
| `npm run test:all` | Typecheck, lint, Vitest, pgTAP, E2E (incluye axe), verificación del seed y de seguridad |

Studio local: http://127.0.0.1:54323 · Correos de prueba (Mailpit): http://127.0.0.1:54324

**Aislamiento de las pruebas E2E:** `e2e/global-setup.ts` carga las fixtures (`supabase/fixtures/e2e.sql`, fuera del seed y de las migraciones) y reinicia un hogar de demostración de un usuario **propio** de pruebas mediante `dev_reset_user`; `e2e/global-teardown.ts` elimina ese usuario, su hogar y las funciones `dev_*`, de modo que la base queda vacía al terminar. Requiere Docker y Supabase local en marcha. Las capturas de `e2e/visual.spec.ts` se guardan en `capturas/` (no versionado).

## Entorno seguro

`VITE_APP_ENV` es obligatorio. `src/lib/env.ts` bloquea el modo desarrollo contra cualquier URL que no sea local, y producción contra localhost.

## Documentación

- [Arquitectura y modelo de datos](docs/arquitectura.md)
- [Accesibilidad](docs/accesibilidad.md)
- [Reglas de asignación de fondos](docs/reglas-fondos.md)
- [Decisiones técnicas](docs/decisiones.md)
- [Preparación para publicar](docs/despliegue.md) (pendiente de tu aprobación)
- [Rediseño del Catálogo: propuestas A/B/C](docs/catalogo-propuestas.md) (solo diseño; prototipos en `prototipos/catalogo/`)
