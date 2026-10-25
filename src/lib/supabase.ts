import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { validateEnv } from './env'

export const env = validateEnv(import.meta.env, import.meta.env.DEV)

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})
