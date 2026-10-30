import { ArrowRightLeft, Ban, CalendarDays, CircleHelp, Hash, PiggyBank, Percent, ReceiptText, TriangleAlert, WalletCards } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router'
import { claseAcento, IconoAcento, type Acento } from '@/components/ui/Acento'
import { Hint } from '@/components/ui/Hint'
import { TooltipGrafico, TTCabecera, TTPie } from '@/components/ui/TooltipGrafico'
import { geometriaBarra, type ResumenPresupuesto } from '@/domain/presupuesto'
import { cn } from '@/lib/cn'
import { formatSoles } from '@/lib/format'

const ESTADO: Record<ResumenPresupuesto['estado'], { etiqueta: string; relleno: string }> = {
  'sin-presupuesto': { etiqueta: 'Sin presupuesto', relleno: 'from-slate-400 to-slate-500' },
  ok: { etiqueta: 'En curso', relleno: 'from-[#4F46E5] to-[#6D78F0]' },
  casi: { etiqueta: 'Casi agotado', relleno: 'from-[#D97706] to-[#F0A030]' },
  agotado: { etiqueta: 'Agotado', relleno: 'from-[#D97706] to-[#F0A030]' },
  excedido: { etiqueta: 'Excedido', relleno: 'from-[#4F46E5] to-[#6D78F0]' },
}

const Chip = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white', className)}>{children}</span>
)

function Metrica({ etiqueta, valor, nota, tono }: { etiqueta: string; valor: string; nota?: string; tono?: 'pri' | 'ok' | 'bad' | 'muted' }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-5 py-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</span>
      <span className={cn('num text-2xl font-semibold leading-tight', tono === 'pri' && 'text-pri', tono === 'bad' && 'text-bad', tono === 'ok' && 'text-ok', tono === 'muted' && 'text-muted')}>{valor}</span>
      {nota && <span className="text-xs text-muted">{nota}</span>}
    </div>
  )
}

function Tile({ icono, acento, etiqueta, valor, nota, ayuda, alerta }: { icono: ComponentType<{ className?: string }>; acento: Acento; etiqueta: string; valor: ReactNode; nota: string; ayuda: string; alerta?: boolean }) {
  return (
    <Hint contenido={ayuda} side="top">
      <div tabIndex={0} className={cn(claseAcento(acento), 'flex items-center gap-3 rounded-xl border bg-surface p-3 transition-colors hover:bg-surface-2', alerta ? 'border-[var(--a-bd)] bg-[var(--a-soft)]' : 'border-line')}>
        <IconoAcento icono={icono} acento={acento} size="md" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium leading-tight text-muted">{etiqueta}</p>
          <p className={cn('num text-lg font-semibold leading-snug', alerta && 'text-[var(--a-fg)]')}>{valor}</p>
          <p className="truncate text-xs text-muted">{nota}</p>
        </div>
      </div>
    </Hint>
  )
}

export function PresupuestoConsolidado({ r, etiquetaPeriodo }: { r: ResumenPresupuesto; etiquetaPeriodo: string }) {
  const e = ESTADO[r.estado]
  const g = geometriaBarra(r.asignado, r.imputado)
  const excede = r.exceso > 0
  const anchoRelleno = Math.min(g.consumidoPct, g.limitePct || g.consumidoPct)
  const textoBarra =
    r.asignado === null
      ? 'Sin presupuesto asignado en este período.'
      : `${(r.consumoPct ?? 0).toFixed(1)} % consumido. ${excede ? `Excede el presupuesto en ${formatSoles(r.exceso)}.` : `Disponible ${formatSoles(r.disponible ?? 0)}.`}`
  const acentoConsumo: Acento = r.estado === 'excedido' ? 'red' : r.estado === 'casi' || r.estado === 'agotado' ? 'amber' : 'indigo'

  return (
    <section aria-label="Presupuesto consolidado" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-white md:px-6" style={{ background: 'linear-gradient(110deg, var(--grad-a), var(--grad-b) 55%, var(--grad-c))' }}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl border border-white/25 bg-white/15"><WalletCards className="size-5" aria-hidden="true" /></span>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-display text-lg font-bold">Presupuesto consolidado</h2>
              <Hint
                side="bottom"
                contenido={
                  <TooltipGrafico>
                    <TTCabecera titulo="¿Cómo se calcula?" />
                    <TTPie><span className="text-[0.8125rem] text-fg">Suma lo asignado a los fondos activos en los períodos que toca el rango. Disponible = asignado − gasto imputado a fondos. Los filtros de los gráficos no reparten el presupuesto: se muestran aparte.</span></TTPie>
                  </TooltipGrafico>
                }
              >
                <button type="button" aria-label="Cómo se calcula el presupuesto consolidado" className="grid size-6 place-items-center rounded-full text-white/80 hover:bg-white/15 hover:text-white">
                  <CircleHelp className="size-4" aria-hidden="true" />
                </button>
              </Hint>
            </div>
            <p className="text-sm text-white/80">{etiquetaPeriodo}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{e.etiqueta}</Chip>
          <Chip>{r.fondosActivos} {r.fondosActivos === 1 ? 'fondo activo' : 'fondos activos'}</Chip>
          {excede && <Chip className="border-white bg-white text-[#B3261E]"><TriangleAlert className="size-3.5" aria-hidden="true" /> Excedente de {formatSoles(r.exceso)}</Chip>}
        </div>
      </header>

      <div className="flex flex-col gap-5 p-5 md:p-6">
        {r.asignado === null ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line p-5">
            <p className="font-medium">No hay presupuesto asignado a fondos activos en este período.</p>
            <p className="text-sm text-muted">El gasto se sigue registrando con normalidad. Asigna importes a tus fondos para ver el consumo y lo disponible.</p>
            <Link to="/fondos" className="text-sm font-semibold text-pri underline">Ir a Fondos</Link>
          </div>
        ) : (
          <>
            <div className="grid divide-y divide-line rounded-xl border border-line bg-surface-2/40 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
              <Metrica etiqueta="Presupuesto asignado" valor={formatSoles(r.asignado)} tono="pri" nota="Fondos activos del período" />
              <Metrica etiqueta="Gastado del período" valor={formatSoles(r.gastado)} nota={`Imputado a fondos: ${formatSoles(r.imputado)}`} />
              <Metrica etiqueta="Disponible consolidado" valor={formatSoles(r.disponible ?? 0)} tono={excede ? 'bad' : 'ok'} nota="Asignado − gasto imputado" />
              <Metrica etiqueta="Exceso sobre el presupuesto" valor={excede ? formatSoles(r.exceso) : formatSoles(0)} tono={excede ? 'bad' : 'muted'} nota={excede ? 'Superaste lo asignado' : 'Sin exceso'} />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm">
                <span className="num">Consumido <b>{formatSoles(r.imputado)}</b> · <b className={cn(excede && 'text-bad')}>{(r.consumoPct ?? 0).toFixed(1)} %</b></span>
                <span className={cn('num font-semibold', excede ? 'text-bad' : 'text-ok')}>{excede ? `Exceso ${formatSoles(r.exceso)}` : `Disponible ${formatSoles(r.disponible ?? 0)}`}</span>
              </div>
              <div className="relative pt-6">
                <div
                  role="progressbar"
                  aria-label="Consumo del presupuesto consolidado"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, Math.round(r.consumoPct ?? 0))}
                  aria-valuetext={textoBarra}
                  className="relative h-3.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line"
                >
                  <div className={cn('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out', e.relleno)} style={{ width: `${anchoRelleno}%` }} />
                  {excede && (
                    <div
                      className="absolute inset-y-0 transition-[width] duration-500"
                      style={{ left: `${g.limitePct}%`, width: `${g.excesoPct}%`, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 4px, transparent 4px 8px), linear-gradient(90deg,#E0553F,#C62F2F)' }}
                    />
                  )}
                </div>
                <div className="pointer-events-none absolute bottom-[-4px] top-2" style={{ left: `${g.limitePct}%` }} aria-hidden="true">
                  <span className={cn('absolute top-0 whitespace-nowrap text-xs font-semibold text-fg', g.limitePct > 88 ? '-translate-x-full pr-1' : '-translate-x-1/2')}>Límite {formatSoles(r.asignado)}</span>
                  <span className="absolute inset-y-3.5 w-0.5 -translate-x-1/2 rounded bg-fg" />
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted" aria-label="Leyenda de la barra">
                <li className="inline-flex items-center gap-1.5"><span className={cn('size-2.5 rounded-sm bg-gradient-to-r', e.relleno)} /> Consumido</li>
                <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-surface-2 ring-1 ring-line" /> Disponible</li>
                <li className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 rounded bg-fg" /> Límite presupuestario</li>
                {excede && <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#D33F33]" /> Exceso</li>}
              </ul>
            </div>
          </>
        )}

        {r.gastoFiltrado !== null && (
          <div role="status" className="flex flex-wrap items-start gap-3 rounded-xl border border-pri bg-pri-soft px-4 py-3 text-sm">
            <ReceiptText className="mt-0.5 size-4 shrink-0 text-pri" aria-hidden="true" />
            <p>
              <b>Gasto con filtros actuales: <span className="num">{formatSoles(r.gastoFiltrado)}</span></b>
              {r.porcentajeFiltradoDelGastado !== null && <> ({r.porcentajeFiltradoDelGastado.toFixed(1)} % del gastado del período)</>}.
              <span className="text-muted"> El presupuesto de arriba es el del período completo: no se puede repartir por los filtros elegidos, por eso no se resta un disponible filtrado.</span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="list" aria-label="Indicadores complementarios">
          <div role="listitem" className="contents"><Tile icono={PiggyBank} acento="blue" etiqueta="Fondos activos" valor={r.fondosActivos} nota="Reciben gasto" ayuda="Fondos habilitados que reciben gasto en el período." /></div>
          <div role="listitem" className="contents"><Tile icono={Ban} acento="slate" etiqueta="Fondos agotados" valor={r.fondosAgotados} nota="Disponible en cero" ayuda="Fondos con presupuesto asignado cuyo disponible es exactamente cero." /></div>
          <div role="listitem" className="contents"><Tile icono={ArrowRightLeft} acento="orange" etiqueta="Con excedente" valor={r.fondosConExcedente} nota="Absorbido por General" ayuda="Fondos específicos agotados cuyo exceso absorbió el Fondo General." /></div>
          <div role="listitem" className="contents"><Tile icono={TriangleAlert} acento="red" etiqueta="Fondos sobregirados" valor={r.fondosSobregirados} nota="Saldo negativo" alerta={r.fondosSobregirados > 0} ayuda="Fondos que consumieron más de lo asignado (saldo negativo)." /></div>
          <div role="listitem" className="contents"><Tile icono={ReceiptText} acento="violet" etiqueta="Sin fondo asignable" valor={formatSoles(r.sinFondo)} nota="Lo normal es S/ 0.00" alerta={r.sinFondo > 0} ayuda="Gasto del período que no quedó imputado a ningún fondo. Lo normal es S/ 0.00." /></div>
          <div role="listitem" className="contents"><Tile icono={Percent} acento={acentoConsumo} etiqueta="Consumo del presupuesto" valor={r.consumoPct === null ? '—' : `${r.consumoPct.toFixed(1)} %`} nota="Imputado ÷ asignado" ayuda="Gasto imputado dividido entre el presupuesto asignado. Puede superar 100 %." /></div>
          <div role="listitem" className="contents"><Tile icono={CalendarDays} acento="sky" etiqueta="Promedio diario" valor={r.promedioDiario === null ? '—' : formatSoles(r.promedioDiario)} nota="Por día transcurrido" ayuda="Gasto con los filtros actuales entre los días transcurridos del rango." /></div>
          <div role="listitem" className="contents"><Tile icono={Hash} acento="teal" etiqueta="Promedio por movimiento" valor={r.promedioPorMovimiento === null ? '—' : formatSoles(r.promedioPorMovimiento)} nota="Por registro" ayuda="Gasto con los filtros actuales entre la cantidad de movimientos." /></div>
        </div>
      </div>
    </section>
  )
}
