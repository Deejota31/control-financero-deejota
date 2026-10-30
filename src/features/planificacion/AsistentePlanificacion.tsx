import { Check, FileStack, Pencil, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { Pill, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/lib/errors'
import { formatFecha, formatMes, formatSoles, toIso } from '@/lib/format'
import { useCatalogo } from '@/features/catalogo/useCatalogo'
import { ListaCopiaFondos, textoResultadoCopia, useCopiaFondos, type CopiaFondos } from '@/features/fondos/CopiarFondos'
import { FondoForm, type FondoInicial } from '@/features/fondos/FondoForm'
import { sumarMeses, useFondos, usePeriodo, usePresupuestosPeriodo, finDeMes, type ResultadoCopia } from '@/features/fondos/useFondos'
import { useSolicitudFondos } from '@/features/fondos/useSolicitudFondos'
import { LoteDialog, PlantillasDialog } from '@/features/gastos/Plantillas'
import { useEstadoLote, usePlantillas } from '@/features/gastos/usePlantillas'
import { usePerfil } from '@/features/perfil/usePerfil'
import { estadosVisuales, ETIQUETA_ESTADO, ETIQUETA_VISUAL, useGuardarPlan, useResumenPlan, type EstadoVisual, type EtapaPlan, type PlanFila, type ResumenPlan } from './usePlanificacion'

type Paso = 1 | 2 | 3
const PASOS: { n: Paso; titulo: string }[] = [
  { n: 1, titulo: 'Fondos' },
  { n: 2, titulo: 'Gastos' },
  { n: 3, titulo: 'Resumen' },
]

/** Estilo de cada estado visual: la etapa en progreso usa el color principal, la completada el de éxito y la omitida uno distinto sin llegar a «completada». */
const ESTILO: Record<EstadoVisual, { tarjeta: string; numero: string }> = {
  pending: { tarjeta: 'border-line', numero: 'bg-surface-2 text-muted' },
  in_progress: { tarjeta: 'border-pri bg-pri-soft', numero: 'bg-pri text-pri-fg' },
  done: { tarjeta: 'border-ok bg-ok-soft', numero: 'bg-ok text-pri-fg' },
  skipped: { tarjeta: 'border-warn border-dashed', numero: 'bg-surface-2 text-warn' },
  por_finalizar: { tarjeta: 'border-line', numero: 'bg-surface-2 text-muted' },
  finalizada: { tarjeta: 'border-ok bg-ok-soft', numero: 'bg-ok text-pri-fg' },
}

/**
 * Asistente de planificación de un mes en tres etapas (fondos, gastos habituales y resumen).
 *
 * Es un flujo con estado propio: los formularios secundarios (nuevo fondo, editar fondo, plantillas, registro por lote, confirmaciones) se abren
 * ENCIMA del asistente y, al guardar o cancelar, se cierran solos sin desmontarlo: el mes, la etapa y las selecciones temporales (la copia de
 * fondos vive aquí, no en cada etapa) se conservan. Lo confirmado se guarda en Supabase etapa por etapa, así se puede cerrar y retomar. Nada se
 * crea por abrir el asistente.
 */
export function AsistentePlanificacion({ mes, onClose }: { mes: string; onClose: () => void }) {
  const resumen = useResumenPlan(mes)
  const guardar = useGuardarPlan()
  const periodo = usePeriodo(mes)
  const fondosQ = useFondos(periodo.data?.id)
  const presupuestos = usePresupuestosPeriodo(periodo.data?.id)
  const catalogo = useCatalogo()
  const copia = useCopiaFondos(mes)
  const solicitud = useSolicitudFondos(fondosQ.data?.fondos ?? [])
  const [paso, setPaso] = useState<Paso>(1)
  const [formFondo, setFormFondo] = useState<FondoInicial | null>(null)
  const iniciado = useRef(false)
  const plan = resumen.data?.plan ?? null
  const visuales = estadosVisuales(plan)

  // Retoma donde se quedó: primera etapa pendiente (o el resumen si ya están resueltas).
  useEffect(() => {
    if (!resumen.data || iniciado.current) return
    iniciado.current = true
    const p = resumen.data.plan
    setPaso(!p || p.funds_stage === 'pending' ? 1 : p.expenses_stage === 'pending' ? 2 : 3)
  }, [resumen.data])

  async function parche(patch: Partial<Pick<PlanFila, 'funds_stage' | 'expenses_stage' | 'status'>>, errorMsg = 'No se pudo guardar la planificación.') {
    try {
      await guardar.mutateAsync({ mes, patch })
      return true
    } catch (e) {
      toast.error(mensajeDeError(e, errorMsg))
      return false
    }
  }
  const marcar = (etapa: 'funds_stage' | 'expenses_stage', valor: EtapaPlan) => parche({ [etapa]: valor })

  /** Cambiar los fondos de un mes con la etapa ya completada la vuelve a pendiente (hay algo nuevo que confirmar); si no, solo marca el plan como empezado. */
  async function fondosCambiaron() {
    if (plan?.funds_stage === 'done') await parche({ funds_stage: 'pending' })
    else if (plan?.status !== 'in_progress') await parche({ status: 'in_progress' })
  }

  const fondos = fondosQ.data?.fondos ?? []
  const asignado = new Map((presupuestos.data ?? []).map((b) => [b.fund_id, Number(b.assigned_amount)]))
  const cerrado = periodo.data?.status === 'closed'

  function abrirForm(f: (typeof fondos)[number] | null) {
    setFormFondo({
      fondo: f,
      alcance: f ? (fondosQ.data?.alcance ?? []).filter((r) => r.fund_id === f.id) : [],
      medios: f ? (fondosQ.data?.medios ?? []).filter((r) => r.fund_id === f.id) : [],
      presupuestoPeriodo: f ? asignado.get(f.id) : undefined,
    })
  }

  return (
    <>
      <Modal open onOpenChange={(o) => !o && onClose()} title={`Planificación · ${formatMes(mes)}`} size="xl"
        description="Prepara los fondos y los gastos habituales del mes. Puedes cerrar y retomarlo cuando quieras."
        sucio={copia.tocado && !copia.copiado}
        footer={null}>
        <div className="flex min-w-0 flex-col gap-4">
          <ol className="grid grid-cols-3 gap-1.5 sm:gap-2" aria-label="Etapas de la planificación">
            {PASOS.map((p) => {
              const estado = p.n === 1 ? visuales.fondos : p.n === 2 ? visuales.gastos : visuales.resumen
              const e = ESTILO[estado]
              return (
                <li key={p.n} aria-current={paso === p.n ? 'step' : undefined}>
                  <button type="button" onClick={() => setPaso(p.n)}
                    className={cn('flex w-full min-w-0 items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-sm transition-colors sm:gap-2 sm:px-2.5', e.tarjeta, paso === p.n ? 'ring-2 ring-pri/40' : 'hover:bg-surface-2')}>
                    <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold', e.numero)}>
                      {estado === 'done' || estado === 'finalizada' ? <Check className="size-3.5" aria-hidden="true" /> : p.n}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.titulo}</span>
                      <span className="block truncate text-[11px] font-normal text-muted sm:text-xs">{ETIQUETA_VISUAL[estado]}</span>
                    </span>
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
            <PasoFondos mes={mes} etapa={plan?.funds_stage ?? 'pending'} cerrado={cerrado} cargando={periodo.isPending || fondosQ.isPending} fondos={fondos} asignado={asignado}
              copia={copia} onNuevo={() => abrirForm(null)} onEditar={abrirForm} onCopiado={fondosCambiaron}
              onEtapa={(v) => marcar('funds_stage', v)} onSiguiente={() => setPaso(2)} />
          ) : paso === 2 ? (
            <PasoGastos mes={mes} etapa={plan?.expenses_stage ?? 'pending'} onEtapa={(v) => marcar('expenses_stage', v)} onAnterior={() => setPaso(1)} onSiguiente={() => setPaso(3)} />
          ) : (
            <PasoResumen mes={mes} resumen={resumen.data} onAnterior={() => setPaso(2)} onIrAPaso={setPaso} onCerrar={onClose} cargando={guardar.isPending}
              onFinalizar={async () => { if (await parche({ status: 'completed' }, 'No se pudo finalizar la planificación.')) { toast.success(`Planificación de ${formatMes(mes)} finalizada.`); onClose() } }} />
          )}
        </div>
      </Modal>

      {/* Subvistas del asistente: viven fuera de su contenido y encima de él; cerrarlas (guardar o cancelar) devuelve al mismo punto del flujo. */}
      {formFondo && (
        <FondoForm
          catalogo={catalogo}
          inicial={formFondo}
          hayGeneralActivo={fondos.some((f) => f.is_general && f.is_active)}
          periodoAbierto={periodo.data?.status === 'open'}
          periodId={periodo.data?.id}
          cargando={solicitud.ocupado}
          onClose={() => setFormFondo(null)}
          onSubmit={(payload) => solicitud.guardarFondo(payload, () => { setFormFondo(null); void fondosCambiaron() })}
        />
      )}
      {solicitud.modales}
    </>
  )
}

function Navegacion({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">{children}</div>
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Etapa 1 · Fondos
// ---------------------------------------------------------------------------------------------------------------------------------------------
type FondoMes = NonNullable<ReturnType<typeof useFondos>['data']>['fondos'][number]

function PasoFondos({ mes, etapa, cerrado, cargando, fondos, asignado, copia, onNuevo, onEditar, onCopiado, onEtapa, onSiguiente }: {
  mes: string; etapa: EtapaPlan; cerrado: boolean; cargando: boolean; fondos: FondoMes[]; asignado: Map<string, number>; copia: CopiaFondos
  onNuevo: () => void; onEditar: (f: FondoMes) => void; onCopiado: () => Promise<void>; onEtapa: (v: EtapaPlan) => Promise<boolean>; onSiguiente: () => void
}) {
  const [resultado, setResultado] = useState<ResultadoCopia | null>(null)
  const activos = fondos.filter((f) => f.is_active)
  const total = activos.reduce((s, f) => s + (asignado.get(f.id) ?? 0), 0)

  async function confirmar() {
    const r = await copia.confirmar()
    if (!r) return
    setResultado(r)
    toast.success(textoResultadoCopia(r, mes))
    await onCopiado()
  }

  async function continuar() {
    // Pulsar «Continuar» con fondos en el mes es confirmar la etapa: queda «Completada». Sin fondos no hay nada que confirmar.
    if (etapa !== 'done' && !(await onEtapa('done'))) return
    onSiguiente()
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <h3 className="font-display text-lg font-bold">Prepara tus fondos de {formatMes(mes)}</h3>
        <p className="text-sm text-muted">Cada mes tiene sus propios fondos. Crea los que necesites o reutiliza los de otro mes; no se crea nada hasta que lo confirmes. Cuando termines, pulsa Continuar.</p>
      </div>

      {cerrado && <Alert tone="info">Este mes está cerrado: su histórico no se modifica y no admite fondos nuevos.</Alert>}

      <section aria-label={`Fondos de ${formatMes(mes)}`} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">Fondos de este mes</h4>
            <Pill tone={activos.length ? 'ok' : 'neutral'}>{activos.length} {activos.length === 1 ? 'fondo' : 'fondos'}</Pill>
            {activos.length > 0 && <span className="num text-sm text-muted">Presupuesto: <b className="text-fg">{formatSoles(total)}</b></span>}
          </div>
          {!cerrado && <Button variant="secondary" onClick={onNuevo}><Plus className="size-4" aria-hidden="true" /> Crear nuevo fondo</Button>}
        </div>
        {cargando ? <Skeleton className="h-10" /> : fondos.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-3 py-2 text-sm text-muted">Todavía no tienes fondos configurados para {formatMes(mes)}.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Fondos del mes">
            {fondos.map((f) => (
              <li key={f.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <ItemIcon name={f.icon_key ?? 'wallet'} color={f.color_token ?? 'c1'} />
                  <span className="min-w-0"><span className="block truncate font-medium">{f.name}</span>{!f.is_active && <span className="block text-xs text-muted">Inactivo</span>}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="num font-semibold">{formatSoles(asignado.get(f.id) ?? 0)}</span>
                  {!cerrado && <button type="button" aria-label={`Editar ${f.name}`} onClick={() => onEditar(f)} className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"><Pencil className="size-4" aria-hidden="true" /></button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!cerrado && (
        <section aria-label="Fondos sugeridos" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Fondos sugeridos de otro mes</h4>
            <Button variant="secondary" onClick={() => copia.setOrigen(sumarMeses(mes, -1))}>Usar mes anterior</Button>
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
          <p>Creados: {resultado.created.length}{resultado.created.length ? ` (${resultado.created.map((c) => c.name).join(', ')})` : ''}. Omitidos: {resultado.skipped.length}. En el mes: {activos.length}.</p>
        </Alert>
      )}

      <Navegacion>
        {activos.length === 0 && <p id="ayuda-fondos" className="mr-auto min-w-0 text-sm text-muted">Crea o copia al menos un fondo para continuar, o usa «Omitir etapa».</p>}
        <Button variant="secondary" onClick={async () => { if (await onEtapa('skipped')) onSiguiente() }}>Omitir etapa</Button>
        <Button onClick={continuar} disabled={activos.length === 0} aria-describedby={activos.length === 0 ? 'ayuda-fondos' : undefined}>Continuar</Button>
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
    // Continuar confirma la revisión de los gastos del mes (registrados o no): la etapa queda «Completada».
    if (etapa !== 'done' && !(await onEtapa('done'))) return
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
        <p className="rounded-md border border-dashed border-line px-3 py-3 text-sm text-muted">Aún no tienes gastos mensuales guardados. Créalos en «Abrir gastos mensuales» y vuelve para registrarlos.</p>
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
  const plantillas = usePlantillas()
  const periodo = usePeriodo(mes)
  const estado = useEstadoLote(periodo.data?.id, mes, finDeMes(mes))
  const formato = usePerfil().data?.date_format ?? 'dd/MM/yyyy'
  const plan = resumen.plan
  const fondos = plan?.funds_stage ?? 'pending'
  const gastos = plan?.expenses_stage ?? 'pending'
  const completada = plan?.status === 'completed'
  const puedeFinalizar = fondos !== 'pending' && gastos !== 'pending'
  const disponible = resumen.budget_total - resumen.expenses_total
  const completas = [fondos, gastos].filter((e) => e === 'done').length
  const omitidas = [fondos, gastos].filter((e) => e === 'skipped').length
  const activas = (plantillas.data ?? []).filter((p) => p.is_active)
  const gastosPendientes = activas.filter((p) => !estado.data?.registradas.has(p.id) && !estado.data?.noAplica.has(p.id)).length
  const visuales = estadosVisuales(plan)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <h3 className="font-display text-lg font-bold">Resumen de planificación · {formatMes(mes)}</h3>
        <p className="text-sm text-muted">Finalizar guarda el estado del mes y desactiva sus avisos. No crea fondos ni gastos nuevos.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section aria-label="Fondos" className="rounded-lg border border-line p-3">
          <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Fondos</h4><Pill tone={fondos === 'done' ? 'ok' : fondos === 'skipped' ? 'warn' : 'neutral'}>{ETIQUETA_VISUAL[visuales.fondos]}</Pill></div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">Configurados</dt><dd className="num text-right font-semibold">{resumen.funds_total}</dd>
            <dt className="text-muted">Activos</dt><dd className="num text-right font-semibold">{resumen.funds_count}</dd>
            <dt className="text-muted">Presupuesto total</dt><dd className="num text-right font-semibold">{formatSoles(resumen.budget_total)}</dd>
          </dl>
          <Button variant="secondary" className="mt-2" onClick={() => onIrAPaso(1)}>Revisar fondos</Button>
        </section>
        <section aria-label="Gastos" className="rounded-lg border border-line p-3">
          <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Gastos</h4><Pill tone={gastos === 'done' ? 'ok' : gastos === 'skipped' ? 'warn' : 'neutral'}>{ETIQUETA_VISUAL[visuales.gastos]}</Pill></div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">Movimientos</dt><dd className="num text-right font-semibold">{resumen.expenses_count}</dd>
            <dt className="text-muted">Importe total (S/)</dt><dd className="num text-right font-semibold">{formatSoles(resumen.expenses_total)}</dd>
            <dt className="text-muted">Plantillas pendientes</dt><dd className="num text-right font-semibold">{gastosPendientes}</dd>
          </dl>
          <Button variant="secondary" className="mt-2" onClick={() => onIrAPaso(2)}>Revisar gastos</Button>
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

      <section aria-label="Planificación" className="rounded-lg border border-line p-3">
        <h4 className="text-sm font-semibold">Planificación</h4>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">Etapas completadas</dt><dd className="num text-right font-semibold">{completas}</dd>
          <dt className="text-muted">Etapas omitidas</dt><dd className="num text-right font-semibold">{omitidas}</dd>
          <dt className="text-muted">Estado general</dt><dd className="text-right font-semibold">{ETIQUETA_ESTADO[plan?.status ?? 'pending']}</dd>
          {plan?.completed_at && <><dt className="text-muted">Finalizada el</dt><dd className="text-right font-semibold">{formatFecha(toIso(new Date(plan.completed_at)), formato)}</dd></>}
        </dl>
      </section>

      {!puedeFinalizar && <Alert tone="info">Confirma u omite cada etapa antes de finalizar (<button type="button" className="underline" onClick={() => onIrAPaso(fondos === 'pending' ? 1 : 2)}>ir a la etapa pendiente</button>).</Alert>}
      {completada && <Alert tone="success">Planificación finalizada. Puedes consultar este resumen cuando quieras.</Alert>}

      <Navegacion>
        <Button variant="secondary" onClick={onAnterior}>Anterior</Button>
        {completada ? <Button onClick={onCerrar}>Cerrar</Button> : <Button onClick={onFinalizar} loading={cargando} disabled={!puedeFinalizar}>Finalizar planificación</Button>}
      </Navegacion>
    </div>
  )
}
