import { describe, expect, it } from 'vitest'
import { validateEnv } from './env'

const local = {
  VITE_APP_ENV: 'local',
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_ANON_KEY: 'anon',
}
const prod = {
  VITE_APP_ENV: 'production',
  VITE_SUPABASE_URL: 'https://abc.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon',
}

describe('validateEnv', () => {
  it('acepta entorno local en desarrollo', () => {
    expect(validateEnv(local, true).appEnv).toBe('local')
  })
  it('bloquea desarrollo contra una URL de producción', () => {
    expect(() => validateEnv(prod, true)).toThrow(/solo puede conectarse a Supabase local/)
  })
  it('bloquea VITE_APP_ENV=local con URL remota', () => {
    expect(() => validateEnv({ ...local, VITE_SUPABASE_URL: 'https://abc.supabase.co' }, false)).toThrow(/local/)
  })
  it('bloquea producción apuntando a localhost', () => {
    expect(() => validateEnv({ ...prod, VITE_SUPABASE_URL: 'http://localhost:54321' }, false)).toThrow(/producción/)
  })
  it('exige claves y entorno explícito', () => {
    expect(() => validateEnv({}, true)).toThrow(/VITE_APP_ENV/)
    expect(() => validateEnv({ VITE_APP_ENV: 'local' }, true)).toThrow(/Faltan/)
  })
})
