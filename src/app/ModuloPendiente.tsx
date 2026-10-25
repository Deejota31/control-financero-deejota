import { Hammer } from 'lucide-react'

/** Marcador honesto de un módulo que se construye en una etapa posterior. */
export function ModuloPendiente({ nombre, descripcion }: { nombre: string; descripcion: string }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-surface p-10 text-center">
      <Hammer className="size-8 text-muted" aria-hidden="true" />
      <h1 className="font-display text-xl font-bold">{nombre}</h1>
      <p className="text-muted">{descripcion}</p>
      <p className="text-sm text-muted">Este módulo todavía no está implementado.</p>
    </section>
  )
}
