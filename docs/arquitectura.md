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

## Límites de consulta y métricas financieras

PostgREST recorta cada respuesta en `max_rows` (1000) **sin avisar**. Reglas del proyecto:

- Los KPIs y gráficos del Dashboard se calculan **en PostgreSQL** con `dashboard_panel` (total, cantidad, serie diaria, distribución por ámbito/categoría/subcategoría, recientes, fondos, excedente) para el período, su comparativo y los filtros cruzados (ámbito, categoría, subcategoría, medio, tipo, día). Incluyen todos los registros.
- Cualquier otra lectura que alimente una cifra (Fondos, Salud, estado de plantillas, exportaciones) usa `leerTodo`: pagina hasta agotar la consulta y **falla** si el servidor entrega menos de lo que declara (`ResultadoIncompletoError`), en lugar de devolver datos parciales.
- La tabla de gastos sigue paginada en servidor, con total exacto y desempate único por `id` en el orden (sin él, filas con la misma fecha y `created_at` podían repetirse u omitirse entre páginas).
- Las listas cortas (6 gastos recientes) son listas, no métricas.

## Comprobantes y limpieza

El archivo se sube antes de guardar el gasto, por lo que el flujo es compensatorio:

1. Antes de subir se registra una *intención* de limpieza (`storage_cleanup_tasks`, con 10 minutos de gracia).
2. Si el guardado falla de forma definitiva, se borra el archivo recién subido; si el borrado falla, se registra una tarea inmediata (o, sin red, queda en una cola local `gd-limpieza-pendiente`).
3. Si el resultado es ambiguo (error de red), el archivo **no** se borra: puede que el gasto sí se haya guardado; el reintento reutiliza la misma ruta y clave.
4. Al guardar con éxito, el comprobante reemplazado o quitado se elimina **después**; un fallo de edición nunca borra el comprobante existente.
5. Al iniciar sesión se procesan las tareas pendientes. `listar_limpieza` descarta cualquier tarea cuyo archivo esté referenciado por un gasto: nunca se borra un comprobante en uso.

## Limitaciones conocidas

- La imputación es cronológica: registrar un gasto con fecha anterior puede cambiar qué fondo cubre gastos posteriores del mismo período (la previsualización lo muestra).
- Un archivo subido cuyo navegador se cierra antes de registrar nada solo se limpia si llegó a registrarse la intención previa (una petición adicional antes de subir).
- No se incluye gráfico por medios de pago ni conversión de monedas, según el alcance.
