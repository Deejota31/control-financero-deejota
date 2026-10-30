import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { paginasVisibles, rangoVisible, totalPaginas } from '@/domain/paginacion'
import { Combobox } from './Combobox'

interface Props {
  /** Página actual (desde 1). */
  pagina: number
  /** Total de registros del conjunto YA filtrado. */
  total: number
  tamano: number
  onPagina: (p: number) => void
  /** Tamaños de página disponibles; sin ellos no se muestra el selector. */
  opcionesTamano?: readonly number[]
  onTamano?: (n: number) => void
  cargando?: boolean
  deshabilitado?: boolean
  etiqueta?: string
  /** Dato breve junto al rango (por ejemplo, el subtotal filtrado). */
  resumen?: React.ReactNode
  className?: string
}

const BTN = 'grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-xs font-semibold tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-40'

/**
 * Paginador único de la aplicación: «1–20 de 83 · 20 por página · ‹ 1 2 3 … 18 ›». Compacto (una fila de 32 px), con números inteligentes y, en un contenedor
 * estrecho, una variante «‹ 2/9 ›». Es solo presentación: quien lo usa pagina el conjunto completo, ya filtrado y ordenado.
 */
export function Paginacion({ pagina, total, tamano, onPagina, opcionesTamano, onTamano, cargando, deshabilitado, etiqueta = 'Paginación', resumen, className }: Props) {
  const paginas = totalPaginas(total, tamano)
  const actual = Math.min(Math.max(1, pagina), paginas)
  const { desde, hasta } = rangoVisible(actual, tamano, total)
  const bloqueado = Boolean(cargando || deshabilitado)
  const ir = (p: number) => { if (!bloqueado && p >= 1 && p <= paginas && p !== actual) onPagina(p) }
  return (
    <nav aria-label={etiqueta} aria-busy={cargando || undefined} className={cn('@container flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs', className)}>
      <span className="num mr-auto whitespace-nowrap text-muted" aria-live="polite"><b className="text-fg">{desde}–{hasta}</b> de <b className="text-fg">{total}</b>{resumen && <> · {resumen}</>}</span>
      {opcionesTamano && onTamano && (
        <div className="w-[8.75rem] shrink-0">
          <Combobox compacto aria-label="Registros por página" value={String(tamano)} searchable={false} disabled={bloqueado}
            options={opcionesTamano.map((n) => ({ value: String(n), label: `${n} por página` }))} onChange={(v) => v && onTamano(Number(v))} />
        </div>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" aria-label="Página anterior" disabled={bloqueado || actual <= 1} onClick={() => ir(actual - 1)} className={cn(BTN, 'text-muted hover:bg-surface-2 hover:text-fg')}><ChevronLeft className="size-4" aria-hidden="true" /></button>
        {/* Contenedor estrecho: solo «2/9» */}
        <span className="num px-1.5 text-xs font-semibold @min-[30rem]:hidden" aria-live="polite">{actual}/{paginas}</span>
        <ul className="hidden items-center gap-0.5 @min-[30rem]:flex" aria-label="Páginas">
          {paginasVisibles(actual, paginas).map((n, i) => (
            <li key={`${n}-${i}`}>
              {n === '…' ? <span className="grid h-8 w-6 place-items-center text-muted" aria-hidden="true">…</span> : (
                <button type="button" aria-label={`Página ${n}`} aria-current={n === actual ? 'page' : undefined} disabled={bloqueado} onClick={() => ir(n)}
                  className={cn(BTN, n === actual ? 'bg-pri text-pri-fg' : 'text-fg hover:bg-surface-2')}>{n}</button>
              )}
            </li>
          ))}
        </ul>
        <button type="button" aria-label="Página siguiente" disabled={bloqueado || actual >= paginas} onClick={() => ir(actual + 1)} className={cn(BTN, 'text-muted hover:bg-surface-2 hover:text-fg')}><ChevronRight className="size-4" aria-hidden="true" /></button>
      </div>
    </nav>
  )
}
