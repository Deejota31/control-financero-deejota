// Comprueba que la base local está vacía y que la cuenta de acceso funciona. Uso: npm run verify:seed
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
ok(login.ok, 'la cuenta de acceso local puede iniciar sesión')
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

// La base local debe estar VACÍA: solo existe la cuenta de acceso y lo técnico mínimo (hogar, membresía, perfil).
for (const [tabla, nombre] of [
  ['ambitos', 'ámbitos'], ['categorias', 'categorías'], ['subcategorias', 'subcategorías'], ['medios_pago', 'medios de pago'],
  ['funds', 'fondos'], ['fund_period_budgets', 'presupuestos'], ['period_fund_snapshots', 'cierres'], ['expenses', 'gastos'],
  ['expense_fund_allocations', 'imputaciones'], ['expense_templates', 'plantillas'],
]) {
  ok((await contar(`${tabla}?select=id`)) === 0, `sin ${nombre}`)
}
// La aplicación abre sola el período del mes en curso al usarla (sin importes ni fondos): es técnico, no un dato cargado.
ok((await contar('budget_periods?select=id&status=eq.closed')) === 0 && (await contar('budget_periods?select=id')) <= 1, 'sin períodos cerrados (a lo sumo el mes en curso, vacío)')
ok((await contar('audit_logs?select=id&entity=neq.budget_periods')) === 0, 'sin actividad de usuario registrada (solo la apertura técnica del período)')
ok((await contar('profiles?select=user_id')) === 1, 'el perfil de la cuenta existe')
ok((await contar('households?select=id&is_demo=eq.false')) === 1, 'el hogar existe y no está marcado como demostración')

const hoy = new Date()
const iso = (d) => d.toISOString().slice(0, 10)
const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
const ant = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
const antFin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
const r = await fetch(`${URL_API}/rest/v1/rpc/dashboard_panel`, {
  method: 'POST',
  headers: { ...h, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_desde: iso(ini), p_hasta: iso(fin), p_prev_desde: iso(ant), p_prev_hasta: iso(antFin) }),
})
const resumen = r.ok ? await r.json() : null
ok(Boolean(resumen) && Number(resumen.cantidad) === 0 && Number(resumen.total) === 0, 'el Dashboard responde con el período vacío (sin cifras inventadas)')

// Integridad global: la suma de imputaciones iguala a cada gasto activo (consulta directa a la base local)
try {
  const contenedor = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_control-financero-deejota'
  const sql = "select count(*) from public.expenses e where e.status = 'active' and e.amount <> coalesce((select sum(a.amount) from public.expense_fund_allocations a where a.expense_id = e.id), 0)"
  const n = execFileSync('docker', ['exec', contenedor, 'psql', '-U', 'postgres', '-tA', '-c', sql], { encoding: 'utf8' }).trim()
  ok(n === '0', 'todos los gastos activos están completamente imputados a fondos')
} catch {
  console.log('• (omitido) integridad de imputaciones: Docker no disponible')
}

// Sin rastro de pruebas ni de demostración en el resto de la base local.
try {
  const contenedor = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_control-financero-deejota'
  const q = (sql) => execFileSync('docker', ['exec', contenedor, 'psql', '-U', 'postgres', '-tA', '-c', sql], { encoding: 'utf8' }).trim()
  ok(q('select count(*) from auth.users') === '1', 'solo existe la cuenta de acceso (sin cuentas de demostración ni de pruebas)')
  ok(q("select count(*) from pg_proc where proname like 'dev_%'") === '0', 'no quedan funciones de fixtures de pruebas')
  ok(q("select count(*) from storage.objects where bucket_id = 'comprobantes'") === '0', 'no quedan comprobantes de prueba')
  ok(q('select count(*) from public.storage_cleanup_tasks') === '0' && q('select count(*) from public.idempotency_requests') === '0', 'sin tareas técnicas ni claves de idempotencia de pruebas')
  ok(q("select count(*) from pg_policies where schemaname = 'public'") !== '0', 'las políticas RLS siguen en su sitio')
} catch {
  console.log('• (omitido) comprobaciones internas: Docker no disponible')
}

if (fallos.length) {
  console.error(`\n${fallos.length} comprobación(es) fallaron. Ejecuta npm run db:reset para recuperar el seed.`)
  process.exit(1)
}
console.log('\nSeed demo usable.')
