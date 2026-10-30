import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (event: string, session: unknown) => void
const h = vi.hoisted(() => {
  const state = { listener: (() => {}) as (event: string, session: unknown) => void }
  const signOutMock = vi.fn(async () => {
    state.listener('SIGNED_OUT', null)
    return { error: null }
  })
  return { state, signOutMock }
})
const signOutMock = h.signOutMock

vi.mock('@/lib/supabase', () => ({
  env: { appEnv: 'local' },
  supabase: {
    auth: {
      onAuthStateChange: (cb: Listener) => {
        h.state.listener = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1', email: 'a@b.co' } } }, error: null })),
      signOut: h.signOutMock,
    },
  },
}))

import { AuthProvider, useAuth } from './AuthProvider'

function Probe() {
  const { status, signOut } = useAuth()
  return (
    <>
      <p data-testid="estado">{status}</p>
      <button onClick={() => signOut()}>salir</button>
    </>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => signOutMock.mockClear())

  it('recupera la sesión guardada', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(await screen.findByText('authenticated')).toBeInTheDocument()
  })

  it('marca "expired" si la sesión termina sin que el usuario la cierre', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await screen.findByText('authenticated')
    act(() => h.state.listener('SIGNED_OUT', null))
    expect(screen.getByTestId('estado')).toHaveTextContent('expired')
  })

  it('marca "unauthenticated" cuando el usuario cierra la sesión', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await screen.findByText('authenticated')
    await act(async () => screen.getByText('salir').click())
    expect(screen.getByTestId('estado')).toHaveTextContent('unauthenticated')
  })
})
