import * as Tooltip from '@radix-ui/react-tooltip'
import * as Popover from '@radix-ui/react-popover'
import { Info } from 'lucide-react'
import { isValidElement, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { TooltipGrafico } from './TooltipGrafico'

/** Ayuda bajo demanda: clic, toque o teclado; Escape cierra solo esta capa. */
export function AyudaInfo({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <Popover.Root>
    <Popover.Trigger type="button" aria-label={label} className={cn('grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-pri focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pri', className)}>
      <Info className="size-4" aria-hidden="true" />
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content aria-label={label} sideOffset={6} collisionPadding={12} align="end" onEscapeKeyDown={(e) => e.stopPropagation()} className="anim-pop z-[100] max-h-[calc(100dvh-2rem)] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface p-3 text-sm text-fg shadow-pop">
        {children}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
}

/** Contenedor global de tooltips (una sola vez, en la raíz de la aplicación). */
export const HintProvider = ({ children }: { children: ReactNode }) => (
  <Tooltip.Provider delayDuration={120} skipDelayDuration={300}>
    {children}
  </Tooltip.Provider>
)

/** Tarjeta flotante con el estilo común de la aplicación (tooltips de gráficos y popovers informativos). */
export function TarjetaFlotante({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg shadow-pop', className)}>{children}</div>
}

/**
 * Tooltip accesible: aparece al pasar el cursor y también al enfocar con teclado; se cierra con Escape.
 * Se reubica solo para no salirse de la pantalla.
 */
export function Hint({ contenido, children, side = 'top', align = 'center' }: { contenido: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; align?: 'start' | 'center' | 'end' }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} align={align} sideOffset={8} collisionPadding={12} className="anim-pop z-[90] max-w-xs">
          {/* Las tarjetas de gráficos (TooltipGrafico) traen su propio contenedor: no se envuelven dos veces. */}
          {isValidElement(contenido) && contenido.type === TooltipGrafico ? contenido : <TarjetaFlotante>{contenido}</TarjetaFlotante>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

