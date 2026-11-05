import { ArrowLeftRight, ArrowRight, Minus, Receipt, TrendingDown, TrendingUp, Trophy, Wallet, X } from 'lucide-react'
import { useMemo, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router'
import { claseAcento, IconoAcento, type Acento } from '@/components/ui/Acento'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { diasEnRango, esMesCompleto, rangoComparable, serieDiaria, variacion } from '@/domain/dashboard'
import { sumar } from '@/domain/dinero'
import { hayCruzados, paramsGastos } from '@/domain/filtrosCruzados'
import { resumirPresupuesto } from '@/domain/presupuesto'
import { cn } from '@/lib/cn'
import { colorVar } from '@/lib/icons'
import { formatFecha, formatFechaLarga, formatMes, formatSoles } from '@/lib/format'
import { agruparPorNombre, idsDe, valorDeGrupo } from '@/domain/idsFiltro'
import { opciones, opcionesAgrupadas, useCatalogo } from '@/features/catalogo/useCatalogo'
import { useRegistroGasto } from '@/features/gastos/RegistroGasto'
import { usePerfil } from '@/features/perfil/usePerfil'
import { Dona, GraficoAcumulado, GraficoDiario, type PuntoGrafico, type SegmentoDona } from './Graficos'
import { PresupuestoConsolidado } from './PresupuestoConsolidado'
import { RankingTendencia } from './Ranking'
import { Tarjeta } from './Tarjeta'
import { BarraFiltros, CeldaFiltro } from '@/components/ui/BarraFiltros'
import { FiltroFecha } from '@/components/ui/FiltroFecha'
import { useHoy } from '@/features/fondos/useHoy'
import { useDashboardPanel } from './useDashboard'
import { useProyeccion } from './useProyeccion'
import { useFiltrosDashboard } from './useFiltrosDashboard'

const TIPOS = [{ value: 'fixed', label: 'Fijo', icon: 'repeat' }, { value: 'variable', label: 'Variable', icon: 'tag' }]

/** Indicador con acento: tinte muy suave, ícono en superficie coloreada y el importe como protagonista. */
function Kpi({ etiqueta, valor, nota, tono, icono, acento }: { etiqueta: string; valor: string; nota: string; tono?: 'ok' | 'bad'; icono: ComponentType<{ className?: string }>; acento: Acento }) {
  return (
    <div className={cn(claseAcento(acento), 'relative flex min-w-0 flex-col gap-1 rounded-2xl border border-[var(--a-bd)] bg-gradient-to-br from-[var(--a-soft)] to-surface px-5 py-4 pr-16')}>
      <span className="text-sm font-medium text-muted">{etiqueta}</span>
      <span className={cn('num truncate font-semibold leading-tight', valor.length > 10 ? 'text-xl' : 'text-[1.7rem]', tono === 'bad' && 'text-bad', tono === 'ok' && 'text-ok')}>{valor}</span>
      <span className="truncate text-xs text-muted">{nota}</span>
      <IconoAcento icono={icono} acento={acento} size="md" className="absolute right-4 top-4" />
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { abrir: abrirNuevo } = useRegistroGasto()
  const catalogo = useCatalogo()
  const { filtros, seleccionar, fijarPeriodo, limpiar } = useFiltrosDashboard(catalogo)
  const { desde, hasta } = filtros
  const valido = desde <= hasta

  const perfil = usePerfil()
  const hoyZona = useHoy()
  // Mientras el rango sigue en curso se compara el MISMO TRAMO del período anterior (no el período completo contra 4 días).
  const comp = useMemo(() => rangoComparable(desde, hasta, hoyZona), [desde, hasta, hoyZona])
  const ant = comp.anterior
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'
  const panelQ = useDashboardPanel(filtros, ant, valido)

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
  // Proyección de cierre: modelo ajustado (docs/proyeccion.md). Solo para un mes completo en curso; con otros rangos no se proyecta.
  const filtrosProy = useMemo(() => ({ ambito: filtros.ambito, categoria: filtros.categoria, subcategoria: filtros.subcategoria, medio: filtros.medio, tipo: filtros.tipo }), [filtros.ambito, filtros.categoria, filtros.subcategoria, filtros.medio, filtros.tipo])
  const proyHabilitada = valido && esMesCompleto(desde, hasta) && hoyZona >= desde && hoyZona < hasta
  const { proyeccion: proy } = useProyeccion({ habilitado: proyHabilitada, desde, hasta, hoy: hoyZona, filtros: filtrosProy, presupuesto: hayFiltrosSerie ? null : presupuesto })
  const cierre = proy?.ajustada ?? null

  const serie: PuntoGrafico[] = useMemo(() => {
    const filas = panel?.serie ?? []
    const base = serieDiaria(filas.map((p) => ({ expense_date: p.fecha, amount: p.monto })), desde, hasta, hoyZona, hayFiltrosSerie ? null : presupuesto, cierre)
    const cant = new Map(filas.map((p) => [p.fecha, Number(p.cantidad)]))
    return base.map((p) => ({ ...p, cantidad: cant.get(p.fecha) ?? 0 }))
  }, [panel?.serie, desde, hasta, hoyZona, hayFiltrosSerie, presupuesto, cierre])

  const proyeccion = cierre
  // Variación: gasto del tramo comparable (hasta el corte) frente a su equivalente anterior.
  const totalTramo = useMemo(() => sumar((panel?.serie ?? []).filter((p) => p.fecha <= comp.corte).map((p) => p.monto)), [panel?.serie, comp.corte])
  const varPct = filtros.dia || !comp.comparable ? null : variacion(totalTramo, totalPrev)
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
        total, cantidad, diasConGasto: Number(panel?.dias_con_gasto ?? 0), desde, hasta, hoy: hoyZona, hayFiltros: cruzados,
      }),
    [panel, presupuesto, total, cantidad, desde, hasta, hoyZona, cruzados],
  )

  const porAmbito = useMemo(() => (panel?.por_ambito ?? []).map((a) => ({ ...a, total: Number(a.total), cantidad: Number(a.cantidad) })), [panel?.por_ambito])
  const totalAmbitos = porAmbito.reduce((s, a) => s + a.total, 0)
  const segmentos: SegmentoDona[] = porAmbito.map((a) => {
    const amb = catalogo.ambitos.find((x) => x.id === a.id)
    return { id: a.id, nombre: amb?.name ?? 'Ámbito', valor: a.total, cantidad: a.cantidad, fill: colorVar(amb?.color_css) }
  })
  const irAGastos = () => navigate(`/gastos?${paramsGastos(filtros)}`)


  const resumenGrafico = `Gasto acumulado de ${etiquetaPeriodo}${cruzados ? ' con filtros' : ''}: ${formatSoles(total)}${proyeccion !== null ? `, cierre estimado ${formatSoles(proyeccion)} (estimación${proy?.confiabilidad === 'preliminar' ? ' preliminar' : ''})` : ''}`
  const delDiaTexto = filtros.dia ? formatFechaLarga(filtros.dia) : ''

  const categoriasOpc = catalogo.categorias.filter((c) => !filtros.ambito || c.ambito_id === filtros.ambito)
  const catsElegidas = idsDe(filtros.categoria)
  const subcategoriasOpc = catalogo.subcategorias.filter((s) => (catsElegidas.length ? catsElegidas.includes(s.categoria_id) : categoriasOpc.some((c) => c.id === s.categoria_id)))
  // Una opción por nombre: elegir «Alimentación» filtra todas las clasificaciones con ese nombre (ver domain/idsFiltro).
  const gruposCat = agruparPorNombre(categoriasOpc, filtros.categoria)
  const gruposSub = agruparPorNombre(subcategoriasOpc, filtros.subcategoria)

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{etiquetaPeriodo} · <span aria-live="polite">{cruzados ? 'con filtros activos' : 'todos los ámbitos y medios de pago'}</span></p>
        {cruzados && valido && <Button variant="secondary" onClick={irAGastos}>Ver en Gastos <ArrowRight className="size-4" aria-hidden="true" /></Button>}
      </div>

      {/* Banda pegajosa: ocupa todo el ancho útil del contenido y cubre el hueco de arriba y de los lados con el fondo de la página, así las tarjetas nunca se asoman por
          encima ni por los lados del filtro. Empieza en top-0 (sin valores sueltos) y respeta el área segura superior de iOS. */}
      <div className="sticky top-0 z-30 -mx-4 -mt-1 bg-bg px-4 pb-2 pt-[max(0.25rem,env(safe-area-inset-top))] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <BarraFiltros etiqueta="Filtros del dashboard" contador={[filtros.medio, filtros.ambito, filtros.categoria, filtros.subcategoria, filtros.tipo].filter(Boolean).length}
        acciones={<Button variant="ghost" aria-label="Limpiar filtros" title="Limpiar filtros" disabled={!cruzados} onClick={limpiar} className="shrink-0 px-2.5"><X className="size-4" aria-hidden="true" /></Button>}>
        <CeldaFiltro peso={1.4} min="16rem" completa><FiltroFecha modo="rango" desde={desde} hasta={hasta} formato={formato} hoy={hoyZona} onAplicar={fijarPeriodo} /></CeldaFiltro>
        <CeldaFiltro peso={1.2} min="9.5rem"><Combobox id="f-medio-d" aria-label="Medio de pago" value={filtros.medio || null} clearable searchable={false} options={opciones(catalogo.medios, filtros.medio)} placeholder="Medio de pago" onChange={(v) => seleccionar('medio', v ?? filtros.medio)} /></CeldaFiltro>
        <CeldaFiltro peso={0.8} min="6.5rem"><Combobox id="f-ambito" aria-label="Ámbito" value={filtros.ambito || null} clearable searchable={false} options={opciones(catalogo.ambitos, filtros.ambito)} placeholder="Ámbito" onChange={(v) => seleccionar('ambito', v ?? filtros.ambito)} /></CeldaFiltro>
        <CeldaFiltro peso={1} min="8rem"><Combobox id="f-categoria" aria-label="Categoría" value={valorDeGrupo(gruposCat, filtros.categoria)} clearable searchable={false} options={opcionesAgrupadas(categoriasOpc, filtros.categoria)} placeholder="Categoría" onChange={(v) => seleccionar('categoria', v ?? filtros.categoria)} /></CeldaFiltro>
        <CeldaFiltro peso={1.05} min="8.5rem"><Combobox id="f-subcategoria" aria-label="Subcategoría" value={valorDeGrupo(gruposSub, filtros.subcategoria)} clearable searchable={false} options={opcionesAgrupadas(subcategoriasOpc, filtros.subcategoria)} placeholder="Subcategoría" onChange={(v) => seleccionar('subcategoria', v ?? filtros.subcategoria)} /></CeldaFiltro>
        <CeldaFiltro peso={0.7} min="6rem"><Combobox id="f-tipo-d" aria-label="Tipo de gasto" value={filtros.tipo || null} clearable searchable={false} options={TIPOS} placeholder="Tipo" onChange={(v) => seleccionar('tipo', v ?? filtros.tipo)} /></CeldaFiltro>
      </BarraFiltros>
      </div>

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
        catalogo.ambitos.length === 0 ? (
          <EmptyState icon={Receipt} title="Empieza configurando tu catálogo"
            description="Aún no hay datos. Crea tus ámbitos, categorías y medios de pago, luego tus fondos con su presupuesto y, por último, registra tu primer gasto. Aquí verás tus indicadores cuando existan."
            action={<div className="flex gap-2"><Button onClick={() => navigate('/catalogo')}>Ir al Catálogo</Button><Button variant="secondary" onClick={() => navigate('/fondos')}>Ir a Fondos</Button></div>} />
        ) : (
          <EmptyState icon={Receipt} title="No hay gastos en este período" description="Registra un gasto o cambia el rango de fechas para ver tus gráficos."
            action={<div className="flex gap-2"><Button onClick={abrirNuevo}>Registrar gasto</Button><Button variant="secondary" onClick={() => navigate('/gastos?lote=1')}>Registrar mensuales</Button></div>} />
        )
      ) : (
        <div className={cn('flex flex-col gap-6 transition-opacity', actualizando && 'opacity-60')} aria-busy={actualizando}>
          <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi acento="indigo" icono={Wallet} etiqueta={cruzados ? 'Gasto con filtros actuales' : 'Gasto del período'} valor={formatSoles(total)} nota={`${cantidad} movimientos · ${filtros.dia ? '1 día' : `${dias} días`}`} />
            <Kpi acento="sky" icono={ArrowLeftRight} etiqueta="Movimientos" valor={String(cantidad)} nota={`${Number(panel?.dias_con_gasto ?? 0)} días con gasto`} />
            <Kpi
              acento={varPct === null ? 'slate' : varPct > 0 ? 'red' : 'green'}
              icono={varPct === null ? Minus : varPct > 0 ? TrendingUp : TrendingDown}
              etiqueta="Variación vs período anterior"
              valor={filtros.dia ? 'No aplica' : !comp.comparable ? 'Sin comparación' : varPct === null ? 'Sin base comparable' : `${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}%`}
              tono={varPct === null ? undefined : varPct > 0 ? 'bad' : 'ok'}
              nota={filtros.dia ? 'Con un día seleccionado no hay comparación' : !comp.comparable ? 'El período aún no empieza' : varPct === null ? 'El período anterior no tiene gasto con qué comparar' : comp.parcial ? `Mismo tramo anterior (${formatFecha(ant.desde, formato)} – ${formatFecha(ant.hasta, formato)}): ${formatSoles(totalPrev)}` : `Período anterior: ${formatSoles(totalPrev)}`}
            />
            <Kpi acento="amber" icono={Trophy} etiqueta="Mayor gasto" valor={panel?.mayor ? formatSoles(Number(panel.mayor.amount)) : '—'} nota={panel?.mayor ? `${panel.mayor.description} · ${formatFecha(panel.mayor.expense_date, formato)}` : 'Sin movimientos con los filtros'} />
          </section>

          <PresupuestoConsolidado r={resumen} etiquetaPeriodo={etiquetaPeriodo} />

          <Tarjeta titulo="Gasto acumulado" filtrada={hayFiltrosSerie} descripcion={`${etiquetaPeriodo} · día a día${hayFiltrosSerie ? ' · solo el gasto que cumple los filtros' : ''} · selecciona un día para filtrar`}>
            <div className="flex flex-wrap gap-2">
              <Pill tone="pri">{cruzados ? 'Con filtros' : 'Real'}: {formatSoles(total)}</Pill>
              {proy?.aplicable && proyeccion !== null && <Pill tone="warn">Cierre estimado{proy.confiabilidad === 'preliminar' ? ' (preliminar)' : ''}: {formatSoles(proyeccion)}</Pill>}
              {proy?.aplicable && proyeccion === null && <Pill tone="neutral">Proyección: datos insuficientes</Pill>}
              {presupuesto !== null && !hayFiltrosSerie && <Pill tone="neutral">Presupuesto: {formatSoles(presupuesto)}</Pill>}
            </div>
            {proy?.aplicable && (
              <div role="note" className="flex flex-col gap-1 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                {proy.motivo && <p>{proy.motivo}{proy.lineal !== null && <> Referencia lineal, <b>no fiable</b>: <span className="num">{formatSoles(proy.lineal)}</span> (promedio de los días transcurridos × días del mes).</>}</p>}
                {proy.modelo && <p><b>Modelo:</b> {proy.modelo}. Es una estimación, no una predicción exacta.</p>}
                {proy.advertencias.map((a) => <p key={a}>{a}</p>)}
              </div>
            )}
            <GraficoAcumulado serie={serie} formato={formato} dia={filtros.dia || null} onDia={(f) => seleccionar('dia', f)} mostrarIdeal={!hayFiltrosSerie && presupuesto !== null} resumen={resumenGrafico} />
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-[var(--chart-series-1)]" /> Gasto acumulado</span>
              {proyeccion !== null && <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed" style={{ borderColor: 'var(--chart-series-5)' }} /> Cierre estimado (modelo ajustado)</span>}
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
                <div className="my-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                  {/* La dona mide lo que mide (12 rem) y no se estira; la leyenda se queda con el resto y, si no cabe a su lado con 14 rem, baja debajo de ella. */}
                  <div className="flex shrink-0 justify-center"><Dona datos={segmentos} total={totalAmbitos} seleccionado={filtros.ambito || null} onSeleccion={(id) => seleccionar('ambito', id)} hoverExterno={hoverAmbito} /></div>
                  <ul className="flex min-w-56 flex-1 basis-56 flex-col gap-1.5" aria-label="Ámbitos">
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
                            className={cn('flex w-full items-center gap-2 rounded-lg border border-transparent p-1.5 text-left sm:gap-3 transition-colors hover:bg-surface-2', sel && 'border-pri bg-pri-soft', filtros.ambito && !sel && 'opacity-60')}
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2"><ItemIcon name={amb?.icon_key} color={amb?.color_css} /></span>
                            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{amb?.name}</span><span className="block truncate text-xs text-muted">{a.cantidad} {a.cantidad === 1 ? 'movimiento' : 'movimientos'}</span></span>
                            <span className="text-right"><span className="num block font-medium">{formatSoles(a.total)}</span><span className="num block text-xs text-muted">{totalAmbitos > 0 ? ((a.total / totalAmbitos) * 100).toFixed(1) : '0.0'}%</span></span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </Tarjeta>

            <RankingTendencia catalogo={catalogo} filtros={filtros} hoy={hoyZona} seleccionar={seleccionar} />
          </div>
        </div>
      )}
    </div>
  )
}
