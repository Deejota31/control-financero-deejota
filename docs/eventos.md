# Eventos y metas de gasto

## Implementado

El módulo está disponible en `/eventos` y el detalle en `/eventos/:id`. Reúne
gastos de cualquier mes o año, conceptos estimados y compromisos con varios pagos.
Reutiliza el layout, los colores por tema, iconos, selectores, notificaciones,
modales y formularios financieros existentes. Se conservó el trabajo local de
autocompletado inteligente; los eventos no comparten sus historiales de descripción.

### Arquitectura auditada

React 19, TypeScript, Vite 8, Tailwind 4, React Router 8, TanStack Query 5,
react-hook-form, Zod, Radix, Recharts y Supabase. El esquema financiero utiliza
hogares, membresías, perfiles y RLS. Los gastos e imputaciones se escriben con RPC,
no mediante actualizaciones financieras directas desde el navegador.

El catálogo tiene ámbitos, categorías y subcategorías por hogar. Los fondos
pertenecen a un período mensual y usan reglas de inclusión/exclusión. Los eventos
no intervienen en esas reglas ni crean un presupuesto mensual adicional.

La aplicación actual solo admite PEN y gastos positivos. No existe infraestructura
de conversión USD/PEN ni de reembolsos negativos. Se mantuvo esa política: no se
añadieron monedas o tasas ficticias. Anular/restaurar un gasto actualiza el total
del evento y los pendientes desde los registros reales.

### Interfaz

- Listado paginado de tarjetas: nombre, tipo, color, icono, fecha, estado,
  presupuesto, pagado, comprometido pendiente y disponible proyectado.
- Búsqueda, estado, año, fechas, archivados y seis órdenes de presentación.
- Creación, edición y clonación con campos agrupados; presupuesto independiente
  de fondos. Los importes usan el analizador de céntimos de la aplicación.
- Detalle con resumen, gastos, planificación, compromisos y análisis por ámbito,
  categoría, subcategoría, medio de pago y mes.
- Gastos paginados y filtros por fecha, descripción, clasificación, medio,
  importe y estado. Detalle y edición reutilizan los flujos originales.
- Selección de hasta 100 gastos existentes, incluso de períodos cerrados. Los
  vínculos se cambian sin ejecutar otra imputación financiera.
- Conceptos con estimación independiente, reordenación, edición y eliminación.
  Eliminar un concepto conserva los gastos y contratos, sin ese agrupador.
- Contratos con importe, concepto, vencimiento, notas y cancelación; los estados
  pendiente, parcial y pagado se calculan desde sus gastos válidos.
- Registro de adelantos desde un compromiso o asociación de pagos ya existentes.
  Si se cambia el concepto del contrato, se reagrupan sus pagos sin duplicarlos.
- El campo opcional de evento está integrado en el formulario compartido de
  gastos y sus plantillas. Cambiar una clasificación no selecciona eventos.
- Navegación móvil con seis destinos y el botón flotante existente separado.

### Plantillas y clonación

Las plantillas de eventos usan la misma estructura con `is_template=true`. Esta
decisión permite reutilizar los formularios y el editor de conceptos y contratos,
sin duplicar tablas con la misma configuración.

Se pueden crear, editar, duplicar, archivar y restaurar. «Guardar como plantilla»
copia la configuración de un evento; «Usar plantilla» crea otro evento. Ambas
operaciones copian conceptos y contratos activos sin pagos y sin gastos reales.
Las fechas de pago se reinician para adaptarlas al nuevo objetivo. El formulario
permite modificar nombre, fechas, presupuesto, apariencia y tipo antes de crear.

Archivar es la eliminación lógica reversible. No se expone una operación de
eliminación permanente que pueda destruir el historial de un evento.

Las plantillas de gastos conservan su evento opcional al duplicarse. En el alta
individual o por lote solo se hereda un evento vigente, de la misma cuenta y
hogar. Si finalizó, se canceló o archivó, se omite esa propuesta; en el formulario
individual se puede elegir otro evento. Guardar una plantilla no crea gastos.

## Modelo de datos y servicios

Migración: `supabase/migrations/20261116000002_eventos.sql`.

| Entidad | Función |
|---|---|
| `events` | Evento o plantilla, presupuesto, fechas, apariencia, estado y archivado |
| `event_items` | Conceptos de planificación y sus estimaciones |
| `event_commitments` | Costos contratados, vencimientos y cancelación |
| `expenses.event_id` | Como máximo un evento por gasto |
| `expenses.event_item_id` | Agrupador opcional dentro del evento |
| `expenses.event_commitment_id` | Compromiso del que este gasto es un pago |
| `expense_templates.event_id` | Propuesta opcional para próximos registros |
| `event_metrics` | Totales y porcentajes del evento, calculados en SQL |
| `event_item_metrics` | Pagado y pendiente por concepto |
| `event_commitment_metrics` | Pagado, pendiente, exceso y estado del contrato |

Los IDs compuestos con hogar/evento impiden cruzar conceptos, contratos y gastos.
Las referencias no crean movimientos nuevos. Los índices apoyan la búsqueda por
usuario/fecha, las asociaciones por evento y los pagos por compromiso.

RPC nuevas:

- `save_expense_event`: ejecuta `create_expense` o `update_expense` y la asociación
  en una misma transacción. Si la asociación falla, se revierte el movimiento,
  sus imputaciones y la clave de idempotencia. Un reintento confirmado no cambia
  el gasto ni vuelve a asociarlo con otro destino.
- `link_event_expenses`: bloquea gastos en orden estable, valida su propietario y
  cambia asociaciones sin invocar `recalc_period`. Mover un gasto desde otro
  evento o un pago desde otro compromiso requiere intención explícita. Repetir
  el vínculo de un evento conserva el compromiso ya existente del pago.
- `clone_event`: copia configuración y planificación, con clave UUID y bloqueo
  transaccional para que dos peticiones concurrentes no creen copias duplicadas.
- `event_analytics`: agrupa gastos activos en el servidor para cinco dimensiones.

Los triggers validan los vínculos también al usar las RPC originales y los lotes
de plantillas. No se reemplazaron las funciones de asignación de fondos. La
validación se limita a inserciones y cambios de asociación/moneda para conservar
los comportamientos administrativos existentes, incluida la limpieza de cuentas.

## Fórmulas y ciclo de vida

Todos los importes acumulados se calculan en PostgreSQL con `numeric`; no existen
contadores financieros independientes ni sumas monetarias del historial completo
en el navegador.

| Indicador | Cálculo |
|---|---|
| Pagado | Suma de gastos activos vinculados |
| Pendiente de contrato | `max(0, contratado − pagos activos)`; cero si se cancela |
| Pendiente del evento | Suma de pendientes de sus contratos |
| Costo proyectado | Pagado + pendiente |
| Disponible actual | Presupuesto − pagado |
| Disponible proyectado | Presupuesto − costo proyectado |
| Porcentajes | Pagado o proyectado / presupuesto × 100 |

Ejemplo: contrato de S/ 900 con adelanto de S/ 300 → pagado S/ 300, pendiente
S/ 600 y proyectado S/ 900. Un segundo pago de S/ 200 deja S/ 400 pendientes.
Los excesos de pagos y los disponibles negativos se muestran, sin truncarlos.
Con presupuesto cero los porcentajes son nulos. Solo se limita el ancho de la
barra; el texto conserva porcentajes superiores al 100 %.

Planificado y En curso reciben gastos nuevos. Finalizado, Cancelado y Archivado
conservan el historial y no reciben asociaciones nuevas. Pueden reabrirse o
restaurarse explícitamente. Cancelar el evento no cancela contratos con obligaciones
pendientes; cada contrato se cancela de forma explícita. Los pagos previos siempre
se conservan.

Los gastos mantienen fecha y período financiero originales. Se puede consultar y
vincular analíticamente un gasto de un período cerrado; editar su importe o fecha
sigue sujeto a las restricciones financieras originales.

## Seguridad, caché y rendimiento

Todas las tablas nuevas tienen RLS por propietario y pertenencia al hogar. Las
vistas usan `security_invoker`. No se admiten asociaciones entre cuentas aunque
el cliente envíe IDs válidos de otro usuario. Los vínculos de gastos verifican
también `created_by`.

Los auxiliares de trigger no son ejecutables por el cliente. Las RPC con
`SECURITY DEFINER` se limitan a las acciones que requieren escribir columnas de
gastos protegidas; validan identidad, hogar y referencias, y fijan `search_path`.
Las copias y el análisis usan `SECURITY INVOKER`. `anon` no tiene acceso.

El listado se pagina en bloques de 12 y los gastos en bloques de 20. Las métricas
son agregados de servidor, no N+1 por tarjeta. Las lecturas completas de catálogos,
planificación y análisis usan `leerTodo` con recuento exacto. La búsqueda tiene
debounce y las consultas consumen `AbortSignal`. Las mutaciones invalidan eventos
y las consultas de gastos relacionadas; no ejecutan recálculos de fondos por
cambiar el presupuesto, un contrato o un vínculo analítico.

## Archivos

Nuevos:

- `src/features/eventos/modelo.ts` y `modelo.test.ts`.
- `src/features/eventos/useEventos.ts`.
- `src/features/eventos/EventosPage.tsx` y `EventoDetalle.tsx`.
- `src/features/eventos/EventoForm.tsx` y `EventoVisual.tsx`.
- `src/features/eventos/PlanEventoForm.tsx`.
- `src/features/eventos/GastosEvento.tsx`.
- `src/features/eventos/SelectorEventoGasto.tsx`.
- La migración, `supabase/tests/eventos.test.sql` y `e2e/eventos.spec.ts`.
- Este documento.

Integraciones modificadas:

- `src/app/App.tsx`, `modulos.ts`, `AppLayout.tsx`: rutas y navegación.
- `src/features/gastos/GastoForm.tsx`, `RegistroGasto.tsx`: contexto opcional y registro desde un evento.
- `src/features/gastos/useGastos.ts`: persistencia atómica cuando se proporciona un evento.
- `src/features/gastos/usePlantillas.ts`, `GestorGastos.tsx`: evento de plantillas y conservación al duplicar.
- `src/lib/consultas.ts`: invalidación de métricas al cambiar gastos.
- `src/lib/tipos.ts`: compatibilidad de las nuevas columnas opcionales con consumidores anteriores.
- `src/lib/database.types.ts`: regenerado desde el esquema local.
- Pruebas de navegación inferior/lateral y navegación global: sexto módulo.
- `README.md`: enlace a esta documentación.

## Verificado

| Comprobación | Resultado |
|---|---|
| `npm run check` | TypeScript, lint y 552 pruebas unitarias correctas, en 46 archivos |
| SQL financiero y de seguridad | 494 comprobaciones correctas en 14 archivos; 82 específicas de Eventos |
| Instalación desde cero | 26/26 migraciones correctas en una base desechable; RLS y `search_path` verificados |
| Chromium, Firefox y WebKit | 18 combinaciones de flujos de Eventos cubiertas; los casos ajustados se repitieron y pasaron |
| Regresión de gastos, fondos, plantillas, chips y navegación | 30 casos cubiertos; la expectativa de desplegables de plantillas se actualizó para incluir el evento opcional y se verificó de nuevo |
| Formularios de evento, concepto y compromiso | Nueve anchos y ambos temas, sin desbordamientos y con acciones visibles; comprobación adicional de altura reducida |
| Navegación | Seis destinos en móvil a 320 px, áreas táctiles, ausencia de solapamientos y barra lateral expandida/compacta con teclado |
| Análisis | Las cinco dimensiones verificadas con un gasto real de prueba y totales consistentes |
| Accesibilidad | axe sin violaciones graves/críticas en los casos ejecutados, tanto en claro como en oscuro |
| `npm run build` y lint finales | Correctos; Vite mantiene un aviso de paquetes superiores a 500 kB, sin impedir compilar |

Las verificaciones de interfaz usan exclusivamente la cuenta E2E propia. Las
fixtures SQL se crean en transacciones con rollback. La instalación se comprueba
en una base desechable. No se insertaron eventos de ejemplo en las cuentas reales.

La comprobación final encontró 134 gastos y 8 fondos en la cuenta demo, la cuenta
personal nueva sin gastos ni fondos y cero usuarios/funciones temporales E2E
remanentes. No se trasladaron datos entre cuentas.

Durante las pruebas se corrigió un conflicto entre la validación nueva y la baja
administrativa de cuentas; se añadió cobertura SQL específica. También se
ajustaron las fixtures para editar gastos de períodos abiertos y se esperó a que
el Dashboard terminara de cargar antes de navegar, evitando abortar importaciones
de módulos en Firefox. Los errores de servicio 503 se comprobaron respetando el
tiempo de reintento del SDK y de TanStack Query.

Se revisaron capturas de escritorio y móvil en claro/oscuro. Los artefactos locales
están en `qa/eventos-lista-*.png`, `qa/eventos-detalle-*.png` y
`qa/eventos-formulario-*.png` (ignorados por Git).

## Despliegue y pendientes

La migración se aplicó solo a Supabase local, sin reset ni datos de ejemplo en los
hogares reales. Los tipos se regeneraron desde esa base. No se publicaron cambios
ni se ejecutaron operaciones en un Supabase remoto.

Antes de publicar, revisar y aplicar las migraciones versionadas pendientes en el
entorno de destino, incluida la migración de sugerencias si aún no existe. Después,
compilar y publicar el frontend con sus variables públicas de producción. No usar
las URL o credenciales locales en ese despliegue.

Quedan fuera de lo verificado físicamente los teclados nativos de iPhone/Android,
cada versión comercial de Safari/Edge y la PWA instalada en un dispositivo real.
La emulación de tamaño o el motor WebKit no equivale a esa comprobación física.
