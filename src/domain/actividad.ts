export type CategoriaActividad = 'creacion' | 'edicion' | 'anulacion' | 'restauracion' | 'eliminacion' | 'catalogo' | 'presupuesto' | 'sistema'

export const ENTIDADES: Record<string, string> = {
  expenses: 'Gasto', funds: 'Fondo', fund_period_budgets: 'Presupuesto de fondo', ambitos: 'Ámbito', categorias: 'Categoría',
  subcategorias: 'Subcategoría', medios_pago: 'Medio de pago', expense_templates: 'Plantilla', budget_periods: 'Período',
}
export const ACCIONES: Record<string, string> = { insert: 'Creó', update: 'Editó', delete: 'Eliminó', annul: 'Anuló', restore: 'Restauró' }

const CATALOGO = new Set(['ambitos', 'categorias', 'subcategorias', 'medios_pago', 'expense_templates'])
const PRESUPUESTO = new Set(['funds', 'fund_period_budgets', 'budget_periods'])

export const ETIQUETA_CATEGORIA: Record<CategoriaActividad, string> = {
  creacion: 'Creación', edicion: 'Edición', anulacion: 'Anulación', restauracion: 'Restauración', eliminacion: 'Eliminación',
  catalogo: 'Catálogo', presupuesto: 'Presupuesto', sistema: 'Sistema',
}

/**
 * Clasifica un evento de auditoría. Los eventos sin usuario (cargas iniciales, semillas, procesos internos) son de
 * "sistema". Anular y restaurar siempre se muestran como tales; el resto se agrupa por catálogo o presupuesto.
 */
export function clasificar(entidad: string, accion: string, userId: string | null): CategoriaActividad {
  if (userId === null) return 'sistema'
  if (accion === 'annul') return 'anulacion'
  if (accion === 'restore') return 'restauracion'
  if (PRESUPUESTO.has(entidad)) return 'presupuesto'
  if (CATALOGO.has(entidad)) return 'catalogo'
  if (accion === 'insert') return 'creacion'
  if (accion === 'delete') return 'eliminacion'
  return 'edicion'
}

/** Nombre legible del registro afectado, tomado de su estado posterior (o anterior si se eliminó). */
export function nombreDeEvento(antes: unknown, despues: unknown): string {
  const s = (despues ?? antes) as { description?: string; name?: string } | null
  return s?.description ?? s?.name ?? ''
}
