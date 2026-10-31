import { Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { useActualizarPerfil } from '@/features/perfil/usePerfil'
import { useTema } from './ThemeProvider'

/**
 * Interruptor de tema claro/oscuro: ÚNICO control de tema de toda la aplicación (pantallas de acceso y cabecera).
 * Pista en forma de píldora con el sol y la luna, y una perilla que siempre queda dentro de la pista (medidas fijas: 60 × 32 px, perilla de 24 px con
 * 4 px de holgura). El área táctil llega a 44 px de alto sin agrandar lo que se ve. Es un `switch` accesible (`aria-checked` = tema oscuro) y se opera
 * con el teclado (Espacio/Intro). La fuente de verdad del tema es el ThemeProvider (que también lo persiste en este navegador); con sesión, además,
 * se guarda en el perfil. Sin sesión (`guardarEnPerfil={false}`) solo cambia el tema local.
 */
export function ThemeSwitch({ guardarEnPerfil = true, className }: { guardarEnPerfil?: boolean; className?: string }) {
  const { tema, setTema } = useTema()
  const actualizar = useActualizarPerfil()
  const oscuro = tema === 'oscuro'
  const siguiente = oscuro ? 'claro' : 'oscuro'
  return (
    <button type="button" role="switch" aria-checked={oscuro} aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      onClick={() => {
        setTema(siguiente)
        if (guardarEnPerfil) actualizar.mutate({ theme: siguiente }, { onError: () => toast.error('No se pudo guardar el tema en tu perfil.') })
      }}
      className={cn('theme-switch relative inline-flex h-8 w-[3.75rem] shrink-0 items-center rounded-full after:absolute after:-inset-x-1.5 after:-inset-y-2 after:content-[\'\']', className)}>
      <Sun className="absolute left-2 size-4 opacity-70" aria-hidden="true" />
      <Moon className="absolute right-2 size-4 opacity-70" aria-hidden="true" />
      <span aria-hidden="true" className={cn('theme-switch-perilla absolute left-[3px] top-[3px] grid size-6 place-items-center rounded-full transition-transform duration-200 ease-out motion-reduce:transition-none', oscuro ? 'translate-x-7' : 'translate-x-0')}>
        {oscuro ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      </span>
    </button>
  )
}
