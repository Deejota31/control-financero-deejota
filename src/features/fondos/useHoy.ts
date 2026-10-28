import { usePerfil } from '@/features/perfil/usePerfil'
import { hoyEnZona } from '@/lib/hoy'

/** Hoy en la zona horaria configurada por la persona (por defecto la del navegador). */
export function useHoy(): string {
  const zona = usePerfil().data?.timezone
  return hoyEnZona(zona)
}
