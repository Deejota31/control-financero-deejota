import { useState } from 'react'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, Pie, PieChart, Rectangle, ReferenceLine, ResponsiveContainer, Sector, Tooltip, XAxis, YAxis } from 'recharts'
import { TooltipGrafico, TTAlerta, TTBarra, TTCabecera, TTMetrica, TTPrincipal } from '@/components/ui/TooltipGrafico'
import type { PuntoDiario } from '@/domain/dashboard'
import { cn } from '@/lib/cn'
import { formatFecha, formatFechaLarga, formatMes, formatSoles, formatSolesCorto } from '@/lib/format'

const EJE = { fill: 'var(--muted)', fontSize: 12 }

export type PuntoGrafico = PuntoDiario & { cantidad: number }

interface TooltipProps {
  active?: boolean
  payload?: { payload: PuntoGrafico }[]
  formato: string
  /** El ritmo ideal solo es comparable con el acumulado cuando no hay filtros cruzados. */
  mostrarIdeal: boolean
  /** Serie completa: sirve para calcular qué parte del mes representa el día. */
  serie: PuntoGrafico[]
}

/**
 * Tooltip de los gráficos temporales. Acumulado (variante A, evolución): fecha → acumulado y ritmo ideal → datos del día → diferencia.
 * Diario (A compacto): fecha → gasto del día como protagonista → movimientos, peso en el mes y acumulado.
 */
function TooltipDia({ active, payload, formato, mostrarIdeal, serie, variante }: TooltipProps & { variante: 'acumulado' | 'diario' }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const mes = p.fecha.slice(0, 7)
  const totalMes = serie.filter((x) => x.fecha.startsWith(mes)).reduce((t, x) => t + x.gasto, 0)
  const nombreMes = formatMes(p.fecha).split(' ')[0]
  const pct = totalMes > 0 ? (p.gasto / totalMes) * 100 : null
  const dif = mostrarIdeal && p.acumulado !== null && p.ideal !== null ? p.acumulado - p.ideal : null
  const fechaLarga = formatFechaLarga(p.fecha)
  const delMes = pct !== null && <TTMetrica etiqueta={`% de ${nombreMes}`} valor={`${pct.toFixed(1)} % de ${formatSoles(totalMes)}`} />

  if (variante === 'diario') {
    return (
      <TooltipGrafico>
        <TTCabecera titulo={formatFecha(p.fecha, formato)} subtitulo={<span className="first-letter:uppercase">{fechaLarga.split(' ')[0]}</span>} />
        <TTPrincipal etiqueta="Gasto del día" valor={formatSoles(p.gasto)} />
        <div className="flex flex-col gap-1">
          <TTMetrica etiqueta="Movimientos" valor={p.cantidad} />
          {delMes}
          {pct !== null && <TTBarra pct={pct} />}
          {p.acumulado !== null && <TTMetrica etiqueta="Acumulado" valor={formatSoles(p.acumulado)} />}
        </div>
      </TooltipGrafico>
    )
  }
  return (
    <TooltipGrafico>
      <TTCabecera titulo={formatFecha(p.fecha, formato)} subtitulo={<span className="first-letter:uppercase">{fechaLarga.split(' ')[0]}</span>} />
      {p.acumulado !== null ? <TTPrincipal etiqueta="Acumulado" valor={formatSoles(p.acumulado)} /> : p.proyeccion !== null && <TTPrincipal etiqueta="Proyección (estimación)" valor={formatSoles(p.proyeccion)} />}
      <div className="flex flex-col gap-1">
        {mostrarIdeal && p.ideal !== null && <TTMetrica etiqueta="Ritmo ideal" valor={formatSoles(p.ideal)} />}
        <TTMetrica etiqueta="Gasto del día" valor={formatSoles(p.gasto)} />
        <TTMetrica etiqueta="Movimientos" valor={p.cantidad} />
        {delMes}
      </div>
      {dif !== null && <TTAlerta tono={dif > 0 ? 'bad' : 'ok'}><span>{dif > 0 ? 'Por encima del ideal' : 'Por debajo del ideal'}</span><span className="num whitespace-nowrap font-semibold">{formatSoles(Math.abs(dif))}</span></TTAlerta>}
    </TooltipGrafico>
  )
}

function diaDeEstado(state: unknown, serie: PuntoGrafico[]): string | null {
  const s = state as { activeLabel?: string | number; activeTooltipIndex?: number | string } | undefined
  if (typeof s?.activeLabel === 'string') return s.activeLabel
  const i = Number(s?.activeTooltipIndex)
  return Number.isInteger(i) && serie[i] ? serie[i].fecha : null
}

const tickDia = (f: string) => String(Number(f.slice(8)))

interface GraficoTemporalProps {
  serie: PuntoGrafico[]
  formato: string
  dia: string | null
  onDia: (fecha: string) => void
  mostrarIdeal: boolean
}

export function GraficoAcumulado({ serie, formato, dia, onDia, mostrarIdeal, resumen }: GraficoTemporalProps & { resumen: string }) {
  return (
    <div role="img" aria-label={resumen} className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={serie} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} onClick={(s) => { const f = diaDeEstado(s, serie); if (f) onDia(f) }} style={{ cursor: 'pointer' }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="fecha" tickFormatter={tickDia} tick={EJE} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" minTickGap={14} />
          <YAxis tickFormatter={formatSolesCorto} tick={EJE} tickLine={false} axisLine={false} width={64} />
          <Tooltip content={<TooltipDia formato={formato} mostrarIdeal={mostrarIdeal} serie={serie} variante="acumulado" />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} wrapperStyle={{ outline: 'none', zIndex: 30 }} />
          <Area type="monotone" dataKey="acumulado" stroke="var(--c1)" strokeWidth={2.5} fill="var(--c1)" fillOpacity={0.12} connectNulls={false} dot={false} activeDot={{ r: 6, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} name="Gasto acumulado" />
          {mostrarIdeal && <Line type="linear" dataKey="ideal" stroke="var(--muted)" strokeWidth={2} strokeDasharray="1 5" strokeLinecap="round" dot={false} activeDot={false} isAnimationActive={false} name="Ritmo ideal" />}
          <Line type="linear" dataKey="proyeccion" stroke="var(--c2)" strokeWidth={2.5} strokeDasharray="6 5" dot={false} activeDot={false} isAnimationActive={false} name="Proyección de cierre" />
          {dia && <ReferenceLine x={dia} stroke="var(--pri)" strokeWidth={2} label={{ value: tickDia(dia), position: 'top', fill: 'var(--pri)', fontSize: 11 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GraficoDiario({ serie, formato, dia, onDia }: Omit<GraficoTemporalProps, 'mostrarIdeal'>) {
  return (
    <div role="img" aria-label="Gasto por día del período. Selecciona una barra para filtrar por ese día." className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={serie} margin={{ top: 4, right: 12, bottom: 0, left: 0 }} onClick={(s) => { const f = diaDeEstado(s, serie); if (f) onDia(f) }} style={{ cursor: 'pointer' }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="fecha" tickFormatter={tickDia} tick={EJE} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" minTickGap={14} />
          <YAxis tickFormatter={formatSolesCorto} tick={EJE} tickLine={false} axisLine={false} width={64} tickCount={3} />
          <Tooltip content={<TooltipDia formato={formato} mostrarIdeal={false} serie={serie} variante="diario" />} cursor={{ fill: 'var(--surface-2)' }} wrapperStyle={{ outline: 'none', zIndex: 30 }} />
          <Bar
            dataKey="gasto"
            name="Gasto diario"
            isAnimationActive={false}
            shape={(p: unknown) => {
              const props = p as { x: number; y: number; width: number; height: number; payload: PuntoGrafico }
              const seleccionada = dia === props.payload.fecha
              return <Rectangle {...props} radius={[3, 3, 0, 0]} fill={seleccionada ? 'var(--pri)' : 'var(--c1)'} fillOpacity={dia && !seleccionada ? 0.35 : 1} />
            }}
          />
          {dia && <ReferenceLine x={dia} stroke="var(--pri)" strokeWidth={2} strokeDasharray="3 3" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface SegmentoDona {
  id: string
  nombre: string
  valor: number
  cantidad: number
  fill: string
}

/**
 * Dona interactiva. El detalle del segmento se muestra en una tarjeta lateral, fuera del anillo, de modo que
 * nunca tapa el total central. También se activa al enfocar una fila de la leyenda (teclado).
 */
export function Dona({
  datos, total, seleccionado, onSeleccion, hoverExterno,
}: {
  datos: SegmentoDona[]
  total: number
  seleccionado: string | null
  onSeleccion: (id: string) => void
  /** Segmento resaltado desde la leyenda (hover o foco). */
  hoverExterno: string | null
}) {
  const [hover, setHover] = useState<string | null>(null)
  const activo = hoverExterno ?? hover
  const seg = datos.find((d) => d.id === activo) ?? null
  const suma = datos.reduce((s, d) => s + d.valor, 0)

  return (
    <div className="relative size-48 shrink-0" role="img" aria-label={`Distribución del gasto por ámbito. Total ${formatSoles(total)}. Selecciona un segmento o una fila de la lista para filtrar.`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datos}
            dataKey="valor"
            nameKey="nombre"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
            isAnimationActive={false}
            onMouseEnter={(entry) => setHover((entry as unknown as { id?: string; payload?: { id?: string } }).id ?? (entry as unknown as { payload?: { id?: string } }).payload?.id ?? null)}
            onMouseLeave={() => setHover(null)}
            onClick={(entry) => {
              const id = (entry as unknown as { id?: string; payload?: { id?: string } }).id ?? (entry as unknown as { payload?: { id?: string } }).payload?.id
              if (id) onSeleccion(id)
            }}
            style={{ cursor: 'pointer', outline: 'none' }}
            shape={(p: unknown) => {
              const props = p as { payload: SegmentoDona; outerRadius: number } & Record<string, unknown>
              const sel = seleccionado === props.payload.id
              const dim = (seleccionado && !sel) || (activo && activo !== props.payload.id && !seleccionado)
              return <Sector {...(props as object)} outerRadius={props.outerRadius + (sel || activo === props.payload.id ? 6 : 0)} fill={props.payload.fill} fillOpacity={dim ? 0.4 : 1} />
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted">{seleccionado ? 'Seleccionado' : 'Total'}</span>
        <span className="num text-base font-semibold">{formatSolesCorto(seleccionado ? (datos.find((d) => d.id === seleccionado)?.valor ?? 0) : suma)}</span>
      </div>
      {seg && (
        <div role="status" className={cn('anim-pop pointer-events-none absolute left-0 top-full z-20 mt-2 sm:left-full sm:top-2 sm:ml-3 sm:mt-0')}>
          <TooltipGrafico>
            <TTCabecera color={seg.fill} titulo={seg.nombre} />
            <TTPrincipal etiqueta="Importe" valor={formatSoles(seg.valor)} />
            <div className="flex flex-col gap-1">
              <TTMetrica etiqueta="Del total" valor={`${suma > 0 ? ((seg.valor / suma) * 100).toFixed(1) : '0.0'} %`} />
              <TTBarra pct={suma > 0 ? (seg.valor / suma) * 100 : 0} color={seg.fill} />
              <TTMetrica etiqueta="Movimientos" valor={seg.cantidad} />
            </div>
          </TooltipGrafico>
        </div>
      )}
    </div>
  )
}
