import { Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Combobox } from '@/components/ui/Combobox'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { cn } from '@/lib/cn'
import { useOpcionesEventos, usePlanEvento } from './useEventos'
import { recibeGastos } from './modelo'

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Evento asociado: un único campo de búsqueda. Sin evento se escribe o se elige de la lista (que se despliega en el flujo del formulario,
 * sin flotar sobre otros campos ni cortarse en el modal). Con evento queda una fila compacta con un botón para quitarlo; el concepto planificado
 * y el compromiso solo aparecen si el evento los tiene.
 */
export function SelectorEventoGasto({ evento, concepto = '', compromiso = '', onEvento, onConcepto, onCompromiso, soloEvento = false, conservarHistorial = false }: {
  evento: string; concepto?: string; compromiso?: string; onEvento: (id: string) => void; onConcepto: (id: string) => void; onCompromiso: (id: string, item?: string) => void; soloEvento?: boolean; conservarHistorial?: boolean
}) {
  const opciones = useOpcionesEventos()
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const idLista = useId()
  const disponibles = useMemo(() => (opciones.data ?? []).filter((e) => recibeGastos(e) || e.id === evento), [opciones.data, evento])
  const elegido = disponibles.find((e) => e.id === evento)
  const filtradas = useMemo(() => { const q = sinTildes(texto.trim()); return q ? disponibles.filter((e) => sinTildes(e.name).includes(q)) : disponibles }, [disponibles, texto])
  const etiqueta = (e: (typeof disponibles)[number]) => e.name + (!recibeGastos(e) ? ' · solo historial' : '')

  function elegir(id: string) { onEvento(id); setTexto(''); setAbierto(false); setActivo(0) }
  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (elegido) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo((i) => Math.min(i + 1, filtradas.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && abierto && filtradas[activo]) { e.preventDefault(); elegir(filtradas[activo].id) }
    else if (e.key === 'Escape' && abierto) { e.stopPropagation(); setAbierto(false) }
  }

  return (
    <section aria-label="Asociación a evento" className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium">Evento asociado (opcional)</span>
      <div className="relative flex min-w-0 items-center rounded-md border border-line bg-surface focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-pri">
        {elegido
          ? <ItemIcon name={elegido.icon_key} color={elegido.color_token} className="ml-3 size-4 shrink-0" />
          : <Search className="ml-3 size-4 shrink-0 text-muted" aria-hidden="true" />}
        <input role="combobox" aria-label="Evento asociado (opcional)" aria-expanded={!elegido && abierto} aria-controls={idLista} aria-autocomplete="list"
          aria-activedescendant={!elegido && abierto && filtradas[activo] ? `${idLista}-${filtradas[activo].id}` : undefined}
          autoComplete="off" readOnly={Boolean(elegido)} value={elegido ? etiqueta(elegido) : texto}
          placeholder={opciones.isError ? 'No se pudieron cargar los eventos' : 'Buscar o seleccionar evento…'}
          onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(0) }} onFocus={() => !elegido && setAbierto(true)} onKeyDown={teclas}
          className={cn('sin-anillo min-h-10 min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted sm:text-sm', elegido && 'truncate font-medium')} />
        {(elegido || texto) && (
          <button type="button" aria-label={elegido ? 'Quitar evento' : 'Borrar búsqueda'} onClick={() => (elegido ? elegir('') : setTexto(''))} className="mr-1 grid size-8 shrink-0 place-items-center rounded text-muted hover:bg-surface-2 hover:text-fg">
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {!elegido && abierto && (
        <ul id={idLista} role="listbox" aria-label="Eventos" className="max-h-44 overflow-y-auto rounded-md border border-line bg-surface p-1 text-sm">
          {filtradas.length === 0
            ? <li role="presentation" className="px-2 py-2 text-muted">{texto ? 'Ningún evento coincide.' : 'Aún no hay eventos que reciban gastos.'}</li>
            : filtradas.map((e, i) => (
              <li key={e.id} id={`${idLista}-${e.id}`} role="option" aria-selected={i === activo} onMouseDown={(ev) => ev.preventDefault()} onClick={() => elegir(e.id)} onMouseEnter={() => setActivo(i)}
                className={cn('flex min-h-9 cursor-pointer items-center gap-2 rounded px-2', i === activo && 'bg-surface-2')}>
                <ItemIcon name={e.icon_key} color={e.color_token} className="size-4 shrink-0" /><span className="min-w-0 truncate">{etiqueta(e)}</span>
              </li>
            ))}
        </ul>
      )}
      {opciones.isError && <button type="button" className="self-start text-xs font-semibold text-pri" onClick={() => void opciones.refetch()}>Reintentar cargar eventos</button>}
      {evento && !soloEvento && <DetalleSelector key={evento} evento={evento} concepto={concepto} compromiso={compromiso} onConcepto={onConcepto} onCompromiso={onCompromiso} conservarHistorial={conservarHistorial} />}
    </section>
  )
}

function DetalleSelector({ evento, concepto, compromiso, onConcepto, onCompromiso, conservarHistorial }: { evento: string; concepto: string; compromiso: string; onConcepto: (v: string) => void; onCompromiso: (v: string, item?: string) => void; conservarHistorial: boolean }) {
  const plan = usePlanEvento(evento)
  useEffect(() => {
    if (!conservarHistorial && compromiso && plan.data) {
      const actual = plan.data.compromisos.find((c) => c.id === compromiso)
      if (!actual || actual.cancelled_at) onCompromiso('')
    }
  }, [conservarHistorial, compromiso, plan.data, onCompromiso])
  const items = plan.data?.items ?? []
  const compromisos = (plan.data?.compromisos ?? []).filter((c) => !c.cancelled_at || c.id === compromiso).filter((c) => !concepto || !c.event_item_id || c.event_item_id === concepto)
  // Los selectores aparecen solo cuando el evento tiene algo que elegir (o ya hay una selección guardada que no se debe ocultar).
  return <>
    {(items.length > 0 || concepto) && <Combobox aria-label="Concepto del evento (opcional)" value={concepto || null} clearable placeholder="Concepto planificado (opcional)" options={items.map((i) => ({ value: i.id, label: i.name }))} onChange={(v) => onConcepto(v ?? '')} />}
    {(compromisos.length > 0 || compromiso) && <Combobox aria-label="Pago de compromiso (opcional)" value={compromiso || null} clearable placeholder="Pago de un compromiso (opcional)" options={compromisos.map((c) => ({ value: c.id, label: c.name }))}
      onChange={(v) => onCompromiso(v ?? '', plan.data?.compromisos.find((c) => c.id === v)?.event_item_id ?? undefined)} />}
  </>
}
