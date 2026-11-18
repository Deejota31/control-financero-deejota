import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CalendarRange, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/cn'
import { ESTADOS_EVENTO } from './modelo'
import { useEventos, type FiltrosEventos } from './useEventos'
import { EventoForm, estiloSelect } from './EventoForm'
import { EventoCard } from './EventoVisual'

export function EventosPage() {
  const navigate = useNavigate()
  const [nuevo, setNuevo] = useState(false)
  const [f, setF] = useState<FiltrosEventos>({ q: '', estado: '', year: '', desde: '', hasta: '', orden: 'proximo', pagina: 1, plantillas: false, archivados: false })
  const cambiar = (patch: Partial<FiltrosEventos>) => setF((v) => ({ ...v, ...patch, pagina: patch.pagina ?? 1 }))
  const q = useDebounced(f.q, 250)
  const eventos = useEventos({ ...f, q })
  return <div className="flex min-w-0 flex-col gap-4">
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pri-soft text-pri"><CalendarRange className="size-6" /></span><div className="min-w-0"><h2 className="font-display text-xl font-bold">{f.plantillas ? 'Plantillas de eventos' : 'Mis eventos'}</h2></div></div><Button onClick={() => setNuevo(true)}><Plus className="size-4" />{f.plantillas ? 'Nueva plantilla de evento' : 'Nuevo evento'}</Button></div>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-xl bg-surface-2 p-1" role="group" aria-label="Vista de eventos">{[[false, 'Mis eventos'], [true, 'Plantillas']] .map(([value, label]) => <button key={String(value)} type="button" aria-pressed={f.plantillas === value} onClick={() => cambiar({ plantillas: Boolean(value) })} className={cn('min-h-11 rounded-lg px-4 text-sm font-semibold', f.plantillas === value ? 'bg-surface text-pri shadow-sm' : 'text-muted')}>{String(label)}</button>)}</div><label className="flex min-h-11 items-center gap-2 text-sm text-muted"><input type="checkbox" checked={f.archivados} onChange={(e) => cambiar({ archivados: e.target.checked })} />Archivados</label></div>
    <section aria-label="Filtros de eventos" className="rounded-xl border border-line bg-surface p-3">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="flex min-w-0 items-center gap-2 rounded-md border border-line px-3"><Search className="size-4 shrink-0 text-muted" /><input aria-label="Buscar evento" value={f.q} onChange={(e) => cambiar({ q: e.target.value })} placeholder="Buscar por nombre…" className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" /></label>
        <select aria-label="Estado del evento" className={estiloSelect} value={f.estado} onChange={(e) => cambiar({ estado: e.target.value })}><option value="">Todos los estados</option>{ESTADOS_EVENTO.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <select aria-label="Orden de eventos" className={estiloSelect} value={f.orden} onChange={(e) => cambiar({ orden: e.target.value })}>{[['proximo','Fecha más próxima'],['lejano','Fecha más lejana'],['reciente','Creación reciente'],['presupuesto','Mayor presupuesto'],['gasto','Mayor gasto'],['nombre','Nombre']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      </div>
      <details className="mt-3 text-sm"><summary className="flex min-h-9 cursor-pointer items-center gap-2 font-semibold text-pri"><SlidersHorizontal className="size-4" />Fechas y año</summary><div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Año">{(p) => <Input {...p} inputMode="numeric" maxLength={4} value={f.year} onChange={(e) => cambiar({ year: e.target.value.replace(/\D/g, '') })} placeholder="Todos" />}</Field><Field label="Desde">{(p) => <Input {...p} type="date" value={f.desde} onChange={(e) => cambiar({ desde: e.target.value })} />}</Field><Field label="Hasta">{(p) => <Input {...p} type="date" value={f.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />}</Field></div></details>
    </section>
    {eventos.isPending ? <div role="status" aria-label="Cargando eventos" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0,1,2].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div> : eventos.isError ? <ErrorState message="No se pudieron cargar tus eventos." onRetry={() => void eventos.refetch()} /> : eventos.data.filas.length === 0 ? <EmptyState icon={CalendarRange} title={f.q || f.estado || f.archivados ? 'No hay eventos con estos filtros' : f.plantillas ? 'No hay plantillas de eventos' : 'No hay eventos'} description="Crea un evento para organizar sus conceptos, compromisos y gastos." action={<Button onClick={() => setNuevo(true)}>{f.plantillas ? 'Crear plantilla' : 'Crear mi primer evento'}</Button>} /> : <>
      <p className="text-xs text-muted">{eventos.data.total} {f.plantillas ? eventos.data.total === 1 ? 'plantilla' : 'plantillas' : eventos.data.total === 1 ? 'evento' : 'eventos'}</p><div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">{eventos.data.filas.map((e) => <EventoCard key={e.id} evento={e} />)}</div>
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm"><Button variant="secondary" disabled={f.pagina === 1} onClick={() => cambiar({ pagina: f.pagina - 1 })}>Anterior</Button><span>Página {f.pagina} de {Math.max(1, Math.ceil(eventos.data.total / 12))}</span><Button variant="secondary" disabled={f.pagina * 12 >= eventos.data.total} onClick={() => cambiar({ pagina: f.pagina + 1 })}>Siguiente</Button></div>
    </>}
    {nuevo && <EventoForm plantilla={f.plantillas} onClose={() => setNuevo(false)} onSaved={(id) => { setNuevo(false); navigate(`/eventos/${id}`) }} />}
  </div>
}
