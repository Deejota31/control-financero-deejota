# Arquitectura

```
React (Vite SPA) ── supabase-js (clave publishable + JWT del usuario)
        │
        ├─ Supabase Auth ........ identidad y sesión (registro público desactivado)
        ├─ PostgREST ............ lectura con RLS; escritura directa solo en catálogo, plantillas y perfil
        ├─ RPC (SQL functions) .. operaciones financieras atómicas
        └─ Storage .............. bucket privado "comprobantes" (ruta {household_id}/{gasto}/{archivo})
```

## Modelo de datos (resumen)

- **Identidad:** `households`, `household_members`, `profiles`. Todo cuelga de `household_id`; hoy un hogar por usuario (`owner`). Abrir colaboración = añadir miembros y roles.
- **Catálogo:** `ambitos` → `categorias` → `subcategorias`, y `medios_pago`. Claves foráneas compuestas garantizan mismo hogar y jerarquía coherente (un gasto no mezcla ámbito/categoría/subcategoría). Iconos y colores limitados a listas seguras.
- **Presupuesto:** `budget_periods` (mensuales), `funds`, `fund_period_budgets`, reglas `fund_scope_rules` y `fund_payment_rules`, `period_fund_snapshots` (histórico de períodos cerrados).
- **Gastos:** `expenses` (baja lógica), `expense_fund_allocations` (imputación; la suma por gasto activo = importe, verificado con restricción diferida), `expense_templates`, `template_batches` y `template_batch_items`.
- **Trazabilidad:** `audit_logs` (triggers; solo lectura para el propietario) e `idempotency_requests`.

## Qué es solo lectura para el cliente

Períodos, fondos, reglas, presupuestos, gastos, imputaciones, lotes y auditoría **solo se escriben con RPC** (`SECURITY DEFINER`, con comprobación de pertenencia al hogar): `create_expense`, `update_expense`, `annul_expenses`, `restore_expenses`, `preview_expense`, `save_fund`, `reorder_funds`, `set_fund_period_budget`, `close_period`, `apply_template_batch`, `ensure_period_rpc`. Las que recalculan aceptan `dry_run`/previsualización exacta (se ejecuta y se revierte).

## Reglas de fondos

Ver [reglas-fondos.md](reglas-fondos.md). Códigos de error propios `GD001`…`GD009`.

## Frontend

`src/features/*` por módulo (auth, catálogo, fondos, gastos, dashboard, salud, perfil), `src/domain` con lógica pura probada (compatibilidad de fondos, series y proyección, tendencias), `src/components/ui` con componentes accesibles (selector con búsqueda, calendario, importe con prefijo `S/`, diálogos). Datos con TanStack Query: consultas con cancelación al cambiar filtros, invalidación coherente tras cada operación; sin actualizaciones optimistas en operaciones financieras (la imputación depende del servidor).

## Limitaciones conocidas

- Los comprobantes subidos pueden quedar huérfanos si el guardado del gasto falla después de subir el archivo (se intenta borrar, pero no hay barrido periódico).
- La imputación es cronológica: registrar un gasto con fecha anterior puede cambiar qué fondo cubre gastos posteriores del mismo período (la previsualización lo muestra).
- El Dashboard agrega en el cliente (hasta 5000 gastos por consulta); suficiente para uso personal.
- No se incluye gráfico por medios de pago ni conversión de monedas, según el alcance.
