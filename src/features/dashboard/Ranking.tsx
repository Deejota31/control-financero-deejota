import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Hint } from '@/components/ui/Hint'
import { TooltipGrafico, TTAlerta, TTBarra, TTCabecera, TTHistorial, TTMetrica, TTPie, TTPrincipal } from '@/components/ui/TooltipGrafico'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { ranking, textoVariacion, type Dim, type FilaAnalisis, type FiltrosAnalisis } from '@/domain/analisis'
import type { ClaveFiltro } from '@/domain/filtrosCruzados'
import { cn } from '@/lib/cn'
import { formatSoles, formatSolesCorto } from '@/lib/format'
import { colorVar } from '@/lib/icons'
import { supabase } from '@/lib/supabase'
import type { Catalogo } from '@/features/catalogo/useCatalogo'
import { Tarjeta } from './Tarjeta'

interface DatosRanking { actual: FilaAnalisis[]; historico: FilaAnalisis[] }

/** Filas agregadas del ranking (una consulta; los filtros cruzados se aplican en el cliente para que el ranking excluya su propia dimensión). */
export function useDatosRanking(desde: string, hasta: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'analisis', desde, hasta],
    enabled: habilitado,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('dashboard_analisis', { p_desde: desde, p_hasta: hasta }).abortSignal(signal)
      if (error) throw error
      return data as unknown as DatosRanking
    },
  })
}

interface Props {
  catalogo: Catalogo
  filtros: FiltrosAnalisis & { desde: string; hasta: string }
  hoy: string
  seleccionar: (clave: ClaveFiltro, valor: string) => void
}

const DIMS: { v: Dim; l: string }[] = [{ v: 'ambito', l: 'Ámbito' }, { v: 'categoria', l: 'Categoría' }, { v: 'subcategoria', l: 'Subcategoría' }, { v: 'medio', l: 'Medio' }]

/** Elige por qué se agrupa el ranking. */
function Chips({ dim, setDim }: { dim: Dim; setDim: (d: Dim) => void }) {
  return (
    <div role="group" aria-label="Agrupar por" className="flex flex-wrap gap-1">
      {DIMS.map((d) => <button key={d.v} type="button" aria-pressed={dim === d.v} onClick={() => setDim(d.v)} className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors', dim === d.v ? 'border-pri bg-pri-soft text-pri' : 'border-line text-muted hover:bg-surface-2')}>{d.l}</button>)}
    </div>
  )
}

function Spark({ v, color }: { v: number[]; color: string }) {
  const max = Math.max(1, ...v), pts = v.map((x, i) => `${(i * 40) / 5 + 2},${16 - (x / max) * 13}`).join(' ')
  return <svg viewBox="0 0 44 18" className="h-4 w-10 shrink-0" aria-hidden="true"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx={v.length ? 38 : 0} cy={16 - (v[5] / max) * 13} r="2" fill={color} /></svg>
}

const mesCorto = (iso: string) => new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)).replace('.', '')

/**
 * Ranking con tendencia: los cinco mayores grupos del período con su tendencia de seis meses. Comparte los filtros cruzados del Dashboard: cursor o foco
 * muestran el detalle en una tarjeta flotante; clic o toque selecciona y filtra todo el panel. No se abre ninguna modal al seleccionar.
 */
export function RankingTendencia({ catalogo, filtros, hoy, seleccionar }: Props) {
  const q = useDatosRanking(filtros.desde, filtros.hasta, filtros.desde <= filtros.hasta)
  const [dim, setDim] = useState<Dim>('categoria')

  const nombres = useMemo(() => {
    const m = (xs: { id: string; name: string; icon_key: string; color_css?: string }[]) => new Map(xs.map((x) => [x.id, x]))
    return { ambito: m(catalogo.ambitos), categoria: m(catalogo.categorias), subcategoria: m(catalogo.subcategorias), medio: m(catalogo.medios) }
  }, [catalogo])
  const info = (d: Dim, id: string) => nombres[d].get(id)
  /** Contexto de un elemento: el ámbito de una categoría o la categoría de una subcategoría (para distinguir nombres repetidos). */
  const ctx = (d: Dim, id: string): string | undefined => {
    if (d === 'categoria') return nombres.ambito.get(catalogo.categorias.find((c) => c.id === id)?.ambito_id ?? '')?.name
    if (d === 'subcategoria') return nombres.categoria.get(catalogo.subcategorias.find((c) => c.id === id)?.categoria_id ?? '')?.name
    return undefined
  }
  const datos = q.data
  const r = useMemo(() => (datos ? ranking(datos.actual, datos.historico, dim, filtros, { desde: filtros.desde, hasta: filtros.hasta, hoy }) : null), [datos, dim, filtros, hoy])

  return (
    <Tarjeta
      titulo="Ranking con tendencia"
      descripcion={r ? (r.comparable ? `Tendencia de 6 meses${r.parcial ? ' · referencia prorrateada al mes en curso' : ''}. Subir o bajar no es bueno ni malo por sí mismo.` : 'Comparación histórica solo con un mes completo o el mes en curso.') : undefined}
      derecha={<Chips dim={dim} setDim={setDim} />}
    >
      {q.isError ? <p className="text-sm text-bad">No se pudo cargar el ranking.</p> : q.isPending || !r ? <p className="text-sm text-muted" role="status">Cargando…</p> : r.items.length === 0 ? <p className="text-sm text-muted">Sin gastos con estos filtros.</p> : (
        <ol aria-label="Ranking" className="flex flex-col gap-0.5">
          {r.items.slice(0, 5).map((it, i) => {
            const x = info(dim, it.id), sel = filtros[dim] === it.id, col = colorVar(x?.color_css ?? ''), cx = ctx(dim, it.id), dup = r.items.filter((o) => info(dim, o.id)?.name === x?.name).length > 1
            return (
              <li key={it.id}>
                <Hint side="top" contenido={
                  <TooltipGrafico ancho="ancho">
                    <TTCabecera icono={<ItemIcon name={x?.icon_key} color={x?.color_css} />} titulo={x?.name ?? 'Sin nombre'} subtitulo={cx} />
                    <TTPrincipal etiqueta="Importe" valor={formatSoles(it.monto)} />
                    <div className="flex flex-col gap-1">
                      <TTMetrica etiqueta="Participación" valor={`${it.pct.toFixed(1)} % de ${formatSoles(r.total)}`} />
                      <TTBarra pct={it.pct} color={col} />
                      <TTMetrica etiqueta="Movimientos" valor={String(it.cantidad)} />
                      <TTMetrica etiqueta="Base histórica" valor={it.referencia === null ? 'Sin historial para comparar' : `${formatSoles(it.referencia)} · promedio de ${it.mesesBase} ${it.mesesBase === 1 ? 'mes' : 'meses'}${r.parcial ? ' (prorrateado)' : ''}`} />
                      {it.variacionAbs !== null && <TTMetrica etiqueta="Variación en soles" valor={`${it.variacionAbs > 0 ? '+' : it.variacionAbs < 0 ? '−' : ''}${formatSoles(Math.abs(it.variacionAbs))}`} />}
                    </div>
                    {it.variacion !== null && <TTAlerta><span>Variación vs base</span><span className="num whitespace-nowrap font-semibold">{textoVariacion(it.variacion)}</span></TTAlerta>}
                    {it.variacion !== null && it.baseCorta && <p className="text-[11px] text-muted">Base corta ({it.mesesBase} {it.mesesBase === 1 ? 'mes' : 'meses'} con gasto): léela con cautela, un cambio pequeño en soles se ve enorme en porcentaje.</p>}
                    <TTHistorial titulo="Últimos 6 meses" meses={r.meses.map((m, k) => ({ etiqueta: mesCorto(m), valor: formatSolesCorto(it.serie[k]), actual: k === r.meses.length - 1 }))} />
                    <TTPie>{sel ? 'Clic para quitar el filtro' : 'Clic para filtrar todo el panel'}</TTPie>
                  </TooltipGrafico>}>
                  {/* Tres líneas por fila: nombre (hasta dos líneas, con su ámbito o categoría si el nombre se repite) e importe; barra de participación con la tendencia; y el porcentaje con su variación. Así el importe y el texto nunca le quitan sitio al nombre. */}
                  <button type="button" aria-pressed={sel} onClick={() => seleccionar(dim, it.id)}
                    className={cn('grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2', sel && 'bg-pri-soft ring-1 ring-pri')}>
                    <span className="num text-xs font-semibold text-muted">{i + 1}</span>
                    <span className="flex min-w-0 items-center gap-2">
                      <ItemIcon name={x?.icon_key} color={x?.color_css} className="size-4 shrink-0" />
                      <span data-nombre className="line-clamp-2 min-w-0 break-words text-sm font-medium">{x?.name ?? 'Sin nombre'}{dup && cx && <span className="text-xs font-normal text-muted"> · {cx}</span>}</span>
                    </span>
                    <span className="num justify-self-end text-sm font-semibold">{formatSoles(it.monto)}</span>
                    <span />
                    <span className="h-1.5 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(2, it.pct)}%`, background: col }} /></span>
                    <span className="justify-self-end"><Spark v={it.serie} color={col} /></span>
                    <span />
                    <span className="num col-span-2 text-[11px] text-muted">{it.pct.toFixed(1)} %{it.variacion !== null && ` · ${textoVariacion(it.variacion)}${it.baseCorta ? ` · base ${it.mesesBase} m.` : ''}`}</span>
                  </button>
                </Hint>
              </li>
            )
          })}
        </ol>
      )}
      {r && <p className="text-[10px] text-muted">% sobre el total del ranking ({formatSoles(r.total)}).</p>}
    </Tarjeta>
  )
}
