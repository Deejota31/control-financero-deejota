// Comprueba que el seed demo local sigue usable (sin datos de prueba mezclados). Uso: npm run verify:seed
import { execFileSync } from 'node:child_process'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* se exigen las variables más abajo */
}

const { VITE_SUPABASE_URL: URL_API, VITE_SUPABASE_ANON_KEY: KEY, DEMO_USER_EMAIL: EMAIL, DEMO_USER_PASSWORD: PASS } = process.env
if (!URL_API || !KEY || !EMAIL || !PASS) {
  console.error('Faltan VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, DEMO_USER_EMAIL o DEMO_USER_PASSWORD en .env.local.')
  process.exit(2)
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_API)) {
  console.error('Este verificador solo se ejecuta contra Supabase local.')
  process.exit(2)
}

const fallos = []
const ok = (cond, msg) => {
  console.log(`${cond ? '✔' : '✘'} ${msg}`)
  if (!cond) fallos.push(msg)
}

const login = await fetch(`${URL_API}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
})
ok(login.ok, 'el usuario demo puede iniciar sesión')
if (!login.ok) {
  console.error('Si falló tras reiniciar Docker o tras cambiar el esquema, ejecuta: npm run db:reset')
  process.exit(1)
}
const { access_token: token } = await login.json()
const h = { apikey: KEY, Authorization: `Bearer ${token}` }

async function contar(ruta) {
  const r = await fetch(`${URL_API}/rest/v1/${ruta}`, { headers: { ...h, Prefer: 'count=exact', Range: '0-0' } })
  return Number(r.headers.get('content-range')?.split('/')[1] ?? NaN)
}

ok((await contar('funds?select=id')) === 5, 'hay exactamente los 5 fondos del seed (ninguno de prueba)')
ok((await contar('funds?select=id&name=ilike.*E2E*')) === 0, 'no hay fondos de pruebas E2E')
ok((await contar('expenses?select=id&status=eq.active')) >= 50, 'hay gastos demo activos')
ok((await contar('expenses?select=id&description=ilike.*E2E*')) === 0, 'no hay gastos de pruebas E2E')
ok((await contar('expenses?select=id&description=ilike.*masivo*')) === 0, 'no hay gastos de la prueba de volumen')
ok((await contar('expense_templates?select=id')) === 5, 'hay las 5 plantillas del seed')
ok((await contar('ambitos?select=id')) === 5 && (await contar('medios_pago?select=id')) === 6, 'el catálogo inicial está completo (5 ámbitos, 6 medios)')
ok((await contar('period_fund_snapshots?select=id')) > 0, 'el período antiguo sigue cerrado con su histórico')

const hoy = new Date()
const iso = (d) => d.toISOString().slice(0, 10)
const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
const ant = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
const antFin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
const r = await fetch(`${URL_API}/rest/v1/rpc/dashboard_resumen`, {
  method: 'POST',
  headers: { ...h, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_desde: iso(ini), p_hasta: iso(fin), p_prev_desde: iso(ant), p_prev_hasta: iso(antFin) }),
})
const resumen = r.ok ? await r.json() : null
ok(Boolean(resumen) && Number(resumen.cantidad) > 0 && Number(resumen.total) > 0, 'el Dashboard calcula el mes actual con datos del seed')

// Integridad global: la suma de imputaciones iguala a cada gasto activo (consulta directa a la base local)
try {
  const contenedor = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_control-financero-deejota'
  const sql = "select count(*) from public.expenses e where e.status = 'active' and e.amount <> coalesce((select sum(a.amount) from public.expense_fund_allocations a where a.expense_id = e.id), 0)"
  const n = execFileSync('docker', ['exec', contenedor, 'psql', '-U', 'postgres', '-tA', '-c', sql], { encoding: 'utf8' }).trim()
  ok(n === '0', 'todos los gastos activos están completamente imputados a fondos')
} catch {
  console.log('• (omitido) integridad de imputaciones: Docker no disponible')
}

if (fallos.length) {
  console.error(`\n${fallos.length} comprobación(es) fallaron. Ejecuta npm run db:reset para recuperar el seed.`)
  process.exit(1)
}
console.log('\nSeed demo usable.')
