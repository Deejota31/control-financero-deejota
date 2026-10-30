/**
 * Resumen legible de lo que cubre un fondo, calculado a partir de sus reglas reales (clasificación y medios de pago). No contiene nombres ni
 * categorías fijos: todo sale de las reglas y del catálogo. Es solo presentación; el motor de asignación no usa este resumen.
 */
export type Efecto = 'include' | 'exclude'

export interface EtiquetaCobertura {
  texto: string
  efecto: Efecto
  tipo: 'clasificacion' | 'medio' | 'general'
}

export interface Cobertura {
  /** Todas las etiquetas, incluidas primero y excluidas después. */
  etiquetas: EtiquetaCobertura[]
  /** El fondo no tiene ninguna regla (y no es un Fondo General). */
  sinReglas: boolean
}

export interface ReglaAlcance {
  ambito_id: string | null
  categoria_id: string | null
  subcategoria_id: string | null
  effect: string
}
export interface ReglaMedio {
  payment_method_id: string
  effect: string
}

export interface NombresCatalogo {
  ambito: Map<string, string>
  categoria: Map<string, string>
  subcategoria: Map<string, string>
  medio: Map<string, string>
}

const efecto = (e: string): Efecto => (e === 'exclude' ? 'exclude' : 'include')

/**
 * - Con inclusiones (de clasificación o de medio) se listan esas; nunca se muestra «cobertura general» si el fondo tiene restricciones específicas.
 * - El Fondo General sin inclusiones se muestra como «Cobertura general» (más sus exclusiones, si las tiene).
 * - Los nombres repetidos (la misma categoría en varios ámbitos) se muestran una sola vez.
 */
export function resumirCobertura(esGeneral: boolean, alcance: ReglaAlcance[], medios: ReglaMedio[], nombres: NombresCatalogo): Cobertura {
  const vistos = new Set<string>()
  const incluidas: EtiquetaCobertura[] = []
  const excluidas: EtiquetaCobertura[] = []
  const agregar = (texto: string | undefined, e: Efecto, tipo: EtiquetaCobertura['tipo']) => {
    if (!texto) return
    const clave = `${e}|${tipo}|${texto.trim().toLowerCase()}`
    if (vistos.has(clave)) return
    vistos.add(clave)
    ;(e === 'include' ? incluidas : excluidas).push({ texto: texto.trim(), efecto: e, tipo })
  }

  for (const r of alcance) {
    const nombre = r.subcategoria_id ? nombres.subcategoria.get(r.subcategoria_id) : r.categoria_id ? nombres.categoria.get(r.categoria_id) : r.ambito_id ? nombres.ambito.get(r.ambito_id) : undefined
    agregar(nombre, efecto(r.effect), 'clasificacion')
  }
  for (const m of medios) agregar(nombres.medio.get(m.payment_method_id), efecto(m.effect), 'medio')

  if (esGeneral && incluidas.length === 0) incluidas.push({ texto: 'Cobertura general', efecto: 'include', tipo: 'general' })
  const etiquetas = [...incluidas, ...excluidas]
  return { etiquetas, sinReglas: !esGeneral && etiquetas.length === 0 }
}
