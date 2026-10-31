import { Download, Share, SquarePlus, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Isotipo } from '@/components/brand/BrandLogo'
import { CLAVE_POSPONER, invitacionPosponida, lanzarInstalacion, posponidaHasta, useModoInstalacion } from '@/lib/pwa'
import { MARCA } from '@/lib/marca'

function leerPosposicion(): number | null {
  try { const v = localStorage.getItem(CLAVE_POSPONER); return v ? Number(v) : null } catch { return null }
}
function guardarPosposicion() {
  try { localStorage.setItem(CLAVE_POSPONER, String(posponidaHasta(Date.now()))) } catch { /* sin almacenamiento: la invitación reaparece en la próxima visita */ }
}

/**
 * Invitación discreta para instalar la aplicación. Solo aparece si de verdad se puede instalar: con el evento nativo (Android, Chrome y Edge de
 * escritorio) o, en iPhone/iPad, con las instrucciones de «Agregar a pantalla de inicio». Si ya está instalada, no se muestra. Se puede posponer.
 */
export function AvisoInstalacion() {
  const modo = useModoInstalacion()
  const [pospuesta, setPospuesta] = useState(() => invitacionPosponida(leerPosposicion(), Date.now()))
  const [instrucciones, setInstrucciones] = useState(false)

  if (pospuesta || (modo !== 'nativa' && modo !== 'ios')) return null

  const posponer = () => { guardarPosposicion(); setPospuesta(true) }
  const instalar = async () => {
    if (modo === 'ios') { setInstrucciones(true); return }
    const r = await lanzarInstalacion()
    if (r === 'dismissed') posponer() // la persona rechazó el diálogo del sistema: no se insiste
  }

  return (
    <>
      <section aria-label={`Instalar ${MARCA.nombre}`} className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-sm">
        <Isotipo tono="aurora" tamano={36} />
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm font-semibold">Instala {MARCA.nombre}</p>
          <p className="text-xs text-muted">Ábrelo como una aplicación, con su propio icono y a pantalla completa.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button onClick={instalar} className="min-h-10">
            {modo === 'ios' ? <Share className="size-4" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
            {modo === 'ios' ? 'Cómo instalar' : `Instalar ${MARCA.nombre}`}
          </Button>
          <button type="button" onClick={posponer} aria-label="Ahora no: no mostrar la invitación a instalar por unos días" title="Ahora no"
            className="grid size-10 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <Modal open={instrucciones} onOpenChange={setInstrucciones} title={`Instalar ${MARCA.nombre} en tu iPhone`} size="sm"
        description="En iPhone y iPad se instala desde el navegador, con tres toques."
        footer={(cerrar) => <Button onClick={cerrar}>Entendido</Button>}>
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
          <li>Abre esta página en <b>Safari</b>.</li>
          <li>Toca el botón <b>Compartir</b> <Share className="inline size-4 align-text-bottom" aria-hidden="true" /> de la barra del navegador.</li>
          <li>Elige <b>Agregar a pantalla de inicio</b> <SquarePlus className="inline size-4 align-text-bottom" aria-hidden="true" /> y confirma con <b>Agregar</b>.</li>
        </ol>
        <p className="mt-4 text-xs text-muted">Después ábrelo desde su icono: se muestra sin las barras del navegador y conserva tu sesión.</p>
      </Modal>
    </>
  )
}
