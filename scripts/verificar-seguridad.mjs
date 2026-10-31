// Verifica separación local/producción y ausencia de secretos en lo versionado. Uso: npm run verify:security
// No imprime valores sensibles: solo rutas y el tipo de hallazgo.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const fallos = []
const ok = (cond, msg) => {
  console.log(`${cond ? '✔' : '✘'} ${msg}`)
  if (!cond) fallos.push(msg)
}

const versionados = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter((f) => f && existsSync(f))

// 1. Archivos sensibles no versionados
const sensibles = versionados.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && f !== '.env.example')
ok(sensibles.length === 0, `ningún .env ni .env.local está versionado${sensibles.length ? ': ' + sensibles.join(', ') : ''}`)
ok(!versionados.some((f) => f.startsWith('capturas/') || f.startsWith('node_modules/')), 'capturas y node_modules no están versionados')

// 2. Secretos en código y migraciones (la documentación puede nombrar la palabra service_role)
const patrones = [
  [/service_role/i, 'referencia a service_role'],
  [/sb_secret_[A-Za-z0-9_-]{10,}/, 'clave sb_secret'],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'token JWT'],
]
const aRevisar = versionados.filter((f) => /^(src|supabase\/migrations|scripts|index\.html|vite\.config\.ts|e2e\/(?!configuracion\.spec))/.test(f) && !['seguridad', 'publicacion', 'instalacion'].some((n) => f.endsWith('verificar-' + n + '.mjs')) && /\.(ts|tsx|js|mjs|sql|html|json)$/.test(f))
const hallazgos = []
for (const f of aRevisar.filter((x) => existsSync(x))) {
  const t = readFileSync(f, 'utf8')
  for (const [re, nombre] of patrones) if (re.test(t)) hallazgos.push(`${f} (${nombre})`)
}
ok(hallazgos.length === 0, `sin claves service_role/JWT/sb_secret en código, migraciones ni pruebas${hallazgos.length ? ': ' + hallazgos.join('; ') : ''}`)

// 3. Las migraciones (las que se despliegan a producción) no crean usuarios ni datos de ejemplo
const migraciones = versionados.filter((f) => f.startsWith('supabase/migrations/') && f.endsWith('.sql'))
/**
 * Una migración puede MOVER datos reales ya existentes (insert … select … from public.<tabla>, p. ej. al pasar de fondos globales a fondos por mes),
 * pero no sembrar datos de ejemplo: un insert en estas tablas con VALUES literales, o cuyo SELECT no lee de una tabla del esquema public
 * (generate_series, constantes), se considera dato de ejemplo. Las comprobaciones de secretos y semillas no cambian.
 */
function datosDeEjemplo(texto) {
  for (const m of texto.matchAll(/insert\s+into\s+public\.(?:expenses|expense_templates|fund_period_budgets|budget_periods)\b[^;]*;/gi)) {
    const sentencia = m[0]
    if (/\bvalues\b/i.test(sentencia) || !/\bfrom\s+public\./i.test(sentencia)) return true
  }
  return false
}
const prohibido = [
  [/insert\s+into\s+auth\./i, 'inserta en el esquema auth (usuarios)'],
  [/crypt\s*\(/i, 'genera hashes de contraseña'],
  [/demo@|DemoLocal|E2eLocal|gastodeejota\.local/i, 'contiene credenciales o correos demo'],
  [datosDeEjemplo, 'inserta gastos, plantillas o presupuestos de ejemplo'],
  [/\bdev_(seed|reset)_user\b/i, 'define funciones solo de desarrollo'],
]
const malas = []
for (const f of migraciones) {
  // Se quitan los cuerpos de funciones (lógica de la aplicación): lo que importa es lo que la migración ejecuta al aplicarse.
  const t = readFileSync(f, 'utf8').replace(/create\s+(?:or\s+replace\s+)?function[\s\S]*?\$\$[\s\S]*?\$\$/gi, '')
  for (const [re, nombre] of prohibido) if (typeof re === 'function' ? re(t) : re.test(t)) malas.push(`${f}: ${nombre}`)
}
ok(malas.length === 0, `las ${migraciones.length} migraciones no crean usuarios demo ni datos de ejemplo${malas.length ? ': ' + malas.join('; ') : ''}`)
ok(!versionados.includes('supabase/seed.sql') || !migraciones.some((f) => readFileSync(f, 'utf8').includes('seed.sql')), 'ninguna migración referencia seed.sql')

// 4. El usuario demo solo se crea en seed.sql (que solo corre en local)
const seed = readFileSync('supabase/seed.sql', 'utf8')
ok(/DemoLocal123/.test(seed) && /demo@gastodeejota\.local/.test(seed), 'seed.sql define el usuario demo local')
const fuera = versionados.filter((f) => f !== 'supabase/seed.sql' && !f.endsWith('verificar-seguridad.mjs') && /\.(ts|tsx|sql|mjs)$/.test(f) && /DemoLocal123/.test(readFileSync(f, 'utf8')))
ok(fuera.length === 0, `la contraseña demo no aparece en otro código${fuera.length ? ': ' + fuera.join(', ') : ''}`)

// 5. Registro público desactivado en la configuración local
const cfg = readFileSync('supabase/config.toml', 'utf8')
const auth = cfg.split(/\n\[/).find((s) => s.startsWith('auth]')) ?? ''
ok(/^enable_signup\s*=\s*false/m.test(auth), 'config.toml: el registro público está desactivado ([auth] enable_signup = false)')

// 6. Un build de producción no incrusta URLs locales ni secretos (las variables del proceso priorizan sobre .env.local)
const salida = mkdtempSync(join(tmpdir(), 'gd-build-'))
try {
  execFileSync('npx', ['vite', 'build', '--outDir', salida, '--emptyOutDir'], {
    encoding: 'utf8', shell: true, stdio: 'pipe',
    env: { ...process.env, VITE_APP_ENV: 'production', VITE_SUPABASE_URL: 'https://proyecto-ejemplo.supabase.co', VITE_SUPABASE_ANON_KEY: 'clave-publica-de-ejemplo' },
  })
  const archivos = []
  const recorrer = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) recorrer(p)
      else archivos.push(p)
    }
  }
  recorrer(salida)
  const js = archivos.filter((f) => /\.(js|html)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n')
  ok(!/127\.0\.0\.1:54321|localhost:54321/.test(js), 'el build de producción no incrusta la URL de Supabase local')
  // La librería de Supabase nombra la palabra service_role en sus mensajes; lo que no debe existir son claves reales.
  ok(!/sb_secret_[A-Za-z0-9_-]{10,}/.test(js) && !/eyJ[A-Za-z0-9_-]{20,}.[A-Za-z0-9_-]{20,}.[A-Za-z0-9_-]{10,}/.test(js), 'el build de producción no contiene claves privilegiadas ni tokens')
  ok(js.includes('proyecto-ejemplo.supabase.co'), 'el build de producción usa la URL configurada por variables de entorno')
} catch (e) {
  ok(false, `no se pudo compilar para la comprobación de producción: ${String(e.message).split('\n')[0]}`)
} finally {
  if (existsSync(salida)) rmSync(salida, { recursive: true, force: true })
}

if (fallos.length) {
  console.error(`\n${fallos.length} comprobación(es) de seguridad fallaron.`)
  process.exit(1)
}
console.log('\nSeparación local/producción y secretos: correcto.')
