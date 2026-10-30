import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Sistema común de tarjetas de detalle de los gráficos. Un mismo contenedor y las mismas piezas, que cada gráfico combina según lo que
 * necesita contar (A evolución, B distribución, C comparación, D histórico). La tipografía es la de la aplicación: solo se ajusta tamaño y peso.
 *
 * Orden de lectura: contexto (cabecera) → indicador principal → indicadores secundarios → información especial (alerta, histórico).
 */
export function TooltipGrafico({ ancho = 'normal', children, className }: { ancho?: 'normal' | 'ancho'; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 text-sm text-fg shadow-pop', ancho === 'normal' ? 'w-[min(17rem,calc(100vw-2rem))]' : 'w-[min(20rem,calc(100vw-2rem))]', className)}>
      {children}
    </div>
  )
}

/** Contexto: fecha, nombre o período, con un ícono o muestra de color opcional y una línea secundaria. */
export function TTCabecera({ icono, color, titulo, subtitulo }: { icono?: ReactNode; color?: string; titulo: ReactNode; subtitulo?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      {icono ? <span className="mt-0.5 shrink-0">{icono}</span> : color ? <span aria-hidden="true" className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ background: color }} /> : null}
      <div className="min-w-0">
        <p className="break-words font-display text-[0.9375rem] font-bold leading-tight">{titulo}</p>
        {subtitulo && <p className="mt-0.5 break-words text-xs text-muted">{subtitulo}</p>}
      </div>
    </div>
  )
}

/** Indicador principal: el valor que el gráfico quiere comunicar, con más peso que el resto. */
export function TTPrincipal({ etiqueta, valor, tono }: { etiqueta?: string; valor: ReactNode; tono?: 'bad' | 'ok' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line/70 pt-2">
      {etiqueta && <span className="text-xs text-muted">{etiqueta}</span>}
      <span className={cn('num ml-auto whitespace-nowrap text-lg font-bold leading-tight', tono === 'bad' && 'text-bad', tono === 'ok' && 'text-ok')}>{valor}</span>
    </div>
  )
}

/** Fila de indicador secundario: etiqueta a la izquierda, valor alineado a la derecha y sin saltos de línea. */
export function TTMetrica({ etiqueta, valor, destacado }: { etiqueta: ReactNode; valor: ReactNode; destacado?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[0.8125rem] leading-snug">
      <span className="min-w-0 text-muted">{etiqueta}</span>
      <span className={cn('num shrink-0 whitespace-nowrap', destacado ? 'font-semibold' : 'font-medium')}>{valor}</span>
    </div>
  )
}

/** Diferencias o alertas. `bad` solo se usa cuando la regla actual lo marca como desfavorable. */
export function TTAlerta({ tono = 'neutral', children }: { tono?: 'bad' | 'ok' | 'neutral'; children: ReactNode }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-medium', tono === 'bad' && 'bg-bad-soft text-bad', tono === 'ok' && 'bg-ok-soft text-ok', tono === 'neutral' && 'bg-surface-2 text-fg')}>
      {children}
    </div>
  )
}

/** Barra fina proporcional a un porcentaje que ya figura en el texto (solo se añade cuando ayuda a comparar de un vistazo). */
export function TTBarra({ pct, color = 'var(--pri)' }: { pct: number; color?: string }) {
  return (
    <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}

export interface MesHistorico { etiqueta: string; valor: string; actual?: boolean }

/** Historial compacto: una celda por mes (abreviatura e importe real) en orden cronológico; el período actual se destaca con suavidad. */
export function TTHistorial({ titulo, meses }: { titulo?: string; meses: MesHistorico[] }) {
  return (
    <div className="border-t border-line/70 pt-2">
      {titulo && <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">{titulo}</p>}
      <ol className="grid grid-cols-3 gap-1 sm:grid-cols-6">
        {meses.map((m) => (
          <li key={m.etiqueta} className={cn('rounded-md px-1 py-1 text-center', m.actual ? 'bg-pri-soft' : 'bg-surface-2/60')}>
            <span className={cn('block text-[0.625rem] uppercase leading-tight', m.actual ? 'font-semibold text-pri' : 'text-muted')}>{m.etiqueta}</span>
            <span className="num block whitespace-nowrap text-[0.6875rem] font-semibold leading-tight">{m.valor}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Indicación de interacción, discreta. */
export function TTPie({ children }: { children: ReactNode }) {
  return <p className="text-[0.6875rem] leading-snug text-muted">{children}</p>
}
