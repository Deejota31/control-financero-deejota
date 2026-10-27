import { Banknote, Lock, Percent, Plus, Search, TriangleAlert, Wallet } from 'lucide-react'
import { useMemo, useState, type ComponentType } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Modal } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { MesSelector } from '@/components/ui/MesSelector'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { DetalleFondo } from './DetalleFondo'
import { cambiosPorPeriodo, resumirFondo, round2, type CambioFondos, type ResumenFondo } from '@/domain/fondos'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/lib/errors'
import { errorImporte, formatMes, formatSoles, parseMontoNoNegativo, toIso } from '@/lib/format'
import type { Fila, Gasto } from '@/lib/tipos'
import { useCatalogo } from '@/features/catalogo/useCatalogo'
import { useGastosRango } from '@/features/gastos/useGastosRango'
import { usePerfil } from '@/features/perfil/usePerfil'
import { EliminarFondoDialog } from './EliminarFondoDialog'
import { FondoForm, type FondoInicial } from './FondoForm'
import { TablaFondos, type FilaFondo } from './TablaFondos'
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
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'activos' | 'inactivos' | 'todos'>('activos')
  const [eliminarDe, setEliminarDe] = useState<FondoFila | null>(null)

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
    const orden = (a: Tarjeta, b: Tarjeta) => Number(b.esGeneral) - Number(a.esGeneral) || (a.fondo!.priority - b.fondo!.priority)
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
        .sort((a, b) => Number(b.esGeneral) - Number(a.esGeneral) || a.nombre.localeCompare(b.nombre)),
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
  async function solicitar(titulo: string, simular: () => Promise<CambioFondos>, aplicar: () => Promise<unknown>, exito: string, alTerminar?: () => void, vista?: Parameters<typeof mut.vistaPrevia.mutateAsync>[0]) {
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
      // Detalle por período (informativo): si no se puede obtener, se muestra el resumen general.
      let cambio = c
      if (vista) {
        try {
          const v = await mut.vistaPrevia.mutateAsync(vista)
          if (!v.blocked) cambio = { ...c, periodos: { before: v.before, after: v.after } }
        } catch { /* sin detalle por período */ }
      }
      setPendiente({ titulo, cambio, aplicar, exito, alTerminar })
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
    return solicitar(`Guardar cambios de «${payload.name}»`, () => mut.simular.mutateAsync(payload), () => mut.guardar.mutateAsync(payload), 'Fondo guardado.', () => setForm(null), { kind: 'save_fund', args: payload })
  }

  function alternarActivo(f: FondoFila) {
    const payload: FondoPayload = { id: f.id, name: f.name, description: f.description ?? '', icon_key: f.icon_key ?? 'wallet', color_token: f.color_token ?? 'c1', is_general: f.is_general, default_amount: Number(f.default_amount), is_active: !f.is_active }
    return solicitar(`${f.is_active ? 'Desactivar' : 'Activar'} «${f.name}»`, () => mut.simular.mutateAsync(payload), () => mut.guardar.mutateAsync(payload), f.is_active ? 'Fondo desactivado.' : 'Fondo activado.', undefined, { kind: 'save_fund', args: payload })
  }

  function mover(t: Tarjeta, delta: -1 | 1) {
    const especificos = (datos?.activos ?? []).filter((x) => !x.esGeneral).map((x) => x.id)
    const i = especificos.indexOf(t.id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= especificos.length) return
    ;[especificos[i], especificos[j]] = [especificos[j], especificos[i]]
    return solicitar(`Cambiar la prioridad de «${t.nombre}»`, () => mut.simularOrden.mutateAsync(especificos), () => mut.ordenar.mutateAsync(especificos), 'Prioridad actualizada.', undefined, { kind: 'reorder_funds', args: { ids: especificos } })
  }

  /** Arrastrar un fondo antes de otro: mismo cambio de prioridad que «Subir/Bajar», con su simulación previa. */
  function reordenar(idDestino: string, idOrigen: string) {
    const ids = (datos?.activos ?? []).filter((x) => !x.esGeneral).map((x) => x.id)
    if (!ids.includes(idOrigen) || !ids.includes(idDestino)) return
    const nuevo = ids.filter((x) => x !== idOrigen)
    nuevo.splice(nuevo.indexOf(idDestino), 0, idOrigen)
    return solicitar(`Cambiar la prioridad de «${datos?.activos.find((x) => x.id === idOrigen)?.nombre ?? 'fondo'}»`, () => mut.simularOrden.mutateAsync(nuevo), () => mut.ordenar.mutateAsync(nuevo), 'Prioridad actualizada.', undefined, { kind: 'reorder_funds', args: { ids: nuevo } })
  }

  function abrirForm(f: FondoFila | null, clon = false) {
    const reglas = (id?: string) => ({
      alcance: id ? (fondosQ.data?.alcance ?? []).filter((r) => r.fund_id === id) : [],
      medios: id ? (fondosQ.data?.medios ?? []).filter((r) => r.fund_id === id) : [],
    })
    setForm({ fondo: f, clon, ...reglas(f?.id), presupuestoPeriodo: f ? datos?.asignado.get(f.id) : undefined })
  }

  const porId = new Map((fondosQ.data?.fondos ?? []).map((f) => [f.id, f]))
  const filasTabla: FilaFondo[] = (cerrado ? tarjetasCerradas : [...(datos?.activos ?? []), ...(datos?.inactivos ?? [])]).map((t) => ({
    id: t.id, nombre: t.nombre, esGeneral: t.esGeneral, icon: t.icon, color: t.color, activo: t.activo, resumen: t.resumen, editable: !cerrado && Boolean(t.fondo),
  }))
  const visibles = filasTabla.filter((f) => (cerrado || filtro === 'todos' || (filtro === 'activos') === f.activo) && f.nombre.toLowerCase().includes(q.trim().toLowerCase()))
  const posicion = new Map((datos?.activos ?? []).filter((x) => !x.esGeneral).map((x, i) => [x.id, i + 1]))
  const fondoDe = (f: FilaFondo) => porId.get(f.id)!

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
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <MesSelector mes={mes} onChange={(m) => setParams({ mes: m }, { replace: true })} maximo={MES_ACTUAL} />
        <Pill tone={cerrado ? 'neutral' : 'ok'}>{cerrado ? <><Lock className="size-3" aria-hidden="true" /> Período cerrado</> : 'Período abierto'}</Pill>
        <label className="flex w-64 max-w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-muted focus-within:border-pri">
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar fondo por nombre…" aria-label="Buscar fondo" className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted" />
        </label>
        {!cerrado && (
          <div role="group" aria-label="Estado" className="inline-flex rounded-lg bg-surface-2 p-0.5 text-sm font-semibold">
            {([['activos', 'Activos'], ['inactivos', 'Inactivos'], ['todos', 'Todos']] as const).map(([k, n]) => (
              <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)} className={cn('rounded-md px-3 py-1', filtro === k ? 'bg-surface text-pri shadow-sm' : 'text-muted')}>{n}</button>
            ))}
          </div>
        )}
        <span className="flex-1" />
        {puedeCerrar && <Button variant="secondary" onClick={() => setCerrando(true)}>Cerrar período</Button>}
        {!cerrado && <Button onClick={() => abrirForm(null)}><Plus className="size-4" aria-hidden="true" /> Nuevo fondo</Button>}
      </div>

      {cerrado && <Alert tone="info">Este período está cerrado: se muestra el resultado histórico tal como quedó. Editar fondos hoy no lo modifica.</Alert>}

      <section aria-label="Resumen del período" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi etiqueta="Presupuesto asignado" valor={formatSoles(totales.asignado)} nota="Suma de fondos activos" icono={Wallet} />
        <Kpi etiqueta="Consumido" valor={formatSoles(totales.consumido)} nota="Gastos imputados a fondos" icono={Banknote} />
        <Kpi etiqueta="Disponible" valor={formatSoles(totales.disponible)} tono={totales.disponible < 0 ? 'bad' : 'ok'} nota={totales.disponible < 0 ? 'Hay sobregasto' : 'Asignado − consumido'} icono={Percent} />
        <Kpi etiqueta="Fondos en sobregasto" valor={String(totales.sobregastos)} tono={totales.sobregastos ? 'bad' : undefined} nota="Con saldo negativo" icono={TriangleAlert} />
      </section>

      {filasTabla.length === 0 || lista.length === 0 && filtro === 'activos' && !cerrado && datos.inactivos.length === 0 ? (
        <EmptyState icon={Wallet} title="Aún no hay fondos" description="Crea un fondo para asignar presupuesto a tus gastos. Empieza con el Fondo General, que absorbe el excedente de los demás." action={!cerrado && <Button onClick={() => abrirForm(null)}>Nuevo fondo</Button>} />
      ) : visibles.length === 0 ? (
        <EmptyState icon={Wallet} title="Ningún fondo coincide" description="Prueba con otro nombre o cambia el filtro de estado." action={<Button variant="secondary" onClick={() => { setQ(''); setFiltro('todos') }}>Ver todos</Button>} />
      ) : (
        <TablaFondos
          filas={visibles}
          posicion={posicion}
          totalEspecificos={posicion.size}
          permitirOrdenar={!cerrado && filtro !== 'inactivos' && !q}
          onVer={(f) => setDetalle(f.id)}
          onEditar={(f) => abrirForm(fondoDe(f))}
          onPresupuesto={(f) => setPresupuestoDe(fondoDe(f))}
          onClonar={(f) => abrirForm(fondoDe(f), true)}
          onMover={(f, d) => mover({ id: f.id } as Tarjeta, d)}
          onActivar={(f) => alternarActivo(fondoDe(f))}
          onEliminar={(f) => setEliminarDe(fondoDe(f))}
          onReordenar={reordenar}
        />
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
          periodo={formatMes(p.start_date)}
          cerrado={cerrado}
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
            return solicitar(`Presupuesto del período de «${presupuestoDe.name}»`, () => mut.simularPresupuesto.mutateAsync(v), () => mut.presupuesto.mutateAsync(v), 'Presupuesto actualizado.', () => setPresupuestoDe(null), { kind: 'set_fund_period_budget', args: v })
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

      {eliminarDe && (
        <EliminarFondoDialog
          fondo={{ id: eliminarDe.id, nombre: eliminarDe.name }}
          onClose={() => setEliminarDe(null)}
          onDesactivar={eliminarDe.is_active ? () => alternarActivo(eliminarDe) : undefined}
        />
      )}

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

function Kpi({ etiqueta, valor, nota, tono, icono: Icono }: { etiqueta: string; valor: string; nota: string; tono?: 'ok' | 'bad'; icono: ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', tono === 'bad' ? 'bg-bad-soft text-bad' : 'bg-pri-soft text-pri')}><Icono className="size-[18px]" aria-hidden="true" /></span>
      <div className="min-w-0">
        <span className="block text-xs text-muted">{etiqueta}</span>
        <span className={cn('num block text-lg font-semibold leading-tight', tono === 'bad' && 'text-bad', tono === 'ok' && 'text-ok')}>{valor}</span>
        <span className="block truncate text-[11px] text-muted">{nota}</span>
      </div>
    </div>
  )
}

function EfectoCambio({ cambio, fondos }: { cambio: CambioFondos; fondos: FondoFila[] }) {
  const nombres = new Map(fondos.map((f) => [f.id, f.name]))
  const porPeriodo = cambio.periodos?.after ? cambiosPorPeriodo(cambio.periodos.before, cambio.periodos.after) : null
  const ids = Array.from(new Set([...Object.keys(cambio.consumption_before), ...Object.keys(cambio.consumption_after ?? {})]))
  const filas = ids
    .map((id) => ({ id, antes: cambio.consumption_before[id] ?? 0, despues: cambio.consumption_after?.[id] ?? 0 }))
    .filter((f) => round2(f.antes) !== round2(f.despues))
  return (
    <div className="flex flex-col gap-3">
      <p>
        Este cambio recalcula los períodos abiertos y modifica la imputación de <b>{cambio.changed_expenses}</b> {cambio.changed_expenses === 1 ? 'gasto' : 'gastos'}. Los períodos cerrados no cambian.
      </p>
      {porPeriodo && porPeriodo.length > 0 ? (
        <div className="flex max-h-[min(50dvh,22rem)] flex-col gap-3 overflow-y-auto pr-1">
          <p className="text-xs text-muted">Cada período se calcula por separado; no se suman entre sí.</p>
          {porPeriodo.map((p) => (
            <section key={p.period_id} aria-label={`Período ${formatMes(p.start)}`} className="rounded-lg border border-line">
              <h4 className="border-b border-line bg-surface-2 px-3 py-1.5 text-sm font-semibold">{formatMes(p.start)}</h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] text-left text-sm">
                  <thead><tr className="text-xs text-muted"><th className="px-3 py-1">Fondo</th><th className="px-2 py-1 text-right">Asignado</th><th className="px-2 py-1 text-right">Consumo</th><th className="px-3 py-1 text-right">Impacto</th></tr></thead>
                  <tbody>
                    {p.filas.map((x) => (
                      <tr key={x.fund_id} className="border-t border-line align-top">
                        <td className="px-3 py-1.5">{x.nombre}</td>
                        <td className="num px-2 py-1.5 text-right">{x.asignadoAntes === x.asignadoDespues ? formatSoles(x.asignadoAntes) : <>{formatSoles(x.asignadoAntes)} → <b>{formatSoles(x.asignadoDespues)}</b></>}</td>
                        <td className="num px-2 py-1.5 text-right">{x.consumoAntes === x.consumoDespues ? formatSoles(x.consumoAntes) : <>{formatSoles(x.consumoAntes)} → <b>{formatSoles(x.consumoDespues)}</b></>}</td>
                        <td className={cn('num px-3 py-1.5 text-right font-semibold', x.impacto > 0 && 'text-ok', x.impacto < 0 && 'text-bad')}>{x.impacto > 0 ? '+' : x.impacto < 0 ? '−' : ''}{formatSoles(Math.abs(x.impacto))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          <p className="text-xs text-muted">Impacto = cambio en lo disponible del fondo (asignado − consumo) en ese período.</p>
        </div>
      ) : (
        filas.length > 0 && (
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
        )
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
        <Field label="Importe asignado (S/)" error={errorImporte(valor, { permitirCero: true }) ?? undefined}>
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

