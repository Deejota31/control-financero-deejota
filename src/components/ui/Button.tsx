import { Loader2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'marca'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-pri text-pri-fg border-pri hover:opacity-90',
  secondary: 'bg-surface text-fg border-line hover:bg-surface-2',
  ghost: 'bg-transparent text-fg border-transparent hover:bg-surface-2',
  danger: 'bg-bad-soft text-bad border-bad hover:opacity-90',
  /** Acción principal de las pantallas de acceso: degradado de la marca con relieve suave. */
  marca: 'border-transparent bg-[image:var(--brand-gradient)] text-white shadow-[0_12px_26px_-12px_rgb(99_82_235/0.9)] hover:-translate-y-px hover:shadow-[0_16px_30px_-12px_rgb(99_82_235/0.95)] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
}

export function Button({ variant = 'primary', loading = false, disabled, className, children, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
