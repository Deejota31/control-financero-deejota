import type { ComponentType } from 'react'
import { cn } from '@/lib/cn'

export type Acento = 'indigo' | 'blue' | 'sky' | 'teal' | 'amber' | 'orange' | 'red' | 'violet' | 'slate' | 'green'

/** Clase que activa las variables de color `--a-*` (fondo suave, borde, ícono, texto) del acento, ya adaptadas a claro/oscuro. */
export const claseAcento = (a: Acento) => `acento-${a}`

/** Ícono sobre una superficie tintada con el acento. */
export function IconoAcento({ icono: Icono, acento, className, size = 'md' }: { icono: ComponentType<{ className?: string }>; acento: Acento; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        claseAcento(acento),
        'grid shrink-0 place-items-center border border-[var(--a-bd)] bg-[var(--a-soft)] text-[var(--a-ic)]',
        size === 'sm' && 'size-8 rounded-lg', size === 'md' && 'size-10 rounded-xl', size === 'lg' && 'size-12 rounded-xl',
        className,
      )}
    >
      <Icono className={size === 'sm' ? 'size-4' : 'size-5'} aria-hidden="true" />
    </span>
  )
}
