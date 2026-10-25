import { ArrowDown, ArrowUp, Copy, Eye, Lock, Pencil, Plus, Power, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Modal } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { MesSelector } from '@/components/ui/MesSelector'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { admite, resumirFondo, round2, type CambioFondos, type ResumenFondo } from '@/domain/fondos'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/lib/errors'
import { formatFecha, formatSoles, parseMontoNoNegativo, toIso } from '@/lib/format'
import type { Fila, Gasto } from '@/lib/tipos'
import { useCatalogo } from '@/features/catalogo/useCatalogo'
import { useGastosRango } from '@/features/gastos/useGastosRango'
import { usePerfil } from '@/features/perfil/usePerfil'
import { FondoForm, type FondoInicial } from './FondoForm'
import {
  mesDeFecha, useAsignacionesPeriodo, useFondoMutaciones, useFondos, usePeriodo, usePresupuestosPeriodo, useSnapshotsPeriodo,
  type FondoPayload,
} from './useFondos'

const MES_ACTUAL = mesDeFecha(new Date())
const HOY = toIso(new Date())

type FondoFila = Fila<'funds'>

interface Tarjeta {
  fondo: FondoFila | null
  nombre: string
  esGeneral: boolean
  icon: string | null
  color: string | null
  activo: boolean
  resumen: ResumenFondo
  id: string
}

interface Pendiente {
  titulo: string
  cambio: CambioFondos
  aplicar: () => Promise<unknown>
  exito: string
  alTerminar?: () => void
}

const TONO_ESTADO = { ok: 'ok', casi: 'warn', agotado: 'warn', negativo: 'bad' } as const

export function FondosPage() {
  const [params, setParams] = useSearchParams()
  const mes = params.get('mes') ?? MES_ACTUAL
  const perfil = usePerfil()
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'

  const catalogo = useCatalogo()
  const periodo = usePeriodo(mes)
  const fondosQ = useFondos()
  const presupuestos = usePresupuestosPeriodo(periodo.data?.id)
  const asignaciones = useAsignacionesPeriodo(periodo.data?.id)
  const gastos = useGastosRango(periodo.data?.start_date ?? '', periodo.data?.end_date ?? '', { habilitado: Boolean(periodo.data) })
  const cerrado = periodo.data?.status === 'closed'
  const snapshots = useSnapshotsPeriodo(periodo.data?.id, cerrado)
  const mut = useFondoMutaciones()

  const [form, setForm] = useState<FondoInicial | null>(null)
  const [detalle, setDetalle] = useState<string | null>(null)
  const [presupuestoDe, setPresupuestoDe] = useState<FondoFila | null>(null)
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const [bloqueo, setBloqueo] = useState<string | null>(null)
  const [cerrando, setCerrando] = useState(false)
  const [aplicando, setAplicando] = useState(false)

  const consultas = [catalogo, periodo, fondosQ, presupuestos, asignaciones, gastos]
  const cargando = consultas.some((q) => q.isPending) || (cerrado && snapshots.isPending)
  const falla = consultas.some((q) => q.isError) || (cerrado && snapshots.isError)

  const datos = useMemo(() => {
    if (!fondosQ.data || !presupuestos.data || !asignaciones.data) return null
    const consumo = new Map<string, number>()
    for (const a of asignaciones.data) consumo.set(a.fund_id, round2((consumo.get(a.fund_id) ?? 0) + Number(a.amount)))
    const asignado = new Map(presupuestos.data.map((b) => [b.fund_id, Number(b.assigned_amount)]))
    const gastosPorId = new Map<string, Gasto>((gastos.data ?? []).map((g) => [g.id, g]))
    const tarjetas: Tarjeta[] = fondosQ.data.fondos.map((f) => ({
      fondo: f, id: f.id, nombre: f.name, esGeneral: f.is_general, icon: f.icon_key, color: f.color_token, activo: f.is_active,
      resumen: resumirFondo(asignado.get(f.id) ?? 0, consumo.get(f.id) ?? 0),
    }))
    const orden = (a: Tarjeta, b: Tarjeta) => Number(a.esGeneral) - Number(b.esGeneral) || (a.fondo!.priority - b.fondo!.priority)
    return {
      activos: tarjetas.filter((t) => t.activo).sort(orden),
      inactivos: tarjetas.filter((t) => !t.activo).sort(orden),
      gastosPorId,
      asignado,
    }
  }, [fondosQ.data, presupuestos.data, asignaciones.data, gastos.data])

  const tarjetasCerradas: Tarjeta[] = useMemo(
    () =>
      (snapshots.data ?? [])
        .map((s) => ({
          fondo: null, id: s.fund_id, nombre: s.fund_name, esGeneral: s.is_general, icon: null, color: null, activo: true,
          resumen: resumirFondo(Number(s.assigned_amount), Number(s.consumed_amount)),
        }))
        .sort((a, b) => Number(a.esGeneral) - Number(b.esGeneral) || a.nombre.localeCompare(b.nombre)),
    [snapshots.data],
  )

  const lista = useMemo(() => (cerrado ? tarjetasCerradas : (datos?.activos ?? [])), [cerrado, tarjetasCerradas, datos])
  const totales = useMemo(() => {
    const asignado = round2(lista.reduce((s, t) => s + t.resumen.asignado, 0))
    const consumido = round2(lista.reduce((s, t) => s + t.resumen.consumido, 0))
    return { asignado, consumido, disponible: round2(asignado - consumido), sobregastos: lista.filter((t) => t.resumen.estado === 'negativo').length }
  }, [lista])

  function refrescarTodo() {
    consultas.forEach((q) => q.refetch())
    if (cerrado) snapshots.refetch()
  }

  /** Simula el cambio, explica su efecto y pide confirmación si afecta a gastos existentes. */
  async function solicitar(titulo: string, simular: () => Promise<CambioFondos>, aplicar: () => Promise<unknown>, exito: string, alTerminar?: () => void) {
    try {
      const c = await simular()
      if (c.blocked) {
        setBloqueo(c.blocked)
        return
      }
      if (!c.changed_expenses) {
        await aplicar()
        toast.success(exito)
        alTerminar?.()
        return
      }
      setPendiente({ titulo, cambio: c, aplicar, exito, alTerminar })
    } catch (e) {
      toast.error(mensajeDeError(e))
    }
  }

  async function confirmar() {
    if (!pendiente) return
    setAplicando(true)
    try {
      await pendiente.aplicar()
      toast.success(pendiente.exito)
      pendiente.alTerminar?.()
      setPendiente(null)
    } catch (e) {
      toast.error(mensajeDeError(e))
    } finally {
      setAplicando(false)
    }
  }

  function guardarFondo(payload: FondoPayload) {
    return solicitar('Guardar fondo', () => mut.simular.mutateAsync(payload), () => mut.guardar.mutateAsync(payload), 'Fondo guardado.', () => setForm(null))
  }

  function alternarActivo(f: FondoFila) {
    const payload: FondoPayload = { id: f.id, name: f.name, description: f.description ?? '', icon_key: f.icon_key ?? 'wallet', color_token: f.color_token ?? 'c1', is_general: f.is_general, default_amount: Number(f.default_amount), is_active: !f.is_active }
    return solicitar(f.is_active ? 'Desactivar fondo' : 'Activar fondo', () => mut.simular.mutateAsync(payload), () => mut.guardar.mutateAsync(payload), f.is_active ? 'Fondo desactivado.' : 'Fondo activado.')
  }

  function mover(t: Tarjeta, delta: -1 | 1) {
    const especificos = (datos?.activos ?? []).filter((x) => !x.esGeneral).map((x) => x.id)
    const i = especificos.indexOf(t.id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= especificos.length) return
    ;[especificos[i], especificos[j]] = [especificos[j], especificos[i]]
    return solicitar('Cambiar prioridad', () => mut.simularOrden.mutateAsync(especificos), () => mut.ordenar.mutateAsync(especificos), 'Prioridad actualizada.')
  }

  function abrirForm(f: FondoFila | null, clon = false) {
    const reglas = (id?: string) => ({
      alcance: id ? (fondosQ.data?.alcance ?? []).filter((r) => r.fund_id === id) : [],
      medios: id ? (fondosQ.data?.medios ?? []).filter((r) => r.fund_id === id) : [],
    })
    setForm({ fondo: f, clon, ...reglas(f?.id), presupuestoPeriodo: f ? datos?.asignado.get(f.id) : undefined })
  }

  if (cargando) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4" role="status" aria-label="Cargando fondos">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        <Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (falla || !periodo.data || !datos) return <ErrorState message="No se pudieron cargar los fondos." onRetry={refrescarTodo} />

  const p = periodo.data
  const hayGeneralActivo = (fondosQ.data?.fondos ?? []).some((f) => f.is_general && f.is_active)
  const puedeCerrar = p.status === 'open' && p.end_date < HOY
  const detalleFondo = detalle ? [...datos.activos, ...datos.inactivos].find((t) => t.id === detalle) : null

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <MesSelector mes={mes} onChange={(m) => setParams({ mes: m }, { replace: true })} maximo={MES_ACTUAL} />
          <Pill tone={cerrado ? 'neutral' : 'ok'}>{cerrado ? <><Lock className="size-3" aria-hidden="true" /> Período cerrado</> : 'Período abierto'}</Pill>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeCerrar && <Button variant="secondary" onClick={() => setCerrando(true)}>Cerrar período</Button>}
          {!cerrado && (
            <Button onClick={() => abrirForm(null)}>
              <Plus className="size-4" aria-hidden="true" /> Nuevo fondo
            </Button>
          )}
        </div>
      </div>

      {cerrado && <Alert tone="info">Este período está cerrado: se muestra el resultado histórico tal como quedó. Editar fondos hoy no lo modifica.</Alert>}

      <section aria-label="Resumen del período" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi etiqueta="Presupuesto asignado" valor={formatSoles(totales.asignado)} nota="Suma de fondos activos" />
        <Kpi etiqueta="Consumido" valor={formatSoles(totales.consumido)} nota="Gastos imputados a fondos" />
        <Kpi etiqueta="Disponible" valor={formatSoles(totales.disponible)} tono={totales.disponible < 0 ? 'bad' : 'ok'} nota={totales.disponible < 0 ? 'Hay sobregasto en el período' : 'Asignado menos consumido'} />
        <Kpi etiqueta="Fondos en sobregasto" valor={String(totales.sobregastos)} tono={totales.sobregastos ? 'bad' : undefined} nota="Con saldo negativo" />
      </section>

      {lista.length === 0 ? (
        <EmptyState icon={Wallet} title="Aún no hay fondos activos" description="Crea un fondo para asignar presupuesto a tus gastos." action={!cerrado && <Button onClick={() => abrirForm(null)}>Nuevo fondo</Button>} />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Fondos">
          {lista.map((t, idx) => {
            const especificos = lista.filter((x) => !x.esGeneral)
            const posEsp = especificos.findIndex((x) => x.id === t.id)
            return (
              <li key={t.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-2"><ItemIcon name={t.icon ?? 'wallet'} color={t.color ?? 'pri'} className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base font-bold">{t.nombre}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Pill tone={t.esGeneral ? 'pri' : 'neutral'}>{t.esGeneral ? 'Fondo General' : `Prioridad ${idx + 1}`}</Pill>
                      <Pill tone={TONO_ESTADO[t.resumen.estado]}>{etiquetaEstado(t)}</Pill>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn('num text-xl font-medium', t.resumen.disponible < 0 && 'text-bad')}>{formatSoles(t.resumen.disponible)}</p>
                    <p className="text-xs text-muted">disponible</p>
                  </div>
                </div>
                <div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`Consumo de ${t.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(t.resumen.pct))}>
                    <div className={cn('h-full rounded-full', t.resumen.estado === 'negativo' ? 'bg-bad' : t.resumen.estado === 'ok' ? 'bg-pri' : 'bg-acc')} style={{ width: `${Math.min(100, t.resumen.pct)}%` }} />
                  </div>
                  <p className="mt-1 flex justify-between text-xs text-muted">
                    <span className="num">Consumido {formatSoles(t.resumen.consumido)}</span>
                    <span className="num">Asignado {formatSoles(t.resumen.asignado)}</span>
                  </p>
                </div>
                {!cerrado && t.fondo && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="secondary" onClick={() => setDetalle(t.id)}><Eye className="size-4" aria-hidden="true" /> Ver gastos</Button>
                    <Button variant="secondary" onClick={() => abrirForm(t.fondo)} aria-label={`Editar ${t.nombre}`}><Pencil className="size-4" aria-hidden="true" /> Editar</Button>
                    <Button variant="secondary" onClick={() => setPresupuestoDe(t.fondo)}>Presupuesto del período</Button>
                    <Button variant="ghost" onClick={() => abrirForm(t.fondo, true)} aria-label={`Clonar ${t.nombre}`}><Copy className="size-4" aria-hidden="true" /> Clonar</Button>
                    {!t.esGeneral && (
                      <>
                        <Button variant="ghost" disabled={posEsp <= 0} onClick={() => mover(t, -1)} aria-label={`Subir prioridad de ${t.nombre}`}><ArrowUp className="size-4" aria-hidden="true" /></Button>
                        <Button variant="ghost" disabled={posEsp === especificos.length - 1} onClick={() => mover(t, 1)} aria-label={`Bajar prioridad de ${t.nombre}`}><ArrowDown className="size-4" aria-hidden="true" /></Button>
                      </>
                    )}
                    <Button variant="ghost" onClick={() => alternarActivo(t.fondo!)} aria-label={`Desactivar ${t.nombre}`}><Power className="size-4" aria-hidden="true" /> Desactivar</Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!cerrado && datos.inactivos.length > 0 && (
        <section aria-label="Fondos inactivos" className="flex flex-col gap-2">
          <h2 className="font-display text-base font-bold">Fondos inactivos</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {datos.inactivos.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <ItemIcon name={t.icon ?? 'wallet'} color={t.color ?? 'muted'} />
                <span className="flex-1 font-medium">{t.nombre}</span>
                <Pill>Inactivo</Pill>
                <Button variant="secondary" onClick={() => alternarActivo(t.fondo!)} aria-label={`Activar ${t.nombre}`}>Activar</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {form && catalogo && (
        <FondoForm
          catalogo={catalogo}
          inicial={form}
          hayGeneralActivo={hayGeneralActivo}
          periodoAbierto={p.status === 'open'}
          periodId={p.id}
          cargando={mut.simular.isPending || mut.guardar.isPending}
          onClose={() => setForm(null)}
          onSubmit={guardarFondo}
        />
      )}

      {detalleFondo && (
        <DetalleFondo
          tarjeta={detalleFondo}
          asignaciones={(asignaciones.data ?? []).filter((a) => a.fund_id === detalleFondo.id)}
          gastos={datos.gastosPorId}
          fondosQ={fondosQ.data!}
          todas={asignaciones.data ?? []}
          formato={formato}
          onClose={() => setDetalle(null)}
        />
      )}

      {presupuestoDe && (
        <PresupuestoDialog
          fondo={presupuestoDe}
          actual={datos.asignado.get(presupuestoDe.id) ?? 0}
          cargando={mut.simularPresupuesto.isPending || mut.presupuesto.isPending}
          onClose={() => setPresupuestoDe(null)}
          onSubmit={(amount) => {
            const v = { fund: presupuestoDe.id, period: p.id, amount }
            return solicitar('Cambiar presupuesto del período', () => mut.simularPresupuesto.mutateAsync(v), () => mut.presupuesto.mutateAsync(v), 'Presupuesto actualizado.', () => setPresupuestoDe(null))
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendiente)}
        onOpenChange={(o) => !o && !aplicando && setPendiente(null)}
        title={pendiente?.titulo ?? ''}
        confirmLabel="Aplicar cambios"
        loading={aplicando}
        onConfirm={confirmar}
        description={pendiente && <EfectoCambio cambio={pendiente.cambio} fondos={fondosQ.data!.fondos} />}
      />

      <Modal open={Boolean(bloqueo)} onOpenChange={(o) => !o && setBloqueo(null)} title="No se puede guardar este cambio" size="sm">
        <div className="flex flex-col gap-4">
          <Alert tone="error">{bloqueo}</Alert>
          <p className="text-sm text-muted">Con estas reglas algún gasto existente quedaría sin ningún fondo que lo admita. Ajusta las reglas o la clasificación del gasto y vuelve a intentarlo.</p>
          <div className="flex justify-end"><Button onClick={() => setBloqueo(null)}>Entendido</Button></div>
        </div>
      </Modal>

      <ConfirmDialog
        open={cerrando}
        onOpenChange={setCerrando}
        title={`¿Cerrar ${p.start_date.slice(0, 7)}?`}
        description="El resultado de cada fondo queda guardado como histórico. Después no se podrán crear, editar ni anular gastos de este período, ni cambiar sus presupuestos."
        confirmLabel="Cerrar período"
        loading={mut.cerrarPeriodo.isPending}
        onConfirm={() =>
          mut.cerrarPeriodo.mutate(p.id, {
            onSuccess: () => { toast.success('Período cerrado.'); setCerrando(false) },
            onError: (e) => { toast.error(mensajeDeError(e)); setCerrando(false) },
          })
        }
      />
    </div>
  )
}

function etiquetaEstado(t: Tarjeta): string {
  switch (t.resumen.estado) {
    case 'negativo': return t.esGeneral ? 'Saldo negativo' : 'Sobregasto'
    case 'agotado': return 'Agotado'
    case 'casi': return 'Casi agotado'
    default: return 'Con saldo'
  }
}

function Kpi({ etiqueta, valor, nota, tono }: { etiqueta: string; valor: string; nota: string; tono?: 'ok' | 'bad' }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3">
      <span className="text-sm text-muted">{etiqueta}</span>
      <span className={cn('num text-2xl font-medium', tono === 'bad' && 'text-bad', tono === 'ok' && 'text-ok')}>{valor}</span>
      <span className="text-xs text-muted">{nota}</span>
    </div>
  )
}

function EfectoCambio({ cambio, fondos }: { cambio: CambioFondos; fondos: FondoFila[] }) {
  const nombres = new Map(fondos.map((f) => [f.id, f.name]))
  const ids = Array.from(new Set([...Object.keys(cambio.consumption_before), ...Object.keys(cambio.consumption_after ?? {})]))
  const filas = ids
    .map((id) => ({ id, antes: cambio.consumption_before[id] ?? 0, despues: cambio.consumption_after?.[id] ?? 0 }))
    .filter((f) => round2(f.antes) !== round2(f.despues))
  return (
    <div className="flex flex-col gap-3">
      <p>
        Este cambio recalcula los períodos abiertos y modifica la imputación de <b>{cambio.changed_expenses}</b> {cambio.changed_expenses === 1 ? 'gasto' : 'gastos'}. Los períodos cerrados no cambian.
      </p>
      {filas.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs text-muted"><th className="py-1">Fondo</th><th className="py-1 text-right">Consumo antes</th><th className="py-1 text-right">Después</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-line">
                <td className="py-1.5">{nombres.get(f.id) ?? 'Fondo'}</td>
                <td className="num py-1.5 text-right">{formatSoles(f.antes)}</td>
                <td className="num py-1.5 text-right font-semibold text-fg">{formatSoles(f.despues)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function PresupuestoDialog({ fondo, actual, cargando, onClose, onSubmit }: { fondo: FondoFila; actual: number; cargando: boolean; onClose: () => void; onSubmit: (n: number) => void }) {
  const [valor, setValor] = useState(actual.toFixed(2))
  const n = parseMontoNoNegativo(valor)
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Presupuesto del período · ${fondo.name}`} description="Cambia solo este período. El importe por defecto del fondo no se modifica." size="sm">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (n !== null) onSubmit(n)
        }}
      >
        <Field label="Importe asignado (S/)" error={n === null ? 'Ingresa un importe válido.' : undefined}>
          {(p) => <MoneyInput {...p} value={valor} onChange={setValor} invalid={n === null} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={cargando}>Cancelar</Button>
          <Button type="submit" loading={cargando} disabled={n === null}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}

function DetalleFondo({
  tarjeta, asignaciones, gastos, fondosQ, todas, formato, onClose,
}: {
  tarjeta: Tarjeta
  asignaciones: Fila<'expense_fund_allocations'>[]
  gastos: Map<string, Gasto>
  fondosQ: { fondos: FondoFila[]; alcance: Fila<'fund_scope_rules'>[]; medios: Fila<'fund_payment_rules'>[] }
  todas: Fila<'expense_fund_allocations'>[]
  formato: string
  onClose: () => void
}) {
  const filas = asignaciones
    .map((a) => ({ a, g: gastos.get(a.expense_id) }))
    .filter((x): x is { a: Fila<'expense_fund_allocations'>; g: Gasto } => Boolean(x.g))
    .sort((x, y) => x.g.expense_date.localeCompare(y.g.expense_date))

  // Origen del excedente: fondos específicos que admiten ese gasto (según las reglas actuales).
  function origen(g: Gasto, a: Fila<'expense_fund_allocations'>): string | null {
    if (!tarjeta.esGeneral || a.allocation_kind !== 'general') return null
    const especificos = fondosQ.fondos.filter((f) => !f.is_general && f.is_active && admite(
      fondosQ.alcance.filter((r) => r.fund_id === f.id),
      fondosQ.medios.filter((r) => r.fund_id === f.id),
      { ambito_id: g.ambito_id, categoria_id: g.categoria_id, subcategoria_id: g.subcategoria_id, payment_method_id: g.payment_method_id },
    ))
    return especificos.length ? `Excedente de ${especificos.map((f) => f.name).join(', ')}` : null
  }

  const excedente = round2(filas.reduce((s, { a, g }) => s + (origen(g, a) ? Number(a.amount) : 0), 0))
  const otrosFondos = (id: string) => todas.filter((x) => x.expense_id === id && x.fund_id !== tarjeta.id)

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Gastos imputados · ${tarjeta.nombre}`} size="lg">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Consumido <b className="num text-fg">{formatSoles(tarjeta.resumen.consumido)}</b> de <span className="num">{formatSoles(tarjeta.resumen.asignado)}</span>.
          {tarjeta.esGeneral && excedente > 0 && <> Excedente recibido de fondos específicos: <b className="num text-fg">{formatSoles(excedente)}</b>.</>}
        </p>
        {filas.length === 0 ? (
          <EmptyState title="Sin gastos imputados" description="Los gastos que consuman este fondo aparecerán aquí." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-xs uppercase tracking-wide text-muted"><th className="py-2">Fecha</th><th className="py-2">Descripción</th><th className="py-2">Detalle</th><th className="py-2 text-right">Imputado</th></tr></thead>
              <tbody>
                {filas.map(({ a, g }) => {
                  const o = origen(g, a)
                  const otros = otrosFondos(g.id)
                  return (
                    <tr key={a.id} className="border-t border-line">
                      <td className="num whitespace-nowrap py-2">{formatFecha(g.expense_date, formato)}</td>
                      <td className="py-2">{g.description}</td>
                      <td className="py-2">
                        {o ? <Pill tone="warn">{o}</Pill> : otros.length ? <Pill tone="neutral">Compartido con {otros.length} fondo(s)</Pill> : <span className="text-muted">Directo</span>}
                      </td>
                      <td className="num whitespace-nowrap py-2 text-right">
                        {formatSoles(Number(a.amount))}
                        {Number(a.amount) < Number(g.amount) && <span className="block text-xs text-muted">de {formatSoles(Number(g.amount))}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
