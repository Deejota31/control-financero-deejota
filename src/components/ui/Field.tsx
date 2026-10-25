import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface FieldProps {
  label: string
  error?: string
  hint?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode
}

/** Etiqueta + control + mensaje de error accesible. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId()
  const msgId = `${id}-msg`
  const hasMsg = Boolean(error || hint)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': hasMsg ? msgId : undefined })}
      {error ? (
        <p id={msgId} className="text-sm text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function Input({ className, ref, ...props }: ComponentProps<'input'>) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted aria-[invalid=true]:border-bad disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ref, ...props }: ComponentProps<'select'>) {
  return (
    <select
      ref={ref}
      className={cn('w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg disabled:opacity-60', className)}
      {...props}
    />
  )
}
