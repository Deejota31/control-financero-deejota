import { ArrowDown, ArrowUp, Ban, ChevronLeft, ChevronRight, Copy, Eye, Pencil, Repeat, Undo2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { ChipK, TinteK } from '@/components/ui/ChipK'
import { Hint } from '@/components/ui/Hint'
import { TooltipGrafico, TTCabecera, TTMetrica, TTPrincipal } from '@/components/ui/TooltipGrafico'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { cn } from '@/lib/cn'
import { formatFecha, formatSoles } from '@/lib/format'
import { TAMANO_PAGINA, type FiltrosGastos, type GastoConFondos } from './useGastos'

export interface ElementoNombre { name: string; icon_key: string; color_css?: string; color_token?: string | null }
export interface NombresCatalogo {
  ambito: Map<string, ElementoNombre>
  categoria: Map<string, ElementoNombre>
  sub: Map<string, ElementoNombre>
  medio: Map<string, ElementoNombre>
}
export type FondoInfo = { name: string; color_token?: string | null }

interface Props {
  filas: GastoConFondos[]
  filtros: FiltrosGastos
  nom: NombresCatalogo
  fondoPorId: Map<string, FondoInfo>
  formato: string
  seleccion: Map<string, GastoConFondos>
  total: number
  paginas: number
  cargando: boolean
  recargando: boolean
  onAlternar: (g: GastoConFondos) => void
  onAlternarTodas: () => void
  onOrdenar: (col: FiltrosGastos['orden']) => void
  onCambiar: (patch: Partial<FiltrosGastos>) => void
  onDetalle: (g: GastoConFondos) => void
  onEditar: (g: GastoConFondos) => void
  onClonar: (g: GastoConFondos) => void
  onConfirmar: (tipo: 'anular' | 'restaurar', g: GastoConFondos) => void
}

const ENC = 'px-2 py-3 text-[11px] font-semibold uppercase tracking-wider'

function Th({ children, activo, dir, onClick, alinear }: { children: ReactNode; activo: boolean; dir: 'asc' | 'desc'; onClick: () => void; alinear?: 'right' }) {
  return (
    <th className={cn(ENC, alinear === 'right' && 'text-right')} aria-sort={activo ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1 rounded uppercase tracking-wider hover:text-fg', activo && 'text-pri')}>
        {children}{activo && (dir === 'asc' ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />)}
      </button>
    </th>
  )
}

function Accion({ label, tono, children, ...p }: { label: string; tono?: 'bad' | 'ok'; children: ReactNode } & React.ComponentProps<'button'>) {
  return (
    <button type="button" aria-label={label} title={label}
      className={cn('grid size-8 place-items-center rounded-lg text-muted [@media(pointer:coarse)]:size-11 transition-colors hover:bg-pri-soft hover:text-pri disabled:pointer-events-none disabled:opacity-30', tono === 'bad' && 'hover:bg-bad-soft hover:text-bad', tono === 'ok' && 'hover:bg-ok-soft hover:text-ok')} {...p}>
      {children}
    </button>
  )
}

/** Hasta dos fondos en línea; el resto en «+N» con el detalle completo en un tooltip accesible. */
function ChipsFondos({ g, fondoPorId }: { g: GastoConFondos; fondoPorId: Map<string, FondoInfo> }) {
  const a = g.expense_fund_allocations
  if (a.length === 0) return <span className="text-xs text-muted">Sin fondo asignable</span>
  const visibles = a.slice(0, 2), resto = a.slice(2)
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibles.map((x) => {
        const f = fondoPorId.get(x.fund_id)
        return <ChipK key={x.fund_id} color={f?.color_token}><span className="min-w-0 truncate">{f?.name ?? 'Fondo'}</span>{' '}<span className="num shrink-0 font-bold">{formatSoles(Number(x.amount))}</span></ChipK>
      })}
      {resto.length > 0 && (
        <Hint
          side="top"
          contenido={<TooltipGrafico><TTCabecera titulo="Fondos de este gasto" /><div className="flex flex-col gap-1">{a.map((x) => <TTMetrica key={x.fund_id} etiqueta={fondoPorId.get(x.fund_id)?.name ?? 'Fondo'} valor={formatSoles(Number(x.amount))} />)}</div><TTPrincipal etiqueta="Total del gasto" valor={formatSoles(a.reduce((t, x) => t + Number(x.amount), 0))} /></TooltipGrafico>}
        >
          <button type="button" aria-label={`${resto.length} fondos más: ver detalle`} className="chip-k cursor-help">+{resto.length}</button>
        </Hint>
      )}
    </div>
  )
}

/** Ancho del contenedor desde el que cabe la tabla completa; por debajo se usan tarjetas (un solo DOM a la vez, sin controles duplicados). */
const ANCHO_TABLA = 950 // suma de los anchos de columna de la tabla compacta (ver colgroup)

export function TablaGastos(p: Props) {
  const raiz = useRef<HTMLDivElement>(null)
  const [ancha, setAncha] = useState(true)
  useLayoutEffect(() => {
    const el = raiz.current
    if (!el) return
    const medir = () => setAncha(el.clientWidth >= ANCHO_TABLA)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const { filas, filtros, nom, fondoPorId, formato, seleccion } = p
  const seleccionadas = filas.filter((f) => seleccion.has(f.id)).length
  const todas = filas.length > 0 && seleccionadas === filas.length
  const parcial = seleccionadas > 0 && !todas

  return (
    <div ref={raiz} className={cn('@container overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-opacity', p.recargando && 'opacity-60')} aria-busy={p.cargando}>
      {ancha ? (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px] table-fixed border-collapse text-left text-sm">
          {/* Anchos explícitos (suman 950 px; con más espacio se reparte en proporción). El ámbito solo tiene columna propia desde 1150 px. */}
          <colgroup>
            <col style={{ width: 40 }} /><col style={{ width: 88 }} /><col style={{ width: 140 }} /><col style={{ width: 170 }} />
            <col className="hidden @min-[1150px]:table-column" style={{ width: 110 }} />
            <col style={{ width: 118 }} /><col style={{ width: 160 }} /><col style={{ width: 84 }} /><col style={{ width: 150 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-line bg-surface-2/70 text-muted">
              <th className="w-12 px-0 text-center">
                <label className="mx-auto grid size-10 cursor-pointer place-items-center">
                  <input type="checkbox" className="size-4 accent-[var(--pri)]" aria-label="Seleccionar todos los de esta página" checked={todas} ref={(el) => { if (el) el.indeterminate = parcial }} onChange={p.onAlternarTodas} />
                </label>
              </th>
              <Th activo={filtros.orden === 'fecha'} dir={filtros.dir} onClick={() => p.onOrdenar('fecha')}>Fecha</Th>
              <Th activo={filtros.orden === 'descripcion'} dir={filtros.dir} onClick={() => p.onOrdenar('descripcion')}>Descripción</Th>
              <th className={ENC}>Clasificación</th>
              {/* Con poco ancho el ámbito pasa a la línea secundaria de Clasificación y su columna se oculta: así la tabla cabe sin desplazarse. */}
              <th className={cn(ENC, 'hidden @min-[1150px]:table-cell')}>Ámbito</th>
              <th className={ENC}>Medio</th>
              <th className={ENC}>Fondos</th>
              <Th activo={filtros.orden === 'monto'} dir={filtros.dir} onClick={() => p.onOrdenar('monto')} alinear="right">Importe</Th>
              <th className={cn(ENC, 'text-right')}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((g) => {
              const amb = nom.ambito.get(g.ambito_id), cat = nom.categoria.get(g.categoria_id), sub = g.subcategoria_id ? nom.sub.get(g.subcategoria_id) : null, med = nom.medio.get(g.payment_method_id)
              const anulado = g.status === 'annulled'
              const marcada = seleccion.has(g.id)
              return (
                <tr key={g.id} className={cn('h-[68px] border-b border-line transition-colors last:border-0 hover:bg-surface-2/60', marcada && 'bg-pri-soft/60 shadow-[inset_3px_0_0_var(--pri)]', anulado && 'text-muted')}>
                  <td className="px-0 text-center">
                    <label className="mx-auto grid size-10 cursor-pointer place-items-center">
                      <input type="checkbox" className="size-4 accent-[var(--pri)]" aria-label={`Seleccionar ${g.description}`} checked={marcada} onChange={() => p.onAlternar(g)} />
                    </label>
                  </td>
                  <td className="num whitespace-nowrap px-2">{formatFecha(g.expense_date, formato)}</td>
                  <td className="px-2">
                    <p className={cn('truncate font-semibold', anulado && 'line-through')}>{g.description}</p>
                    <p className="flex items-center gap-1 text-xs text-muted">{g.expense_type === 'fixed' ? 'Fijo' : 'Variable'}{g.is_recurring && <><span aria-hidden="true">·</span><Repeat className="size-3" aria-hidden="true" /> Recurrente</>}</p>
                  </td>
                  <td className="px-2">
                    <div className="flex items-center gap-2.5">
                      <TinteK color={cat?.color_css} className="size-9 rounded-lg"><ItemIcon name={cat?.icon_key} color={cat?.color_css} /></TinteK>
                      <div className="min-w-0"><p className="truncate font-medium">{cat?.name}</p><p className="truncate text-xs text-muted"><span className="@min-[1150px]:hidden">{amb?.name} · </span>{sub?.name ?? '—'}</p></div>
                    </div>
                  </td>
                  <td className="hidden px-2 @min-[1150px]:table-cell"><ChipK color={amb?.color_css}><ItemIcon name={amb?.icon_key} className="size-3" /> {amb?.name}</ChipK></td>
                  <td className="px-2"><ChipK color={med?.color_css}><ItemIcon name={med?.icon_key} className="size-3" /> {med?.name}</ChipK></td>
                  <td className="px-2">{anulado ? <ChipK color="muted">Anulado</ChipK> : <ChipsFondos g={g} fondoPorId={fondoPorId} />}</td>
                  <td className={cn('num whitespace-nowrap px-2 text-right text-[15px] font-semibold', anulado && 'line-through')}>{formatSoles(Number(g.amount))}</td>
                  <td className="px-2">
                    <div className="flex justify-end gap-0.5">
                      <Accion label={`Ver detalle de ${g.description}`} onClick={() => p.onDetalle(g)}><Eye className="size-4" aria-hidden="true" /></Accion>
                      <Accion label={`Editar ${g.description}`} disabled={anulado} onClick={() => p.onEditar(g)}><Pencil className="size-4" aria-hidden="true" /></Accion>
                      <Accion label={`Clonar ${g.description}`} onClick={() => p.onClonar(g)}><Copy className="size-4" aria-hidden="true" /></Accion>
                      {anulado
                        ? <Accion label={`Restaurar ${g.description}`} tono="ok" onClick={() => p.onConfirmar('restaurar', g)}><Undo2 className="size-4" aria-hidden="true" /></Accion>
                        : <Accion label={`Anular ${g.description}`} tono="bad" onClick={() => p.onConfirmar('anular', g)}><Ban className="size-4" aria-hidden="true" /></Accion>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      ) : (
      <div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-2 text-xs">
          <label className="inline-flex min-h-9 items-center gap-2 font-medium">
            <input type="checkbox" className="size-4 accent-[var(--pri)]" aria-label="Seleccionar todos los de esta página" checked={todas} ref={(el) => { if (el) el.indeterminate = parcial }} onChange={p.onAlternarTodas} />
            Todos
          </label>
          <span className="ml-auto text-muted" id="orden-tarjetas">Ordenar</span>
          <div role="group" aria-labelledby="orden-tarjetas" className="flex gap-1">
            {([['fecha', 'Fecha'], ['descripcion', 'Nombre'], ['monto', 'Importe']] as const).map(([col, et]) => {
              const activo = filtros.orden === col
              return (
                <button key={col} type="button" aria-pressed={activo} onClick={() => p.onOrdenar(col)}
                  className={cn('inline-flex min-h-9 items-center gap-1 rounded-md border px-2.5 font-semibold', activo ? 'border-pri bg-pri-soft text-pri' : 'border-line bg-surface text-muted')}>
                  {et}{activo && (filtros.dir === 'asc' ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />)}
                </button>
              )
            })}
          </div>
        </div>
        <ul className="flex flex-col">
          {filas.map((g) => {
            const amb = nom.ambito.get(g.ambito_id), cat = nom.categoria.get(g.categoria_id), sub = g.subcategoria_id ? nom.sub.get(g.subcategoria_id) : null, med = nom.medio.get(g.payment_method_id)
            const anulado = g.status === 'annulled'
            const marcada = seleccion.has(g.id)
            return (
              <li key={g.id} className={cn('flex min-w-0 flex-col gap-2 border-b border-line px-3 py-3 last:border-0', marcada && 'bg-pri-soft/60 shadow-[inset_3px_0_0_var(--pri)]', anulado && 'text-muted')}>
                <div className="flex min-w-0 items-start gap-2">
                  <label className="grid size-9 shrink-0 cursor-pointer place-items-center">
                    <input type="checkbox" className="size-4 accent-[var(--pri)]" aria-label={`Seleccionar ${g.description}`} checked={marcada} onChange={() => p.onAlternar(g)} />
                  </label>
                  <div className="min-w-0 flex-1">
                    <p className={cn('break-words font-semibold', anulado && 'line-through')}>{g.description}</p>
                    <p className="num text-xs text-muted">{formatFecha(g.expense_date, formato)} · {g.expense_type === 'fixed' ? 'Fijo' : 'Variable'}{g.is_recurring ? ' · Recurrente' : ''}{anulado ? ' · Anulado' : ''}</p>
                  </div>
                  <p className={cn('num shrink-0 text-base font-bold', anulado && 'line-through')}>{formatSoles(Number(g.amount))}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-11">
                  <ChipK color={cat?.color_css}><ItemIcon name={cat?.icon_key} className="size-3" /> {cat?.name}{sub ? ` › ${sub.name}` : ''}</ChipK>
                  <ChipK color={amb?.color_css}>{amb?.name}</ChipK>
                  <ChipK color={med?.color_css}>{med?.name}</ChipK>
                  {!anulado && <ChipsFondos g={g} fondoPorId={fondoPorId} />}
                </div>
                <div className="flex flex-wrap justify-end gap-1 pl-11">
                  <Accion label={`Ver detalle de ${g.description}`} onClick={() => p.onDetalle(g)}><Eye className="size-4" aria-hidden="true" /></Accion>
                  <Accion label={`Editar ${g.description}`} disabled={anulado} onClick={() => p.onEditar(g)}><Pencil className="size-4" aria-hidden="true" /></Accion>
                  <Accion label={`Clonar ${g.description}`} onClick={() => p.onClonar(g)}><Copy className="size-4" aria-hidden="true" /></Accion>
                  {anulado
                    ? <Accion label={`Restaurar ${g.description}`} tono="ok" onClick={() => p.onConfirmar('restaurar', g)}><Undo2 className="size-4" aria-hidden="true" /></Accion>
                    : <Accion label={`Anular ${g.description}`} tono="bad" onClick={() => p.onConfirmar('anular', g)}><Ban className="size-4" aria-hidden="true" /></Accion>}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      )}
      <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/40 px-4 py-3 text-sm">
        <span className="text-muted">Mostrando <b className="num text-fg">{(filtros.pagina - 1) * TAMANO_PAGINA + 1}–{Math.min(p.total, filtros.pagina * TAMANO_PAGINA)}</b> de <b className="num text-fg">{p.total}</b></span>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
          <Button variant="secondary" className="px-2.5 sm:px-4" disabled={filtros.pagina <= 1} onClick={() => p.onCambiar({ pagina: filtros.pagina - 1 })}><ChevronLeft className="size-4" aria-hidden="true" /> Anterior</Button>
          <span className="num text-center text-xs text-muted sm:text-sm">Página {filtros.pagina} de {p.paginas}</span>
          <Button variant="secondary" className="px-2.5 sm:px-4" disabled={filtros.pagina >= p.paginas} onClick={() => p.onCambiar({ pagina: filtros.pagina + 1 })}>Siguiente <ChevronRight className="size-4" aria-hidden="true" /></Button>
        </div>
      </nav>
    </div>
  )
}
