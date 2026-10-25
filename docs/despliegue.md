# Preparación para publicar (pendiente de aprobación)

**Nada de esto se ha ejecutado.** No existe proyecto Supabase de producción, no se ha subido nada al remoto y `main` no se ha tocado. Este documento es la guía para cuando apruebes la publicación.

## 1. Antes de publicar

- Revisar y aprobar la rama `develop`.
- Decidir respaldo y migración (ver sección 5). **No se migran datos de proyectos anteriores ni de Google Sheets.**
- Confirmar el servicio de hosting estático (por ejemplo Vercel, Netlify o Cloudflare Pages).

## 2. Proyecto Supabase de producción (lo creas tú)

1. Crea un proyecto en https://supabase.com (región cercana, contraseña de base de datos fuerte y guardada en un gestor).
2. En **Authentication → Providers → Email**: deja habilitado el proveedor y **desactiva "Allow new users to sign up"** (equivale a `enable_signup = false` local).
3. En **Authentication → URL Configuration**: `Site URL` = URL final de la web; añade esa URL a *Redirect URLs* (para recuperar contraseña).
4. Configura un SMTP propio (Authentication → SMTP) para que lleguen los correos de recuperación.
5. Sube el esquema: `npx supabase login`, `npx supabase link --project-ref <ref>` y `npx supabase db push`. Aplica solo las migraciones de `supabase/migrations/`; **no** ejecutes `seed.sql` (contiene datos y un usuario demo solo para local).
6. Crea tu usuario en **Authentication → Users → Add user** (con *Auto Confirm*). El trigger crea perfil, hogar, catálogo de partida y Fondo General.
7. Comprueba en **Storage** que el bucket `comprobantes` existe y es privado (lo crea la migración).

## 3. Variables de entorno en el hosting

Solo valores **públicos**; nunca `service_role`:

| Variable | Valor |
|---|---|
| `VITE_APP_ENV` | `production` |
| `VITE_SUPABASE_URL` | URL del proyecto (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | clave *publishable/anon* del proyecto |

La guardia de `src/lib/env.ts` impide que una compilación de producción apunte a `localhost` y que desarrollo apunte a una URL remota.

Comando de build: `npm run build` · carpeta de salida: `dist` · Node 22 o superior. La aplicación es una SPA: configura la redirección de todas las rutas a `index.html`.

## 4. Despliegue de `main`

1. Con tu aprobación explícita, fusionar `develop` en `main` (esta etapa no lo hace).
2. Conectar el hosting a `main` y cargar las variables.
3. Verificar tras el despliegue: inicio de sesión, recuperación de contraseña (enlace del correo), crear un gasto, comprobante, exportación.

## 5. Respaldo y migraciones

- Esquema versionado en Git (`supabase/migrations`). Cada cambio nuevo = migración nueva; nunca editar una ya aplicada en producción.
- Datos: Supabase realiza copias diarias según el plan. Además, **Configuración → Exportar mis datos (JSON)** descarga una copia propia. Haz una exportación antes de cada migración importante.
- Antes de `db push` en producción: probar la migración sobre una copia o con `supabase db reset` local.

## 6. Pendientes conocidos antes de uso real

- Cuenta de usuario real y cambio de la contraseña inicial.
- Revisar que las plantillas, fondos y catálogo se ajusten a tu hogar.
- Decidir si se habilita colaboración familiar (el modelo ya está preparado con `household_id`; falta UI de invitaciones y roles).
