# Gate 0 — Diagnóstico: identidad, onboarding, privacidad, notificaciones y seguridad

Fecha: 2026-11-20 · Alcance: especificación «PROMPT_MAESTRO_DEEJOTA_V2_EXHAUSTIVO». **Este documento no implementa nada**: audita el estado real, lista brechas y propone el plan por gates. Todo lo que no se pudo comprobar se marca **NO VERIFICADO**.

> Limitación de esta auditoría: Docker estaba cerrado, por lo que el esquema se auditó **desde las migraciones versionadas** y la configuración del repositorio, no contra la base viva. La comprobación viva (RLS, políticas, `search_path`) ya la hace `npm run verify:install` sobre una base desechable y pasó con las 32 migraciones; la auditoría adversarial con usuarios A/B contra la base viva queda para el Gate 1.

## 1. Mapa de arquitectura (hechos del repositorio)

**Frontend:** React 19 + TypeScript + Vite + Tailwind v4, SPA estática (Netlify, `dist/`), PWA con `sw.js` propio. Sin analytics, sin trackers, sin SDK de terceros de identidad.
**Backend:** Supabase (Auth, PostgREST con RLS, Storage, Edge Function `exchange-rate`). Proyecto remoto `etdmfawgyavkfpulenpu`; local con Docker.

**Rutas** (`src/app/App.tsx`): públicas `/acceso`, `/recuperar` (solo sin sesión), `/restablecer`, `/sesion-expirada`; privadas bajo `RequireAuth`: `/`, `/gastos`, `/fondos`, `/eventos`, `/eventos/:id`, `/catalogo`, `/configuracion`; cualquier otra → `/`. **No existen** `/registro`, `/callback`, onboarding, políticas legales ni 404 propia.

**Auth hoy** (`src/features/auth`): `AuthProvider` con estados `loading | authenticated | unauthenticated | expired | error`; `signInWithPassword`, `resetPasswordForEmail`, `updateUser({password})`. `AccesoSocial.tsx` pinta los botones Google/Facebook **deshabilitados** («Aún no disponible»): hoy no hay OAuth, SDK ni redirección.

**Configuración Supabase Auth** (`supabase/config.toml`, local): `enable_signup = false` (**el registro público está cerrado**), `enable_manual_linking = false`, `minimum_password_length = 8` sin requisitos de complejidad, `enable_confirmations = false` (sin confirmación de correo), `secure_password_change = false`, `jwt_expiry = 3600`, rotación de refresh tokens activa, MFA no verificado. Proveedores externos: solo la plantilla de Apple (deshabilitada). **La configuración del proyecto remoto es NO VERIFICADO** (vive en el panel de Supabase, no en el repositorio).

**Modelo de identidad** (migraciones): `profiles` (PK `user_id` → `auth.users`, `display_name`, `timezone`, `date_format`, `theme`, `display_currency = 'PEN'`, `household_id`, `planning_reminders`), `households` (`created_by`), `household_members` (`role` solo admite `'owner'`). El trigger `handle_new_user` (SECURITY DEFINER, `search_path` vacío) crea **un hogar + membresía `owner` + perfil por cada fila nueva de `auth.users`**, sin catálogo ni datos. Funciones `current_household_id()` e `is_household_member()` (SECURITY DEFINER, `search_path` vacío, ejecución solo para `authenticated`).

**Datos financieros:** ámbitos/categorías/subcategorías/medios, gastos (PEN/USD), fondos y reglas, imputaciones, períodos, plantillas, eventos/conceptos/compromisos, caché de cotizaciones (pública de solo lectura), `audit_logs`, `idempotency_requests`, `storage_cleanup_tasks`. RLS por hogar; `verify:install` confirma «todas las tablas de `public` tienen RLS» y «toda función SECURITY DEFINER fija su `search_path`» (≈77 funciones SECURITY DEFINER).

**Storage:** bucket `comprobantes` **privado**, 5 MiB, MIME `jpeg/png/webp/pdf`; políticas por primer segmento de la ruta = `household_id` + membresía. No hay bucket de avatares.

**PWA:** `manifest.webmanifest` (standalone, iconos, atajos), `sw.js` que **solo cachea recursos estáticos del propio origen** y nunca `/rest/`, `/auth/`, `/storage/`, `/functions/`; sin `push`, sin `Notification`, sin `showNotification`.

**Hosting/cabeceras** (`netlify.toml`): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; **no hay CSP ni HSTS configurados** en el repositorio (HSTS puede venir de Netlify: NO VERIFICADO).

**Almacenamiento del navegador:** `localStorage` solo `gd-limpieza-pendiente` (tareas de limpieza de comprobantes) y preferencias de interfaz propias (`usePreferencia`); la sesión de Supabase usa su almacenamiento estándar. Sin cookies propias, sin analytics, sin píxeles.

**Pruebas existentes:** 595 unitarias, 100+ pgTAP, ~505 E2E Playwright, PWA, `verify:security`, `verify:install`.

## 2. Inventario de funcionalidades frente a la especificación

| Bloque (sección del documento) | Estado | Evidencia / brecha |
| --- | --- | --- |
| Login correo/contraseña, reset, cierre de sesión (02.2) | **Existente y correcto** | `LoginPage`, `RecoverPage`, `ResetPasswordPage`; sesión expirada con pantalla propia |
| Registro público (02, 03) | **Ausente por decisión** | `enable_signup = false`; no hay ruta ni formulario de registro |
| Confirmación de correo (02.2) | **Ausente** | `enable_confirmations = false` |
| Google / Facebook (02.1) | **Ausente** | solo botones visuales deshabilitados; faltan callback, PKCE/estado, scopes, configuración de proveedores |
| Vinculación de identidades (02.3) | **Ausente** | `enable_manual_linking = false`; sin UI |
| Contraseña opcional para OAuth, MFA, sesiones, reautenticación (02.2, 07) | **Ausente** | sin UI de seguridad de cuenta |
| Máquina de estados de sesión con guards en servidor (02.4) | **Parcial** | guards de ruta en cliente; falta estado de cuenta server-side (`deactivated`, `deletion_pending`) |
| Perfil: alias, zona, formato, tema (04.1, 04.2) | **Existente** | `display_name`, `timezone`, `date_format`, `theme` en `profiles` + Configuración |
| Foto de perfil/avatar (04.1) | **Ausente** | sin bucket ni UI |
| Hogar: nombre editable (04.3, 07) | **Parcial** | el hogar se crea automáticamente al alta; Configuración → Hogar existe; el rol solo admite `owner` |
| Onboarding persistente y reanudable (04) | **Ausente** | sin estado de progreso |
| Tour de primer uso (05) | **Ausente** | sin tutorial |
| Planificación mensual (05) | **Existente** | asistente en Fondos |
| Campana / bandeja interna (06) | **Ausente** | sin tabla ni UI |
| Recordatorios (06) | **Parcial** | `profiles.planning_reminders` solo gobierna una **invitación dentro de la app** (`InvitacionPlanificacion`, `EstadoPlanificacion`); no hay entrega server-side, ni bandeja, ni push |
| Push PWA / VAPID (06) | **Ausente** | sin `push` en el service worker, sin suscripciones |
| Scheduler server-side (06) | **Ausente** | no hay pg_cron ni cron de Edge Functions en el repositorio |
| Configuración granular de notificaciones (06, 07) | **Ausente** | |
| Desactivar / reactivar cuenta (08) | **Ausente** | |
| Eliminar cuenta y ARCO (08, 09) | **Ausente** | existe exportación CSV/JSON de datos propios (07) |
| Documentos legales (T&C, Privacidad, Cookies) (09) | **Ausente** | sin rutas ni versiones |
| Consentimientos versionados y revocables (09) | **Ausente** | sin tablas |
| Banner de cookies (09) | **No aplica hoy** | no hay cookies/trackers opcionales; solo almacenamiento necesario |
| Auditoría de cambios sensibles (07, 10) | **Parcial** | `audit_logs` de datos financieros; sin `security_events` de cuenta |
| Cabeceras de seguridad (10, 14) | **Parcial** | faltan CSP y HSTS verificado |
| 404 propia, SEO público (14) | **Ausente / no aplica** | la app privada no debe indexarse; falta `robots`/`noindex` |

## 3. Flujos de usuario (hoy)

- **Anónimo:** solo ve `/acceso` y `/recuperar`; no puede registrarse.
- **Cuenta existente:** login con correo/contraseña → `/` → todo el producto. No hay estado de onboarding (se asume completo).
- **Perfil incompleto:** no existe el concepto; el trigger crea siempre hogar y perfil con valores por defecto.
- **OAuth cancelado / cuenta desactivada / pendiente de eliminación:** no existen.

## 4. Modelo de amenazas (resumen)

**Activos:** datos financieros del hogar, comprobantes (pueden contener datos de terceros), identidad/sesión, correo, futuras fotos y suscripciones push.
**Fronteras de confianza:** navegador ↔ PostgREST/Auth/Storage (clave `anon` pública + JWT); Edge Function con rol de servicio; Netlify estático.

| Amenaza | Estado actual | Observación |
| --- | --- | --- |
| IDOR entre hogares (cambiar UUID/`household_id`) | RLS por hogar en todas las tablas (verificado en instalación limpia) | **Falta** la prueba adversarial A/B contra la base viva (Gate 1) |
| Auto-registro abierto | Cerrado (`enable_signup = false`) | **Abrir el registro cambia el riesgo**: hace falta antes anti-abuso, confirmación de correo y política de contraseñas |
| **Toma de cuenta por OAuth** | n/a hoy | Supabase puede **vincular automáticamente** una identidad OAuth a la cuenta existente con el mismo correo; es seguro solo si el proveedor garantiza correo **verificado**. Facebook puede devolver correo no verificado o ninguno: se debe exigir verificación y no fusionar por correo escrito |
| Enumeración de cuentas | Login con mensaje genérico; recuperación con **respuesta neutra** ("Si el correo está registrado…") verificada en `RecoverPage` | el registro público (si se abre) reintroduce el riesgo: respuesta uniforme y límites de frecuencia |
| Cuenta desactivada con JWT vigente | n/a | requiere validación de estado en RLS/RPC (el JWT no se revoca al instante) |
| Fuga de secretos | `verify:security` pasa; sin claves en el bundle | los secretos OAuth/VAPID deben vivir solo en el servidor/proveedor |
| XSS / inyección | React escapa; **ningún** `dangerouslySetInnerHTML`, `innerHTML`, `eval` ni `new Function` en `src` (verificado) | CSP reduciría el impacto de una regresión futura |
| Subida de archivos | MIME y tamaño por política del bucket; verificación por contenido **NO VERIFICADO** | metadatos EXIF de fotos: no hay avatares aún |
| Clickjacking / sniffing | `X-Frame-Options: DENY`, `nosniff` | falta CSP `frame-ancestors` moderna |

## 5. Baseline financiero (antes de cualquier cambio de esta especificación)

Base **local** (sin datos personales en este documento): 135 gastos activos por S/ 10 949.52; 136 imputaciones por S/ 10 879.52; 2 usuarios (demo y propietario). Producción: **NO VERIFICADO** (no se consultó). Antes de cada gate con migraciones se repetirá la comparación y se guardará en `FINANCIAL_REGRESSION_REPORT.md`.

## 6. Hallazgos prioritarios

1. **Bloqueante para abrir el registro:** hoy no hay confirmación de correo, política de contraseñas fuerte verificada, anti-abuso ni documentos legales. No se debe activar `enable_signup` hasta completar el Gate 1 y el 4.
2. **Riesgo de diseño:** `handle_new_user` crea un hogar por **cada** identidad nueva. Con OAuth, vincular una identidad a una cuenta existente **no** debe crear otro hogar (Supabase vincula identidades dentro del mismo usuario, no dispara un alta nueva, pero debe probarse) y el onboarding no debe duplicar hogar por reintentos.
3. **Brecha legal fundamental:** no existen ni deben publicarse documentos sin responsable identificado; ver `LEGAL_APPLICABILITY_PERU.md`.
4. **`household_members.role` solo admite `owner`**: la colaboración familiar requiere ampliar el modelo; no se habilitará acceso compartido en este alcance.
5. **Notificaciones:** `planning_reminders` es una preferencia booleana que solo activa una invitación visual al abrir la app; al crear las preferencias granulares debe **migrarse** (no duplicarse) para no cambiar el comportamiento actual.

## 7. Decisiones que necesito de ti (bloquean gates concretos)

| # | Decisión | Bloquea |
| --- | --- | --- |
| D1 | ¿Se abre el **registro público**? Hoy está cerrado. Es el cambio de mayor riesgo | Gates 2, 3, 4 |
| D2 | **Responsable del tratamiento**: razón social o nombre, RUC/DNI, domicilio y correo para derechos de datos. No se inventan | Gate 4 (documentos) |
| D3 | Cuentas de **Google Cloud y Meta Developers** (client ID/secret) por entorno: solo tú puedes crearlas | Gate 2 |
| D4 | ¿**Menores de edad**? Si no se admiten, se declara edad mínima y se documenta | Gate 4 |
| D5 | ¿Proveedor de **correo** transaccional propio (el de Supabase por defecto tiene límites y no es apto para producción)? | Gates 2, 6 |
| D6 | Región/plan de Supabase y de Netlify (para transferencias internacionales): **NO VERIFICADO** | Gate 4 |
| D7 | ¿Se desea **colaboración familiar** (más de un usuario por hogar) en este alcance? Hoy solo `owner` | Gates 3, 7 |

## 8. Plan por gates (propuesta)

| Gate | Contenido | Requiere | Estado |
| --- | --- | --- | --- |
| 0 | Diagnóstico (este documento) + inventario de datos + matriz legal | — | **Hecho** |
| 1 | Seguridad base: auditoría A/B contra la base viva, CSP/HSTS, política de contraseñas, anti-enumeración, pruebas de RLS y Storage con usuarios aislados | Docker abierto | Pendiente |
| 2 | OAuth Google/Facebook + registro por correo con confirmación (detrás de bandera, **registro cerrado** hasta D1) | D1, D3, D5 | Pendiente |
| 3 | Perfil (alias, avatar), onboarding persistente, migración no destructiva de cuentas existentes | Gate 1 | Pendiente |
| 4 | Documentos legales (borradores), consentimientos versionados | D2, D4, D6 + revisión jurídica | Pendiente |
| 5 | Tour de primer uso | Gate 3 | Pendiente |
| 6 | Bandeja interna, preferencias, scheduler idempotente, push | D5 | Pendiente |
| 7 | Cuenta: vinculación, reautenticación, desactivación, eliminación, derechos | Gates 1, 3, 4 | Pendiente |
| 8 | Endurecimiento de lanzamiento, 404, noindex, copias/restauración, runbook | todos | Pendiente |
| 9 | Release con QA completa, aprobación del operador y revisión jurídica | todos | Pendiente |

**Nada de esto se ha aplicado a producción ni se aplicará sin tu autorización explícita.**
