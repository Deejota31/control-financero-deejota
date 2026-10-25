# Gasto Deejota

Control de gastos personales y familiares. React + TypeScript + Vite + Tailwind + Supabase.

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

Usuario demo local (solo desarrollo): `demo@gastodeejota.local` / `DemoLocal123`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck y build de producción |
| `npm run check` | Typecheck, lint y pruebas unitarias |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright (requiere `db:start`) |
| `npm run db:start` / `db:stop` | Arranca o detiene Supabase local |
| `npm run db:reset` | Recrea la base con migraciones y datos demo |
| `npm run db:test` | Pruebas pgTAP de RLS |

Studio local: http://127.0.0.1:54323 · Correos de prueba: http://127.0.0.1:54324

## Entorno seguro

`VITE_APP_ENV` es obligatorio. `src/lib/env.ts` bloquea el modo desarrollo contra cualquier URL que no sea local, y producción contra localhost.

Decisiones técnicas: [docs/decisiones.md](docs/decisiones.md).
