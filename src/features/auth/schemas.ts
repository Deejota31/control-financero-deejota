import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Ingresa tu correo.').pipe(z.email('Ingresa un correo válido.')),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const recoverSchema = z.object({
  email: z.string().trim().min(1, 'Ingresa tu correo.').pipe(z.email('Ingresa un correo válido.')),
})
export type RecoverValues = z.infer<typeof recoverSchema>

export const MIN_PASSWORD = 10

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD, `Usa al menos ${MIN_PASSWORD} caracteres.`)
      .regex(/[a-z]/, 'Incluye al menos una minúscula.')
      .regex(/[A-Z]/, 'Incluye al menos una mayúscula.')
      .regex(/\d/, 'Incluye al menos un número.'),
    confirm: z.string().min(1, 'Repite la contraseña.'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden.' })
export type NewPasswordValues = z.infer<typeof newPasswordSchema>
