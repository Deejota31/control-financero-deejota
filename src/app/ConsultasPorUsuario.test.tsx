import { render, screen, waitFor } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthProvider'
import { useHogar } from '@/features/dashboard/useDashboard'
import { ConsultasPorUsuario } from './ConsultasPorUsuario'

// El «servidor» devuelve el hogar de quien tiene la sesión actual (RLS): cambia cuando cambia la persona.
const servidor = vi.hoisted(() => ({ hogar: 'Hogar de Ana' }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ limit: () => ({ single: async () => ({ data: { id: servidor.hogar, name: servidor.hogar, is_demo: false }, error: null }) }) }) }) },
}))

const auth = (id: string | null): AuthContextValue => ({
  status: id ? 'authenticated' : 'unauthenticated', session: null, user: id ? ({ id } as AuthContextValue['user']) : null,
  signIn: async () => ({ error: null }), signOut: async () => {}, retry: () => {},
})
const Sesion = ({ id, children }: { id: string | null; children: ReactNode }) => <AuthContext.Provider value={auth(id)}><ConsultasPorUsuario>{children}</ConsultasPorUsuario></AuthContext.Provider>

function Pantalla({ vistos }: { vistos: (string | undefined)[] }) {
  const h = useHogar() // staleTime de 5 minutos: sin aislamiento, el segundo usuario vería el hogar del primero sin pedir nada
  vistos.push(h.data?.name)
  return <p>{h.data?.name ?? 'cargando'}</p>
}
function Espia({ alCache }: { alCache: (n: number) => void }) {
  const qc = useQueryClient()
  useEffect(() => { alCache(qc.getQueryCache().getAll().length) })
  return null
}

describe('aislamiento de datos entre sesiones', () => {
  it('al cambiar de usuario en el mismo navegador nunca se renderiza el hogar del anterior', async () => {
    const vistos: (string | undefined)[] = []
    servidor.hogar = 'Hogar de Ana'
    const { rerender } = render(<Sesion id="ana"><Pantalla vistos={vistos} /></Sesion>)
    await screen.findByText('Hogar de Ana')

    servidor.hogar = 'Hogar de Beto'
    const antes = vistos.length
    rerender(<Sesion id="beto"><Pantalla vistos={vistos} /></Sesion>)
    await screen.findByText('Hogar de Beto')
    // Desde el primer render con la identidad nueva, jamás aparece el dato de Ana
    expect(vistos.slice(antes)).not.toContain('Hogar de Ana')
    expect(vistos.slice(antes)[0]).toBeUndefined()
  })

  it('al cerrar sesión la caché queda vacía y otra persona que entra después no recibe nada del anterior', async () => {
    const vistos: (string | undefined)[] = []
    let enCache = -1
    servidor.hogar = 'Hogar de Ana'
    const { rerender } = render(<Sesion id="ana"><Pantalla vistos={vistos} /><Espia alCache={(n) => { enCache = n }} /></Sesion>)
    await screen.findByText('Hogar de Ana')
    expect(enCache).toBeGreaterThan(0)

    rerender(<Sesion id={null}><Espia alCache={(n) => { enCache = n }} /></Sesion>)
    await waitFor(() => expect(enCache).toBe(0)) // caché nueva y vacía; la anterior fue cancelada y limpiada

    servidor.hogar = 'Hogar de Carla'
    const antes = vistos.length
    rerender(<Sesion id="carla"><Pantalla vistos={vistos} /></Sesion>)
    await screen.findByText('Hogar de Carla')
    expect(vistos.slice(antes)).not.toContain('Hogar de Ana')
  })

  it('con la misma identidad la caché se conserva (un refresco de token no recarga todo)', async () => {
    const vistos: (string | undefined)[] = []
    servidor.hogar = 'Hogar de Ana'
    const { rerender } = render(<Sesion id="ana"><Pantalla vistos={vistos} /></Sesion>)
    await screen.findByText('Hogar de Ana')
    const antes = vistos.length
    rerender(<Sesion id="ana"><Pantalla vistos={vistos} /></Sesion>)
    expect(vistos.slice(antes).every((v) => v === 'Hogar de Ana')).toBe(true)
  })
})
