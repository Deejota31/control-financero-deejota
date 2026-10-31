import { WifiOff } from 'lucide-react'
import { useEnLinea } from '@/lib/pwa'

/**
 * Aviso discreto cuando se pierde la conexión. No simula nada: lo que se ve es lo último cargado y guardar cambios requiere Internet.
 * No bloquea la pantalla ni toca los formularios abiertos (lo escrito se conserva; al guardar sin red la operación falla con su aviso habitual,
 * y las operaciones financieras llevan clave de idempotencia, así que un reintento al volver la conexión no duplica nada).
 */
export function AvisoConexion() {
  const enLinea = useEnLinea()
  if (enLinea) return null
  return (
    <div role="status" aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[45] mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium shadow-pop lg:bottom-6">
      <WifiOff className="size-4 shrink-0 text-warn" aria-hidden="true" />
      <span className="min-w-0">Sin conexión · guardar cambios requiere Internet</span>
    </div>
  )
}
