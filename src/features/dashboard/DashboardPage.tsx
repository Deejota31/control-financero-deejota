import { endOfMonth, startOfMonth, subMonths } from 'date-fns'
import { ArrowRight, Plus, Receipt, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { resumirFondo, round2 } from '@/domain/fondos'
import { diasEnRango, esMesCompleto, rangoAnterior, serieDiaria, total, variacion } from '@/domain/dashboard'
import { cn } from '@/lib/cn'
import { colorVar } from '@/lib/icons'
import { formatFecha, formatFechaLarga, formatMes, formatSoles, fromIso, toIso } from '@/lib/format'
import { useCatalogo } from '@/features/catalogo/useCatalogo'
import { finDeMes, mesDeFecha, usePeriodo } from '@/features/fondos/useFondos'
import { useGastosRango } from '@/features/gastos/useGastosRango'
import { useEstadoLote, usePlantillas } from '@/features/gastos/usePlantillas'
import { usePerfil } from '@/features/perfil/usePerfil'
import { Dona, GraficoAcumulado, GraficoDiario, type SegmentoDona } from './Graficos'
import { useResumenDashboard } from './useDashboard'

const HOY = toIso(new Date())
const MES_ACTUAL = mesDeFecha(new Date())
const INICIO = toIso(startOfMonth(new Date()))
const FIN = toIso(endOfMonth(new Date()))

function Tarjeta({ titulo, descripcion, derecha, children, className }: { titulo: string; descripcion?: string; derecha?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={titulo} className={cn('flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold">{titulo}</h2>
          {descripcion && <p className="text-xs text-muted">{descripcion}</p>}
        </div>
        {derecha}
      </div>
      {children}
    </section>
  )
}

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const desde = params.get('desde') ?? INICIO
  const hasta = params.get('hasta') ?? FIN
  const valido = desde <= hasta
  const ant = useMemo(() => rangoAnterior(desde, hasta), [desde, hasta])

  const perfil = usePerfil()
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'
  const catalogo = useCatalogo()
  // KPIs, series y distribuciones vienen agregados desde PostgreSQL: incluyen todos los gastos del rango.
  const resumenQ = useResumenDashboard(desde, hasta, ant, valido)
  const plantillasQ = usePlantillas()
  const periodoActual = usePeriodo(MES_ACTUAL)
  const loteQ = useEstadoLote(periodoActual.data?.id, MES_ACTUAL, finDeMes(MES_ACTUAL))

  const [diaSel, setDiaSel] = useState<string | null>(null)
  const [topModo, setTopModo] = useState<'categorias' | 'subcategorias'>('categorias')
  const delDiaQ = useGastosRango(diaSel ?? desde, diaSel ?? desde, { habilitado: Boolean(diaSel) })

  const consultas = [resumenQ, catalogo]
  const cargando = consultas.some((q) => q.isPending)
  const falla = consultas.some((q) => q.isError)

  const resumen = resumenQ.data
  const totalGasto = Number(resumen?.total ?? 0)
  const totalPrev = Number(resumen?.total_prev ?? 0)
  const cantidad = Number(resumen?.cantidad ?? 0)
  const presupuesto = resumen?.presupuesto === null || resumen?.presupuesto === undefined ? null : Number(resumen.presupuesto)

  const disponible = presupuesto === null ? null : round2(presupuesto - totalGasto)
  const serie = useMemo(
    () => serieDiaria((resumen?.serie ?? []).map((p) => ({ expense_date: p.fecha, amount: p.monto })), desde, hasta, HOY, presupuesto),
    [resumen?.serie, desde, hasta, presupuesto],
  )
  const dias = valido ? diasEnRango(desde, hasta) : 0
  const incluyeHoy = desde <= HOY && HOY <= hasta
  const proyeccion = incluyeHoy && HOY < hasta ? (serie.find((p) => p.fecha === hasta)?.proyeccion ?? null) : null
  const varPct = variacion(totalGasto, totalPrev)

  const porAmbito = useMemo(() => (resumen?.por_ambito ?? []).map((a) => ({ ...a, total: Number(a.total) })), [resumen?.por_ambito])
  const segmentos: SegmentoDona[] = porAmbito.map((a) => {
    const amb = catalogo.ambitos.find((x) => x.id === a.id)
    return { id: a.id, nombre: amb?.name ?? 'Ámbito', valor: a.total, fill: colorVar(amb?.color_token) }
  })
  const top = useMemo(
    () => (topModo === 'categorias' ? (resumen?.por_categoria ?? []) : (resumen?.por_subcategoria ?? [])).slice(0, 5).map((t) => ({ ...t, total: Number(t.total) })),
    [resumen?.por_categoria, resumen?.por_subcategoria, topModo],
  )
  const recientes = resumen?.recientes ?? []

  const fondosResumen = useMemo(
    () =>
      (resumen?.fondos ?? [])
        .map((f) => ({ fondo: { id: f.fund_id, name: f.nombre, is_general: f.es_general, priority: f.prioridad }, resumen: resumirFondo(round2(Number(f.asignado)), round2(Number(f.consumido))) }))
        .sort((a, b) => Number(a.fondo.is_general) - Number(b.fondo.is_general) || a.fondo.priority - b.fondo.priority),
    [resumen?.fondos],
  )
  const excedente = Number(resumen?.excedente ?? 0)

  const pendientes = useMemo(() => {
    const activas = (plantillasQ.data ?? []).filter((p) => p.is_active)
    const reg = loteQ.data?.registradas ?? new Set<string>()
    return { activas: activas.length, pendientes: activas.filter((p) => !reg.has(p.id)).length }
  }, [plantillasQ.data, loteQ.data])

  const irAGastos = (extra: Record<string, string>) => navigate(`/gastos?${new URLSearchParams({ desde, hasta, ...extra })}`)
  const setRango = (d: string, h: string) => { setDiaSel(null); setParams({ desde: d, hasta: h }, { replace: true }) }

  const etiquetaPeriodo = esMesCompleto(desde, hasta) ? formatMes(desde) : `${formatFecha(desde, formato)} – ${formatFecha(hasta, formato)}`
  const delDia = diaSel ? (delDiaQ.data ?? []) : []
  const resumenGrafico = `Gasto acumulado de ${etiquetaPeriodo}: ${formatSoles(totalGasto)}${proyeccion !== null ? `, proyección de cierre ${formatSoles(proyeccion)} (estimación)` : ''}`

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{etiquetaPeriodo} · todos los ámbitos y medios de pago</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-44 flex-col gap-1.5"><label htmlFor="d-desde" className="text-sm font-medium">Desde</label><DatePicker id="d-desde" value={desde} onChange={(v) => setRango(v, v > hasta ? v : hasta)} formato={formato} /></div>
          <div className="flex w-44 flex-col gap-1.5"><label htmlFor="d-hasta" className="text-sm font-medium">Hasta</label><DatePicker id="d-hasta" value={hasta} onChange={(v) => setRango(v < desde ? v : desde, v)} formato={formato} /></div>
          <Button variant="secondary" onClick={() => setRango(INICIO, FIN)}>Este mes</Button>
          <Button variant="secondary" onClick={() => setRango(toIso(startOfMonth(subMonths(fromIso(HOY), 1))), toIso(endOfMonth(subMonths(fromIso(HOY), 1))))}>Mes anterior</Button>
          <Button onClick={() => navigate('/gastos?nuevo=1')}><Plus className="size-4" aria-hidden="true" /> Registrar gasto</Button>
        </div>
      </div>

      {!valido ? (
        <ErrorState message="La fecha inicial es posterior a la final. Ajusta el rango." />
      ) : cargando ? (
        <div role="status" aria-label="Cargando dashboard" className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          <Skeleton className="h-96" />
          <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
        </div>
      ) : falla ? (
        <ErrorState message="No se pudieron cargar los datos del dashboard." onRetry={() => consultas.forEach((q) => q.refetch())} />
      ) : cantidad === 0 ? (
        <EmptyState icon={Receipt} title="No hay gastos en este período" description="Registra un gasto o cambia el rango de fechas para ver tus gráficos."
          action={<div className="flex gap-2"><Button onClick={() => navigate('/gastos?nuevo=1')}>Registrar gasto</Button><Button variant="secondary" onClick={() => navigate('/gastos?lote=1')}>Registrar mensuales</Button></div>} />
      ) : (
        <>
          <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi etiqueta="Presupuesto asignado" valor={presupuesto === null ? '—' : formatSoles(presupuesto)} nota={presupuesto === null ? 'Sin períodos abiertos en este rango' : 'Suma de fondos activos'} />
            <Kpi etiqueta="Gasto del período" valor={formatSoles(totalGasto)} nota={`${cantidad} movimientos · ${dias} días`} />
            <Kpi etiqueta="Disponible" valor={disponible === null ? '—' : formatSoles(disponible)} tono={disponible !== null && disponible < 0 ? 'bad' : 'ok'} nota={disponible === null ? '' : disponible < 0 ? 'Presupuesto superado' : 'Presupuesto menos gasto'} />
            <Kpi
              etiqueta="Variación vs período anterior"
              valor={varPct === null ? 'Sin datos' : `${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}%`}
              tono={varPct === null ? undefined : varPct > 0 ? 'bad' : 'ok'}
              icono={varPct === null ? undefined : varPct > 0 ? <TrendingUp className="size-5" aria-hidden="true" /> : <TrendingDown className="size-5" aria-hidden="true" />}
              nota={varPct === null ? 'No hay gasto en el período anterior' : `${formatFecha(ant.desde, formato)} – ${formatFecha(ant.hasta, formato)}: ${formatSoles(totalPrev)}`}
            />
          </section>

          <Tarjeta titulo="Gasto acumulado" descripcion={`${etiquetaPeriodo} · día a día · selecciona un día para ver sus movimientos`}>
            <div className="flex flex-wrap gap-2">
              <Pill tone="pri">Real: {formatSoles(totalGasto)}</Pill>
              {proyeccion !== null && <Pill tone="warn">Cierre proyectado (estimación): {formatSoles(proyeccion)}</Pill>}
              {presupuesto !== null && <Pill tone="neutral">Presupuesto: {formatSoles(presupuesto)}</Pill>}
            </div>
            <GraficoAcumulado serie={serie} formato={formato} seleccionado={diaSel} onSeleccion={setDiaSel} resumen={resumenGrafico} />
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-[var(--c1)]" /> Gasto real acumulado</span>
              {proyeccion !== null && <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed" style={{ borderColor: 'var(--c2)' }} /> Proyección de cierre</span>}
              {presupuesto !== null && <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dotted" style={{ borderColor: 'var(--muted)' }} /> Ritmo ideal</span>}
            </div>
            <div className="border-t border-line pt-3">
              <p className="mb-1 text-sm font-semibold">Gasto diario</p>
              <GraficoDiario serie={serie} formato={formato} seleccionado={diaSel} onSeleccion={setDiaSel} />
            </div>
            {diaSel && (
              <div className="rounded-md bg-surface-2 p-3 text-sm" role="status">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p><b className="capitalize">{formatFechaLarga(diaSel)}</b> · {delDia.length} {delDia.length === 1 ? 'movimiento' : 'movimientos'} · <span className="num">{formatSoles(total(delDia))}</span></p>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => navigate(`/gastos?${new URLSearchParams({ desde: diaSel, hasta: diaSel })}`)}>Ver en Gastos <ArrowRight className="size-4" aria-hidden="true" /></Button>
                    <Button variant="ghost" onClick={() => setDiaSel(null)}>Quitar selección</Button>
                  </div>
                </div>
                {delDia.length > 0 && <ul className="mt-2 flex flex-col gap-0.5">{delDia.slice(0, 5).map((g) => <li key={g.id} className="flex justify-between"><span className="truncate">{g.description}</span><span className="num">{formatSoles(Number(g.amount))}</span></li>)}</ul>}
              </div>
            )}
          </Tarjeta>

          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta titulo="Distribución por ámbito" descripcion={`${etiquetaPeriodo} · selecciona un ámbito para filtrar Gastos`}>
              <div className="flex flex-wrap items-center gap-5">
                <Dona datos={segmentos} total={totalGasto} onSegmento={(id) => irAGastos({ ambito: id })} />
                <ul className="flex min-w-48 flex-1 flex-col gap-2.5">
                  {porAmbito.map((a) => {
                    const amb = catalogo.ambitos.find((x) => x.id === a.id)
                    return (
                      <li key={a.id}>
                        <button type="button" onClick={() => irAGastos({ ambito: a.id })} className="flex w-full items-center gap-3 rounded-md p-1 text-left hover:bg-surface-2">
                          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2"><ItemIcon name={amb?.icon_key} color={amb?.color_token} /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{amb?.name}</span><span className="block text-xs text-muted">{a.cantidad} {a.cantidad === 1 ? 'movimiento' : 'movimientos'}</span></span>
                          <span className="text-right"><span className="num block font-medium">{formatSoles(a.total)}</span><span className="num block text-xs text-muted">{((a.total / totalGasto) * 100).toFixed(1)}%</span></span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Tarjeta>

            <Tarjeta titulo={`Top 5 ${topModo === 'categorias' ? 'categorías' : 'subcategorías'}`} descripcion={`${etiquetaPeriodo} · mismos filtros que el resto del panel`}
              derecha={
                <div role="group" aria-label="Agrupar por" className="inline-flex rounded-md bg-surface-2 p-0.5 text-sm font-semibold">
                  {(['categorias', 'subcategorias'] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={topModo === m} onClick={() => setTopModo(m)} className={cn('rounded px-3 py-1', topModo === m ? 'bg-surface text-pri shadow-sm' : 'text-muted')}>{m === 'categorias' ? 'Categorías' : 'Subcategorías'}</button>
                  ))}
                </div>
              }>
              {top.length === 0 ? <p className="text-sm text-muted">No hay gastos con subcategoría en este período.</p> : (
                <ul className="flex flex-col gap-3">
                  {top.map((t) => {
                    const cat = topModo === 'categorias' ? catalogo.categorias.find((c) => c.id === t.id) : null
                    const sub = topModo === 'subcategorias' ? catalogo.subcategorias.find((s) => s.id === t.id) : null
                    const item = cat ?? sub
                    const color = cat ? cat.color_token : (catalogo.categorias.find((c) => c.id === sub?.categoria_id)?.color_token ?? 'c1')
                    return (
                      <li key={t.id}>
                        <button type="button" onClick={() => irAGastos(topModo === 'categorias' ? { categoria: t.id } : { categoria: sub!.categoria_id, subcategoria: t.id })} className="flex w-full items-center gap-3 rounded-md p-1 text-left hover:bg-surface-2">
                          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2"><ItemIcon name={item?.icon_key} color={color} /></span>
                          <span className="w-24 shrink-0 sm:w-32"><span className="block truncate font-medium">{item?.name}</span><span className="block truncate text-xs text-muted">{cat ? catalogo.ambitos.find((a) => a.id === cat.ambito_id)?.name : catalogo.categorias.find((c) => c.id === sub?.categoria_id)?.name}</span></span>
                          <span className="h-3 min-w-8 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${(t.total / top[0].total) * 100}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${colorVar(color)} 55%, transparent), ${colorVar(color)})` }} /></span>
                          <span className="w-24 shrink-0 text-right sm:w-28"><span className="num block font-medium">{formatSoles(t.total)}</span><span className="num block text-xs text-muted">{((t.total / totalGasto) * 100).toFixed(1)}% · {t.cantidad} mov.</span></span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Tarjeta>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Tarjeta titulo="Consumo de fondos" descripcion={presupuesto !== null ? 'Períodos que toca el rango' : undefined} derecha={<Link to="/fondos" className="text-sm font-medium text-pri underline">Ver fondos</Link>} className="lg:col-span-1">
              {fondosResumen.length === 0 ? <p className="text-sm text-muted">Sin fondos activos.</p> : (
                <ul className="flex flex-col gap-3">
                  {fondosResumen.map(({ fondo, resumen }) => (
                    <li key={fondo.id}>
                      <div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{fondo.name}</span><span className={cn('num', resumen.disponible < 0 && 'text-bad')}>{formatSoles(resumen.disponible)}</span></div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`Consumo de ${fondo.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(resumen.pct))}>
                        <div className={cn('h-full rounded-full', resumen.estado === 'negativo' ? 'bg-bad' : resumen.estado === 'ok' ? 'bg-pri' : 'bg-acc')} style={{ width: `${Math.min(100, resumen.pct)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {excedente > 0 && <p className="rounded-md bg-acc-soft px-3 py-2 text-sm text-warn">Excedente absorbido por el Fondo General: <b className="num">{formatSoles(excedente)}</b></p>}
            </Tarjeta>

            <Tarjeta titulo="Gastos recientes" derecha={<Link to={`/gastos?${new URLSearchParams({ desde, hasta })}`} className="text-sm font-medium text-pri underline">Ver todos</Link>}>
              <ul className="divide-y divide-line">
                {recientes.map((g) => {
                  const cat = catalogo.categorias.find((c) => c.id === g.categoria_id)
                  return (
                    <li key={g.id} className="flex items-center gap-3 py-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2"><ItemIcon name={cat?.icon_key} color={cat?.color_token} /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{g.description}</span><span className="block text-xs text-muted">{formatFecha(g.expense_date, formato)} · {cat?.name}</span></span>
                      <span className="num text-sm font-medium">{formatSoles(Number(g.amount))}</span>
                    </li>
                  )
                })}
              </ul>
            </Tarjeta>

            <Tarjeta titulo="Gastos mensuales" descripcion={`Plantillas de ${formatMes(MES_ACTUAL)}`}>
              {pendientes.activas === 0 ? (
                <p className="text-sm text-muted">Aún no tienes plantillas. Crea una para registrar tus gastos fijos en un paso.</p>
              ) : pendientes.pendientes > 0 ? (
                <p className="text-sm"><b>{pendientes.pendientes}</b> de {pendientes.activas} plantillas pendientes de registrar este mes.</p>
              ) : (
                <p className="text-sm text-ok">Todas las plantillas de este mes ya están registradas.</p>
              )}
              <Button variant="secondary" onClick={() => navigate('/gastos?lote=1')} className="w-fit">Registrar mensuales</Button>
            </Tarjeta>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ etiqueta, valor, nota, tono, icono }: { etiqueta: string; valor: string; nota: string; tono?: 'ok' | 'bad'; icono?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-5 py-4">
      <span className="text-sm text-muted">{etiqueta}</span>
      <span className={cn('num flex items-center gap-2 text-2xl font-medium', tono === 'bad' && 'text-bad', tono === 'ok' && 'text-ok')}>{icono}{valor}</span>
      <span className="text-xs text-muted">{nota}</span>
    </div>
  )
}
