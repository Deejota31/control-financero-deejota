import { describe, expect, it } from 'vitest'
import { perfilSchema } from '@/features/perfil/perfil'
import { loginSchema, newPasswordSchema } from './schemas'

describe('loginSchema', () => {
  it('exige correo y contraseña', () => {
    const r = loginSchema.safeParse({ email: '', password: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues.map((i) => i.message)).toEqual(['Ingresa tu correo.', 'Ingresa tu contraseña.'])
  })
  it('rechaza un correo mal formado', () => {
    expect(loginSchema.safeParse({ email: 'abc', password: 'x' }).error?.issues[0].message).toBe('Ingresa un correo válido.')
  })
  it('acepta datos válidos', () => {
    expect(loginSchema.safeParse({ email: ' a@b.co ', password: 'x' }).data?.email).toBe('a@b.co')
  })
})

describe('newPasswordSchema', () => {
  it('exige 8 caracteres', () => {
    expect(newPasswordSchema.safeParse({ password: 'corta', confirm: 'corta' }).success).toBe(false)
  })
  it('exige que coincidan', () => {
    const r = newPasswordSchema.safeParse({ password: 'Suficiente1', confirm: 'Otra12345' })
    expect(r.error?.issues[0].message).toBe('Las contraseñas no coinciden.')
  })
  it('acepta contraseñas válidas', () => {
    expect(newPasswordSchema.safeParse({ password: 'Suficiente1', confirm: 'Suficiente1' }).success).toBe(true)
  })
})

describe('perfilSchema', () => {
  const base = { nombre: 'Ana', zona_horaria: 'America/Lima', formato_fecha: 'dd/MM/yyyy', tema: 'claro' }
  it('acepta un perfil válido y permite nombre vacío', () => {
    expect(perfilSchema.safeParse(base).success).toBe(true)
    expect(perfilSchema.safeParse({ ...base, nombre: '' }).success).toBe(true)
  })
  it('rechaza nombre largo, formato y tema inválidos', () => {
    expect(perfilSchema.safeParse({ ...base, nombre: 'a'.repeat(81) }).success).toBe(false)
    expect(perfilSchema.safeParse({ ...base, formato_fecha: 'x' }).success).toBe(false)
    expect(perfilSchema.safeParse({ ...base, tema: 'azul' }).success).toBe(false)
  })
})
