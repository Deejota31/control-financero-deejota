import { useRef, useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/Field'
import type { ContextoDescripcion } from './contexto'
import { claveContexto } from './contexto'
import { useSugerenciasDescripcion } from './useSugerenciasDescripcion'

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  contexto: ContextoDescripcion
  value: string
  onValueChange: (valor: string) => void
}

export function DescripcionInteligente({ contexto, value, onValueChange, ref, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const sugerencias = useSugerenciasDescripcion(contexto, value)
  const clave = claveContexto(contexto)
  const [expandido, setExpandido] = useState<string | null>(null)
  const mas = expandido === clave
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Input {...props} ref={(node) => { input.current = node; if (typeof ref === 'function') return ref(node); else if (ref) ref.current = node }}
        value={value} onChange={(e) => onValueChange(e.target.value)} autoComplete="off"
        placeholder="Escribe o selecciona una descripción…" className="text-base sm:text-sm [@media(pointer:coarse)]:text-base" />
      {sugerencias.length > 0 && <div role="group" aria-label="Tus descripciones frecuentes" className="flex min-w-0 flex-col gap-1.5">
        <p className="text-xs text-muted">Tus descripciones frecuentes:</p>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {sugerencias.slice(0, mas ? 10 : 5).map((s) => (
            <button key={s.description} type="button" disabled={props.disabled}
              onPointerDown={(e) => { if (document.activeElement === input.current) e.preventDefault() }}
              onClick={() => { onValueChange(s.description); input.current?.focus({ preventScroll: true }) }}
              className="flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-left text-xs hover:border-pri hover:bg-pri-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pri active:bg-pri-soft disabled:opacity-60">
              <span className="sr-only">Usar</span>{' '}
              <span className="min-w-0 [overflow-wrap:anywhere]">{s.description}</span>{' '}
              <span className="num shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 font-semibold text-fg">{s.frequency}</span>{' '}
              <span className="sr-only">{s.frequency === 1 ? 'registro' : 'registros'}</span>
            </button>
          ))}
          {sugerencias.length > 5 && <button type="button" aria-expanded={mas} onClick={() => setExpandido(mas ? null : clave)}
            className="min-h-11 rounded-md px-2 text-xs font-semibold text-pri hover:bg-pri-soft focus-visible:outline-2 focus-visible:outline-pri">{mas ? 'Ver menos' : 'Ver más'}</button>}
        </div>
      </div>}
    </div>
  )
}
