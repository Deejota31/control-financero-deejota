import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthProvider'
import { PublicOnly, RequireAuth } from './RouteGuards'

function renderApp(status: AuthStatus, retry = vi.fn()) {
  const value: AuthContextValue = {
    status,
    session: null,
    user: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    retry,
  }
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/privada']}>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/acceso" element={<p>pantalla acceso</p>} />
          </Route>
          <Route path="/sesion-expirada" element={<p>pantalla vencida</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/privada" element={<p>contenido privado</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return retry
}

describe('RequireAuth', () => {
  it('muestra carga mientras recupera la sesión', () => {
    renderApp('loading')
    expect(screen.getByRole('status')).toHaveTextContent('Recuperando tu sesión')
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument()
  })
  it('redirige a /acceso sin sesión', () => {
    renderApp('unauthenticated')
    expect(screen.getByText('pantalla acceso')).toBeInTheDocument()
  })
  it('redirige a /sesion-expirada si la sesión venció', () => {
    renderApp('expired')
    expect(screen.getByText('pantalla vencida')).toBeInTheDocument()
  })
  it('deja pasar con sesión activa', () => {
    renderApp('authenticated')
    expect(screen.getByText('contenido privado')).toBeInTheDocument()
  })
  it('ofrece reintentar si falla la verificación', async () => {
    const retry = renderApp('error')
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
