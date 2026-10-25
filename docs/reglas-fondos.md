# Reglas de asignación de fondos (vigentes)

La asignación vive en PostgreSQL (`recalc_period`, migración `…_motor_asignacion.sql`) y es la única fuente de verdad.
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
3. Si **ningún fondo** admite la combinación, el gasto se **bloquea** (`GD001`) y se indica el motivo: clasificación, medio de pago o reglas combinadas.
4. Si hay fondos específicos compatibles pero el General **no** admite la combinación, el importe que no cabe se registra **completo** en el específico de mayor prioridad y se muestra una advertencia de **sobregasto**. Nunca se pierde ni se rechaza un gasto real por exceder el presupuesto.
5. Un gasto activo nunca queda parcialmente imputado: la suma de sus imputaciones es igual a su importe (restricción diferida verificada al cerrar la transacción). Un gasto anulado no tiene imputaciones.
6. Nunca se cambia automáticamente el ámbito, la categoría o el medio de un gasto para hacerlo encajar.

## Períodos

- Mensuales, creados automáticamente. Cada fondo tiene un presupuesto por período (`fund_period_budgets`), inicializado con su `default_amount`.
- Editar fondos o presupuestos **recalcula los períodos abiertos** de forma transaccional, en orden cronológico (fecha, creación). Antes de confirmar, `save_fund(..., dry_run = true)` informa cuántos gastos cambian.
- Un período se puede **cerrar** cuando ya terminó (`close_period`): se guarda un snapshot por fondo (`period_fund_snapshots`) y deja de recalcularse. No se crean, editan ni anulan gastos en períodos cerrados, y su presupuesto no cambia.
- Efecto a tener en cuenta: como la imputación es cronológica, registrar un gasto con fecha anterior puede cambiar qué fondo cubre gastos posteriores del mismo período. La previsualización lo muestra.

## Códigos de error propios

`GD001` combinación sin fondo · `GD002` período cerrado · `GD003` plantilla ya registrada · `GD004` no encontrado · `GD005` gasto anulado · `GD006` regla de fondo inválida · `GD007` período no cerrable · `GD008` falta importe · `GD009` comprobante inválido.
