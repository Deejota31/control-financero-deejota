import { z } from 'zod'

export const TEMAS = ['claro', 'oscuro'] as const
export const FORMATOS_FECHA = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'] as const

export const perfilSchema = z.object({
  nombre: z.string().trim().max(80, 'Máximo 80 caracteres.'),
  zona_horaria: z.string().min(1, 'Elige una zona horaria.'),
  formato_fecha: z.enum(FORMATOS_FECHA),
  tema: z.enum(TEMAS),
})
export type PerfilValues = z.infer<typeof perfilSchema>

export function zonasHorarias(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['America/Lima']
  }
}
