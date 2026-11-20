// Auditoría adversarial de aislamiento entre cuentas (Gate 1). SOLO local: crea dos usuarios ficticios temporales, siembra datos de prueba en el
// hogar de A, ataca desde la sesión de B y desde `anon` a través de la API real (PostgREST, RPC y Storage) y demuestra que nada de A cambió
// (huella md5 por tabla antes y después). Al terminar borra a ambos usuarios y sus archivos. Nunca toca el usuario ni los datos del propietario.
// Uso: node scripts/auditar-aislamiento.mjs   (requiere `supabase start`)  ·  Resultado: qa/aislamiento-gate1.json
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const CONTENEDOR = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_control-financero-deejota'
const estado = Object.fromEntries(
  execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'ignore'] })
    .split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
)
const BASE = estado.API_URL, ANON = estado.ANON_KEY, SERVICIO = estado.SERVICE_ROLE_KEY
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) throw new Error(`Solo se ejecuta contra Supabase local (API_URL=${BASE}).`)

const sql = (consulta) => execFileSync('docker', ['exec', CONTENEDOR, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', consulta], { encoding: 'utf8' }).trim()
const api = async (ruta, { metodo = 'GET', token, cuerpo, cabeceras = {}, crudo } = {}) => {
  const r = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { apikey: ANON, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(crudo ? {} : { 'Content-Type': 'application/json' }), ...cabeceras },
    body: crudo ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
  })
  const texto = await r.text()
  let json = null
  try { json = JSON.parse(texto) } catch { /* no JSON */ }
  return { estado: r.status, json, texto }
}
const admin = (ruta, metodo, cuerpo) => fetch(`${BASE}${ruta}`, { method: metodo, headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })

const resultados = []
const comprobar = (id, descripcion, ok, detalle = '', conocido = '') => { resultados.push({ id, descripcion, ok: Boolean(ok), detalle, ...(conocido && !ok ? { conocido } : {}) }); console.log(`${ok ? '✔' : conocido ? '⚠' : '✘'} ${id} ${descripcion}${ok || !detalle ? '' : ` — ${detalle}`}${!ok && conocido ? ` [hallazgo conocido: ${conocido}]` : ''}`) }
const denegado = (r) => r.estado >= 400 || (Array.isArray(r.json) && r.json.length === 0)

const sufijo = Date.now().toString(36)
const clave = `Aislamiento-${sufijo}-Aa1!`
async function crearUsuario(nombre) {
  const correo = `aislamiento-${nombre}-${sufijo}@example.test`
  const c = await admin('/auth/v1/admin/users', 'POST', { email: correo, password: clave, email_confirm: true })
  const u = await c.json()
  const t = await api('/auth/v1/token?grant_type=password', { metodo: 'POST', cuerpo: { email: correo, password: clave } })
  if (!t.json?.access_token) throw new Error(`No se pudo iniciar sesión como ${nombre}: ${t.texto}`)
  return { id: u.id, correo, token: t.json.access_token }
}
const hogarDe = (uid) => sql(`select household_id from public.profiles where user_id = '${uid}'`)

let A, B, hidA, hidB
const rutasSubidas = []
try {
  A = await crearUsuario('a'); B = await crearUsuario('b')
  hidA = hogarDe(A.id); hidB = hogarDe(B.id)
  comprobar('P00', 'cada usuario nuevo recibe exactamente un hogar propio y distinto', hidA && hidB && hidA !== hidB && sql(`select count(*) from public.households where created_by in ('${A.id}','${B.id}')`) === '2')

  // ---- Siembra de A (datos ficticios): catálogo, período, fondos, gasto con imputaciones, plantilla, evento, compromiso, comprobante, tarea de limpieza
  sql(`select public.bootstrap_catalog('${hidA}')`)
  sql(`select public.bootstrap_catalog('${hidB}')`)
  const rpc = (usr, nombre, args) => api(`/rest/v1/rpc/${nombre}`, { metodo: 'POST', token: usr.token, cuerpo: args })
  const hoy = new Date().toISOString().slice(0, 10)
  const periodoA = (await rpc(A, 'ensure_period_rpc', { p_date: hoy })).json
  const periodoB = (await rpc(B, 'ensure_period_rpc', { p_date: hoy })).json
  const idPeriodoA = periodoA?.id ?? periodoA, idPeriodoB = periodoB?.id ?? periodoB
  const general = await rpc(A, 'save_fund', { p: { name: 'General A', is_general: true, default_amount: 1000, period_id: idPeriodoA, period_amount: 1000, scope_rules: [], payment_rules: [] } })
  const amb = sql(`select id from public.ambitos where household_id='${hidA}' and name='Personal'`)
  const cat = sql(`select c.id from public.categorias c where c.household_id='${hidA}' and c.ambito_id='${amb}' limit 1`)
  const med = sql(`select id from public.medios_pago where household_id='${hidA}' limit 1`)
  const fondoEsp = await rpc(A, 'save_fund', { p: { name: 'Hogar A', default_amount: 300, period_id: idPeriodoA, period_amount: 300, scope_rules: [{ kind: 'ambito', ref: amb, effect: 'include' }], payment_rules: [] } })
  const gasto = await rpc(A, 'create_expense', { p: { description: 'Gasto ficticio de A', amount: 120, expense_date: hoy, ambito_id: amb, categoria_id: cat, payment_method_id: med, expense_type: 'variable', is_recurring: false }, p_key: crypto.randomUUID() })
  const idGastoA = gasto.json?.expense_id, idFondoEspA = fondoEsp.json?.fund_id, idGeneralA = general.json?.fund_id
  comprobar('P01', 'siembra de A: fondos, gasto e imputaciones creados por sus propias RPC', idGastoA && idFondoEspA && idGeneralA, `${gasto.estado} ${gasto.texto.slice(0, 120)}`)
  sql(`insert into public.expense_templates(household_id, name, description, ambito_id, categoria_id, payment_method_id, default_amount, expense_type) values ('${hidA}','Plantilla A','Plantilla ficticia','${amb}','${cat}','${med}',50,'fixed')`)
  const idPlantillaA = sql(`select id from public.expense_templates where household_id='${hidA}' limit 1`)
  const idEventoA = sql(`insert into public.events(household_id, user_id, name, target_date, budget) values ('${hidA}','${A.id}','Evento A', current_date+30, 500) returning id`).split(/\s/)[0]
  sql(`insert into public.event_items(event_id, household_id, name, planned_amount) values ('${idEventoA}','${hidA}','Concepto A',100)`)
  sql(`insert into public.event_commitments(event_id, household_id, name, contracted_amount) values ('${idEventoA}','${hidA}','Compromiso A',100)`)
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
  const rutaA = `${hidA}/${crypto.randomUUID()}.pdf`
  const subida = await api(`/storage/v1/object/comprobantes/${rutaA}`, { metodo: 'POST', token: A.token, crudo: pdf, cabeceras: { 'Content-Type': 'application/pdf' } })
  rutasSubidas.push(rutaA)
  comprobar('P02', 'A sube su comprobante a la carpeta de su hogar', subida.estado === 200, `${subida.estado} ${subida.texto.slice(0, 100)}`)
  await rpc(A, 'registrar_limpieza', { p_paths: [`${hidA}/${crypto.randomUUID()}.pdf`], p_reason: 'aislamiento', p_demora_min: 10 })
  const idTareaA = sql(`select id from public.storage_cleanup_tasks where household_id='${hidA}' limit 1`)

  // ---- Huella de A antes de los ataques
  const tablas = sql(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`).split('\n')
  const columnas = Object.fromEntries(tablas.map((t) => [t, sql(`select string_agg(column_name, ',') from information_schema.columns where table_schema='public' and table_name='${t}'`).split(',')]))
  const filtroA = (t) => (t === 'households' ? `id='${hidA}'` : t === 'profiles' ? `user_id='${A.id}'` : columnas[t].includes('household_id') ? `household_id='${hidA}'` : null)
  const huella = () => Object.fromEntries(tablas.filter(filtroA).map((t) => [t, sql(`select count(*) || ':' || coalesce(md5(string_agg(x::text, '|' order by x::text)), '-') from public.${t} x where ${filtroA(t)}`)]))
  const antes = huella()
  const conDatos = Object.entries(antes).filter(([, h]) => !h.startsWith('0:')).map(([t]) => t)
  comprobar('P03', `A tiene datos en ${conDatos.length} tablas (la prueba no es vacía)`, conDatos.length >= 12, conDatos.join(','))

  // ---- Control positivo: A ve lo suyo
  for (const t of ['expenses', 'funds', 'expense_fund_allocations', 'events', 'expense_templates', 'ambitos']) {
    const r = await api(`/rest/v1/${t}?select=*&limit=5`, { token: A.token })
    comprobar(`CP-${t}`, `control positivo: A lee sus propias filas de ${t}`, r.estado === 200 && r.json?.length > 0)
  }

  // ---- T1: lectura. B no ve ninguna fila de A en ninguna tabla
  for (const t of tablas) {
    const r = await api(`/rest/v1/${t}?select=*&limit=200`, { token: B.token })
    const filas = Array.isArray(r.json) ? r.json : []
    const ajenas = filas.filter((f) => f.household_id === hidA || f.user_id === A.id || (t === 'households' && f.id === hidA) || f.created_by === A.id)
    const permitido = t === 'exchange_rate_quotes' // caché pública de cotizaciones: diseño explícito
    comprobar(`T1-${t}`, `B no lee filas de A en ${t}${permitido ? ' (tabla pública por diseño)' : ''}`, (r.estado === 200 || r.estado >= 400) && ajenas.length === 0, `${ajenas.length} filas ajenas`)
  }
  // ---- T2: anon no lee nada
  for (const t of tablas) {
    const r = await api(`/rest/v1/${t}?select=*&limit=5`)
    comprobar(`T2-${t}`, `anon no lee ${t}`, r.estado >= 400 || (Array.isArray(r.json) && r.json.length === 0), `${r.estado}`)
  }
  // ---- T3: B no puede borrar ni modificar filas de A
  for (const t of tablas.filter(filtroA)) {
    const f = t === 'households' ? `id=eq.${hidA}` : t === 'profiles' ? `user_id=eq.${A.id}` : `household_id=eq.${hidA}`
    const del = await api(`/rest/v1/${t}?${f}`, { metodo: 'DELETE', token: B.token, cabeceras: { Prefer: 'return=representation' } })
    comprobar(`T3d-${t}`, `B no borra filas de A en ${t}`, denegado(del), `${del.estado} ${del.texto.slice(0, 80)}`)
  }
  const cambios = { profiles: ['user_id', A.id, { display_name: 'HACK' }], households: ['id', hidA, { name: 'HACK' }], funds: ['household_id', hidA, { name: 'HACK' }], expenses: ['household_id', hidA, { description: 'HACK' }],
    events: ['household_id', hidA, { name: 'HACK' }], expense_templates: ['household_id', hidA, { name: 'HACK' }], ambitos: ['household_id', hidA, { name: 'HACK' }], medios_pago: ['household_id', hidA, { name: 'HACK' }],
    event_commitments: ['household_id', hidA, { name: 'HACK' }], budget_periods: ['household_id', hidA, { status: 'closed' }] }
  for (const [t, [col, val, cuerpo]] of Object.entries(cambios)) {
    const r = await api(`/rest/v1/${t}?${col}=eq.${val}`, { metodo: 'PATCH', token: B.token, cuerpo, cabeceras: { Prefer: 'return=representation' } })
    comprobar(`T3u-${t}`, `B no modifica filas de A en ${t}`, denegado(r), `${r.estado} ${r.texto.slice(0, 80)}`)
  }
  // ---- T4: B no puede insertar en el hogar de A
  const inserciones = { ambitos: { household_id: hidA, name: 'HACK', icon_key: 'wallet', color_token: 'c1' }, medios_pago: { household_id: hidA, name: 'HACK' }, events: { household_id: hidA, user_id: B.id, name: 'HACK', target_date: hoy },
    expense_templates: { household_id: hidA, name: 'HACK', description: 'x', ambito_id: amb, categoria_id: cat }, household_members: { household_id: hidA, user_id: B.id, role: 'owner' }, profiles: { user_id: crypto.randomUUID(), household_id: hidA } }
  for (const [t, cuerpo] of Object.entries(inserciones)) {
    const r = await api(`/rest/v1/${t}`, { metodo: 'POST', token: B.token, cuerpo, cabeceras: { Prefer: 'return=representation' } })
    comprobar(`T4-${t}`, `B no inserta en el hogar de A (${t})`, r.estado >= 400, `${r.estado} ${r.texto.slice(0, 90)}`)
  }
  comprobar('T4-miembro', 'B no se vuelve miembro del hogar de A por ninguna vía', sql(`select count(*) from public.household_members where household_id='${hidA}' and user_id='${B.id}'`) === '0')

  // ---- T5: RPC. B invoca todas las funciones con identificadores de A
  const R = async (nombre, args) => rpc(B, nombre, args)
  const sinEfecto = (r) => r.estado >= 400 || r.json === null || (Array.isArray(r.json) && r.json.length === 0) || (r.json && typeof r.json === 'object' && (r.json.blocked || r.json.count === 0))
  const ataques = [
    ['update_expense', { p_id: idGastoA, p: { description: 'HACK' } }], ['annul_expenses', { p_ids: [idGastoA] }], ['restore_expenses', { p_ids: [idGastoA] }],
    ['link_event_expenses', { p_ids: [idGastoA], p_event: idEventoA, p_item: null, p_commitment: null, p_replace: false }],
    ['save_fund', { p: { id: idFondoEspA, name: 'HACK' }, p_dry_run: false }], ['set_fund_period_budget', { p_fund: idFondoEspA, p_period: idPeriodoA, p_amount: 1, p_dry_run: false }],
    ['delete_fund', { p_fund: idFondoEspA, p_destino: idGeneralA, p_dry_run: false }], ['reorder_funds', { p_ids: [idFondoEspA, idGeneralA], p_dry_run: false }],
    ['reorder_templates', { p_kind: 'expense', p_ids: [idPlantillaA] }], ['close_period', { p_period: idPeriodoA }],
    ['copy_funds', { p_source: idPeriodoA, p_target: idPeriodoB, p_items: [{ fund_id: idFondoEspA }] }], ['apply_fund_templates', { p_period: idPeriodoA, p_items: [] }],
    ['apply_template_batch', { p_period_date: hoy, p_items: [{ template_id: idPlantillaA, outcome: 'include', amount: 1, payment_method_id: med }], p_key: crypto.randomUUID() }],
    ['save_fund_template', { p: { id: idPlantillaA, name: 'HACK' } }],
    ['save_expense_event', { p: { event_id: idEventoA, description: 'HACK' }, p_key: null, p_id: idGastoA }],
    ['create_expense', { p: { description: 'HACK', amount: 1, expense_date: hoy, ambito_id: amb, categoria_id: cat, payment_method_id: med, expense_type: 'variable', is_recurring: false, receipt_path: `${hidA}/robado.pdf` }, p_key: crypto.randomUUID() }],
    ['create_expense', { p: { description: 'HACK', amount: 1, expense_date: hoy, ambito_id: amb, categoria_id: cat, payment_method_id: med, expense_type: 'variable', is_recurring: false }, p_key: crypto.randomUUID() }],
    ['preview_expense', { p: { description: 'HACK', amount: 1, expense_date: hoy, ambito_id: amb, categoria_id: cat, payment_method_id: med, expense_type: 'variable', is_recurring: false } }],
    ['completar_limpieza', { p_ids: [idTareaA] }], ['fallo_limpieza', { p_ids: [idTareaA], p_error: 'HACK' }],
  ]
  let n = 0
  for (const [nombre, args] of ataques) {
    const r = await R(nombre, args)
    n += 1
    comprobar(`T5-${String(n).padStart(2, '0')}-${nombre}`, `B no ejecuta ${nombre} sobre recursos de A`, r.estado >= 400 || sinEfecto(r), `${r.estado} ${r.texto.slice(0, 90)}`)
  }
  const plan = await R('save_period_plan', { p_month: hoy, p_patch: { funds_stage: 'done' } })
  comprobar('T5-save_period_plan', 'save_period_plan opera solo sobre el período de quien llama (el de B), nunca el de A', plan.estado >= 400 || plan.json?.period_id === idPeriodoB, `${plan.estado} period_id=${plan.json?.period_id}`)
  const lista = await R('listar_limpieza', {})
  comprobar('T5-listar_limpieza', 'B no ve tareas de limpieza de A', lista.estado === 200 && !(lista.json ?? []).some((x) => x.id === idTareaA))
  const panelB = await R('dashboard_panel', { p_desde: hoy.slice(0, 8) + '01', p_hasta: hoy, p_prev_desde: hoy.slice(0, 8) + '01', p_prev_hasta: hoy })
  comprobar('T5-dashboard', 'el panel de B no incluye el gasto de A', panelB.estado === 200 && Number(panelB.json?.gasto_rango ?? 0) === 0, `gasto_rango=${panelB.json?.gasto_rango}`)
  // ---- T6: anon no ejecuta ninguna RPC del producto
  const expuestas = sql(`select p.proname from pg_proc p where p.pronamespace='public'::regnamespace and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute') and p.proname not in ('audit_trigger','check_allocation_sum','handle_new_user')`).split('\n')
  for (const nombre of expuestas) {
    const r = await api(`/rest/v1/rpc/${nombre}`, { metodo: 'POST', cuerpo: {} })
    comprobar(`T6-${nombre}`, `anon no ejecuta ${nombre}`, r.estado >= 400, `${r.estado}`)
  }
  // ---- T7: Storage
  const objetoExiste = (ruta) => sql(`select count(*) from storage.objects where bucket_id='comprobantes' and name='${ruta}'`) === '1'
  const dl = await api(`/storage/v1/object/authenticated/comprobantes/${rutaA}`, { token: B.token })
  comprobar('T7-descarga', 'B no descarga el comprobante de A', dl.estado >= 400, `${dl.estado}`)
  const firma = await api(`/storage/v1/object/sign/comprobantes/${rutaA}`, { metodo: 'POST', token: B.token, cuerpo: { expiresIn: 60 } })
  comprobar('T7-firma', 'B no obtiene una URL firmada del comprobante de A', firma.estado >= 400, `${firma.estado} ${firma.texto.slice(0, 80)}`)
  const lst = await api('/storage/v1/object/list/comprobantes', { metodo: 'POST', token: B.token, cuerpo: { prefix: hidA, limit: 50 } })
  comprobar('T7-listado', 'B no lista la carpeta de A', lst.estado >= 400 || (Array.isArray(lst.json) && lst.json.length === 0), `${lst.estado}`)
  const sube = await api(`/storage/v1/object/comprobantes/${hidA}/${crypto.randomUUID()}.pdf`, { metodo: 'POST', token: B.token, crudo: pdf, cabeceras: { 'Content-Type': 'application/pdf' } })
  comprobar('T7-subida-ajena', 'B no sube archivos a la carpeta de A', sube.estado >= 400, `${sube.estado}`)
  const sobre = await api(`/storage/v1/object/comprobantes/${rutaA}`, { metodo: 'PUT', token: B.token, crudo: Buffer.from('%PDF-1.4 HACK'), cabeceras: { 'Content-Type': 'application/pdf' } })
  comprobar('T7-sobrescribir', 'B no sobrescribe el comprobante de A', sobre.estado >= 400, `${sobre.estado}`)
  await api(`/storage/v1/object/comprobantes/${rutaA}`, { metodo: 'DELETE', token: B.token })
  comprobar('T7-borrar', 'B no borra el comprobante de A (el objeto sigue existiendo)', objetoExiste(rutaA))
  const trav = await api(`/storage/v1/object/comprobantes/${hidB}/..%2F${hidA}%2Fx.pdf`, { metodo: 'POST', token: B.token, crudo: pdf, cabeceras: { 'Content-Type': 'application/pdf' } })
  comprobar('T7-traversal', 'B no escapa a la carpeta de A con «../»', trav.estado >= 400 || sql(`select count(*) from storage.objects where bucket_id='comprobantes' and name like '${hidA}/%x.pdf'`) === '0', `${trav.estado}`)
  const pub = await api(`/storage/v1/object/public/comprobantes/${rutaA}`)
  comprobar('T7-publico', 'el bucket es privado: la URL pública del comprobante no sirve el archivo', pub.estado >= 400, `${pub.estado}`)
  const anonDl = await api(`/storage/v1/object/authenticated/comprobantes/${rutaA}`)
  comprobar('T7-anon', 'anon no descarga comprobantes', anonDl.estado >= 400, `${anonDl.estado}`)
  const propio = `${hidB}/${crypto.randomUUID()}.pdf`
  const ok = await api(`/storage/v1/object/comprobantes/${propio}`, { metodo: 'POST', token: B.token, crudo: pdf, cabeceras: { 'Content-Type': 'application/pdf' } })
  rutasSubidas.push(propio)
  comprobar('CP-storage', 'control positivo: B sí sube a su propia carpeta', ok.estado === 200, `${ok.estado}`)
  const svg = await api(`/storage/v1/object/comprobantes/${hidB}/${crypto.randomUUID()}.svg`, { metodo: 'POST', token: B.token, crudo: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), cabeceras: { 'Content-Type': 'image/svg+xml' } })
  comprobar('T7-svg', 'el bucket rechaza SVG/HTML ejecutable (tipo MIME no permitido)', svg.estado >= 400, `${svg.estado}`)
  const html = await api(`/storage/v1/object/comprobantes/${hidB}/${crypto.randomUUID()}.pdf`, { metodo: 'POST', token: B.token, crudo: Buffer.from('<html><script>alert(1)</script></html>'), cabeceras: { 'Content-Type': 'text/html' } })
  comprobar('T7-html', 'el bucket rechaza text/html', html.estado >= 400, `${html.estado}`)
  const grande = await api(`/storage/v1/object/comprobantes/${hidB}/${crypto.randomUUID()}.pdf`, { metodo: 'POST', token: B.token, crudo: Buffer.alloc(5 * 1024 * 1024 + 1024, 65), cabeceras: { 'Content-Type': 'application/pdf' } })
  comprobar('T7-tamano', 'el bucket rechaza archivos mayores de 5 MiB', grande.estado >= 400, `${grande.estado}`)
  const falsoPdf = await api(`/storage/v1/object/comprobantes/${hidB}/${crypto.randomUUID()}.pdf`, { metodo: 'POST', token: B.token, crudo: Buffer.from('<html><script>alert(1)</script></html>'), cabeceras: { 'Content-Type': 'application/pdf' } })
  if (falsoPdf.estado < 400) rutasSubidas.push('(subido)')
  comprobar('T7-contenido', 'el bucket valida el CONTENIDO real (HTML declarado como PDF)', falsoPdf.estado >= 400, `se aceptó (${falsoPdf.estado}): el servidor solo valida el tipo declarado`, 'M-01: Storage valida el MIME declarado, no el contenido; mitigado con validación por bytes en el cliente y URL firmadas servidas desde otro origen')

  // ---- Integridad: nada de A cambió
  const despues = huella()
  for (const t of Object.keys(antes)) comprobar(`INT-${t}`, `la huella de A en ${t} no cambió tras los ataques`, antes[t] === despues[t], `${antes[t]} → ${despues[t]}`)
  comprobar('INT-hogares', 'no se crearon hogares ni membresías duplicadas', sql(`select count(*) from public.households where created_by in ('${A.id}','${B.id}')`) === '2' && sql(`select count(*) from public.household_members where user_id in ('${A.id}','${B.id}')`) === '2')
} finally {
  // ---- Limpieza: archivos y usuarios ficticios (cascada sobre sus hogares)
  try {
    for (const ruta of rutasSubidas.filter((r) => r.includes('/'))) await fetch(`${BASE}/storage/v1/object/comprobantes/${ruta}`, { method: 'DELETE', headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}` } })
    sql(`delete from storage.objects where bucket_id='comprobantes' and name like '${hidA ?? 'x'}/%' or name like '${hidB ?? 'x'}/%'`)
  } catch { /* se informa abajo */ }
  for (const u of [A, B]) if (u?.id) await admin(`/auth/v1/admin/users/${u.id}`, 'DELETE')
  const restos = sql(`select count(*) from auth.users where email like 'aislamiento-%-${sufijo}@example.test'`)
  console.log(`\nLimpieza: usuarios ficticios restantes = ${restos}`)
}
const fallos = resultados.filter((r) => !r.ok && !r.conocido)
const conocidos = resultados.filter((r) => !r.ok && r.conocido)
mkdirSync('qa', { recursive: true })
writeFileSync('qa/aislamiento-gate1.json', JSON.stringify({ fecha: new Date().toISOString(), entorno: BASE, total: resultados.length, fallos: fallos.length, conocidos: conocidos.length, resultados }, null, 2))
console.log(`\n${resultados.length - fallos.length - conocidos.length}/${resultados.length} comprobaciones superadas · ${fallos.length} fallos · ${conocidos.length} hallazgo(s) conocido(s) · detalle en qa/aislamiento-gate1.json`)
process.exit(fallos.length ? 1 : 0)
