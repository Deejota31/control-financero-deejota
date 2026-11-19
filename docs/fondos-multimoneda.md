# Fondos multimoneda USD/PEN

Un fondo puede estar en PEN o en USD. **Conserva su moneda**: presupuesto, consumo y saldo se llevan en esa moneda («nominal»). PEN sigue siendo la moneda contable de los reportes. Un fondo USD es un **presupuesto**, no dinero depositado: cambiar su moneda no crea ingresos, transferencias ni movimientos.

> Estado: **Etapas 1 (motor), 2 (formularios, plantillas, planificación) y 3 (Dashboard, eventos, exportaciones) implementadas y verificadas.** Ver «Pendiente» para lo que queda fuera.

## Modelo

| Tabla | Columna | Significado |
| --- | --- | --- |
| `funds`, `fund_templates` | `currency` (`PEN`/`USD`, defecto `PEN`) | Moneda del fondo. |
| `funds`, `fund_templates` | `allow_cross_currency` (defecto `false`) | El fondo solo cubre gastos de **otra** moneda si se autoriza. Nunca se activa de forma masiva. |
| `fund_period_budgets` | `assigned_amount` | Sin cambio: ahora es nominal, en la moneda del fondo. |
| `expense_fund_allocations` | `amount` | Sin cambio: **importe contable en PEN** (lo consumen Dashboard, eventos y el resto). |
| | `fund_currency`, `fund_amount` | Lo que se descuenta del fondo, en su moneda (en un fondo PEN, `fund_amount = amount`, garantizado por CHECK). |
| | `exchange_rate`, `rate_source`, `rate_reference_date` | Tasa (PEN por US$) con que se hizo esa imputación, congelada. |
| `expense_uncovered` (nueva) | `uncovered_amount`, `uncovered_original`, `original_currency` | Remanente que ningún fondo elegible pudo cubrir por moneda. Una fila por gasto como máximo. |

**Conciliación (trigger diferido):** `Σ imputaciones (PEN) + remanente no cubierto (PEN) = importe del gasto`. El gasto se guarda siempre completo; los fondos solo consumen lo que pueden cubrir.

Un fondo con gastos imputados **no puede cambiar de moneda** (`GD012`): reinterpretaría su historial. La solución es crear un fondo nuevo en la otra moneda.

## Motor (`recalc_period`)

1. Fondos activos del período que admiten la clasificación y el medio de pago (las reglas de siempre; la moneda no las reemplaza).
2. Orden: **específicos de la misma moneda** → **específicos de otra moneda con cobertura cruzada** → **Fondo General**. Dentro de cada grupo rigen las prioridades de siempre. Un fondo de otra moneda nunca se usa antes que uno elegible de la moneda del gasto.
3. Un específico nunca se excede por esta vía; el excedente va al General (que puede quedar negativo, como antes) **si es utilizable** (misma moneda o cobertura cruzada).
4. Si hay General pero no puede absorber por moneda, el remanente queda **no cubierto** (no se consume ningún otro fondo). Sin General, rige la regla histórica: el excedente va al primer específico utilizable con sobregasto advertido.
5. Sin ningún fondo utilizable, el gasto queda íntegramente sin cubrir. Si ningún fondo admite la clasificación/medio, sigue fallando con `GD001`.
6. Los recálculos del mismo período se **serializan** (`SELECT … FOR UPDATE` sobre el período): dos gastos simultáneos no consumen el mismo saldo (verificado: la segunda sesión espera a la primera).

### Conversión y redondeo
- USD→USD: la parte en PEN usa la tasa congelada del gasto. USD→fondo PEN: ídem. PEN→fondo USD: tasa de la **cotización verificada de la fecha del gasto** (`exchange_rate_quotes`; la del día o la última anterior, máx. 7 días); sin cotización no hay cobertura cruzada (no se inventa una tasa).
- Todo a 2 decimales y sin coma flotante. Las piezas suman **exactamente** el gasto: la última pieza absorbe el residuo (`allocation_piece`). Ejemplo: US$ 10.01 × 3.4190 = S/ 34.22 → 13.68 + 11.39 + 9.15.
- Los recálculos usan la tasa y la cotización **ya guardadas**; no consultan nada nuevo.

## Compatibilidad e histórico
- Todo fondo existente queda `PEN` con cobertura cruzada **desactivada**; sus imputaciones reciben `fund_amount = amount`, tasa 1.
- **Prueba sobre datos reales (local):** recalcular con el motor nuevo todos los períodos abiertos reproduce las 136 imputaciones **sin ninguna diferencia** (misma tabla antes y después, dentro de una transacción revertida).
- No se recalcula ningún período al migrar. Activar la cobertura cruzada o editar un fondo **no reasigna gastos pasados**: eso ocurre solo al recalcular el período (cualquier alta/edición de gasto en él, o `recalc_period` explícito).
- Los escritores antiguos que insertan imputaciones sin `fund_amount` siguen funcionando (trigger de valor por defecto).

## Consecuencia a tener en cuenta
Con la cobertura cruzada desactivada por defecto, **un gasto en USD con solo fondos PEN queda sin cubrir** (se guarda y cuenta en el Dashboard, pero no descuenta ningún fondo) hasta que el usuario habilite «Permitir cobertura en otra moneda» en el General o en el fondo que corresponda. La vista previa del formulario de gasto lo avisa («Sin fondo para US$ …»).

## Pruebas (Etapa 1)
`supabase/tests/fondos_multimoneda.test.sql` (46 comprobaciones): casos 1–9 del encargo (USD con fondo USD, excedente hacia General PEN, sin cobertura cruzada, PEN con fondo USD, sin cruzada, prioridad de moneda, límites, General negativo, redondeo), sin cotización, edición con imputación mixta sin duplicar, copia sin heredar imputaciones, conciliación global, sin imputaciones cruzadas no autorizadas, aislamiento entre cuentas (RLS), guardia de moneda, remanente negativo/duplicado rechazados, CHECK de fondos PEN, histórico no reasignado al habilitar la cobertura. `verify:install` aplica las 28 migraciones desde cero.

## Etapa 2: formularios, plantillas y planificación

- **Formulario de fondo (Diseño A):** el nombre va arriba, una sola vez, a todo el ancho. Columna izquierda: tarjeta de presupuesto (selector `US$ USD | S/ PEN` dentro de la tarjeta, importe grande y centrado, equivalente **referencial** en soles con la última cotización y su fecha; no se guarda), descripción, icono, color, Fondo General, activo y «Permitir cobertura en otra moneda» (con ayuda breve). Columna derecha: clasificación y medios de pago. Mismo formulario para nuevo, editar, clonar, plantilla y crear desde plantilla.
- **Cambio de moneda:** solo si el fondo no tiene gastos imputados; con gastos, el selector queda bloqueado con su motivo y el servidor lo impone (`GD012`). La solución es crear un fondo nuevo en la otra moneda. Nunca se reinterpreta «PEN 100» como «US$ 100» con historial.
- **Servidor** (`20261119000002`/`…03`): `save_fund`, `save_fund_template`, `apply_fund_templates` y `copy_funds` llevan moneda y cobertura cruzada (por defecto PEN y apagada). Consumo por fondo en su moneda en `open_consumption`, `fund_period_detail`, `close_period` (el cierre guarda la moneda en el snapshot) y `planning_summary` (presupuesto por moneda, gastos sin cubrir).
- **Páginas de Fondos y Planificación:** tabla, detalle, KPI y totales **por moneda, sin mezclar** («S/ 3,280.00 + US$ 50.00»); consumo y saldo de un fondo USD en dólares; plantillas y «copiar de otro mes» conservan la moneda y no convierten el presupuesto; los totales de selección van por moneda.
- **Vista previa del gasto:** muestra lo que descuenta cada fondo en su moneda y avisa «Sin fondo para US$ …» cuando algo no se cubre.
- **Pruebas:** `fondos_multimoneda_rpc.test.sql` (17), `e2e/fondos-multimoneda.spec.ts` (6: Diseño A, creación USD, totales por moneda, bloqueo de moneda con gastos, plantilla USD, vista previa con remanente, responsive 320–1440 y axe claro/oscuro).

## Etapa 3: Dashboard, eventos y exportaciones

**Política de valoración de presupuestos en dólares (referencial):** en los totales en soles, un fondo USD se valora con la **última cotización verificada del período**: la del último día del mes, o la última disponible hasta hoy si el mes está en curso; para un mes histórico **nunca una cotización posterior a su cierre**; fin de semana o feriado = último día publicado, con su fecha real. Sin cotización **no se inventa una tasa**: el total en soles incluye solo los fondos PEN y se avisa. Es solo para mostrar: no cambia saldos nominales ni imputaciones, y los gastos conservan la tasa con la que se registraron.

- **`dashboard_panel`:** `presupuesto` sigue siendo el de los fondos PEN; los fondos USD llegan en `usd` (presupuesto, consumo y saldo nominales; presupuesto/saldo valorizados; tasas usadas con fuente y fecha) y los fondos de distinta moneda no se fusionan (la clave incluye la moneda; consumo en la moneda del fondo). `no_cubierto` cuenta los gastos con remanente sin cubrir. Con solo fondos PEN la salida es la de siempre (las pruebas previas pasan sin cambios).
- **Tarjeta «Presupuesto consolidado»:** con fondos USD muestra «Por moneda» (fondos en soles · fondos en dólares con consumido y disponible en dólares), el total referencial con su tasa, fuente y fecha (ayuda breve) y la **diferencia cambiaria** cuando «asignado − gastado» no coincide con el disponible valorizado. `resumirPresupuesto` combina PEN nominal + USD valorizado sin asumir esa igualdad.
- **Cotización del período:** si el panel avisa de un período sin cotización, `useCompletarCotizaciones` la pide una vez por mes al servicio centralizado (que la guarda en la caché verificada) y vuelve a consultar; si el proveedor no responde, queda pendiente y no se insiste en bucle.
- **Eventos:** sin cambios de lógica: el evento suma `expenses.amount` (PEN contable) una sola vez; un gasto repartido entre fondos de ambas monedas cuenta una vez (probado en SQL).
- **Planificación:** presupuesto por moneda (nunca una suma mezclada), gastos sin cubrir; los avisos de editar/eliminar fondos muestran cada importe en la moneda de su fondo.
- **Exportación:** CSV conserva las columnas anteriores; los fondos PEN mantienen su formato («Fondo: 70.40») y los USD muestran su importe nominal («Fondo: 20.00 USD»); columnas nuevas `fondos_imputados_pen` y `no_cubierto_pen`. Respaldo JSON **v3**: fondos con moneda y cobertura cruzada, imputaciones con `fund_amount`/`fund_currency`/tasa y `no_cubierto`. `normalizarRespaldo` lee v1 y v2 sin convertir nada (fondos PEN, sin cobertura cruzada, `fund_amount = amount`) y conserva un v3 tal cual.
- **Pruebas:** `fondos_multimoneda_dashboard.test.sql` (25), `presupuesto.test.ts` (5 de USD), `exportacion.test.ts` (3), `e2e/dashboard-multimoneda.spec.ts` (3: valoración con tasa/fuente/fecha, sin cotización sin bucle, responsive 320–1440 y axe).

## Pendiente
- **Aún no se restaura desde un respaldo:** la aplicación no tiene importación; `normalizarRespaldo` queda lista para cuando exista.
- **Cotización:** depende del BCRP (con su cortafuegos); sin ella, el total en soles de un mes con fondos USD queda sin valorar.
- **No probado** en iPhone real ni en la PWA instalada; sin corrida E2E completa posterior a estos cambios.
