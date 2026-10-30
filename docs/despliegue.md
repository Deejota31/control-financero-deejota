# Preparación para publicar (pendiente de aprobación)

**Nada de esto se ha ejecutado.** No existe proyecto Supabase de producción (el repositorio no está enlazado a ningún proyecto remoto), no se ha subido nada al remoto y `main` no se ha tocado. Este documento es la guía para cuando apruebes la publicación.

## 0. Qué se publica y qué se queda en el repositorio

| Se publica | Dónde |
|---|---|
| **La aplicación**: carpeta `dist/` (resultado de `npm run build`: HTML, JS y CSS estáticos) | Hosting estático |
| **El esquema**: `supabase/migrations/*.sql`, aplicado al proyecto Supabase remoto con `db push` | Proyecto Supabase |

Todo lo demás vive solo en Git y **no** va a producción: `src/` (se compila a `dist/`), `e2e/`, pruebas unitarias `*.test.ts`, `supabase/tests/` (pgTAP), `supabase/fixtures/e2e.sql` y `supabase/seed.sql` (solo entorno local), `scripts/`, `docs/`. Se versionan porque son lo que permite mantener y verificar el producto.
Son salidas regenerables y **no** se versionan: `dist/`, `node_modules/`, `test-results/`, `playwright-report/`, `capturas/`, `qa/`, `respaldos/` (copias de datos reales), `supabase/.temp/` y `supabase/snippets/`.

## 1. Antes de publicar

- Revisar y aprobar la rama `develop`.
- Decidir respaldo y migración (ver sección 5). **No se migran datos de proyectos anteriores ni de Google Sheets.**
- Ejecutar los controles: `npm run verify:release -- --instalacion` (calidad, contenido de `dist/`, migraciones, repositorio y prueba de instalación desde cero). Para el paquete final, constrúyelo con las variables de producción y añade `--produccion`.
- Confirmar el servicio de hosting estático (por ejemplo Vercel, Netlify o Cloudflare Pages).

## 2. Proyecto Supabase de producción (lo creas tú)

1. Crea un proyecto en https://supabase.com (región cercana, contraseña de base de datos fuerte y guardada en un gestor).
2. En **Authentication → Providers → Email**: deja habilitado el proveedor y **desactiva "Allow new users to sign up"** (equivale a `enable_signup = false` local).
3. En **Authentication → URL Configuration**: `Site URL` = URL final de la web; añade esa URL a *Redirect URLs* (para recuperar contraseña).
4. Configura un SMTP propio (Authentication → SMTP) para que lleguen los correos de recuperación.
5. Sube el esquema: `npx supabase login`, `npx supabase link --project-ref <ref>` y `npx supabase db push`. Aplica solo las migraciones de `supabase/migrations/`; **no** ejecutes `seed.sql` (cuenta demo, solo local: `db push` no lo carga, pero tampoco lo cargues a mano). `db push` es la **primera** vez que una migración llega a un proyecto remoto: hasta entonces todas son locales.
6. Crea tu usuario en **Authentication → Users → Add user** (con *Auto Confirm*). El trigger `handle_new_user` crea **solo** lo técnico: hogar, membresía `owner` y perfil. El catálogo (ámbitos, categorías, subcategorías, medios de pago), los fondos de cada mes y las plantillas se configuran desde la aplicación; la cuenta nueva empieza vacía.
7. Comprueba en **Storage** que el bucket `comprobantes` existe y es privado (lo crea la migración).

## 3. Variables de entorno en el hosting

Solo valores **públicos**; nunca `service_role`:

| Variable | Valor |
|---|---|
| `VITE_APP_ENV` | `production` |
| `VITE_SUPABASE_URL` | URL del proyecto (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | clave *publishable/anon* del proyecto |

La guardia de `src/lib/env.ts` impide que una compilación de producción apunte a `localhost` y que desarrollo apunte a una URL remota.

Comando de build: `npm run build` · carpeta de salida: `dist` · Node 22. `netlify.toml` ya lo configura (comando, carpeta, Node 22, redirección de la SPA a `index.html` y cabeceras de seguridad). **Las variables `VITE_*` se incrustan al construir:** defínelas en Netlify (Site configuration → Environment variables) ANTES del primer despliegue y vuelve a desplegar si las cambias.

## 4. Despliegue de `main`

1. Con tu aprobación explícita, fusionar `develop` en `main` (esta etapa no lo hace).
2. Conectar el hosting a `main` y cargar las variables.
3. Verificar tras el despliegue: inicio de sesión, recuperación de contraseña (enlace del correo), crear un gasto, comprobante, exportación.

## 5. Respaldo y migraciones

- Esquema versionado en Git (`supabase/migrations`). Cada cambio nuevo = migración nueva; nunca editar, renombrar ni reordenar una ya aplicada.
- **Versionado:** Supabase ordena por el prefijo numérico (`AAAAMMDDHHMMSS`) y no aplica una migración con versión menor que la última ya aplicada. Hoy la última es de 2026-11-03 aunque el calendario esté antes: **toda migración nueva debe llevar una versión mayor que la más alta existente**, sea cual sea la fecha real, y nunca generarse con `supabase migration new` si el reloj queda por debajo. `npm run verify:release` comprueba que las versiones sean únicas.
- **Antes del primer despliegue** conviene decidir una sola vez entre conservar las 24 migraciones incrementales o consolidarlas en un esquema inicial. Ver [decisiones.md](decisiones.md) («Migraciones: incrementales hasta el primer despliegue»): la recomendación vigente es conservarlas, porque ya existe una base local con datos que se actualizó migración a migración y una consolidación no se puede aplicar sobre ella.
- `20261101000001_fondos_por_periodo.sql` crea el esquema `respaldo_fondos` con copias de los datos previos al cambio de modelo. En una base nueva esas tablas nacen vacías: no estorban y **no se eliminan** en bases existentes (son el respaldo de esa migración).
- Prueba de una instalación nueva: `npm run verify:install` crea una base desechable (`gd_instalacion_tmp`) en el contenedor local, aplica todas las migraciones en orden, revisa RLS y `search_path`, ejecuta pgTAP y la borra. No toca la base de desarrollo.
- Datos: Supabase realiza copias diarias según el plan. Además, **Configuración → Exportar mis datos (JSON)** descarga una copia propia. Haz una exportación antes de cada migración importante.
- Antes de `db push` en producción: probar la migración con `npm run verify:install` y, si hay datos que preservar, sobre una **copia** de la base. `supabase db reset` borra la base local: no lo uses sobre una base con datos útiles.

## 6. Configuración de Auth en el proyecto remoto (resumen)

- Email habilitado, registro público **desactivado**, `Site URL` y *Redirect URLs* con la URL final, SMTP propio (sección 2). La configuración local equivalente está en `supabase/config.toml` (`[auth]`); el proyecto remoto se configura en el panel, no con `db push`.
- Las sesiones de otra persona en el mismo navegador no se mezclan: la caché de datos se crea por usuario (`ConsultasPorUsuario`).

## 7. Pendientes conocidos antes de uso real

- Cuenta de usuario real y cambio de la contraseña inicial.
- Revisar que las plantillas, fondos y catálogo se ajusten a tu hogar.
- Decidir si se habilita colaboración familiar (el modelo ya está preparado con `household_id`; falta UI de invitaciones y roles).
