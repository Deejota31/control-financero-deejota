import { ChevronRight, Search, Users, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ChipK, TinteK } from '@/components/ui/ChipK'
import { Modal } from '@/components/ui/Dialog'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { EmptyState, Pill } from '@/components/ui/States'
import { admite, round2 } from '@/domain/fondos'
import { cn } from '@/lib/cn'
import { formatFecha, formatFechaLarga, formatSoles, sumarImportes } from '@/lib/format'
import type { Fila, Gasto } from '@/lib/tipos'
import { useCatalogo } from '@/features/catalogo/useCatalogo'
type FondoFila = Fila<'funds'>

type Asignacion = Fila<'expense_fund_allocations'>
type Tipo = 'directo' | 'compartido' | 'excedente'

export interface TarjetaDetalle {
  id: string
  nombre: string
  esGeneral: boolean
  icon: string | null
  color: string | null
  resumen: { asignado: number; consumido: number; disponible: number }
}

interface Props {
  tarjeta: TarjetaDetalle
  /** Texto del período consultado, p. ej. «Octubre 2026». */
  periodo: string
  cerrado: boolean
  asignaciones: Asignacion[]
  gastos: Map<string, Gasto>
  fondosQ: { fondos: FondoFila[]; alcance: Fila<'fund_scope_rules'>[]; medios: Fila<'fund_payment_rules'>[] }
  /** Todas las imputaciones del período (para explicar el reparto de un gasto entre fondos). */
  todas: Asignacion[]
  formato: string
  onClose: () => void
}

const TAMANO_PAGINA = 25
const ORDENES = [
  { v: 'fecha-desc', l: 'Fecha: recientes primero' },
  { v: 'fecha-asc', l: 'Fecha: antiguos primero' },
  { v: 'monto-desc', l: 'Importe: mayor primero' },
  { v: 'monto-asc', l: 'Importe: menor primero' },
] as const
const TIPOS = [
  { v: 'todos', l: 'Todas las imputaciones' },
  { v: 'directo', l: 'Directas' },
  { v: 'compartido', l: 'Compartidas' },
  { v: 'excedente', l: 'Excedentes' },
] as const

interface FilaDetalle {
  a: Asignacion
  g: Gasto
  tipo: Tipo
  /** Texto breve del tipo de imputación (nunca solo color). */
  etiqueta: string | null
  /** Reparto real del gasto entre fondos, según las imputaciones guardadas. */
  reparto: { fund_id: string; nombre: string; monto: number; general: boolean }[]
  /** Explicación basada únicamente en las imputaciones guardadas (y, solo en períodos abiertos, en las reglas actuales, indicándolo). */
  explicacion: string | null
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Detalle de los gastos imputados a un fondo en un período: resumen del fondo (no cambia al buscar), búsqueda, filtro por tipo de
 * imputación, orden, carga progresiva y filas expandibles con el reparto del gasto. Todo dentro de una sola modal.
 */
export function DetalleFondo({ tarjeta, periodo, cerrado, asignaciones, gastos, fondosQ, todas, formato, onClose }: Props) {
  const catalogo = useCatalogo()
  const idBusqueda = useId()
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]['v']>('todos')
  const [orden, setOrden] = useState<(typeof ORDENES)[number]['v']>('fecha-desc')
  const [visibles, setVisibles] = useState(TAMANO_PAGINA)
  const [abierta, setAbierta] = useState<string | null>(null)

  const nombreFondo = useMemo(() => new Map(fondosQ.fondos.map((f) => [f.id, f.name])), [fondosQ.fondos])
  const mapa = useMemo(() => ({
    ambito: new Map(catalogo.ambitos.map((x) => [x.id, x])),
    categoria: new Map(catalogo.categorias.map((x) => [x.id, x])),
    sub: new Map(catalogo.subcategorias.map((x) => [x.id, x])),
    medio: new Map(catalogo.medios.map((x) => [x.id, x])),
  }), [catalogo.ambitos, catalogo.categorias, catalogo.subcategorias, catalogo.medios])

  const filas: FilaDetalle[] = useMemo(() => {
    return asignaciones
      .map((a) => ({ a, g: gastos.get(a.expense_id) }))
      .filter((x): x is { a: Asignacion; g: Gasto } => Boolean(x.g))
      .map(({ a, g }) => {
        const reparto = todas
          .filter((x) => x.expense_id === g.id)
          .map((x) => ({ fund_id: x.fund_id, nombre: nombreFondo.get(x.fund_id) ?? 'Fondo', monto: Number(x.amount), general: x.allocation_kind === 'general' }))
          .sort((m, n) => n.monto - m.monto)
        const otros = reparto.filter((r) => r.fund_id !== tarjeta.id)
        const especificosOtros = otros.filter((r) => !r.general)
        let tipoFila: Tipo = 'directo'
        let etiqueta: string | null = null
        let explicacion: string | null = null

        if (tarjeta.esGeneral && a.allocation_kind === 'general') {
          if (especificosOtros.length > 0) {
            tipoFila = 'excedente'
            etiqueta = `Excedente de ${especificosOtros.map((r) => r.nombre).join(', ')}`
            const cubrieron = sumarImportes(especificosOtros.map((r) => r.monto))
            explicacion = `${especificosOtros.map((r) => r.nombre).join(' y ')} ${especificosOtros.length > 1 ? 'cubrieron' : 'cubrió'} ${formatSoles(cubrieron)}; el resto (${formatSoles(Number(a.amount))}) pasó al Fondo General como excedente.`
          } else if (!cerrado) {
            // Sin otro fondo en el reparto: solo las reglas actuales pueden indicar si un fondo específico lo admite. Se dice expresamente.
            const admiten = fondosQ.fondos.filter((f) => !f.is_general && f.is_active && admite(
              fondosQ.alcance.filter((r) => r.fund_id === f.id),
              fondosQ.medios.filter((r) => r.fund_id === f.id),
              { ambito_id: g.ambito_id, categoria_id: g.categoria_id, subcategoria_id: g.subcategoria_id, payment_method_id: g.payment_method_id },
            ))
            if (admiten.length > 0) {
              tipoFila = 'excedente'
              etiqueta = `Excedente de ${admiten.map((f) => f.name).join(', ')}`
              explicacion = `Se imputó íntegro al Fondo General. Según las reglas actuales, ${admiten.map((f) => f.name).join(' y ')} también lo admite${admiten.length > 1 ? 'n' : ''}; la imputación guardada no registra el motivo exacto.`
            }
          }
        } else if (otros.length > 0) {
          tipoFila = 'compartido'
          etiqueta = `Compartido con ${otros.map((r) => r.nombre).join(', ')}`
          const generalOtro = otros.find((r) => r.general)
          explicacion = generalOtro && !tarjeta.esGeneral
            ? `${tarjeta.nombre} cubrió ${formatSoles(Number(a.amount))}; el resto (${formatSoles(generalOtro.monto)}) pasó al Fondo General.`
            : `El gasto se repartió entre ${[tarjeta.nombre, ...otros.map((r) => r.nombre)].join(' y ')}.`
        }
        return { a, g, tipo: tipoFila, etiqueta, reparto, explicacion }
      })
  }, [asignaciones, gastos, todas, nombreFondo, tarjeta, fondosQ, cerrado])

  const unicos = new Set(filas.map((f) => f.g.id)).size
  const directo = round2(sumarImportes(filas.filter((f) => f.tipo !== 'excedente').map((f) => Number(f.a.amount))))
  const excedente = round2(sumarImportes(filas.filter((f) => f.tipo === 'excedente').map((f) => Number(f.a.amount))))
  const pct = tarjeta.resumen.asignado > 0 ? Math.min(100, Math.round((tarjeta.resumen.consumido / tarjeta.resumen.asignado) * 100)) : tarjeta.resumen.consumido > 0 ? 100 : 0
  const excedido = tarjeta.resumen.disponible < 0

  const filtradas = useMemo(() => {
    const t = norm(q.trim())
    const f = filas.filter((x) => (tipo === 'todos' || x.tipo === tipo) && (!t || norm(x.g.description).includes(t)))
    const [campo, dir] = orden.split('-') as ['fecha' | 'monto', 'asc' | 'desc']
    return f.sort((m, n) => {
      const c = campo === 'fecha' ? m.g.expense_date.localeCompare(n.g.expense_date) || m.g.created_at.localeCompare(n.g.created_at) : Number(m.a.amount) - Number(n.a.amount)
      return dir === 'asc' ? c : -c
    })
  }, [filas, q, tipo, orden])
  const mostradas = filtradas.slice(0, visibles)
  const subtotal = sumarImportes(filtradas.map((f) => Number(f.a.amount)))
  const hayFiltro = q.trim() !== '' || tipo !== 'todos'
  const limpiar = () => { setQ(''); setTipo('todos'); setVisibles(TAMANO_PAGINA) }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Gastos imputados · ${tarjeta.nombre}`} description={`${periodo}${cerrado ? ' · período cerrado (resultado histórico)' : ''}`} size="xl">
      <div className="flex min-w-0 flex-col gap-4">
        <section aria-label="Resumen del fondo" className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/50 p-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-3">
            <TinteK color={tarjeta.color} className="size-11 shrink-0 rounded-xl"><ItemIcon name={tarjeta.icon} color={tarjeta.color} className="size-5" /></TinteK>
            <div className="min-w-0 flex-1">
              <p className="break-words font-display text-base font-bold leading-tight">{tarjeta.nombre}</p>
              <p className="text-xs text-muted">{periodo} · {unicos} {unicos === 1 ? 'gasto' : 'gastos'}</p>
            </div>
            {excedido && <Pill tone="bad">Sobregirado</Pill>}
          </div>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div className="min-w-0"><dt className="text-xs text-muted">Asignado</dt><dd className="num truncate font-semibold">{formatSoles(tarjeta.resumen.asignado)}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted">Consumido</dt><dd className="num truncate font-semibold">{formatSoles(tarjeta.resumen.consumido)}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted">{excedido ? 'Excedido' : 'Disponible'}</dt><dd className={cn('num truncate font-semibold', excedido && 'text-bad')}>{formatSoles(Math.abs(tarjeta.resumen.disponible))}</dd></div>
          </dl>
          <div className="flex items-center gap-2">
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-line" role="progressbar" aria-label={`Consumo de ${tarjeta.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span className={cn('block h-full rounded-full', excedido ? 'bg-bad' : 'bg-pri')} style={{ width: `${pct}%` }} />
            </span>
            <span className="num w-10 text-right text-xs font-semibold">{pct}%</span>
          </div>
          {tarjeta.esGeneral && (
            <p className="rounded-lg bg-surface px-3 py-2 text-xs text-muted ring-1 ring-inset ring-line">
              Consumo <b className="num text-fg">{formatSoles(tarjeta.resumen.consumido)}</b> = directo <b className="num text-fg">{formatSoles(directo)}</b> + excedentes recibidos <b className="num text-fg">{formatSoles(excedente)}</b>. El excedente ya está incluido en el consumo; no se suma otra vez.
            </p>
          )}
        </section>

        {filas.length === 0 ? (
          <EmptyState title="Sin gastos imputados" description="Los gastos que consuman este fondo en este período aparecerán aquí." />
        ) : (
          <div className="@container flex min-w-0 flex-col">
            <div className="sticky -top-4 z-10 flex flex-col gap-2 border-b border-line bg-surface pb-3 pt-1 sm:-top-5">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={idBusqueda} className="sr-only">Buscar por concepto</label>
                <div className="flex min-w-0 flex-1 basis-48 items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 focus-within:border-pri">
                  <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <input id={idBusqueda} type="search" value={q} onChange={(e) => { setQ(e.target.value); setVisibles(TAMANO_PAGINA) }} placeholder="Buscar por concepto…" className="sin-anillo min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted" />
                </div>
                <select aria-label="Tipo de imputación" value={tipo} onChange={(e) => { setTipo(e.target.value as typeof tipo); setVisibles(TAMANO_PAGINA) }} className="max-w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
                  {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
                <select aria-label="Ordenar por" value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} className="max-w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
                  {ORDENES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
              <p className="text-xs text-muted" aria-live="polite">
                Mostrando <b className="num text-fg">{mostradas.length}</b> de <b className="num text-fg">{filtradas.length}</b> {filtradas.length === 1 ? 'gasto' : 'gastos'} · <b className="num text-fg">{formatSoles(subtotal)}</b> en resultados
                {hayFiltro && <> (el fondo consumió {formatSoles(tarjeta.resumen.consumido)} en total)</>}
              </p>
              <div className="hidden grid-cols-[5.5rem_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_8.5rem] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted @min-[44rem]:grid" aria-hidden="true">
                <span>Fecha</span><span>Concepto</span><span>Clasificación</span><span>Imputación</span><span className="text-right">Importe</span>
              </div>
            </div>

            {filtradas.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-semibold">Ningún gasto coincide</p>
                <p className="mt-1 text-sm text-muted">Prueba con otra palabra o quita el filtro. El resumen del fondo no cambia al buscar.</p>
                <Button variant="secondary" className="mt-3" onClick={limpiar}><X className="size-4" aria-hidden="true" /> Quitar búsqueda y filtros</Button>
              </div>
            ) : (
              <ul className="flex flex-col">
                {mostradas.map((f) => {
                  const { a, g } = f
                  const amb = mapa.ambito.get(g.ambito_id), cat = mapa.categoria.get(g.categoria_id), sub = g.subcategoria_id ? mapa.sub.get(g.subcategoria_id) : null, med = mapa.medio.get(g.payment_method_id)
                  const parcial = round2(Number(a.amount)) !== round2(Number(g.amount))
                  const abierto = abierta === a.id
                  const idPanel = `detalle-${a.id}`
                  return (
                    <li key={a.id} className="border-b border-line last:border-0">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-1 py-3 @min-[44rem]:grid-cols-[5.5rem_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_8.5rem] @min-[44rem]:items-center @min-[44rem]:px-3">
                        <span className="num col-start-1 row-start-2 text-xs text-muted @min-[44rem]:row-start-1 @min-[44rem]:text-sm @min-[44rem]:text-fg">{formatFecha(g.expense_date, formato)}</span>
                        <button type="button" aria-expanded={abierto} aria-controls={idPanel} onClick={() => setAbierta(abierto ? null : a.id)}
                          className="col-start-1 row-start-1 flex min-w-0 items-start gap-1.5 rounded-md text-left @min-[44rem]:col-start-2">
                          <ChevronRight className={cn('mt-0.5 size-4 shrink-0 text-muted transition-transform', abierto && 'rotate-90')} aria-hidden="true" />
                          <span className="min-w-0 break-words font-semibold">{g.description}<span className="sr-only">. {abierto ? 'Ocultar' : 'Ver'} detalle</span></span>
                        </button>
                        <span className="col-span-2 row-start-3 flex min-w-0 flex-wrap items-center gap-1 @min-[44rem]:col-span-1 @min-[44rem]:col-start-3 @min-[44rem]:row-start-1">
                          <ChipK color={cat?.color_css}><ItemIcon name={cat?.icon_key} className="size-3" /> {cat?.name}{sub ? ` › ${sub.name}` : ''}</ChipK>
                          <span className="text-xs text-muted">{med?.name}</span>
                        </span>
                        <span className="col-start-2 row-start-2 justify-self-end @min-[44rem]:col-start-4 @min-[44rem]:row-start-1 @min-[44rem]:justify-self-start">
                          {f.etiqueta ? (
                            <Pill tone={f.tipo === 'excedente' ? 'warn' : 'neutral'}><Users className="size-3" aria-hidden="true" /> {f.etiqueta}</Pill>
                          ) : (
                            <span className="text-xs text-muted"><span className="sr-only">Imputación </span>Directo</span>
                          )}
                        </span>
                        <span className="num col-start-2 row-start-1 text-right @min-[44rem]:col-start-5">
                          <span className="block font-bold">{formatSoles(Number(a.amount))}</span>
                          {parcial && <span className="block text-[11px] leading-tight text-muted">Este fondo · total {formatSoles(Number(g.amount))}</span>}
                        </span>
                      </div>
                      {abierto && (
                        <div id={idPanel} role="region" aria-label={`Detalle de ${g.description}`} className="mb-3 flex flex-col gap-2 rounded-lg border border-line bg-surface-2/50 p-3 text-sm">
                          <p className="text-xs text-muted">{formatFechaLarga(g.expense_date)} · {amb?.name} · {g.expense_type === 'fixed' ? 'Fijo' : 'Variable'}{g.is_recurring ? ' · Recurrente' : ''}</p>
                          <p><span className="text-muted">Gasto total:</span> <b className="num">{formatSoles(Number(g.amount))}</b></p>
                          <ul className="flex flex-col gap-1">
                            {f.reparto.map((r) => (
                              <li key={r.fund_id} className="flex items-center justify-between gap-3 rounded-md bg-surface px-2.5 py-1.5 ring-1 ring-inset ring-line">
                                <span className={cn('min-w-0 break-words', r.fund_id === tarjeta.id && 'font-semibold')}>{r.nombre}{r.fund_id === tarjeta.id && <span className="text-xs font-normal text-muted"> (este fondo)</span>}</span>
                                <span className="num shrink-0 font-semibold">{formatSoles(r.monto)}</span>
                              </li>
                            ))}
                          </ul>
                          {f.explicacion && <p className="text-muted">{f.explicacion}</p>}
                          {g.notes && <p className="break-words text-muted">Nota: {g.notes}</p>}
                          {round2(sumarImportes(f.reparto.map((r) => r.monto))) !== round2(Number(g.amount)) && (
                            <p className="text-bad" role="alert">Las imputaciones suman {formatSoles(sumarImportes(f.reparto.map((r) => r.monto)))}, distinto del total del gasto.</p>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {mostradas.length < filtradas.length && (
              <div className="flex justify-center pt-3">
                <Button variant="secondary" onClick={() => setVisibles((v) => v + TAMANO_PAGINA)}>Mostrar {Math.min(TAMANO_PAGINA, filtradas.length - mostradas.length)} más</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
