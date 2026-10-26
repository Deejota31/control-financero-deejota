import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/** Identificador fijo del usuario de pruebas E2E (no es un secreto; sus credenciales viven en .env.local). */
export const E2E_UID = '22222222-2222-2222-2222-222222222222'
const CONTENEDOR = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_control-financero-deejota'

function psql(sql: string): string {
  try {
    return execFileSync('docker', ['exec', CONTENEDOR, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA', '-c', sql], { encoding: 'utf8' }).trim()
  } catch (e) {
    throw new Error(`No se pudo ejecutar SQL en el contenedor "${CONTENEDOR}". ¿Está Docker abierto y Supabase iniciado (npm run db:start)?\n${(e as Error).message}`)
  }
}

const literal = (s: string) => `'${s.replace(/'/g, "''")}'`

/**
 * Carga las fixtures de pruebas (supabase/fixtures/e2e.sql: funciones dev_* que crean un hogar de demostración).
 * Solo existen mientras corren las pruebas: el seed normal no las crea y `retirarFixtures` las elimina.
 */
export function cargarFixtures() {
  try {
    execFileSync('docker', ['exec', '-i', CONTENEDOR, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'], {
      input: readFileSync('supabase/fixtures/e2e.sql', 'utf8'),
      encoding: 'utf8',
    })
  } catch (e) {
    throw new Error(`No se pudieron cargar las fixtures E2E en "${CONTENEDOR}".\n${(e as Error).message}`)
  }
}

/** Borra y vuelve a sembrar el hogar del usuario E2E (datos demo idénticos y limpios). La cuenta de acceso local no se toca. */
export function reiniciarUsuarioE2E() {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  if (!email || !password) return
  psql(`select public.dev_reset_user(${literal(E2E_UID)}::uuid, ${literal(email)}, ${literal(password)}, 'Usuario E2E')`)
}

/** Deja la base sin rastro de las pruebas: elimina al usuario E2E (y su hogar, datos y archivos) y las funciones dev_*. */
export function retirarFixtures() {
  psql(`select public.dev_drop_user(${literal(E2E_UID)}::uuid)`)
  psql(`drop function if exists public.dev_reset_user(uuid, text, text, text), public.dev_seed_user(uuid, text, text, text), public.dev_drop_user(uuid), public.dev_amb(uuid, text), public.dev_cat(uuid, text, text), public.dev_sub(uuid, text, text, text), public.dev_med(uuid, text)`)
}

/** Consulta de solo lectura/escritura para preparar escenarios (p. ej. cargar miles de gastos). */
export function sqlLocal(sql: string): string {
  return psql(sql)
}
