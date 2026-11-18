export interface ReglaSugerencia { kind: 'ambito' | 'categoria' | 'subcategoria'; ref: string; effect: 'include' | 'exclude' }
export interface MedioSugerencia { method: string; effect: 'include' | 'exclude' }
export type ContextoDescripcion =
  | { tipo: 'expense'; ambito_id: string; categoria_id: string; subcategoria_id: string }
  | { tipo: 'fund'; is_general: boolean; scope_rules: ReglaSugerencia[]; payment_rules: MedioSugerencia[]; listo: boolean }

/** El orden visual de las reglas no cambia la clave de caché. La equivalencia
 * efectiva (incluidas reglas redundantes) la resuelve PostgreSQL. */
export function claveContexto(contexto: ContextoDescripcion): string {
  if (contexto.tipo === 'expense') return JSON.stringify(contexto)
  const ordenar = <T,>(lista: T[]) => [...lista].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return JSON.stringify({ ...contexto, scope_rules: ordenar(contexto.scope_rules), payment_rules: ordenar(contexto.payment_rules) })
}

export function normalizarDescripcion(texto: string): string {
  return texto.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase().replace(/[áéíóúü]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' })[c]!)
}
