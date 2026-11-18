# Multimoneda USD/PEN

Los gastos pueden registrarse en dólares (USD) y se convierten a soles (PEN). **PEN sigue siendo la única moneda contable**: fondos, períodos, Dashboard, eventos y proyecciones trabajan solo con soles. Esto no es un libro contable multimoneda independiente.

## Modelo: doble representación

Cada gasto guarda **lo que se pagó** y **su equivalente contable congelado**:

| Columna (`expenses`) | Significado |
| --- | --- |
| `amount` | **Importe contable en PEN.** Es la columna que ya consumían todos los motores; no cambió de significado. Para USD es el equivalente congelado. |
| `original_currency` | `PEN` o `USD` (ISO 4217). |
| `original_amount` | Importe en la moneda de origen (`numeric(14,2)`). Nunca se reemplaza por el convertido. |
| `exchange_rate` | `numeric(24,12)`. PEN = `1`. En «cargo exacto» es la tasa **efectiva** (`cargo ÷ original`). |
| `exchange_rate_source` | `identity` (PEN), `Usuario` (manual/exacto) o `BCRP:PD04640PD`. |
| `exchange_rate_reference_date` | Fecha real de la cotización usada (puede ser anterior a la del gasto). |
| `conversion_method` | `none` (PEN), `automatic`, `manual`, `exact`. |
| `exchange_rate_fetched_at` | Cuándo se consultó (solo `automatic`). |
| `conversion_snapshot_version` | `1`. Permite evolucionar el modelo. |

Garantías (CHECK `expenses_conversion_valid` + triggers + RPC):

- PEN: `original_amount = amount`, tasa 1, método `none`. Un cliente no puede declarar PEN con otra tasa (el trigger la fuerza).
- USD: método válido, fuente obligatoria, tasa positiva y `amount = round(original × tasa, 2)` salvo en `exact`.
- Una conversión **nunca** se recalcula con cotizaciones posteriores: editar la descripción, la fecha o el medio no la toca; cambiar solo el importe USD usa la tasa congelada; una tasa nueva solo se aplica si el cliente la envía.
- **Nunca se asume 1:1** para USD: sin tasa válida el servidor rechaza el gasto (`GD010`).

La migración `20261118000001_multimoneda.sql` es aditiva e idempotente. Los gastos históricos (todos PEN, `CHECK currency = 'PEN'`) reciben la identidad (`original_amount = amount`, fecha de referencia = fecha del gasto) **sin tocar importes, fechas, fondos ni imputaciones**, y sin disparar `updated_at` ni auditoría. No se reclasifica ningún gasto por su descripción.

## Tres modos de conversión

1. **Automático**: cotización oficial BCRP de la fecha del gasto (o la última anterior publicada, máx. 7 días). El servidor solo acepta una cotización automática que **coincida con la caché verificada** (`exchange_rate_quotes`) y que no sea posterior a la fecha del gasto.
2. **Personalizado**: el usuario escribe la tasa; no se pisa cuando llega una respuesta nueva del proveedor.
3. **Cargo exacto**: el usuario indica lo que cobró el banco; **manda sobre la tasa automática**, la tasa efectiva se calcula y el cargo no es un segundo gasto ni genera «diferencia cambiaria».

## Cotización: proveedor y política

- **Fuente**: BCRP, serie `PD04640PD` — *Tipo de cambio, TC Sistema bancario SBS (S/ por US$), Venta*. Una sola serie y un solo tipo de tasa (nunca se mezclan compra, venta e interbancario; el parser rechaza otra serie).
- **Es orientativa**: no coincide necesariamente con la tasa aplicada por un banco o tarjeta. Por eso existe «Cargo exacto».
- **Función de borde** `supabase/functions/exchange-rate` (Deno): exige sesión válida, pide **un mes completo** al BCRP y llena la caché de todos sus días (una consulta por mes, no por gasto), reintenta si el cortafuegos del BCRP devuelve una página de verificación en lugar de JSON y, con el proveedor caído, sirve la cotización ya verificada si existe. No usa scraping de HTML ni credenciales.
- **Fechas**: la del gasto. Fin de semana/feriado/día sin publicar (`n.d.`) → último día publicado anterior, y la interfaz dice «referencia del dd/mm/aaaa». Fecha futura → no hay cotización (se ofrece tasa manual o cargo exacto). Un día cerrado (más de 7 días atrás) no vuelve a consultarse; los recientes se refrescan cada hora.
- **Caché**: en el servidor (`exchange_rate_quotes`, clave `date_requested`, lectura pública con sesión, escritura solo `service_role`) y en el cliente (`consultarCotizacion`: deduplicación y 15 min). La caché **no** modifica gastos ya guardados.
- **Sin servicio**: un gasto PEN nunca depende del proveedor. En USD se puede usar tasa manual o cargo exacto; no se guarda una conversión automática ficticia.

## Formulario de gasto (presentación)

- **Orden** (también el de teclado, sin `order` de CSS): Ámbito → Categoría → Subcategoría → Descripción → Evento → Medio de pago → Importe y moneda → Fecha y tipo → Recurrente → Cobertura → «Detalles adicionales» (notas y comprobante).
- **Escritorio**: dos columnas iguales (izquierda: clasificación, descripción y evento; derecha: medio de pago, importe, fecha/tipo y cobertura) con los detalles a todo el ancho. **Móvil**: una columna en ese mismo orden.
- **Tarjeta de importe** (`features/moneda/ImporteMoneda`): selector segmentado `US$ USD | S/ PEN` dentro de la tarjeta, importe grande y centrado editable en el sitio (16 px mínimo: sin zoom en iOS; no se reformatea al escribir, sí al salir) y, solo en USD, equivalente en soles, tasa/fuente/fecha y el control Automático · Personalizado · Cargo exacto con solo el campo que corresponde.
- **Evento** (`features/eventos/SelectorEventoGasto`): un solo buscador (combobox con teclado); la lista se despliega en el flujo del formulario, sin flotar ni cortarse en el modal. Con evento queda una fila con «Quitar evento». Concepto y compromiso aparecen solo si existen.
- **Detalles adicionales**: `<details>` accesible, cerrado por defecto; se abre solo si hay notas/comprobante guardados o errores, y plegarlo no pierde el archivo elegido.
- No cambió ninguna lógica financiera, RPC ni migración.

## Integración por módulo

- **Gastos**: selector `S/ PEN | US$ USD` junto al importe (`features/moneda/ImporteMoneda`). En PEN no aparece nada más. En USD: método, tasa/cargo, estado (consultando, del día, referencia anterior, conservada, sin conexión, error) y *Equivalente en soles*. Edición: conserva la conversión; clonar: consulta una cotización nueva. Listado: soles + `US$` discreto; detalle: sección «Conversión a soles».
- **Fondos**: solo ven `amount` (PEN). El descuento se calcula una vez. Los importes de los propios fondos siguen en PEN.
- **Plantillas**: `expense_templates.original_currency` + `default_amount` en esa moneda; **nunca una tasa**. Al registrar (individual o por lote) se usa la cotización de la fecha del nuevo gasto. El lote falla (atómico) si falta la conversión de una plantilla USD y el servidor fija la moneda desde la plantilla (el cliente no puede declarar PEN).
- **Proyección de cierre**: las plantillas USD se estiman con la cotización más reciente; si no hay, no se muestra proyección en vez de una cifra dudosa.
- **Eventos**: conceptos y compromisos conservan moneda original y su estimación en PEN (`planned_amount` / `contracted_amount`) con la tasa de hoy; los pagos reales son gastos con su propia conversión. Un pago se cuenta una sola vez, en soles. Las vistas `event_*_metrics` se recrearon para exponer las columnas nuevas.
- **Dashboard**: sin cambios; consume `amount`. El conteo de movimientos cuenta registros.
- **Exportación**: CSV añade `importe_original`, `moneda_original`, `tipo_de_cambio`, `metodo_conversion`, `fuente_tipo_cambio`, `fecha_referencia`, `importe_contable_pen`, `cotizacion_consultada_en`, `version_conversion` **al final** (las columnas anteriores no cambian de significado). El respaldo JSON pasa a `version_esquema: 2` e incluye todo el detalle; `normalizarRespaldo` lee la versión 1 (solo PEN) sin recalcular y rechaza una moneda histórica ambigua.

## Precisión

Importes y tasas son **texto decimal** en el cliente y se calculan con `BigInt` (`domain/moneda.ts`): `round-half-up(importe × tasa, 2)` en un solo paso. En la base, `numeric` (`round(...)` half-away-from-zero, idéntico para positivos). Ninguna ruta usa `Number`/`toFixed` para persistir. Ejemplo: US$ 10.00 × 3.45876 = 34.5876 → S/ 34.59; la tasa conserva 12 decimales.

## Seguridad

RLS intacta. `normalize_conversion` y `validate_conversion_reference` no son invocables por los roles de la API; las usan las RPC `SECURITY DEFINER` y los triggers. El servidor revalida todo (moneda, tasa, importe, método, fuente, coherencia y coincidencia con la caché): no se confía en el navegador. `exchange_rate_quotes` es una tabla pública de solo lectura para usuarios con sesión; nadie puede escribir cotizaciones salvo la función de borde.

## Pruebas

- Unitarias: `domain/moneda.test.ts`, `features/moneda/cotizaciones.test.ts`, `features/moneda/bcrp.test.ts` (fin de semana, `n.d.`, serie incorrecta, diagnósticos PHP, mes completo), `domain/registroPlantillas.test.ts`, `domain/exportacion.test.ts`.
- SQL (`supabase/tests/multimoneda.test.sql`, 56 comprobaciones): casos A, B, C, E, F, H, I; conversiones inválidas sin rastro; cotización automática falsa o futura; idempotencia; edición; lote USD; eventos; RLS; CHECK en acceso directo.
- E2E (`e2e/multimoneda.spec.ts`, 13 pruebas): PEN con coma, USD automático/personalizado/cargo exacto, proveedor caído, edición, clonación, plantilla, lote, eventos, responsive 320–1440 px, axe claro/oscuro y consolidación en soles. El proveedor se simula en el navegador pero escribe en la caché real de la base.
- `npm run verify:install`: aplica las 27 migraciones desde cero.

## Despliegue

1. **Aplicar la migración primero** (`supabase db push`, tras exportar tus datos): un frontend nuevo contra una base sin migrar guardaría un gasto USD como PEN.
2. **Publicar la función**: `supabase functions deploy exchange-rate --project-ref <ref>` (usa las variables que Supabase inyecta: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; no hay secretos propios).
3. Fusionar `develop` → `main` (Netlify publica el frontend).
4. Verificar en producción: un gasto USD automático y uno con cargo exacto; comprobar en Supabase que `exchange_rate_quotes` se llena.

## Limitaciones conocidas

- El BCRP protege su API con un cortafuegos: ráfagas desde una misma IP pueden recibir una página de verificación. Se mitiga con una consulta por mes, caché y reintentos; si falla, queda la tasa manual o el cargo exacto. No hay proveedor secundario (no se inventan endpoints; añadirlo es sustituir `fetchBcrp`).
- Solo PEN y USD. Una moneda nueva exige su serie de cotización, su CHECK y su símbolo (el modelo ya no asume dos monedas en la lógica de conversión).
- Un gasto con fecha futura no tiene cotización automática (tasa manual o cargo exacto).
- Los compromisos de eventos en USD son estimaciones con la tasa del día de la planificación; no se actualizan solos.
- La aplicación no tiene importación de respaldos; `normalizarRespaldo` queda listo para cuando exista.
