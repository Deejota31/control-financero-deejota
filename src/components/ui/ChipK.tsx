import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { colorVar } from '@/lib/icons'

/**
 * Etiqueta con el color de un elemento del catálogo o de un fondo (HEX libre o token heredado).
 * El texto se mezcla con el color de texto del tema para conservar el contraste en claro y oscuro.
 */
export function ChipK({ color, children, className, title }: { color?: string | null; children: ReactNode; className?: string; title?: string }) {
  return (
    <span className={cn('chip-k', className)} title={title} style={{ '--k': colorVar(color) } as CSSProperties}>
      {children}
    </span>
  )
}

/** Superficie tintada (para íconos) con el color de un elemento. */
export function TinteK({ color, children, className }: { color?: string | null; children: ReactNode; className?: string }) {
  return (
    <span className={cn('tinte-k grid shrink-0 place-items-center', className)} style={{ '--k': colorVar(color) } as CSSProperties}>
      {children}
    </span>
  )
}
