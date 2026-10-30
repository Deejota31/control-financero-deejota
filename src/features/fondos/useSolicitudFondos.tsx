import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Modal } from '@/components/ui/Dialog'
import { cambiosPorPeriodo, round2, type CambioFondos } from '@/domain/fondos'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/lib/errors'
import { formatMes, formatSoles } from '@/lib/format'
import type { Fila } from '@/lib/tipos'
import { useFondoMutaciones, type FondoPayload } from './useFondos'

type FondoFila = Fila<'funds'>

interface Pendiente {
  titulo: string
  cambio: CambioFondos
  aplicar: () => Promise<unknown>
  exito: string
  alTerminar?: () => void
}

/**
 * Flujo único para cambiar fondos: simula el cambio en el servidor, avisa si bloquea o si recalcula gastos existentes y pide confirmación antes de
 * aplicarlo. Lo usan la página Fondos y el asistente de planificación, así un fondo se guarda igual en ambos y los diálogos de confirmación se
 * montan donde se necesitan (encima del asistente, sin cerrarlo). `modales` debe renderizarse junto al componente que lo usa.
 */
export function useSolicitudFondos(fondos: FondoFila[]) {
  const mut = useFondoMutaciones()
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const [bloqueo, setBloqueo] = useState<string | null>(null)
  const [aplicando, setAplicando] = useState(false)

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


  /** Guarda (crea o edita) un fondo: `alTerminar` se ejecuta solo si el guardado tuvo éxito; si falla, el formulario sigue abierto con sus datos. */
  const guardarFondo = (payload: FondoPayload, alTerminar?: () => void) =>
    solicitar(`Guardar cambios de «${payload.name}»`, () => mut.simular.mutateAsync(payload), () => mut.guardar.mutateAsync(payload), 'Fondo guardado.', alTerminar, { kind: 'save_fund', args: payload })

  const modales: ReactNode = (
    <>
      <ConfirmDialog
        open={Boolean(pendiente)}
        onOpenChange={(o) => !o && !aplicando && setPendiente(null)}
        title={pendiente?.titulo ?? ''}
        confirmLabel="Aplicar cambios"
        loading={aplicando}
        onConfirm={confirmar}
        description={pendiente && <EfectoCambio cambio={pendiente.cambio} fondos={fondos} />}
      />

      <Modal open={Boolean(bloqueo)} onOpenChange={(o) => !o && setBloqueo(null)} title="No se puede guardar este cambio" size="sm">
        <div className="flex flex-col gap-4">
          <Alert tone="error">{bloqueo}</Alert>
          <p className="text-sm text-muted">Con estas reglas algún gasto existente quedaría sin ningún fondo que lo admita. Ajusta las reglas o la clasificación del gasto y vuelve a intentarlo.</p>
          <div className="flex justify-end"><Button onClick={() => setBloqueo(null)}>Entendido</Button></div>
        </div>
      </Modal>
    </>
  )

  return { solicitar, guardarFondo, modales, mut, ocupado: aplicando || mut.simular.isPending || mut.guardar.isPending }
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
