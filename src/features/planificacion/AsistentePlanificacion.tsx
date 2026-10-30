import { Check, FileStack, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { Pill, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/lib/errors'
import { formatMes, formatSoles } from '@/lib/format'
import { useCatalogo } from '@/features/catalogo/useCatalogo'
import { ListaCopiaFondos, textoResultadoCopia, useCopiaFondos } from '@/features/fondos/CopiarFondos'
import { finDeMes, sumarMeses, useFondos, usePeriodo, usePresupuestosPeriodo, type ResultadoCopia } from '@/features/fondos/useFondos'
import { LoteDialog, PlantillasDialog } from '@/features/gastos/Plantillas'
import { useEstadoLote, usePlantillas } from '@/features/gastos/usePlantillas'
import { ETIQUETA_ESTADO, ETIQUETA_ETAPA, useGuardarPlan, useResumenPlan, type EtapaPlan, type ResumenPlan } from './usePlanificacion'

type Paso = 1 | 2 | 3
const PASOS: { n: Paso; titulo: string }[] = [
  { n: 1, titulo: 'Fondos' },
  { n: 2, titulo: 'Gastos' },
  { n: 3, titulo: 'Resumen' },
]

const TONO_ETAPA: Record<EtapaPlan, 'neutral' | 'ok' | 'warn'> = { pending: 'neutral', done: 'ok', skipped: 'warn' }

/**
 * Asistente de planificación de un mes en tres etapas (fondos, gastos habituales y resumen). Cada etapa se guarda al confirmarla, así que se puede
 * cerrar y retomar. Nada se crea por abrir el asistente: los fondos y los gastos solo existen cuando se confirman explícitamente.
 */
export function AsistentePlanificacion({ mes, onClose }: { mes: string; onClose: () => void }) {
  const resumen = useResumenPlan(mes)
  const guardar = useGuardarPlan()
  const [paso, setPaso] = useState<Paso>(1)
  const iniciado = useRef(false)
  const plan = resumen.data?.plan ?? null

  // Retoma donde se quedó: primera etapa pendiente (o el resumen si ya están resueltas).
  useEffect(() => {
    if (!resumen.data || iniciado.current) return
    iniciado.current = true
    const p = resumen.data.plan
    setPaso(!p || p.funds_stage === 'pending' ? 1 : p.expenses_stage === 'pending' ? 2 : 3)
  }, [resumen.data])

  async function marcar(etapa: 'funds_stage' | 'expenses_stage', valor: EtapaPlan) {
    try {
      await guardar.mutateAsync({ mes, patch: { [etapa]: valor } })
      return true
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudo guardar la planificación.'))
      return false
    }
  }

  const etapas: Record<'funds_stage' | 'expenses_stage', EtapaPlan> = { funds_stage: plan?.funds_stage ?? 'pending', expenses_stage: plan?.expenses_stage ?? 'pending' }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Planificación · ${formatMes(mes)}`} size="xl"
      description="Prepara los fondos y los gastos habituales del mes. Puedes cerrar y retomarlo cuando quieras."
      footer={null}>
      <div className="flex min-w-0 flex-col gap-4">
        <ol className="grid grid-cols-3 gap-2" aria-label="Etapas de la planificación">
          {PASOS.map((p) => {
            const etapa = p.n === 1 ? etapas.funds_stage : p.n === 2 ? etapas.expenses_stage : plan?.status === 'completed' ? 'done' : 'pending'
            return (
              <li key={p.n} aria-current={paso === p.n ? 'step' : undefined}>
                <button type="button" onClick={() => setPaso(p.n)}
                  className={cn('flex w-full min-w-0 items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-sm transition-colors sm:gap-2 sm:px-2.5', paso === p.n ? 'border-pri bg-pri-soft font-semibold' : 'border-line hover:bg-surface-2')}>
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold', etapa === 'done' ? 'bg-ok text-pri-fg' : etapa === 'skipped' ? 'bg-warn text-pri-fg' : 'bg-surface-2 text-muted')}>
                    {etapa === 'done' ? <Check className="size-3.5" aria-hidden="true" /> : p.n}
                  </span>
                  <span className="min-w-0"><span className="block truncate">{p.titulo}</span><span className="hidden text-xs font-normal text-muted sm:block">{p.n === 3 ? (plan?.status === 'completed' ? 'Finalizada' : 'Por finalizar') : ETIQUETA_ETAPA[etapa as EtapaPlan]}</span></span>
                </button>
              </li>
            )
          })}
        </ol>

        {resumen.isPending ? (
          <div role="status" aria-label="Cargando planificación" className="flex flex-col gap-2"><Skeleton className="h-16" /><Skeleton className="h-32" /></div>
        ) : resumen.isError ? (
          <Alert tone="error">No se pudo cargar la planificación. Cierra y vuelve a abrirla.</Alert>
        ) : paso === 1 ? (
          <PasoFondos mes={mes} etapa={etapas.funds_stage} onEtapa={(v) => marcar('funds_stage', v)} onSiguiente={() => setPaso(2)} onCerrar={onClose} />
        ) : paso === 2 ? (
          <PasoGastos mes={mes} etapa={etapas.expenses_stage} onEtapa={(v) => marcar('expenses_stage', v)} onAnterior={() => setPaso(1)} onSiguiente={() => setPaso(3)} />
        ) : (
          <PasoResumen mes={mes} resumen={resumen.data} onAnterior={() => setPaso(2)} onIrAPaso={setPaso} onCerrar={onClose}
            onFinalizar={async () => { if (await guardarFinal()) { toast.success(`Planificación de ${formatMes(mes)} finalizada.`); onClose() } }} cargando={guardar.isPending} />
        )}
      </div>
    </Modal>
  )

  async function guardarFinal() {
    try {
      await guardar.mutateAsync({ mes, patch: { status: 'completed' } })
      return true
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudo finalizar la planificación.'))
      return false
    }
  }
}

function Navegacion({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">{children}</div>
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Etapa 1 · Fondos
// ---------------------------------------------------------------------------------------------------------------------------------------------
function PasoFondos({ mes, etapa, onEtapa, onSiguiente, onCerrar }: { mes: string; etapa: EtapaPlan; onEtapa: (v: EtapaPlan) => Promise<boolean>; onSiguiente: () => void; onCerrar: () => void }) {
  const navigate = useNavigate()
  const periodo = usePeriodo(mes)
  const fondos = useFondos(periodo.data?.id)
  const presupuestos = usePresupuestosPeriodo(periodo.data?.id)
  const copia = useCopiaFondos(mes)
  const [resultado, setResultado] = useState<ResultadoCopia | null>(null)

  const existentes = (fondos.data?.fondos ?? []).filter((f) => f.is_active)
  const asignado = new Map((presupuestos.data ?? []).map((b) => [b.fund_id, Number(b.assigned_amount)]))
  const cerrado = periodo.data?.status === 'closed'

  async function confirmar() {
    const r = await copia.confirmar()
    if (!r) return
    setResultado(r)
    toast.success(textoResultadoCopia(r, mes))
    await onEtapa('done')
  }

  async function continuar() {
    // Con fondos en el mes la etapa queda confirmada; sin ninguno se registra como omitida (no se inventa nada).
    if (etapa === 'pending') await onEtapa(existentes.length > 0 ? 'done' : 'skipped')
    onSiguiente()
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <h3 className="font-display text-lg font-bold">Prepara tus fondos de {formatMes(mes)}</h3>
        <p className="text-sm text-muted">Cada mes tiene sus propios fondos. Elige cuáles reutilizar del mes anterior (o de otro) y ajusta sus importes: no se crea nada hasta que confirmes.</p>
      </div>

      {cerrado && <Alert tone="info">Este mes está cerrado: su histórico no se modifica y no admite fondos nuevos.</Alert>}

      <section aria-label={`Fondos de ${formatMes(mes)}`} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Fondos de este mes</h4>
          <Pill tone={existentes.length ? 'ok' : 'neutral'}>{existentes.length} {existentes.length === 1 ? 'fondo' : 'fondos'}</Pill>
        </div>
        {periodo.isPending || fondos.isPending ? <Skeleton className="h-10" /> : existentes.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-3 py-2 text-sm text-muted">Todavía no tienes fondos configurados para {formatMes(mes)}.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {existentes.map((f) => (
              <li key={f.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                <span className="flex min-w-0 items-center gap-2"><ItemIcon name={f.icon_key ?? 'wallet'} color={f.color_token ?? 'c1'} /><span className="truncate">{f.name}</span></span>
                <span className="num shrink-0 font-semibold">{formatSoles(asignado.get(f.id) ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!cerrado && (
        <section aria-label="Fondos sugeridos" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Fondos sugeridos de otro mes</h4>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => copia.setOrigen(sumarMeses(mes, -1))}>Usar mes anterior</Button>
              <Button variant="secondary" onClick={() => { navigate(`/fondos?mes=${mes}&nuevo=1`); onCerrar() }}><Plus className="size-4" aria-hidden="true" /> Crear nuevo fondo</Button>
            </div>
          </div>
          <ListaCopiaFondos copia={copia} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted" aria-live="polite">{copia.seleccionados.length} de {copia.copiables.length} seleccionados · <b className="num text-fg">{formatSoles(copia.total)}</b></p>
            <Button onClick={confirmar} loading={copia.copiando} disabled={copia.seleccionados.length === 0 || copia.importeInvalido || copia.cargando}>
              {copia.copiando ? 'Creando…' : 'Confirmar fondos'}
            </Button>
          </div>
        </section>
      )}

      {resultado && (
        <Alert tone="success">
          <p className="font-semibold">Resumen de fondos</p>
          <p>Creados: {resultado.created.length}{resultado.created.length ? ` (${resultado.created.map((c) => c.name).join(', ')})` : ''}. Omitidos: {resultado.skipped.length}. Conservados: {existentes.length - resultado.created.length < 0 ? 0 : existentes.length - resultado.created.length}.</p>
        </Alert>
      )}

      <Navegacion>
        <Button variant="secondary" onClick={async () => { if (await onEtapa('skipped')) onSiguiente() }}>Omitir etapa</Button>
        <Button onClick={continuar}>Continuar</Button>
      </Navegacion>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Etapa 2 · Gastos mensuales (plantillas)
// ---------------------------------------------------------------------------------------------------------------------------------------------
function PasoGastos({ mes, etapa, onEtapa, onAnterior, onSiguiente }: { mes: string; etapa: EtapaPlan; onEtapa: (v: EtapaPlan) => Promise<boolean>; onAnterior: () => void; onSiguiente: () => void }) {
  const catalogo = useCatalogo()
  const plantillas = usePlantillas()
  const periodo = usePeriodo(mes)
  const estado = useEstadoLote(periodo.data?.id, mes, finDeMes(mes))
  const [lote, setLote] = useState(false)
  const [gestion, setGestion] = useState(false)

  const activas = (plantillas.data ?? []).filter((p) => p.is_active)
  const nombre = (lista: { id: string; name: string }[], id: string | null) => lista.find((x) => x.id === id)?.name
  const registradas = activas.filter((p) => estado.data?.registradas.has(p.id)).length
  const noAplica = activas.filter((p) => !estado.data?.registradas.has(p.id) && estado.data?.noAplica.has(p.id)).length
  const pendientes = activas.length - registradas - noAplica

  async function continuar() {
    if (etapa === 'pending') await onEtapa(registradas > 0 ? 'done' : 'skipped')
    onSiguiente()
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <h3 className="font-display text-lg font-bold">Prepara tus gastos de {formatMes(mes)}</h3>
        <p className="text-sm text-muted">Una plantilla es una configuración reutilizable, no un gasto: solo afecta a tus fondos cuando la registras y la confirmas.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
        <Pill tone="ok">{registradas} registrados</Pill>
        <Pill tone={pendientes ? 'warn' : 'neutral'}>{pendientes} pendientes</Pill>
        {noAplica > 0 && <Pill>{noAplica} no aplican</Pill>}
      </div>

      {plantillas.isPending || estado.isPending ? <Skeleton className="h-24" /> : activas.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-3 text-sm text-muted">Aún no tienes gastos mensuales guardados. Créalos en «Gastos mensuales» y vuelve para registrarlos.</p>
      ) : (
        <ul className="flex flex-col gap-1.5" aria-label="Gastos mensuales">
          {activas.map((p) => {
            const reg = estado.data?.registradas.has(p.id)
            const na = !reg && estado.data?.noAplica.has(p.id)
            return (
              <li key={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-line px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {[nombre(catalogo.ambitos, p.ambito_id), nombre(catalogo.categorias, p.categoria_id), nombre(catalogo.subcategorias, p.subcategoria_id)].filter(Boolean).join(' › ')}
                    {' · '}{nombre(catalogo.medios, p.payment_method_id) ?? 'Sin medio'} · {p.expense_type === 'fixed' ? 'Fijo' : 'Variable'}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="num font-semibold">{p.default_amount !== null ? formatSoles(Number(p.default_amount)) : 'Variable'}</span>
                  <Pill tone={reg ? 'ok' : na ? 'neutral' : 'warn'}>{reg ? 'Registrado' : na ? 'No aplica' : 'Pendiente'}</Pill>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setLote(true)} disabled={activas.length === 0}><FileStack className="size-4" aria-hidden="true" /> Registrar gastos del mes</Button>
        <Button variant="secondary" onClick={() => setGestion(true)}>Abrir gastos mensuales</Button>
      </div>

      <Navegacion>
        <Button variant="secondary" onClick={onAnterior}>Volver</Button>
        <Button variant="secondary" onClick={async () => { if (await onEtapa('skipped')) onSiguiente() }}>Omitir etapa</Button>
        <Button onClick={continuar}>Continuar</Button>
      </Navegacion>

      {lote && <LoteDialog mesInicial={mes} maximo={mes} onClose={() => { setLote(false); void estado.refetch() }} />}
      {gestion && <PlantillasDialog onClose={() => { setGestion(false); void plantillas.refetch() }} />}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Etapa 3 · Resumen y finalización
// ---------------------------------------------------------------------------------------------------------------------------------------------
function PasoResumen({ mes, resumen, onAnterior, onIrAPaso, onCerrar, onFinalizar, cargando }: {
  mes: string; resumen: ResumenPlan; onAnterior: () => void; onIrAPaso: (p: Paso) => void; onCerrar: () => void; onFinalizar: () => void; cargando: boolean
}) {
  const navigate = useNavigate()
  const plan = resumen.plan
  const fondos = plan?.funds_stage ?? 'pending'
  const gastos = plan?.expenses_stage ?? 'pending'
  const completada = plan?.status === 'completed'
  const puedeFinalizar = fondos !== 'pending' && gastos !== 'pending'
  const disponible = resumen.budget_total - resumen.expenses_total
  const etapasCompletas = [fondos, gastos].filter((e) => e === 'done').length
  const etapasOmitidas = [fondos, gastos].filter((e) => e === 'skipped').length

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <h3 className="font-display text-lg font-bold">Resumen de planificación · {formatMes(mes)}</h3>
        <p className="text-sm text-muted">Finalizar guarda el estado del mes y desactiva sus avisos. No crea fondos ni gastos nuevos.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section aria-label="Fondos" className="rounded-lg border border-line p-3">
          <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Fondos</h4><Pill tone={TONO_ETAPA[fondos]}>{ETIQUETA_ETAPA[fondos]}</Pill></div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">Configurados</dt><dd className="num text-right font-semibold">{resumen.funds_count}</dd>
            <dt className="text-muted">Presupuesto total</dt><dd className="num text-right font-semibold">{formatSoles(resumen.budget_total)}</dd>
          </dl>
          <Button variant="secondary" className="mt-2" onClick={() => { navigate(`/fondos?mes=${mes}`); onCerrar() }}>Revisar fondos</Button>
        </section>
        <section aria-label="Gastos" className="rounded-lg border border-line p-3">
          <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Gastos</h4><Pill tone={TONO_ETAPA[gastos]}>{ETIQUETA_ETAPA[gastos]}</Pill></div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">Movimientos</dt><dd className="num text-right font-semibold">{resumen.expenses_count}</dd>
            <dt className="text-muted">Gastos reales</dt><dd className="num text-right font-semibold">{formatSoles(resumen.expenses_total)}</dd>
          </dl>
          <Button variant="secondary" className="mt-2" onClick={() => { navigate(`/gastos?desde=${mes}&hasta=${finDeMes(mes)}`); onCerrar() }}>Revisar gastos</Button>
        </section>
      </div>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ['Presupuesto total', formatSoles(resumen.budget_total)],
          ['Gastos reales', formatSoles(resumen.expenses_total)],
          ['Saldo disponible', formatSoles(disponible)],
          ['Fondos en sobregasto', String(resumen.overspent_funds)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-surface p-2.5"><p className="text-xs text-muted">{k}</p><p className={cn('num text-base font-bold', k === 'Saldo disponible' && disponible < 0 && 'text-bad')}>{v}</p></div>
        ))}
      </section>
      <p className="text-sm text-muted">Etapas completadas: <b className="text-fg">{etapasCompletas}</b> · omitidas: <b className="text-fg">{etapasOmitidas}</b> · estado: <b className="text-fg">{ETIQUETA_ESTADO[plan?.status ?? 'pending']}</b></p>

      {!puedeFinalizar && <Alert tone="info">Confirma u omite cada etapa antes de finalizar (<button type="button" className="underline" onClick={() => onIrAPaso(fondos === 'pending' ? 1 : 2)}>ir a la etapa pendiente</button>).</Alert>}
      {completada && <Alert tone="success">Planificación finalizada. Puedes consultar este resumen cuando quieras.</Alert>}

      <Navegacion>
        <Button variant="secondary" onClick={onAnterior}>Volver</Button>
        {completada ? <Button onClick={onCerrar}>Cerrar</Button> : <Button onClick={onFinalizar} loading={cargando} disabled={!puedeFinalizar}>Finalizar planificación</Button>}
      </Navegacion>
    </div>
  )
}
