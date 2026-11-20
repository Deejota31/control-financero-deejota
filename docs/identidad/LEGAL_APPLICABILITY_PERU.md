# Matriz de aplicabilidad legal — Perú

Fecha: 2026-11-20 · **ESTADO: NO VERIFICADO.** En esta sesión **no se accedió a las versiones oficiales vigentes** de las normas. Esta matriz es una **hoja de ruta de verificación**, no un análisis jurídico. No contiene artículos citados de memoria porque no se pueden dar por ciertos sin consultar la fuente oficial. **Nada aquí certifica cumplimiento ni sustituye a un abogado.**

Cómo completarla: abrir cada fuente oficial, anotar versión vigente, artículo y fecha de consulta, y clasificar como OBLIGATORIO / CONDICIONAL / BUENA PRÁCTICA / NO APLICA / REQUIERE ASESORÍA.

| # | Tema | Norma / fuente a consultar | Por qué podría aplicar a este producto | Clasificación provisional | Artículo | Fecha de consulta | Evidencia en el producto | Responsable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Protección de datos personales | Ley N.º 29733 (Congreso / SPIJ / El Peruano) | La app trata correo, alias, foto y datos financieros de personas naturales | CONDICIONAL → REQUIERE ASESORÍA | NO VERIFICADO | — | Inventario `DATA_INVENTORY_PERU.md` | Abogado/a + responsable |
| 2 | Reglamento de la Ley 29733 | D.S. N.º 016-2024-JUS (**verificar número, vigencia y plazos de adecuación**) | Define deberes del titular del banco de datos, consentimiento, medidas de seguridad, transferencias | REQUIERE ASESORÍA | NO VERIFICADO | — | — | Abogado/a |
| 3 | Autoridad (ANPD) y directivas | gob.pe / Autoridad Nacional de Protección de Datos Personales | Inscripción de bancos de datos, trámites, guías | REQUIERE ASESORÍA | NO VERIFICADO | — | Checklist de trámites (no se tramita sin autorización) | Responsable |
| 4 | Derechos del titular (acceso, rectificación, cancelación, oposición y otros que establezca la norma vigente) | Ley 29733 y reglamento | Canal y flujo de atención | CONDICIONAL | NO VERIFICADO | — | Exportación existente; flujo de solicitudes **pendiente** (Gate 7) | Responsable |
| 5 | Transferencia internacional de datos | Ley 29733 y reglamento | Supabase/Netlify/Google/Meta pueden estar fuera del Perú | CONDICIONAL | NO VERIFICADO | — | Región real **NO VERIFICADA** | Responsable |
| 6 | Consumidores y publicidad | Ley N.º 29571 (Código de Protección y Defensa del Consumidor) y modificaciones posteriores (verificar si la Ley N.º 32495 existe y qué cambia) | Aplica si se **ofrece un servicio a consumidores** a cambio de precio; hoy es una herramienta personal sin cobro | CONDICIONAL | NO VERIFICADO | — | — | Abogado/a |
| 7 | Libro de Reclamaciones | Indecopi (condiciones y formato oficial) | Solo si hay prestación comercial a consumidores | CONDICIONAL | NO VERIFICADO | — | **No se añade un formulario genérico** | Responsable |
| 8 | Contratación electrónica / términos | Normativa civil y de comercio electrónico vigente | Términos y Condiciones aceptados en línea | REQUIERE ASESORÍA | NO VERIFICADO | — | Borrador pendiente (Gate 4) | Abogado/a |
| 9 | Propiedad intelectual / licencias | Normativa vigente + licencias de dependencias y fuentes | Logos de Google/Facebook, tipografías, íconos | BUENA PRÁCTICA | NO VERIFICADO | — | `npm` licencias: auditoría pendiente (Gate 8) | Equipo |
| 10 | Delitos informáticos | Normativa vigente | Contexto de seguridad (no genera deberes de producto directos) | NO APLICA a la implementación | — | — | — | — |
| 11 | Servicios financieros regulados | SBS (verificar si aplica) | Una herramienta personal de presupuesto **no se presume** entidad financiera; no custodia dinero ni da crédito | NO APLICA (a confirmar) | NO VERIFICADO | — | La app aclara que los fondos son presupuestos | Abogado/a |
| 12 | Tributos | Solo si se cobra por el servicio | No hay cobro hoy | NO APLICA hoy | — | — | — | — |
| 13 | Cookies y rastreadores | Ley 29733 y criterios de la ANPD | Hoy solo hay almacenamiento **necesario** (sin analytics ni píxeles) | CONDICIONAL (solo si se añaden opcionales) | NO VERIFICADO | — | No se añade banner innecesario | Equipo |
| 14 | Menores de edad | Ley 29733/reglamento y normativa sobre niñez | Si se admiten menores | REQUIERE ASESORÍA | NO VERIFICADO | — | Decisión D4 pendiente | Responsable |
| 15 | Notificación de incidentes de seguridad | Ley 29733/reglamento | Brecha con datos personales | REQUIERE ASESORÍA | NO VERIFICADO | — | Runbook pendiente (Gate 8) | Responsable |

## Fuentes oficiales a consultar (no se verificó ninguna)
- El Peruano (normas legales) y SPIJ (Sistema Peruano de Información Jurídica).
- Portal gob.pe: sección de la Autoridad Nacional de Protección de Datos Personales (guías, directivas, trámites).
- Indecopi (Libro de Reclamaciones, consumidores).
- Documentación de cada proveedor (Supabase, Netlify, Google, Meta) para regiones, subencargados y términos.

## Reglas de trabajo para no afirmar de más
1. Ningún documento legal del producto se publicará sin validación jurídica humana.
2. No se declarará «cumple la Ley N.º 29733» ni se mencionará inscripción ante la ANPD sin constancia.
3. Aceptación contractual, información de privacidad y consentimientos para finalidades concretas se tratan por separado; cuáles requieren consentimiento lo decide el análisis jurídico.
4. Lo que dependa de datos del responsable (razón social, RUC/DNI, domicilio, correo legal) usa marcadores `[PENDIENTE: …]`.
