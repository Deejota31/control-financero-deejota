import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ env: { appEnv: 'local' }, supabase: {} }))

import { AuthContext, type AuthContextValue } from './AuthProvider'
import { ThemeProvider } from '@/features/tema/ThemeProvider'
import { LoginPage } from './LoginPage'

function setup(signIn: AuthContextValue['signIn']) {
  const value: AuthContextValue = { status: 'unauthenticated', session: null, user: null, signIn, signOut: vi.fn(), retry: vi.fn() }
  render(
    <ThemeProvider>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={value}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('LoginPage', () => {
  it('valida campos requeridos sin llamar al servidor', async () => {
    const signIn = vi.fn()
    setup(signIn)
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Ingresa tu correo.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('muestra el error y la guía local si las credenciales no sirven', async () => {
    const signIn = vi.fn(async () => ({ error: 'Correo o contraseña incorrectos.', kind: 'credentials' as const }))
    setup(signIn)
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Contraseña', { exact: true }), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(screen.getByRole('alert')).toHaveTextContent('npm run db:reset')
    expect(signIn).toHaveBeenCalledWith('a@b.co', 'mala')
  })

  it('evita el doble envío mientras espera', async () => {
    let resolver: (v: { error: null }) => void = () => {}
    const signIn = vi.fn(() => new Promise<{ error: null }>((r) => (resolver = r)))
    setup(signIn)
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Contraseña', { exact: true }), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    const btn = await screen.findByRole('button', { name: 'Iniciando sesión…' })
    expect(btn).toBeDisabled()
    await userEvent.click(btn)
    expect(signIn).toHaveBeenCalledTimes(1)
    resolver({ error: null })
  })

  it('muestra la identidad nueva: Control Financiero, "Bienvenido de nuevo" y ningún nombre anterior', () => {
    setup(vi.fn())
    expect(screen.getByRole('heading', { level: 1, name: 'Bienvenido de nuevo' })).toBeInTheDocument()
    expect(screen.getByText('Ingresa a tu cuenta para continuar.')).toBeInTheDocument()
    expect(screen.getAllByText('Control Financiero').length).toBeGreaterThan(0)
    expect(document.title).toBe('Iniciar sesión | Control Financiero')
    expect(document.body.textContent).not.toMatch(/gasto deejota|deejota/i)
  })

  it('Enter envía el formulario, mostrar/ocultar la contraseña no lo envía y los botones sociales no inician sesión', async () => {
    const signIn = vi.fn(async () => ({ error: null }))
    setup(signIn)
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Contraseña', { exact: true }), 'clave-1234')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    await userEvent.click(screen.getByRole('button', { name: /Continuar con Google/ }))
    await userEvent.click(screen.getByRole('button', { name: /Continuar con Facebook/ }))
    expect(signIn).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Contraseña', { exact: true }), '{Enter}')
    expect(signIn).toHaveBeenCalledWith('a@b.co', 'clave-1234')
  })
})
