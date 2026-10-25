# Decisiones técnicas

| Decisión | Motivo |
|---|---|
| npm como gestor | Ya instalado, sin lockfile previo. |
| Supabase CLI como devDependency (`npx supabase`) | Sin instalación global; versión fijada en el lockfile. |
| `@hookform/resolvers@5` | La v6 genera conflicto de peer dependencies opcionales con `effect`; la v5 es compatible con Zod 4. |
| Zod 4.6.7 | Versiones previas tienen una advisory de alta severidad (consumo de memoria). |
| Paleta B "Índigo" | Elegida por el usuario tras revisar 5 propuestas. Tokens en `src/index.css`. |
| Registro público desactivado | App de uso personal. Usuarios por seed o Studio. |
| Contraseña mínima de 8 caracteres | Endurece el valor por defecto de Supabase local. |
| Modelo con `household_id` | Permite colaboración familiar futura sin rediseñar. Hoy un hogar por usuario. |
| Motor de asignación de fondos en SQL | Una sola fuente de verdad; el TypeScript solo previsualiza. |
| Guardia de entorno (`src/lib/env.ts`) | Desarrollo solo contra Supabase local; producción nunca contra localhost. |
| Fondos: sin gasto "sin imputar" | Corrige la ETAPA 2. El General absorbe el excedente y puede quedar negativo; si ningún fondo admite la combinación, se bloquea. Ver [reglas-fondos.md](reglas-fondos.md). |
| `[auth.email] enable_signup = true` | Ese ajuste habilita el proveedor de correo; en `false` bloquea también el inicio de sesión (`email_provider_disabled`). El registro público lo bloquea `[auth] enable_signup = false`. |
| Credenciales E2E en `.env.local` | Las pruebas Playwright leen `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` de un archivo no versionado. |
| Respuesta neutra al recuperar contraseña | No revela si un correo está registrado. |
| Sesión "vencida" distinta de "cerrada" | Un `SIGNED_OUT` sin cierre explícito del usuario lleva a `/sesion-expirada`. |
| Proyección de cierre y ritmo ideal | Se muestran como estimaciones. |
| Sin conversión USD | El prompt original no permite inventar tipos de cambio. |
| Flujo de medios de pago (Sankey) | Pedido posterior del usuario; sustituye la exclusión del prompt original. |
