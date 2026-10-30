# Reglas de asignación de fondos (vigentes)

La asignación vive en PostgreSQL (`recalc_period`, definición vigente en `20261101000001_fondos_por_periodo.sql`) y es la única fuente de verdad.

**Modelo vigente:** cada fondo es una *instancia de un mes* (`funds.period_id`): tiene su nombre, prioridad, reglas e importe propios y no existe fuera de su mes. Lo reutilizable entre meses son las *plantillas de fondos* (`fund_templates`), que son configuración y no tienen saldo.
El frontend solo previsualiza llamando a `preview_expense`, que ejecuta la operación real y la revierte.

## Cuándo un fondo admite un gasto

Un fondo activo admite un gasto si cumple **clasificación** y **medio de pago**:

- Clasificación (`fund_scope_rules`, un nivel por regla: ámbito, categoría o subcategoría):
  - Si el fondo tiene reglas *include*, el gasto debe coincidir con al menos una.
  - Si coincide con alguna regla *exclude*, no se admite (la exclusión gana).
  - Sin reglas *include* se admite cualquier clasificación (lo normal en el Fondo General).
- Medio de pago (`fund_payment_rules`): igual, con medios incluidos o excluidos.
- No hay condiciones codificadas por nombre de medio: Sodexo, Yape, etc. son filas del catálogo.
- Un fondo **específico** debe tener al menos una regla de clasificación *include* (se valida al guardar).

## Orden de asignación

1. Se consumen los fondos **específicos** compatibles por prioridad (`priority` ascendente), cada uno hasta su capacidad restante en el período.
2. El **excedente** lo absorbe el **Fondo General** si admite la combinación. El General puede quedar **negativo**; un saldo negativo por sí solo nunca bloquea el guardado.
3. Si el mes **tiene fondos activos** pero **ninguno** admite la combinación, el gasto se **bloquea** (`GD001`) y se indica el motivo: clasificación, medio de pago o reglas combinadas.
   Si el mes **no tiene ningún fondo activo**, no hay nada que imputar: el gasto se guarda **sin fondo** (sin imputaciones) hasta que se configuren fondos en ese mes, y entonces se recalcula.
4. Si hay fondos específicos compatibles pero el General **no** admite la combinación, el importe que no cabe se registra **completo** en el específico de mayor prioridad y se muestra una advertencia de **sobregasto**. Nunca se pierde ni se rechaza un gasto real por exceder el presupuesto.
5. Un gasto activo nunca queda parcialmente imputado: la suma de sus imputaciones es igual a su importe (restricción diferida verificada al cerrar la transacción), **salvo en un mes sin fondos**, donde queda sin imputar. Un gasto anulado no tiene imputaciones.
6. Nunca se cambia automáticamente el ámbito, la categoría o el medio de un gasto para hacerlo encajar.

## Períodos

- Mensuales, creados al usarlos (`ensure_period_rpc`, idempotente). Un mes nuevo **empieza sin fondos**: se crean, se copian de otro mes (`copy_funds`) o se aplican desde plantillas (`apply_fund_templates`). Cada fondo tiene su presupuesto del período (`fund_period_budgets`), inicializado con su `default_amount`.
- Editar fondos o presupuestos **recalcula los períodos abiertos** de forma transaccional, en orden cronológico (fecha, creación). Antes de confirmar, `save_fund(..., dry_run = true)` informa cuántos gastos cambian.
- Un período se puede **cerrar** cuando ya terminó (`close_period`): se guarda un snapshot por fondo (`period_fund_snapshots`) y deja de recalcularse. No se crean, editan ni anulan gastos en períodos cerrados, y su presupuesto no cambia.
- Efecto a tener en cuenta: como la imputación es cronológica, registrar un gasto con fecha anterior puede cambiar qué fondo cubre gastos posteriores del mismo período. La previsualización lo muestra.

## Códigos de error propios

`GD001` combinación sin fondo · `GD002` período cerrado · `GD003` plantilla ya registrada · `GD004` no encontrado · `GD005` gasto anulado · `GD006` regla de fondo inválida · `GD007` período no cerrable · `GD008` falta importe · `GD009` comprobante inválido.
