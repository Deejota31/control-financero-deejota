import { esDueno, liberarBloqueo, rutaBloqueo } from './bloqueo'
import { CONTENEDOR, retirarFixtures } from './db'

/**
 * Al terminar, la base queda sin usuario ni datos de prueba y sin las funciones de fixtures, y se libera el bloqueo de la corrida.
 * Solo lo hace la corrida dueña del bloqueo: si esta corrida abortó porque otra estaba activa, no toca nada (borraría sus datos y funciones).
 */
export default function globalTeardown() {
  const ruta = rutaBloqueo(CONTENEDOR)
  if (!esDueno(ruta)) return
  try {
    retirarFixtures()
    globalThis.__gdE2ELimpio = true
  } finally {
    liberarBloqueo(ruta)
  }
}
