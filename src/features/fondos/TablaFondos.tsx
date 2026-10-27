import * as Menu from '@radix-ui/react-dropdown-menu'
import { ArrowDown, ArrowUp, Copy, Eye, GripVertical, MoreVertical, Pencil, Power, Trash2, Wallet } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/Button'
import { ChipK } from '@/components/ui/ChipK'
import { ItemIcon } from '@/components/ui/ItemIcon'
import type { ResumenFondo } from '@/domain/fondos'
import { cn } from '@/lib/cn'
import { formatSoles } from '@/lib/format'
import { colorVar } from '@/lib/icons'

export interface FilaFondo {
  id: string
  nombre: string
  esGeneral: boolean
  icon: string | null
  color: string | null
  activo: boolean
  resumen: ResumenFondo
  /** Fondo editable (no existe en el histórico de un período cerrado). */
  editable: boolean
}

interface Props {
  filas: FilaFondo[]
  /** Posición (1-based) entre los fondos específicos activos; el Fondo General no tiene posición. */
  posicion: Map<string, number>
  totalEspecificos: number
  permitirOrdenar: boolean
  onVer: (f: FilaFondo) => void
  onEditar: (f: FilaFondo) => void
  onPresupuesto: (f: FilaFondo) => void
  onClonar: (f: FilaFondo) => void
  onMover: (f: FilaFondo, delta: -1 | 1) => void
  onActivar: (f: FilaFondo) => void
  onEliminar: (f: FilaFondo) => void
  onReordenar: (idDestino: string, idOrigen: string) => void
}

const TONO = { ok: 'ok', casi: 'warn', agotado: 'warn', negativo: 'bad' } as const
const ESTILO_ESTADO = {
  ok: 'bg-ok-soft text-ok', casi: 'bg-acc-soft text-warn', agotado: 'bg-acc-soft text-warn', negativo: 'bg-bad-soft text-bad',
} as const

function etiquetaEstado(f: FilaFondo): string {
  if (!f.activo) return 'Inactivo'
  switch (f.resumen.estado) {
    case 'negativo': return f.esGeneral ? 'Saldo negativo' : 'Sobregirado'
    case 'agotado': return 'Agotado'
    case 'casi': return 'Casi agotado'
    default: return 'Con saldo'
  }
}

const COLS = '@min-[1060px]:grid-cols-[minmax(210px,2.3fr)_84px_118px_118px_128px_150px_minmax(190px,auto)]'

function Uso({ f }: { f: FilaFondo }) {
  const pct = f.resumen.pct
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line" role="progressbar" aria-label={`Consumo de ${f.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct))}>
        <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, pct)}%`, background: pct > 100 ? 'linear-gradient(90deg,#E0553F,#C62F2F)' : 'linear-gradient(90deg, color-mix(in srgb, var(--k) 70%, #fff), var(--k))' }} />
      </span>
      <b className="num w-11 text-right text-xs">{pct.toFixed(0)}%</b>
    </span>
  )
}

function MenuAcciones({ f, p }: { f: FilaFondo; p: Props }) {
  const pos = p.posicion.get(f.id)
  const item = 'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2'
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button type="button" aria-label={`Más acciones de ${f.nombre}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-pri-soft hover:text-pri data-[state=open]:bg-pri-soft data-[state=open]:text-pri">
          <MoreVertical className="size-4" aria-hidden="true" />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} aria-label={`Acciones de ${f.nombre}`} className="anim-pop z-[80] w-64 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          <Menu.Item className={item} onSelect={() => p.onEditar(f)}><Pencil className="size-4" aria-hidden="true" /> Editar fondo</Menu.Item>
          <Menu.Item className={item} disabled={!f.activo} onSelect={() => p.onPresupuesto(f)}><Wallet className="size-4" aria-hidden="true" /> Cambiar presupuesto del período</Menu.Item>
          <Menu.Item className={item} onSelect={() => p.onClonar(f)}><Copy className="size-4" aria-hidden="true" /> Clonar</Menu.Item>
          {!f.esGeneral && (
            <>
              <Menu.Item className={item} disabled={!f.activo || !pos || pos <= 1} onSelect={() => p.onMover(f, -1)}><ArrowUp className="size-4" aria-hidden="true" /> Subir prioridad</Menu.Item>
              <Menu.Item className={item} disabled={!f.activo || !pos || pos >= p.totalEspecificos} onSelect={() => p.onMover(f, 1)}><ArrowDown className="size-4" aria-hidden="true" /> Bajar prioridad</Menu.Item>
            </>
          )}
          <Menu.Item className={item} onSelect={() => p.onActivar(f)}><Power className="size-4" aria-hidden="true" /> {f.activo ? 'Desactivar' : 'Activar'}</Menu.Item>
          <Menu.Separator className="my-1.5 h-px bg-line" />
          <Menu.Item className={cn(item, 'text-bad data-[highlighted]:bg-bad-soft')} onSelect={() => p.onEliminar(f)}><Trash2 className="size-4" aria-hidden="true" /> Eliminar fondo…</Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

function Fila({ f, p, sobre, onSobre }: { f: FilaFondo; p: Props; sobre: boolean; onSobre: (id: string | null) => void }) {
  const pos = p.posicion.get(f.id)
  const arrastrable = p.permitirOrdenar && f.activo && !f.esGeneral && f.editable
  const disp = f.resumen.disponible
  return (
    <li
      className={cn('grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2 border-b border-line px-3.5 py-3 last:border-0 @min-[1060px]:min-h-[68px] @min-[1060px]:py-0', COLS, 'transition-colors hover:bg-surface-2/50', f.esGeneral && 'bg-pri-soft/50', !f.activo && 'opacity-75', sobre && 'shadow-[0_-3px_0_0_var(--pri)]')}
      style={{ '--k': colorVar(f.color ?? 'pri'), boxShadow: sobre ? undefined : 'inset 4px 0 0 var(--k)' } as CSSProperties}
      draggable={arrastrable}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', f.id); e.dataTransfer.effectAllowed = 'move' }}
      onDragOver={(e) => { if (p.permitirOrdenar && !f.esGeneral && f.activo) { e.preventDefault(); onSobre(f.id) } }}
      onDragLeave={() => onSobre(null)}
      onDrop={(e) => { e.preventDefault(); onSobre(null); const origen = e.dataTransfer.getData('text/plain'); if (origen && origen !== f.id && !f.esGeneral) p.onReordenar(f.id, origen) }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="tinte-k grid size-10 shrink-0 place-items-center rounded-xl"><ItemIcon name={f.icon ?? 'wallet'} color={f.color ?? 'pri'} className="size-5" /></span>
        <div className="min-w-0">
          <h2 className="truncate font-display text-[15px] font-bold">{f.nombre}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {f.esGeneral && <ChipK color="pri">Fondo General</ChipK>}
            <span className={cn('inline-flex rounded-full px-2 py-px text-[11px] font-bold', f.activo ? ESTILO_ESTADO[f.resumen.estado] : 'bg-surface-2 text-muted')} data-tono={TONO[f.resumen.estado]}>{etiquetaEstado(f)}</span>
          </div>
        </div>
      </div>
      <span className="hidden items-center gap-1.5 font-semibold @min-[1060px]:flex">
        {f.esGeneral ? <ChipK color="pri">Principal</ChipK> : (
          <>
            {arrastrable ? <GripVertical className="size-4 cursor-grab text-muted" aria-hidden="true" /> : <span className="size-4" />}
            <span className="grid size-6 place-items-center rounded-lg bg-surface-2 text-xs">{pos ? `${pos}º` : '—'}</span>
          </>
        )}
      </span>
      <span className="num hidden text-right @min-[1060px]:block">{formatSoles(f.resumen.asignado)}</span>
      <span className="num hidden text-right @min-[1060px]:block">{formatSoles(f.resumen.consumido)}</span>
      <span className={cn('num text-right text-[15px] font-bold', disp < 0 ? 'text-bad' : disp > 0 ? 'text-ok' : 'text-fg')}>
        {formatSoles(disp)}<span className="block text-[11px] font-normal text-muted @min-[1060px]:hidden">disponible</span>
      </span>
      <div className="col-span-2 @min-[1060px]:col-span-1"><Uso f={f} /></div>
      <div className="col-span-2 flex items-center justify-between gap-2 @min-[1060px]:col-span-1 @min-[1060px]:justify-end">
        <span className="num min-w-0 flex-1 text-xs text-muted @min-[1060px]:hidden">Asignado {formatSoles(f.resumen.asignado)} · Consumido {formatSoles(f.resumen.consumido)}</span>
        {f.editable && (
          <span className="flex items-center gap-1.5">
            <Button variant="secondary" className="shrink-0 whitespace-nowrap px-2.5 py-1.5 text-[13px]" onClick={() => p.onVer(f)}><Eye className="size-4" aria-hidden="true" /> Ver gastos</Button>
            <MenuAcciones f={f} p={p} />
          </span>
        )}
      </div>
    </li>
  )
}

/** Fondos en tabla compacta (tarjetas en móvil): el General siempre primero y el resto en su orden de prioridad. */
export function TablaFondos(p: Props) {
  const [sobre, setSobre] = useState<string | null>(null)
  return (
    <div className="@container overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className={cn('hidden min-h-10 items-center gap-x-2 border-b border-line bg-surface-2 px-3.5 text-[11px] font-bold uppercase tracking-wider text-muted @min-[1060px]:grid', COLS)} aria-hidden="true">
        <span>Fondo</span><span>Prioridad</span><span className="text-right">Asignado</span><span className="text-right">Consumido</span><span className="text-right">Disponible</span><span>Uso</span><span className="text-right">Acciones</span>
      </div>
      <ul aria-label="Fondos">
        {p.filas.map((f) => <Fila key={f.id} f={f} p={p} sobre={sobre === f.id} onSobre={setSobre} />)}
      </ul>
    </div>
  )
}
