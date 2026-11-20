# Configuración externa de identidad (guía, nada aplicado)

Fecha: 2026-11-20 · **Nada de esto se ha configurado ni contratado.** Cada entorno (local, pruebas/staging, producción) usa **credenciales distintas**; ningún secreto se guarda en el repositorio ni en variables `VITE_*` (se exponen al navegador). Los secretos de proveedores se pegan solo en el panel de Supabase.

## 1. Supabase (Auth, proyecto de producción)
1. *Authentication → Sign In / Providers*: **desactivar** *Allow new users to sign up* hasta cerrar Gates 2–4 (D1). Mantener *Manual linking* desactivado.
2. *Password*: mínimo 10, requisitos «minúsculas, mayúsculas y números»; activar *leaked password protection* si el plan lo permite.
3. *URL Configuration*: *Site URL* = dominio final HTTPS; *Redirect URLs* solo: `https://<dominio>/**` (y el de staging en su proyecto). Sin comodines de dominios ajenos ni `localhost` en producción.
4. *Rate Limits*: revisar correos/hora, intentos de inicio de sesión y verificaciones OTP; bajarlos si el plan lo permite.
5. *Attack Protection*: captcha (Cloudflare Turnstile o hCaptcha) **al abrir el registro**.
6. Al abrir el registro: activar *Confirm email* y `secure_password_change`.
7. Registrar la región real del proyecto en `DATA_INVENTORY_PERU.md`.

## 2. Google (OAuth) — se activa en Gate 2 solo con credenciales oficiales
1. Google Cloud Console → proyecto separado por entorno → *APIs & Services → OAuth consent screen*: tipo *External*, nombre de la app, correo de soporte, dominio autorizado, enlaces a política de privacidad y términos (**requieren los documentos legales aprobados, Gate 4**), scopes mínimos: `openid`, `email`, `profile`.
2. *Credentials → OAuth client ID → Web application*. *Authorized redirect URI*: la URL de callback que muestra Supabase en *Providers → Google* (`https://<ref>.supabase.co/auth/v1/callback`). *Authorized JavaScript origins*: dominio del entorno.
3. Pegar *Client ID* y *Client Secret* en Supabase → Providers → Google (nunca en el repo). Mantener «Skip nonce check» desactivado.
4. Publicar la pantalla de consentimiento (verificación de Google puede tardar si se piden scopes sensibles; con los mínimos no aplica).
5. Probar en staging con una cuenta de prueba **antes** de producción.

## 3. Facebook / Meta (OAuth) — mismas condiciones
1. Meta for Developers → crear app (tipo *Consumer*) por entorno → producto *Facebook Login*.
2. *Valid OAuth Redirect URIs*: el callback de Supabase. Permisos mínimos: `email`, `public_profile`.
3. *App Settings → Basic*: URL de política de privacidad, **URL de eliminación de datos / instrucciones** (Meta lo exige; requiere el flujo de Gate 7), categoría, ícono.
4. Pasar la app a modo *Live* solo con los documentos legales publicados. Revisión de Meta puede ser necesaria para usuarios fuera del equipo.
5. **Riesgo (I-03):** el correo de Facebook puede no estar verificado. Antes de activarlo: rechazar el inicio de sesión si el correo no viene verificado, y no vincular automáticamente con una cuenta existente sin que la persona confirme con su contraseña/correo.

## 4. Correo transaccional (SMTP propio) — propuesta, sin contratar
El SMTP integrado de Supabase está limitado y no es apto para producción. Requisitos del servicio elegido: dominio propio verificado, **SPF, DKIM y DMARC** (empezar con `p=none`, pasar a `quarantine` tras monitorear), remitente tipo `no-reply@<dominio>` y `soporte@<dominio>` (**pendiente: dominio y correos de privacidad/soporte**), registros de rebote/quejas, plantillas en español (confirmación, recuperación, cambio de correo/contraseña, aviso de inicio de sesión nuevo), región/subencargados documentados. Candidatos a evaluar (sin recomendación definitiva hasta conocer volumen, presupuesto y región): Resend, Postmark, Amazon SES, Brevo. Pasos: elegir → verificar dominio (DNS) → cargar SMTP en *Auth → SMTP Settings* → probar en staging → ajustar *Rate Limits*.

## 5. Variables de entorno (revisión)
- Front (`VITE_*`): solo URL y clave *publishable/anon* de Supabase y `VITE_APP_ENV`; `src/lib/env.ts` impide mezclar local/producción y `verify:security` comprueba que el build no incrusta URLs locales ni claves privilegiadas.
- Nunca en el front ni en el repo: `service_role`/`sb_secret`, secretos OAuth, credenciales SMTP, claves VAPID privadas (Gate 6).
