import { CalendarDays } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ChipK, TinteK } from '@/components/ui/ChipK'
import { Combobox } from '@/components/ui/Combobox'
import { DatePicker } from '@/components/ui/DatePicker'
import { ConfirmDialog, Modal } from '@/components/ui/Dialog'
import { ItemIcon } from '@/components/ui/ItemIcon'
import { MesSelector } from '@/components/ui/MesSelector'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { EmptyState, ErrorState, Pill, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { esErrorDeRed, mensajeDeError } from '@/lib/errors'
import { fechaEfectiva } from '@/domain/plantillas'
import { errorImporte, formatFecha, formatMes, formatSoles, parseImporte, sumarImportes } from '@/lib/format'
import type { Plantilla } from '@/lib/tipos'
import { claseDe } from '@/features/plantillas/clase'
import { opciones, useCatalogo } from '@/features/catalogo/useCatalogo'
import { finDeMes, mesDeFecha } from '@/domain/periodo'
import { usePeriodo } from '@/features/periodos/usePeriodo'
import { usePerfil } from '@/features/perfil/usePerfil'
import { useEstadoLote, usePlantillaMutaciones, usePlantillas } from './usePlantillas'

const MES_ACTUAL = mesDeFecha(new Date())

// La biblioteca de plantillas (gestor con secciones, selección múltiple y edición inline) vive en GestorGastos; aquí queda el registro mensual por lote.
export { PlantillasDialog } from './GestorGastos'

/* --------------------------- Registro por lote --------------------------- */

type Decision = 'include' | 'skip' | 'na'
interface Fila { decision: Decision; amount: string; date: string; method: string; confirmado: boolean }

const DECISIONES: { value: Decision; label: string; ayuda: string }[] = [
  { value: 'include', label: 'Registrar', ayuda: 'Crea el gasto este mes con los datos de la fila.' },
  { value: 'na', label: 'No aplica este mes', ayuda: 'Queda anotado que este mes no corresponde; no se crea gasto.' },
  { value: 'skip', label: 'Omitir', ayuda: 'No se crea nada ahora; la plantilla se podrá revisar de nuevo.' },
]

/** Registro por lote de las plantillas de un mes. La planificación lo abre con el mes que se está preparando (incluso futuro). */
export function LoteDialog({ onClose, mesInicial, maximo }: { onClose: () => void; mesInicial?: string; maximo?: string }) {
  const [mes, setMes] = useState(mesInicial ?? MES_ACTUAL)
  const [pendientes, setPendientes] = useState(0)
  const [sucio, setSucio] = useState(false)
  const [cambiarA, setCambiarA] = useState<string | null>(null)
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Registrar gastos mensuales" description="Revisa cada plantilla antes de confirmar. No se crea nada sin tu confirmación." size="xl" sucio={sucio}
      footer={null}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MesSelector mes={mes} onChange={(m) => (sucio ? setCambiarA(m) : setMes(m))} maximo={maximo ?? MES_ACTUAL} />
          <p className="text-sm text-muted" aria-live="polite">{formatMes(mes)} · <b className="text-fg">{pendientes}</b> {pendientes === 1 ? 'plantilla por revisar' : 'plantillas por revisar'}</p>
        </div>
        <LoteMes key={mes} mes={mes} onClose={onClose} onPendientes={setPendientes} onSucio={setSucio} />
      </div>
      <ConfirmDialog open={Boolean(cambiarA)} onOpenChange={(o) => !o && setCambiarA(null)} title="¿Cambiar de mes?" description="Tienes ajustes sin registrar en este mes. Si cambias de mes se descartarán."
        confirmLabel="Cambiar de mes" cancelLabel="Seguir aquí" onConfirm={() => { if (cambiarA) { setSucio(false); setMes(cambiarA) } setCambiarA(null) }} />
    </Modal>
  )
}

function LoteMes({ mes, onClose, onPendientes, onSucio }: { mes: string; onClose: () => void; onPendientes: (n: number) => void; onSucio: (b: boolean) => void }) {
  const plantillas = usePlantillas()
  const catalogo = useCatalogo()
  const periodo = usePeriodo(mes)
  const estado = useEstadoLote(periodo.data?.id, mes, finDeMes(mes))
  const perfil = usePerfil()
  const mut = usePlantillaMutaciones()
  const [clave] = useState(() => crypto.randomUUID())
  const [filas, setFilas] = useState<Record<string, Partial<Fila>>>({})
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(false)

  const cargando = plantillas.isPending || periodo.isPending || estado.isPending || catalogo.isPending
  const activas = (plantillas.data ?? []).filter((p) => p.is_active)
  const registradas = estado.data?.registradas ?? new Set<string>()
  const items = activas.filter((p) => !registradas.has(p.id))
  const ya = activas.filter((p) => registradas.has(p.id))
  const cerrado = periodo.data?.status === 'closed'

  const base = (p: Plantilla): Fila => ({
    decision: estado.data?.noAplica.has(p.id) ? 'na' : 'include',
    amount: p.default_amount ? Number(p.default_amount).toFixed(2) : '',
    date: fechaEfectiva(p.day_of_month, mes).iso, method: p.payment_method_id ?? '', confirmado: !p.is_amount_variable,
  })
  const fila = (p: Plantilla): Fila => ({ ...base(p), ...filas[p.id] })
  const set = (id: string, patch: Partial<Fila>) => { setFilas((f) => ({ ...f, [id]: { ...f[id], ...patch } })); onSucio(true) }

  const incluidas = items.filter((p) => fila(p).decision === 'include')
  /** Datos que faltan o están mal en una fila que se va a registrar. */
  const problemas = (p: Plantilla): string[] => {
    const f = fila(p)
    if (f.decision !== 'include') return []
    const out: string[] = []
    const ei = errorImporte(f.amount)
    if (ei) out.push(ei)
    else if (!f.confirmado) out.push('Revisa y confirma el importe de este mes.')
    if (!f.method) out.push('Elige el medio de pago.')
    return out
  }
  const conProblemas = incluidas.filter((p) => problemas(p).length > 0)
  const total = sumarImportes(incluidas.map((p) => parseImporte(fila(p).amount) ?? 0))
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'
  const nPend = items.filter((p) => fila(p).decision === 'include').length
  // Lo que la persona aún debe revisar (se informa arriba y en el pie)
  const pendientesRevision = incluidas.filter((p) => !fila(p).confirmado).length
  const nItems = items.length
  useEffect(() => { if (!cargando) onPendientes(nItems) }, [cargando, nItems, onPendientes])

  if (cargando) return <Skeleton className="h-48" />
  if (plantillas.isError || periodo.isError || estado.isError) return <ErrorState message="No se pudieron cargar las plantillas del período." onRetry={() => { plantillas.refetch(); periodo.refetch(); estado.refetch() }} />
  if (activas.length === 0) return <EmptyState icon={CalendarDays} title="No hay plantillas activas" description="Crea plantillas desde el botón “Plantillas” para registrar tus gastos mensuales en un paso." />

  async function registrar() {
    if (mut.aplicarLote.isPending) return // evita el doble envío
    setError(null)
    try {
      const payload = items.map((p) => {
        const f = fila(p)
        return f.decision === 'include'
          ? { template_id: p.id, outcome: 'include', amount: parseImporte(f.amount), expense_date: f.date, payment_method_id: f.method }
          : { template_id: p.id, outcome: f.decision === 'na' ? 'not_applicable' : 'exclude' }
      })
      const r = await mut.aplicarLote.mutateAsync({ fecha: mes, items: payload, clave })
      toast.success(r.count > 0 ? `Se registraron ${r.count} ${r.count === 1 ? 'gasto' : 'gastos'} por ${formatSoles(Number(r.total))}.` : 'Decisiones del mes guardadas.')
      onSucio(false)
      onClose()
    } catch (e) {
      setConfirmando(false)
      setError(esErrorDeRed(e)
        ? 'No se pudo confirmar el registro. Es seguro reintentar: se usa la misma clave y no se duplicará ningún gasto.'
        : `${mensajeDeError(e)} No se registró ningún gasto (el lote es atómico: o se crea todo o nada), así que puedes corregir y reintentar.`)
    }
  }

  return (
    <div className="@container flex min-w-0 flex-col gap-3">
      {cerrado && <Alert tone="info">Este período está cerrado: no se pueden registrar gastos en él.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="hidden grid-cols-[minmax(0,1.5fr)_11rem_8.5rem_9.5rem_minmax(0,1fr)] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted @min-[52rem]:grid" aria-hidden="true">
        <span>Plantilla</span><span>Decisión</span><span>Importe</span><span>Fecha</span><span>Medio de pago</span>
      </div>
      <ul aria-label="Plantillas del mes" className="flex flex-col gap-2">
        {items.map((p) => {
          const f = fila(p)
          const c = claseDe(catalogo, p)
          const prob = intento ? problemas(p) : []
          const usa = f.decision === 'include'
          return (
            <li key={p.id} className={cn('grid min-w-0 grid-cols-1 items-start gap-2 rounded-xl border p-3 @min-[52rem]:grid-cols-[minmax(0,1.5fr)_11rem_8.5rem_9.5rem_minmax(0,1fr)] @min-[52rem]:gap-3', usa ? 'border-line' : 'border-line bg-surface-2/50')}>
              <div className="flex min-w-0 items-start gap-2.5">
                <TinteK color={c.color} className="size-9 shrink-0 rounded-lg"><ItemIcon name={c.icono} color={c.color} className="size-[18px]" /></TinteK>
                <div className="min-w-0">
                  <p className="break-words font-semibold">{p.name}</p>
                  <p className="break-words text-xs text-muted">{p.description}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                    {c.c && <ChipK color={c.color}>{c.c.name}{c.s ? ` › ${c.s.name}` : ''}</ChipK>}
                    {p.is_amount_variable && usa && !f.confirmado && <Pill tone="warn">Revisar importe</Pill>}
                    {f.decision === 'na' && <Pill>No aplica</Pill>}
                    {f.decision === 'skip' && <Pill>Omitida</Pill>}
                  </p>
                </div>
              </div>
              <div className="min-w-0">
                <Combobox aria-label={`Decisión para ${p.name}`} value={f.decision} searchable={false} options={DECISIONES.map((d) => ({ value: d.value, label: d.label }))} onChange={(x) => set(p.id, { decision: (x ?? 'include') as Decision })} />
                <p className="mt-1 hidden text-[11px] leading-snug text-muted @min-[52rem]:block">{DECISIONES.find((d) => d.value === f.decision)?.ayuda}</p>
              </div>
              {usa ? (
                <>
                  <div className="min-w-0">
                    <MoneyInput aria-label={`Importe de ${p.name}`} value={f.amount} onChange={(x) => set(p.id, { amount: x, confirmado: true })} invalid={Boolean(prob.some((m) => /importe|número|decimal|signo|máximo|mayor|Usa|Formato/i.test(m)))} />
                    {p.is_amount_variable && !f.confirmado && f.amount !== '' && (
                      <button type="button" onClick={() => set(p.id, { confirmado: true })} className="mt-1 text-xs font-semibold text-pri hover:underline">Confirmar {formatSoles(parseImporte(f.amount) ?? 0)}</button>
                    )}
                  </div>
                  <div className="min-w-0"><DatePicker aria-label={`Fecha de ${p.name}`} value={f.date} onChange={(x) => set(p.id, { date: x })} min={mes} max={finDeMes(mes)} formato={formato} /></div>
                  <div className="min-w-0"><Combobox aria-label={`Medio de pago de ${p.name}`} value={f.method} searchable={false} options={opciones(catalogo.medios, f.method)} onChange={(x) => set(p.id, { method: x ?? '' })} placeholder="Elegir medio" invalid={prob.includes('Elige el medio de pago.')} /></div>
                  {prob.length > 0 && <p role="alert" className="text-xs font-medium text-bad @min-[52rem]:col-span-5">{prob.join(' ')}</p>}
                </>
              ) : (
                <p className="text-xs text-muted @min-[52rem]:col-span-4">{f.decision === 'na' ? 'No se registrará este mes; queda anotado que no corresponde.' : 'No se creará nada ahora; seguirá pendiente de revisión.'}</p>
              )}
            </li>
          )
        })}
      </ul>

      {ya.length > 0 && (
        <details className="rounded-xl border border-line px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">Ya registradas este mes ({ya.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">{ya.map((p) => <li key={p.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{p.name}</span><Pill tone="ok">Ya registrada este mes</Pill></li>)}</ul>
        </details>
      )}

      <div className="sticky -bottom-4 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 sm:-bottom-5 sm:-mx-6 sm:px-6">
        <p className="text-sm" aria-live="polite">
          <b>{incluidas.length}</b> {incluidas.length === 1 ? 'gasto' : 'gastos'} por <b className="num">{formatSoles(total)}</b>
          {conProblemas.length > 0 && <span className="text-bad"> · {conProblemas.length} con datos pendientes</span>}
          {pendientesRevision > 0 && conProblemas.length === 0 && <span className="text-muted"> · {pendientesRevision} importe(s) por confirmar</span>}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={cerrado || items.length === 0 || mut.aplicarLote.isPending} onClick={() => { setIntento(true); if (conProblemas.length === 0) setConfirmando(true) }}>{nPend ? 'Revisar y registrar' : 'Guardar decisiones'}</Button>
        </div>
      </div>

      <ConfirmDialog open={confirmando} onOpenChange={setConfirmando} title="Confirmar registro mensual" confirmLabel="Registrar" loading={mut.aplicarLote.isPending} onConfirm={registrar}
        description={
          <div className="flex flex-col gap-2">
            <p>Se crearán <b>{incluidas.length}</b> {incluidas.length === 1 ? 'gasto' : 'gastos'} por <b className="num">{formatSoles(total)}</b> y se imputarán a tus fondos:</p>
            {incluidas.length > 0 && (
              <ul className="max-h-40 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
                {incluidas.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-1.5"><span className="min-w-0 truncate">{p.name} · {formatFecha(fila(p).date, formato)}</span><span className="num shrink-0 font-semibold">{formatSoles(parseImporte(fila(p).amount) ?? 0)}</span></li>)}
              </ul>
            )}
            {items.length - incluidas.length > 0 && <p className="text-xs text-muted">Las demás ({items.length - incluidas.length}) solo guardan tu decisión («No aplica» u «Omitir»); no crean gastos.</p>}
          </div>
        } />
    </div>
  )
}
