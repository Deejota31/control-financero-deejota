import { Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { nombreArchivo } from '@/domain/exportacion'
import { descargar } from '@/lib/csv'
import { mensajeDeError } from '@/lib/errors'
import { toIso } from '@/lib/format'
import { esCancelacion, generarCsvGastos, generarRespaldo } from './exportar'
import { usePerfil } from './usePerfil'

type Tipo = 'csv' | 'json'

export function ExportarDatos() {
  const perfil = usePerfil()
  const formato = perfil.data?.date_format ?? 'dd/MM/yyyy'
  const [incluirAnulados, setIncluirAnulados] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [activo, setActivo] = useState<Tipo | null>(null)
  const [progreso, setProgreso] = useState('')
  const [confirmarRespaldo, setConfirmarRespaldo] = useState(false)
  const control = useRef<AbortController | null>(null)

  const rangoInvalido = Boolean(desde && hasta && desde > hasta)

  async function ejecutar(tipo: Tipo) {
    const ac = new AbortController()
    control.current = ac
    setActivo(tipo)
    setProgreso('Preparando…')
    const hoy = toIso(new Date())
    try {
      if (tipo === 'csv') {
        const csv = await generarCsvGastos({ incluirAnulados, desde: desde || undefined, hasta: hasta || undefined }, ac.signal, setProgreso)
        descargar(nombreArchivo('gastos', hoy), csv)
        toast.success('Exportación de gastos lista.')
      } else {
        const r = await generarRespaldo(perfil.data ?? null, ac.signal, setProgreso)
        descargar(nombreArchivo('respaldo', hoy), JSON.stringify(r, null, 2), 'application/json')
        toast.success('Respaldo listo.')
      }
    } catch (e) {
      if (esCancelacion(e)) toast.info('Exportación cancelada. No se descargó ningún archivo.')
      else toast.error(mensajeDeError(e, 'No se pudo completar la exportación. No se descargó ningún archivo; puedes reintentar.'))
    } finally {
      control.current = null
      setActivo(null)
      setProgreso('')
    }
  }

  const ocupado = activo !== null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="exp-csv" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-pri-soft text-pri"><FileSpreadsheet className="size-5" aria-hidden="true" /></span>
            <div>
              <h3 id="exp-csv" className="font-display text-base font-bold">Gastos en CSV</h3>
              <p className="text-sm text-muted">Todo tu historial en una hoja de cálculo: nombres legibles de ámbito, categoría y medio, importes con punto decimal, fechas ISO y los fondos imputados.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--pri)]" checked={incluirAnulados} onChange={(e) => setIncluirAnulados(e.target.checked)} disabled={ocupado} />
            Incluir gastos anulados
          </label>
          <fieldset className="flex flex-wrap items-end gap-3" disabled={ocupado}>
            <legend className="mb-1.5 text-sm font-medium">Rango de fechas <span className="font-normal text-muted">(opcional; vacío = todo el historial)</span></legend>
            <div className="flex w-44 flex-col gap-1.5"><label htmlFor="exp-desde" className="text-xs text-muted">Desde</label><DatePicker id="exp-desde" value={desde} onChange={setDesde} formato={formato} placeholder="Sin límite" max={hasta || undefined} /></div>
            <div className="flex w-44 flex-col gap-1.5"><label htmlFor="exp-hasta" className="text-xs text-muted">Hasta</label><DatePicker id="exp-hasta" value={hasta} onChange={setHasta} formato={formato} placeholder="Sin límite" min={desde || undefined} /></div>
            {(desde || hasta) && <Button variant="ghost" onClick={() => { setDesde(''); setHasta('') }}>Quitar rango</Button>}
          </fieldset>
          {rangoInvalido && <Alert tone="error">La fecha inicial es posterior a la final.</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => ejecutar('csv')} loading={activo === 'csv'} disabled={ocupado || rangoInvalido}><Download className="size-4" aria-hidden="true" /> Exportar CSV</Button>
            {activo === 'csv' && <Button variant="secondary" onClick={() => control.current?.abort()}>Cancelar</Button>}
          </div>
        </section>

        <section aria-labelledby="exp-json" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-pri-soft text-pri"><FileJson className="size-5" aria-hidden="true" /></span>
            <div>
              <h3 id="exp-json" className="font-display text-base font-bold">Respaldo completo (JSON)</h3>
              <p className="text-sm text-muted">Catálogo, fondos y reglas de cobertura, períodos y presupuestos, gastos, imputaciones y plantillas, con versión de esquema. Sirve para conservar una copia o migrar.</p>
            </div>
          </div>
          <ul className="list-disc pl-5 text-sm text-muted">
            <li>No incluye contraseñas, tokens, sesiones, claves ni variables de entorno.</li>
            <li>No incluye los archivos de comprobantes ni sus enlaces; solo se indica si un gasto tiene comprobante.</li>
            <li>Se lee con tu sesión: solo salen datos de tu hogar.</li>
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setConfirmarRespaldo(true)} loading={activo === 'json'} disabled={ocupado}><Download className="size-4" aria-hidden="true" /> Descargar respaldo</Button>
            {activo === 'json' && <Button variant="secondary" onClick={() => control.current?.abort()}>Cancelar</Button>}
          </div>
        </section>
      </div>

      <div role="status" aria-live="polite" className="min-h-6 text-sm text-muted">{ocupado ? progreso : ''}</div>
      <p className="text-xs text-muted">Con muchos registros la lectura se hace por tandas de 1,000 y puede tardar unos segundos; puedes seguir usando la aplicación mientras tanto o cancelar.</p>

      <ConfirmDialog
        open={confirmarRespaldo}
        onOpenChange={setConfirmarRespaldo}
        title="¿Descargar el respaldo completo?"
        description="Se leerá todo tu historial, lo que puede tardar si tienes muchos registros. El archivo contiene tus datos financieros: guárdalo en un lugar seguro."
        confirmLabel="Descargar respaldo"
        onConfirm={() => { setConfirmarRespaldo(false); void ejecutar('json') }}
      />
    </div>
  )
}
