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
| Flujo de medios de pago (Sankey) | Se mostró en la propuesta visual a pedido del usuario, pero el último prompt vuelve a excluir gráficos por medios de pago: **no se implementó**. |
| Comparación con el mes calendario anterior | Si el rango es un mes completo se compara con el mes previo; si no, con un rango de igual duración. |
| Reordenar prioridad con simulación | `reorder_funds` admite dry-run: se explica el efecto antes de aplicar. |
| Foco al cerrar diálogos | `Modal` devuelve el foco al control que lo abrió. |
| Agregaciones del Dashboard en SQL | `dashboard_panel` (antes `dashboard_resumen`): ningún KPI depende del límite de 1000 filas del API. |
| `leerTodo` falla en lugar de truncar | Toda lectura que alimenta una cifra verifica el total declarado por el servidor. |
| Limpieza compensatoria de comprobantes | Intención previa + borrado tras fallo + tareas reintentables; nunca se borra un archivo en uso. |
| Usuario E2E propio y reinicio por prueba | `dev_reset_user` (solo local, en `seed.sql`) aísla las pruebas del seed demo. |
| Auditoría axe sin excepciones | Ver [accesibilidad.md](accesibilidad.md). El tono verde `--ok` se oscureció para cumplir contraste. |
| `verify:security` | Comprueba secretos, migraciones sin datos demo y un build de producción sin URLs locales. |
| Dashboard con filtros cruzados en la URL | Una sola fuente de verdad (`useFiltrosDashboard`) y una sola RPC (`dashboard_panel`) alimentan KPIs, gráficos, Top 5, recientes y fondos: no pueden divergir y las respuestas atrasadas no sobrescriben a las recientes (clave de consulta con filtros + cancelación). |
| Presupuesto consolidado con filtros | El presupuesto es siempre el del período completo; el gasto con filtros se muestra aparte («no se puede repartir por los filtros»). Registrar gastos nunca se bloquea por exceso. |
| Tooltip de la dona externo | El detalle del segmento se muestra fuera del anillo (lateral) para no tapar el total central; también se activa por teclado desde la leyenda. |
| Animaciones solo al abrir | `.anim-*` se desactivan en `data-state=closed` para que Radix no retenga la capa (un Escape rápido debe cerrar el diálogo). |
| Exportaciones en el navegador | CSV (`gasto-deejota-gastos-AAAA-MM-DD.csv`) y respaldo JSON (`…-respaldo-…json`, `version_esquema` 1) se arman con la sesión del usuario (RLS) leyendo por tandas con `leerTodo`; excluyen autoría, rutas de comprobantes, tokens y claves; las celdas CSV neutralizan fórmulas. Sin `service_role`. |
| Actividad de solo lectura | Se lee `audit_logs` (propietario) con paginación y filtros; los eventos sin usuario (semillas/cargas) son «sistema» y se ocultan por defecto. No hay escritura ni borrado desde la app. |
| Catálogo: rediseño en pausa | Tres prototipos aislados en `prototipos/catalogo/`; sin migraciones ni código de producción hasta que se elija propuesta. Ver [catalogo-propuestas.md](catalogo-propuestas.md). |
| Catálogo: propuesta G «Estudio de color» implementada | Elegida entre A–H. Lista + editor en línea + vista previa en vivo en claro y oscuro (nombres reales, sin importes). Migración aditiva `20261029000001_catalogo_color_hex`: `color_hex` (`#RRGGBB` en mayúsculas, con CHECK) en ámbitos, categorías y medios; `color_mode` (`own`/`inherit`) en categorías. `color_token` se conserva como respaldo. |
| Color efectivo resuelto en un solo lugar | `useCatalogo` entrega `color_css` (propio, heredado del ámbito o equivalente del token) y toda la app lo consume; los tonos por tema (`domain/color.ts`) garantizan 4.5:1 en texto y 3:1 en íconos, calculados sobre valores de 8 bits. En tema oscuro los HEX se aclaran con `--k-mix`/`--k-tint`. |
| Cambiar un color no toca el histórico | Los gastos guardan ids, no colores: recolorear nunca altera importes ni períodos cerrados. Armonizar es reversible desde el aviso. |
