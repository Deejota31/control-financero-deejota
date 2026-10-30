export type AppEnv = 'local' | 'production'

export interface RawEnv {
  VITE_APP_ENV?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

export interface EnvConfig {
  appEnv: AppEnv
  supabaseUrl: string
  supabaseAnonKey: string
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * Valida el entorno y bloquea combinaciones peligrosas:
 * - modo desarrollo solo contra Supabase local;
 * - build de producción nunca contra una URL local.
 */
export function validateEnv(raw: RawEnv, isDev: boolean): EnvConfig {
  const appEnv = raw.VITE_APP_ENV
  if (appEnv !== 'local' && appEnv !== 'production') {
    throw new Error('VITE_APP_ENV debe ser "local" o "production". Revisa tu .env.local.')
  }
  const url = raw.VITE_SUPABASE_URL
  const key = raw.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local.')
  }
  const local = isLocalUrl(url)
  if (isDev && (appEnv !== 'local' || !local)) {
    throw new Error('Bloqueado: el modo desarrollo solo puede conectarse a Supabase local (127.0.0.1).')
  }
  if (appEnv === 'local' && !local) {
    throw new Error('Bloqueado: VITE_APP_ENV=local exige una URL de Supabase local.')
  }
  if (appEnv === 'production' && local) {
    throw new Error('Bloqueado: producción no puede apuntar a una URL local.')
  }
  return { appEnv, supabaseUrl: url, supabaseAnonKey: key }
}
