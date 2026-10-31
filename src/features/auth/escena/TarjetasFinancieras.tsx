import { CalendarDays, ChartNoAxesCombined, ChevronRight, Layers } from 'lucide-react'
import { useId, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ILUSTRATIVO, puntosSerie, rutaSuave, segmentosDona, soles } from './datosIlustrativos'

/**
 * Composición decorativa que sugiere el Dashboard de Control Financiero. Todo es ilustrativo (ver datosIlustrativos.ts) y está oculto a los
 * lectores de pantalla.
 *
 * NITIDEZ: el contenido (textos, cifras, gráficos) nunca recibe `transform`, `scale`, `rotate`, `filter`, `perspective`, `backdrop-filter` ni
 * animaciones: un texto con transformación 3D o 2D se rasteriza en una capa y se remuestrea, y por eso se ve borroso. Toda la profundidad (vidrio,
 * sombras, inclinación, flotación y halos) vive en capas decorativas hermanas (`data-decorativo`) detrás del contenido. El tamaño no se reduce
 * con scale(): el escenario usa tipografía y medidas en `em` con un `font-size` que sigue el ancho disponible (container query).
 */

const ETIQUETA = 'text-[0.8em] font-semibold text-[var(--esc-suave)]'

/** Tarjeta: capa «eco» (hoja inclinada que flota), capa de vidrio y, encima, el contenido sin ninguna transformación. */
function Tarjeta({ children, className, style, eco = 'izq', retraso = 0 }: { children: ReactNode; className?: string; style?: CSSProperties; eco?: 'izq' | 'der'; retraso?: number }) {
  return (
    <div className={cn('absolute', className)} style={style}>
      <span data-decorativo aria-hidden="true" className={cn('esc-eco esc-flota', eco === 'der' && 'esc-eco-der')} style={{ animationDelay: `${retraso}s` }} />
      <span data-decorativo aria-hidden="true" className="esc-vidrio" />
      <div className="relative h-full">{children}</div>
    </div>
  )
}

function IconoCaja({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('esc-icono grid size-[2.25em] shrink-0 place-items-center rounded-[0.75em]', className)}>{children}</span>
}

/** «Presupuesto del mes»: importe, porcentaje, barra y desglose. */
export function TarjetaPresupuesto() {
  const { total, usado, disponible, porcentaje } = ILUSTRATIVO.presupuesto
  return (
    <div className="flex flex-col gap-[0.65em] p-[1.1em]">
      <div className="flex items-start justify-between gap-[0.75em]">
        <div className="min-w-0">
          <p className={ETIQUETA}>Presupuesto del mes</p>
          <p className="mt-[0.3em] font-display text-[1.75em] font-bold leading-none tabular-nums">{soles(total)}</p>
        </div>
        <IconoCaja><CalendarDays className="size-[1.1em]" aria-hidden="true" /></IconoCaja>
      </div>
      <div className="flex items-center gap-[0.75em]">
        <span className="h-[0.5em] flex-1 overflow-hidden rounded-full bg-[var(--esc-pista)]">
          <span className="esc-barra block h-full rounded-full" style={{ width: `${porcentaje}%`, background: 'var(--esc-barra)' }} />
        </span>
        <span className="text-[0.9em] font-bold tabular-nums">{porcentaje}%</span>
      </div>
      <p className="text-[0.72em] tabular-nums text-[var(--esc-suave)]">Usado: {soles(usado)} <span className="mx-[0.3em] opacity-50">|</span> Disponible: {soles(disponible)}</p>
    </div>
  )
}

/** «Gastos por categoría»: dona y leyenda con porcentajes. */
function TarjetaCategorias() {
  const seg = segmentosDona(ILUSTRATIVO.categorias)
  return (
    <div className="flex h-full flex-col gap-[0.6em] p-[1.1em]">
      <p className={ETIQUETA}>Gastos por categoría</p>
      <div className="flex min-h-0 flex-1 items-center gap-[1.2em]">
        <svg viewBox="0 0 36 36" className="size-[6.75em] shrink-0" aria-hidden="true">
          <g transform="rotate(-90 18 18)">
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--esc-pista)" strokeWidth="5.5" />
          {ILUSTRATIVO.categorias.map((c, i) => (
            <circle key={c.nombre} cx="18" cy="18" r="15.9155" fill="none" stroke={c.color} strokeWidth="5.5" strokeDasharray={`${seg[i].largo} ${100 - seg[i].largo}`} strokeDashoffset={seg[i].desplazamiento} />
          ))}
          </g>
        </svg>
        <ul className="flex min-w-0 flex-1 flex-col gap-[0.4em] text-[0.74em]">
          {ILUSTRATIVO.categorias.map((c) => (
            <li key={c.nombre} className="flex items-center gap-[0.6em]">
              <span className="size-[0.65em] shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
              <span className="font-semibold tabular-nums text-[var(--esc-suave)]">{c.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Lienzo de la gráfica de tendencia: el viewBox tiene la proporción real del espacio, así el SVG se escala de forma uniforme (sin deformar el marcador). */
const LIENZO = { ancho: 240, alto: 62, plano: 48 }

/** «Tendencia de gastos»: línea con área degradada, globo y meses. */
function TarjetaTendencia() {
  const g = useId(), l = useId()
  const { meses, valores, destacado } = ILUSTRATIVO.tendencia
  const puntos = puntosSerie(valores, LIENZO.ancho, LIENZO.plano, { x: 6, arriba: 8, abajo: 4 })
  const ruta = rutaSuave(puntos)
  const marca = puntos[destacado]
  return (
    <div className="flex h-full flex-col gap-[0.35em] p-[1.1em]">
      <p className={ETIQUETA}>Tendencia de gastos</p>
      <div className="relative">
        <svg viewBox={`0 0 ${LIENZO.ancho} ${LIENZO.alto}`} className="block w-full" aria-hidden="true">
          <defs>
            <linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--esc-linea)" stopOpacity="0.38" /><stop offset="1" stopColor="var(--esc-linea)" stopOpacity="0" /></linearGradient>
            <linearGradient id={l} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--aur-violeta)" /><stop offset="1" stopColor="var(--aur-hielo)" /></linearGradient>
          </defs>
          <path d={`${ruta} L${puntos[puntos.length - 1].x} ${LIENZO.plano} L${puntos[0].x} ${LIENZO.plano} Z`} fill={`url(#${g})`} />
          <path d={ruta} fill="none" stroke={`url(#${l})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1={marca.x} y1={marca.y} x2={marca.x} y2={LIENZO.plano} stroke="var(--esc-linea)" strokeOpacity="0.4" strokeDasharray="2 3" />
        </svg>
        <span className="absolute size-[0.85em] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--esc-linea)] bg-white" style={{ left: `${(marca.x / LIENZO.ancho) * 100}%`, top: `${(marca.y / LIENZO.alto) * 100}%` }} />
        <span className="esc-globo absolute -translate-x-1/2 rounded-[0.5em] px-[0.7em] py-[0.25em] text-[0.74em] font-bold tabular-nums" style={{ left: `${(marca.x / LIENZO.ancho) * 100}%`, top: `${(marca.y / LIENZO.alto) * 100}%`, marginTop: '-2.6em' }}>{soles(valores[destacado])}</span>
      </div>
      <div className="flex justify-between px-[0.2em] text-[0.68em] text-[var(--esc-suave)]">{meses.map((m) => <span key={m}>{m}</span>)}</div>
    </div>
  )
}

/**
 * Clúster de escritorio. El `font-size` del escenario sigue el ancho disponible (28 em de ancho = 100 % de la columna, con un máximo de 1 rem),
 * así que toda la composición se adapta con tipografías y medidas reales y no con `scale()`.
 */
export function ComposicionFinanciera({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('@container w-full', className)}>
      <div data-escena="cluster" className="relative mx-auto" style={{ width: '28em', height: '32em', fontSize: 'min(1rem, 3.5714cqi)' }}>
        <Tarjeta className="left-0 top-0 w-[17em]" retraso={0}><TarjetaPresupuesto /></Tarjeta>
        <Tarjeta className="right-0 top-[1.9em] w-[9.25em]" eco="der" retraso={1.2}>
          <div className="flex flex-col gap-[0.5em] p-[0.95em]">
            <p className={ETIQUETA}>Fondos activos</p>
            <div className="flex items-center gap-[0.6em]">
              <IconoCaja className="size-[2em]"><Layers className="size-[1em]" aria-hidden="true" /></IconoCaja>
              <span className="font-display text-[1.6em] font-bold tabular-nums">{ILUSTRATIVO.fondosActivos}</span>
              <ChevronRight className="ml-auto size-[1em] text-[var(--esc-suave)]" />
            </div>
          </div>
        </Tarjeta>
        <Tarjeta className="left-[1.2em] top-[9.6em] h-[12em] w-[21.5em]" retraso={2.4}><TarjetaCategorias /></Tarjeta>
        <Tarjeta className="left-[2.2em] top-[21.4em] h-[10.6em] w-[25.8em]" eco="der" retraso={0.6}><TarjetaTendencia /></Tarjeta>
        <span className="esc-icono absolute right-[1em] top-[19.2em] grid size-[2.9em] place-items-center rounded-[0.9em]">
          <ChartNoAxesCombined className="size-[1.3em]" aria-hidden="true" />
        </span>
      </div>
    </div>
  )
}

/** Versión móvil: una sola tarjeta de presupuesto (misma estructura: vidrio detrás, contenido sin transformaciones). */
export function PresupuestoMovil({ className }: { className?: string }) {
  return (
    <div data-escena="presupuesto-movil" aria-hidden="true" className={cn('relative', className)}>
      <span data-decorativo aria-hidden="true" className="esc-vidrio" />
      <div className="relative"><TarjetaPresupuesto /></div>
    </div>
  )
}
