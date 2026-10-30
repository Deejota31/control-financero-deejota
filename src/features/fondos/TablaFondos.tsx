import * as Menu from '@radix-ui/react-dropdown-menu'
import { ArrowDown, ArrowUp, Copy, Eye, GripVertical, MoreVertical, Pencil, Power, Trash2, Wallet } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/Button'
import { ChipK } from '@/components/ui/ChipK'
import { Hint } from '@/components/ui/Hint'
import { ItemIcon } from '@/components/ui/ItemIcon'
import type { Cobertura, EtiquetaCobertura } from '@/domain/cobertura'
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
  /** Qué cubre el fondo, resumido de sus reglas reales. En el histórico de un período cerrado no hay reglas que mostrar. */
  cobertura: Cobertura | null
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

/**
 * Distribución por ancho REAL del contenedor (no de la pantalla: la barra lateral también ocupa sitio):
 *  - ≥ 1056 px: 8 columnas con las proporciones Fondo 23 · Cobertura 17 · Prioridad 9 · Asignado 10 · Consumido 10 · Disponible 11 · Uso 10 · Acciones 10.
 *  - 720–1055 px: 6 columnas (Fondo, Asignado, Consumido, Disponible, Uso, Acciones); la cobertura y la prioridad pasan a una línea bajo el nombre.
 *  - < 720 px: tarjetas compactas.
 * Los mínimos de cada columna garantizan que nada se corta ni se genera scroll horizontal.
 */
const COLS_MEDIO = '@min-[720px]:grid-cols-[minmax(11rem,2.6fr)_minmax(5.75rem,1fr)_minmax(5.75rem,1fr)_minmax(6.5rem,1.1fr)_minmax(6.5rem,1.2fr)_5rem]'
const COLS_COMPLETO = '@min-[1056px]:grid-cols-[minmax(11rem,23fr)_minmax(8rem,17fr)_minmax(5rem,9fr)_minmax(6rem,10fr)_minmax(6rem,10fr)_minmax(6.5rem,11fr)_minmax(7rem,10fr)_minmax(9.5rem,10fr)]'
const COLS = `${COLS_MEDIO} ${COLS_COMPLETO}`

/** Etiqueta compacta de cobertura: las inclusiones en neutro, las exclusiones («Sin …») en el color de error y la cobertura general en el principal. */
function EtiquetaCob({ e }: { e: EtiquetaCobertura }) {
  if (e.tipo === 'general') return <ChipK color="pri">{e.texto}</ChipK>
  return (
    <span className={cn('inline-flex max-w-[9rem] items-center rounded-full border px-2 py-px text-[11px] font-semibold', e.efecto === 'exclude' ? 'border-bad/30 bg-bad-soft text-bad' : 'border-line bg-surface-2 text-fg')}>
      <span className="truncate">{e.efecto === 'exclude' ? `Sin ${e.texto}` : e.texto}</span>
    </span>
  )
}

function DetalleCobertura({ c }: { c: Cobertura }) {
  const inc = c.etiquetas.filter((e) => e.efecto === 'include')
  const exc = c.etiquetas.filter((e) => e.efecto === 'exclude')
  return (
    <div className="flex min-w-[10rem] flex-col gap-2">
      {inc.length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">Incluye</p><div className="flex flex-wrap gap-1">{inc.map((e) => <EtiquetaCob key={`i-${e.tipo}-${e.texto}`} e={e} />)}</div></div>}
      {exc.length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">Excluye</p><div className="flex flex-wrap gap-1">{exc.map((e) => <EtiquetaCob key={`x-${e.tipo}-${e.texto}`} e={e} />)}</div></div>}
    </div>
  )
}

/** Hasta dos etiquetas; si hay más, un «+N» que muestra el detalle completo (con el ratón o el teclado). */
function CeldaCobertura({ c, nombre }: { c: Cobertura | null; nombre: string }) {
  if (!c) return <span className="text-xs text-muted">—</span>
  if (c.sinReglas) return <span className="text-xs text-muted">Sin reglas de cobertura</span>
  const visibles = c.etiquetas.slice(0, 2)
  const resto = c.etiquetas.length - visibles.length
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1" aria-label={`Cobertura de ${nombre}`}>
      {visibles.map((e) => <EtiquetaCob key={`${e.efecto}-${e.tipo}-${e.texto}`} e={e} />)}
      {resto > 0 && (
        <Hint contenido={<DetalleCobertura c={c} />} side="bottom" align="start">
          <button type="button" aria-label={`Ver la cobertura completa de ${nombre} (${resto} más)`} className="inline-flex items-center rounded-full border border-line bg-surface px-2 py-px text-[11px] font-bold text-muted hover:bg-surface-2 hover:text-fg">+{resto}</button>
        </Hint>
      )}
    </span>
  )
}

function Uso({ f }: { f: FilaFondo }) {
  const { asignado, consumido, pct, estado } = f.resumen
  // Sin presupuesto no hay porcentaje que mostrar (evita dividir entre cero y cifras engañosas).
  if (asignado <= 0) {
    return <span className={cn('text-xs', consumido > 0 ? 'font-semibold text-bad' : 'text-muted')}>{consumido > 0 ? 'Sin presupuesto · sobregasto' : 'Sin presupuesto'}</span>
  }
  const fondo = estado === 'negativo'
    ? 'linear-gradient(90deg,#E0553F,#C62F2F)'
    : estado === 'agotado' || estado === 'casi'
      ? 'linear-gradient(90deg, color-mix(in srgb, var(--warn) 65%, #fff), var(--warn))'
      : 'linear-gradient(90deg, color-mix(in srgb, var(--k) 70%, #fff), var(--k))'
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 min-w-6 flex-1 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line" role="progressbar" aria-label={`Consumo de ${f.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct))}>
        <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, pct)}%`, background: fondo }} />
      </span>
      <b className={cn('num w-11 shrink-0 text-right text-xs', estado === 'negativo' ? 'text-bad' : estado === 'agotado' || estado === 'casi' ? 'text-warn' : 'text-fg')}>{pct.toFixed(0)}%</b>
    </span>
  )
}

function MenuAcciones({ f, p }: { f: FilaFondo; p: Props }) {
  const pos = p.posicion.get(f.id)
  const item = 'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2'
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button type="button" aria-label={`Más acciones de ${f.nombre}`} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-pri-soft hover:text-pri data-[state=open]:bg-pri-soft data-[state=open]:text-pri">
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
      className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 border-b border-line px-3.5 py-3 last:border-0 @min-[720px]:min-h-[68px] @min-[720px]:gap-x-3 @min-[720px]:py-2', COLS, 'transition-colors hover:bg-surface-2/50', f.esGeneral && 'bg-pri-soft/40')}
      style={{ '--k': colorVar(f.color ?? 'pri'), boxShadow: sobre ? undefined : 'inset 4px 0 0 var(--k)' } as CSSProperties}
      draggable={arrastrable}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', f.id); e.dataTransfer.effectAllowed = 'move' }}
      onDragOver={(e) => { if (p.permitirOrdenar && !f.esGeneral && f.activo) { e.preventDefault(); onSobre(f.id) } }}
      onDragLeave={() => onSobre(null)}
      onDrop={(e) => { e.preventDefault(); onSobre(null); const origen = e.dataTransfer.getData('text/plain'); if (origen && origen !== f.id && !f.esGeneral) p.onReordenar(f.id, origen) }}
    >
      {/* Fondo: icono, nombre, insignias y, por debajo de 1056 px, prioridad y cobertura como información secundaria */}
      <div className="flex min-w-0 items-start gap-3 @min-[720px]:items-center">
        <span className="tinte-k grid size-10 shrink-0 place-items-center rounded-xl"><ItemIcon name={f.icon ?? 'wallet'} color={f.color ?? 'pri'} className="size-5" /></span>
        <div className="min-w-0">
          <h2 className="line-clamp-2 break-words font-display text-[15px] font-bold leading-snug [overflow-wrap:anywhere]" title={f.nombre}>{f.nombre}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {f.esGeneral && <ChipK color="pri">Fondo General</ChipK>}
            <span className={cn('inline-flex rounded-full px-2 py-px text-[11px] font-bold', f.activo ? ESTILO_ESTADO[f.resumen.estado] : 'bg-surface-2 text-muted')} data-tono={TONO[f.resumen.estado]}>{etiquetaEstado(f)}</span>
            {f.activo && (f.esGeneral || pos) && <span className="inline-flex rounded-full bg-surface-2 px-2 py-px text-[11px] font-bold text-muted @min-[1056px]:hidden" title="Orden de asignación">{f.esGeneral ? 'Principal' : `${pos}º`}</span>}
          </div>
          {f.cobertura && <div className="mt-1 @min-[1056px]:hidden"><CeldaCobertura c={f.cobertura} nombre={f.nombre} /></div>}
        </div>
      </div>

      {/* Cobertura (solo en la tabla completa) */}
      <div className="hidden min-w-0 @min-[1056px]:block"><CeldaCobertura c={f.cobertura} nombre={f.nombre} /></div>

      {/* Prioridad (solo en la tabla completa): el General es «Principal»; el resto muestra su orden y el asa de arrastre */}
      <span className="hidden items-center gap-1.5 font-semibold @min-[1056px]:flex">
        {f.esGeneral ? <ChipK color="pri">Principal</ChipK> : (
          <>
            {arrastrable ? <GripVertical className="size-4 shrink-0 cursor-grab text-muted" aria-hidden="true" /> : <span className="size-4 shrink-0" />}
            <span className="grid size-6 place-items-center rounded-lg bg-surface-2 text-xs">{pos ? `${pos}º` : '—'}</span>
          </>
        )}
      </span>

      <span className="num hidden whitespace-nowrap text-right @min-[720px]:block">{formatSoles(f.resumen.asignado)}</span>
      <span className="num hidden whitespace-nowrap text-right @min-[720px]:block">{formatSoles(f.resumen.consumido)}</span>
      <span className={cn('num whitespace-nowrap text-right text-[15px] font-bold', disp < 0 ? 'text-bad' : disp > 0 ? 'text-ok' : 'text-fg')}>
        {formatSoles(disp)}<span className="block text-[11px] font-normal text-muted @min-[720px]:hidden">disponible</span>
      </span>
      <div className="col-span-2 min-w-0 @min-[720px]:col-span-1"><Uso f={f} /></div>
      <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 @min-[720px]:col-span-1 @min-[720px]:justify-end">
        <span className="num min-w-0 flex-1 text-xs text-muted @min-[720px]:hidden">Asignado {formatSoles(f.resumen.asignado)} · Consumido {formatSoles(f.resumen.consumido)}</span>
        {f.editable && (
          <span className="flex shrink-0 items-center gap-1">
            <Button variant="secondary" aria-label={`Ver gastos de ${f.nombre}`} title="Ver gastos" className="shrink-0 whitespace-nowrap px-2.5 py-1.5 text-[13px]" onClick={() => p.onVer(f)}>
              <Eye className="size-4" aria-hidden="true" /> <span className="@min-[720px]:@max-[1055px]:sr-only">Ver gastos</span>
            </Button>
            <MenuAcciones f={f} p={p} />
          </span>
        )}
      </div>
    </li>
  )
}

/** Fondos en tabla equilibrada (tarjetas en móvil): el General siempre primero y el resto en su orden de prioridad. */
export function TablaFondos(p: Props) {
  const [sobre, setSobre] = useState<string | null>(null)
  return (
    <div className="@container overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className={cn('hidden min-h-10 items-center gap-x-3 border-b border-line bg-surface-2 px-3.5 text-[11px] font-bold uppercase tracking-wider text-muted @min-[720px]:grid', COLS)} aria-hidden="true">
        <span>Fondo</span>
        <span className="hidden @min-[1056px]:block">Cobertura</span>
        <span className="hidden @min-[1056px]:block">Prioridad</span>
        <span className="text-right">Asignado</span><span className="text-right">Consumido</span><span className="text-right">Disponible</span><span>Uso</span><span className="text-right">Acciones</span>
      </div>
      <ul aria-label="Fondos">
        {p.filas.map((f) => <Fila key={f.id} f={f} p={p} sobre={sobre === f.id} onSobre={setSobre} />)}
      </ul>
    </div>
  )
}
