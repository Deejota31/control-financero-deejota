# Descripciones frecuentes

Los formularios de gastos, fondos y sus plantillas muestran hasta cinco chips con
la descripción y su frecuencia real. «Ver más» amplía a diez y «Ver menos» contrae.
La búsqueda consulta también coincidencias que no estaban en los diez primeros.
Sin historial, con contexto incompleto o ante un error del servicio, el campo
sigue funcionando y no se muestra un bloque vacío.

Una descripción nueva permanece vacía hasta escribir o elegir un chip. Elegir una
subcategoría ya no la rellena. Editar, clonar, guardar como plantilla y usar una
plantilla conservan el texto de origen. Elegir un chip solo cambia la descripción;
no guarda ni cambia otros datos. El autocompletado nativo del navegador queda
desactivado para estos campos.

## Arquitectura y archivos

Archivos nuevos:

- `src/features/descripciones/contexto.ts`: contextos explícitos, clave estable y normalización de búsqueda.
- `src/features/descripciones/useSugerenciasDescripcion.ts`: RPC, validación Zod, caché por usuario/contexto/texto, debounce de 250 ms y cancelación.
- `src/features/descripciones/DescripcionInteligente.tsx`: input controlado, chips accesibles, frecuencia, expansión y conservación del foco.
- `src/features/descripciones/DescripcionInteligente.test.tsx`: interacción, expansión, conservación de datos y normalización.
- `src/features/descripciones/useSugerenciasDescripcion.test.tsx`: caché, identidad, respuestas obsoletas, errores e invalidación.
- `supabase/migrations/20261116000001_sugerencias_descripciones.sql`: configuración y consultas agregadas.
- `supabase/tests/descripciones.test.sql`: pruebas transaccionales de historial y seguridad.
- `e2e/descripciones.spec.ts`: integración real, teclado, errores y adaptación visual.
- Este documento.

Archivos modificados:

- `GastoForm.tsx` y `FondoForm.tsx`: integración única que cubre los modos existentes.
- `useCatalogo.ts` y `lib/consultas.ts`: invalidación del historial al cambiar registros, coberturas o catálogo.
- `lib/database.types.ts`: regenerado desde Supabase local.
- `e2e/gastos.spec.ts`: expectativa actualizada para descripción inicialmente vacía.
- `README.md`: enlace a esta documentación.

No se añadieron dependencias de aplicación ni se cambiaron RPC financieras.

## Historial de gastos

`sugerencias_descripciones('expense', contexto, búsqueda)` agrupa los gastos
`active` del usuario autenticado (`created_by = auth.uid()`) y de su hogar actual.
Comprueba la jerarquía ámbito → categoría → subcategoría y aplica coincidencia
exacta de IDs. Sin subcategoría seleccionada solo utiliza gastos sin subcategoría.
No toma como estadísticas las plantillas, los formularios cancelados ni los
intentos de guardado fallidos.

La frecuencia es `count(*)` sobre los registros actuales. Por eso editar cambia
la agrupación sin duplicar, anular resta, restaurar incorpora y clonar cuenta solo
cuando se crea realmente otro gasto. Los reintentos conservan la idempotencia del
motor existente. El uso de una plantilla cuenta al crear movimientos reales.

## Compartir Alimentación → Bebidas

El catálogo existente no tiene una identidad canónica compartida: cada categoría
y subcategoría pertenece a su propia rama. La tabla
`description_shared_contexts(household_id, subcategoria_id, group_key)` guarda
la asociación explícita por ID; no contiene movimientos ni contadores.

La regla inicial centralizada `grupo_descripcion_inicial` reconoce únicamente
el par exacto normalizado Alimentación → Bebidas. La migración asocia las ramas
existentes y dos triggers mantienen esa asociación al crear o renombrar categorías
y subcategorías. El historial se consulta por IDs asociados al mismo grupo y hogar,
no por similitud de nombres. Las demás combinaciones permanecen aisladas.

Para incorporar otra equivalencia de negocio se registran los IDs correspondientes
en esa tabla con el mismo `group_key`, mediante una migración revisada. Si también
debe asignarse a ramas nuevas, se amplía `grupo_descripcion_inicial`. Los grupos
configurados manualmente se conservan al renombrar. La API de usuario solo permite
leer las asociaciones propias: no permite inventar equivalencias ni cambiar grupos.

## Historial de fondos

`sugerencias_descripciones('fund', contexto, búsqueda)` usa únicamente fondos
reales activos del hogar cuyo propietario es el usuario autenticado. El modelo
actual no tiene un `created_by` individual en fondos; la identidad se establece
por `households.created_by`, además de RLS y el hogar de la sesión. Una futura
colaboración entre propietarios requeriría definir explícitamente ese alcance.

`firma_cobertura_descripcion` representa la cobertura efectiva con los IDs
ordenados de clasificaciones y medios admitidos, además de la condición de Fondo
General. Incluye categorías sin subcategoría y cada subcategoría válida. Usa las
mismas reglas que el motor: alguna inclusión debe coincidir si hay inclusiones,
y cualquier exclusión prevalece; sin reglas en un eje se admite todo ese eje.

Esto reconoce tanto cambios de orden como inclusiones redundantes. Dos reglas
que cubren conjuntos distintos, medios distintos o un tipo general distinto no se
mezclan. No se incluyen el nombre, importe, prioridad ni mes porque no definen la
cobertura. La firma se calcula sobre el catálogo actual e incluye referencias
inactivas existentes, para conservar su significado histórico.

No hay sugerencias de fondos específicos sin una inclusión, sin clasificaciones
o medios efectivos, ni con referencias inválidas o de otro hogar. Cambiar reglas
actualiza las sugerencias sin modificar el texto escrito. Guardar una plantilla
no cuenta; crear un fondo desde ella sí. Editar, eliminar o desactivar fondos se
refleja al consultar otra vez porque no hay contadores derivados persistidos.

## Normalización, orden y rendimiento

La comparación unifica Unicode NFC, espacios consecutivos, mayúsculas y vocales
acentuadas (`áéíóúü` → `aeiouu`). Conserva `ñ` como letra distinta y no agrupa por
similitud parcial: Gas, Gasolina y Gasolina premium siguen separados. La búsqueda
sí admite subcadenas. Se muestra una variante legible del registro más reciente,
sin reescribir descripciones históricas.

Orden: frecuencia descendente, fecha de creación más reciente y clave normalizada
en orden alfabético estable (`C`). «Último uso» significa el registro más reciente,
no la última vez que se enfocó o editó el input. Se devuelve un máximo de diez
agrupaciones; nunca se descarga el historial completo al navegador.

TanStack Query mantiene caché durante un minuto por usuario, tipo, contexto y
búsqueda. El cliente ya se sustituye al cambiar de sesión. La consulta consume
`AbortSignal`; no usa resultados de contexto anterior durante debounce. Las
mutaciones existentes invalidan el historial, incluidas las operaciones por lotes
y desde plantillas. Invalidar después de un fallo solo relee datos: no suma usos.
No se añadieron índices sin evidencia de necesidad; se usan las restricciones e
índices existentes por hogar y fondo.

## Seguridad y despliegue

La consulta y la firma usan `SECURITY INVOKER`, `search_path` fijo, RLS e identidad
autenticada. Se revocó ejecución a `PUBLIC` y `anon`. El único trigger con
`SECURITY DEFINER` mantiene asociaciones del catálogo y no expone una RPC invocable
por el cliente. No acepta SQL dinámico ni modifica operaciones financieras.

La migración se aplicó en Supabase local sin resetear la base ni modificar usuarios,
gastos, fondos o descripciones existentes. También se regeneraron los tipos desde
ese esquema. Para otro entorno, aplicar la migración versionada antes de desplegar
el frontend. No se ha aplicado ni publicado nada en un Supabase remoto.

La base local tenía migraciones antiguas aplicadas al esquema pero ausentes de su
registro de versiones. Se comprobó la existencia de las tablas y funciones
necesarias y se aplicó únicamente la nueva migración, sin ejecutar de nuevo las
migraciones antiguas sobre los datos existentes.

## Verificación

Resultados comprobados:

- `npm run check`: TypeScript, oxlint y 549 pruebas unitarias en 45 archivos correctas.
- Compilación final (`npm run build`) y lint correctos. Vite mantiene el aviso de un paquete de más de 500 kB; no impide compilar.
- Pruebas focalizadas del componente y hook: 12 correctas, repetidas tras ajustar el nombre accesible de los chips.
- SQL: 412 comprobaciones correctas; 43 corresponden a esta funcionalidad.
- `npm run verify:install`: 25 migraciones aplicadas desde cero en la base desechable, todas las tablas con RLS y todas las pruebas SQL correctas.
- Regresión de gastos y plantillas: 26 casos comprobados; dos se repitieron después de las recargas del servidor y pasaron con el código estable.
- Sugerencias en Chromium, Firefox y WebKit: los 12 casos comprobados; uno de Firefox se repitió de forma aislada tras interrumpirse por navegación al abrir el formulario y pasó.
- Adaptación visual: nueve anchos (320, 360, 375, 390, 414, 428, 768, 1024 y 1440 px), claro y oscuro, chips extensos sin desbordamiento horizontal y botón de guardar visible. El input mantiene 16 px en dispositivos de puntero táctil para evitar zoom de foco.
- Accesibilidad: axe sin violaciones graves/críticas con chips reales; selección por teclado comprobada. Se corrigió la etiqueta del chip para que su nombre accesible conserve el contenido visible y anuncie la frecuencia.
- Capturas revisadas en `qa/descripciones-escritorio.png` y `qa/descripciones-movil-{light,dark}.png` (artefactos locales ignorados por Git).

Las fixtures SQL usan rollback y las E2E solo usan la cuenta E2E propia, que se
limpia al terminar. No se introducen datos ficticios en los hogares del usuario.
La comprobación final confirmó los 131 gastos y 8 fondos del usuario demo, la
cuenta personal nueva con su hogar vacío y la ausencia de usuario o funciones E2E
remanentes. No se reasignó la información entre cuentas.

La emulación de viewport y foco no reproduce el teclado nativo de un teléfono
físico. La comprobación en motores de navegador tampoco equivale a probar cada
versión comercial de Safari, Edge o una PWA instalada en un dispositivo real.
Esas verificaciones físicas y el despliegue remoto quedan fuera de lo ejecutado.
