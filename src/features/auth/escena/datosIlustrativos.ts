/**
 * DATOS ILUSTRATIVOS de la pantalla de acceso.
 * Son decorativos y conceptuales: no vienen de la base de datos, no pertenecen a nadie y la pantalla no consulta nada antes de iniciar sesión.
 * Todo lo que se dibuja en las tarjetas flotantes sale de este archivo (nunca de Supabase).
 */
export const ILUSTRATIVO = {
  presupuesto: { total: 1250, usado: 900, disponible: 350, porcentaje: 72 },
  fondosActivos: 3,
  /** Distribución por categoría (suma 100). */
  categorias: [
    { nombre: 'Hogar', pct: 38, color: 'var(--aur-violeta)' },
    { nombre: 'Alimentos', pct: 24, color: 'var(--aur-lavanda)' },
    { nombre: 'Transporte', pct: 18, color: 'var(--aur-electrico)' },
    { nombre: 'Ocio', pct: 12, color: 'var(--aur-hielo)' },
    { nombre: 'Otros', pct: 8, color: 'var(--aur-nube)' },
  ],
  /** Tendencia de gastos de seis meses; `destacado` es el índice del punto con su globo. */
  tendencia: { meses: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'], valores: [180, 250, 205, 420, 330, 445], destacado: 3 },
} as const

export const soles = (n: number) => `S/ ${n.toLocaleString('en-US')}`

/** Segmentos de una dona de circunferencia 100 (r = 15.9155): longitud y desplazamiento de cada uno, con un pequeño hueco entre ellos. */
export function segmentosDona(partes: readonly { pct: number }[], hueco = 1.4) {
  let acumulado = 0
  return partes.map((p) => {
    const segmento = { largo: Math.max(p.pct - hueco, 0.1), desplazamiento: -acumulado }
    acumulado += p.pct
    return segmento
  })
}

/** Puntos (x, y) de una serie dentro de un lienzo `ancho × alto` con márgenes; el máximo queda arriba. */
export function puntosSerie(valores: readonly number[], ancho: number, alto: number, margen = { x: 8, arriba: 10, abajo: 8 }) {
  const max = Math.max(...valores), min = Math.min(...valores)
  const paso = (ancho - margen.x * 2) / (valores.length - 1)
  return valores.map((v, i) => ({ x: margen.x + i * paso, y: margen.arriba + (1 - (v - min) / (max - min || 1)) * (alto - margen.arriba - margen.abajo) }))
}

/** Curva suave (Bézier cúbica con puntos de control a medio camino) que pasa por todos los puntos. */
export function rutaSuave(p: readonly { x: number; y: number }[]) {
  return p.reduce((d, pt, i) => {
    if (i === 0) return `M${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
    const a = p[i - 1], cx = (a.x + pt.x) / 2
    return `${d} C${cx.toFixed(1)} ${a.y.toFixed(1)} ${cx.toFixed(1)} ${pt.y.toFixed(1)} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
  }, '')
}
