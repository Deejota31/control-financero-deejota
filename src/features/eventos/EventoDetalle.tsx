import { formatOriginal, formatTasa } from '@/domain/moneda'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Archive, ArrowDown, ArrowLeft, ArrowUp, BookmarkPlus, CalendarDays, CheckCheck, Copy, Edit, Plus, Receipt, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { TinteK } from '@/components/ui/ChipK'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { Alert } from '@/components/ui/Alert'
import { useRegistroGasto } from '@/features/gastos/RegistroGasto'
import { formatFecha, formatSoles, formatSolesCorto } from '@/lib/format'
import { mensajeDeError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { EventoForm, estiloSelect } from './EventoForm'
import { EstadoEvento, ProgresoEvento } from './EventoVisual'
import { PlanEventoForm } from './PlanEventoForm'
import { GastosEvento } from './GastosEvento'
import { etiquetaTipo, recibeGastos, type Compromiso, type Concepto, type Evento } from './modelo'
import { useAnalisisEvento, useEvento, useMutacionesEvento, usePlanEvento } from './useEventos'

const TABS = [['resumen','Resumen'],['gastos','Gastos'],['conceptos','Planificación'],['compromisos','Compromisos'],['analisis','Análisis']] as const
type Tab = typeof TABS[number][0]
export function EventoDetalle() {
  const { id } = useParams()
  const q = useEvento(id)
  if (q.isPending) return <div role="status" aria-label="Cargando evento"><Skeleton className="h-40" /><Skeleton className="mt-4 h-72" /></div>
  if (q.isError || !q.data) return <ErrorState message="No se pudo encontrar este evento o no tienes acceso." onRetry={() => void q.refetch()} />
  return <Detalle key={q.data.id} evento={q.data} />
}
function Detalle({ evento: e }: { evento: Evento }) {
  const navigate = useNavigate()
  const plan = usePlanEvento(e.id)
  const mut = useMutacionesEvento()
  const { abrirConEvento } = useRegistroGasto()
  const [tab, setTab] = useState<Tab>('resumen')
  const [form, setForm] = useState<'editar' | 'clonar' | 'plantilla' | 'desde-plantilla' | null>(null)
  const [planForm, setPlanForm] = useState<{ tipo: 'concepto' | 'compromiso'; item?: Concepto; contrato?: Compromiso } | null>(null)
  const [selector, setSelector] = useState<{ compromiso?: string; concepto?: string } | null>(null)
  const [filtro, setFiltro] = useState<{ concepto?: string; compromiso?: string }>({})
  const [filtroContrato, setFiltroContrato] = useState('')
  const [borrar, setBorrar] = useState<Concepto | null>(null)
  const [archivar, setArchivar] = useState(false)
  const puede = recibeGastos(e)
  const aviso = (err: unknown) => toast.error(mensajeDeError(err))
  const verGastos = (f: { concepto?: string; compromiso?: string }) => { setFiltro(f); setTab('gastos') }
  return <div className="flex min-w-0 flex-col gap-5">
    <Link to="/eventos" className="inline-flex min-h-9 items-center gap-2 self-start rounded text-sm font-semibold text-pri"><ArrowLeft className="size-4" />Mis eventos</Link>
    <section className="rounded-2xl border border-line bg-gradient-to-br from-pri-soft to-surface p-4 sm:p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 flex-1 basis-60 items-start gap-3"><TinteK color={e.color_token} className="size-14 rounded-2xl"><ItemIcon name={e.icon_key} color={e.color_token} className="size-7" /></TinteK><div className="min-w-0"><p className="text-xs font-semibold text-pri">{e.is_template ? 'Plantilla de evento' : etiquetaTipo(e.event_type)}</p><h2 className="mt-1 break-words font-display text-xl font-bold sm:text-2xl">{e.name}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted"><CalendarDays className="size-4" />{e.target_date ? formatFecha(e.target_date) : 'Fecha adaptable'}<EstadoEvento evento={e} /></div></div></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setForm('editar')}><Edit className="size-4" />Editar</Button><Button variant="secondary" onClick={() => setForm(e.is_template ? 'desde-plantilla' : 'clonar')}><Copy className="size-4" />{e.is_template ? 'Usar plantilla' : 'Clonar'}</Button></div>
      </div>
      {e.description && <p className="mt-4 max-w-3xl whitespace-pre-wrap break-words text-sm text-muted">{e.description}</p>}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        {!e.is_template && <Button variant="ghost" className="text-xs" onClick={() => setForm('plantilla')}><BookmarkPlus className="size-4" />Guardar como plantilla</Button>}
        {e.is_template && <Button variant="ghost" className="text-xs" onClick={() => setForm('clonar')}><Copy className="size-4" />Duplicar plantilla</Button>}
        <Button variant="ghost" className="text-xs" onClick={() => setArchivar(true)}><Archive className="size-4" />{e.archived_at ? 'Restaurar' : 'Archivar'}</Button>
        {!e.is_template && !e.archived_at && e.status !== 'completed' && <Button variant="ghost" className="text-xs" onClick={() => mut.cambiar.mutate({ id: e.id, patch: { status: 'completed' } }, { onSuccess: () => toast.success('Evento finalizado. Su historial se conserva.'), onError: aviso })}><CheckCheck className="size-4" />Finalizar evento</Button>}
      </div>
    </section>
    {e.is_template && <Alert tone="info">Esta es una estructura reutilizable: sus conceptos y compromisos son propuestas. No recibe pagos ni gastos reales.</Alert>}
    {!e.is_template && !puede && <Alert tone="info">Este evento conserva su historial y no recibe nuevas asociaciones. Puedes reabrirlo desde Editar. Cancelar el evento no cancela automáticamente los contratos pendientes.</Alert>}
    {!e.is_template && <div className="flex flex-wrap gap-2"><Button disabled={!puede} onClick={() => abrirConEvento({ event_id: e.id })}><Plus className="size-4" />Registrar gasto del evento</Button><Button variant="secondary" disabled={!puede} onClick={() => setSelector({})}><Receipt className="size-4" />Agregar gastos existentes</Button></div>}
    <div role="group" aria-label="Secciones del evento" className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">{TABS.filter(([id]) => !e.is_template || !['gastos','analisis'].includes(id)).map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => { setTab(id); if (id === 'gastos') setFiltro({}) }} className={cn('min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold sm:flex-none', tab === id ? 'bg-pri-soft text-pri' : 'text-muted hover:bg-surface-2')}>{label}</button>)}</div>
    {tab === 'resumen' && <>
      <ResumenEvento evento={e} />
      <div><section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"><h3 className="font-display text-lg font-bold">Desglose de planificación</h3><Dato label="Total de conceptos" value={e.planned_total} /><Dato label="Diferencia con el presupuesto" value={e.unplanned} /><Button variant="secondary" onClick={() => setTab('conceptos')}>Organizar conceptos</Button></section></div>
    </>}
    {tab === 'gastos' && <><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted">Gastos de todos los meses · los anulados no suman.</p>{(filtro.concepto || filtro.compromiso) && <Button variant="ghost" onClick={() => setFiltro({})}>Quitar filtro de concepto o compromiso</Button>}</div><GastosEvento key={JSON.stringify(filtro)} evento={e} concepto={filtro.concepto} compromiso={filtro.compromiso} /></>}
    {(tab === 'conceptos' || tab === 'compromisos') && <>
      {tab === 'compromisos' && <select aria-label="Filtrar compromisos por concepto" className={cn(estiloSelect, 'sm:max-w-sm')} value={filtroContrato} onChange={(ev) => setFiltroContrato(ev.target.value)}><option value="">Todos los conceptos</option>{(plan.data?.items ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}
      {plan.isPending ? <Skeleton className="h-52" /> : plan.isError ? <ErrorState message="No se pudo cargar la planificación." onRetry={() => void plan.refetch()} /> : <>
        <div className="flex flex-wrap items-center justify-between gap-3"><Button onClick={() => setPlanForm({ tipo: tab === 'conceptos' ? 'concepto' : 'compromiso' })}><Plus className="size-4" />{tab === 'conceptos' ? 'Nuevo concepto' : 'Nuevo compromiso'}</Button></div>
        {tab === 'conceptos' ? plan.data.items.length === 0 ? <EmptyState title="Organiza tu primer concepto" description="Fotografía, vestimenta, decoración… tú decides cómo distribuir la planificación." /> : <ul className="grid min-w-0 gap-3 md:grid-cols-2">{plan.data.items.map((i, index) => <li key={i.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4"><div className="flex min-w-0 items-start justify-between gap-2"><h3 className="break-words font-semibold">{i.name}</h3><div className="flex shrink-0"><Button variant="ghost" className="min-h-11 px-2" aria-label={`Subir ${i.name}`} disabled={index === 0} onClick={() => mut.concepto.mutate({ ...i, sort_order: (plan.data.items[index - 1]?.sort_order ?? 0) - 1 }, { onError: aviso })}><ArrowUp className="size-4" /></Button><Button variant="ghost" className="min-h-11 px-2" aria-label={`Bajar ${i.name}`} disabled={index === plan.data.items.length - 1} onClick={() => mut.concepto.mutate({ ...i, sort_order: (plan.data.items[index + 1]?.sort_order ?? index) + 1 }, { onError: aviso })}><ArrowDown className="size-4" /></Button></div></div><Dato label="Planificado" value={i.planned_amount} /><MonedaPlan registro={i} /><Dato label="Pagado" value={i.paid} /><Dato label="Comprometido pendiente" value={i.pending} /><div className="mt-auto flex flex-wrap gap-2"><Button variant="secondary" className="text-xs" onClick={() => setPlanForm({ tipo: 'concepto', item: i })}>Editar concepto</Button>{!e.is_template && <Button variant="ghost" className="text-xs" onClick={() => verGastos({ concepto: i.id })}>Ver gastos</Button>}<Button variant="ghost" className="text-xs" onClick={() => setBorrar(i)}>Eliminar concepto</Button></div></li>)}</ul> : plan.data.compromisos.filter((c) => !filtroContrato || c.event_item_id === filtroContrato).length === 0 ? <EmptyState title="Todavía no hay compromisos" description="Añade un costo contratado para seguir sus adelantos y saldo pendiente." /> : <ul className="grid min-w-0 gap-3 md:grid-cols-2">{plan.data.compromisos.filter((c) => !filtroContrato || c.event_item_id === filtroContrato).map((c) => <li key={c.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 break-words font-semibold">{c.name}</h3><Pill tone={c.payment_status === 'paid' ? 'ok' : c.payment_status === 'partial' ? 'warn' : 'neutral'}>{({ paid: 'Pagado', partial: 'Parcialmente pagado', pending: 'Pendiente', cancelled: 'Cancelado' } as Record<string, string>)[c.payment_status]}</Pill></div><p className="text-xs text-muted">{c.due_date ? `Previsto: ${formatFecha(c.due_date)}` : 'Sin fecha de pago'}{c.event_item_id ? ` · ${plan.data.items.find((i) => i.id === c.event_item_id)?.name ?? 'Concepto'}` : ''}</p><Dato label="Contratado" value={c.contracted_amount} /><MonedaPlan registro={c} /><Dato label="Pagos realizados" value={c.paid} /><Dato label="Pendiente" value={c.pending} />{c.overpaid > 0 && <Alert tone="info">Pagos por encima de lo contratado: {formatSoles(c.overpaid)}. Revisa el importe del contrato.</Alert>}{c.notes && <p className="whitespace-pre-wrap break-words text-xs text-muted">{c.notes}</p>}<div className="mt-auto flex flex-wrap gap-2"><Button variant="secondary" className="text-xs" onClick={() => setPlanForm({ tipo: 'compromiso', contrato: c })}>Editar compromiso</Button>{!e.is_template && <><Button variant="ghost" className="text-xs" onClick={() => verGastos({ compromiso: c.id })}>Ver pagos</Button><Button variant="ghost" className="text-xs" disabled={!puede || Boolean(c.cancelled_at)} onClick={() => setSelector({ compromiso: c.id, concepto: c.event_item_id ?? undefined })}>Vincular pago existente</Button><Button className="text-xs" disabled={!puede || Boolean(c.cancelled_at)} onClick={() => abrirConEvento({ event_id: e.id, event_commitment_id: c.id, event_item_id: c.event_item_id ?? undefined })}>Registrar pago</Button></>}</div></li>)}</ul>}
      </>}
    </>}
    {tab === 'analisis' && <AnalisisEvento evento={e} />}
    {form && <EventoForm source={e} clonar={form !== 'editar'} plantilla={form === 'plantilla' || (e.is_template && form !== 'desde-plantilla')} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); navigate(`/eventos/${id}`) }} />}
    {planForm && <PlanEventoForm evento={e} {...planForm} conceptos={plan.data?.items ?? []} onClose={() => setPlanForm(null)} />}
    {selector && <GastosEvento evento={e} selector compromiso={selector.compromiso} concepto={selector.concepto} onClose={() => setSelector(null)} />}
    <ConfirmDialog open={Boolean(borrar)} onOpenChange={(o) => !o && setBorrar(null)} title="¿Eliminar este concepto?" description="Sus gastos y compromisos se conservan dentro del evento y quedan sin este concepto de planificación." confirmLabel="Eliminar concepto" danger loading={mut.quitarConcepto.isPending} onConfirm={() => { if (borrar) mut.quitarConcepto.mutate(borrar.id, { onSuccess: () => setBorrar(null), onError: aviso }) }} />
    <ConfirmDialog open={archivar} onOpenChange={setArchivar} title={e.archived_at ? '¿Restaurar este evento?' : '¿Archivar este evento?'} description="Se conservan los gastos, pagos y compromisos. Puedes consultar el historial y restaurarlo desde Archivados." confirmLabel={e.archived_at ? 'Restaurar' : 'Archivar'} loading={mut.cambiar.isPending} onConfirm={() => mut.cambiar.mutate({ id: e.id, patch: { archived_at: e.archived_at ? null : new Date().toISOString() } }, { onSuccess: () => { setArchivar(false); toast.success(e.archived_at ? 'Evento restaurado.' : 'Evento archivado.') }, onError: aviso })} />
  </div>
}
function Dato({ label, value }: { label: string; value: number }) {
  return <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm"><span className="text-muted">{label}</span><b className={cn('num', value < 0 && 'text-bad')}>{formatSoles(value)}</b></div>
}
function ResumenEvento({ evento: e }: { evento: Evento }) {
  return <section aria-label="Resumen financiero del evento" className="flex min-w-0 flex-col gap-4"><div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Presupuesto', e.budget], ['Pagado', e.paid], ['Comprometido pendiente', e.pending], ['Disponible proyectado', e.projected_available]].map(([label, value], i) => <div key={String(label)} className={cn('min-w-0 rounded-2xl border border-line p-4', i === 0 ? 'bg-pri-soft' : 'bg-surface')}><div className="mb-2 flex items-center gap-2 text-xs text-muted"><Wallet className="size-4 text-pri" />{label}</div><p className={cn('num break-words text-xl font-bold sm:text-2xl', Number(value) < 0 && 'text-bad')}>{formatSoles(Number(value))}</p></div>)}</div><div className="grid gap-4 rounded-2xl border border-line bg-surface p-5 lg:grid-cols-2"><div className="flex flex-col gap-3"><Dato label="Costo total proyectado" value={e.projected} /><Dato label="Disponible actual" value={e.available} /><Dato label="Exceso proyectado sobre presupuesto" value={Math.max(0, -e.projected_available)} /><p className="text-xs text-muted">{e.expense_count} gastos activos · {e.currency} · todos los períodos</p></div><div className="flex flex-col justify-center gap-3"><ProgresoEvento evento={e} /><p className="text-xs text-muted">{e.projected_percent === null ? 'Con presupuesto cero no se calculan porcentajes.' : `Consumo proyectado: ${e.projected_percent} %. Incluye únicamente el saldo pendiente de los contratos.`}</p></div></div></section>
}
function AnalisisEvento({ evento }: { evento: Evento }) {
  const q = useAnalisisEvento(evento.id)
  const [dimension, setDimension] = useState('categoria')
  const datos = q.data?.filter((d) => d.dimension === dimension) ?? []
  return <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-display text-lg font-bold">Cómo se distribuye lo pagado</h3><select className={cn(estiloSelect, 'sm:w-auto')} aria-label="Dimensión del análisis" value={dimension} onChange={(e) => setDimension(e.target.value)}>{[['categoria','Categoría'],['subcategoria','Subcategoría'],['ambito','Ámbito'],['mes','Mes'],['medio','Medio de pago']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
    {q.isPending ? <Skeleton className="h-64" /> : q.isError ? <ErrorState message="No se pudo cargar el análisis." onRetry={() => void q.refetch()} /> : datos.length === 0 ? <EmptyState title="El análisis aparecerá al vincular gastos" /> : <>
      <div className="h-64 w-full min-w-0" role="img" aria-label="Gráfico de distribución de gastos pagados; valores completos en la lista inferior."><ResponsiveContainer width="100%" height="100%"><BarChart data={datos.slice(0, 10)} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="label" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} interval={0} tickFormatter={(v: string) => v.length > 12 ? `${v.slice(0, 10)}…` : v} /><YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} tickFormatter={formatSolesCorto} width={54} /><Tooltip formatter={(v) => formatSoles(Number(v))} contentStyle={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--fg)', borderRadius: 12 }} /><Bar dataKey="amount" name="Pagado" fill="var(--chart-series-1)" radius={[6,6,0,0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
      {datos.length > 10 && <p className="text-xs text-muted">El gráfico muestra los diez importes mayores. La lista contiene la distribución completa.</p>}<ul className="grid gap-2 sm:grid-cols-2">{datos.map((d) => <li key={d.label} className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 rounded-lg bg-surface-2 p-3 text-sm"><span className="min-w-0 break-words">{d.label}<span className="ml-2 text-xs text-muted">{d.quantity} gastos</span></span><b className="num">{formatSoles(d.amount)}</b></li>)}</ul>
    </>}
  </section>
}

/** Un concepto o compromiso en dólares muestra su importe original y la estimación en soles con la tasa congelada. */
function MonedaPlan({ registro }: { registro: Concepto | Compromiso }) {
  if (registro.original_currency !== 'USD') return null
  const pen = 'planned_amount' in registro ? registro.planned_amount : registro.contracted_amount
  return <p className="num break-words text-xs text-muted">{formatOriginal(registro.original_amount, 'USD')} · estimado {formatSoles(pen)} · 1 US$ = S/ {formatTasa(registro.exchange_rate)}{registro.exchange_rate_reference_date ? ` · ${formatFecha(registro.exchange_rate_reference_date)}` : ''}</p>
}
