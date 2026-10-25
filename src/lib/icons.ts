import {
  Baby, Banknote, BookOpen, Briefcase, Bus, Bike, Car, CircleEllipsis, Coffee, CreditCard, Droplets, Dumbbell, Flame, Fuel,
  Gamepad2, Gift, GraduationCap, Heart, House, Landmark, Music, PawPrint, Phone, Pill, Plane, Receipt, Repeat, Shirt, ShoppingBag,
  ShoppingCart, Smartphone, Sparkles, Stethoscope, Tag, Tv, User, Users, Utensils, Wallet, Wifi, Wrench, Zap, type LucideIcon,
} from 'lucide-react'

/** Lista segura de iconos: las claves coinciden con `is_valid_icon` en la base de datos. */
export const ICONOS: Record<string, { icon: LucideIcon; label: string }> = {
  user: { icon: User, label: 'Persona' },
  home: { icon: House, label: 'Casa' },
  baby: { icon: Baby, label: 'Bebé' },
  briefcase: { icon: Briefcase, label: 'Trabajo' },
  users: { icon: Users, label: 'Familia' },
  heart: { icon: Heart, label: 'Corazón' },
  'shopping-cart': { icon: ShoppingCart, label: 'Carrito' },
  utensils: { icon: Utensils, label: 'Comida' },
  car: { icon: Car, label: 'Auto' },
  bus: { icon: Bus, label: 'Bus' },
  bike: { icon: Bike, label: 'Bicicleta' },
  plane: { icon: Plane, label: 'Avión' },
  'graduation-cap': { icon: GraduationCap, label: 'Educación' },
  stethoscope: { icon: Stethoscope, label: 'Salud' },
  pill: { icon: Pill, label: 'Medicina' },
  shirt: { icon: Shirt, label: 'Ropa' },
  gift: { icon: Gift, label: 'Regalo' },
  'gamepad-2': { icon: Gamepad2, label: 'Juegos' },
  tv: { icon: Tv, label: 'TV' },
  wifi: { icon: Wifi, label: 'Internet' },
  zap: { icon: Zap, label: 'Luz' },
  droplets: { icon: Droplets, label: 'Agua' },
  flame: { icon: Flame, label: 'Gas' },
  phone: { icon: Phone, label: 'Teléfono' },
  wallet: { icon: Wallet, label: 'Billetera' },
  'credit-card': { icon: CreditCard, label: 'Tarjeta' },
  banknote: { icon: Banknote, label: 'Billete' },
  landmark: { icon: Landmark, label: 'Banco' },
  smartphone: { icon: Smartphone, label: 'Celular' },
  repeat: { icon: Repeat, label: 'Recurrente' },
  receipt: { icon: Receipt, label: 'Recibo' },
  'paw-print': { icon: PawPrint, label: 'Mascota' },
  dumbbell: { icon: Dumbbell, label: 'Deporte' },
  coffee: { icon: Coffee, label: 'Café' },
  'shopping-bag': { icon: ShoppingBag, label: 'Bolsa' },
  wrench: { icon: Wrench, label: 'Mantenimiento' },
  fuel: { icon: Fuel, label: 'Combustible' },
  sparkles: { icon: Sparkles, label: 'Cuidado' },
  'book-open': { icon: BookOpen, label: 'Libro' },
  music: { icon: Music, label: 'Música' },
  tag: { icon: Tag, label: 'Etiqueta' },
  'circle-ellipsis': { icon: CircleEllipsis, label: 'Otros' },
}

export const ICON_KEYS = Object.keys(ICONOS)

export function iconFor(key: string | null | undefined): LucideIcon {
  return (key && ICONOS[key]?.icon) || Tag
}

/** Tokens de color admitidos (coinciden con `is_valid_color`). Cada uno es una variable CSS de la paleta. */
export const COLOR_TOKENS = ['c1', 'c2', 'c3', 'c4', 'c5', 'pri', 'acc', 'muted'] as const
export type ColorToken = (typeof COLOR_TOKENS)[number]

export function colorVar(token: string | null | undefined): string {
  return `var(--${token && (COLOR_TOKENS as readonly string[]).includes(token) ? token : 'muted'})`
}
