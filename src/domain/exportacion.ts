import { aCsv } from '@/lib/csv'
import { MARCA } from '@/lib/marca'

export const VERSION_RESPALDO = 1

export type TipoArchivo = 'gastos' | 'respaldo'

/** Nombres de las descargas: control-financiero-gastos-YYYY-MM-DD.csv y control-financiero-respaldo-YYYY-MM-DD.json */
export function nombreArchivo(tipo: TipoArchivo, fechaIso: string): string {
  return tipo === 'gastos' ? `${MARCA.archivo}-gastos-${fechaIso}.csv` : `${MARCA.archivo}-respaldo-${fechaIso}.json`
}

export interface GastoFila {
  id: string
  expense_date: string
  amount: number | string
  currency: string
  description: string
  ambito_id: string
  categoria_id: string
  subcategoria_id: string | null
  payment_method_id: string
  expense_type: string
  is_recurring: boolean
  status: string
  notes: string | null
  receipt_path: string | null
  created_at: string
}
export interface Nombrado { id: string; name: string }
export interface AsignacionFila { expense_id: string; fund_id: string; amount: number | string; allocation_kind: string }

export interface OpcionesCsv {
  gastos: GastoFila[]
  ambitos: Nombrado[]
  categorias: Nombrado[]
  subcategorias: Nombrado[]
  medios: Nombrado[]
  fondos: Nombrado[]
  asignaciones: AsignacionFila[]
  incluirAnulados: boolean
  desde?: string
  hasta?: string
}

export const ENCABEZADOS_CSV = [
  'fecha', 'importe', 'moneda', 'descripcion', 'ambito', 'categoria', 'subcategoria', 'medio_de_pago', 'tipo',
  'recurrente', 'estado', 'notas', 'fondos_imputados', 'tiene_comprobante', 'registrado_en',
]

/** Importe sin separador de miles y con punto decimal: no depende de la configuración regional de quien abra el archivo. */
export const importeExport = (v: number | string): string => Number(v).toFixed(2)

/** Aplica estado y rango (inclusive). Las fechas son ISO yyyy-MM-dd, que se comparan como texto. */
export function filtrarGastos(g: GastoFila[], o: Pick<OpcionesCsv, 'incluirAnulados' | 'desde' | 'hasta'>): GastoFila[] {
  return g.filter((x) => (o.incluirAnulados || x.status === 'active') && (!o.desde || x.expense_date >= o.desde) && (!o.hasta || x.expense_date <= o.hasta))
}

export function construirCsvGastos(o: OpcionesCsv): string {
  const mapa = (l: Nombrado[]) => new Map(l.map((x) => [x.id, x.name]))
  const amb = mapa(o.ambitos), cat = mapa(o.categorias), sub = mapa(o.subcategorias), med = mapa(o.medios), fon = mapa(o.fondos)
  const porGasto = new Map<string, AsignacionFila[]>()
  for (const a of o.asignaciones) porGasto.set(a.expense_id, [...(porGasto.get(a.expense_id) ?? []), a])
  const filas = filtrarGastos(o.gastos, o)
    .sort((a, b) => a.expense_date.localeCompare(b.expense_date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((g) => [
      g.expense_date,
      importeExport(g.amount),
      g.currency,
      g.description,
      amb.get(g.ambito_id) ?? '',
      cat.get(g.categoria_id) ?? '',
      g.subcategoria_id ? (sub.get(g.subcategoria_id) ?? '') : '',
      med.get(g.payment_method_id) ?? '',
      g.expense_type === 'fixed' ? 'Fijo' : 'Variable',
      g.is_recurring ? 'Sí' : 'No',
      g.status === 'active' ? 'Activo' : 'Anulado',
      g.notes ?? '',
      (porGasto.get(g.id) ?? []).map((a) => `${fon.get(a.fund_id) ?? 'Fondo'}: ${importeExport(a.amount)}`).join(' | '),
      g.receipt_path ? 'Sí' : 'No',
      g.created_at,
    ])
  return aCsv(ENCABEZADOS_CSV, filas)
}

type Fila = Record<string, unknown>
const sin = (f: Fila, claves: string[]): Fila => Object.fromEntries(Object.entries(f).filter(([k]) => !claves.includes(k)))

/** Campos que nunca salen en un respaldo: autoría (ids de usuario) y rutas internas de archivos. */
const SENSIBLES = ['created_by', 'annulled_by', 'receipt_path', 'user_id']

export interface DatosRespaldo {
  perfil: { display_name: string | null; timezone: string; date_format: string; theme: string; display_currency: string } | null
  hogar: Fila | null
  ambitos: Fila[]; categorias: Fila[]; subcategorias: Fila[]; medios_pago: Fila[]
  fondos: Fila[]; reglas_ambito: Fila[]; reglas_medio: Fila[]
  periodos: Fila[]; presupuestos_fondo: Fila[]
  gastos: Fila[]; imputaciones: Fila[]; plantillas: Fila[]
}

export function construirRespaldo(d: DatosRespaldo, ahoraIso: string) {
  return {
    aplicacion: MARCA.nombre,
    version_esquema: VERSION_RESPALDO,
    exportado_en: ahoraIso,
    nota: 'Copia de tus datos. No incluye contraseñas, tokens, sesiones, claves ni archivos de comprobantes.',
    perfil: d.perfil && { display_name: d.perfil.display_name, timezone: d.perfil.timezone, date_format: d.perfil.date_format, theme: d.perfil.theme, display_currency: d.perfil.display_currency },
    hogar: d.hogar && sin(d.hogar, SENSIBLES),
    catalogo: { ambitos: d.ambitos, categorias: d.categorias, subcategorias: d.subcategorias, medios_pago: d.medios_pago },
    fondos: { fondos: d.fondos, reglas_ambito: d.reglas_ambito, reglas_medio_pago: d.reglas_medio },
    periodos: { periodos: d.periodos, presupuestos_fondo: d.presupuestos_fondo },
    gastos: d.gastos.map((g) => ({ ...sin(g, SENSIBLES), tiene_comprobante: Boolean(g.receipt_path) })),
    imputaciones: d.imputaciones,
    plantillas: d.plantillas,
  }
}
