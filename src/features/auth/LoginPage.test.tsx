import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ env: { appEnv: 'local' }, supabase: {} }))

import { AuthContext, type AuthContextValue } from './AuthProvider'
import { LoginPage } from './LoginPage'

function setup(signIn: AuthContextValue['signIn']) {
  const value: AuthContextValue = { status: 'unauthenticated', session: null, user: null, signIn, signOut: vi.fn(), retry: vi.fn() }
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('LoginPage', () => {
  it('valida campos requeridos sin llamar al servidor', async () => {
    const signIn = vi.fn()
    setup(signIn)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Ingresa tu correo.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('muestra el error y la guía local si las credenciales no sirven', async () => {
    const signIn = vi.fn(async () => ({ error: 'Correo o contraseña incorrectos.', kind: 'credentials' as const }))
    setup(signIn)
    await userEvent.type(screen.getByLabelText('Correo'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(screen.getByRole('alert')).toHaveTextContent('npm run db:reset')
    expect(signIn).toHaveBeenCalledWith('a@b.co', 'mala')
  })

  it('evita el doble envío mientras espera', async () => {
    let resolver: (v: { error: null }) => void = () => {}
    const signIn = vi.fn(() => new Promise<{ error: null }>((r) => (resolver = r)))
    setup(signIn)
    await userEvent.type(screen.getByLabelText('Correo'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    const btn = await screen.findByRole('button', { name: 'Entrando…' })
    expect(btn).toBeDisabled()
    await userEvent.click(btn)
    expect(signIn).toHaveBeenCalledTimes(1)
    resolver({ error: null })
  })
})
