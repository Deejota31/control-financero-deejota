import { LayoutDashboard, Receipt, Settings, Tags, Wallet, type LucideIcon } from 'lucide-react'

export interface Modulo {
  path: string
  label: string
  /** Etiqueta corta para la barra inferior en móvil. */
  corto: string
  icon: LucideIcon
  /**
   * La página termina sin controles en la esquina inferior derecha, donde flota «Registrar gasto»: basta el margen normal bajo el último contenido.
   * Las demás reservan sitio para que el botón no tape su último elemento (acciones por fila, paginación).
   */
  finLibre?: boolean
}

export const MODULOS: Modulo[] = [
  { path: '/', label: 'Dashboard', corto: 'Inicio', icon: LayoutDashboard, finLibre: true },
  { path: '/gastos', label: 'Gastos', corto: 'Gastos', icon: Receipt },
  { path: '/fondos', label: 'Fondos', corto: 'Fondos', icon: Wallet },
  { path: '/catalogo', label: 'Catálogo', corto: 'Catálogo', icon: Tags },
  { path: '/configuracion', label: 'Configuración', corto: 'Ajustes', icon: Settings },
]
