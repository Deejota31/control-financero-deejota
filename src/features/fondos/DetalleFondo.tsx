import { BookmarkPlus, ChevronRight, Search, Users, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { Paginacion } from '@/components/ui/Paginacion'
import { ChipK, TinteK } from '@/components/ui/ChipK'
import { Modal } from '@/components/ui/Dialog'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { EmptyState, Pill } from '@/components/ui/States'
import { admite, round2 } from '@/domain/fondos'
import { cn } from '@/lib/cn'
import { formatFecha, formatFechaLarga, formatSoles, sumarImportes } from '@/lib/format'
import type { Fila, Gasto } from '@/lib/tipos'
import { useDebounced } from '@/lib/useDebounced'
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
  /** Guardar la configuración de este fondo como plantilla (solo fondos de un mes abierto). */
  onPlantilla?: () => void
}

const TAMANOS_PAGINA = [10, 20, 50, 100] as const
const ORDENES = [
  { v: 'fecha-desc', l: 'Fecha: recientes primero' },
  { v: 'fecha-asc', l: 'Fecha: antiguos primero' },
  { v: 'monto-desc', l: 'Importe: mayor primero' },
  { v: 'monto-asc', l: 'Importe: menor primero' },
  { v: 'concepto-asc', l: 'Concepto A-Z' },
  { v: 'concepto-desc', l: 'Concepto Z-A' },
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
export function DetalleFondo({ tarjeta, periodo, cerrado, asignaciones, gastos, fondosQ, todas, formato, onClose, onPlantilla }: Props) {
  const catalogo = useCatalogo()
  const idBusqueda = useId()
  const [q, setQ] = useState('')
  const consulta = useDebounced(q, 250)
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]['v']>('todos')
  const [orden, setOrden] = useState<(typeof ORDENES)[number]['v']>('fecha-desc')
  const [pagina, setPagina] = useState(0)
  const [tamano, setTamano] = useState<number>(20)
  const listado = useRef<HTMLDivElement>(null)
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

  // La búsqueda abarca TODOS los movimientos del fondo en el período (no solo la página visible): concepto, notas, clasificación y medio de pago.
  const filtradas = useMemo(() => {
    const texto = (x: FilaDetalle) => {
      const g = x.g
      return norm([g.description, g.notes ?? '', mapa.ambito.get(g.ambito_id)?.name ?? '', mapa.categoria.get(g.categoria_id)?.name ?? '', g.subcategoria_id ? (mapa.sub.get(g.subcategoria_id)?.name ?? '') : '', mapa.medio.get(g.payment_method_id)?.name ?? ''].join(' '))
    }
    const t = norm(consulta.trim())
    const f = filas.filter((x) => (tipo === 'todos' || x.tipo === tipo) && (!t || texto(x).includes(t)))
    const [campo, dir] = orden.split('-') as ['fecha' | 'monto' | 'concepto', 'asc' | 'desc']
    return f.sort((m, n) => {
      const c = campo === 'fecha' ? m.g.expense_date.localeCompare(n.g.expense_date) || m.g.created_at.localeCompare(n.g.created_at)
        : campo === 'monto' ? Number(m.a.amount) - Number(n.a.amount)
        : m.g.description.localeCompare(n.g.description, 'es')
      // En empates el orden es determinista (por id de la imputación), así no se mueve nada entre páginas.
      return (dir === 'asc' ? c : -c) || m.a.id.localeCompare(n.a.id)
    })
  }, [filas, consulta, tipo, orden, mapa])
  const paginas = Math.max(1, Math.ceil(filtradas.length / tamano))
  const actual = Math.min(pagina, paginas - 1)
  const mostradas = filtradas.slice(actual * tamano, actual * tamano + tamano)
  const subtotal = sumarImportes(filtradas.map((f) => Number(f.a.amount)))
  const hayFiltro = q.trim() !== '' || tipo !== 'todos'
  const limpiar = () => { setQ(''); setTipo('todos'); setPagina(0) }

  // Cambiar de página reemplaza lo visible: contrae el detalle abierto y vuelve al inicio del listado.
  const irA = (p: number) => { setPagina(Math.max(0, Math.min(paginas - 1, p))); setAbierta(null) }
  useEffect(() => { listado.current?.scrollTo({ top: 0 }) }, [actual, tamano, consulta, tipo, orden])

  const pie = (
    <Paginacion className="w-full" pagina={actual + 1} total={filtradas.length} tamano={tamano} onPagina={(n) => irA(n - 1)}
      opcionesTamano={TAMANOS_PAGINA} onTamano={(n) => { setTamano(n); setPagina(0); setAbierta(null) }}
      resumen={hayFiltro ? <span title={`El fondo consumió ${formatSoles(tarjeta.resumen.consumido)} en total`}>{formatSoles(subtotal)}</span> : undefined} />
  )

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Gastos imputados · ${tarjeta.nombre}`} description={`${periodo}${cerrado ? ' · período cerrado (resultado histórico)' : ''}`} size="xl" layout="fijo"
      footer={filas.length > 0 ? pie : undefined}>
      <div className="@container flex min-h-0 flex-1 flex-col gap-3">
        {/* Zona fija superior: resumen del fondo y filtros */}
        <section aria-label="Resumen del fondo" className="flex shrink-0 flex-col gap-2.5 rounded-xl border border-line bg-surface-2/50 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <TinteK color={tarjeta.color} className="size-10 shrink-0 rounded-xl"><ItemIcon name={tarjeta.icon} color={tarjeta.color} className="size-5" /></TinteK>
            <div className="min-w-0 flex-1">
              <p className="break-words font-display text-base font-bold leading-tight">{tarjeta.nombre}</p>
              <p className="text-xs text-muted">{periodo} · {unicos} {unicos === 1 ? 'movimiento' : 'movimientos'}</p>
            </div>
            {excedido && <Pill tone="bad">Sobregirado</Pill>}
            {onPlantilla && <Button variant="secondary" onClick={onPlantilla}><BookmarkPlus className="size-4" aria-hidden="true" /> <span className="max-sm:sr-only">Guardar como plantilla</span></Button>}
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm @min-[32rem]:grid-cols-4">
            <div className="min-w-0"><dt className="text-xs text-muted">Asignado</dt><dd className="num truncate font-semibold">{formatSoles(tarjeta.resumen.asignado)}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted">Consumido</dt><dd className="num truncate font-semibold">{formatSoles(tarjeta.resumen.consumido)}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted">{excedido ? 'Excedido' : 'Disponible'}</dt><dd className={cn('num truncate font-semibold', excedido && 'text-bad')}>{formatSoles(Math.abs(tarjeta.resumen.disponible))}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted">Uso</dt><dd className={cn('num truncate font-semibold', excedido && 'text-bad')}>{pct}%</dd></div>
          </dl>
          <span className="h-2 overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-line" role="progressbar" aria-label={`Consumo de ${tarjeta.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span className={cn('block h-full rounded-full', excedido ? 'bg-bad' : 'bg-pri')} style={{ width: `${pct}%` }} />
          </span>
          {tarjeta.esGeneral && (
            <p className="rounded-lg bg-surface px-3 py-1.5 text-xs text-muted ring-1 ring-inset ring-line">
              Consumo <b className="num text-fg">{formatSoles(tarjeta.resumen.consumido)}</b> = directo <b className="num text-fg">{formatSoles(directo)}</b> + excedentes recibidos <b className="num text-fg">{formatSoles(excedente)}</b>. El excedente ya está incluido en el consumo; no se suma otra vez.
            </p>
          )}
        </section>

        {filas.length === 0 ? (
          <EmptyState title="Sin gastos imputados" description="Los gastos que consuman este fondo en este período aparecerán aquí." />
        ) : (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <label htmlFor={idBusqueda} className="sr-only">Buscar por concepto</label>
              <div className="flex h-10 min-w-0 flex-[2_1_14rem] items-center gap-2 rounded-lg border border-line bg-surface px-3 text-muted focus-within:border-pri">
                <Search className="size-4 shrink-0" aria-hidden="true" />
                <input id={idBusqueda} type="search" value={q} onChange={(e) => { setQ(e.target.value); setPagina(0); setAbierta(null) }} placeholder="Buscar concepto, notas, categoría o medio…"
                  className="sin-anillo min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted [&::-webkit-search-cancel-button]:hidden" />
                {q && <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setQ(''); setPagina(0) }} className="grid size-6 shrink-0 place-items-center rounded hover:bg-surface-2"><X className="size-4" aria-hidden="true" /></button>}
              </div>
              <div className="min-w-0 flex-[1_1_10rem]"><Combobox aria-label="Tipo de imputación" value={tipo} searchable={false} options={TIPOS.map((t) => ({ value: t.v, label: t.l }))}
                onChange={(v) => { setTipo((v ?? 'todos') as typeof tipo); setPagina(0); setAbierta(null) }} /></div>
              <div className="min-w-0 flex-[1_1_10rem]"><Combobox aria-label="Ordenar por" value={orden} searchable={false} options={ORDENES.map((o) => ({ value: o.v, label: o.l }))}
                onChange={(v) => { setOrden((v ?? 'fecha-desc') as typeof orden); setPagina(0); setAbierta(null) }} /></div>
            </div>

            {/* Zona central con scroll propio: encabezados fijos, filas y detalles expandidos */}
            <div ref={listado} className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-line" tabIndex={0} aria-label="Gastos imputados">
              <div className="sticky top-0 z-10 hidden grid-cols-[5.5rem_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_9.5rem] gap-3 border-b border-line bg-surface-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted @min-[44rem]:grid" aria-hidden="true">
                <span>Fecha</span><span>Concepto</span><span>Clasificación</span><span>Imputación</span><span className="text-right">Importe</span>
              </div>
              {filtradas.length === 0 ? (
                <div className="px-4 py-10 text-center">
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
                    const suma = round2(sumarImportes(f.reparto.map((r) => r.monto)))
                    return (
                      <li key={a.id} className={cn('border-b border-line last:border-0', abierto && 'bg-surface-2/40')}>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-3 py-2.5 hover:bg-surface-2/50 @min-[44rem]:grid-cols-[5.5rem_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_9.5rem] @min-[44rem]:items-center">
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
                            {parcial && <span className="block text-[11px] leading-tight text-muted">total {formatSoles(Number(g.amount))}</span>}
                          </span>
                        </div>
                        {abierto && (
                          <div id={idPanel} role="region" aria-label={`Detalle de ${g.description}`} className="anim-pop mx-3 mb-3 grid gap-3 rounded-lg border border-line bg-surface p-3 text-sm @min-[40rem]:grid-cols-2">
                            <div className="flex min-w-0 flex-col gap-1">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Información del movimiento</h4>
                              <p className="break-words"><b>{g.description}</b></p>
                              <p className="text-xs text-muted">{formatFechaLarga(g.expense_date)}</p>
                              <p className="flex flex-wrap items-center gap-1 text-xs">
                                <ChipK color={amb?.color_css}>{amb?.name}</ChipK>
                                <ChipK color={cat?.color_css}>{cat?.name}{sub ? ` › ${sub.name}` : ''}</ChipK>
                                <span className="text-muted">{g.expense_type === 'fixed' ? 'Fijo' : 'Variable'}{g.is_recurring ? ' · Recurrente' : ''} · {med?.name}</span>
                              </p>
                              {g.notes && <p className="break-words text-xs text-muted">Nota: {g.notes}</p>}
                            </div>
                            <div className="flex min-w-0 flex-col gap-1.5">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Distribución financiera</h4>
                              <p><span className="text-muted">Gasto total:</span> <b className="num">{formatSoles(Number(g.amount))}</b>{parcial && <span className="text-muted"> · a este fondo <b className="num text-fg">{formatSoles(Number(a.amount))}</b></span>}</p>
                              <ul className="flex flex-col gap-1">
                                {f.reparto.map((r) => (
                                  <li key={r.fund_id} className="flex items-center justify-between gap-3 rounded-md bg-surface-2/60 px-2.5 py-1 ring-1 ring-inset ring-line">
                                    <span className={cn('min-w-0 break-words', r.fund_id === tarjeta.id && 'font-semibold')}>{r.nombre}{r.fund_id === tarjeta.id && <span className="text-xs font-normal text-muted"> (este fondo)</span>}</span>
                                    <span className="num shrink-0 font-semibold">{formatSoles(r.monto)}</span>
                                  </li>
                                ))}
                              </ul>
                              {f.explicacion && <p className="text-xs text-muted">{f.explicacion}</p>}
                              {suma !== round2(Number(g.amount)) && <p className="text-xs text-bad" role="alert">Las imputaciones suman {formatSoles(suma)}, distinto del total del gasto.</p>}
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
