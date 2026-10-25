import { createElement } from 'react'
import { tonos, type Tema } from '@/domain/color'
import { iconFor } from '@/lib/icons'

export interface ElementoPrevia { id: string; nombre: string; icono: string; hex: string }

/**
 * Cómo se verá el elemento en la aplicación, en tema claro y oscuro a la vez. Usa los nombres reales del catálogo y no
 * muestra importes: las proporciones del anillo son ilustrativas.
 */
export function VistaPreviaColor({ elementos, actualId }: { elementos: ElementoPrevia[]; actualId: string | null }) {
  const actual = elementos.find((e) => e.id === actualId) ?? elementos[0]
  if (!actual) return null
  return (
    <section aria-label="Vista previa del color" className="flex flex-col gap-3 xl:sticky xl:top-4">
      {(['claro', 'oscuro'] as Tema[]).map((tema) => (
        <Panel key={tema} tema={tema} elementos={elementos} actual={actual} />
      ))}
    </section>
  )
}

function Panel({ tema, elementos, actual }: { tema: Tema; elementos: ElementoPrevia[]; actual: ElementoPrevia }) {
  const claro = tema === 'claro'
  const fondo = claro ? '#FFFFFF' : '#181829'
  const texto = claro ? '#17172B' : '#ECECF8'
  const borde = claro ? '#D9D9E6' : '#34344F'
  const t = (hex: string) => tonos(hex, tema)!
  const a = t(actual.hex)
  const R = 38, C = 2 * Math.PI * R
  const parte = C / Math.max(1, elementos.length)

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border p-3 text-xs" style={{ background: fondo, color: texto, borderColor: borde }}>
      <p className="font-bold uppercase tracking-wider opacity-70">Tema {tema}</p>
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border" style={{ background: a.suave, borderColor: a.borde, color: a.icono }}>{createElement(iconFor(actual.icono), { className: 'size-4', 'aria-hidden': true })}</span>
        <div className="min-w-0 flex-1"><b className="block truncate text-sm" style={{ color: a.texto }}>{actual.nombre || 'Nombre'}</b><span className="opacity-70">Ejemplo de gasto</span></div>
        <span className="rounded-full border px-2 py-0.5 font-semibold" style={{ background: a.suave, borderColor: a.borde, color: a.texto }}>Etiqueta</span>
      </div>
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 100 100" className="size-24 shrink-0" role="img" aria-label="Anillo ilustrativo con los colores de la lista">
          {elementos.map((e, i) => (
            <circle key={e.id} cx="50" cy="50" r={R} fill="none" strokeWidth="14" stroke={t(e.hex).icono} strokeDasharray={`${Math.max(parte - 1.5, 0.5)} ${C}`} strokeDashoffset={-i * parte} transform="rotate(-90 50 50)" style={{ transition: 'stroke .4s', opacity: e.id === actual.id ? 1 : 0.8 }} />
          ))}
        </svg>
        <div className="flex min-w-0 flex-wrap gap-1">
          {elementos.slice(0, 8).map((e) => {
            const k = t(e.hex)
            return <span key={e.id} className="rounded-full border px-2 py-0.5 font-semibold" style={{ background: k.suave, borderColor: k.borde, color: k.texto, outline: e.id === actual.id ? `2px solid ${k.icono}` : undefined }}>{e.nombre}</span>
          })}
        </div>
      </div>
      <p className="opacity-60">El anillo es ilustrativo: no usa importes.</p>
    </div>
  )
}
