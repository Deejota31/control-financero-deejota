import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { FilaHint, Hint } from '@/components/ui/Hint'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { perfil, ranking, type Dim, type FilaAnalisis, type FiltrosAnalisis } from '@/domain/analisis'
import type { ClaveFiltro } from '@/domain/filtrosCruzados'
import { cn } from '@/lib/cn'
import { formatFecha, formatFechaLarga, formatSoles, formatSolesCorto } from '@/lib/format'
import { colorVar } from '@/lib/icons'
import { supabase } from '@/lib/supabase'
import type { Catalogo } from '@/features/catalogo/useCatalogo'

interface DatosAnalisis { actual: FilaAnalisis[]; historico: FilaAnalisis[] }

/** Filas agregadas para ranking y perfil (una consulta; los filtros cruzados se aplican en el cliente para que cada gráfico excluya su propia dimensión). */
export function useAnalisis(desde: string, hasta: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'analisis', desde, hasta],
    enabled: habilitado,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('dashboard_analisis', { p_desde: desde, p_hasta: hasta }).abortSignal(signal)
      if (error) throw error
      return data as unknown as DatosAnalisis
    },
  })
}

interface Props {
  catalogo: Catalogo
  filtros: FiltrosAnalisis & { desde: string; hasta: string }
  /** Serie diaria del panel (con todos los filtros salvo el día). */
  serie: { fecha: string; monto: number; cantidad: number }[]
  hoy: string
  formato: string
  seleccionar: (clave: ClaveFiltro, valor: string) => void
}

const DIMS: { v: Dim; l: string }[] = [{ v: 'ambito', l: 'Ámbito' }, { v: 'categoria', l: 'Categoría' }, { v: 'subcategoria', l: 'Subcategoría' }, { v: 'medio', l: 'Medio' }]
type Info = (d: Dim, id: string) => { name: string; icon_key: string; color_css?: string } | undefined
type Ctx = (d: Dim, id: string) => string | undefined

/**
 * Análisis conectado en una fila: calendario, perfil y ranking comparten los filtros cruzados del Dashboard. Cursor o foco muestran el
 * detalle en una tarjeta flotante; clic o toque selecciona y filtra todo el panel. No se abre ninguna modal al seleccionar.
 */
export function AnalisisDashboard({ catalogo, filtros, serie, hoy, formato, seleccionar }: Props) {
  const q = useAnalisis(filtros.desde, filtros.hasta, filtros.desde <= filtros.hasta)
  const [dim, setDim] = useState<Dim>('categoria')

  const nombres = useMemo(() => {
    const m = (xs: { id: string; name: string; icon_key: string; color_css?: string }[]) => new Map(xs.map((x) => [x.id, x]))
    return { ambito: m(catalogo.ambitos), categoria: m(catalogo.categorias), subcategoria: m(catalogo.subcategorias), medio: m(catalogo.medios) }
  }, [catalogo])
  const info: Info = (d, id) => nombres[d].get(id)
  /** Contexto de un elemento: el ámbito de una categoría o la categoría de una subcategoría (para distinguir nombres repetidos). */
  const ctx: Ctx = (d, id) => {
    if (d === 'categoria') return nombres.ambito.get(catalogo.categorias.find((c) => c.id === id)?.ambito_id ?? '')?.name
    if (d === 'subcategoria') return nombres.categoria.get(catalogo.subcategorias.find((c) => c.id === id)?.categoria_id ?? '')?.name
    return undefined
  }
  const datos = q.data
  const r = useMemo(() => (datos ? ranking(datos.actual, datos.historico, dim, filtros, { desde: filtros.desde, hasta: filtros.hasta, hoy }) : null), [datos, dim, filtros, hoy])
  const p = useMemo(() => (datos && r ? perfil(r, datos.historico, dim, filtros) : null), [datos, r, dim, filtros])

  return (
    <section aria-label="Análisis conectado" className="grid gap-4 lg:grid-cols-3">
      <Calendario serie={serie} filtros={filtros} hoy={hoy} formato={formato} seleccionar={seleccionar} />
      <Perfil p={p} r={r} dim={dim} setDim={setDim} info={info} ctx={ctx} cargando={q.isPending} />
      <Ranking r={r} dim={dim} info={info} ctx={ctx} filtros={filtros} seleccionar={seleccionar} cargando={q.isPending} error={q.isError} />
    </section>
  )
}

function Caja({ titulo, nota, derecha, children }: { titulo: string; nota?: string; derecha?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="font-display text-sm font-bold">{titulo}</h3>{nota && <p className="text-[11px] leading-snug text-muted">{nota}</p>}</div>
        {derecha}
      </div>
      {children}
    </section>
  )
}

function Chips({ dim, setDim }: { dim: Dim; setDim: (d: Dim) => void }) {
  return (
    <div role="group" aria-label="Agrupar por" className="flex flex-wrap gap-1">
      {DIMS.map((d) => <button key={d.v} type="button" aria-pressed={dim === d.v} onClick={() => setDim(d.v)} className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors', dim === d.v ? 'border-pri bg-pri-soft text-pri' : 'border-line text-muted hover:bg-surface-2')}>{d.l}</button>)}
    </div>
  )
}

/* ------------------------------- Calendario ------------------------------- */

function Calendario({ serie, filtros, hoy, formato, seleccionar }: Pick<Props, 'serie' | 'filtros' | 'hoy' | 'formato' | 'seleccionar'>) {
  const [y, m] = filtros.hasta.split('-').map(Number)
  const primero = new Date(Date.UTC(y, m - 1, 1)), dias = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const offset = (primero.getUTCDay() + 6) % 7 // lunes = 0
  const prefijo = `${y}-${String(m).padStart(2, '0')}-`
  const delMes = serie.filter((s) => s.fecha.startsWith(prefijo))
  const porDia = new Map(delMes.map((s) => [s.fecha, s]))
  const totalMes = delMes.reduce((s, x) => s + Number(x.monto), 0)
  const max = Math.max(1, ...delMes.map((x) => Number(x.monto))) // escala estable: depende del mes y de los filtros de clasificación, no del día elegido
  const mesTxt = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(primero)
  const celdas = [...Array.from({ length: offset }, () => null), ...Array.from({ length: dias }, (_, i) => i + 1)]

  return (
    <Caja titulo={`Calendario · ${mesTxt}`} nota="Más intenso = más gasto ese día.">
      <div role="group" aria-label={`Días de ${mesTxt}`} className="grid grid-cols-7 gap-[3px]">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d} aria-hidden="true" className="text-center text-[10px] font-semibold text-muted">{d}</span>)}
        {celdas.map((d, i) => {
          if (d === null) return <span key={`v${i}`} aria-hidden="true" />
          const fecha = `${prefijo}${String(d).padStart(2, '0')}`
          const dato = porDia.get(fecha), monto = Number(dato?.monto ?? 0), futuro = fecha > hoy, sel = filtros.dia === fecha
          const nivel = monto > 0 ? 20 + (monto / max) * 70 : 0
          const boton = (
            <button type="button" disabled={futuro} aria-pressed={sel}
              aria-label={`Día ${d} (${formatFecha(fecha, formato)}): ${futuro ? 'aún no ocurre' : monto > 0 ? formatSoles(monto) : 'sin gasto'}${sel ? ', seleccionado' : ''}`}
              onClick={() => seleccionar('dia', fecha)}
              className={cn('grid aspect-square w-full place-items-center rounded-md border text-[11px] font-semibold transition-transform', futuro ? 'border-dashed border-line text-muted/40' : monto === 0 ? 'border-line text-muted hover:bg-surface-2' : 'border-transparent hover:z-10 hover:scale-110 hover:shadow-md', monto > 0 && nivel > 62 ? 'text-white' : 'text-fg', sel && 'ring-2 ring-fg ring-offset-1 ring-offset-surface')}
              style={nivel ? { background: `color-mix(in srgb, var(--pri) ${nivel}%, var(--surface))` } : undefined}>{d}</button>
          )
          if (futuro) return <span key={fecha}>{boton}</span>
          return (
            <Hint key={fecha} side="top" contenido={
              <div className="flex min-w-44 flex-col gap-0.5">
                <p className="mb-1 font-display font-bold first-letter:uppercase">{formatFechaLarga(fecha)}</p>
                <FilaHint etiqueta="Gasto" valor={monto > 0 ? formatSoles(monto) : 'Sin gasto'} destacado />
                {monto > 0 && <><FilaHint etiqueta="Movimientos" valor={String(dato?.cantidad ?? 0)} /><FilaHint etiqueta={`% de ${new Intl.DateTimeFormat('es-PE', { month: 'long', timeZone: 'UTC' }).format(primero)}`} valor={`${((monto / Math.max(totalMes, 1)) * 100).toFixed(1)} % de ${formatSoles(totalMes)}`} /></>}
                <p className="mt-1 text-[11px] text-muted">{sel ? 'Clic para quitar el día' : 'Clic para filtrar todo el panel'}</p>
              </div>}>{boton}</Hint>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted" aria-label="Leyenda">
        <span className="inline-flex items-center gap-1">menos<span aria-hidden="true" className="h-2.5 w-14 rounded" style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--pri) 20%, var(--surface)), var(--pri))' }} />más</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-2.5 rounded-sm border border-line" />sin gasto</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-2.5 rounded-sm border border-dashed border-line" />futuro</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-2.5 rounded-sm ring-2 ring-fg" />elegido</span>
        <span className="num">máx. {formatSoles(max)}</span>
      </div>
    </Caja>
  )
}

/* --------------------------------- Perfil --------------------------------- */

function Perfil({ p, r, dim, setDim, info, ctx, cargando }: { p: ReturnType<typeof perfil> | null; r: ReturnType<typeof ranking> | null; dim: Dim; setDim: (d: Dim) => void; info: Info; ctx: Ctx; cargando: boolean }) {
  const [hov, setHov] = useState<number | null>(null)
  const n = p?.ejes.length ?? 0
  const repetidos = new Set((p?.ejes ?? []).map((e) => info(dim, e.id)?.name).filter((x, i, a) => a.indexOf(x) !== i))
  const nombre = (id: string) => info(dim, id)?.name ?? '—'
  /** Etiqueta de eje: si el nombre se repite en otro grupo se añade su contexto. */
  const etiqueta = (id: string) => (repetidos.has(info(dim, id)?.name) && ctx(dim, id) ? `${nombre(id)} · ${ctx(dim, id)}` : nombre(id))
  const C = 100, R = 66, ang = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2
  const pt = (i: number, v: number) => [C + (v / (p?.max ?? 10)) * R * Math.cos(ang(i)), C + (v / (p?.max ?? 10)) * R * Math.sin(ang(i))]
  const poli = (vals: (number | null)[]) => vals.map((v, i) => pt(i, v ?? 0).join(',')).join(' ')
  const hayRef = Boolean(p?.ejes.some((e) => e.ref !== null))

  const detalle = (i: number) => {
    const e = p!.ejes[i], dif = e.ref === null ? null : e.pct - e.ref
    return (
      <div className="flex min-w-48 flex-col gap-0.5">
        <p className="mb-1 flex items-center gap-1.5 font-display font-bold"><ItemIcon name={info(dim, e.id)?.icon_key} color={info(dim, e.id)?.color_css} />{nombre(e.id)}</p>
        {ctx(dim, e.id) && <p className="-mt-1 mb-1 text-[11px] text-muted">{ctx(dim, e.id)}</p>}
        <FilaHint etiqueta="Este período" valor={`${e.pct.toFixed(1)} %`} destacado />
        <FilaHint etiqueta="Referencia histórica" valor={e.ref === null ? 'Sin referencia' : `${e.ref.toFixed(1)} %`} />
        {dif !== null && <FilaHint etiqueta="Diferencia" valor={`${dif > 0 ? '+' : ''}${dif.toFixed(1)} pts`} />}
        <p className="mt-1 text-[11px] text-muted">% del gasto del período ({formatSoles(r?.total ?? 0)}). Referencia: promedio de los meses anteriores.</p>
      </div>
    )
  }
  const barras = (
    <ul aria-label="Perfil en barras" className="flex flex-col gap-1.5">
      {p?.ejes.map((e, i) => (
        <li key={e.id}>
          <Hint side="top" contenido={detalle(i)}>
            <div tabIndex={0} className="rounded-md px-1 py-0.5 text-xs outline-none hover:bg-surface-2 focus-visible:bg-surface-2">
              <div className="flex justify-between gap-2"><span className="min-w-0 truncate font-medium">{etiqueta(e.id)}</span><span className="num">{e.pct.toFixed(1)} %</span></div>
              <div className="relative h-2 rounded-full bg-surface-2"><span className="absolute inset-y-0 left-0 rounded-full bg-pri transition-[width] duration-500" style={{ width: `${(e.pct / (p?.max ?? 10)) * 100}%` }} />{e.ref !== null && <span className="absolute -inset-y-0.5 w-0.5 bg-fg" style={{ left: `${(e.ref / (p?.max ?? 10)) * 100}%` }} />}</div>
            </div>
          </Hint>
        </li>
      ))}
    </ul>
  )

  return (
    <Caja titulo="Perfil de gasto" nota={p && n ? `% del gasto de los ${n} mayores grupos vs su promedio anterior · escala 0–${p.max} %` : undefined} derecha={<Chips dim={dim} setDim={setDim} />}>
      {cargando || !p ? <p className="text-sm text-muted" role="status">Cargando…</p> : n === 0 ? <p className="text-sm text-muted">Sin gastos con estos filtros.</p> : n < 3 ? barras : (
        <>
          <svg viewBox="-34 0 268 200" className="mx-auto hidden w-full max-w-[19rem] sm:block" role="img" aria-label={`Radar de participación: ${p.ejes.map((e) => `${etiqueta(e.id)} ${e.pct.toFixed(0)} %`).join(', ')}`}>
            {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={p.ejes.map((_, i) => [C + f * R * Math.cos(ang(i)), C + f * R * Math.sin(ang(i))].join(',')).join(' ')} fill={f === 1 ? 'var(--surface-2)' : 'none'} fillOpacity=".5" stroke="var(--line)" />)}
            {[0.5, 1].map((f) => <text key={f} x={C + 2} y={C - f * R - 1.5} style={{ fontSize: 7, fill: 'var(--muted)' }}>{Math.round(p.max * f)} %</text>)}
            {p.ejes.map((e, i) => {
              const [x2, y2] = [C + R * Math.cos(ang(i)), C + R * Math.sin(ang(i))], [lx, ly] = [C + (R + 11) * Math.cos(ang(i)), C + (R + 9) * Math.sin(ang(i))]
              const t = etiqueta(e.id)
              return <g key={e.id}><line x1={C} y1={C} x2={x2} y2={y2} stroke={hov === i ? 'var(--pri)' : 'var(--line)'} strokeWidth={hov === i ? 1.5 : 1} /><text x={lx} y={ly} textAnchor={Math.abs(lx - C) < 6 ? 'middle' : lx > C ? 'start' : 'end'} style={{ fontSize: 8, fill: 'var(--fg)', fontWeight: hov === i ? 700 : 500 }}>{t.length > 17 ? `${t.slice(0, 16)}…` : t}</text></g>
            })}
            {hayRef && <polygon points={poli(p.ejes.map((e) => e.ref))} fill="var(--muted)" fillOpacity="0.16" stroke="var(--muted)" strokeDasharray="3 3" />}
            <polygon points={poli(p.ejes.map((e) => e.pct))} fill="var(--pri)" fillOpacity="0.3" stroke="var(--pri)" strokeWidth="2" strokeLinejoin="round" className="animate-[pop-in_.45s_ease-out]" />
            {p.ejes.map((e, i) => (
              <Hint key={e.id} side="top" contenido={detalle(i)}>
                <g tabIndex={0} role="img" aria-label={`${etiqueta(e.id)}: ${e.pct.toFixed(1)} %`} className="cursor-pointer outline-none focus-visible:[&>circle:last-child]:stroke-fg" onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} onFocus={() => setHov(i)} onBlur={() => setHov(null)}>
                  <circle cx={pt(i, e.pct)[0]} cy={pt(i, e.pct)[1]} r="9" fill="transparent" />
                  <circle cx={pt(i, e.pct)[0]} cy={pt(i, e.pct)[1]} r={hov === i ? 4.5 : 3} fill="var(--pri)" stroke="var(--surface)" strokeWidth="1.5" style={{ transition: 'r .15s' }} />
                </g>
              </Hint>
            ))}
          </svg>
          <div className="sm:hidden">{barras}</div>
          <p className="flex flex-wrap gap-x-3 text-[10px] text-muted"><span><span aria-hidden="true" className="mr-1 inline-block size-2 rounded-sm bg-pri" />Este período</span>{hayRef && <span><span aria-hidden="true" className="mr-1 inline-block size-2 rounded-sm bg-muted/50" />Referencia histórica</span>}</p>
        </>
      )}
    </Caja>
  )
}

/* -------------------------------- Ranking -------------------------------- */

function Spark({ v, color }: { v: number[]; color: string }) {
  const max = Math.max(1, ...v), pts = v.map((x, i) => `${(i * 40) / 5 + 2},${16 - (x / max) * 13}`).join(' ')
  return <svg viewBox="0 0 44 18" className="h-4 w-10 shrink-0" aria-hidden="true"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx={v.length ? 38 : 0} cy={16 - (v[5] / max) * 13} r="2" fill={color} /></svg>
}

const mesCorto = (iso: string) => new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)).replace('.', '')

function Ranking({ r, dim, info, ctx, filtros, seleccionar, cargando, error }: { r: ReturnType<typeof ranking> | null; dim: Dim; info: Info; ctx: Ctx; filtros: FiltrosAnalisis; seleccionar: Props['seleccionar']; cargando: boolean; error: boolean }) {
  return (
    <Caja titulo="Ranking con tendencia" nota={r ? (r.comparable ? `Tendencia de 6 meses${r.parcial ? ' · referencia prorrateada al mes en curso' : ''}. Subir o bajar no es bueno ni malo por sí mismo.` : 'Comparación histórica solo con un mes completo o el mes en curso.') : undefined}>
      {error ? <p className="text-sm text-bad">No se pudo cargar el análisis.</p> : cargando || !r ? <p className="text-sm text-muted" role="status">Cargando…</p> : r.items.length === 0 ? <p className="text-sm text-muted">Sin gastos con estos filtros.</p> : (
        <ol aria-label="Ranking" className="flex flex-col gap-0.5">
          {r.items.slice(0, 5).map((it, i) => {
            const x = info(dim, it.id), sel = filtros[dim] === it.id, col = colorVar(x?.color_css ?? ''), cx = ctx(dim, it.id), dup = r.items.filter((o) => info(dim, o.id)?.name === x?.name).length > 1
            return (
              <li key={it.id}>
                <Hint side="top" contenido={
                  <div className="flex min-w-56 flex-col gap-0.5">
                    <p className="mb-1 flex items-center gap-1.5 font-display font-bold"><ItemIcon name={x?.icon_key} color={x?.color_css} />{x?.name ?? 'Sin nombre'}</p>
                    {cx && <p className="-mt-1 mb-1 text-[11px] text-muted">{cx}</p>}
                    <FilaHint etiqueta="Importe" valor={formatSoles(it.monto)} destacado />
                    <FilaHint etiqueta="Participación" valor={`${it.pct.toFixed(1)} % de ${formatSoles(r.total)}`} />
                    <FilaHint etiqueta="Movimientos" valor={String(it.cantidad)} />
                    <FilaHint etiqueta="Referencia" valor={it.referencia === null ? 'Sin referencia' : formatSoles(it.referencia)} />
                    {it.variacion !== null && <FilaHint etiqueta="Variación" valor={`${it.variacion > 0 ? '▲' : it.variacion < 0 ? '▼' : '='} ${Math.abs(Math.round(it.variacion * 100))} %`} />}
                    <div className="mt-1 grid grid-cols-6 gap-1 border-t border-line pt-1.5 text-center text-[10px]">
                      {r.meses.map((m, k) => <div key={m}><div className="text-muted">{mesCorto(m)}</div><div className="num font-semibold">{formatSolesCorto(it.serie[k])}</div></div>)}
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{sel ? 'Clic para quitar el filtro' : 'Clic para filtrar todo el panel'}</p>
                  </div>}>
                  <button type="button" aria-pressed={sel} onClick={() => seleccionar(dim, it.id)}
                    className={cn('grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-surface-2', sel && 'bg-pri-soft ring-1 ring-pri')}>
                    <span className="num text-[11px] font-semibold text-muted">{i + 1}</span>
                    <span className="flex min-w-0 items-center gap-1.5"><ItemIcon name={x?.icon_key} color={x?.color_css} className="size-3.5 shrink-0" /><span className="min-w-0 truncate text-xs font-medium">{x?.name ?? 'Sin nombre'}</span>{dup && cx && <span className="shrink-0 text-[10px] text-muted">· {cx}</span>}</span>
                    <span className="flex items-center gap-1.5"><Spark v={it.serie} color={col} /><span className="num text-xs font-semibold">{formatSoles(it.monto)}</span></span>
                    <span />
                    <span className="h-1.5 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(2, it.pct)}%`, background: col }} /></span>
                    <span className="num text-right text-[10px] text-muted">{it.pct.toFixed(1)} %{it.variacion !== null && ` · ${it.variacion > 0 ? '▲' : it.variacion < 0 ? '▼' : '='}${Math.abs(Math.round(it.variacion * 100))}%`}</span>
                  </button>
                </Hint>
              </li>
            )
          })}
        </ol>
      )}
      {r && <p className="text-[10px] text-muted">% sobre el total del ranking ({formatSoles(r.total)}).</p>}
    </Caja>
  )
}
