import { Link } from 'react-router'
import { CalendarDays, ArrowUpRight } from 'lucide-react'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { TinteK } from '@/components/ui/ChipK'
import { Pill } from '@/components/ui/States'
import { formatFecha, formatSoles } from '@/lib/format'
import { cn } from '@/lib/cn'
import { etiquetaEstado, etiquetaTipo, segmentosProgreso, type Evento } from './modelo'

export function EstadoEvento({ evento }: { evento: Evento }) {
  return <Pill tone={evento.archived_at ? 'neutral' : evento.status === 'completed' ? 'ok' : evento.status === 'cancelled' ? 'neutral' : 'pri'}>{evento.archived_at ? 'Archivado' : etiquetaEstado(evento.status)}</Pill>
}
export function ProgresoEvento({ evento: e }: { evento: Evento }) {
  const { real, pendiente } = segmentosProgreso(e.paid_percent, e.projected_percent)
  return <div className="flex min-w-0 flex-col gap-2">
    <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted">Presupuesto utilizado</span><b className={cn('num', Number(e.paid_percent) > 100 && 'text-bad')}>{e.paid_percent === null ? 'Sin presupuesto' : `${e.paid_percent} % pagado`}</b></div>
    <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={e.paid_percent === null ? 'Define un presupuesto para calcular el porcentaje.' : `${e.paid_percent} por ciento pagado y ${e.projected_percent} por ciento proyectado`}>
      <div className={e.paid_percent && e.paid_percent > 100 ? 'bg-bad' : 'bg-pri'} style={{ width: `${real}%` }} />
      <div className="bg-warn opacity-70" style={{ width: `${pendiente}%` }} />
    </div>
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted"><span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-pri" />Pagado</span><span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-warn" />Comprometido pendiente</span></div>
  </div>
}
export function EventoCard({ evento: e }: { evento: Evento }) {
  return <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
    <div className="flex min-w-0 items-start gap-3"><TinteK color={e.color_token} className="grid size-11 shrink-0 place-items-center rounded-xl"><ItemIcon name={e.icon_key} color={e.color_token} className="size-6" /></TinteK>
      <div className="min-w-0 flex-1"><p className="text-xs text-muted">{e.is_template ? 'Plantilla reutilizable' : etiquetaTipo(e.event_type)}</p><h2 className="mt-0.5 break-words font-display text-base font-bold"><Link to={`/eventos/${e.id}`} className="rounded hover:text-pri focus-visible:outline-2 focus-visible:outline-pri">{e.name}</Link></h2></div><ArrowUpRight className="size-4 shrink-0 text-muted" aria-hidden="true" /></div>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs text-muted"><CalendarDays className="size-3.5" />{e.target_date ? formatFecha(e.target_date) : 'Fecha adaptable'}</span><EstadoEvento evento={e} /></div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-line pt-4 text-xs">
      <div><p className="text-muted">Presupuesto</p><p className="num mt-1 font-semibold">{formatSoles(e.budget)}</p></div>
      <div><p className="text-muted">Pagado</p><p className="num mt-1 font-semibold">{formatSoles(e.paid)}</p></div>
      <div><p className="text-muted">Pendiente comprometido</p><p className="num mt-1 font-semibold text-warn">{formatSoles(e.pending)}</p></div>
      <div><p className="text-muted">Disponible proyectado</p><p className={cn('num mt-1 font-semibold', e.projected_available < 0 ? 'text-bad' : 'text-ok')}>{formatSoles(e.projected_available)}</p></div>
    </div>
    {!e.is_template && <ProgresoEvento evento={e} />}
    <Link to={`/eventos/${e.id}`} className="mt-auto inline-flex min-h-11 items-center justify-center rounded-lg bg-pri-soft px-3 text-sm font-semibold text-pri hover:opacity-80 focus-visible:outline-2 focus-visible:outline-pri">{e.is_template ? 'Ver estructura' : 'Ver evento'}</Link>
  </article>
}
