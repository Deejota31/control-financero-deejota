import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { armonizar, nombreDeColor } from '@/domain/color'
import { cn } from '@/lib/cn'
import type { ItemCatalogo } from './ElementoEditor'

type Alcance = 'propios' | 'seleccionados'

export interface CambioArmonia {
  id: string
  /** Color propuesto (#RRGGBB). */
  hex: string
  /** true si el elemento hereda y pasaría a color propio. */
  rompeHerencia: boolean
}

interface Props {
  items: ItemCatalogo[]
  /** Etiqueta del padre del que se hereda («categoría», «ámbito»), si el tipo admite herencia. */
  hereda?: 'ámbito' | 'categoría' | null
  onConfirmar: (cambios: CambioArmonia[]) => void
  onClose: () => void
}

/**
 * Armonizar la paleta de una lista: muestra el color actual y el propuesto de cada elemento, deja escoger cuáles cambian y explica,
 * antes de confirmar, qué elementos pasarían de heredar a color propio. Cancelar no modifica nada. La propuesta depende solo de la
 * posición en la lista, así que no cambia al marcar o desmarcar elementos.
 */
export function ArmonizarDialog({ items, hereda, onConfirmar, onClose }: Props) {
  const esOtros = (n: string) => /^otros?$/i.test(n.trim())
  const candidatos = items.filter((i) => !esOtros(i.name))
  const propuesta = armonizar(candidatos.length)
  const heredaEl = (i: ItemCatalogo) => i.color_mode === 'inherit'
  const [alcance, setAlcance] = useState<Alcance>(hereda ? 'propios' : 'seleccionados')
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(candidatos.filter((i) => !heredaEl(i)).map((i) => i.id)))

  const alternar = (id: string) => setMarcados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const elegible = (i: ItemCatalogo) => alcance === 'seleccionados' || !heredaEl(i)
  const cambios: CambioArmonia[] = candidatos.flatMap((i, n) => (marcados.has(i.id) && elegible(i) ? [{ id: i.id, hex: propuesta[n], rompeHerencia: heredaEl(i) }] : []))
  const rompen = cambios.filter((c) => c.rompeHerencia).length

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Armonizar paleta" description="Revisa los colores propuestos antes de aplicar. Cancelar no cambia nada." size="lg"
      footer={(cerrar) => (
        <>
          <span className="mr-auto text-sm text-muted" aria-live="polite">{cambios.length} {cambios.length === 1 ? 'elemento cambiará' : 'elementos cambiarán'}</span>
          <Button variant="secondary" onClick={cerrar}>Cancelar</Button>
          <Button disabled={cambios.length === 0} onClick={() => onConfirmar(cambios)}>Aplicar a {cambios.length}</Button>
        </>
      )}>
      <div className="flex min-w-0 flex-col gap-3">
        {hereda && (
          <div role="radiogroup" aria-label="Qué armonizar" className="flex flex-col gap-1.5 text-sm">
            {([['propios', 'Solo los que tienen color propio', 'Los que heredan de su ' + hereda + ' no se tocan.'], ['seleccionados', 'Asignar color propio a los seleccionados', 'Los que hereden pasarán a color propio y dejarán de seguir a su ' + hereda + '.']] as const).map(([v, t, d]) => (
              <button key={v} type="button" role="radio" aria-checked={alcance === v} onClick={() => setAlcance(v)}
                className={cn('flex flex-col rounded-lg border px-3 py-2 text-left', alcance === v ? 'border-pri bg-pri-soft' : 'border-line hover:bg-surface-2')}>
                <span className="font-semibold">{t}</span><span className="text-xs text-muted">{d}</span>
              </button>
            ))}
          </div>
        )}
        <ul aria-label="Elementos a armonizar" className="divide-y divide-line rounded-xl border border-line">
          {candidatos.map((i, n) => {
            const activo = elegible(i)
            return (
              <li key={i.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2', !activo && 'opacity-50')}>
                <input type="checkbox" className="size-4 accent-[var(--pri)]" id={`arm-${i.id}`} checked={marcados.has(i.id) && activo} disabled={!activo} onChange={() => alternar(i.id)} />
                <label htmlFor={`arm-${i.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                  <ItemIcon name={i.icon_key} color={i.color_css} />
                  <span className="min-w-0 truncate font-medium">{i.name}</span>
                  {heredaEl(i) && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">Hereda</span>}
                </label>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <span aria-hidden="true" className="size-4 rounded-full border border-line" style={{ background: i.color_css }} />{nombreDeColor(i.color_css ?? '')}
                  <span aria-hidden="true">→</span>
                  <span aria-hidden="true" className="size-4 rounded-full border border-line" style={{ background: propuesta[n] }} /><b className="text-fg">{nombreDeColor(propuesta[n])}</b>
                </span>
              </li>
            )
          })}
        </ul>
        {rompen > 0 && (
          <p role="alert" className="rounded-lg bg-acc-soft px-3 py-2 text-sm text-warn">
            {rompen} {rompen === 1 ? 'elemento hereda' : 'elementos heredan'} hoy el color de su {hereda}: al aplicar {rompen === 1 ? 'pasará' : 'pasarán'} a color propio y ya no {rompen === 1 ? 'lo seguirá' : 'lo seguirán'}.
          </p>
        )}
      </div>
    </Modal>
  )
}
