/* Propuestas dinámicas del Catálogo: B (se mantiene) + D, E, F, G, H. Requiere shared.js. Solo diseño. */
'use strict'

const APP = { v: 'B', sec: 'categorias', sel: null, metrica: 'gastos' }
const SEC_TIPO = { ambitos: 'ambito', categorias: 'categoria', medios: 'medio' }
const SEC_NOMBRE = { ambitos: 'Ámbitos', categorias: 'Categorías y subcategorías', medios: 'Medios de pago' }
const VARIANTES = [
  ['B', 'Explorador jerárquico', 'Árbol y panel de detalle. La que ya viste.'],
  ['D', 'Mosaico proporcional', 'Cada elemento ocupa espacio según sus gastos.'],
  ['E', 'Tablero arrastrable', 'Arrastra tarjetas para ordenar o cambiar de ámbito.'],
  ['F', 'Anillos', 'Ámbitos y categorías en círculos que se animan.'],
  ['G', 'Estudio de color', 'Cambia un color y mira cómo queda la app, en claro y oscuro.'],
  ['H', 'Lista viva', 'Renombra, ordena, colorea y elimina sin salir de la lista.'],
]
const DATOS_INICIALES = JSON.stringify(DATOS)
const historial = []
const $ = (s, r = document) => r.querySelector(s)
const itemDe = (t, id) => listaDe(t).find((x) => x.id === id)
const tipoSec = () => SEC_TIPO[APP.sec]
const valorDe = (it) => (APP.metrica === 'igual' ? 1 : Math.max(it.gastos, 8))
const colorHex = (it, tipo) => colorEfectivo(it, tipo).hex
/** Insignia sin estilo propio: hereda las variables --k-* del ancestro con data-cid. */
const ins = (it, cls = '') => `<span class="ins ${cls}">${svg(it.icono)}</span>`

function pintarTodo() {
  document.querySelectorAll('[data-cid]').forEach((el) => {
    const [t, id] = el.dataset.cid.split(':')
    const it = itemDe(t, id)
    if (!it) return
    estiloColor(colorHex(it, t)).split(';').filter(Boolean).forEach((kv) => { const i = kv.indexOf(':'); el.style.setProperty(kv.slice(0, i), kv.slice(i + 1)) })
  })
  pintarPreview()
}
function validarSel() {
  const t = tipoSec(), l = listaDe(t)
  if (!APP.sel || APP.sel.tipo !== t || !l.some((x) => x.id === APP.sel.id)) APP.sel = { tipo: t, id: (l.find((x) => x.activo) ?? l[0])?.id ?? null }
}
function guardarSnap() { historial.push(JSON.stringify(DATOS)); if (historial.length > 30) historial.shift() }

/* ---------- Detalle común ---------- */
function detalleHtml() {
  const { tipo, id } = APP.sel
  const it = itemDe(tipo, id)
  if (!it) return '<p class="pista">Selecciona un elemento.</p>'
  const c = colorEfectivo(it, tipo), lista = listaDe(tipo), i = lista.indexOf(it), el = eliminable(it, tipo)
  const pad = tipo === 'categoria' ? DATOS.ambitos.find((a) => a.id === it.ambito) : null
  return `<div class="d-det" data-id="${it.id}" data-tipo="${tipo}" data-cid="${tipo}:${it.id}">
    <div class="d-det-cab">${ins(it, 'g')}<div><h3>${esc(it.nombre)}</h3><p>${pad ? esc(pad.nombre) + ' · ' : ''}<span class="num">${it.gastos}</span> gastos · ${it.activo ? 'Activo' : 'Inactivo'}</p>
      <span class="pildora"><span class="punto"></span> ${nombreColor(c.hex)} <span class="num">${c.hex.toUpperCase()}</span></span>${c.origen === 'heredado' ? ` <span class="origen">${ui('enlace')} hereda de ${esc(c.de)}</span>` : ''}</div>${interruptor(it.activo, it.nombre, it.fijoAlFinal)}</div>
    <div class="d-qc" role="group" aria-label="Cambiar color de ${esc(it.nombre)}">
      ${tipo === 'categoria' ? `<button class="d-her" data-qc="heredar" aria-pressed="${!it.color}">${ui('enlace')} Heredar color del ámbito</button>` : ''}
      ${COLORES.map((k) => `<button class="d-sw" data-qc="${k.hex}" style="--k-base:${k.hex}" aria-label="${k.nombre}" title="${k.nombre}" aria-pressed="${!!it.color && it.color.toLowerCase() === k.hex.toLowerCase() || (!it.color && tipo !== 'categoria' && c.hex.toLowerCase() === k.hex.toLowerCase())}"></button>`).join('')}
    </div>
    <div class="d-tonos">${['claro', 'oscuro'].map((t) => { const k = tonos(c.hex, t); return `<div class="d-tono ${t}"><small>${t === 'claro' ? 'Tema claro' : 'Tema oscuro'}</small><div class="f"><span class="insignia p" style="--k-soft:${k.soft};--k-borde:${k.borde};--k-icono:${k.icono}">${svg(it.icono)}</span><b style="color:${k.texto}">${esc(it.nombre)}</b></div></div>` }).join('')}</div>
    <div class="d-acc"><button class="btn btn-pri" data-accion="editar">${ui('editar')} Editar…</button>${botonesFila(it, tipo, i, lista.length)}</div>
    <p class="pista" style="margin:0">${it.fijoAlFinal ? ui('candado') + ' ' : ''}${esc(el.motivo)}</p></div>`
}
function refrescarDetalle() { const d = $('#detalle'); if (d) { d.innerHTML = detalleHtml(); pintarTodo() } }
function seleccionar(tipo, id) { APP.sel = { tipo, id }; document.querySelectorAll('[data-sel-id]').forEach((e) => e.setAttribute(e.dataset.selAttr || 'aria-pressed', String(e.dataset.selId === id))); refrescarDetalle(); document.dispatchEvent(new CustomEvent('seleccion')) }

/* ---------- Arrastrar y soltar genérico ---------- */
function activarDnd(raiz, onDrop) {
  let arr = null
  const limpiar = () => raiz.querySelectorAll('.antes, .sobre, .final, .arrastrando').forEach((e) => e.classList.remove('antes', 'sobre', 'final', 'arrastrando'))
  const destino = (e, zona) => {
    const cartas = [...zona.querySelectorAll('[data-drag]')].filter((c) => c.dataset.id !== arr && c.dataset.fijo !== '1')
    const horiz = zona.dataset.eje === 'x'
    return cartas.find((c) => { const r = c.getBoundingClientRect(); return horiz ? e.clientX < r.left + r.width / 2 || e.clientY < r.top : e.clientY < r.top + r.height / 2 }) ?? null
  }
  raiz.addEventListener('dragstart', (e) => { const c = e.target.closest('[data-drag]'); if (!c || c.dataset.fijo === '1') { e.preventDefault(); return } arr = c.dataset.id; e.dataTransfer.setData('text/plain', arr); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => c.classList.add('arrastrando'), 0) })
  raiz.addEventListener('dragend', () => { arr = null; limpiar() })
  raiz.addEventListener('dragover', (e) => {
    const zona = e.target.closest('[data-zona]'); if (!zona || !arr) return
    e.preventDefault(); limpiar(); zona.classList.add('sobre')
    const d = destino(e, zona); if (d) d.classList.add('antes'); else zona.classList.add('final')
  })
  raiz.addEventListener('drop', (e) => {
    const zona = e.target.closest('[data-zona]'); if (!zona || !arr) return
    e.preventDefault(); const d = destino(e, zona); const id = arr; arr = null; limpiar(); onDrop(id, zona.dataset.zona, d?.dataset.id ?? null)
  })
}
function mover(lista, id, antesId, extra) {
  const i = lista.findIndex((x) => x.id === id); if (i < 0) return
  const [it] = lista.splice(i, 1); Object.assign(it, extra || {})
  let j = antesId ? lista.findIndex((x) => x.id === antesId) : -1
  if (j < 0) { const fin = lista.findIndex((x) => x.fijoAlFinal && (!extra?.ambito || x.ambito === extra.ambito)); j = fin >= 0 ? fin : lista.length }
  lista.splice(j, 0, it)
}
function aviso(texto, deshacer) {
  document.querySelector('.d-toast')?.remove()
  const t = document.createElement('div'); t.className = 'd-toast'; t.setAttribute('role', 'status')
  t.innerHTML = `<span>${esc(texto)}</span>${deshacer ? '<button>Deshacer</button>' : ''}`
  document.body.appendChild(t)
  t.querySelector('button')?.addEventListener('click', () => { deshacer(); t.remove() })
  setTimeout(() => t.remove(), 5000)
}

/* ---------- B · Explorador jerárquico ---------- */
const abiertos = new Set(['a1', 'c2'])
function renderB(host) {
  const arbol = () => {
    const nodo = (it, tipo, hijos) => {
      const ab = abiertos.has(it.id)
      return `<div><button class="nodo ${it.activo ? '' : 'off'}" role="treeitem" aria-selected="${APP.sel.id === it.id}" ${hijos ? `aria-expanded="${ab}"` : ''} data-n="${tipo}:${it.id}" data-cid="${tipo}:${it.id}">
        ${hijos ? `<span class="chev" data-abierto="${ab}" data-tog="${it.id}">${ui('flecha')}</span>` : '<span style="width:18px"></span>'}${ins(it, 'p')}<span>${esc(it.nombre)}</span><span class="cnt num">${it.gastos}</span></button>
        ${hijos && ab ? `<div class="hijos" role="group">${hijos}</div>` : ''}</div>`
    }
    if (APP.sec === 'medios') return DATOS.medios.map((m) => nodo(m, 'medio', '')).join('')
    if (APP.sec === 'ambitos') return DATOS.ambitos.map((a) => nodo(a, 'ambito', '')).join('')
    return DATOS.ambitos.map((a) => nodo(a, 'ambito', DATOS.categorias.filter((c) => c.ambito === a.id).map((c) => nodo(c, 'categoria', c.subs.map((s) => `<button class="nodo" data-padre="${c.id}" data-cid="categoria:${c.id}"><span class="punto"></span><span>${esc(s)}</span></button>`).join(''))).join(''))).join('')
  }
  host.innerHTML = `<div class="d-split"><div class="d-panel"><div class="arbol" role="tree" aria-label="Catálogo">${arbol()}</div></div><div class="d-panel" id="detalle">${detalleHtml()}</div></div>
    <p class="pista">Haz clic en un nodo para ver y cambiar su color al instante. La flecha abre y cierra.</p>`
  host.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', (e) => {
    const [t, id] = b.dataset.n.split(':')
    if (e.target.closest('[data-tog]')) { abiertos.has(id) ? abiertos.delete(id) : abiertos.add(id); APP.sel = { tipo: t, id }; redibujar(); return }
    APP.sel = { tipo: t, id }; redibujar()
  }))
  host.querySelectorAll('[data-padre]').forEach((b) => b.addEventListener('click', () => { APP.sel = { tipo: 'categoria', id: b.dataset.padre }; redibujar() }))
}

/* ---------- D · Mosaico proporcional (treemap animado) ---------- */
function squarify(items, x, y, w, h) {
  const out = [], total = items.reduce((s, i) => s + i.v, 0); if (!total) return out
  const k = (w * h) / total; let rest = [...items].sort((a, b) => b.v - a.v), X = x, Y = y, W = w, H = h
  while (rest.length) {
    const lado = Math.min(W, H)
    const peor = (r) => { const s = r.reduce((a, i) => a + i.v * k, 0), mx = Math.max(...r.map((i) => i.v * k)), mn = Math.min(...r.map((i) => i.v * k)); return Math.max((lado * lado * mx) / (s * s), (s * s) / (lado * lado * mn)) }
    let fila = [rest[0]], n = 1
    while (n < rest.length && peor(rest.slice(0, n + 1)) <= peor(fila)) { fila = rest.slice(0, n + 1); n++ }
    const area = fila.reduce((a, i) => a + i.v * k, 0), grosor = area / lado; let off = 0
    for (const it of fila) { const largo = (it.v * k) / grosor; out.push(W >= H ? { it: it.it, x: X, y: Y + off, w: grosor, h: largo } : { it: it.it, x: X + off, y: Y, w: largo, h: grosor }); off += largo }
    if (W >= H) { X += grosor; W -= grosor } else { Y += grosor; H -= grosor }
    rest = rest.slice(fila.length)
  }
  return out
}
function renderD(host) {
  host.innerHTML = `<div class="d-tools" style="margin-bottom:10px"><span class="pista" style="margin:0">Tamaño según:</span><div class="segmento" role="radiogroup" aria-label="Tamaño según">
    <button role="radio" aria-checked="${APP.metrica === 'gastos'}" data-m="gastos">Gastos</button><button role="radio" aria-checked="${APP.metrica === 'igual'}" data-m="igual">Todos iguales</button></div></div>
    <div class="d-split"><div class="d-panel"><div class="d-lienzo" id="lienzo" role="group" aria-label="Mosaico del catálogo"></div><p class="pista">El tamaño cambia con la métrica y los colores con cada elección. Pasa el cursor o usa Tab para recorrer.</p></div><div class="d-panel" id="detalle">${detalleHtml()}</div></div>`
  const lienzo = $('#lienzo'), W = 100, H = 66
  const nodos = new Map()
  const crear = (it, tipo) => {
    const k = `${tipo}:${it.id}`; if (nodos.has(k)) return nodos.get(k)
    const b = document.createElement('button'); b.className = 'd-teja'; b.dataset.cid = k; b.dataset.selId = it.id
    b.innerHTML = `<span>${svg(it.icono)}<b>${esc(it.nombre)}</b><small class="num">${it.gastos} gastos</small></span>`
    b.addEventListener('click', () => { seleccionar(tipo, it.id) })
    lienzo.appendChild(b); nodos.set(k, b); return b
  }
  const grupos = new Map()
  const colocar = () => {
    const rects = []
    const tipo = tipoSec()
    if (APP.sec === 'categorias') {
      const amb = DATOS.ambitos.map((a) => ({ it: a, v: Math.max(14, DATOS.categorias.filter((c) => c.ambito === a.id).reduce((s, c) => s + valorDe(c), 0)) }))
      for (const r of squarify(amb, 0, 0, W, H)) {
        let g = grupos.get(r.it.id); if (!g) { g = document.createElement('div'); g.className = 'd-grupo'; g.dataset.cid = `ambito:${r.it.id}`; g.innerHTML = `<i>${esc(r.it.nombre)}</i>`; lienzo.appendChild(g); grupos.set(r.it.id, g) }
        Object.assign(g.style, { left: r.x + '%', top: (r.y / H) * 100 + '%', width: r.w + '%', height: (r.h / H) * 100 + '%' })
        const cats = DATOS.categorias.filter((c) => c.ambito === r.it.id)
        const inset = 5.2
        for (const c of squarify(cats.map((c) => ({ it: c, v: valorDe(c) })), r.x + 0.6, r.y + inset, Math.max(1, r.w - 1.2), Math.max(1, r.h - inset - 0.6))) rects.push({ ...c, tipo: 'categoria' })
      }
    } else {
      grupos.forEach((g) => g.remove()); grupos.clear()
      for (const r of squarify(listaDe(tipo).map((it) => ({ it, v: valorDe(it) })), 0, 0, W, H)) rects.push({ ...r, tipo })
    }
    const vivos = new Set()
    for (const r of rects) {
      const b = crear(r.it, r.tipo); vivos.add(b.dataset.cid)
      Object.assign(b.style, { left: r.x + '%', top: (r.y / H) * 100 + '%', width: r.w + '%', height: (r.h / H) * 100 + '%' })
      b.dataset.s = r.w * r.h < 90 ? 'xs' : r.w * r.h < 210 ? 's' : 'm'
      b.classList.toggle('off', !r.it.activo); b.setAttribute('aria-pressed', String(APP.sel.id === r.it.id)); b.setAttribute('aria-label', `${r.it.nombre}, ${r.it.gastos} gastos`)
    }
    nodos.forEach((b, k) => { if (!vivos.has(k)) { b.remove(); nodos.delete(k) } })
    pintarTodo()
  }
  colocar()
  host.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { APP.metrica = b.dataset.m; host.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); colocar() }))
}

/* ---------- E · Tablero arrastrable ---------- */
function renderE(host) {
  const tarjeta = (it, tipo, extra = '') => {
    const fijo = it.fijoAlFinal
    return `<div class="d-card ${fijo ? 'fijo' : ''}" role="button" tabindex="0" ${fijo ? '' : 'draggable="true"'} data-drag data-id="${it.id}" data-fijo="${fijo ? 1 : 0}" data-cid="${tipo}:${it.id}" data-sel-id="${it.id}" aria-pressed="${APP.sel.id === it.id}"
      aria-label="${esc(it.nombre)}. ${fijo ? 'Siempre al final.' : 'Alt y flechas para mover.'}"><div class="fila">${ins(it, 'p')}<b>${esc(it.nombre)}</b>${fijo ? ui('candado') : ''}${it.activo ? '' : '<span class="estado off">Inactivo</span>'}</div><small class="num">${it.gastos} gastos${extra}</small></div>`
  }
  let cuerpo
  if (APP.sec === 'categorias') {
    cuerpo = `<div class="d-tablero">${DATOS.ambitos.map((a) => `<section class="d-col" data-zona="${a.id}" data-eje="y" data-cid="ambito:${a.id}" aria-label="Ámbito ${esc(a.nombre)}"><h3>${ins(a, 'p')}<span>${esc(a.nombre)}</span><span class="num">${DATOS.categorias.filter((c) => c.ambito === a.id).length}</span></h3>
      ${DATOS.categorias.filter((c) => c.ambito === a.id).map((c) => tarjeta(c, 'categoria', ` · ${c.subs.length} subcategorías`)).join('')}</section>`).join('')}</div>`
  } else {
    const tipo = tipoSec()
    cuerpo = `<div class="d-tablero"><section class="d-col d-fila" data-zona="lista" data-eje="x" style="flex:1" aria-label="${SEC_NOMBRE[APP.sec]}">${listaDe(tipo).map((it) => tarjeta(it, tipo)).join('')}</section></div>`
  }
  host.innerHTML = `<div class="d-split"><div class="d-panel">${cuerpo}<p class="pista">Arrastra una tarjeta para ordenar${APP.sec === 'categorias' ? ' o moverla a otro ámbito' : ''}. Con teclado: enfoca una tarjeta y usa <b>Alt</b> + flechas. «Otros» queda siempre al final.</p></div><div class="d-panel" id="detalle">${detalleHtml()}</div></div>`
  const tipo = tipoSec(), lista = listaDe(tipo)
  activarDnd(host.querySelector('.d-tablero'), (id, zona, antes) => { guardarSnap(); mover(lista, id, antes, tipo === 'categoria' ? { ambito: zona } : undefined); APP.sel = { tipo, id }; redibujar() })
  host.querySelectorAll('.d-card').forEach((c) => {
    c.addEventListener('click', () => seleccionar(tipo, c.dataset.id))
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seleccionar(tipo, c.dataset.id); return }
      if (!e.altKey || c.dataset.fijo === '1') return
      const id = c.dataset.id, it = itemDe(tipo, id)
      const grupo = tipo === 'categoria' ? lista.filter((x) => x.ambito === it.ambito) : lista, gi = grupo.findIndex((x) => x.id === id)
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' && tipo !== 'categoria') { if (gi > 0) { e.preventDefault(); guardarSnap(); mover(lista, id, grupo[gi - 1].id, tipo === 'categoria' ? { ambito: it.ambito } : undefined) } }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' && tipo !== 'categoria') { if (grupo[gi + 1] && !grupo[gi + 1].fijoAlFinal) { e.preventDefault(); guardarSnap(); mover(lista, id, grupo[gi + 2]?.id ?? null, tipo === 'categoria' ? { ambito: it.ambito } : undefined) } }
      else if (tipo === 'categoria' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { const ai = DATOS.ambitos.findIndex((a) => a.id === it.ambito) + (e.key === 'ArrowRight' ? 1 : -1); if (DATOS.ambitos[ai]) { e.preventDefault(); guardarSnap(); mover(lista, id, null, { ambito: DATOS.ambitos[ai].id }) } }
      else return
      APP.sel = { tipo, id }; redibujar(); document.querySelector(`.d-card[data-id="${id}"]`)?.focus()
    })
  })
}

/* ---------- F · Anillos ---------- */
function renderF(host) {
  host.innerHTML = `<div class="d-tools" style="margin-bottom:10px"><div class="segmento" role="radiogroup" aria-label="Tamaño según"><button role="radio" aria-checked="${APP.metrica === 'gastos'}" data-m="gastos">Por gastos</button><button role="radio" aria-checked="${APP.metrica === 'igual'}" data-m="igual">Partes iguales</button></div></div>
    <div class="d-split"><div class="d-panel"><div class="d-anillos" id="anillos"><svg viewBox="0 0 420 420" role="group" aria-label="Anillos del catálogo"></svg><div class="d-centro"><div id="centro"></div></div><div class="d-tip" id="tip"></div></div>
    <p class="pista">Pasa el cursor para ver el detalle, haz clic para elegir. El anillo interior son los ámbitos y el exterior las categorías.</p></div><div class="d-panel" id="detalle">${detalleHtml()}</div></div>`
  const svgEl = $('svg', host), tip = $('#tip'), caja = $('#anillos')
  const geometria = () => {
    const g = new Map(), tipo = tipoSec(), GAP = 0.025
    const reparte = (items, a0, a1, r0, r1, t) => { const tot = items.reduce((s, i) => s + i.v, 0); let a = a0; for (const i of items) { const da = ((a1 - a0) * i.v) / tot; g.set(`${t}:${i.it.id}`, { r0, r1, a0: a + GAP, a1: Math.max(a + GAP + 0.01, a + da - GAP), it: i.it, t }); a += da } }
    const A0 = -Math.PI / 2, A1 = A0 + Math.PI * 2
    if (APP.sec === 'categorias') {
      const amb = DATOS.ambitos.map((a) => ({ it: a, v: Math.max(valorDe({ gastos: 8 }), DATOS.categorias.filter((c) => c.ambito === a.id).reduce((s, c) => s + valorDe(c), 0)) }))
      reparte(amb, A0, A1, 62, 118, 'ambito')
      for (const a of amb) { const ga = g.get(`ambito:${a.it.id}`); const cats = DATOS.categorias.filter((c) => c.ambito === a.it.id); if (cats.length) reparte(cats.map((c) => ({ it: c, v: valorDe(c) })), ga.a0 - GAP, ga.a1 + GAP, 124, 186, 'categoria') }
    } else reparte(listaDe(tipo).map((it) => ({ it, v: valorDe(it) })), A0, A1, 82, 186, tipo)
    return g
  }
  const arco = (r0, r1, a0, a1) => { const P = (r, a) => [210 + r * Math.cos(a), 210 + r * Math.sin(a)], L = a1 - a0 > Math.PI ? 1 : 0, [x0, y0] = P(r1, a0), [x1, y1] = P(r1, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a0); return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r1} ${r1} 0 ${L} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r0} ${r0} 0 ${L} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z` }
  let actual = geometria()
  const total = () => listaDe(tipoSec()).reduce((s, i) => s + i.gastos, 0)
  const centro = () => { const it = APP.sel && itemDe(APP.sel.tipo, APP.sel.id); $('#centro').innerHTML = it ? `<b>${esc(it.nombre)}</b><small class="num">${it.gastos} gastos</small>` : `<b>Catálogo</b><small class="num">${total()} gastos</small>` }
  const pintarSel = () => { if (!svgEl.isConnected) return; const sel = APP.sel; const padre = sel?.tipo === 'categoria' ? itemDe('categoria', sel.id)?.ambito : sel?.tipo === 'ambito' ? sel.id : null
    svgEl.querySelectorAll('.arco').forEach((p) => { const [t, id] = p.dataset.cid.split(':'); const it = itemDe(t, id); const esSel = sel && sel.id === id; let dim = false
      if (APP.sec === 'categorias' && padre) dim = t === 'ambito' ? id !== padre : it.ambito !== padre
      p.classList.toggle('dim', dim); p.classList.toggle('off', !it.activo)
      const a = actual.get(p.dataset.cid); const m = (a.a0 + a.a1) / 2; p.style.transform = esSel ? `translate(${(Math.cos(m) * 9).toFixed(1)}px, ${(Math.sin(m) * 9).toFixed(1)}px)` : ''
      p.setAttribute('aria-pressed', String(esSel)) }); centro() }
  actual.forEach((a, k) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('class', 'arco'); p.setAttribute('d', arco(a.r0, a.r1, a.a0, a.a1)); p.dataset.cid = k; p.setAttribute('tabindex', '0'); p.setAttribute('role', 'button')
    p.setAttribute('aria-label', `${a.it.nombre}, ${a.it.gastos} gastos`)
    p.addEventListener('click', () => { seleccionar(a.t, a.it.id); pintarSel() })
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seleccionar(a.t, a.it.id); pintarSel() } })
    const mostrar = (ev) => { const r = caja.getBoundingClientRect(); const sum = [...actual.values()].filter((x) => x.t === a.t).reduce((s, x) => s + x.it.gastos, 0); tip.innerHTML = `<b>${esc(a.it.nombre)}</b><br><span class="num">${a.it.gastos} gastos · ${sum ? Math.round((a.it.gastos / sum) * 100) : 0}%</span>`; tip.classList.add('on'); const x = ev.clientX ? ev.clientX - r.left : r.width / 2, y = ev.clientY ? ev.clientY - r.top : r.height / 2; tip.style.left = Math.min(r.width - 150, x + 14) + 'px'; tip.style.top = Math.max(0, y - 10) + 'px' }
    p.addEventListener('mousemove', mostrar); p.addEventListener('focus', mostrar); p.addEventListener('mouseleave', () => tip.classList.remove('on')); p.addEventListener('blur', () => tip.classList.remove('on'))
    svgEl.appendChild(p) })
  pintarTodo(); pintarSel()
  document.addEventListener('seleccion', pintarSel, { once: false })
  host.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
    APP.metrica = b.dataset.m; host.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-checked', String(x === b)))
    const destino = geometria(), origen = new Map(actual), t0 = performance.now()
    const paso = (t) => { const k = Math.min(1, (t - t0) / 450), e = 1 - (1 - k) ** 3
      destino.forEach((d, key) => { const o = origen.get(key) ?? d; svgEl.querySelector(`[data-cid="${key}"]`)?.setAttribute('d', arco(d.r0, d.r1, o.a0 + (d.a0 - o.a0) * e, o.a1 + (d.a1 - o.a1) * e)) })
      if (k < 1) requestAnimationFrame(paso); else { actual = destino; pintarSel() } }
    requestAnimationFrame(paso)
  }))
}

/* ---------- G · Estudio de color con vista previa viva ---------- */
const GASTOS_EJEMPLO = [['Supermercado', 'c2', 'm2', 'S/ 184.30'], ['Recibo de luz', 'c1', 'm1', 'S/ 96.00'], ['Cine con amigos', 'c4', 'm3', 'S/ 42.00'], ['Útiles escolares', 'c6', 'm4', 'S/ 67.50']]
function renderG(host) {
  const tipo = tipoSec(), lista = listaDe(tipo)
  const panelPrev = (t) => {
    const total = DATOS.ambitos.reduce((s, a) => s + a.gastos, 0), R = 40, C = 2 * Math.PI * R; let acum = 0
    const segs = DATOS.ambitos.map((a) => { const f = a.gastos / total, d = `<circle class="pc-seg d-pc" data-pc="ambito:${a.id}" data-pt="${t}" cx="60" cy="60" r="${R}" stroke-dasharray="${(f * C - 2).toFixed(1)} ${C}" stroke-dashoffset="${(-acum * C).toFixed(1)}" transform="rotate(-90 60 60)"/>`; acum += f; return d }).join('')
    const top = DATOS.categorias.filter((c) => c.activo).sort((a, b) => b.gastos - a.gastos).slice(0, 4), mx = top[0].gastos
    return `<div class="d-pv ${t}" data-pt="${t}"><h4>Tema ${t}</h4>
      <div><h4>Gasto por ámbito</h4><svg viewBox="0 0 120 120" role="img" aria-label="Gasto por ámbito">${segs}</svg><div class="pc-leyenda">${DATOS.ambitos.map((a) => `<span class="pc-chip d-pc" data-pc="ambito:${a.id}" data-pt="${t}">${esc(a.nombre)}</span>`).join('')}</div></div>
      <div><h4>Top categorías</h4>${top.map((c) => `<div style="margin:6px 0"><div class="pc-fila"><span class="pc-ins d-pc" data-pc="categoria:${c.id}" data-pt="${t}">${svg(c.icono)}</span><span style="flex:1">${esc(c.nombre)}</span><b class="num">${c.gastos}</b></div><div class="pc-barra d-pc" data-pc="categoria:${c.id}" data-pt="${t}" style="width:${(c.gastos / mx) * 100}%;margin-top:4px"></div></div>`).join('')}</div>
      <div><h4>Últimos gastos</h4>${GASTOS_EJEMPLO.map(([d, c, m, imp]) => `<div class="pc-fila" style="margin:6px 0"><span class="pc-ins d-pc" data-pc="categoria:${c}" data-pt="${t}">${svg(itemDe('categoria', c).icono)}</span><span style="flex:1;min-width:0">${esc(d)}<br><span class="pc-chip d-pc" data-pc="medio:${m}" data-pt="${t}">${esc(itemDe('medio', m).nombre)}</span></span><b class="num">${imp}</b></div>`).join('')}</div></div>`
  }
  host.innerHTML = `<div class="d-tools" style="margin-bottom:10px"><button class="btn" id="g-arm">${ui('gota')} Armonizar paleta</button><button class="btn" id="g-mez">Mezclar al azar</button><button class="btn" id="g-und">Deshacer</button><span class="pista" style="margin:0">Cambia un color y mira abajo cómo queda la app en claro y oscuro.</span></div>
    <div class="d-estudio"><div class="d-panel d-lista" role="listbox" aria-label="${SEC_NOMBRE[APP.sec]}">${lista.map((it) => `<button class="nodo" role="option" data-cid="${tipo}:${it.id}" data-sel-id="${it.id}" data-sel-attr="aria-selected" aria-selected="${APP.sel.id === it.id}" data-g="${it.id}">${ins(it, 'p')}<span>${esc(it.nombre)}</span><span class="origen" style="margin-left:auto"><span class="punto"></span></span></button>`).join('')}</div>
    <div class="d-panel" id="detalle">${detalleHtml()}</div><div class="d-pvs">${panelPrev('claro')}${panelPrev('oscuro')}</div></div>`
  host.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => seleccionar(tipo, b.dataset.g)))
  const repartir = (orden) => { guardarSnap(); const base = orden === 'azar' ? [...COLORES].sort(() => Math.random() - 0.5) : COLORES; const paso = Math.max(1, Math.floor(COLORES.length / lista.length)); lista.forEach((it, i) => { if (!it.fijoAlFinal) it.color = base[(i * paso + (orden === 'azar' ? 0 : 0)) % COLORES.length].hex }); redibujar() }
  $('#g-arm').addEventListener('click', () => repartir('uniforme')); $('#g-mez').addEventListener('click', () => repartir('azar'))
  $('#g-und').addEventListener('click', () => { const s = historial.pop(); if (s) { Object.assign(DATOS, JSON.parse(s)); redibujar() } })
}
function pintarPreview() {
  document.querySelectorAll('.d-pc').forEach((el) => {
    const [t, id] = el.dataset.pc.split(':'), it = itemDe(t, id); if (!it) return
    const k = tonos(colorHex(it, t), el.dataset.pt)
    el.style.setProperty('--b', colorHex(it, t)); el.style.setProperty('--s', k.soft); el.style.setProperty('--o', k.borde); el.style.setProperty('--i', k.icono); el.style.setProperty('--t', k.texto)
    if (el.classList.contains('pc-barra') || el.classList.contains('pc-seg')) el.style.setProperty('--b', k.icono)
  })
}

/* ---------- H · Lista viva ---------- */
function renderH(host) {
  const tipo = tipoSec(), lista = listaDe(tipo)
  let filtro = host.dataset.q || ''
  host.innerHTML = `<div class="d-split"><div class="d-panel"><div class="d-tools" style="margin-bottom:10px"><div class="d-buscar" style="flex:1">${ui('buscar')}<input id="h-q" placeholder="Buscar… (la lista se filtra al escribir)" aria-label="Buscar" value="${esc(filtro)}"></div></div><div class="d-h" id="h-lista"></div>
    <div class="d-nuevo" style="margin-top:12px"><input id="h-nuevo" placeholder="Escribe un nombre y pulsa Enter para añadir…" aria-label="Nuevo elemento"></div>
    <p class="pista">Clic en un nombre para renombrar · punto de color para cambiarlo · arrastra el asa para ordenar · ↑ ↓ para moverte por las filas.</p></div><div class="d-panel" id="detalle">${detalleHtml()}</div></div>`
  const cont = $('#h-lista')
  const resaltar = (t) => { if (!filtro) return esc(t); const i = t.toLowerCase().indexOf(filtro.toLowerCase()); return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + filtro.length)) + '</mark>' + esc(t.slice(i + filtro.length)) }
  const coincide = (it) => !filtro || it.nombre.toLowerCase().includes(filtro.toLowerCase()) || (it.subs || []).some((s) => s.toLowerCase().includes(filtro.toLowerCase()))
  const fila = (it) => `<div class="d-hfila ${it.activo ? '' : 'off'} ${APP.sel.id === it.id ? 'foco' : ''}" ${it.fijoAlFinal ? '' : 'draggable="true"'} data-drag data-id="${it.id}" data-fijo="${it.fijoAlFinal ? 1 : 0}" data-cid="${tipo}:${it.id}" data-hf>
    <span class="asa" aria-hidden="true">${it.fijoAlFinal ? ui('candado') : ui('arrastrar')}</span><button class="d-punto" data-punto="${it.id}" aria-label="Cambiar color de ${esc(it.nombre)}" aria-haspopup="true"></button>${ins(it, 'p')}
    <button class="nom" data-ren="${it.id}" aria-label="Renombrar ${esc(it.nombre)}">${resaltar(it.nombre)}</button><span class="num" style="color:var(--muted);font-size:12px">${it.gastos}</span><span data-id="${it.id}" data-tipo="${tipo}">${interruptor(it.activo, it.nombre, it.fijoAlFinal)}</span>
    <button class="btn-ico" data-del="${it.id}" aria-label="Eliminar ${esc(it.nombre)}" title="${esc(eliminable(it, tipo).motivo)}" ${eliminable(it, tipo).ok ? '' : 'disabled'}>${ui('papelera')}</button></div>`
  const pintarLista = () => {
    if (tipo === 'categoria') cont.innerHTML = DATOS.ambitos.map((a) => { const cs = lista.filter((c) => c.ambito === a.id && coincide(c)); return cs.length ? `<div data-zona="${a.id}" data-eje="y"><div class="d-hgrupo" data-cid="ambito:${a.id}"><span class="punto"></span>${esc(a.nombre)}</div>${cs.map((c) => fila(c)).join('')}</div>` : '' }).join('') || '<p class="pista">Sin resultados.</p>'
    else cont.innerHTML = `<div data-zona="lista" data-eje="y" style="display:flex;flex-direction:column;gap:4px">${lista.filter(coincide).map((it) => fila(it)).join('') || '<p class="pista">Sin resultados.</p>'}</div>`
    pintarTodo()
  }
  pintarLista()
  activarDnd(cont, (id, zona, antes) => { guardarSnap(); mover(lista, id, antes, tipo === 'categoria' ? { ambito: zona } : undefined); redibujar() })
  $('#h-q').addEventListener('input', (e) => { filtro = host.dataset.q = e.target.value; pintarLista() })
  $('#h-nuevo').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return
    guardarSnap(); const col = COLORES[(lista.length * 3) % COLORES.length].hex
    const nuevo = { id: 'n' + Date.now(), nombre: e.target.value.trim(), icono: 'etiqueta', color: tipo === 'categoria' ? null : col, activo: true, gastos: 0, subs: [], ambito: APP.sel.tipo === 'categoria' ? (itemDe('categoria', APP.sel.id)?.ambito ?? 'a1') : 'a1' }
    const fin = lista.findIndex((x) => x.fijoAlFinal && (tipo !== 'categoria' || x.ambito === nuevo.ambito)); lista.splice(fin >= 0 ? fin : lista.length, 0, nuevo); APP.sel = { tipo, id: nuevo.id }; redibujar()
  })
  cont.addEventListener('click', (e) => {
    const f = e.target.closest('[data-hf]'); if (!f) return
    const id = f.dataset.id
    const pt = e.target.closest('[data-punto]')
    if (pt) { abrirPop(pt, id); return }
    const rn = e.target.closest('[data-ren]')
    if (rn) {
      const it = itemDe(tipo, id), inp = document.createElement('input'); inp.className = 'nom'; inp.value = it.nombre; inp.maxLength = 40; inp.setAttribute('aria-label', 'Nuevo nombre'); rn.replaceWith(inp); inp.focus(); inp.select()
      const fin = (ok) => { if (ok && inp.value.trim()) { guardarSnap(); it.nombre = inp.value.trim() } redibujar() }
      inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') fin(true); if (ev.key === 'Escape') fin(false) }); inp.addEventListener('blur', () => fin(true)); return
    }
    const del = e.target.closest('[data-del]')
    if (del && !del.disabled) { guardarSnap(); const antes = historial.pop(); const it = itemDe(tipo, id); lista.splice(lista.indexOf(it), 1); redibujar(); aviso(`«${it.nombre}» eliminado`, () => { Object.assign(DATOS, JSON.parse(antes)); redibujar() }); return }
    if (!e.target.closest('.sw')) { APP.sel = { tipo, id }; refrescarDetalle(); cont.querySelectorAll('.d-hfila').forEach((r) => r.classList.toggle('foco', r.dataset.id === id)) }
  })
  host.addEventListener('keydown', (e) => {
    if (e.target.matches('input')) return
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const filas = [...cont.querySelectorAll('.d-hfila .nom')], i = filas.indexOf(document.activeElement); if (i < 0) return
    e.preventDefault(); filas[Math.max(0, Math.min(filas.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus()
  })
  function abrirPop(boton, id) {
    document.querySelector('.d-pop')?.remove()
    const it = itemDe(tipo, id), r = boton.getBoundingClientRect(), p = document.createElement('div'); p.className = 'd-pop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', `Color de ${it.nombre}`)
    p.innerHTML = `<div class="d-qc">${COLORES.map((k) => `<button class="d-sw" style="--k-base:${k.hex}" data-c="${k.hex}" aria-label="${k.nombre}" title="${k.nombre}" aria-pressed="${(it.color || '').toLowerCase() === k.hex.toLowerCase()}"></button>`).join('')}</div>
      ${tipo === 'categoria' ? `<button class="d-her" data-c="heredar" style="margin-top:8px;width:100%" aria-pressed="${!it.color}">${ui('enlace')} Heredar del ámbito</button>` : ''}`
    p.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - 248)) + 'px'; p.style.top = window.scrollY + r.bottom + 6 + 'px'
    document.body.appendChild(p); p.querySelector('[data-c]').focus()
    const cerrar = () => { p.remove(); document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc2) }
    const fuera = (ev) => { if (!p.contains(ev.target) && ev.target !== boton) cerrar() }; const esc2 = (ev) => { if (ev.key === 'Escape') { cerrar(); boton.focus() } }
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc2)
    p.addEventListener('click', (ev) => { const c = ev.target.closest('[data-c]'); if (!c) return; guardarSnap(); it.color = c.dataset.c === 'heredar' ? null : c.dataset.c; cerrar(); pintarTodo(); refrescarDetalle(); pintarLista() })
  }
}

/* ---------- Esqueleto de la página ---------- */
const RENDER = { B: renderB, D: renderD, E: renderE, F: renderF, G: renderG, H: renderH }
function cabecera() {
  const v = VARIANTES.find((x) => x[0] === APP.v)
  $('#d-vars').innerHTML = VARIANTES.map(([k, n, d]) => `<button class="d-var" data-v="${k}" aria-pressed="${APP.v === k}"><b><span class="l">${k}</span>${n}</b><small>${d}</small></button>`).join('')
  $('#d-tabs').innerHTML = Object.entries(SEC_NOMBRE).map(([k, n]) => `<button role="tab" aria-selected="${APP.sec === k}" data-sec="${k}">${n}</button>`).join('')
  const tema = temaActual(); $('#d-tema').innerHTML = tema === 'claro' ? `${ui('luna')} Oscuro` : `${ui('sol')} Claro`
  document.title = `Propuestas de Catálogo · ${v[1]}`
}
function redibujar() {
  validarSel(); cabecera(); const stage = $('#stage'); stage.innerHTML = ''; stage.style.animation = 'none'; void stage.offsetWidth; stage.style.animation = ''
  RENDER[APP.v](stage); pintarTodo()
}
function iniciar() {
  document.body.insertAdjacentHTML('afterbegin', `<div class="pagina"><header class="d-cab"><div><h1>Catálogo · propuestas dinámicas</h1><p>Prueba cada una con los mismos datos de ejemplo: cambia colores, ordena, activa, elimina. Nada se guarda; es solo diseño.</p></div>
    <div class="acc"><button class="btn" id="d-reset">Restablecer datos</button><button class="btn" id="d-tema" aria-label="Cambiar tema"></button></div></header>
    <nav class="d-vars" id="d-vars" aria-label="Propuestas"></nav>
    <div class="d-barra"><div class="tabs" id="d-tabs" role="tablist" aria-label="Sección del catálogo"></div></div><section class="d-stage" id="stage" aria-live="polite"></section></div>`)
  document.addEventListener('click', (e) => {
    const v = e.target.closest('[data-v]'); if (v) { APP.v = v.dataset.v; redibujar(); return }
    const s = e.target.closest('[data-sec]'); if (s) { APP.sec = s.dataset.sec; redibujar(); return }
    if (e.target.closest('#d-tema')) { fijarTema(temaActual() === 'claro' ? 'oscuro' : 'claro'); return }
    if (e.target.closest('#d-reset')) { Object.assign(DATOS, JSON.parse(DATOS_INICIALES)); historial.length = 0; redibujar(); return }
    const q = e.target.closest('[data-qc]')
    if (q) { const it = itemDe(APP.sel.tipo, APP.sel.id); guardarSnap(); it.color = q.dataset.qc === 'heredar' ? null : q.dataset.qc; pintarTodo(); refrescarDetalle(); document.dispatchEvent(new CustomEvent('seleccion')); const lista = $('.d-lista'); if (lista) pintarTodo() }
  })
  manejarAcciones($('#stage'), redibujar)
  document.addEventListener('tema', redibujar)
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (!document.documentElement.dataset.theme) document.dispatchEvent(new CustomEvent('tema')) })
  redibujar()
}
if (document.body) iniciar(); else document.addEventListener("DOMContentLoaded", iniciar)
