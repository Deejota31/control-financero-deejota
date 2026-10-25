import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PuntoDiario } from '@/domain/dashboard'
import { formatFecha, formatSoles, formatSolesCorto } from '@/lib/format'

const EJE = { fill: 'var(--muted)', fontSize: 12 }

interface TooltipProps {
  active?: boolean
  payload?: { payload: PuntoDiario }[]
  formato: string
}

function TooltipDia({ active, payload, formato }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const dif = p.acumulado !== null && p.ideal !== null ? p.acumulado - p.ideal : null
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold">{formatFecha(p.fecha, formato)}</p>
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        {p.acumulado !== null && (<><dt className="text-muted">Acumulado</dt><dd className="num text-right">{formatSoles(p.acumulado)}</dd></>)}
        <dt className="text-muted">Gasto del día</dt><dd className="num text-right">{formatSoles(p.gasto)}</dd>
        {p.ideal !== null && (<><dt className="text-muted">Ritmo ideal</dt><dd className="num text-right">{formatSoles(p.ideal)}</dd></>)}
        {dif !== null && (<><dt className="text-muted">{dif > 0 ? 'Por encima del ideal' : 'Por debajo del ideal'}</dt><dd className={`num text-right ${dif > 0 ? 'text-bad' : 'text-ok'}`}>{formatSoles(Math.abs(dif))}</dd></>)}
        {p.acumulado === null && p.proyeccion !== null && (<><dt className="text-muted">Proyección (estimación)</dt><dd className="num text-right">{formatSoles(p.proyeccion)}</dd></>)}
      </dl>
    </div>
  )
}

function diaDeEstado(state: unknown, serie: PuntoDiario[]): string | null {
  const s = state as { activeLabel?: string | number; activeTooltipIndex?: number | string } | undefined
  if (typeof s?.activeLabel === 'string') return s.activeLabel
  const i = Number(s?.activeTooltipIndex)
  return Number.isInteger(i) && serie[i] ? serie[i].fecha : null
}

export function GraficoAcumulado({ serie, formato, seleccionado, onSeleccion, resumen }: { serie: PuntoDiario[]; formato: string; seleccionado: string | null; onSeleccion: (f: string) => void; resumen: string }) {
  const tick = (f: string) => String(Number(f.slice(8)))
  return (
    <div role="img" aria-label={resumen} className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={serie} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} onClick={(s) => { const f = diaDeEstado(s, serie); if (f) onSeleccion(f) }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="fecha" tickFormatter={tick} tick={EJE} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" minTickGap={14} />
          <YAxis tickFormatter={formatSolesCorto} tick={EJE} tickLine={false} axisLine={false} width={64} />
          <Tooltip content={<TooltipDia formato={formato} />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
          <Area type="monotone" dataKey="acumulado" stroke="var(--c1)" strokeWidth={2.5} fill="var(--c1)" fillOpacity={0.12} connectNulls={false} dot={false} activeDot={{ r: 6 }} isAnimationActive={false} name="Gasto acumulado" />
          <Line type="linear" dataKey="ideal" stroke="var(--muted)" strokeWidth={2} strokeDasharray="1 5" strokeLinecap="round" dot={false} activeDot={false} isAnimationActive={false} name="Ritmo ideal" />
          <Line type="linear" dataKey="proyeccion" stroke="var(--c2)" strokeWidth={2.5} strokeDasharray="6 5" dot={false} activeDot={false} isAnimationActive={false} name="Proyección de cierre" />
          {seleccionado && <ReferenceLine x={seleccionado} stroke="var(--pri)" strokeWidth={2} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GraficoDiario({ serie, formato, seleccionado, onSeleccion }: { serie: PuntoDiario[]; formato: string; seleccionado: string | null; onSeleccion: (f: string) => void }) {
  return (
    <div role="img" aria-label="Gasto por día del período" className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={serie} margin={{ top: 4, right: 12, bottom: 0, left: 0 }} onClick={(s) => { const f = diaDeEstado(s, serie); if (f) onSeleccion(f) }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="fecha" tickFormatter={(f: string) => String(Number(f.slice(8)))} tick={EJE} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" minTickGap={14} />
          <YAxis tickFormatter={formatSolesCorto} tick={EJE} tickLine={false} axisLine={false} width={64} tickCount={3} />
          <Tooltip content={<TooltipDia formato={formato} />} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar dataKey="gasto" fill="var(--c1)" radius={[3, 3, 0, 0]} isAnimationActive={false} name="Gasto diario" />
          {seleccionado && <ReferenceLine x={seleccionado} stroke="var(--pri)" strokeWidth={2} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface SegmentoDona { id: string; nombre: string; valor: number; fill: string }

export function Dona({ datos, total, onSegmento }: { datos: SegmentoDona[]; total: number; onSegmento: (id: string) => void }) {
  return (
    <div className="relative size-48 shrink-0" role="img" aria-label={`Distribución del gasto por ámbito. Total ${formatSoles(total)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={datos} dataKey="valor" nameKey="nombre" innerRadius={62} outerRadius={90} paddingAngle={2} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}
            onClick={(entry) => { const id = (entry as { id?: string; payload?: { id?: string } }).id ?? (entry as { payload?: { id?: string } }).payload?.id; if (id) onSegmento(id) }} style={{ cursor: 'pointer' }} />
          <Tooltip formatter={(v) => formatSoles(Number(v))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted">Total</span>
        <span className="num text-base font-semibold">{formatSolesCorto(total)}</span>
      </div>
    </div>
  )
}
