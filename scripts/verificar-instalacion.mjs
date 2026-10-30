// Prueba una instalación DESDE CERO de todas las migraciones en una base desechable y ejecuta las pruebas SQL sobre ella.
// Uso: node scripts/verificar-instalacion.mjs        (requiere Supabase local iniciado: npm run db:start)
//
// Seguridad: crea y borra SOLO la base `gd_instalacion_tmp` dentro del contenedor local. No toca la base `postgres` (la de desarrollo) ni ningún
// proyecto remoto. Los esquemas de plataforma (auth, storage…) se copian SIN datos del contenedor local para que las migraciones tengan donde apoyarse.
import { execFileSync, spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

const CONTENEDOR = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_control-financero-deejota'
const BD = 'gd_instalacion_tmp'
const docker = (args, input) => spawnSync('docker', ['exec', ...(input !== undefined ? ['-i'] : []), CONTENEDOR, ...args], { encoding: 'utf8', input, maxBuffer: 1 << 28 })
const psql = (bd, sql, input) => docker(['psql', '-U', 'postgres', '-d', bd, '-v', 'ON_ERROR_STOP=1', '-q', '-tA', ...(sql ? ['-c', sql] : [])], input)
const fallos = []

function paso(nombre, ok, detalle = '') {
  console.log(`${ok ? '✔' : '✘'} ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallos.push(nombre)
}

if (docker(['true']).status !== 0) { console.error(`No se pudo usar el contenedor "${CONTENEDOR}". ¿Está Docker abierto y Supabase iniciado (npm run db:start)?`); process.exit(2) }

try {
  psql('postgres', `drop database if exists ${BD}`)
  psql('postgres', `create database ${BD} template template0`)

  // Plataforma sin datos + privilegios por defecto de Supabase (sin ellos, `authenticated` no podría tocar las tablas nuevas).
  const plataforma = execFileSync('docker', ['exec', CONTENEDOR, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '-s', '-n', 'auth', '-n', 'storage', '-n', 'extensions', '-n', 'realtime', '-n', 'vault'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  docker(['psql', '-U', 'postgres', '-d', BD, '-q'], plataforma) // los errores de propietarios/extensiones ya existentes son esperados
  psql(BD, `alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    create extension if not exists pgtap with schema extensions`)

  const migraciones = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
  let aplicadas = 0
  for (const m of migraciones) {
    const r = psql(BD, null, readFileSync(`supabase/migrations/${m}`, 'utf8'))
    if (r.status !== 0) { paso(`migración ${m}`, false, (r.stderr || '').split('\n')[0]); break }
    aplicadas++
  }
  paso(`${migraciones.length} migraciones aplicadas en orden desde cero`, aplicadas === migraciones.length, `${aplicadas}/${migraciones.length}`)

  if (aplicadas === migraciones.length) {
    const n = (sql) => Number(psql(BD, sql).stdout.trim())
    paso('todas las tablas de public tienen RLS', n("select count(*) from pg_tables where schemaname = 'public' and not rowsecurity") === 0)
    paso('toda función SECURITY DEFINER fija su search_path', n("select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')") === 0)
    paso('la instalación nueva no trae usuarios ni datos de demostración', n('select (select count(*) from auth.users) + (select count(*) from public.households)') === 0)

    for (const t of readdirSync('supabase/tests').filter((f) => f.endsWith('.sql')).sort()) {
      const r = psql(BD, null, readFileSync(`supabase/tests/${t}`, 'utf8'))
      const salida = `${r.stdout}${r.stderr}`
      const ok = (salida.match(/^ok /gm) ?? []).length, mal = (salida.match(/^not ok |ERROR/gm) ?? []).length
      paso(`pgTAP ${t}`, mal === 0 && ok > 0, `${ok} correctas, ${mal} fallidas`)
    }
  }
} finally {
  psql('postgres', `drop database if exists ${BD}`)
}

console.log(fallos.length ? `\n✘ ${fallos.length} verificaciones fallaron` : '\n✔ Instalación desde cero verificada')
process.exit(fallos.length ? 1 : 0)
