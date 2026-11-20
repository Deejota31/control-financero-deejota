# Inventario de datos personales — Deejota Finanzas

Fecha: 2026-11-20 · Estado: **borrador de trabajo del Gate 0**, sujeto a validación jurídica. «Base aplicable» queda **PENDIENTE DE VALIDACIÓN** hasta el Gate 4: aquí solo se registra lo que el código y el esquema realmente tratan hoy y lo que la especificación añadiría.

Convención: **Hoy** = ya existe en el producto. **Nuevo** = lo introduciría la especificación (no existe todavía). Región, proveedor y subencargados: **NO VERIFICADO** (dependen de la configuración real de Supabase y Netlify, que no está en el repositorio).

## A. Datos tratados hoy

| Dato | Dónde | Origen | Finalidad (funcional) | Retención | Acceso | Observaciones |
| --- | --- | --- | --- | --- | --- | --- |
| Correo electrónico | `auth.users` (Supabase Auth) | Persona (o proveedor OAuth, nuevo) | Identificar la cuenta, acceso, recuperación | Mientras exista la cuenta | Titular; Supabase como proveedor | No se copia a tablas propias |
| Contraseña | `auth.users` (hash gestionado por Supabase) | Persona | Autenticación | Mientras exista la cuenta | Nadie (solo hash) | Nunca se almacena en tablas de la aplicación |
| Tokens de sesión / refresh | Almacenamiento del navegador (SDK de Supabase) | Auth | Mantener la sesión | Hasta cerrar sesión o expirar | Navegador del titular | El service worker **no** los cachea |
| Alias / nombre visible | `profiles.display_name` | Persona | Mostrar su nombre en la interfaz | Mientras exista la cuenta | Titular (RLS) | Opcional |
| Zona horaria, formato de fecha, tema, moneda de visualización | `profiles` | Persona | Preferencias de interfaz | Mientras exista la cuenta | Titular | Sin carácter identificador fuerte |
| Preferencia de recordatorio de planificación | `profiles.planning_reminders` | Persona | Mostrar una invitación en la app | Mientras exista la cuenta | Titular | No envía mensajes |
| Identificadores de hogar y de usuario | `households`, `household_members`, `profiles` | Sistema | Aislar los datos de cada hogar | Mientras exista la cuenta | Titular | UUID internos |
| Gastos (importe, fecha, descripción, notas, categoría, medio, moneda, tasa) | `expenses` y relacionadas | Persona | Prestar el servicio (control de gastos) | Mientras exista la cuenta | Hogar (RLS) | Las descripciones/notas son **texto libre** y pueden contener datos de terceros o sensibles: clasificar en Gate 4 sin asumir que todo importe es dato sensible |
| Fondos, reglas, imputaciones, períodos, plantillas | tablas propias | Persona / sistema | Presupuesto y planificación | Mientras exista la cuenta | Hogar | |
| Eventos, conceptos, compromisos | `events*` | Persona | Organizar metas y pagos | Mientras exista la cuenta | Titular | Pueden mencionar personas (p. ej. «Cumpleaños de …») |
| Comprobantes (imagen/PDF) | Storage privado `comprobantes` | Persona | Respaldo de un gasto | Hasta borrar el gasto o la cuenta | Hogar (política de Storage) | Pueden contener datos personales de terceros (RUC, nombres, direcciones) y metadatos EXIF |
| Cotizaciones USD/PEN | `exchange_rate_quotes` | BCRP (público) | Convertir importes | Caché; sin datos personales | Lectura con sesión | No es dato personal |
| Registro de cambios | `audit_logs` | Sistema | Trazabilidad de operaciones financieras | **NO DEFINIDA** | Hogar | Sin tokens ni secretos; la retención hay que definirla (Gate 4) |
| Claves de idempotencia y tareas de limpieza | `idempotency_requests`, `storage_cleanup_tasks` | Sistema | Evitar duplicados / limpiar archivos | Técnica | Hogar | |
| Preferencias locales (limpieza pendiente, ajustes de tablas) | `localStorage` | Navegador | Funcionamiento y preferencias | Hasta borrado del navegador | Navegador | Almacenamiento **necesario**; sin rastreo |
| Exportaciones CSV/JSON | Descarga en el dispositivo | Sistema | Portabilidad de los datos propios | No se conserva en el servidor | Titular | Excluye autoría y rutas internas |

## B. Datos que la especificación añadiría (**Nuevo**, no implementado)

| Dato | Finalidad | Notas y riesgo |
| --- | --- | --- |
| Identidad de proveedor (Google/Facebook): identificador de proveedor, correo, nombre, foto | Acceso federado | Mínimo de *scopes*; no guardar tokens de proveedor; correo del proveedor puede estar sin verificar |
| Foto de perfil (avatar) | Personalización | Subida validada por contenido; eliminar EXIF; bucket privado; es dato personal identificable |
| Estado de onboarding y de tutorial | Reanudar la guía | Sin datos sensibles |
| Versión y fecha de aceptación de documentos, consentimientos y revocaciones | Evidencia | IP/agente de usuario **solo si se justifica y se informa**; un *hash* del documento no sustituye protección de datos |
| Preferencias de notificación, bandeja, suscripciones push (endpoint, claves públicas) | Recordatorios | El *endpoint* identifica un dispositivo; revocar al cerrar sesión/eliminar cuenta |
| Solicitudes de derechos de datos y de ciclo de vida de la cuenta | Atender derechos | Contienen datos de verificación de identidad: acceso mínimo y confidencial |
| Eventos de seguridad de cuenta | Detección y trazabilidad | Sin contraseñas ni tokens; retención proporcional |

**No se pedirán** DNI, fecha de nacimiento exacta, teléfono, dirección ni género salvo finalidad documentada.

## C. Proveedores y posibles subencargados — **NO VERIFICADO**

| Proveedor | Función | Región/contrato |
| --- | --- | --- |
| Supabase | Auth, base de datos, Storage, Edge Functions | Región del proyecto: NO VERIFICADO |
| Netlify | Hosting estático de la SPA (sin datos personales en el servidor) | NO VERIFICADO |
| BCRP | Fuente pública de tipo de cambio (la Edge Function consulta sin datos personales) | Fuente pública |
| Google / Meta | Solo si se activa el acceso federado | Dependen de la configuración |
| Proveedor de correo transaccional | Confirmación y recuperación | Hoy el predeterminado de Supabase: NO VERIFICADO |

## D. Pendientes para cerrar este inventario
1. Confirmar región y plan reales de Supabase y Netlify.
2. Definir retención de `audit_logs`, exportaciones y solicitudes de derechos.
3. Clasificar el texto libre de gastos/notas/comprobantes con criterio jurídico.
4. Decidir tratamiento de menores y edad mínima (D4 del diagnóstico).
