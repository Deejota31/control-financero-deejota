import { execFileSync } from 'node:child_process'

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

/** Borra y vuelve a sembrar el hogar del usuario E2E (datos demo idénticos y limpios). El usuario demo no se toca. */
export function reiniciarUsuarioE2E() {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  if (!email || !password) return
  psql(`select public.dev_reset_user(${literal(E2E_UID)}::uuid, ${literal(email)}, ${literal(password)}, 'Usuario E2E')`)
}

/** Consulta de solo lectura/escritura para preparar escenarios (p. ej. cargar miles de gastos). */
export function sqlLocal(sql: string): string {
  return psql(sql)
}
