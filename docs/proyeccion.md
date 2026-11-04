# Métricas del Dashboard: proyección, comparaciones y precisión

Este documento explica **cómo se calculan** las cifras que más se prestan a malas interpretaciones, qué fórmula se usaba antes, por qué se cambió y qué límites tienen. El código vive en `src/domain/` (funciones puras con pruebas).

## 1. Precisión monetaria (`dinero.ts`)

La base de datos guarda `numeric(12,2)`, pero JavaScript suma con coma flotante binaria (`0.1 + 0.2 = 0.30000000000000004`). Toda suma de importes se hace ahora **en céntimos enteros** y solo se convierte a soles al final (`aCentimos`, `deCentimos`, `sumar`). Las divisiones (promedios, porcentajes, proyecciones) se redondean **una sola vez**, al presentar. Afecta a: totales y desgloses (`dashboard.ts`), serie diaria, ritmo ideal, presupuesto consolidado (`presupuesto.ts`) y la proyección.

## 2. Proyección de cierre del mes (`proyeccion.ts`)

### Fórmula original (lineal) y su problema

```
proyección = gasto acumulado ÷ días transcurridos × días del mes
```

Es aritméticamente correcta, pero **trata cada gasto como si se repitiera todos los días**. Caso real de la captura (4 de noviembre): `2 358.30 ÷ 4 × 30 = 17 687.25`, casi 5 veces el presupuesto de S/ 3 680. El gasto incluía pagos que ocurren **una vez al mes** (un ahorro de S/ 700 el día 3, marcado «Recurrente»); extrapolarlos diariamente infla el resultado. La fórmula no estaba «mal calculada»: estaba mal planteada para tan pocos días.

La lineal se conserva solo como **referencia** y se rotula «no fiable» cuando faltan datos.

### Modelo ajustado

```
cierre = gasto real hasta hoy + compromisos pendientes + tasa diaria variable × días restantes
```

| Componente | Cómo se obtiene |
|---|---|
| **Gasto real** | Suma de gastos activos con fecha ≤ hoy (nunca movimientos futuros), con los filtros activos. |
| **Compromisos** (fijos y recurrentes) | Gastos con tipo *Fijo* o marcados *Recurrente*. Ocurren una vez al mes: **no se extrapolan por día**. |
| **Compromisos pendientes** | (1) Si hay plantillas mensuales activas: las que aún no se registraron ni se marcaron «No aplica» este mes (sumando su importe). (2) Si no hay plantillas: el promedio mensual de compromisos de los meses cerrados menos lo ya registrado (mínimo 0; requiere ≥ 2 meses). (3) Si no hay ninguna: 0. |
| **Tasa diaria variable** | Gasto variable de los **días completos** (hoy no entra: aún no termina) mezclado con el historial: `(variable_real + tasa_historial × 7) ÷ (días_completos + 7)`. Sin historial: solo el propio mes (exige ≥ 7 días completos). |
| **Días restantes** | `días del mes − días transcurridos` (28, 29, 30 o 31 reales). |

Un **pago planificado no es un gasto real**: solo entra en la estimación y deja de contar como pendiente en cuanto se registra (el real sube lo mismo que baja el pendiente: la estimación no cambia, no hay doble contabilización). Los gastos con fecha futura no son gasto real.

Un gasto **extraordinario no se excluye en silencio por ser grande**. Si un solo gasto concentra más del 40 % del gasto variable (y llevamos menos de 15 días), se **advierte** que la estimación puede estar sobrevalorada, pero se cuenta.

### Calidad de la estimación (criterios objetivos)

| Estado | Criterio | Qué se muestra |
|---|---|---|
| **Datos insuficientes** | < 7 días completos **y** < 2 meses cerrados con gasto | Sin línea de proyección. Mensaje con lo que falta y la referencia lineal rotulada «no fiable». |
| **Estimación preliminar** | Hay datos para estimar, pero no se cumple el criterio siguiente | Línea discontinua + «Cierre estimado (preliminar)» y aviso. |
| **Con historial** | ≥ 10 días completos **y** ≥ 3 meses cerrados con gasto | Línea discontinua + «Cierre estimado». |

Si el cierre estimado supera el presupuesto se muestra una **nota contextual** («si el ritmo se mantiene… es una estimación, no un hecho»), nunca un error. La diferencia contra el presupuesto solo se calcula si hay presupuesto y no hay filtros que reduzcan el conjunto.

### Cuándo no aplica

Solo se proyecta un **mes calendario completo y en curso**. Un mes cerrado, un mes futuro, un rango libre o el último día del mes no tienen proyección. La línea dibujada arranca en el último acumulado real y llega al cierre estimado sin saltos.

### Limitaciones

- Un mes de historial incompleto (el primero que se usó la aplicación a mitad de mes) baja la tasa histórica.
- Pagos fijos que **no** tienen plantilla y no aparecen como fijos/recurrentes se tratan como variables.
- Es una estimación estadística simple, no un modelo de predicción; no conoce eventos futuros.

## 3. Ritmo ideal del presupuesto

```
ritmo_ideal(día) = presupuesto × día ÷ días del mes     (en céntimos, redondeado una vez)
```

Empieza en 0, crece de forma uniforme y **termina exactamente en el presupuesto** en meses de 28, 29, 30 y 31 días (probado). Con S/ 3 680 en noviembre: día 1 = 122.67, día 15 = 1 840.00, día 30 = 3 680.00. Superar la línea no es necesariamente un problema (los gastos fijos suelen concentrarse al inicio): la interfaz no saca conclusiones automáticas de esa diferencia.

## 4. Variación contra el período anterior (`rangoComparable`)

**Problema:** el Dashboard comparaba el mes en curso (4 días) con el mes anterior **completo** (31 días): siempre salía «−71 %», sin significado.

**Ahora:** mientras el rango sigue en curso se compara el **mismo tramo**: del día 1 al día N de este mes contra del día 1 al día N del mes anterior (acotado a su último día: el 30 de marzo frente a febrero compara con el 28). Un mes terminado compara período completo con período completo; un mes futuro no se compara. La nota del indicador dice qué tramo se usó.

```
variación % = (gasto_tramo_actual − gasto_tramo_anterior) ÷ gasto_tramo_anterior × 100
```

Si la base es cero o negativa se muestra **«Sin base comparable»** (nunca infinito ni un porcentaje artificial).

## 5. Tendencia histórica y ranking (`analisis.ts`)

**Problema 1:** la base histórica dividía siempre entre 5 meses, aunque el hogar solo hubiera usado la aplicación 1 mes. Eso hacía la base 5 veces menor y la variación 5 veces mayor (de ahí los «▲ 3 964 %»).

**Ahora:** la base es el promedio de los meses anteriores **con gasto registrado** (un mes en que el hogar aún no usaba la aplicación no es un «mes de cero»; un grupo sin gasto en un mes observado sí cuenta como cero). Si el mes en curso es parcial, la base se prorratea por los días transcurridos.

**Problema 2:** un porcentaje aislado sin contexto engaña (pasar de S/ 5 a S/ 200 es +3 900 %, correcto pero poco informativo).

**Ahora** cada elemento muestra, además del porcentaje: la **base histórica** y de cuántos meses sale, la **variación en soles** y, si la base tiene menos de 3 meses, la advertencia «base corta». Por encima de ±1 000 % se muestra «>1000 %». Sin historial no se inventa ninguna variación.

**Participación vs variación:** el `%` junto al importe es la **participación** en el total del ranking (≤ 100 %); la variación es otro campo. Un +300 % no significa que la categoría sea el 300 % del gasto.

## 6. Coherencia entre pantallas

Pruebas que la garantizan (SQL independiente de la interfaz):

- `supabase/tests/dashboard_panel.test.sql`: sin filtros, `por_ambito`, `por_categoria` y `serie` suman el total; cada movimiento se cuenta una vez; `imputado + sin_fondo = gasto del período`.
- `e2e/consistencia.spec.ts`: total, movimientos y desglose por ámbito del Dashboard = SQL = listado de Gastos; anular un gasto se refleja en el Dashboard; un gasto repartido entre fondos no se duplica; el presupuesto consolidado de un mes solo suma los fondos de ese mes; asignado − imputado = disponible (y exceso = max(0, −disponible)).
- `src/domain/presupuesto.test.ts`: caso de control S/ 3 680 − S/ 2 358.30 = S/ 1 321.70 (64.08 %), saldo firmado, fondo agotado sin exceso global, gasto sin fondo compatible no imputado.

## 7. Móvil (Safari / PWA)

- **Zoom al enfocar:** iOS amplía la página si un campo editable tiene letra computada < 16 px. En pantallas táctiles todos los campos usan 16 px como mínimo (regla central en `index.css`; los campos ya mayores se conservan). El viewport **no** usa `maximum-scale` ni `user-scalable=no`: el usuario conserva el zoom manual.
- **Filtros del Dashboard:** banda `sticky top-0` a todo el ancho útil, con el fondo de la página (nada se asoma por arriba ni por los lados) y el área segura superior de iOS; el filtro queda alineado con las tarjetas.
- **Gráficos:** dona centrada; eje de días con marcas fijas (1, 5, 10, 15, 20, 25 y el último día si queda a ≥ 3 días), sin superposiciones en ningún ancho.

### Pendiente de validación física

Las pruebas automáticas usan Chromium con emulación táctil de iPhone, **no Safari real**. Falta comprobar en un iPhone (Safari y PWA instalada): (1) que no hay zoom al enfocar Descripción/Notas/Importe/búsquedas; (2) que al cerrar el teclado el encuadre vuelve a la normalidad; (3) el filtro pegajoso bajo la barra de estado dinámica; (4) el scroll interno de «Nuevo gasto» con el teclado abierto; (5) guardar un gasto y volver al Dashboard sin zoom residual.
