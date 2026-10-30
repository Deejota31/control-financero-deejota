// Ejecuta TODA la verificación en orden, registra duración y resultado de cada comando y genera la matriz de calidad.
// Uso: node scripts/qa-completo.mjs      (la suite E2E toma su bloqueo exclusivo: no lances otra corrida a la vez)
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

mkdirSync('qa', { recursive: true })
const PASOS = [
  ['npm run build', 'npm run build'],
  ['npm run typecheck', 'npm run typecheck'],
  ['npm run lint', 'npm run lint'],
  ['npm test (unitarias)', 'npm run test'],
  ['npm run db:test (SQL)', 'npm run db:test'],
  ['npm run verify:security', 'npm run verify:security'],
  ['playwright test (E2E, toda la suite)', 'npx playwright test --reporter=list,json'],
]
const registro = []
for (const [nombre, cmd] of PASOS) {
  const inicio = Date.now()
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: 'qa/resultados-e2e.json' } })
  const ms = Date.now() - inicio
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`
  writeFileSync(`qa/${nombre.replace(/[^\w]+/g, '_')}.log`, salida)
  const ok = r.status === 0
  registro.push({ comando: nombre, resultado: ok ? 'OK' : `FALLÓ (código ${r.status})`, duracion: `${(ms / 60000).toFixed(1)} min`, ms })
  console.log(`${ok ? '✔' : '✘'} ${nombre} — ${(ms / 1000).toFixed(0)} s`)
  writeFileSync('qa/comandos.json', JSON.stringify(registro, null, 2))
}
spawnSync('node scripts/qa-matriz.mjs qa/resultados-e2e.json qa/comandos.json', { shell: true, stdio: 'inherit' })
