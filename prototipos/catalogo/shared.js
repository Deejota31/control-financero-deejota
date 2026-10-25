/* PROTOTIPO DE DISEÑO: no forma parte de la aplicación ni se compila. Sin base de datos: datos de ejemplo. */
'use strict'

/* ---------- Paleta de 20 colores ---------- */
const COLORES = [
  ['Índigo', '#4F46E5'], ['Azul', '#2563EB'], ['Celeste', '#0EA5E9'], ['Turquesa', '#06B6D4'], ['Teal', '#0D9488'],
  ['Esmeralda', '#059669'], ['Verde', '#16A34A'], ['Lima', '#65A30D'], ['Oliva', '#7C8B2A'], ['Amarillo', '#CA8A04'],
  ['Ámbar', '#D97706'], ['Naranja', '#EA580C'], ['Coral', '#F0614E'], ['Rojo', '#DC2626'], ['Carmesí', '#BE123C'],
  ['Rosa', '#DB2777'], ['Magenta', '#C026D3'], ['Violeta', '#7C3AED'], ['Púrpura', '#7E22CE'], ['Pizarra', '#64748B'],
].map(([nombre, hex]) => ({ nombre, hex }))

/* ---------- Color: conversiones y contraste ---------- */
const hexARgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const rgbAHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
const mezcla = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t) /* t = proporción de b */
function rgbAHsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, max ? d / max : 0, max]
}
function hsvARgb([h, s, v]) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)) }
  return [f(5) * 255, f(3) * 255, f(1) * 255]
}
function luminancia([r, g, b]) {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** Ajusta el brillo del color base hacia el extremo indicado hasta alcanzar el contraste mínimo contra el fondo. */
function ajustarContraste(rgb, fondo, minimo, haciaOscuro) {
  let c = rgb
  for (let i = 0; i < 40 && contraste(c, fondo) < minimo; i++) c = mezcla(c, haciaOscuro ? [0, 0, 0] : [255, 255, 255], 0.06)
  return c
}

const BASE = { claro: [255, 255, 255], oscuro: [24, 24, 41] } /* superficies de la aplicación */

/**
 * Tratamiento de un color en cada tema (misma regla para la paleta y para colores personalizados):
 *  claro  → fondo suave = 10 % de color sobre blanco · borde = 35 % · icono = color · texto = color oscurecido hasta 4.5:1
 *  oscuro → fondo suave = 22 % de color sobre la superficie · borde = 50 % · icono = color aclarado · texto aclarado hasta 4.5:1
 */
function tonos(hex, tema) {
  const rgb = hexARgb(hex)
  if (!rgb) return null
  const base = BASE[tema]
  const soft = mezcla(base, rgb, tema === 'claro' ? 0.1 : 0.22)
  const borde = mezcla(base, rgb, tema === 'claro' ? 0.35 : 0.5)
  const texto = ajustarContraste(rgb, soft, 4.5, tema === 'claro')
  const icono = ajustarContraste(rgb, tema === 'claro' ? base : soft, 3, tema === 'claro')
  return { soft: rgbAHex(soft), borde: rgbAHex(borde), icono: rgbAHex(icono), texto: rgbAHex(texto), cTexto: contraste(texto, soft), cIcono: contraste(icono, tema === 'claro' ? base : soft) }
}
/** Variables CSS inline para pintar un elemento con un color en el tema actual. */
function estiloColor(hex) {
  const t = tonos(hex, temaActual())
  return t ? `--k-soft:${t.soft};--k-borde:${t.borde};--k-icono:${t.icono};--k-texto:${t.texto};--k-base:${hex}` : ''
}

/* ---------- Tema ---------- */
function temaActual() { return document.documentElement.dataset.theme === 'dark' ? 'oscuro' : 'claro' }
function fijarTema(t) { document.documentElement.dataset.theme = t === 'oscuro' ? 'dark' : 'light'; document.dispatchEvent(new CustomEvent('tema')) }

/* ---------- Iconos (trazos propios, 24×24) ---------- */
const ICONOS = {
  casa: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  familia: '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.500 6 6"/><path d="M15.500 14.200c3 0 5.500 2 5.500 5"/>',
  maletin: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M3 13h18"/>',
  comida: '<path d="M7 3v8a2 2 0 0 0 2 2v8"/><path d="M5 3v6M9 3v6"/><path d="M17 3c-2 2-3 5-3 8h3v10"/>',
  auto: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3z"/><circle cx="7.500" cy="16" r="0.800"/><circle cx="16.500" cy="16" r="0.800"/>',
  corazon: '<path d="M12 20s-8-5-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 9c0 6-8 11-8 11z"/>',
  billetera: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="16.500" cy="14.500" r="1"/>',
  tarjeta: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  telefono: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  efectivo: '<rect x="3" y="7" width="18" height="10" rx="1.500"/><circle cx="12" cy="12" r="2.500"/>',
  libro: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  bolsa: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  rayo: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  juego: '<rect x="3" y="8" width="18" height="10" rx="5"/><path d="M8 11v4M6 13h4M16 12h.01M18 14h.01"/>',
  etiqueta: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.500" cy="8.500" r="1"/>',
  puntos: '<circle cx="6" cy="12" r="1.200"/><circle cx="12" cy="12" r="1.200"/><circle cx="18" cy="12" r="1.200"/>',
}
const svg = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] ?? ICONOS.etiqueta}</svg>`
const UI = {
  mas: '<path d="M12 5v14M5 12h14"/>', editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.500 6.500 4 4"/>', subir: '<path d="m6 14 6-6 6 6"/>', bajar: '<path d="m6 10 6 6 6-6"/>',
  papelera: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', candado: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="m5 12 5 5 9-10"/>', cerrar: '<path d="m6 6 12 12M18 6 6 18"/>', buscar: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1"/><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
  flecha: '<path d="m9 6 6 6-6 6"/>', sol: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600l1.400 1.400M17 17l1.400 1.400M5.600 18.400 7 17M17 7l1.400-1.400"/>',
  luna: '<path d="M20 14.500A8 8 0 0 1 9.500 4 8 8 0 1 0 20 14.500z"/>', gota: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>', arrastrar: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
}
const ui = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI[n]}</svg>`

/* ---------- Datos de ejemplo (mismas formas que el catálogo real; nada de esto se persiste) ---------- */
const ICONOS_ELEGIBLES = ['casa', 'usuario', 'familia', 'maletin', 'comida', 'auto', 'corazon', 'billetera', 'libro', 'bolsa', 'rayo', 'juego', 'etiqueta']
const DATOS = {
  ambitos: [
    { id: 'a1', nombre: 'Hogar', icono: 'casa', color: '#4F46E5', activo: true, gastos: 412 },
    { id: 'a2', nombre: 'Personal', icono: 'usuario', color: '#0D9488', activo: true, gastos: 286 },
    { id: 'a3', nombre: 'Familia', icono: 'familia', color: '#EA580C', activo: true, gastos: 198 },
    { id: 'a4', nombre: 'Trabajo', icono: 'maletin', color: '#2563EB', activo: true, gastos: 64 },
    { id: 'a5', nombre: 'Otros', icono: 'puntos', color: '#64748B', activo: true, gastos: 21, fijoAlFinal: true },
  ],
  categorias: [
    { id: 'c1', ambito: 'a1', nombre: 'Servicios', icono: 'rayo', color: null, activo: true, gastos: 96, subs: ['Luz', 'Agua', 'Internet', 'Gas'] },
    { id: 'c2', ambito: 'a1', nombre: 'Alimentación', icono: 'comida', color: '#16A34A', activo: true, gastos: 188, subs: ['Mercado', 'Supermercado', 'Restaurantes'] },
    { id: 'c3', ambito: 'a1', nombre: 'Mantenimiento', icono: 'casa', color: null, activo: true, gastos: 14, subs: ['Reparaciones'] },
    { id: 'c4', ambito: 'a2', nombre: 'Ocio', icono: 'juego', color: '#7C3AED', activo: true, gastos: 74, subs: ['Streaming', 'Salidas', 'Hobbies'] },
    { id: 'c5', ambito: 'a2', nombre: 'Salud', icono: 'corazon', color: null, activo: true, gastos: 38, subs: ['Consultas', 'Farmacia'] },
    { id: 'c6', ambito: 'a3', nombre: 'Educación', icono: 'libro', color: '#DB2777', activo: true, gastos: 52, subs: ['Colegio', 'Útiles'] },
    { id: 'c7', ambito: 'a3', nombre: 'Transporte', icono: 'auto', color: null, activo: false, gastos: 0, subs: [] },
    { id: 'c8', ambito: 'a5', nombre: 'Otros', icono: 'puntos', color: null, activo: true, gastos: 21, subs: [], fijoAlFinal: true },
  ],
  medios: [
    { id: 'm1', nombre: 'Yape', icono: 'telefono', color: '#7E22CE', activo: true, gastos: 244 },
    { id: 'm2', nombre: 'Tarjeta de crédito', icono: 'tarjeta', color: '#2563EB', activo: true, gastos: 301 },
    { id: 'm3', nombre: 'Efectivo', icono: 'efectivo', color: '#059669', activo: true, gastos: 118 },
    { id: 'm4', nombre: 'Tarjeta de débito', icono: 'tarjeta', color: '#06B6D4', activo: true, gastos: 87 },
    { id: 'm5', nombre: 'Transferencia', icono: 'billetera', color: '#D97706', activo: false, gastos: 0 },
    { id: 'm6', nombre: 'Otros', icono: 'puntos', color: '#64748B', activo: true, gastos: 9, fijoAlFinal: true },
  ],
}
/** Color efectivo: el propio, o el heredado del ámbito padre (herencia solo diseñada: no hay columna que la guarde hoy). */
function colorEfectivo(item, tipo) {
  if (item.color) return { hex: item.color, origen: 'propio' }
  if (tipo === 'categoria') { const a = DATOS.ambitos.find((x) => x.id === item.ambito); return { hex: a.color, origen: 'heredado', de: a.nombre } }
  return { hex: '#64748B', origen: 'propio' }
}
const nombreColor = (hex) => COLORES.find((c) => c.hex.toLowerCase() === (hex || '').toLowerCase())?.nombre ?? 'Personalizado'
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/* ---------- Piezas comunes ---------- */
function insignia(item, tipo, extra = '') {
  const c = colorEfectivo(item, tipo)
  return `<span class="insignia ${extra}" style="${estiloColor(c.hex)}">${svg(item.icono)}</span>`
}
function eliminable(item, tipo) {
  if (item.fijoAlFinal) return { ok: false, motivo: 'Es el elemento «Otros»: siempre queda al final y no se elimina.' }
  const n = item.gastos ?? 0
  const hijos = tipo === 'categoria' ? item.subs.length : tipo === 'ambito' ? DATOS.categorias.filter((c) => c.ambito === item.id).length : 0
  if (n > 0) return { ok: false, motivo: `Tiene ${n} gastos asociados: solo se puede desactivar.` }
  if (hijos > 0) return { ok: false, motivo: `Contiene ${hijos} elementos: elimina o mueve su contenido primero.` }
  return { ok: true, motivo: 'Sin gastos asociados: se puede eliminar.' }
}
function botonesFila(item, tipo, i, total) {
  const el = eliminable(item, tipo)
  const finalFijo = item.fijoAlFinal
  return `
    <button class="btn-ico" data-accion="subir" aria-label="Subir ${esc(item.nombre)}" ${i === 0 || finalFijo ? 'disabled' : ''}>${ui('subir')}</button>
    <button class="btn-ico" data-accion="bajar" aria-label="Bajar ${esc(item.nombre)}" ${finalFijo || i >= total - 2 ? 'disabled' : ''}>${ui('bajar')}</button>
    <button class="btn-ico" data-accion="editar" aria-label="Editar ${esc(item.nombre)}">${ui('editar')}</button>
    <button class="btn-ico" data-accion="borrar" aria-label="Eliminar ${esc(item.nombre)}" title="${esc(el.motivo)}" ${el.ok ? '' : 'disabled'}>${ui('papelera')}</button>`
}
const interruptor = (activo, nombre, bloqueado) =>
  `<button class="sw" role="switch" aria-checked="${activo}" aria-label="${activo ? 'Desactivar' : 'Activar'} ${esc(nombre)}" ${bloqueado ? 'disabled' : ''}><span></span></button>`

/* ---------- Selector de color (normal + avanzado) y modal de crear/editar ---------- */
let estadoModal = null

function abrirModal({ tipo, item, onGuardar }) {
  const nuevo = !item
  const ambito = tipo === 'categoria' ? DATOS.ambitos.find((a) => a.id === (item?.ambito ?? 'a1')) : null
  estadoModal = {
    tipo, nuevo, nombre: item?.nombre ?? '', icono: item?.icono ?? 'etiqueta',
    modoColor: tipo === 'categoria' && !item?.color ? 'heredar' : 'propio',
    color: item?.color ?? (ambito ? ambito.color : '#4F46E5'), vista: 'paleta', ambito,
  }
  const fondo = document.createElement('div')
  fondo.className = 'overlay'
  fondo.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-titulo"></div>'
  document.body.appendChild(fondo)
  const modal = fondo.firstElementChild
  const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', teclas); document.removeEventListener('tema', pintar) }
  const teclas = (e) => { if (e.key === 'Escape') cerrar() }
  document.addEventListener('keydown', teclas)
  document.addEventListener('tema', pintar)

  const etiquetaTipo = { ambito: 'ámbito', categoria: 'categoría', medio: 'medio de pago' }[tipo]
  function pintar() {
    const s = estadoModal
    const efectivo = s.modoColor === 'heredar' ? s.ambito.color : s.color
    modal.innerHTML = `
      <header class="m-cab"><h2 id="m-titulo">${s.nuevo ? 'Nueva' : 'Editar'} ${etiquetaTipo === 'medio de pago' ? 'medio de pago' : etiquetaTipo}</h2><button class="btn-ico" data-cerrar aria-label="Cerrar">${ui('cerrar')}</button></header>
      <div class="m-cuerpo">
        <div class="m-form">
          <label class="campo"><span>Nombre</span><input id="m-nombre" value="${esc(s.nombre)}" maxlength="40" placeholder="Ej. ${tipo === 'ambito' ? 'Mascotas' : tipo === 'categoria' ? 'Suscripciones' : 'Billetera digital'}"></label>
          <div class="campo"><span>Ícono</span><div class="iconos" role="radiogroup" aria-label="Ícono">${ICONOS_ELEGIBLES.map((n) => `<button type="button" role="radio" aria-checked="${n === s.icono}" aria-label="${n}" data-icono="${n}">${svg(n)}</button>`).join('')}</div></div>
          ${s.vista === 'paleta' ? selectorNormal(s) : selectorAvanzado(s)}
        </div>
        <aside class="m-previa" aria-label="Vista previa">
          <h3>Vista previa</h3>
          ${['claro', 'oscuro'].map((t) => { const k = tonos(efectivo, t); return `<div class="previa ${t}"><div class="previa-fila"><span class="insignia" style="--k-soft:${k.soft};--k-borde:${k.borde};--k-icono:${k.icono}">${svg(s.icono)}</span><div><b style="color:${k.texto}">${esc(s.nombre || 'Nombre')}</b><small>${t === 'claro' ? 'Tema claro' : 'Tema oscuro'}</small></div><span class="pildora" style="background:${k.soft};border-color:${k.borde};color:${k.texto}">S/ 128.50</span></div></div>` }).join('')}
          ${s.modoColor === 'heredar' ? `<p class="nota">${ui('enlace')} Hereda el color de <b>${esc(s.ambito.nombre)}</b>. Si el ámbito cambia de color, esta categoría lo seguirá.</p>` : `<p class="nota">Color propio: <b>${nombreColor(s.color)}</b> <code>${s.color.toUpperCase()}</code></p>`}
        </aside>
      </div>
      <footer class="m-pie"><button class="btn" data-cerrar>Cancelar</button><button class="btn btn-pri" data-guardar ${s.nombre.trim() ? '' : 'disabled'}>Guardar</button></footer>`
    enlazar()
  }

  function selectorNormal(s) {
    const heredable = s.tipo === 'categoria'
    return `
      <div class="campo"><span>Color</span>
        ${heredable ? `<div class="segmento" role="radiogroup" aria-label="Origen del color">
          <button type="button" role="radio" aria-checked="${s.modoColor === 'heredar'}" data-modo="heredar">${ui('enlace')} Heredar de ${esc(s.ambito.nombre)}</button>
          <button type="button" role="radio" aria-checked="${s.modoColor === 'propio'}" data-modo="propio">${ui('gota')} Color propio</button></div>` : ''}
        <div class="paleta ${s.modoColor === 'heredar' ? 'inactiva' : ''}" role="radiogroup" aria-label="Paleta de colores">
          ${COLORES.map((c) => { const t = tonos(c.hex, temaActual()); const sel = s.modoColor === 'propio' && s.color.toLowerCase() === c.hex.toLowerCase(); return `<button type="button" role="radio" class="muestra" aria-checked="${sel}" aria-label="${c.nombre} ${c.hex}" title="${c.nombre} · ${c.hex}" data-color="${c.hex}" ${s.modoColor === 'heredar' ? 'tabindex="-1"' : ''} style="--k-base:${c.hex};--k-soft:${t.soft};--k-borde:${t.borde}"><i>${sel ? ui('check') : ''}</i></button>` }).join('')}
        </div>
        <button type="button" class="enlace" data-avanzado>${ui('gota')} Color personalizado (HEX / RGB)…</button>
        ${s.modoColor === 'propio' && !COLORES.some((c) => c.hex.toLowerCase() === s.color.toLowerCase()) ? `<p class="nota">Color personalizado activo: <code>${s.color.toUpperCase()}</code></p>` : ''}
      </div>`
  }

  function selectorAvanzado(s) {
    const rgb = hexARgb(s.color) ?? [91, 91, 214]
    const [h, sat, v] = rgbAHsv(rgb)
    const k = tonos(s.color, temaActual())
    const okTexto = k.cTexto >= 4.5, okIcono = k.cIcono >= 3
    return `
      <div class="campo avanzado"><span>Color personalizado</span>
        <div class="picker">
          <div class="sv" id="sv" role="slider" tabindex="0" aria-label="Saturación y brillo" aria-valuetext="Saturación ${Math.round(sat * 100)}%, brillo ${Math.round(v * 100)}%" style="--h:${h}"><i style="left:${sat * 100}%;top:${(1 - v) * 100}%"></i></div>
          <input id="hue" class="hue" type="range" min="0" max="360" value="${Math.round(h)}" aria-label="Tono">
        </div>
        <div class="entradas">
          <label class="campo mini"><span>HEX</span><input id="hex" value="${s.color.toUpperCase()}" maxlength="7" spellcheck="false" aria-describedby="hex-err"></label>
          ${['R', 'G', 'B'].map((l, i) => `<label class="campo mini num"><span>${l}</span><input id="rgb-${l}" type="number" min="0" max="255" value="${Math.round(rgb[i])}"></label>`).join('')}
        </div>
        <p id="hex-err" class="error" role="alert" hidden>Usa 6 dígitos hexadecimales, por ejemplo #5B5BD6.</p>
        <p class="nota">Ejemplo: <code>#5B5BD6</code> ↔ <code>91, 91, 214</code>. Los tres campos se mantienen sincronizados.</p>
        <div class="contraste" aria-live="polite">
          <div class="c-fila"><span class="c-badge ${okTexto ? 'ok' : 'mal'}">${okTexto ? 'Cumple' : 'No cumple'}</span><span>Texto sobre fondo suave (claro): <b class="num">${k.cTexto.toFixed(1)}:1</b> · mínimo 4.5:1</span></div>
          <div class="c-fila"><span class="c-badge ${okIcono ? 'ok' : 'mal'}">${okIcono ? 'Cumple' : 'No cumple'}</span><span>Ícono sobre superficie: <b class="num">${k.cIcono.toFixed(1)}:1</b> · mínimo 3:1</span></div>
          <p class="nota">El texto y el ícono se ajustan automáticamente para llegar al contraste mínimo; el color base se conserva en bordes y muestras.</p>
        </div>
        <div class="fila-btn"><button type="button" class="btn" data-paleta>← Volver a la paleta</button><button type="button" class="btn btn-pri" data-usar>Usar este color</button></div>
      </div>`
  }

  function enlazar() {
    const s = estadoModal
    modal.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar))
    modal.querySelector('#m-nombre').addEventListener('input', (e) => { s.nombre = e.target.value; modal.querySelector('[data-guardar]').disabled = !s.nombre.trim(); actualizarPrevia() })
    modal.querySelectorAll('[data-icono]').forEach((b) => b.addEventListener('click', () => { s.icono = b.dataset.icono; pintar() }))
    modal.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => { s.modoColor = b.dataset.modo; pintar() }))
    modal.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => { s.color = b.dataset.color; s.modoColor = 'propio'; pintar() }))
    modal.querySelector('[data-avanzado]')?.addEventListener('click', () => { s.vista = 'avanzado'; s.modoColor = 'propio'; pintar(); modal.querySelector('#sv')?.focus() })
    modal.querySelector('[data-paleta]')?.addEventListener('click', () => { s.vista = 'paleta'; pintar() })
    modal.querySelector('[data-usar]')?.addEventListener('click', () => { s.vista = 'paleta'; pintar() })
    modal.querySelector('[data-guardar]').addEventListener('click', () => { onGuardar?.({ ...s, color: s.modoColor === 'heredar' ? null : s.color }); cerrar() })
    if (s.vista === 'avanzado') enlazarPicker()
  }
  function actualizarPrevia() {
    const s = estadoModal
    modal.querySelectorAll('.previa b').forEach((b) => (b.textContent = s.nombre || 'Nombre'))
  }
  function enlazarPicker() {
    const s = estadoModal
    const err = modal.querySelector('#hex-err')
    const aplicar = (rgb, { conservarTono } = {}) => { s.color = rgbAHex(rgb); err.hidden = true; const h = conservarTono ?? null; pintar(); if (h !== null) { modal.querySelector('#hue').value = h; modal.querySelector('#sv').style.setProperty('--h', h) } }
    const sv = modal.querySelector('#sv')
    const mover = (e) => {
      const r = sv.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
      const h = Number(modal.querySelector('#hue').value)
      aplicar(hsvARgb([h, x, 1 - y]), { conservarTono: h }); modal.querySelector('#sv').focus()
    }
    sv.addEventListener('pointerdown', (e) => { sv.setPointerCapture(e.pointerId); mover(e); const m = (ev) => mover(ev); const u = () => { document.removeEventListener('pointermove', m); document.removeEventListener('pointerup', u) }; document.addEventListener('pointermove', m); document.addEventListener('pointerup', u) })
    sv.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] }[e.key]
      if (!d) return
      e.preventDefault()
      const [h, sa, v] = rgbAHsv(hexARgb(s.color))
      const hh = Number(modal.querySelector('#hue').value)
      aplicar(hsvARgb([hh, Math.min(1, Math.max(0, sa + d[0])), Math.min(1, Math.max(0, v + d[1]))]), { conservarTono: hh }); modal.querySelector('#sv').focus()
    })
    modal.querySelector('#hue').addEventListener('input', (e) => { const [, sa, v] = rgbAHsv(hexARgb(s.color)); aplicar(hsvARgb([Number(e.target.value), sa || 0.6, v || 0.8]), { conservarTono: Number(e.target.value) }); modal.querySelector('#hue').focus() })
    modal.querySelector('#hex').addEventListener('input', (e) => {
      let t = e.target.value.trim(); if (t && t[0] !== '#') t = '#' + t
      const rgb = hexARgb(t)
      if (rgb) { s.color = rgbAHex(rgb); err.hidden = true; refrescarSinReemplazar('hex') } else { err.hidden = false; e.target.setAttribute('aria-invalid', 'true') }
    })
    ;['R', 'G', 'B'].forEach((l, i) => modal.querySelector(`#rgb-${l}`).addEventListener('input', (e) => {
      const rgb = hexARgb(s.color) ?? [0, 0, 0]
      const n = Number(e.target.value)
      if (Number.isNaN(n) || n < 0 || n > 255) { err.textContent = 'Cada canal RGB va de 0 a 255.'; err.hidden = false; return }
      rgb[i] = n; s.color = rgbAHex(rgb); err.hidden = true; refrescarSinReemplazar(`rgb-${l}`)
    }))
  }
  /** Re-pinta conservando el foco en el campo que se está escribiendo. */
  function refrescarSinReemplazar(idActivo) {
    const pos = modal.querySelector(`#${idActivo}`)?.selectionStart
    pintar()
    const el = modal.querySelector(`#${idActivo}`)
    if (el) { el.focus(); try { el.setSelectionRange(pos, pos) } catch { /* number */ } }
  }
  pintar()
  modal.querySelector('#m-nombre').focus()
}

/* ---------- Barra común (tema + marca de prototipo) ---------- */
function barraPrototipo(titulo) {
  const b = document.createElement('div')
  b.className = 'barra-proto'
  b.innerHTML = `<span><b>PROTOTIPO · ${esc(titulo)}</b> · Solo diseño, datos de ejemplo. No guarda nada.</span>
    <span class="barra-acc"><a href="indice.html">Todas las propuestas</a><button class="btn" id="tema-btn" aria-label="Cambiar tema"></button></span>`
  document.body.prepend(b)
  const btn = b.querySelector('#tema-btn')
  const pintarBtn = () => { btn.innerHTML = temaActual() === 'claro' ? `${ui('luna')} Oscuro` : `${ui('sol')} Claro` }
  btn.addEventListener('click', () => fijarTema(temaActual() === 'claro' ? 'oscuro' : 'claro'))
  document.addEventListener('tema', pintarBtn)
  pintarBtn()
}
const param = (k) => new URLSearchParams(location.search).get(k)
if (param('tema') === 'oscuro') fijarTema('oscuro')

/* ---------- Estructura de la aplicación (barra lateral) para dar contexto a los prototipos ---------- */
function marcoApp(titulo, descripcion, accionHtml) {
  const nav = [['Dashboard', 'casa'], ['Gastos', 'billetera'], ['Fondos', 'tarjeta'], ['Catálogo', 'etiqueta'], ['Salud financiera', 'corazon'], ['Configuración', 'puntos']]
  document.body.insertAdjacentHTML('beforeend', `
    <div class="app">
      <aside class="lateral"><div class="marca"><span class="logo">G</span><b>Gasto Deejota</b></div>
        <nav aria-label="Principal">${nav.map(([n, i]) => `<a href="#" ${n === 'Catálogo' ? 'aria-current="page"' : ''}>${svg(i)} ${n}</a>`).join('')}</nav>
        <div class="usuario"><b>Usuario E2E</b><small>e2e@gastodeejota.local</small></div></aside>
      <main class="contenido" id="contenido"><header class="cab-pagina"><div><h1>${esc(titulo)}</h1><p>${esc(descripcion)}</p></div><div>${accionHtml ?? ''}</div></header><div id="vista"></div></main>
    </div>`)
}

/* ---------- Acciones comunes (editar, ordenar, activar, eliminar) sobre los datos de ejemplo ---------- */
function listaDe(tipo) { return tipo === 'ambito' ? DATOS.ambitos : tipo === 'categoria' ? DATOS.categorias : DATOS.medios }
function manejarAcciones(raiz, redibujar) {
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion], .sw, [data-nuevo]')
    if (!b || b.disabled) return
    if (b.dataset.nuevo) { abrirModal({ tipo: b.dataset.nuevo, onGuardar: (r) => { listaDe(r.tipo).splice(listaDe(r.tipo).length - 1, 0, { id: 'n' + Date.now(), nombre: r.nombre, icono: r.icono, color: r.color, activo: true, gastos: 0, subs: [], ambito: 'a1' }); redibujar() } }); return }
    const fila = b.closest('[data-id]')
    const id = fila?.dataset.id, tipo = fila?.dataset.tipo
    if (!id) return
    const lista = listaDe(tipo), i = lista.findIndex((x) => x.id === id)
    if (b.classList.contains('sw')) { lista[i].activo = !lista[i].activo; redibujar(); return }
    const a = b.dataset.accion
    if (a === 'editar') abrirModal({ tipo, item: lista[i], onGuardar: (r) => { Object.assign(lista[i], { nombre: r.nombre, icono: r.icono, color: r.color }); redibujar() } })
    if (a === 'subir' && i > 0) { [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]]; redibujar() }
    if (a === 'bajar' && i < lista.length - 2) { [lista[i + 1], lista[i]] = [lista[i], lista[i + 1]]; redibujar() }
    if (a === 'borrar' && eliminable(lista[i], tipo).ok) { lista.splice(i, 1); redibujar() }
  })
}
const NOMBRE_VISTA = { ambitos: 'Ámbitos', categorias: 'Categorías y subcategorías', medios: 'Medios de pago' }
function pestanas(actual) {
  return `<div class="tabs" role="tablist" aria-label="Secciones del catálogo">${Object.entries(NOMBRE_VISTA).map(([k, n]) => `<button role="tab" aria-selected="${k === actual}" data-vista="${k}">${n}</button>`).join('')}</div>`
}
