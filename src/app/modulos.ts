import { HeartPulse, LayoutDashboard, Receipt, Settings, Tags, Wallet, type LucideIcon } from 'lucide-react'

export interface Modulo {
  path: string
  label: string
  /** Etiqueta corta para la barra inferior en móvil. */
  corto: string
  icon: LucideIcon
}

export const MODULOS: Modulo[] = [
  { path: '/', label: 'Dashboard', corto: 'Inicio', icon: LayoutDashboard },
  { path: '/gastos', label: 'Gastos', corto: 'Gastos', icon: Receipt },
  { path: '/fondos', label: 'Fondos', corto: 'Fondos', icon: Wallet },
  { path: '/catalogo', label: 'Catálogo', corto: 'Catálogo', icon: Tags },
  { path: '/salud', label: 'Salud financiera', corto: 'Salud', icon: HeartPulse },
  { path: '/configuracion', label: 'Configuración', corto: 'Ajustes', icon: Settings },
]
