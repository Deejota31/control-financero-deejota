import { useEffect, useState } from 'react'
import { env, supabase } from '@/lib/supabase'

type Estado = 'comprobando' | 'conectado' | 'error'

export function App() {
  const [estado, setEstado] = useState<Estado>('comprobando')

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ error }) => setEstado(error ? 'error' : 'conectado'))
      .catch(() => setEstado('error'))
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="font-display text-3xl font-bold">Gasto Deejota</h1>
      <p className="text-muted">Entorno: {env.appEnv}</p>
      <p
        role="status"
        className={estado === 'error' ? 'text-bad' : estado === 'conectado' ? 'text-ok' : 'text-muted'}
      >
        {estado === 'comprobando' && 'Comprobando conexión con Supabase…'}
        {estado === 'conectado' && 'Conectado a Supabase local.'}
        {estado === 'error' && 'No se pudo conectar. Ejecuta npm run db:start y revisa .env.local.'}
      </p>
    </main>
  )
}
