// Genera la matriz de calidad (docs/qa/matriz-qa.md) a partir del resultado REAL de Playwright (--reporter=json).
// Uso: node scripts/qa-matriz.mjs qa/resultados-e2e.json qa/comandos.json
// Cada fila sale de una prueba ejecutada; lo que no tiene prueba se lista como «No ejecutado» con su motivo. Nada se marca «Aprobado» por deducción.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

const [rutaJson = 'qa/resultados-e2e.json', rutaComandos = 'qa/comandos.json'] = process.argv.slice(2)
const informe = JSON.parse(readFileSync(rutaJson, 'utf8'))
let comandos = []
try { comandos = JSON.parse(readFileSync(rutaComandos, 'utf8')) } catch { /* sin comandos registrados */ }

/** Aplana suites → pruebas con su estado final (el último intento). */
const pruebas = []
function recorrer(suite, titulos = []) {
  const t = suite.title && !suite.title.endsWith('.ts') ? [...titulos, suite.title] : titulos
  for (const s of suite.specs ?? []) {
    for (const test of s.tests ?? []) {
      const ultimo = test.results?.at(-1)
      pruebas.push({
        archivo: basename(s.file ?? suite.file ?? ''),
        titulo: [...t, s.title].join(' › '),
        proyecto: test.projectName,
        estado: test.status === 'skipped' ? 'skipped' : ultimo?.status === 'passed' ? 'passed' : test.status === 'flaky' ? 'flaky' : (ultimo?.status ?? 'failed'),
        ms: ultimo?.duration ?? 0,
        reintentos: Math.max(0, (test.results?.length ?? 1) - 1),
        error: ultimo?.error?.message?.split('\n')[0] ?? '',
        adjuntos: (ultimo?.attachments ?? []).map((a) => a.path).filter(Boolean),
        motivoOmitida: test.annotations?.find((a) => a.type === 'skip')?.description ?? '',
      })
    }
  }
  for (const s of suite.suites ?? []) recorrer(s, t)
}
for (const s of informe.suites ?? []) recorrer(s)

const ETIQ = { passed: 'Aprobado', failed: 'Falló', timedOut: 'Falló', interrupted: 'Falló', skipped: 'No ejecutado', flaky: 'Aprobado (con reintento)' }
const estado = (p) => ETIQ[p.estado] ?? p.estado
const seg = (ms) => (ms / 1000).toFixed(1) + ' s'

/** Requisitos de la revisión → archivos de prueba que los cubren (el estado sale de los resultados de esos archivos). */
const REQUISITOS = [
  ['R1', 'Acceso y sesión', ['auth.spec', 'recuperacion.spec']],
  ['R2', 'Navegación general y preferencias', ['navegacion.spec', 'barra-lateral.spec', 'arranque.spec']],
  ['R3', 'Catálogo', ['catalogo.spec', 'iconos.spec']],
  ['R4', 'Fondos (página y tabla)', ['fondos.spec', 'detalle-fondo.spec', 'fondos-tabla.spec', 'reglas-ui.spec']],
  ['R5', 'Copia de fondos', ['planificacion.spec']],
  ['R6', 'Planificación mensual', ['planificacion.spec']],
  ['R7', 'Formulario de gasto y motor financiero', ['gastos.spec', 'comprobantes.spec', 'qa-regresion.spec', 'dialogos.spec']],
  ['R8', 'Listado de Gastos', ['gastos.spec', 'filtros.spec', 'volumen.spec', 'gastos-diseno.spec']],
  ['R9', 'Plantillas y registro mensual', ['plantillas.spec']],
  ['R10', 'Dashboard y gráficos', ['dashboard.spec', 'analisis.spec']],
  ['R11', 'Salud financiera', ['salud.spec']],
  ['R12', 'Configuración', ['configuracion.spec']],
  ['R13', 'Independencia mensual y datos', ['planificacion.spec', 'integracion.spec', 'volumen.spec']],
  ['R14', 'Responsive y diseño', ['qa-responsive.spec', 'responsive.spec', 'modales.spec', 'visual.spec', 'fondos-tabla.spec']],
  ['R15', 'Accesibilidad y casos límite', ['a11y.spec', 'teclado.spec', 'recuperacion.spec']],
]

const NO_EJECUTADO = [
  ['Teclado virtual del teléfono', 'Bloqueado', 'Exige un teléfono real; el entorno solo dispone de navegador de escritorio emulado.'],
  ['Aislamiento de datos entre dos usuarios EN LA INTERFAZ', 'No ejecutado', 'Solo hay un usuario E2E y el del propietario. El aislamiento sí está probado en SQL (RLS) con dos usuarios: ver pruebas pgTAP rls_base y fondos_por_periodo.'],
  ['Zoom del navegador al 200 %', 'No ejecutado', 'No hay prueba automática; el barrido responsive de 320 px y de 844×390 es el equivalente aproximado en ancho CSS, no el zoom real.'],
  ['Lector de pantalla (anuncios reales)', 'No ejecutado', 'axe verifica nombres, etiquetas y relaciones; el anuncio real con NVDA/VoiceOver requiere una prueba manual.'],
  ['Dos pestañas con cambios concurrentes', 'No ejecutado', 'No existe prueba con dos contextos de navegador editando a la vez.'],
  ['Pérdida de conexión real a mitad de un guardado', 'No ejecutado', 'La idempotencia del reintento está probada en SQL (create_expense con la misma clave); no se cortó la red real en el navegador.'],
  ['Catálogo con elementos inactivos, nombres repetidos bajo padres distintos, comillas y nombres largos como conjunto de datos dedicado', 'No ejecutado', 'No se sembró un catálogo extremo dedicado; se probó con el catálogo estándar del E2E y pruebas puntuales.'],
  ['Comprobantes: abrir, reemplazar y quitar con PDF/WebP y 5 MB exactos', 'No ejecutado', 'comprobantes.spec cubre subida, límite y borrado básicos; no todas las combinaciones de formato y tamaño.'],
]

const porArchivo = (nombre) => pruebas.filter((p) => p.archivo === nombre + '.ts' || p.archivo === nombre)
const resumen = (lista) => ({
  total: lista.length,
  ok: lista.filter((p) => ['passed', 'flaky'].includes(p.estado)).length,
  mal: lista.filter((p) => ['failed', 'timedOut', 'interrupted'].includes(p.estado)).length,
  omitidas: lista.filter((p) => p.estado === 'skipped').length,
})

const L = []
const fecha = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })
const tot = resumen(pruebas)
L.push('# Matriz de calidad — Gasto Deejota', '', `Generada: ${fecha} (hora de Lima) desde \`${rutaJson}\`.`, '')
L.push('## Resultado global de la suite E2E', '', `- Pruebas ejecutadas: **${tot.total}** · Aprobadas: **${tot.ok}** · Fallidas: **${tot.mal}** · Omitidas: **${tot.omitidas}**`)
L.push(`- Duración total: **${seg(informe.stats?.duration ?? 0)}**`, '')

if (comandos.length) {
  L.push('## Comandos ejecutados', '', '| Comando | Resultado | Duración |', '|---|---|---|')
  for (const c of comandos) L.push(`| \`${c.comando}\` | ${c.resultado} | ${c.duracion} |`)
  L.push('')
}

L.push('## Cobertura por requisito', '', '| ID | Requisito | Archivos de prueba | Aprobadas | Falladas | Omitidas | Estado |', '|---|---|---|---|---|---|---|')
for (const [id, nombre, archivos] of REQUISITOS) {
  const lista = archivos.flatMap(porArchivo)
  const r = resumen(lista)
  const est = r.total === 0 ? 'No ejecutado' : r.mal > 0 ? 'Falló' : r.ok === 0 ? 'No ejecutado' : 'Aprobado (con la cobertura listada)'
  L.push(`| ${id} | ${nombre} | ${archivos.join(', ')} | ${r.ok} | ${r.mal} | ${r.omitidas} | ${est} |`)
}
L.push('', 'Un requisito figura «Aprobado» solo respecto de los escenarios que sus pruebas ejecutan; lo que no está cubierto se lista más abajo.', '')

L.push('## Escenarios NO cubiertos o bloqueados', '', '| Escenario | Estado | Motivo |', '|---|---|---|')
for (const [esc, est, motivo] of NO_EJECUTADO) L.push(`| ${esc} | ${est} | ${motivo} |`)
L.push('')

const fallidas = pruebas.filter((p) => ['failed', 'timedOut', 'interrupted'].includes(p.estado))
L.push('## Defectos abiertos (pruebas fallidas)', '')
if (fallidas.length === 0) L.push('Ninguna prueba falló en esta corrida.', '')
else {
  L.push('| ID | Archivo | Escenario | Error | Evidencia |', '|---|---|---|---|---|')
  fallidas.forEach((p, i) => L.push(`| F${i + 1} | ${p.archivo} | ${p.titulo} | ${p.error.slice(0, 160).replace(/\|/g, '\\|')} | ${p.adjuntos.join('<br>') || '(sin adjuntos)'} |`))
  L.push('')
}

L.push('## Matriz de escenarios ejecutados', '', '| ID | Módulo (archivo) | Escenario | Estado | Duración | Reintentos |', '|---|---|---|---|---|---|')
pruebas.forEach((p, i) => L.push(`| QA-${String(i + 1).padStart(3, '0')} | ${p.archivo.replace('.ts', '')} | ${p.titulo.replace(/\|/g, '\\|')}${p.estado === 'skipped' && p.motivoOmitida ? ` _(omitida: ${p.motivoOmitida})_` : ''} | ${estado(p)} | ${seg(p.ms)} | ${p.reintentos} |`))
L.push('')

mkdirSync('docs/qa', { recursive: true })
writeFileSync('docs/qa/matriz-qa.md', L.join('\n'))
console.log(`docs/qa/matriz-qa.md · ${tot.total} pruebas (${tot.ok} aprobadas, ${tot.mal} falladas, ${tot.omitidas} omitidas)`)
