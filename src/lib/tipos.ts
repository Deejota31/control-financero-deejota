import type { Database } from './database.types'

type Tablas = Database['public']['Tables']
export type Fila<T extends keyof Tablas> = Tablas[T]['Row']

export type Ambito = Fila<'ambitos'>
export type Categoria = Fila<'categorias'>
export type Subcategoria = Fila<'subcategorias'>
export type MedioPago = Fila<'medios_pago'>
export type Fondo = Fila<'funds'>
export type Periodo = Fila<'budget_periods'>
export type Gasto = Fila<'expenses'>
export type Plantilla = Fila<'expense_templates'>
