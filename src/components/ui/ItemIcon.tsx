import { createElement } from 'react'
import { colorVar, iconFor } from '@/lib/icons'

/** Icono Lucide a partir de una clave segura del catálogo, con el color de la paleta. */
export function ItemIcon({ name, color, className = 'size-4' }: { name?: string | null; color?: string | null; className?: string }) {
  return createElement(iconFor(name), {
    className,
    style: color === undefined ? undefined : { color: colorVar(color) },
    'aria-hidden': true,
  })
}
