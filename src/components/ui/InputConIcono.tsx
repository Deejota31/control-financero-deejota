import type { ComponentProps, ComponentType } from 'react'
import { cn } from '@/lib/cn'
import { Input } from './Field'

/** Campo de texto con un icono decorativo a la izquierda (el icono no recibe foco ni se lee: la etiqueta ya describe el campo). */
export function InputConIcono({ icono: Icono, className, ...props }: ComponentProps<'input'> & { icono: ComponentType<{ className?: string }> }) {
  return (
    <div className="relative">
      <Icono className="pointer-events-none absolute left-3.5 top-1/2 size-[1.1rem] -translate-y-1/2 text-[var(--esc-suave,var(--muted))]" aria-hidden="true" />
      <Input {...props} className={cn('pl-11', className)} />
    </div>
  )
}
