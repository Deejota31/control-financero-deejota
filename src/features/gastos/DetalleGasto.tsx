import { BookmarkPlus, CalendarDays, CircleCheck, CircleSlash, Copy, FileText, Paperclip, Pencil, Repeat, StickyNote, Tag, Wallet } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ChipK, TinteK } from '@/components/ui/ChipK'
import { Modal } from '@/components/ui/Dialog'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { cn } from '@/lib/cn'
import { formatFecha, formatSoles } from '@/lib/format'
import { colorVar } from '@/lib/icons'
import { supabase } from '@/lib/supabase'
import type { FondoInfo, NombresCatalogo } from './TablaGastos'
import type { GastoConFondos } from './useGastos'

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/40 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{titulo}</h3>
      {children}
    </section>
  )
}

function Dato({ icono: Icono, etiqueta, children }: { icono: typeof CalendarDays; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icono className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0"><p className="text-xs text-muted">{etiqueta}</p><div className="text-sm font-medium">{children}</div></div>
    </div>
  )
}

interface Props {
  g: GastoConFondos
  nom: NombresCatalogo
  fondoPorId: Map<string, FondoInfo>
  formato: string
  onClose: () => void
  onEditar: (g: GastoConFondos) => void
  onClonar: (g: GastoConFondos) => void
  onPlantilla: (g: GastoConFondos) => void
}

/** Detalle financiero de un gasto: encabezado con importe, datos generales, clasificación, fondos y comprobante. */
export function DetalleGasto({ g, nom, fondoPorId, formato, onClose, onEditar, onClonar, onPlantilla }: Props) {
  const [abriendo, setAbriendo] = useState(false)
  async function verComprobante() {
    setAbriendo(true)
    const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(g.receipt_path!, 60)
    setAbriendo(false)
    if (error || !data) return void toast.error('No se pudo abrir el comprobante.')
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const anulado = g.status === 'annulled'
  const amb = nom.ambito.get(g.ambito_id), cat = nom.categoria.get(g.categoria_id), sub = g.subcategoria_id ? nom.sub.get(g.subcategoria_id) : null, med = nom.medio.get(g.payment_method_id)
  const importe = Number(g.amount)
  const asignaciones = g.expense_fund_allocations
  const imputado = asignaciones.reduce((s, a) => s + Number(a.amount), 0)
  const sinFondo = Math.max(0, Math.round((importe - imputado) * 100) / 100)

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={g.description} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-gradient-to-r from-pri-soft to-surface p-4">
          <TinteK color={cat?.color_css} className="size-14 rounded-2xl"><ItemIcon name={cat?.icon_key} color={cat?.color_css} className="size-6" /></TinteK>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">{cat?.name}{sub ? ` · ${sub.name}` : ''}</p>
            <p className={cn('num text-3xl font-bold leading-tight', anulado && 'text-muted line-through')}>{formatSoles(importe)}</p>
            <p className="num text-sm text-muted">{formatFecha(g.expense_date, formato)}</p>
          </div>
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold', anulado ? 'border-bad bg-bad-soft text-bad' : 'border-ok bg-ok-soft text-ok')}>
            {anulado ? <CircleSlash className="size-4" aria-hidden="true" /> : <CircleCheck className="size-4" aria-hidden="true" />}{anulado ? 'Anulado' : 'Activo'}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Seccion titulo="Información general">
            <div className="grid grid-cols-2 gap-3">
              <Dato icono={CalendarDays} etiqueta="Fecha"><span className="num">{formatFecha(g.expense_date, formato)}</span></Dato>
              <Dato icono={Wallet} etiqueta="Importe"><b className="num">{formatSoles(importe)}</b></Dato>
              <Dato icono={Tag} etiqueta="Tipo">{g.expense_type === 'fixed' ? 'Fijo' : 'Variable'}</Dato>
              <Dato icono={CircleCheck} etiqueta="Estado">{anulado ? 'Anulado' : 'Activo'}</Dato>
              <Dato icono={Repeat} etiqueta="Recurrente">{g.is_recurring ? 'Sí' : 'No'}</Dato>
            </div>
          </Seccion>
          <Seccion titulo="Clasificación">
            <div className="grid grid-cols-2 gap-3">
              <Dato icono={Tag} etiqueta="Ámbito"><ChipK color={amb?.color_css}><ItemIcon name={amb?.icon_key} className="size-3" /> {amb?.name}</ChipK></Dato>
              <Dato icono={Tag} etiqueta="Categoría"><ChipK color={cat?.color_css}><ItemIcon name={cat?.icon_key} className="size-3" /> {cat?.name}</ChipK></Dato>
              <Dato icono={Tag} etiqueta="Subcategoría">{sub?.name ?? '—'}</Dato>
              <Dato icono={Wallet} etiqueta="Medio de pago"><ChipK color={med?.color_css}><ItemIcon name={med?.icon_key} className="size-3" /> {med?.name}</ChipK></Dato>
            </div>
          </Seccion>
        </div>

        <Seccion titulo="Fondos que lo cubren">
          {anulado ? (
            <p className="text-sm text-muted">Este gasto está anulado: no consume presupuesto de ningún fondo.</p>
          ) : asignaciones.length === 0 ? (
            <p className="text-sm text-muted">Ningún fondo cubre este gasto.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2 text-sm"><span className="text-muted">Importe del movimiento</span><b className="num">{formatSoles(importe)}</b></div>
              <div role="img" aria-label={`Reparto entre fondos: ${asignaciones.map((a) => `${fondoPorId.get(a.fund_id)?.name ?? 'Fondo'} ${formatSoles(Number(a.amount))}`).join(', ')}`} className="flex h-3 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line">
                {asignaciones.map((a, i) => { const c = fondoPorId.get(a.fund_id)?.color_token; const igualAnterior = i > 0 && fondoPorId.get(asignaciones[i - 1].fund_id)?.color_token === c; return <span key={a.fund_id} className="h-full border-r-2 border-surface transition-[width] last:border-r-0" style={{ width: `${importe > 0 ? (Number(a.amount) / importe) * 100 : 0}%`, background: colorVar(c), opacity: igualAnterior ? 0.55 : 1 }} /> })}
              </div>
              <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
                {asignaciones.map((a) => {
                  const f = fondoPorId.get(a.fund_id)
                  return (
                    <li key={a.fund_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="size-3 shrink-0 rounded-sm" style={{ background: colorVar(f?.color_token) }} aria-hidden="true" />
                      <span className="flex-1">{f?.name ?? 'Fondo'} {a.allocation_kind === 'general' && <ChipK color="acc" className="ml-1">General</ChipK>}</span>
                      <span className="num text-xs text-muted">{importe > 0 ? ((Number(a.amount) / importe) * 100).toFixed(1) : '0.0'} %</span>
                      <span className="num w-24 text-right font-semibold">{formatSoles(Number(a.amount))}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>Total imputado: <b className="num">{formatSoles(imputado)}</b></span>
                {sinFondo > 0 && <span className="num font-semibold text-bad">Sin fondo asignable: {formatSoles(sinFondo)}</span>}
              </div>
            </>
          )}
        </Seccion>

        <Seccion titulo="Comprobante y notas">
          <div className="grid gap-3 md:grid-cols-2">
            <Dato icono={StickyNote} etiqueta="Notas">{g.notes || <span className="font-normal text-muted">Sin notas</span>}</Dato>
            <Dato icono={Paperclip} etiqueta="Comprobante">
              {g.receipt_path
                ? <Button variant="secondary" loading={abriendo} onClick={verComprobante} className="mt-1"><FileText className="size-4" aria-hidden="true" /> Ver comprobante</Button>
                : <span className="font-normal text-muted">Sin comprobante adjunto</span>}
            </Dato>
          </div>
        </Seccion>

        <div className="sticky -bottom-5 -mx-6 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-6 py-4">
          <Button variant="secondary" onClick={() => onClonar(g)}><Copy className="size-4" aria-hidden="true" /> Duplicar gasto</Button>
          <Button variant="secondary" onClick={() => onPlantilla(g)}><BookmarkPlus className="size-4" aria-hidden="true" /> Guardar como plantilla</Button>
          {!anulado && <Button onClick={() => onEditar(g)}><Pencil className="size-4" aria-hidden="true" /> Editar gasto</Button>}
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  )
}
