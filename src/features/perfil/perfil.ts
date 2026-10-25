import { z } from 'zod'

export const TEMAS = ['claro', 'oscuro'] as const
export const FORMATOS_FECHA = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'] as const

export const perfilSchema = z.object({
  display_name: z.string().trim().max(80, 'Máximo 80 caracteres.'),
  timezone: z.string().min(1, 'Elige una zona horaria.'),
  date_format: z.enum(FORMATOS_FECHA),
  theme: z.enum(TEMAS),
})
export type PerfilValues = z.infer<typeof perfilSchema>

export function zonasHorarias(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['America/Lima']
  }
}
