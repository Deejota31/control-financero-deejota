import { formatOriginal } from '@/domain/moneda'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, Pencil, Unlink, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal, ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { useCatalogo } from '@/features/catalogo/useCatalogo'
import { DetalleGasto } from '@/features/gastos/DetalleGasto'
import { GastoForm, inicialDesdeGasto, type ModoGasto } from '@/features/gastos/GastoForm'
import type { GastoConFondos } from '@/features/gastos/useGastos'
import { supabase } from '@/lib/supabase'
import type { Gasto } from '@/lib/tipos'
import { formatFecha, formatSoles } from '@/lib/format'
import { mensajeDeError } from '@/lib/errors'
import { useDebounced } from '@/lib/useDebounced'
import { estiloSelect } from './EventoForm'
import type { Evento } from './modelo'
import { FILTRO_SELECCION, useGastosEvento, useMutacionesEvento, type FiltroSeleccion } from './useEventos'

export function GastosEvento({ evento, selector = false, compromiso, concepto, onClose }: { evento: Evento; selector?: boolean; compromiso?: string; concepto?: string; onClose?: () => void }) {
  const catalogo = useCatalogo()
  const mut = useMutacionesEvento()
  const [f, setF] = useState<FiltroSeleccion>({ ...FILTRO_SELECCION, concepto: selector ? '' : concepto ?? '', compromiso: selector ? '' : compromiso ?? '' })
  const cambiar = (p: Partial<FiltroSeleccion>) => setF((v) => ({ ...v, ...p, pagina: p.pagina ?? 1 }))
  const q = useDebounced(f.q, 250)
  const gastos = useGastosEvento(evento.id, { ...f, q }, selector)
  const [seleccion, setSeleccion] = useState<Map<string, Gasto>>(new Map())
  const [mover, setMover] = useState(false)
  const [detalle, setDetalle] = useState<Gasto | null>(null)
  const [editar, setEditar] = useState<Gasto | null>(null)
  const [quitar, setQuitar] = useState<Gasto | null>(null)
  const [error, setError] = useState('')
  const conflicto = [...seleccion.values()].some((g) => (g.event_id && g.event_id !== evento.id) || (compromiso && g.event_commitment_id && g.event_commitment_id !== compromiso))
  const nombre = (kind: 'ambitos' | 'categorias' | 'subcategorias' | 'medios', id: string | null) => catalogo[kind].find((i) => i.id === id)?.name ?? '—'
  async function asociar() {
    try {
      const n = await mut.vincular.mutateAsync({ ids: [...seleccion.keys()], event: evento.id, item: concepto, commitment: compromiso, replace: mover })
      toast.success(`${n} ${n === 1 ? 'gasto asociado' : 'gastos asociados'}.`)
      setSeleccion(new Map()); onClose?.()
    } catch (e) { setError(mensajeDeError(e)) }
  }
  const contenido = <div className="flex min-w-0 flex-col gap-4">
    {selector && <p className="rounded-xl bg-pri-soft p-3 text-sm text-pri">Asociar no registra un gasto nuevo.</p>}
    {error && <ErrorState message={error} />}
    <div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="flex min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-3"><Search className="size-4 shrink-0 text-muted" /><input aria-label="Buscar gastos del evento" className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" placeholder="Buscar descripción…" value={f.q} onChange={(e) => cambiar({ q: e.target.value })} /></label><select aria-label="Orden de gastos del evento" value={f.orden} onChange={(e) => cambiar({ orden: e.target.value })} className={estiloSelect}>{[['reciente','Más recientes'],['antiguo','Más antiguos'],['importe','Mayor importe'],['descripcion','Descripción']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
    <details className="rounded-xl border border-line bg-surface p-3"><summary className="cursor-pointer text-sm font-semibold text-pri">Filtrar movimientos</summary><div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Fecha desde">{(p) => <Input {...p} type="date" value={f.desde} onChange={(e) => cambiar({ desde: e.target.value })} />}</Field><Field label="Fecha hasta">{(p) => <Input {...p} type="date" value={f.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />}</Field>
      <Field label="Ámbito del gasto">{(p) => <select {...p} className={estiloSelect} value={f.ambito} onChange={(e) => cambiar({ ambito: e.target.value, categoria: '', subcategoria: '' })}><option value="">Todos</option>{catalogo.ambitos.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}</Field>
      <Field label="Categoría del gasto">{(p) => <select {...p} className={estiloSelect} value={f.categoria} onChange={(e) => cambiar({ categoria: e.target.value, subcategoria: '' })}><option value="">Todas</option>{catalogo.categorias.filter((i) => !f.ambito || i.ambito_id === f.ambito).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}</Field>
      <Field label="Subcategoría del gasto">{(p) => <select {...p} className={estiloSelect} value={f.subcategoria} onChange={(e) => cambiar({ subcategoria: e.target.value })}><option value="">Todas</option>{catalogo.subcategorias.filter((i) => !f.categoria || i.categoria_id === f.categoria).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}</Field>
      <Field label="Medio de pago del gasto">{(p) => <select {...p} className={estiloSelect} value={f.medio} onChange={(e) => cambiar({ medio: e.target.value })}><option value="">Todos</option>{catalogo.medios.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}</Field>
      <Field label="Importe mínimo">{(p) => <Input {...p} inputMode="decimal" value={f.min} onChange={(e) => cambiar({ min: e.target.value })} />}</Field><Field label="Importe máximo">{(p) => <Input {...p} inputMode="decimal" value={f.max} onChange={(e) => cambiar({ max: e.target.value })} />}</Field>
      {!selector && <Field label="Estado del gasto">{(p) => <select {...p} className={estiloSelect} value={f.estado} onChange={(e) => cambiar({ estado: e.target.value })}><option value="active">Activos</option><option value="annulled">Anulados</option><option value="all">Todos</option></select>}</Field>}
    </div></details>
    {gastos.isPending ? <Skeleton className="h-48" /> : gastos.isError ? <ErrorState message="No se pudieron cargar los gastos." onRetry={() => void gastos.refetch()} /> : gastos.data.filas.length === 0 ? <EmptyState title="No hay gastos con estos filtros" /> : <ul aria-label={selector ? 'Gastos disponibles para asociar' : 'Gastos asociados al evento'} className="flex min-w-0 flex-col gap-2">{gastos.data.filas.map((g) => <li key={g.id} className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-line bg-surface p-3">
      {selector && <input type="checkbox" className="mt-1 size-5 shrink-0" aria-label={`Seleccionar ${g.description}`} checked={seleccion.has(g.id)} onChange={(e) => setSeleccion((v) => { const n = new Map(v); if (e.target.checked && n.size < 100) n.set(g.id, g); else n.delete(g.id); return n })} />}
      <div className="min-w-0 flex-1 basis-36"><p className="break-words text-sm font-semibold">{g.description}</p><p className="mt-1 text-xs text-muted">{formatFecha(g.expense_date)} · {nombre('medios', g.payment_method_id)}</p><p className="mt-1 break-words text-xs text-muted">{nombre('ambitos', g.ambito_id)} › {nombre('categorias', g.categoria_id)}{g.subcategoria_id ? ` › ${nombre('subcategorias', g.subcategoria_id)}` : ''}</p>{g.event_id && selector && <p className="mt-1 text-xs text-warn">{g.event_id === evento.id ? 'Ya está en este evento' : 'Pertenece a otro evento'}</p>}</div>
      <div className="flex flex-col items-end gap-1"><b className="num text-sm">{formatSoles(g.amount)}</b>{g.original_currency === 'USD' && <span className="num text-xs text-muted">{formatOriginal(g.original_amount, 'USD')}</span>}<span className="text-[11px] text-muted">{g.currency} · {g.expense_type === 'fixed' ? 'Fijo' : 'Variable'}</span>{g.status === 'annulled' && <Pill>Anulado · no suma</Pill>}</div>
      {!selector && <div className="flex w-full flex-wrap gap-1 border-t border-line pt-2 sm:w-auto sm:border-0 sm:pt-0"><Button variant="ghost" className="min-h-11 px-2" aria-label={`Ver detalle ${g.description}`} onClick={() => setDetalle(g)}><Eye className="size-4" /></Button><Button variant="ghost" className="min-h-11 px-2" disabled={g.status !== 'active'} aria-label={`Editar gasto ${g.description}`} onClick={() => setEditar(g)}><Pencil className="size-4" /></Button><Button variant="ghost" className="min-h-11 px-2" aria-label={`Desvincular ${g.description}`} onClick={() => setQuitar(g)}><Unlink className="size-4" /></Button></div>}
    </li>)}</ul>}
    {gastos.data && <div className="flex flex-wrap items-center justify-center gap-3 text-xs"><Button variant="secondary" disabled={f.pagina === 1} onClick={() => cambiar({ pagina: f.pagina - 1 })}>Anterior</Button><span>{gastos.data.total} gastos · Página {f.pagina}</span><Button variant="secondary" disabled={f.pagina * 20 >= gastos.data.total} onClick={() => cambiar({ pagina: f.pagina + 1 })}>Siguiente</Button></div>}
    {selector && conflicto && <label className="flex items-start gap-2 rounded-lg bg-acc-soft p-3 text-sm text-warn"><input type="checkbox" className="mt-1" checked={mover} onChange={(e) => setMover(e.target.checked)} /><span>Cambiar explícitamente el evento o compromiso de los gastos seleccionados. El destino anterior dejará de incluirlos; sus importes y fondos se conservan.</span></label>}
  </div>
  return <>{selector ? <Modal open onOpenChange={(o) => !o && !mut.vincular.isPending && onClose?.()} title="Agregar gastos existentes" size="xl" sucio={seleccion.size > 0} footer={(cerrar) => <><span className="mr-auto text-xs text-muted">{seleccion.size} seleccionados · máximo 100</span><Button variant="secondary" onClick={cerrar}>Cancelar</Button><Button onClick={() => void asociar()} disabled={seleccion.size === 0 || (conflicto && !mover)} loading={mut.vincular.isPending}>Asociar gastos</Button></>}>{contenido}</Modal> : contenido}
    {detalle && <DetalleDesdeEvento gasto={detalle} onClose={() => setDetalle(null)} />}
    {editar && <GastoForm modo="editar" gasto={editar} onClose={() => setEditar(null)} />}
    <ConfirmDialog open={Boolean(quitar)} onOpenChange={(o) => !o && setQuitar(null)} title="¿Desvincular este gasto?" description="El gasto seguirá registrado y sus fondos no cambiarán. Solo dejará de formar parte de este evento y su compromiso." confirmLabel="Desvincular" loading={mut.vincular.isPending} onConfirm={() => { if (quitar) mut.vincular.mutate({ ids: [quitar.id], event: null }, { onSuccess: () => { toast.success('Gasto desvinculado.'); setQuitar(null) }, onError: (e) => toast.error(mensajeDeError(e)) }) }} />
  </>
}
function DetalleDesdeEvento({ gasto, onClose }: { gasto: Gasto; onClose: () => void }) {
  const catalogo = useCatalogo()
  const [modo, setModo] = useState<ModoGasto | null>(null)
  const consulta = useQuery({ queryKey: ['gastos', 'detalle-evento', gasto.id], queryFn: async () => {
    const g = await supabase.from('expenses').select('*,expense_fund_allocations(fund_id,amount,allocation_kind)').eq('id', gasto.id).single()
    if (g.error) throw g.error
    const ids = [...new Set(g.data.expense_fund_allocations.map((a) => a.fund_id))]
    const fondos = ids.length ? await supabase.from('funds').select('id,name,color_token').in('id', ids) : { data: [], error: null }
    if (fondos.error) throw fondos.error
    return { gasto: g.data as GastoConFondos, fondos: new Map((fondos.data ?? []).map((f) => [f.id, f])) }
  } })
  if (modo) return <GastoForm modo={modo} gasto={modo === 'plantilla' ? undefined : gasto} inicial={modo === 'plantilla' ? inicialDesdeGasto(gasto) : undefined} onClose={onClose} />
  if (!consulta.data) return <Modal open onOpenChange={(o) => !o && onClose()} title="Detalle del gasto">{consulta.isError ? <ErrorState message="No se pudo cargar el detalle." onRetry={() => void consulta.refetch()} /> : <Skeleton className="h-48" />}</Modal>
  return <DetalleGasto g={consulta.data.gasto} fondoPorId={consulta.data.fondos} formato="dd/MM/yyyy" nom={{ ambito: new Map(catalogo.ambitos.map((i) => [i.id, i])), categoria: new Map(catalogo.categorias.map((i) => [i.id, i])), sub: new Map(catalogo.subcategorias.map((i) => [i.id, i])), medio: new Map(catalogo.medios.map((i) => [i.id, i])) }} onClose={onClose} onEditar={() => setModo('editar')} onClonar={() => setModo('clonar')} onPlantilla={() => setModo('plantilla')} />
}
