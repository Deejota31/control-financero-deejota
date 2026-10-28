import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useMemo, useState } from 'react'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { flujo, perfil, ranking, recorridosDe, type Dim, type FilaAnalisis, type FiltrosAnalisis } from '@/domain/analisis'
import { cn } from '@/lib/cn'
import { formatFecha, formatSoles, formatSolesCorto } from '@/lib/format'
import { colorVar } from '@/lib/icons'
import { supabase } from '@/lib/supabase'
import type { Catalogo } from '@/features/catalogo/useCatalogo'
import { useFondos } from '@/features/fondos/useFondos'
import type { ClaveFiltro } from '@/domain/filtrosCruzados'

interface DatosAnalisis { actual: FilaAnalisis[]; historico: FilaAnalisis[]; flujo: FilaAnalisis[] }

/** Filas agregadas para ranking, perfil y flujo (una consulta; los filtros cruzados se aplican en el cliente para que cada gráfico excluya su dimensión). */
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

const DIMS: { v: Dim; l: string }[] = [{ v: 'ambito', l: 'Ámbito' }, { v: 'categoria', l: 'Categoría' }, { v: 'subcategoria', l: 'Subcategoría' }, { v: 'medio', l: 'Medio de pago' }]

/**
 * Análisis conectado: calendario, ranking con tendencia, perfil y flujo comparten los filtros cruzados del Dashboard.
 * Pasar el cursor o enfocar inspecciona; clic o toque selecciona (y filtra todo el panel); no se abre ninguna modal al seleccionar.
 */
export function AnalisisDashboard({ catalogo, filtros, serie, hoy, formato, seleccionar }: Props) {
  const q = useAnalisis(filtros.desde, filtros.hasta, filtros.desde <= filtros.hasta)
  const fondosQ = useFondos()
  const [dim, setDim] = useState<Dim>('categoria')
  const [fondoSel, setFondoSel] = useState<string | null | undefined>(undefined)

  const nombres = useMemo(() => {
    const m = (xs: { id: string; name: string; icon_key: string; color_css?: string }[]) => new Map(xs.map((x) => [x.id, x]))
    return { ambito: m(catalogo.ambitos), categoria: m(catalogo.categorias), subcategoria: m(catalogo.subcategorias), medio: m(catalogo.medios) }
  }, [catalogo])
  const fondos = useMemo(() => new Map((fondosQ.data?.fondos ?? []).map((f) => [f.id, f])), [fondosQ.data])
  const info = (d: Dim, id: string) => nombres[d].get(id)

  const datos = q.data
  const r = useMemo(() => (datos ? ranking(datos.actual, datos.historico, dim, filtros, { desde: filtros.desde, hasta: filtros.hasta, hoy }) : null), [datos, dim, filtros, hoy])
  const p = useMemo(() => (datos && r ? perfil(r, datos.historico, dim, filtros) : null), [datos, r, dim, filtros])
  const fl = useMemo(() => (datos ? flujo(datos.flujo, filtros) : null), [datos, filtros])

  return (
    <section aria-label="Análisis conectado" className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold">Análisis</h2>
        <p className="text-sm text-muted">Todo responde a los mismos filtros. Clic o toque selecciona y filtra el panel; cursor o foco solo inspecciona.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Calendario serie={serie} filtros={filtros} hoy={hoy} formato={formato} seleccionar={seleccionar} />
        <Ranking r={r} dim={dim} setDim={setDim} info={info} filtros={filtros} seleccionar={seleccionar} cargando={q.isPending} error={q.isError} />
        <Perfil p={p} dim={dim} info={info} />
        <div className="xl:col-span-2">
          <Flujo fl={fl} info={info} fondos={fondos} sel={fondoSel} setSel={setFondoSel} cargando={q.isPending} filtros={filtros} />
        </div>
      </div>
    </section>
  )
}

function Caja({ titulo, nota, children, className }: { titulo: string; nota?: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={titulo} className={cn('flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:p-5', className)}>
      <div><h3 className="font-display text-base font-bold">{titulo}</h3>{nota && <p className="text-xs text-muted">{nota}</p>}</div>
      {children}
    </section>
  )
}

/* ------------------------------- Calendario ------------------------------- */

function Calendario({ serie, filtros, hoy, formato, seleccionar }: Pick<Props, 'serie' | 'filtros' | 'hoy' | 'formato' | 'seleccionar'>) {
  const [y, m] = filtros.hasta.split('-').map(Number)
  const primero = new Date(Date.UTC(y, m - 1, 1)), dias = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const offset = (primero.getUTCDay() + 6) % 7 // lunes = 0
  const prefijo = `${y}-${String(m).padStart(2, '0')}-`
  const porDia = new Map(serie.filter((s) => s.fecha.startsWith(prefijo)).map((s) => [s.fecha, Number(s.monto)]))
  const max = Math.max(1, ...porDia.values()) // escala estable: depende del mes y de los filtros de clasificación, no del día elegido
  const mesTxt = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(primero)
  const celdas = [...Array.from({ length: offset }, () => null), ...Array.from({ length: dias }, (_, i) => i + 1)]

  return (
    <Caja titulo={`Calendario · ${mesTxt}`} nota="Intensidad = gasto del día. Lunes a domingo.">
      <div role="grid" aria-label={`Calendario de ${mesTxt}`} className="grid grid-cols-7 gap-1">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d} role="columnheader" className="text-center text-[11px] font-semibold text-muted">{d}</span>)}
        {celdas.map((d, i) => {
          if (d === null) return <span key={`v${i}`} role="gridcell" aria-hidden="true" />
          const fecha = `${prefijo}${String(d).padStart(2, '0')}`
          const monto = porDia.get(fecha) ?? 0
          const futuro = fecha > hoy, sel = filtros.dia === fecha, nivel = monto > 0 ? 18 + (monto / max) * 72 : 0
          return (
            <button key={fecha} type="button" role="gridcell" disabled={futuro} aria-pressed={sel}
              aria-label={`${formatFecha(fecha, formato)}: ${futuro ? 'aún no ocurre' : monto > 0 ? formatSoles(monto) : 'sin gasto'}${sel ? ', seleccionado' : ''}`}
              title={futuro ? undefined : `${formatFecha(fecha, formato)} · ${monto > 0 ? formatSoles(monto) : 'sin gasto'}`}
              onClick={() => seleccionar('dia', fecha)}
              className={cn('flex aspect-square min-h-9 flex-col items-center justify-center rounded-md border text-[11px] leading-tight', futuro ? 'border-dashed border-line text-muted/50' : monto === 0 ? 'border-line text-muted' : 'border-transparent text-fg', sel && 'ring-2 ring-fg ring-offset-1 ring-offset-surface')}
              style={nivel ? { background: `color-mix(in srgb, var(--pri) ${nivel}%, var(--surface))` } : undefined}>
              <span className="font-semibold">{d}</span>
              {monto > 0 && <span className="num hidden text-[10px] sm:block">{formatSolesCorto(monto)}</span>}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Leyenda">
        <span className="inline-flex items-center gap-1.5">menos<span aria-hidden="true" className="h-3 w-20 rounded" style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--pri) 18%, var(--surface)), var(--pri))' }} />más (máx. {formatSoles(max)})</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-3 rounded border border-line" /> sin gasto</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-3 rounded border border-dashed border-line" /> futuro</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-3 rounded ring-2 ring-fg" /> seleccionado</span>
      </div>
    </Caja>
  )
}

/* -------------------------------- Ranking -------------------------------- */

function Spark({ v }: { v: number[] }) {
  const max = Math.max(1, ...v), pts = v.map((x, i) => `${(i * 56) / 5 + 2},${22 - (x / max) * 18}`).join(' ')
  return <svg viewBox="0 0 60 24" className="h-6 w-14 shrink-0" role="img" aria-label={`Tendencia de seis meses: ${v.map((x) => formatSolesCorto(x)).join(', ')}`}><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

type Info = (d: Dim, id: string) => { name: string; icon_key: string; color_css?: string } | undefined

function Ranking({ r, dim, setDim, info, filtros, seleccionar, cargando, error }: { r: ReturnType<typeof ranking> | null; dim: Dim; setDim: (d: Dim) => void; info: Info; filtros: FiltrosAnalisis; seleccionar: Props['seleccionar']; cargando: boolean; error: boolean }) {
  return (
    <Caja titulo="Ranking con tendencia" nota={r ? (r.comparable ? `Variación frente al promedio mensual anterior${r.parcial ? ' (prorrateado por los días transcurridos del mes en curso)' : ''}. Subir o bajar no es bueno ni malo por sí mismo.` : 'La comparación histórica solo aplica a un mes completo o al mes en curso.') : undefined}>
      <div role="group" aria-label="Agrupar ranking por" className="flex flex-wrap gap-1">
        {DIMS.map((d) => <button key={d.v} type="button" aria-pressed={dim === d.v} onClick={() => setDim(d.v)} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', dim === d.v ? 'border-pri bg-pri-soft text-pri' : 'border-line text-muted hover:bg-surface-2')}>{d.l}</button>)}
      </div>
      {error ? <p className="text-sm text-bad">No se pudo cargar el análisis.</p> : cargando || !r ? <p className="text-sm text-muted" role="status">Cargando…</p> : r.items.length === 0 ? <p className="text-sm text-muted">Sin gastos con estos filtros.</p> : (
        <ol aria-label="Ranking" className="flex flex-col gap-1.5">
          {r.items.slice(0, 8).map((it, i) => {
            const x = info(dim, it.id), sel = filtros[dim] === it.id
            return (
              <li key={it.id}>
                <button type="button" aria-pressed={sel} onClick={() => seleccionar(dim, it.id)} title={`${x?.name ?? 'Sin nombre'} · ${formatSoles(it.monto)} · ${it.pct.toFixed(1)} % de ${formatSoles(r.total)} · ${it.cantidad} ${it.cantidad === 1 ? 'movimiento' : 'movimientos'}`}
                  className={cn('grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2', sel && 'bg-pri-soft ring-1 ring-pri')}>
                  <span className="num text-xs font-semibold text-muted">{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-2"><ItemIcon name={x?.icon_key} color={x?.color_css} /><span className="min-w-0 truncate text-sm font-medium">{x?.name ?? 'Sin nombre'}</span></span>
                  <span className="num text-sm font-semibold">{formatSoles(it.monto)}</span>
                  <span />
                  <span className="h-2 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${Math.max(2, it.pct)}%`, background: colorVar(x?.color_css ?? '') }} /></span>
                  <span className="flex items-center gap-2 text-xs text-muted"><span className="num">{it.pct.toFixed(1)} %</span><span style={{ color: colorVar(x?.color_css ?? '') }}><Spark v={it.serie} /></span>
                    <span className="num w-16 text-right">{it.variacion === null ? (r.comparable ? 'Sin referencia' : '') : `${it.variacion > 0 ? '▲' : it.variacion < 0 ? '▼' : '='} ${Math.abs(Math.round(it.variacion * 100))} %`}</span></span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
      {r && <p className="text-xs text-muted">Porcentaje sobre el total del ranking ({formatSoles(r.total)}). Tendencia: totales de los últimos seis meses.</p>}
    </Caja>
  )
}

/* --------------------------------- Perfil --------------------------------- */

function Perfil({ p, dim, info }: { p: ReturnType<typeof perfil> | null; dim: Dim; info: Info }) {
  if (!p) return <Caja titulo="Perfil de gasto"><p className="text-sm text-muted" role="status">Cargando…</p></Caja>
  const n = p.ejes.length
  const nombre = (id: string) => info(dim, id)?.name ?? '—'
  const radar = n >= 3
  const C = 110, R = 78, ang = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2
  const pt = (i: number, v: number) => [C + (v / p.max) * R * Math.cos(ang(i)), C + (v / p.max) * R * Math.sin(ang(i))]
  const poli = (vals: (number | null)[]) => vals.map((v, i) => pt(i, v ?? 0).join(',')).join(' ')
  const hayRef = p.ejes.some((e) => e.ref !== null)
  const barras = (
    <ul aria-label="Perfil en barras" className="flex flex-col gap-2">
      {p.ejes.map((e) => (
        <li key={e.id} className="text-sm">
          <div className="flex justify-between gap-2"><span className="min-w-0 truncate font-medium">{nombre(e.id)}</span><span className="num">{e.pct.toFixed(1)} %{e.ref !== null && <span className="text-muted"> · ref. {e.ref.toFixed(1)} %</span>}</span></div>
          <div className="relative h-2.5 rounded-full bg-surface-2"><span className="absolute inset-y-0 left-0 rounded-full bg-pri" style={{ width: `${(e.pct / p.max) * 100}%` }} />{e.ref !== null && <span className="absolute -inset-y-0.5 w-0.5 bg-fg" style={{ left: `${(e.ref / p.max) * 100}%` }} title="Referencia histórica" />}</div>
        </li>
      ))}
    </ul>
  )
  return (
    <Caja titulo="Perfil de gasto" nota={`Participación (% del gasto) de los ${n} mayores grupos frente a su promedio de meses anteriores. Escala 0–${p.max} %.`}>
      {n === 0 ? <p className="text-sm text-muted">Sin gastos con estos filtros.</p> : radar ? (
        <>
          <svg viewBox="0 0 220 220" className="mx-auto hidden w-full max-w-sm sm:block" role="img" aria-label={`Radar de participación por ${DIMS.find((d) => d.v === dim)?.l.toLowerCase()}: ${p.ejes.map((e) => `${nombre(e.id)} ${e.pct.toFixed(0)} %`).join(', ')}`}>
            {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={p.ejes.map((_, i) => [C + f * R * Math.cos(ang(i)), C + f * R * Math.sin(ang(i))].join(',')).join(' ')} fill="none" stroke="var(--line)" />)}
            {[0.5, 1].map((f) => <text key={f} x={C + 3} y={C - f * R - 2} style={{ fontSize: 8, fill: 'var(--muted)' }}>{Math.round(p.max * f)} %</text>)}
            {p.ejes.map((e, i) => {
              const [x2, y2] = [C + R * Math.cos(ang(i)), C + R * Math.sin(ang(i))], [lx, ly] = [C + (R + 14) * Math.cos(ang(i)), C + (R + 12) * Math.sin(ang(i))]
              const t = nombre(e.id)
              return <g key={e.id}><line x1={C} y1={C} x2={x2} y2={y2} stroke="var(--line)" /><text x={lx} y={ly} textAnchor={Math.abs(lx - C) < 6 ? 'middle' : lx > C ? 'start' : 'end'} style={{ fontSize: 9, fill: 'var(--fg)' }}>{t.length > 14 ? `${t.slice(0, 13)}…` : t}</text></g>
            })}
            {hayRef && <polygon points={poli(p.ejes.map((e) => e.ref))} fill="var(--muted)" fillOpacity="0.18" stroke="var(--muted)" strokeDasharray="4 3" />}
            <polygon points={poli(p.ejes.map((e) => e.pct))} fill="var(--pri)" fillOpacity="0.28" stroke="var(--pri)" strokeWidth="2" />
            {p.ejes.map((e, i) => <circle key={e.id} cx={pt(i, e.pct)[0]} cy={pt(i, e.pct)[1]} r="3" fill="var(--pri)"><title>{`${nombre(e.id)}: ${e.pct.toFixed(1)} %`}</title></circle>)}
          </svg>
          <div className="sm:hidden">{barras}</div>
          <p className="flex flex-wrap gap-x-4 text-xs text-muted"><span><span aria-hidden="true" className="mr-1 inline-block size-2.5 rounded-sm bg-pri" />Este período</span>{hayRef && <span><span aria-hidden="true" className="mr-1 inline-block size-2.5 rounded-sm bg-muted/50" />Referencia histórica</span>}</p>
        </>
      ) : barras}
    </Caja>
  )
}

/* ---------------------------------- Flujo --------------------------------- */

function Flujo({ fl, info, fondos, sel, setSel, cargando, filtros }: { fl: ReturnType<typeof flujo> | null; info: Info; fondos: Map<string, { name: string; icon_key: string | null; color_token: string | null }>; sel: string | null | undefined; setSel: (s: string | null | undefined) => void; cargando: boolean; filtros: FiltrosAnalisis }) {
  if (cargando || !fl) return <Caja titulo="Flujo del dinero"><p className="text-sm text-muted" role="status">Cargando…</p></Caja>
  const nf = (id: string | null) => (id === null ? 'Sin asignar' : fondos.get(id)?.name ?? 'Fondo')
  const colF = (id: string | null) => (id === null ? 'var(--muted)' : colorVar(fondos.get(id)?.color_token ?? 'pri'))
  const rec = sel !== undefined ? recorridosDe(fl, sel) : null
  const W = 720, H = 300, nw = 12, gap = 8
  const col = <T extends { monto: number }>(xs: T[]) => { const esc = (H - gap * Math.max(0, xs.length - 1)) / Math.max(fl.total, 1); let y = 0; return xs.map((n) => { const o = { n, y, h: Math.max(4, n.monto * esc) }; y += o.h + gap; return o }) }
  const A = col(fl.ambitos), F = col(fl.fondos), M = col(fl.medios)
  const xs = [0, (W - nw) / 2, W - nw]
  const posA = new Map(A.map((o) => [o.n.id, o])), posF = new Map(F.map((o) => [o.n.id ?? 'sin', o])), posM = new Map(M.map((o) => [o.n.id, o]))
  const usadoA = new Map<string, number>(), entF = new Map<string, number>(), salF = new Map<string, number>(), usadoM = new Map<string, number>()
  const curva = (x0: number, y0: number, x1: number, y1: number, h: number, c: string, on: boolean, t: string, k: string) => (
    <path key={k} d={`M${x0},${y0} C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}`} fill="none" stroke={c} strokeWidth={Math.max(1, h)} opacity={rec ? (on ? 0.6 : 0.08) : 0.35}><title>{t}</title></path>)
  const L1 = [...fl.aF].map(([k, v]) => {
    const [a, f] = k.split('|'), pa = posA.get(a)!, pf = posF.get(f)!, esc = pa.h / Math.max(pa.n.monto, 1), h = v * esc
    const y0 = pa.y + (usadoA.get(a) ?? 0) + h / 2, y1 = pf.y + (entF.get(f) ?? 0) + h / 2
    usadoA.set(a, (usadoA.get(a) ?? 0) + h); entF.set(f, (entF.get(f) ?? 0) + h)
    return curva(xs[0] + nw, y0, xs[1], y1, h, info('ambito', a)?.color_css ?? 'var(--pri)', Boolean(rec?.aF.has(k)), `${info('ambito', a)?.name} → ${nf(f === 'sin' ? null : f)}: ${formatSoles(v)}`, `a${k}`)
  })
  const L2 = [...fl.fM].map(([k, v]) => {
    const [f, m] = k.split('|'), pf = posF.get(f)!, pm = posM.get(m)!, esc = pf.h / Math.max(pf.n.monto, 1), h = v * esc
    const y0 = pf.y + (salF.get(f) ?? 0) + h / 2, y1 = pm.y + (usadoM.get(m) ?? 0) + h / 2
    salF.set(f, (salF.get(f) ?? 0) + h); usadoM.set(m, (usadoM.get(m) ?? 0) + h)
    return curva(xs[1] + nw, y0, xs[2], y1, h, colF(f === 'sin' ? null : f), Boolean(rec?.fM.has(k)), `${nf(f === 'sin' ? null : f)} → ${info('medio', m)?.name}: ${formatSoles(v)}`, `f${k}`)
  })
  const filtrosActivos = Boolean(filtros.ambito || filtros.categoria || filtros.subcategoria || filtros.medio || filtros.tipo || filtros.dia)

  return (
    <Caja titulo="Flujo del dinero" nota={`Ámbito → fondo → medio de pago, desde las imputaciones reales (${formatSoles(fl.total)}${filtrosActivos ? ' con filtros' : ''}). Un gasto repartido se cuenta una vez por fondo, sin duplicarse.`}>
      {fl.total === 0 ? <p className="text-sm text-muted">Sin movimientos con estos filtros.</p> : (
        <>
          <div className="@container">
            <div className="hidden @min-[40rem]:block">
              <svg viewBox={`-90 -4 ${W + 190} ${H + 8}`} className="w-full" role="group" aria-label="Diagrama de flujo">
                {L1}{L2}
                {A.map((o) => <g key={`a${o.n.id}`} opacity={rec && !rec.ambitos.has(o.n.id) ? 0.3 : 1}><rect x={xs[0]} y={o.y} width={nw} height={o.h} rx="3" fill={info('ambito', o.n.id)?.color_css ?? 'var(--pri)'} /><text x={xs[0] - 6} y={o.y + o.h / 2 + 4} textAnchor="end" style={{ fontSize: 11, fill: 'var(--fg)' }}>{info('ambito', o.n.id)?.name}</text></g>)}
                {F.map((o) => {
                  const id = o.n.id, on = sel === id
                  return (
                    <g key={`f${id ?? 'sin'}`} role="button" tabIndex={0} aria-pressed={on} aria-label={`${nf(id)}: ${formatSoles(o.n.monto)}. ${on ? 'Quitar resaltado' : 'Resaltar sus recorridos'}`} className="cursor-pointer outline-none focus-visible:[&>rect]:stroke-[3]"
                      opacity={rec && !on ? 0.4 : 1} onClick={() => setSel(on ? undefined : id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(on ? undefined : id) } }}>
                      <rect x={xs[1]} y={o.y} width={nw} height={o.h} rx="3" fill={colF(id)} stroke={on ? 'var(--fg)' : 'none'} strokeWidth="2" />
                      <text x={xs[1] + nw / 2} y={o.y - 3} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--fg)', fontWeight: on ? 700 : 500 }}>{nf(id)}</text>
                    </g>
                  )
                })}
                {M.map((o) => <g key={`m${o.n.id}`} opacity={rec && !rec.medios.has(o.n.id) ? 0.3 : 1}><rect x={xs[2]} y={o.y} width={nw} height={o.h} rx="3" fill={info('medio', o.n.id)?.color_css ?? 'var(--pri)'} /><text x={xs[2] + nw + 6} y={o.y + o.h / 2 + 4} style={{ fontSize: 11, fill: 'var(--fg)' }}>{info('medio', o.n.id)?.name}</text></g>)}
              </svg>
            </div>
            <ul aria-label="Flujo por fondo" className="flex flex-col gap-2 @min-[40rem]:hidden">
              {fl.fondos.map((f) => {
                const k = f.id ?? 'sin', desde = [...fl.aF].filter(([c]) => c.split('|')[1] === k), hacia = [...fl.fM].filter(([c]) => c.split('|')[0] === k)
                return (
                  <li key={k} className="rounded-lg border border-line p-3 text-sm">
                    <p className="flex items-center justify-between gap-2 font-semibold"><span className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: colF(f.id) }} /><span className="truncate">{nf(f.id)}</span></span><span className="num">{formatSoles(f.monto)}</span></p>
                    <p className="mt-1 text-xs text-muted">Desde: {desde.map(([c, v]) => `${info('ambito', c.split('|')[0])?.name} ${formatSoles(v)}`).join(' · ')}</p>
                    <p className="text-xs text-muted">Hacia: {hacia.map(([c, v]) => `${info('medio', c.split('|')[1])?.name} ${formatSoles(v)}`).join(' · ')}</p>
                  </li>
                )
              })}
            </ul>
          </div>
          {sel !== undefined && <p className="text-xs text-muted" role="status">Resaltando solo los recorridos que pasan por <b className="text-fg">{nf(sel)}</b>. <button type="button" className="font-semibold text-pri hover:underline" onClick={() => setSel(undefined)}>Quitar resaltado</button> · <Link className="font-semibold text-pri hover:underline" to="/fondos">Ver fondos</Link></p>}
        </>
      )}
    </Caja>
  )
}
