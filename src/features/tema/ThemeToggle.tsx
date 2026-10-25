import { Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useActualizarPerfil } from '@/features/perfil/usePerfil'
import { useTema } from './ThemeProvider'

/** Alterna claro/oscuro y guarda la preferencia en el perfil (si falla, el tema local se conserva). */
export function ThemeToggle() {
  const { tema, setTema } = useTema()
  const actualizar = useActualizarPerfil()
  const siguiente = tema === 'oscuro' ? 'claro' : 'oscuro'

  return (
    <button
      type="button"
      onClick={() => {
        setTema(siguiente)
        actualizar.mutate({ tema: siguiente }, { onError: () => toast.error('No se pudo guardar el tema en tu perfil.') })
      }}
      aria-label={tema === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      className="grid size-9 place-items-center rounded-md border border-line bg-surface hover:bg-surface-2"
    >
      {tema === 'oscuro' ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </button>
  )
}
