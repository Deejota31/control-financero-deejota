import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * - loading: recuperando la sesión guardada
 * - error: no se pudo consultar a Supabase (conexión)
 * - expired: la sesión terminó sin que el usuario la cerrara
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'expired' | 'error'

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  user: User | null
  signIn: (email: string, password: string) => Promise<{ error: string | null; kind?: 'credentials' | 'network' | 'other' }>
  signOut: () => Promise<void>
  retry: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const explicitSignOut = useRef(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setStatus(explicitSignOut.current ? 'unauthenticated' : 'expired')
        explicitSignOut.current = false
        return
      }
      setSession(next)
      if (next) setStatus('authenticated')
    })

    supabase.auth
      .getSession()
      .then(({ data: { session: current }, error }) => {
        if (!active) return
        if (error) {
          setStatus('error')
          return
        }
        setSession(current)
        setStatus((prev) => (prev === 'expired' ? prev : current ? 'authenticated' : 'unauthenticated'))
      })
      .catch(() => active && setStatus('error'))

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [attempt])

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) return { error: null }
      if (error.status === 400 || error.code === 'invalid_credentials') {
        return { error: 'Correo o contraseña incorrectos.', kind: 'credentials' }
      }
      if (error.name === 'AuthRetryableFetchError') {
        return { error: 'No se pudo conectar con el servidor.', kind: 'network' }
      }
      return { error: 'No se pudo iniciar sesión. Inténtalo de nuevo.', kind: 'other' }
    } catch {
      return { error: 'No se pudo conectar con el servidor.', kind: 'network' }
    }
  }, [])

  const signOut = useCallback(async () => {
    explicitSignOut.current = true
    const { error } = await supabase.auth.signOut()
    if (error) {
      // Sin red el servidor no confirma; se cierra solo la sesión local.
      await supabase.auth.signOut({ scope: 'local' })
    }
  }, [])

  const retry = useCallback(() => {
    setStatus('loading')
    setAttempt((n) => n + 1)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, user: session?.user ?? null, signIn, signOut, retry }),
    [status, session, signIn, signOut, retry],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
