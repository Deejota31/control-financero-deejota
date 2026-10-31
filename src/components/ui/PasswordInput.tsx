import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps, type ComponentType } from 'react'
import { cn } from '@/lib/cn'
import { Input } from './Field'

/**
 * Campo de contraseña con botón para mostrarla u ocultarla. Es el mismo `<input>` (cambia solo su `type`), así que el valor, el foco y el
 * registro del formulario no se pierden al alternar. Enmascarado por defecto; el botón no entra en el envío del formulario.
 */
export function PasswordInput({ className, icono: Icono, ...props }: Omit<ComponentProps<'input'>, 'type'> & { icono?: ComponentType<{ className?: string }> }) {
  const [visible, setVisible] = useState(false)
  const Ojo = visible ? EyeOff : Eye
  return (
    <div className="relative">
      {Icono && <Icono className="pointer-events-none absolute left-3.5 top-1/2 size-[1.1rem] -translate-y-1/2 text-[var(--esc-suave,var(--muted))]" aria-hidden="true" />}
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-11', Icono && 'pl-11', className)} />
      <button type="button" onClick={() => setVisible((v) => !v)} aria-pressed={visible} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[var(--esc-suave,var(--muted))] transition-colors hover:bg-[var(--esc-campo,var(--surface-2))] hover:text-[var(--esc-texto,var(--fg))]">
        <Ojo className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
