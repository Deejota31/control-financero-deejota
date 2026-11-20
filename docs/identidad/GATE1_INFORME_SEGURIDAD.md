# Gate 1 — Seguridad base · Informe

Fecha: 2026-11-20 · Entorno: **solo local** (Docker/Supabase local, usuarios ficticios temporales). No se tocó producción, ni datos reales (135 gastos / S/ 10 949,52 y 136 imputaciones intactos tras las pruebas), ni se activó el registro ni ningún proveedor OAuth.

## 1. Resultado en una línea
Aislamiento entre cuentas **verificado sin fallos** (216/217; 1 hallazgo conocido de severidad media). Se aplicaron 8 endurecimientos. Lo que depende del panel de Supabase, de proveedores o de decisiones legales queda documentado como pendiente, no hecho.

## 2. Hallazgos por severidad

| ID | Sev. | Hallazgo | Evidencia | Estado |
| --- | --- | --- | --- | --- |
| M-01 | Media | Storage valida el **tipo MIME declarado**, no el contenido: un HTML declarado como PDF se aceptó (200) | `T7-contenido` en `qa/aislamiento-gate1.json` | **Mitigado parcialmente**: validación por bytes en el cliente (`src/lib/tipoArchivo.ts`); los comprobantes son privados y se sirven por URL firmada con `nosniff`. El servidor no puede validar contenido con la configuración de Storage actual → pendiente (ver §7) |
| M-02 | Media | `anon` tenía SELECT/INSERT/UPDATE/DELETE/**TRUNCATE** sobre todas las tablas (solo RLS lo frenaba) | `information_schema.role_table_grants` antes del cambio | **Corregido** (migración `20261120000001`) |
| M-03 | Media | Política de contraseñas débil (8 caracteres, sin complejidad) | `config.toml`, `schemas.ts` | **Corregido en local y en cliente**; el panel remoto debe igualarse (§6) |
| M-04 | Media | Sin CSP ni HSTS en producción | `netlify.toml` | **Corregido en repo** (se activa al desplegar; verificar en producción solo con dominio/HTTPS definitivo) |
| B-01 | Baja | `authenticated` tenía TRUNCATE/REFERENCES/TRIGGER | grants | **Corregido** |
| B-02 | Baja | 7 funciones de trigger ejecutables por roles de la API | `has_function_privilege` | **Corregido** |
| B-03 | Baja | Destino de redirección tras iniciar sesión sin sanear (`state.from`) | `LoginPage.tsx` | **Corregido** (`rutaInterna`, con pruebas) |
| B-04 | Baja | zod compilaba con `new Function` (incompatible con una CSP sin `unsafe-eval`) | Violación `script-src eval` detectada por la prueba CSP | **Corregido** (`jitless`, módulo `zodConfig` importado primero) |
| I-01 | Info | Google Fonts se carga desde terceros (IP del usuario hacia Google; obliga a permitir `fonts.googleapis.com` / `fonts.gstatic.com` en la CSP) | `index.html` | Abierto: recomendado **autoalojar** las fuentes (decisión de diseño, Gate 8) |
| I-02 | Info | Confirmación de correo, MFA, captcha y `secure_password_change` desactivados en local | `config.toml` | Deliberado mientras el registro esté cerrado (D1); ver §6 |
| I-03 | Info | Vinculación automática de identidades por correo verificado (riesgo de toma de cuenta con Facebook si su correo no está verificado) | Diseño de Supabase | Pendiente para Gate 2: no activar Facebook sin la política de vinculación definida |
| — | — | Sin hallazgos críticos ni altos | — | — |

## 3. Qué se verificó (evidencia reproducible)

**Estado de RLS (BD local):** 31/31 tablas de `public` con RLS activo · 49 políticas · 50 funciones `SECURITY DEFINER`, todas con `search_path` fijo (comprobado por `verify:install` y la nueva prueba pgTAP) · bucket `comprobantes` privado (5 MiB; jpeg/png/webp/pdf; políticas por primer segmento = hogar + `is_household_member`).

**Auditoría adversarial con dos usuarios ficticios** — `npm run audit:aislamiento` (rechaza cualquier URL que no sea local; crea A y B, siembra A con gastos, fondos, imputaciones, plantillas, eventos/conceptos/compromisos y comprobante; borra todo al terminar):

| Grupo | Qué intenta B (o anónimo) | Resultado |
| --- | --- | --- |
| P / CP | Preparación y controles positivos (A sí accede a lo suyo) | 11/11 |
| T1 | B lee 31 tablas | 31/31 sin filas ajenas |
| T2 | Anónimo lee 31 tablas | 31/31 denegado |
| T3 | B borra (30) y modifica (10) filas de A | 40/40 sin efecto |
| T4 | B inserta en el hogar de A, incluida `household_members` | 7/7 rechazado |
| T5 | ≈20 RPC con IDs de A (gastos, fondos, eventos, plantillas, limpieza, dashboard…) | 23/23 |
| T6 | Anónimo invoca RPC | 30/30 denegado |
| T7 | Storage: descargar, firmar, listar, subir/sobrescribir/borrar en carpeta de A, traversal, URL pública, anónimo, SVG/HTML/tamaño | 12/13 (el fallo es M-01) |
| INT | Huella md5 por tabla antes/después (31 tablas) y sin hogares duplicados | 31/31 |

Total **217 comprobaciones: 216 superadas, 0 fallos, 1 hallazgo conocido.** Detalle: `qa/aislamiento-gate1.json`. Repetido tras la migración de permisos: mismo resultado.

**Otras pruebas ejecutadas hoy:** pgTAP 19 archivos / 644 pruebas OK (incluye `seguridad_esquema.test.sql`: sin privilegios de `anon`, sin TRUNCATE, triggers no invocables, RLS en todas las tablas, `SECURITY DEFINER` con `search_path`) · `verify:install` (reinstalación desde cero) OK · typecheck + oxlint + 600 pruebas unitarias OK · `verify:security` (18 comprobaciones, ampliado con contraseña, OAuth, CSP y HSTS) OK · E2E `auth` + `recuperacion` (17) OK · E2E `comprobantes` + `formulario-gasto` (9) OK · E2E-PWA `csp.spec.ts` (2) OK, con control positivo (un script en línea sí es rechazado) · `npm audit` completo: 0 vulnerabilidades.

**No ejecutado hoy:** suite E2E completa ni `qa-completo` (≈55 min); se ejecutarán al cierre de la fase de código del Gate 2. La CSP se probó contra la build de producción con `vite preview` + proxy local que añade la cabecera: **no** se probó en Netlify real.

## 4. Cambios (archivos)
- Migración nueva `supabase/migrations/20261120000001_endurecimiento_permisos.sql` — **solo recorta privilegios**; no toca datos, lógica financiera ni RLS. **No aplicada a producción** (requiere tu autorización; es segura de aplicar: idempotente y no destructiva).
- `supabase/tests/seguridad_esquema.test.sql` (nuevo); `rls_base.test.sql` y `catalogo.test.sql` (anon ahora recibe `permission denied` en vez de 0 filas: denegación más fuerte).
- `supabase/config.toml` (contraseña ≥10 con mayúscula/minúscula/número).
- `src/features/auth/{schemas,PasswordForm,LoginPage}`, `rutaInterna.ts` (+ tests), `schemas.test.ts`, `e2e/auth.spec.ts`.
- `src/lib/tipoArchivo.ts` (+ tests) y `GastoForm.tsx` (validación por bytes), `src/lib/zodConfig.ts`, `src/main.tsx`.
- `netlify.toml` (CSP, HSTS sin `includeSubDomains`/`preload`, COOP `same-origin-allow-popups`, CORP `same-site`).
- `e2e-pwa/csp.spec.ts`, `scripts/verificar-seguridad.mjs`, `scripts/auditar-aislamiento.mjs`, `package.json` (`audit:aislamiento`).
- Documentos en `docs/identidad/`.

## 5. Impacto en la funcionalidad actual
- Las contraseñas **nuevas** deben tener ≥10 caracteres con mayúscula, minúscula y número. Las cuentas existentes siguen entrando; solo se aplica al cambiar contraseña.
- Un comprobante cuyo contenido no coincide con su tipo (p. ej. un `.pdf` que no es PDF) ahora se rechaza al elegirlo.
- Ninguna lógica financiera cambió; las pruebas financieras (pgTAP, unitarias, E2E de gasto) pasan.
- Al desplegar con la CSP, cualquier recurso externo nuevo (analítica, otro proveedor de fuentes) quedará bloqueado hasta añadirlo a propósito.

## 6. Configuración manual necesaria (no se hizo; requiere autorización o credenciales)
1. **Supabase remoto → Auth:** igualar longitud mínima 10 y requisito «minúsculas, mayúsculas y números»; mantener *Allow new users to sign up* **desactivado** (D1); revisar *Site URL* y *Redirect URLs* (solo el dominio final); activar protección de contraseñas filtradas si el plan lo ofrece; límites de tasa (*Rate Limits*); captcha (Turnstile/hCaptcha) al abrir el registro. Esto **no está verificado**: la configuración remota no vive en el repositorio.
2. **Aplicar la migración `20261120000001`** a producción cuando lo autorices (mismo procedimiento que las anteriores).
3. **Confirmación de correo** y `secure_password_change`: activar al abrir el registro, con SMTP propio (ver `CONFIGURACION_EXTERNA_AUTH.md`).
4. **Netlify:** tras desplegar, comprobar cabeceras (`curl -I`) y consola sin violaciones; recién entonces valorar `includeSubDomains`.

## 7. Riesgos pendientes
- **M-01 en servidor:** opciones para cerrarlo del todo: (a) Edge Function que valide magic bytes antes de aceptar el archivo y bucket sin escritura directa; (b) servir los comprobantes con `Content-Disposition: attachment`/descargarlos como blob (ya se firman y no se renderizan como HTML en la app). Decisión para Gate 2/3.
- Región de Supabase/Netlify y subencargados: **NO VERIFICADO** (ver inventario de datos).
- Sin MFA ni detección de anomalías: aceptable mientras sea un hogar con propietario único; reevaluar con registro abierto.
- La política de vinculación de identidades (I-03) debe quedar decidida antes de activar Facebook/Google.

## 8. Recomendación
**Continuar al Gate 2 (identidad: OAuth/arquitectura, perfil y onboarding)** — no hay hallazgos críticos ni altos y el aislamiento está comprobado. Condiciones: (1) aplicar la migración de permisos a producción antes de abrir nada al público; (2) mantener el registro cerrado y los proveedores OAuth **inactivos** hasta tener credenciales oficiales; (3) resolver D-pendientes legales en paralelo con la tarea independiente de `TAREA_VERIFICACION_LEGAL.md`.

## 9. Estado exacto de cada hallazgo (cierre del Gate 1)

| ID | Estado |
| --- | --- |
| M-01 | **MITIGADO PARCIALMENTE** (no corregido definitivamente): validación por bytes solo en el cliente; el servidor sigue aceptando un tipo declarado falso. Cierre en servidor autorizado para el Gate 2. |
| M-02 | CORREGIDO en repo y BD local; **migración pendiente de aplicar a producción**. |
| M-03 | CORREGIDO en local y cliente; **pendiente igualar el panel remoto de Supabase**. |
| M-04 | CORREGIDO en repo; **pendiente verificar en Netlify tras desplegar**. |
| B-01, B-02 | CORREGIDOS en repo y BD local; pendientes de aplicar a producción con M-02. |
| B-03, B-04 | CORREGIDOS (código, con pruebas). |
| I-01 | ABIERTO (autoalojar fuentes). |
| I-02 | ABIERTO deliberadamente (registro cerrado). |
| I-03 | ABIERTO: política de vinculación definida en Gate 2 (conservadora; ver informe del Gate 2). |
