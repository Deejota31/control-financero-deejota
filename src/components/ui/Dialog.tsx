import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import * as Popover from '@radix-ui/react-popover'
import { Info, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Explicación breve que se abre desde un icono de información junto a la X. */
  ayuda?: ReactNode
  /** Hay cambios sin guardar: cerrar (X, Escape, fondo o «Cancelar») pregunta si seguir editando o descartar. */
  sucio?: boolean
  /** Acciones principales, siempre visibles bajo el cuerpo con scroll. Recibe `cerrar`, que respeta la confirmación de descarte. */
  footer?: ReactNode | ((cerrar: () => void) => ReactNode)
  /**
   * `scroll` (por defecto): el cuerpo completo se desplaza. `fijo`: el diálogo ocupa una altura acotada por la pantalla y el cuerpo NO se desplaza por sí
   * mismo: el contenido reparte su altura (zona superior fija, una zona central con su propio scroll y el pie), así crecer o expandir filas no agranda el diálogo.
   */
  layout?: 'scroll' | 'fijo'
  children: ReactNode
}

/** Hay otro diálogo abierto (p. ej. el asistente bajo un formulario secundario): el foco es suyo y no se debe mover a la página. */
const hayDialogoAbierto = () => Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'))

/**
 * Devuelve el foco al control de origen; si ya no existe (la lista se redibujó), al contenido principal. Con otro diálogo aún abierto nunca se
 * enfoca la página: sacar el foco de un diálogo modal lo cerraría (foco fuera) y rompería los diálogos anidados.
 */
function devolverFoco(origen: HTMLElement | null) {
  if (origen?.isConnected) origen.focus()
  else if (!hayDialogoAbierto()) document.getElementById('contenido')?.focus()
  // Si la acción retira el control de origen (p. ej. una fila anulada), el foco no debe quedar perdido en <body>.
  setTimeout(() => {
    const a = document.activeElement
    if ((!a || a === document.body || !a.isConnected) && !hayDialogoAbierto()) document.getElementById('contenido')?.focus()
  }, 500)
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', '2xl': 'max-w-6xl' }

/** Diálogo modal accesible. Se muestra sobre la página de origen para conservar el contexto. */
export function Modal({ open, onOpenChange, title, description, size = 'md', ayuda, sucio, footer, layout = 'scroll', children }: ModalProps) {
  // Al cerrar, el foco vuelve al control que abrió el diálogo (se monta al abrir).
  const [origen] = useState(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)))
  const [descartando, setDescartando] = useState(false)
  const cerrar = () => (sucio ? setDescartando(true) : onOpenChange(false))
  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : cerrar())}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          // Un control interno (p. ej. el explorador de íconos) puede quedarse con Escape para contraerse sin cerrar el diálogo
          // Mientras haya un control interno abierto que se contrae con Escape (p. ej. el explorador de íconos), Escape es suyo aunque el foco aún no haya llegado a él.
          onEscapeKeyDown={(e) => { if (document.querySelector('[data-captura-escape]')) e.preventDefault() }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            devolverFoco(origen)
          }}
          className={cn(
            'anim-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] sm:max-h-[92dvh] sm:w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface shadow-pop',
            SIZES[size],
            layout === 'fijo' && 'h-[calc(100dvh-1rem)] sm:h-[min(92dvh,56rem)]',
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-3 sm:px-6 sm:py-4 [@media(max-height:520px)]:py-2">
            <div className="min-w-0">
              <Dialog.Title className="break-words font-display text-lg font-bold [@media(max-height:520px)]:text-base">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 break-words text-sm text-muted max-sm:line-clamp-2 max-sm:text-xs [@media(max-height:520px)]:sr-only">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {ayuda && (
                <Popover.Root>
                  <Popover.Trigger aria-label="Ayuda: cómo funciona" className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-pri">
                    <Info className="size-4" aria-hidden="true" />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content align="end" sideOffset={6} onEscapeKeyDown={(e) => e.stopPropagation()} className="z-[80] w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-3 text-sm shadow-pop">
                      {ayuda}
                      <Popover.Arrow className="fill-surface" />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              )}
              <Dialog.Close aria-label="Cerrar" className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-surface-2">
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>
          <div className={cn('min-h-0 min-w-0 flex-1 px-4 sm:px-6', layout === 'fijo' ? 'flex flex-col overflow-hidden pb-2 pt-3' : 'overflow-y-auto overscroll-contain py-4 sm:py-5 [@media(max-height:520px)]:py-2')}>{children}</div>
          {footer && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 [@media(max-height:520px)]:py-2">
              {typeof footer === 'function' ? footer(cerrar) : footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
      <ConfirmDialog open={descartando} onOpenChange={setDescartando} title="¿Descartar los cambios?" description="Tienes cambios sin guardar en este formulario. Si sales ahora, se perderán."
        confirmLabel="Descartar cambios" cancelLabel="Seguir editando" devolverElFoco={false} danger onConfirm={() => { setDescartando(false); onOpenChange(false) }} />
    </Dialog.Root>
  )
}

interface ConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** Al cerrar, devuelve el foco al control que lo abrió. Se desactiva cuando otro diálogo se encarga de restaurarlo. */
  devolverElFoco?: boolean
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
}

/** Confirmación previa para acciones destructivas o que afectan a varios registros. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Cancelar', devolverElFoco = true, danger, loading, onConfirm }: ConfirmProps) {
  // El diálogo está siempre montado: el origen se captura justo antes de que Radix mueva el foco al abrir.
  const [origen, setOrigen] = useState<HTMLElement | null>(null)
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="anim-overlay fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" />
        <AlertDialog.Content
          onOpenAutoFocus={() => setOrigen(document.activeElement as HTMLElement | null)}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            if (devolverElFoco) devolverFoco(origen)
          }}
          className="anim-dialog fixed left-1/2 top-1/2 z-[70] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border border-line bg-surface p-6 shadow-pop">
          <AlertDialog.Title className="font-display text-lg font-bold">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="text-sm text-muted">{description}</div>
          </AlertDialog.Description>
          <div className="mt-2 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={loading}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
