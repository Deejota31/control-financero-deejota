// Controles esenciales ANTES de publicar. Uso: npm run verify:release  (añade --instalacion para probar también la instalación desde cero en Docker)
// No publica nada ni toca ninguna base remota: construye, revisa lo que se entregaría y comprueba el repositorio.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const fallos = []
const ok = (cond, msg) => { console.log(`${cond ? '✔' : '✘'} ${msg}`); if (!cond) fallos.push(msg) }
const npm = (script) => spawnSync(`npm run ${script}`, { shell: true, encoding: 'utf8', maxBuffer: 1 << 28 })

// 1. Calidad del código
for (const s of ['typecheck', 'lint', 'test', 'build']) ok(npm(s).status === 0, `npm run ${s}`)

// 2. Lo que se entrega al navegador (dist/) no lleva secretos, demo ni apunta a servicios locales
const archivos = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? archivos(join(d, e.name)) : [join(d, e.name)]))
const dist = existsSync('dist') ? archivos('dist').filter((f) => /\.(js|css|html)$/.test(f)) : []
ok(dist.length > 0, 'dist/ existe y contiene la aplicación construida')
const contenido = dist.map((f) => readFileSync(f, 'utf8')).join('\n')
// La librería de Supabase nombra el prefijo «sb_secret_»: se buscan claves REALES (valor largo o JWT con rol service_role), no la palabra.
const jwtServicio = (contenido.match(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g) ?? []).some((t) => {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).role === 'service_role' } catch { return false }
})
ok(!/sb_secret_[A-Za-z0-9_-]{20,}/.test(contenido) && !jwtServicio, 'dist/ no contiene claves de servicio')
ok(!/demo@gastodeejota\.local/.test(contenido), 'dist/ no contiene el usuario de demostración')
// Con --produccion se exige un paquete construido con las variables de producción; una compilación local sí apunta a Supabase local.
const apuntaALocal = /127\.0\.0\.1:54321|localhost:54321/.test(contenido)
if (process.argv.includes('--produccion')) ok(!apuntaALocal, 'dist/ no apunta a Supabase local (construido con las variables de producción)')
else console.log(`- dist/ ${apuntaALocal ? 'apunta a Supabase local (compilación local; para publicar, construye con las variables de producción y usa --produccion)' : 'no apunta a Supabase local'}`)

// 3. Migraciones: versiones únicas y ordenadas; sin datos de demostración ni fixtures de pruebas en el esquema
const migraciones = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
const versiones = migraciones.map((f) => f.split('_')[0])
ok(new Set(versiones).size === versiones.length && versiones.every((v) => /^\d{14}$/.test(v)), `${migraciones.length} migraciones con versión de 14 dígitos y sin repetidas`)
const sucias = migraciones.filter((f) => /demo@gastodeejota|dev_seed_user|dev_reset_user|E2E_USER/i.test(readFileSync(join('supabase/migrations', f), 'utf8')))
ok(sucias.length === 0, `las migraciones no contienen usuario demo ni fixtures E2E${sucias.length ? ': ' + sucias.join(', ') : ''}`)

// 4. Repositorio: lo local y lo regenerable no se versiona
const versionados = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)
ok(!versionados.some((f) => /^(dist|qa|capturas|test-results|respaldos|supabase\/snippets|supabase\/\.temp)\//.test(f)), 'dist, qa, capturas, test-results, respaldos y snippets de Studio no están versionados')
const sinGit = (p) => !versionados.some((f) => f.startsWith(p))
ok(sinGit('.env') || versionados.filter((f) => /^\.env/.test(f)).every((f) => f === '.env.example'), 'solo .env.example está versionado')

// 5. Auth del proyecto: el registro público sigue bloqueado y el seed no se carga fuera del entorno local
const config = readFileSync('supabase/config.toml', 'utf8')
ok(/\[auth\][\s\S]*?enable_signup\s*=\s*false/.test(config), 'config.toml: registro público deshabilitado en [auth]')
ok(/\[db\.seed\][\s\S]*?sql_paths\s*=\s*\["\.\/seed\.sql"\]/.test(config), 'el seed de desarrollo está separado del esquema (db.seed → seed.sql, solo en db reset local)')

// 6. Pruebas SQL e instalación desde cero (Docker): opcional por su duración
if (process.argv.includes('--instalacion')) ok(spawnSync('node scripts/verificar-instalacion.mjs', { shell: true, stdio: 'inherit' }).status === 0, 'instalación desde cero + pgTAP en base desechable')

console.log(fallos.length ? `\n✘ ${fallos.length} controles fallaron: NO publicar.` : '\n✔ Controles previos a la publicación superados.')
process.exit(fallos.length ? 1 : 0)
