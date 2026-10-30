import { adquirirBloqueo, liberarBloqueo, rutaBloqueo } from './bloqueo'
import { CONTENEDOR, cargarFixtures, reiniciarUsuarioE2E, retirarFixtures } from './db'

declare global {
  // Marca compartida con el teardown: la limpieza ya se hizo y no hay que repetirla al salir.
  var __gdE2ELimpio: boolean | undefined
}

/** Limpia sin lanzar errores: se usa al interrumpirse una corrida o al recuperar los restos de otra muerta. */
function limpiarSeguro() {
  try {
    retirarFixtures()
  } catch {
    /* ya estaba limpio o las funciones no existen */
  }
}

/**
 * Antes de tocar la base se toma el bloqueo exclusivo de la corrida. Con otra corrida viva se aborta con un mensaje claro (sus datos no se tocan);
 * si el dueño anterior murió sin limpiar, se recuperan sus restos. Si esta corrida se interrumpe (Ctrl+C, cierre normal del proceso), libera el
 * bloqueo y deja la base limpia; ante un cierre forzado queda un bloqueo huérfano que la siguiente corrida recupera.
 */
export default function globalSetup() {
  const ruta = rutaBloqueo(CONTENEDOR)
  const r = adquirirBloqueo(ruta, CONTENEDOR)
  if (r.estado === 'ocupado') {
    throw new Error(
      `Otra corrida E2E (pid ${r.dueno.pid}, iniciada ${new Date(r.dueno.inicio).toLocaleString('es-PE')}) está usando la base «${CONTENEDOR}». ` +
        'Espera a que termine o usa otra instancia con SUPABASE_DB_CONTAINER. No se ha tocado ningún dato.',
    )
  }
  globalThis.__gdE2ELimpio = false
  if (r.estado === 'recuperado') limpiarSeguro() // restos de una corrida que murió sin limpiar

  const alSalir = () => {
    if (!globalThis.__gdE2ELimpio) limpiarSeguro()
    liberarBloqueo(ruta)
  }
  process.once('exit', alSalir)
  for (const senal of ['SIGINT', 'SIGTERM'] as const) process.once(senal, () => process.exit(130))

  try {
    cargarFixtures()
    reiniciarUsuarioE2E()
  } catch (e) {
    limpiarSeguro()
    globalThis.__gdE2ELimpio = true
    liberarBloqueo(ruta)
    throw e
  }
}
