import { Check, ClipboardList, FileStack, Pencil, PiggyBank, Plus, Receipt, TriangleAlert, Wallet } from 'lucide-react'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { Pill, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/lib/errors'
import { round2 } from '@/domain/fondos'
import { formatFecha, formatMes, formatSoles, toIso } from '@/lib/format'
import { useCatalogo } from '@/features/catalogo/useCatalogo'
import { ListaCopiaFondos, textoResultadoCopia, useCopiaFondos, type CopiaFondos } from '@/features/fondos/CopiarFondos'
import { FondoForm, type FondoInicial } from '@/features/fondos/FondoForm'
import { GestorPlantillasFondos, PlantillasFondosDialog } from '@/features/fondos/PlantillasFondos'
import { sumarMeses, finDeMes } from '@/domain/periodo'
import { usePeriodo } from '@/features/periodos/usePeriodo'
import { useAsignacionesPeriodo, useFondos, usePresupuestosPeriodo, type ResultadoCopia } from '@/features/fondos/useFondos'
import { useSolicitudFondos } from '@/features/fondos/useSolicitudFondos'
import { GestorPlantillasGastos, PlantillasDialog } from '@/features/gastos/GestorGastos'
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
  const [biblioteca, setBiblioteca] = useState(false)
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
      <Modal open onOpenChange={(o) => !o && onClose()} title={`Planificación · ${formatMes(mes)}`} size="2xl"
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
              copia={copia} onNuevo={() => abrirForm(null)} onEditar={abrirForm} onCopiado={fondosCambiaron} onBiblioteca={() => setBiblioteca(true)}
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
      {biblioteca && <PlantillasFondosDialog mes={mes} onClose={() => setBiblioteca(false)} onCambio={() => void fondosCambiaron()} />}
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

function PasoFondos({ mes, etapa, cerrado, cargando, fondos, asignado, copia, onNuevo, onEditar, onCopiado, onBiblioteca, onEtapa, onSiguiente }: {
  mes: string; etapa: EtapaPlan; cerrado: boolean; cargando: boolean; fondos: FondoMes[]; asignado: Map<string, number>; copia: CopiaFondos
  onNuevo: () => void; onEditar: (f: FondoMes) => void; onCopiado: () => Promise<void>; onBiblioteca: () => void; onEtapa: (v: EtapaPlan) => Promise<boolean>; onSiguiente: () => void
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
        <p className="text-sm text-muted">Cada mes tiene sus propios fondos. Usa tus plantillas, ajusta los importes y confirma; también puedes copiar los de otro mes o crear uno nuevo. No se crea nada hasta que lo confirmes. Cuando termines, pulsa Continuar.</p>
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
        <section aria-label="Mis plantillas de fondos" className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold">Usar mis plantillas</h4>
          <GestorPlantillasFondos mes={mes} onCambio={() => void onCopiado()} onAdministrar={onBiblioteca} />
        </section>
      )}

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
  const plantillas = usePlantillas()
  const periodo = usePeriodo(mes)
  const estado = useEstadoLote(periodo.data?.id, mes, finDeMes(mes))
  const [gestion, setGestion] = useState(false)

  const activas = (plantillas.data ?? []).filter((p) => p.is_active)
  const registradas = activas.filter((p) => estado.data?.registradas.has(p.id)).length
  const noAplica = activas.filter((p) => !estado.data?.registradas.has(p.id) && estado.data?.noAplica.has(p.id)).length
  const pendientes = activas.length - registradas - noAplica

  async function continuar() {
    // Continuar confirma la revisión de los gastos del mes: la etapa queda «Completada» aunque queden plantillas opcionales sin registrar.
    if (etapa !== 'done' && !(await onEtapa('done'))) return
    onSiguiente()
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div>
        <h3 className="font-display text-lg font-bold">Prepara tus gastos de {formatMes(mes)}</h3>
        <p className="text-sm text-muted">Una plantilla es una configuración reutilizable, no un gasto: solo afecta a tus fondos cuando la registras y la confirmas. Ajusta importe, fecha y medio de cada una y registra varias a la vez.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
        <Pill tone="ok">{registradas} registrados</Pill>
        <Pill tone={pendientes ? 'warn' : 'neutral'}>{pendientes} pendientes</Pill>
        {noAplica > 0 && <Pill>{noAplica} no aplican</Pill>}
      </div>

      <GestorPlantillasGastos mes={mes} embebido onCambio={() => { void estado.refetch(); void plantillas.refetch() }} />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setGestion(true)}><FileStack className="size-4" aria-hidden="true" /> Abrir gastos mensuales</Button>
        <span className="text-xs text-muted">Opción avanzada: la biblioteca completa de plantillas con su fecha general y más filtros.</span>
      </div>

      <Navegacion>
        <Button variant="secondary" onClick={onAnterior}>Volver</Button>
        <Button variant="secondary" onClick={async () => { if (await onEtapa('skipped')) onSiguiente() }}>Omitir etapa</Button>
        <Button onClick={continuar}>Continuar</Button>
      </Navegacion>

      {gestion && <PlantillasDialog mes={mes} onClose={() => { setGestion(false); void estado.refetch(); void plantillas.refetch() }} />}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Etapa 3 · Resumen y finalización
// ---------------------------------------------------------------------------------------------------------------------------------------------
function Kpi({ icono: Icono, etiqueta, valor, nota, tono }: { icono: ComponentType<{ className?: string }>; etiqueta: string; valor: string; nota: string; tono?: 'ok' | 'bad' | 'warn' }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', tono === 'bad' ? 'bg-bad-soft text-bad' : tono === 'warn' ? 'bg-surface-2 text-warn' : tono === 'ok' ? 'bg-ok-soft text-ok' : 'bg-pri-soft text-pri')}><Icono className="size-[18px]" /></span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted">{etiqueta}</p>
        <p className={cn('num truncate text-base font-bold leading-tight', tono === 'bad' && 'text-bad')}>{valor}</p>
        <p className="truncate text-[11px] leading-tight text-muted">{nota}</p>
      </div>
    </div>
  )
}

function Etapa({ nombre, estado, onRevisar }: { nombre: string; estado: EstadoVisual; onRevisar?: () => void }) {
  const ok = estado === 'done' || estado === 'finalizada'
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm" role="group" aria-label={nombre}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={cn('grid size-5 shrink-0 place-items-center rounded-full', ok ? 'bg-ok text-pri-fg' : 'bg-surface-2 text-muted')}>{ok ? <Check className="size-3" aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}</span>
        <span className="truncate font-semibold">{nombre}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Pill tone={ok ? 'ok' : estado === 'skipped' ? 'warn' : 'neutral'}>{ETIQUETA_VISUAL[estado]}</Pill>
        {onRevisar && <button type="button" onClick={onRevisar} className="text-xs font-semibold text-pri hover:underline">Revisar</button>}
      </span>
    </div>
  )
}

function PasoResumen({ mes, resumen, onAnterior, onIrAPaso, onCerrar, onFinalizar, cargando }: {
  mes: string; resumen: ResumenPlan; onAnterior: () => void; onIrAPaso: (p: Paso) => void; onCerrar: () => void; onFinalizar: () => void; cargando: boolean
}) {
  const plantillas = usePlantillas()
  const periodo = usePeriodo(mes)
  const estado = useEstadoLote(periodo.data?.id, mes, finDeMes(mes))
  const fondosQ = useFondos(periodo.data?.id)
  const asignQ = useAsignacionesPeriodo(periodo.data?.id)
  const formato = usePerfil().data?.date_format ?? 'dd/MM/yyyy'
  const plan = resumen.plan
  const fondos = plan?.funds_stage ?? 'pending'
  const gastos = plan?.expenses_stage ?? 'pending'
  const completada = plan?.status === 'completed'
  const puedeFinalizar = fondos !== 'pending' && gastos !== 'pending'
  const completas = [fondos, gastos].filter((e) => e === 'done').length
  const omitidas = [fondos, gastos].filter((e) => e === 'skipped').length
  const activas = (plantillas.data ?? []).filter((p) => p.is_active)
  const gastosPendientes = activas.filter((p) => !estado.data?.registradas.has(p.id) && !estado.data?.noAplica.has(p.id)).length
  const visuales = estadosVisuales(plan)

  // Consumo imputado de los fondos activos del mes (lo que el motor asignó) frente al gasto real: no todo gasto consume fondos.
  const activos = new Set((fondosQ.data?.fondos ?? []).filter((x) => x.is_active).map((x) => x.id))
  const asignaciones = asignQ.data ?? []
  const consumo = round2(asignaciones.filter((a) => activos.has(a.fund_id)).reduce((t, a) => t + Number(a.amount), 0))
  const consumoGeneral = round2(asignaciones.filter((a) => activos.has(a.fund_id) && a.allocation_kind === 'general').reduce((t, a) => t + Number(a.amount), 0))
  const consumoEspecifico = round2(consumo - consumoGeneral)
  const imputadoTotal = round2(asignaciones.reduce((t, a) => t + Number(a.amount), 0))
  const sinFondo = Math.max(0, round2(resumen.expenses_total - imputadoTotal))
  const disponible = round2(resumen.budget_total - consumo)
  const pct = resumen.budget_total > 0 ? Math.min(100, Math.round((consumo / resumen.budget_total) * 100)) : consumo > 0 ? 100 : 0
  const excedido = disponible < 0
  const cargandoCifras = fondosQ.isPending || asignQ.isPending

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold">Resumen de planificación · {formatMes(mes)}</h3>
          <p className="text-sm text-muted">Finalizar guarda el estado del mes y desactiva sus avisos. No crea fondos ni gastos nuevos.</p>
        </div>
        {completada && <Pill tone="ok"><Check className="size-3" aria-hidden="true" /> Finalizada{plan?.completed_at ? ` el ${formatFecha(toIso(new Date(plan.completed_at)), formato)}` : ''}</Pill>}
      </div>

      {/* A. KPIs principales */}
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi icono={Wallet} etiqueta="Presupuesto total" valor={formatSoles(resumen.budget_total)} nota={`${resumen.funds_count} ${resumen.funds_count === 1 ? 'fondo activo' : 'fondos activos'}`} />
        <Kpi icono={Receipt} etiqueta="Gastos reales" valor={formatSoles(resumen.expenses_total)} nota={`${resumen.expenses_count} ${resumen.expenses_count === 1 ? 'movimiento' : 'movimientos'}`} />
        <Kpi icono={PiggyBank} etiqueta="Disponible" valor={formatSoles(disponible)} nota="Presupuesto − consumo imputado" tono={excedido ? 'bad' : 'ok'} />
        {resumen.overspent_funds > 0
          ? <Kpi icono={TriangleAlert} etiqueta="Fondos en sobregasto" valor={String(resumen.overspent_funds)} nota="Con saldo negativo" tono="bad" />
          : <Kpi icono={ClipboardList} etiqueta="Plantillas pendientes" valor={String(gastosPendientes)} nota={gastosPendientes ? 'Opcionales por registrar' : 'Todo al día'} tono={gastosPendientes ? 'warn' : 'ok'} />}
      </section>

      {/* B. Estado financiero */}
      <section aria-label="Estado financiero" className="rounded-xl border border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Estado financiero</h4>
          <span className={cn('num text-sm font-bold', excedido && 'text-bad')}>{pct}% del presupuesto utilizado</span>
        </div>
        <span className="mt-2 block h-2.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line" role="progressbar" aria-label="Consumo imputado del presupuesto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span className={cn('block h-full rounded-full', excedido ? 'bg-bad' : 'bg-pri')} style={{ width: `${pct}%` }} />
        </span>
        {cargandoCifras ? <Skeleton className="mt-3 h-14" /> : (
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3"><dt className="text-muted">Gasto total del mes</dt><dd className="num font-semibold">{formatSoles(resumen.expenses_total)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Consumo de fondos</dt><dd className="num font-semibold">{formatSoles(consumo)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">En fondos específicos</dt><dd className="num font-semibold">{formatSoles(consumoEspecifico)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">En el Fondo General (incluye excedentes)</dt><dd className="num font-semibold">{formatSoles(consumoGeneral)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Saldo disponible</dt><dd className={cn('num font-semibold', excedido && 'text-bad')}>{formatSoles(disponible)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Gastos sin fondo compatible</dt><dd className={cn('num font-semibold', sinFondo > 0 && 'text-warn')}>{formatSoles(sinFondo)}</dd></div>
          </dl>
        )}
        <p className="mt-2 text-[11px] text-muted">Importes en soles (S/): el sistema trabaja en una sola moneda. No todo gasto consume fondos: la diferencia entre el gasto total y el consumo se muestra aparte.</p>
      </section>

      {/* C. Estado de planificación */}
      <section aria-label="Planificación" className="rounded-xl border border-line p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Estado de planificación</h4>
          <span className="text-xs text-muted">
            <b className="num text-fg">{completas}</b> {completas === 1 ? 'etapa completada' : 'etapas completadas'}{omitidas > 0 && <> · <b className="num text-fg">{omitidas}</b> {omitidas === 1 ? 'omitida' : 'omitidas'}</>} · {ETIQUETA_ESTADO[plan?.status ?? 'pending']}
          </span>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Etapa nombre="Fondos" estado={visuales.fondos} onRevisar={() => onIrAPaso(1)} />
          <Etapa nombre="Gastos" estado={visuales.gastos} onRevisar={() => onIrAPaso(2)} />
          <Etapa nombre="Resumen" estado={visuales.resumen} />
        </div>
        {plan?.completed_at && <p className="mt-2 text-xs text-muted">Finalizada el {formatFecha(toIso(new Date(plan.completed_at)), formato)}.</p>}
      </section>

      {!puedeFinalizar && <Alert tone="info">Confirma u omite cada etapa antes de finalizar (<button type="button" className="underline" onClick={() => onIrAPaso(fondos === 'pending' ? 1 : 2)}>ir a la etapa pendiente</button>).</Alert>}
      {puedeFinalizar && !completada && gastosPendientes > 0 && <Alert tone="info">Quedan {gastosPendientes} plantillas de gasto sin registrar. Son opcionales: puedes finalizar igualmente.</Alert>}
      {completada && <Alert tone="success">Planificación finalizada. Puedes consultar este resumen cuando quieras; reabrirlo no crea fondos ni gastos.</Alert>}

      <Navegacion>
        <Button variant="secondary" onClick={onAnterior}>Anterior</Button>
        {completada ? <Button onClick={onCerrar}>Cerrar</Button> : <Button onClick={onFinalizar} loading={cargando} disabled={!puedeFinalizar}>Finalizar planificación</Button>}
      </Navegacion>
    </div>
  )
}
