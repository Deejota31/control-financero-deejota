import { Tag, type LucideIcon } from 'lucide-react'
import { ALIAS_ICONOS, ICONOS_CATALOGO } from '@/domain/iconosCatalogo'
import { COMPONENTES_ICONO } from './iconosComponentes'

/** Identificador vigente de una clave guardada (p. ej. la antigua «home» ahora es «house»). */
export const claveIcono = (key: string | null | undefined): string => (key ? (ALIAS_ICONOS[key] ?? key) : 'tag')

/** Componente de la biblioteca para una clave segura del catálogo; las claves desconocidas muestran la etiqueta genérica. */
export function iconFor(key: string | null | undefined): LucideIcon {
  return COMPONENTES_ICONO[claveIcono(key)] ?? Tag
}

/** Nombre en español de un ícono (para tooltips y lectores de pantalla). */
export function nombreIcono(key: string | null | undefined): string {
  const k = claveIcono(key)
  return ICONOS_CATALOGO.find((i) => i.id === k)?.nombre ?? (k === 'tag' ? 'Etiqueta' : k === 'circle-ellipsis' ? 'Otros' : 'Ícono')
}

/** Tokens de color admitidos (coinciden con `is_valid_color`). Cada uno es una variable CSS de la paleta. */
export const COLOR_TOKENS = ['c1', 'c2', 'c3', 'c4', 'c5', 'pri', 'acc', 'muted'] as const
export type ColorToken = (typeof COLOR_TOKENS)[number]

/**
 * Color CSS de un token heredado o de un HEX libre (#RRGGBB). Los HEX se aclaran en tema oscuro con `--k-mix` y
 * `--k-tint` (definidos en index.css) para conservar el contraste sobre superficies oscuras.
 */
export function colorVar(token: string | null | undefined): string {
  if (token && /^#[0-9A-Fa-f]{6}$/.test(token)) return `color-mix(in srgb, ${token} var(--k-mix), var(--k-tint))`
  return `var(--${token && (COLOR_TOKENS as readonly string[]).includes(token) ? token : 'muted'})`
}
