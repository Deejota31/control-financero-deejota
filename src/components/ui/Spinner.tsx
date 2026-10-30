import { Loader2 } from 'lucide-react'

export function FullScreenLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center gap-2 text-muted">
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
