import { ArrowRightLeft, Ban, CalendarDays, CircleHelp, Hash, PiggyBank, Percent, ReceiptText, TriangleAlert, WalletCards } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router'
import { Hint } from '@/components/ui/Hint'
import { Pill } from '@/components/ui/States'
import { geometriaBarra, type ResumenPresupuesto } from '@/domain/presupuesto'
import { cn } from '@/lib/cn'
import { formatSoles } from '@/lib/format'

const ESTADO: Record<ResumenPresupuesto['estado'], { etiqueta: string; tono: 'ok' | 'warn' | 'bad' | 'neutral'; barra: string }> = {
  'sin-presupuesto': { etiqueta: 'Sin presupuesto', tono: 'neutral', barra: 'bg-muted' },
  ok: { etiqueta: 'En curso', tono: 'ok', barra: 'bg-pri' },
  casi: { etiqueta: 'Casi agotado', tono: 'warn', barra: 'bg-acc' },
  agotado: { etiqueta: 'Agotado', tono: 'warn', barra: 'bg-acc' },
  excedido: { etiqueta: 'Excedido', tono: 'bad', barra: 'bg-pri' },
}

function Metrica({ etiqueta, valor, nota, tono }: { etiqueta: string; valor: string; nota?: string; tono?: 'ok' | 'bad' | 'muted' }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-surface-2 px-4 py-3">
      <span className="text-sm text-muted">{etiqueta}</span>
      <span className={cn('num text-xl font-medium', tono === 'bad' && 'text-bad', tono === 'ok' && 'text-ok', tono === 'muted' && 'text-muted')}>{valor}</span>
      {nota && <span className="text-xs text-muted">{nota}</span>}
    </div>
  )
}

function Tile({ icono: Icono, etiqueta, valor, ayuda, alerta }: { icono: ComponentType<{ className?: string }>; etiqueta: string; valor: ReactNode; ayuda: string; alerta?: boolean }) {
  return (
    <Hint contenido={ayuda} side="top">
      <div tabIndex={0} className={cn('flex items-center gap-3 rounded-lg border border-line px-3 py-2.5', alerta && 'border-bad bg-bad-soft')}>
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-md bg-surface-2', alerta && 'bg-surface text-bad')}>
          <Icono className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs leading-tight text-muted">{etiqueta}</p>
          <p className={cn('num text-base font-medium', alerta && 'text-bad')}>{valor}</p>
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
  const colorRelleno = r.estado === 'excedido' ? 'bg-pri' : e.barra
  const textoBarra =
    r.asignado === null
      ? 'Sin presupuesto asignado en este período.'
      : `${(r.consumoPct ?? 0).toFixed(1)} % consumido. ${excede ? `Excede el presupuesto en ${formatSoles(r.exceso)}.` : `Disponible ${formatSoles(r.disponible ?? 0)}.`}`

  return (
    <section aria-label="Presupuesto consolidado" className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-pri-soft text-pri"><WalletCards className="size-5" aria-hidden="true" /></span>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-display text-lg font-bold">Presupuesto consolidado</h2>
              <Hint
                side="bottom"
                contenido={
                  <div className="flex max-w-64 flex-col gap-1">
                    <p className="font-semibold">¿Cómo se calcula?</p>
                    <p className="text-muted">Suma lo asignado a los fondos activos en los períodos que toca el rango. Disponible = asignado − gasto imputado a fondos. Los filtros de los gráficos no reparten el presupuesto: se muestran aparte.</p>
                  </div>
                }
              >
                <button type="button" aria-label="Cómo se calcula el presupuesto consolidado" className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface-2">
                  <CircleHelp className="size-4" aria-hidden="true" />
                </button>
              </Hint>
            </div>
            <p className="text-sm text-muted">{etiquetaPeriodo}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={e.tono}>{e.etiqueta}</Pill>
          <Pill tone="pri">{r.fondosActivos} {r.fondosActivos === 1 ? 'fondo activo' : 'fondos activos'}</Pill>
          {excede && <Pill tone="bad"><TriangleAlert className="size-3" aria-hidden="true" /> Excedente de {formatSoles(r.exceso)}</Pill>}
        </div>
      </header>

      {r.asignado === null ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-line p-5">
          <p className="font-medium">No hay presupuesto asignado a fondos activos en este período.</p>
          <p className="text-sm text-muted">El gasto se sigue registrando con normalidad. Asigna importes a tus fondos para ver el consumo y lo disponible.</p>
          <Link to="/fondos" className="text-sm font-semibold text-pri underline">Ir a Fondos</Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metrica etiqueta="Presupuesto asignado" valor={formatSoles(r.asignado)} nota="Fondos activos del período" />
            <Metrica etiqueta="Gastado del período" valor={formatSoles(r.gastado)} nota={`Imputado a fondos: ${formatSoles(r.imputado)}`} />
            <Metrica etiqueta="Disponible consolidado" valor={formatSoles(r.disponible ?? 0)} tono={excede ? 'bad' : 'ok'} nota="Asignado − gasto imputado" />
            <Metrica etiqueta="Exceso sobre el presupuesto" valor={excede ? formatSoles(r.exceso) : formatSoles(0)} tono={excede ? 'bad' : 'muted'} nota={excede ? 'Superaste lo asignado' : 'Sin exceso'} />
          </div>

          <div>
            <div className="relative pt-7">
              <div
                role="progressbar"
                aria-label="Consumo del presupuesto consolidado"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.round(r.consumoPct ?? 0))}
                aria-valuetext={textoBarra}
                className="relative h-4 overflow-hidden rounded-full bg-surface-2"
              >
                <div className={cn('absolute inset-y-0 left-0 transition-[width] duration-300', colorRelleno)} style={{ width: `${anchoRelleno}%` }} />
                {excede && (
                  <div
                    className="absolute inset-y-0 bg-bad transition-[width] duration-300"
                    style={{ left: `${g.limitePct}%`, width: `${g.excesoPct}%`, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.4) 0 4px, transparent 4px 8px)' }}
                  />
                )}
              </div>
              {/* Límite presupuestario */}
              <div className="pointer-events-none absolute bottom-[-4px] top-3" style={{ left: `${g.limitePct}%` }} aria-hidden="true">
                <span className={cn('absolute top-0 whitespace-nowrap text-xs font-semibold text-fg', g.limitePct > 88 ? '-translate-x-full pr-1' : '-translate-x-1/2')}>Límite {formatSoles(r.asignado)}</span>
                <span className="absolute inset-y-3 w-0.5 -translate-x-1/2 rounded bg-fg" />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm">
              <span className="num">Consumido {formatSoles(r.imputado)} · <b>{(r.consumoPct ?? 0).toFixed(1)} %</b></span>
              <span className={cn('num font-medium', excede ? 'text-bad' : 'text-ok')}>{excede ? `Exceso ${formatSoles(r.exceso)}` : `Disponible ${formatSoles(r.disponible ?? 0)}`}</span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted" aria-label="Leyenda de la barra">
              <li className="inline-flex items-center gap-1.5"><span className={cn('size-2.5 rounded-sm', colorRelleno)} /> Consumido</li>
              <li className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 rounded bg-fg" /> Límite presupuestario</li>
              <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-surface-2 ring-1 ring-line" /> Disponible</li>
              {excede && <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-bad" /> Exceso</li>}
            </ul>
          </div>
        </>
      )}

      {r.gastoFiltrado !== null && (
        <div role="status" className="flex flex-wrap items-start gap-3 rounded-lg border border-pri bg-pri-soft px-4 py-3 text-sm">
          <ReceiptText className="mt-0.5 size-4 shrink-0 text-pri" aria-hidden="true" />
          <p>
            <b>Gasto con filtros actuales: <span className="num">{formatSoles(r.gastoFiltrado)}</span></b>
            {r.porcentajeFiltradoDelGastado !== null && <> ({r.porcentajeFiltradoDelGastado.toFixed(1)} % del gastado del período)</>}.
            <span className="text-muted"> El presupuesto de arriba es el del período completo: no se puede repartir por los filtros elegidos, por eso no se resta un disponible filtrado.</span>
          </p>
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" role="list" aria-label="Indicadores complementarios">
        <div role="listitem" className="contents"><Tile icono={PiggyBank} etiqueta="Fondos activos" valor={r.fondosActivos} ayuda="Fondos habilitados que reciben gasto en el período." /></div>
        <div role="listitem" className="contents"><Tile icono={Ban} etiqueta="Fondos agotados" valor={r.fondosAgotados} ayuda="Fondos con presupuesto asignado cuyo disponible es exactamente cero." /></div>
        <div role="listitem" className="contents"><Tile icono={ArrowRightLeft} etiqueta="Con excedente" valor={r.fondosConExcedente} ayuda="Fondos específicos agotados cuyo exceso absorbió el Fondo General." /></div>
        <div role="listitem" className="contents"><Tile icono={TriangleAlert} etiqueta="Fondos sobregirados" valor={r.fondosSobregirados} alerta={r.fondosSobregirados > 0} ayuda="Fondos que consumieron más de lo asignado (saldo negativo)." /></div>
        <div role="listitem" className="contents"><Tile icono={ReceiptText} etiqueta="Sin fondo asignable" valor={formatSoles(r.sinFondo)} alerta={r.sinFondo > 0} ayuda="Gasto del período que no quedó imputado a ningún fondo. Lo normal es S/ 0.00." /></div>
        <div role="listitem" className="contents"><Tile icono={Percent} etiqueta="Consumo del presupuesto" valor={r.consumoPct === null ? '—' : `${r.consumoPct.toFixed(1)} %`} ayuda="Gasto imputado dividido entre el presupuesto asignado. Puede superar 100 %." /></div>
        <div role="listitem" className="contents"><Tile icono={CalendarDays} etiqueta="Promedio diario" valor={r.promedioDiario === null ? '—' : formatSoles(r.promedioDiario)} ayuda="Gasto con los filtros actuales entre los días transcurridos del rango." /></div>
        <div role="listitem" className="contents"><Tile icono={Hash} etiqueta="Promedio por movimiento" valor={r.promedioPorMovimiento === null ? '—' : formatSoles(r.promedioPorMovimiento)} ayuda="Gasto con los filtros actuales entre la cantidad de movimientos." /></div>
      </div>
    </section>
  )
}


