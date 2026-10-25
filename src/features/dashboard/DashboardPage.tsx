import { endOfMonth, startOfMonth, subMonths } from 'date-fns'
import { ArrowRight, Plus, Receipt, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { DatePicker } from '@/components/ui/DatePicker'
import { FilaHint, Hint } from '@/components/ui/Hint'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { diasEnRango, esMesCompleto, rangoAnterior, serieDiaria, variacion } from '@/domain/dashboard'
import { hayCruzados, paramsGastos, type ClaveFiltro } from '@/domain/filtrosCruzados'
import { resumirFondo, round2 } from '@/domain/fondos'
import { resumirPresupuesto } from '@/domain/presupuesto'
import { cn } from '@/lib/cn'
import { colorVar } from '@/lib/icons'
import { formatFecha, formatFechaLarga, formatMes, formatSoles, fromIso, toIso } from '@/lib/format'
import { opciones, useCatalogo } from '@/features/catalogo/useCatalogo'
import { finDeMes, mesDeFecha, usePeriodo } from '@/features/fondos/useFondos'
import { useEstadoLote, usePlantillas } from '@/features/gastos/usePlantillas'
import { usePerfil } from '@/features/perfil/usePerfil'
import { Dona, GraficoAcumulado, GraficoDiario, type PuntoGrafico, type SegmentoDona } from './Graficos'
import { PresupuestoConsolidado } from './PresupuestoConsolidado'
import { useDashboardPanel } from './useDashboard'
import { useFiltrosDashboard } from './useFiltrosDashboard'

const HOY = toIso(new Date())
const MES_ACTUAL = mesDeFecha(new Date())
const TIPOS = [{ value: 'fixed', label: 'Fijo', icon: 'repeat' }, { value: 'variable', label: 'Variable', icon: 'tag' }]

function Tarjeta({ titulo, descripcion, derecha, children, className, filtrada }: { titulo: string; descripcion?: string; derecha?: React.ReactNode; children: React.ReactNode; className?: string; filtrada?: boolean }) {
  return (
    <section aria-label={titulo} className={cn('flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-bold">{titulo}</h2>
            {filtrada && <Pill tone="pri">Filtrado</Pill>}
          </div>
          {descripcion && <p className="text-xs text-muted">{descripcion}</p>}
        </div>
        {derecha}
      </div>
      {children}
    </section>
  )
}

function Kpi({ etiqueta, valor, nota, tono, icono }: { etiqueta: string; valor: string; nota: string; tono?: 'ok' | 'bad'; icono?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-line bg-surface px-5 py-4">
      <span className="text-sm text-muted">{etiqueta}</span>
      <span className={cn('num flex items-center gap-2 text-2xl font-medium', tono === 'bad' && 'text-bad', tono === 'ok' && 'text-ok')}>{icono}{valor}</span>
      <span className="truncate text-xs text-muted">{nota}</span>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const catalogo = useCatalogo()
  const { filtros, seleccionar, fijarPeriodo, limpiar } = useFiltrosDashboard(catalogo)
  const { desde, hasta } = filtros
  const valido = desde <= hasta
  const ant = useMemo(() => rangoAnterior(desde, hasta), [desde, hasta])

  const perfil = usePerfil()
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'
  const panelQ = useDashboardPanel(filtros, ant, valido)
  const plantillasQ = usePlantillas()
  const periodoActual = usePeriodo(MES_ACTUAL)
  const loteQ = useEstadoLote(periodoActual.data?.id, MES_ACTUAL, finDeMes(MES_ACTUAL))

  const [topModo, setTopModo] = useState<'categorias' | 'subcategorias'>('categorias')
  const [hoverAmbito, setHoverAmbito] = useState<string | null>(null)

  const cargando = panelQ.isPending || catalogo.isPending
  const falla = panelQ.isError || catalogo.isError
  const actualizando = panelQ.isFetching && panelQ.isPlaceholderData
  const panel = panelQ.data

  const cruzados = hayCruzados(filtros)
  const hayFiltrosSerie = Boolean(filtros.ambito || filtros.categoria || filtros.subcategoria || filtros.medio || filtros.tipo)
  const total = Number(panel?.total ?? 0)
  const cantidad = Number(panel?.cantidad ?? 0)
  const totalPrev = Number(panel?.total_prev ?? 0)
  const presupuesto = panel?.presupuesto === null || panel?.presupuesto === undefined ? null : Number(panel.presupuesto)
  const etiquetaPeriodo = esMesCompleto(desde, hasta) ? formatMes(desde) : `${formatFecha(desde, formato)} – ${formatFecha(hasta, formato)}`

  // Serie diaria: el ritmo ideal solo es comparable con el acumulado cuando no hay filtros que reduzcan el conjunto.
  const serie: PuntoGrafico[] = useMemo(() => {
    const filas = panel?.serie ?? []
    const base = serieDiaria(filas.map((p) => ({ expense_date: p.fecha, amount: p.monto })), desde, hasta, HOY, hayFiltrosSerie ? null : presupuesto)
    const cant = new Map(filas.map((p) => [p.fecha, Number(p.cantidad)]))
    return base.map((p) => ({ ...p, cantidad: cant.get(p.fecha) ?? 0 }))
  }, [panel?.serie, desde, hasta, hayFiltrosSerie, presupuesto])

  const incluyeHoy = desde <= HOY && HOY <= hasta
  const proyeccion = incluyeHoy && HOY < hasta ? (serie.find((p) => p.fecha === hasta)?.proyeccion ?? null) : null
  const varPct = filtros.dia ? null : variacion(total, totalPrev)
  const dias = valido ? diasEnRango(desde, hasta) : 0

  const resumen = useMemo(
    () =>
      resumirPresupuesto({
        presupuesto,
        gastoRango: Number(panel?.gasto_rango ?? 0),
        imputado: Number(panel?.imputado_rango ?? 0),
        sinFondo: Number(panel?.sin_fondo ?? 0),
        excedente: Number(panel?.excedente ?? 0),
        fondos: (panel?.fondos ?? []).map((f) => ({ ...f, asignado: Number(f.asignado), consumido: Number(f.consumido), consumido_filtrado: Number(f.consumido_filtrado) })),
        total, cantidad, diasConGasto: Number(panel?.dias_con_gasto ?? 0), desde, hasta, hoy: HOY, hayFiltros: cruzados,
      }),
    [panel, presupuesto, total, cantidad, desde, hasta, cruzados],
  )

  const porAmbito = useMemo(() => (panel?.por_ambito ?? []).map((a) => ({ ...a, total: Number(a.total), cantidad: Number(a.cantidad) })), [panel?.por_ambito])
  const totalAmbitos = porAmbito.reduce((s, a) => s + a.total, 0)
  const segmentos: SegmentoDona[] = porAmbito.map((a) => {
    const amb = catalogo.ambitos.find((x) => x.id === a.id)
    return { id: a.id, nombre: amb?.name ?? 'Ámbito', valor: a.total, cantidad: a.cantidad, fill: colorVar(amb?.color_token) }
  })
  const listaTop = topModo === 'categorias' ? panel?.por_categoria : panel?.por_subcategoria
  const top = useMemo(() => (listaTop ?? []).slice(0, 5).map((t) => ({ ...t, total: Number(t.total), cantidad: Number(t.cantidad) })), [listaTop])
  const totalTop = useMemo(() => (listaTop ?? []).reduce((s, t) => s + Number(t.total), 0), [listaTop])
  const recientes = panel?.recientes ?? []
  const fondosLista = useMemo(() => [...(panel?.fondos ?? [])].sort((a, b) => Number(a.es_general) - Number(b.es_general) || a.prioridad - b.prioridad), [panel?.fondos])

  const pendientes = useMemo(() => {
    const activas = (plantillasQ.data ?? []).filter((p) => p.is_active)
    const reg = loteQ.data?.registradas ?? new Set<string>()
    return { activas: activas.length, pendientes: activas.filter((p) => !reg.has(p.id)).length }
  }, [plantillasQ.data, loteQ.data])

  const irAGastos = () => navigate(`/gastos?${paramsGastos(filtros)}`)

  // Chips de filtros activos con su nombre legible
  const nombreDe = (clave: ClaveFiltro, valor: string): string => {
    switch (clave) {
      case 'ambito': return catalogo.ambitos.find((x) => x.id === valor)?.name ?? 'Ámbito'
      case 'categoria': return catalogo.categorias.find((x) => x.id === valor)?.name ?? 'Categoría'
      case 'subcategoria': return catalogo.subcategorias.find((x) => x.id === valor)?.name ?? 'Subcategoría'
      case 'medio': return catalogo.medios.find((x) => x.id === valor)?.name ?? 'Medio'
      case 'tipo': return valor === 'fixed' ? 'Fijo' : 'Variable'
      default: return formatFecha(valor, formato)
    }
  }
  const ETIQUETAS: Record<ClaveFiltro, string> = { ambito: 'Ámbito', categoria: 'Categoría', subcategoria: 'Subcategoría', medio: 'Medio de pago', tipo: 'Tipo', dia: 'Día' }
  const chips = (['ambito', 'categoria', 'subcategoria', 'medio', 'tipo', 'dia'] as ClaveFiltro[]).filter((k) => filtros[k] !== '')

  const resumenGrafico = `Gasto acumulado de ${etiquetaPeriodo}${cruzados ? ' con filtros' : ''}: ${formatSoles(total)}${proyeccion !== null ? `, proyección de cierre ${formatSoles(proyeccion)} (estimación)` : ''}`
  const delDiaTexto = filtros.dia ? formatFechaLarga(filtros.dia) : ''

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-muted">{etiquetaPeriodo} · <span aria-live="polite">{cruzados ? 'con filtros activos' : 'todos los ámbitos y medios de pago'}</span></p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-44 flex-col gap-1.5"><label htmlFor="d-desde" className="text-sm font-medium">Desde</label><DatePicker id="d-desde" value={desde} onChange={(v) => fijarPeriodo(v, v > hasta ? v : hasta)} formato={formato} /></div>
          <div className="flex w-44 flex-col gap-1.5"><label htmlFor="d-hasta" className="text-sm font-medium">Hasta</label><DatePicker id="d-hasta" value={hasta} onChange={(v) => fijarPeriodo(v < desde ? v : desde, v)} formato={formato} /></div>
          <Button variant="secondary" onClick={() => fijarPeriodo(toIso(startOfMonth(fromIso(HOY))), toIso(endOfMonth(fromIso(HOY))))}>Este mes</Button>
          <Button variant="secondary" onClick={() => fijarPeriodo(toIso(startOfMonth(subMonths(fromIso(HOY), 1))), toIso(endOfMonth(subMonths(fromIso(HOY), 1))))}>Mes anterior</Button>
          <Button onClick={() => navigate('/gastos?nuevo=1')}><Plus className="size-4" aria-hidden="true" /> Registrar gasto</Button>
        </div>
      </div>

      {valido && !cargando && !falla && (
        <section aria-label="Filtros del dashboard" className="sticky top-2 z-30 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-sm">
          <div className="flex w-44 flex-col gap-1.5">
            <label htmlFor="f-dia" className="text-sm font-medium">Día</label>
            <DatePicker id="f-dia" value={filtros.dia} placeholder="Todo el período" min={desde} max={hasta} formato={formato} onChange={(v) => seleccionar('dia', v)} />
          </div>
          <div className="flex w-52 flex-col gap-1.5">
            <label htmlFor="f-medio-d" className="text-sm font-medium">Medio de pago</label>
            <Combobox id="f-medio-d" value={filtros.medio || null} clearable searchable={false} options={opciones(catalogo.medios, filtros.medio)} placeholder="Todos" onChange={(v) => seleccionar('medio', v ?? filtros.medio)} />
          </div>
          <div className="flex w-44 flex-col gap-1.5">
            <label htmlFor="f-tipo-d" className="text-sm font-medium">Tipo de gasto</label>
            <Combobox id="f-tipo-d" value={filtros.tipo || null} clearable searchable={false} options={TIPOS} placeholder="Todos" onChange={(v) => seleccionar('tipo', v ?? filtros.tipo)} />
          </div>
          <div className="flex min-w-[16rem] flex-1 flex-wrap items-center gap-2" aria-live="polite">
            {chips.length === 0 ? (
              <p className="text-sm text-muted">Selecciona un ámbito, un día o una categoría en los gráficos para filtrar todo el panel.</p>
            ) : (
              chips.map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-pri bg-pri-soft py-1 pl-3 pr-1 text-sm font-medium text-pri">
                  <span className="text-xs text-muted">{ETIQUETAS[k]}:</span> {nombreDe(k, filtros[k])}
                  <button type="button" aria-label={`Quitar filtro ${ETIQUETAS[k]}: ${nombreDe(k, filtros[k])}`} onClick={() => seleccionar(k, filtros[k])} className="grid size-6 place-items-center rounded-full hover:bg-surface">
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))
            )}
          </div>
          {cruzados && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={irAGastos}>Ver en Gastos <ArrowRight className="size-4" aria-hidden="true" /></Button>
              <Button variant="ghost" onClick={limpiar}><X className="size-4" aria-hidden="true" /> Limpiar filtros</Button>
            </div>
          )}
        </section>
      )}

      {!valido ? (
        <ErrorState message="La fecha inicial es posterior a la final. Ajusta el rango." />
      ) : cargando ? (
        <div role="status" aria-label="Cargando dashboard" className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          <Skeleton className="h-72" />
          <Skeleton className="h-96" />
          <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
        </div>
      ) : falla ? (
        <ErrorState message="No se pudieron cargar los datos del dashboard." onRetry={() => panelQ.refetch()} />
      ) : Number(panel?.gasto_rango ?? 0) === 0 && !cruzados ? (
        <EmptyState icon={Receipt} title="No hay gastos en este período" description="Registra un gasto o cambia el rango de fechas para ver tus gráficos."
          action={<div className="flex gap-2"><Button onClick={() => navigate('/gastos?nuevo=1')}>Registrar gasto</Button><Button variant="secondary" onClick={() => navigate('/gastos?lote=1')}>Registrar mensuales</Button></div>} />
      ) : (
        <div className={cn('flex flex-col gap-6 transition-opacity', actualizando && 'opacity-60')} aria-busy={actualizando}>
          <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi etiqueta={cruzados ? 'Gasto con filtros actuales' : 'Gasto del período'} valor={formatSoles(total)} nota={`${cantidad} movimientos · ${filtros.dia ? '1 día' : `${dias} días`}`} />
            <Kpi etiqueta="Movimientos" valor={String(cantidad)} nota={`${Number(panel?.dias_con_gasto ?? 0)} días con gasto`} />
            <Kpi
              etiqueta="Variación vs período anterior"
              valor={filtros.dia ? 'No aplica' : varPct === null ? 'Sin datos' : `${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}%`}
              tono={varPct === null ? undefined : varPct > 0 ? 'bad' : 'ok'}
              icono={varPct === null ? undefined : varPct > 0 ? <TrendingUp className="size-5" aria-hidden="true" /> : <TrendingDown className="size-5" aria-hidden="true" />}
              nota={filtros.dia ? 'Con un día seleccionado no hay comparación' : varPct === null ? 'No hay gasto comparable en el período anterior' : `${formatFecha(ant.desde, formato)} – ${formatFecha(ant.hasta, formato)}: ${formatSoles(totalPrev)}`}
            />
            <Kpi etiqueta="Mayor gasto" valor={panel?.mayor ? formatSoles(Number(panel.mayor.amount)) : '—'} nota={panel?.mayor ? `${panel.mayor.description} · ${formatFecha(panel.mayor.expense_date, formato)}` : 'Sin movimientos con los filtros'} />
          </section>

          <PresupuestoConsolidado r={resumen} etiquetaPeriodo={etiquetaPeriodo} />

          <Tarjeta titulo="Gasto acumulado" filtrada={hayFiltrosSerie} descripcion={`${etiquetaPeriodo} · día a día${hayFiltrosSerie ? ' · solo el gasto que cumple los filtros' : ''} · selecciona un día para filtrar`}>
            <div className="flex flex-wrap gap-2">
              <Pill tone="pri">{cruzados ? 'Con filtros' : 'Real'}: {formatSoles(total)}</Pill>
              {proyeccion !== null && <Pill tone="warn">Cierre proyectado (estimación): {formatSoles(proyeccion)}</Pill>}
              {presupuesto !== null && !hayFiltrosSerie && <Pill tone="neutral">Presupuesto: {formatSoles(presupuesto)}</Pill>}
            </div>
            <GraficoAcumulado serie={serie} formato={formato} dia={filtros.dia || null} onDia={(f) => seleccionar('dia', f)} mostrarIdeal={!hayFiltrosSerie && presupuesto !== null} resumen={resumenGrafico} />
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-[var(--c1)]" /> Gasto acumulado</span>
              {proyeccion !== null && <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed" style={{ borderColor: 'var(--c2)' }} /> Proyección de cierre</span>}
              {!hayFiltrosSerie && presupuesto !== null && <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dotted" style={{ borderColor: 'var(--muted)' }} /> Ritmo ideal</span>}
            </div>
            <div className="border-t border-line pt-3">
              <p className="mb-1 text-sm font-semibold">Gasto diario</p>
              <GraficoDiario serie={serie} formato={formato} dia={filtros.dia || null} onDia={(f) => seleccionar('dia', f)} />
            </div>
            {filtros.dia && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm" role="status">
                <p><b className="capitalize">{delDiaTexto}</b> · {cantidad} {cantidad === 1 ? 'movimiento' : 'movimientos'} · <span className="num">{formatSoles(total)}</span></p>
                <Button variant="ghost" onClick={() => seleccionar('dia', filtros.dia)}>Quitar día</Button>
              </div>
            )}
          </Tarjeta>

          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta titulo="Distribución por ámbito" filtrada={Boolean(filtros.categoria || filtros.subcategoria || filtros.medio || filtros.tipo || filtros.dia)} descripcion={`${etiquetaPeriodo} · selecciona un ámbito para filtrar todo el panel`}>
              {porAmbito.length === 0 ? <p className="text-sm text-muted">No hay gasto con estos filtros.</p> : (
                <div className="flex flex-wrap items-center gap-6">
                  <Dona datos={segmentos} total={totalAmbitos} seleccionado={filtros.ambito || null} onSeleccion={(id) => seleccionar('ambito', id)} hoverExterno={hoverAmbito} />
                  <ul className="flex min-w-48 flex-1 flex-col gap-1.5" aria-label="Ámbitos">
                    {porAmbito.map((a) => {
                      const amb = catalogo.ambitos.find((x) => x.id === a.id)
                      const sel = filtros.ambito === a.id
                      return (
                        <li key={a.id}>
                          <button
                            type="button"
                            aria-pressed={sel}
                            onClick={() => seleccionar('ambito', a.id)}
                            onMouseEnter={() => setHoverAmbito(a.id)}
                            onMouseLeave={() => setHoverAmbito(null)}
                            onFocus={() => setHoverAmbito(a.id)}
                            onBlur={() => setHoverAmbito(null)}
                            className={cn('flex w-full items-center gap-3 rounded-lg border border-transparent p-1.5 text-left transition-colors hover:bg-surface-2', sel && 'border-pri bg-pri-soft', filtros.ambito && !sel && 'opacity-60')}
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2"><ItemIcon name={amb?.icon_key} color={amb?.color_token} /></span>
                            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{amb?.name}</span><span className="block text-xs text-muted">{a.cantidad} {a.cantidad === 1 ? 'movimiento' : 'movimientos'}</span></span>
                            <span className="text-right"><span className="num block font-medium">{formatSoles(a.total)}</span><span className="num block text-xs text-muted">{totalAmbitos > 0 ? ((a.total / totalAmbitos) * 100).toFixed(1) : '0.0'}%</span></span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </Tarjeta>

            <Tarjeta
              titulo={`Top 5 ${topModo === 'categorias' ? 'categorías' : 'subcategorías'}`}
              filtrada={Boolean(filtros.ambito || filtros.medio || filtros.tipo || filtros.dia)}
              descripcion={`${etiquetaPeriodo} · selecciona una para filtrar todo el panel`}
              derecha={
                <div role="group" aria-label="Agrupar por" className="inline-flex rounded-lg bg-surface-2 p-0.5 text-sm font-semibold">
                  {(['categorias', 'subcategorias'] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={topModo === m} onClick={() => setTopModo(m)} className={cn('rounded-md px-3 py-1 transition-colors', topModo === m ? 'bg-surface text-pri shadow-sm' : 'text-muted')}>{m === 'categorias' ? 'Categorías' : 'Subcategorías'}</button>
                  ))}
                </div>
              }
            >
              {top.length === 0 ? <p className="text-sm text-muted">No hay gasto {topModo === 'subcategorias' ? 'con subcategoría ' : ''}con estos filtros.</p> : (
                <ul className="flex flex-col gap-1.5">
                  {top.map((t) => {
                    const cat = topModo === 'categorias' ? catalogo.categorias.find((c) => c.id === t.id) : null
                    const sub = topModo === 'subcategorias' ? catalogo.subcategorias.find((s) => s.id === t.id) : null
                    const item = cat ?? sub
                    const padreCat = cat ?? catalogo.categorias.find((c) => c.id === sub?.categoria_id)
                    const color = padreCat?.color_token ?? 'c1'
                    const sel = topModo === 'categorias' ? filtros.categoria === t.id : filtros.subcategoria === t.id
                    const hayEleccion = topModo === 'categorias' ? Boolean(filtros.categoria) : Boolean(filtros.subcategoria)
                    const ambNombre = catalogo.ambitos.find((a) => a.id === padreCat?.ambito_id)?.name
                    return (
                      <li key={t.id}>
                        <Hint
                          side="top"
                          contenido={
                            <div className="flex min-w-48 flex-col gap-0.5">
                              <p className="mb-1 font-display font-bold">{item?.name}{topModo === 'subcategorias' && padreCat ? <span className="font-normal text-muted"> · {padreCat.name}</span> : null}</p>
                              <FilaHint etiqueta="Importe" valor={formatSoles(t.total)} destacado />
                              <FilaHint etiqueta="Del gasto mostrado" valor={`${totalTop > 0 ? ((t.total / totalTop) * 100).toFixed(1) : '0.0'} %`} />
                              <FilaHint etiqueta="Movimientos" valor={t.cantidad} />
                            </div>
                          }
                        >
                          <button
                            type="button"
                            aria-pressed={sel}
                            onClick={() => seleccionar(topModo === 'categorias' ? 'categoria' : 'subcategoria', t.id)}
                            className={cn('flex w-full items-center gap-3 rounded-lg border border-transparent p-1.5 text-left transition-colors hover:bg-surface-2', sel && 'border-pri bg-pri-soft', hayEleccion && !sel && 'opacity-60')}
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2"><ItemIcon name={item?.icon_key} color={color} /></span>
                            <span className="w-24 shrink-0 sm:w-32"><span className="block truncate font-medium">{item?.name}</span><span className="block truncate text-xs text-muted">{topModo === 'categorias' ? ambNombre : padreCat?.name}</span></span>
                            <span className="h-3 min-w-8 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${(t.total / top[0].total) * 100}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${colorVar(color)} 55%, transparent), ${colorVar(color)})` }} /></span>
                            <span className="w-24 shrink-0 text-right sm:w-28"><span className="num block font-medium">{formatSoles(t.total)}</span><span className="num block text-xs text-muted">{totalTop > 0 ? ((t.total / totalTop) * 100).toFixed(1) : '0.0'}% · {t.cantidad} mov.</span></span>
                          </button>
                        </Hint>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Tarjeta>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Tarjeta titulo="Consumo de fondos" descripcion={presupuesto !== null ? 'Períodos que toca el rango' : undefined} derecha={<Link to="/fondos" className="text-sm font-medium text-pri underline">Ver fondos</Link>}>
              {fondosLista.length === 0 ? <p className="text-sm text-muted">Sin fondos activos.</p> : (
                <ul className="flex flex-col gap-3">
                  {fondosLista.map((f) => {
                    const r = resumirFondo(round2(Number(f.asignado)), round2(Number(f.consumido)))
                    const filtrado = Number(f.consumido_filtrado)
                    return (
                      <li key={f.fund_id}>
                        <div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{f.nombre}</span><span className={cn('num', r.disponible < 0 && 'text-bad')}>{formatSoles(r.disponible)}</span></div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`Consumo de ${f.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(r.pct))}>
                          <div className={cn('h-full rounded-full', r.estado === 'negativo' ? 'bg-bad' : r.estado === 'ok' ? 'bg-pri' : 'bg-acc')} style={{ width: `${Math.min(100, r.pct)}%` }} />
                        </div>
                        {cruzados && <p className="mt-0.5 text-xs text-muted">Con filtros actuales: <span className="num">{formatSoles(filtrado)}</span></p>}
                      </li>
                    )
                  })}
                </ul>
              )}
              {Number(panel?.excedente ?? 0) > 0 && <p className="rounded-lg bg-acc-soft px-3 py-2 text-sm text-warn">Excedente absorbido por el Fondo General: <b className="num">{formatSoles(Number(panel?.excedente ?? 0))}</b></p>}
            </Tarjeta>

            <Tarjeta titulo="Gastos recientes" filtrada={cruzados} derecha={<Link to={`/gastos?${paramsGastos(filtros)}`} className="text-sm font-medium text-pri underline">Ver todos</Link>}>
              {recientes.length === 0 ? <p className="text-sm text-muted">No hay movimientos con estos filtros.</p> : (
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
              )}
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
        </div>
      )}
    </div>
  )
}
