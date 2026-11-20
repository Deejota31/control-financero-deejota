# Menores y datos de terceros (decisión D4) — análisis técnico, no jurídico

Fecha: 2026-11-20 · Estado: **borrador para validación jurídica.**

## Decisión de producto
El registro inicial es **solo para mayores de 18 años** (D4). Mecanismo previsto (Gate 2/4): declaración de mayoría de edad en el alta y en el primer acceso con proveedor social, **sin pedir fecha de nacimiento** (minimización); versión de la declaración registrada con los consentimientos. Si la persona declara ser menor, no se crea la cuenta operativa. Cómo se verifica o reporta un incumplimiento, y la edad exacta aplicable, **los define el análisis jurídico** (`TAREA_VERIFICACION_LEGAL.md`).

## Datos de menores que un adulto puede introducir
La app no tiene campos específicos de menores, pero el texto libre puede contenerlos:
| Dónde | Ejemplo | Riesgo | Mitigación técnica propuesta |
| --- | --- | --- | --- |
| Descripción/notas de gasto | «Pensión de Mateo (8 años)», «Médico de Ana» | Nombre y posible dato de salud/educación de un menor | Aviso junto al campo y en privacidad: «evita datos de terceros, sobre todo menores y de salud»; no se piden datos adicionales |
| Eventos, conceptos, compromisos | «Cumpleaños de …» | Nombres y fechas | Mismo aviso; los datos son privados del hogar (RLS comprobado) |
| Comprobantes | Boletas, recetas, facturas escolares | Datos de terceros y de salud en imágenes/PDF; EXIF | Bucket privado y aislado (comprobado); evaluar quitar EXIF al subir (Gate 3) |
| Exportación | CSV/JSON de todo lo anterior | Salida del dato fuera de la app | Descarga solo al propio titular |

## Conclusiones técnicas
1. La app **no recopila activamente** datos de menores; el tratamiento es incidental y controlado por la persona adulta. Aun así, puede haber datos de terceros, y de salud o educación, dentro del texto libre y los comprobantes: **clasificar jurídicamente** si exige consentimiento, aviso reforzado o ambos.
2. No se hace perfilado, publicidad ni compartición con terceros; no hay analítica.
3. Retención y eliminación: al borrar la cuenta se eliminan todos los datos del hogar (Gate 7); hay que definir plazos de copias de seguridad del proveedor.
4. **No se bloqueará el texto libre.** Se informará con claridad y se limitará el acceso al propio hogar.
5. Colaboración familiar (D6, fuera de alcance): se mantiene un propietario por hogar; el esquema ya tiene `household_members` con rol, de modo que futuras membresías no exigen rediseñar; **menores como miembros quedan descartados** hasta nueva decisión.

## Pendiente jurídico
Edad mínima y consentimiento de representantes, tratamiento de datos de terceros en texto libre, obligación de aviso específico, y si los comprobantes con datos de salud requieren medidas reforzadas.
