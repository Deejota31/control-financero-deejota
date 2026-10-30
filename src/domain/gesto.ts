/** Reglas del deslizamiento lateral que revela las acciones de una fila (sin DOM: se prueban solas). */

/** Desplazamiento (px) a partir del cual se decide el eje del gesto. */
export const UMBRAL_INTENCION = 10
/** Desplazamiento horizontal (px) que hay que completar para abrir o cerrar el panel. */
export const UMBRAL_APERTURA = 56
/** El movimiento lateral debe superar al vertical en esta proporción para contar como horizontal. */
export const RAZON_HORIZONTAL = 1.6
/** Hasta dónde acompaña la tarjeta al dedo (px). */
export const ARRASTRE_MAXIMO = 72

export type Eje = 'pendiente' | 'horizontal' | 'vertical'

/** Decide si el gesto es horizontal, vertical (se deja al desplazamiento nativo) o todavía no hay intención clara. */
export function clasificarEje(dx: number, dy: number): Eje {
  const ax = Math.abs(dx), ay = Math.abs(dy)
  if (ay >= UMBRAL_INTENCION && ax <= RAZON_HORIZONTAL * ay) return 'vertical'
  if (ax >= UMBRAL_INTENCION && ax > RAZON_HORIZONTAL * ay) return 'horizontal'
  return 'pendiente'
}

export type Resultado = 'abrir' | 'cerrar' | 'mantener'

/** Qué hacer al soltar: abrir con un deslizamiento completo a la izquierda, cerrar con uno a la derecha; si no, volver a donde estaba. */
export function resolverGesto(dx: number, abierto: boolean): Resultado {
  if (!abierto && dx <= -UMBRAL_APERTURA) return 'abrir'
  if (abierto && dx >= UMBRAL_APERTURA) return 'cerrar'
  return 'mantener'
}

/** Cuánto se desplaza visualmente la tarjeta durante el gesto: solo hacia la izquierda y con resistencia creciente. */
export function arrastreVisible(dx: number, abierto: boolean): number {
  if (abierto) return 0 // abierta, la tarjeta no se mueve: el estado lo comunica el panel
  if (dx >= 0) return 0
  const t = Math.min(-dx, ARRASTRE_MAXIMO * 3)
  return -Math.round(ARRASTRE_MAXIMO * (1 - Math.exp(-t / ARRASTRE_MAXIMO)) * 1.2)
}

const INTERACTIVOS = 'input, select, textarea, a[href], button, label, summary, [role="button"], [role="checkbox"], [role="combobox"], [role="slider"], [role="switch"], [contenteditable="true"], [data-sin-gesto]'

/**
 * ¿Puede empezar un gesto en este elemento? No sobre controles (casillas, campos, fechas, selectores, enlaces, chips, asas de orden).
 * Un contenedor puede declarar `data-gesto-ok` para permitirlo sobre su botón principal (p. ej. el cuerpo seleccionable de una fila).
 */
export function puedeIniciarGesto(destino: Element | null, raiz: Element): boolean {
  let el: Element | null = destino
  while (el && el !== raiz) {
    if (el.hasAttribute('data-sin-gesto')) return false
    if (el.matches(INTERACTIVOS)) return el.hasAttribute('data-gesto-ok')
    el = el.parentElement
  }
  return true
}
