import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Exclusión mutua entre corridas E2E contra la misma base. La preparación y la limpieza globales crean y borran funciones `dev_*` y reinician al
 * mismo usuario de pruebas: dos corridas a la vez se pisarían y producirían fallos que no son de la aplicación. El bloqueo es un archivo en el
 * directorio temporal del sistema con el nombre de la base, así lo respetan también otras copias del proyecto que apunten al mismo contenedor.
 *
 * Si una corrida muere sin liberar (cierre forzado), su bloqueo queda «huérfano»: el proceso dueño ya no existe o es demasiado antiguo, y la
 * siguiente corrida lo recupera (y limpia los restos que dejó) en vez de quedarse bloqueada para siempre.
 */
export interface Bloqueo {
  pid: number
  inicio: number
  contenedor: string
}

export type ResultadoBloqueo =
  | { estado: 'adquirido' }
  | { estado: 'recuperado'; anterior: Bloqueo | null }
  | { estado: 'ocupado'; dueno: Bloqueo }

/** Una corrida legítima dura minutos; pasado este tiempo se asume que el bloqueo quedó olvidado aunque el PID exista (PID reutilizado). */
export const EDAD_MAXIMA_MS = 2 * 60 * 60 * 1000

export const rutaBloqueo = (contenedor: string, dir: string = tmpdir()) => join(dir, `gd-e2e-${contenedor.replace(/[^\w.-]/g, '_')}.lock`)

export function procesoVivo(pid: number, enviar: (pid: number, senal: 0) => unknown = (p, s) => process.kill(p, s)): boolean {
  try {
    enviar(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM' // existe pero no es nuestro
  }
}

function leer(ruta: string): Bloqueo | null {
  try {
    const b = JSON.parse(readFileSync(ruta, 'utf8')) as Bloqueo
    return typeof b.pid === 'number' && typeof b.inicio === 'number' ? b : null
  } catch {
    return null
  }
}

export interface Opciones {
  pid?: number
  ahora?: number
  vivo?: (pid: number) => boolean
}

/** Toma el bloqueo de forma atómica (creación exclusiva). Devuelve «ocupado» si otra corrida viva lo tiene. */
export function adquirirBloqueo(ruta: string, contenedor: string, op: Opciones = {}): ResultadoBloqueo {
  const pid = op.pid ?? process.pid
  const ahora = op.ahora ?? Date.now()
  const vivo = op.vivo ?? procesoVivo
  const propio: Bloqueo = { pid, inicio: ahora, contenedor }
  let recuperado: Bloqueo | null | undefined

  for (let intento = 0; intento < 3; intento++) {
    try {
      writeFileSync(ruta, JSON.stringify(propio), { flag: 'wx' })
      return recuperado === undefined ? { estado: 'adquirido' } : { estado: 'recuperado', anterior: recuperado }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
    }
    const dueno = leer(ruta)
    if (dueno && dueno.pid !== pid && vivo(dueno.pid) && ahora - dueno.inicio < EDAD_MAXIMA_MS) return { estado: 'ocupado', dueno }
    // Huérfano (dueño muerto, demasiado antiguo o archivo ilegible): se retira y se reintenta la creación exclusiva.
    recuperado = dueno
    rmSync(ruta, { force: true })
  }
  const dueno = leer(ruta)
  if (dueno) return { estado: 'ocupado', dueno }
  throw new Error(`No se pudo adquirir el bloqueo E2E en ${ruta}`)
}

/** Libera solo si el bloqueo es de este proceso: nunca se borra el de otra corrida. */
export function liberarBloqueo(ruta: string, pid: number = process.pid): boolean {
  const dueno = leer(ruta)
  if (!dueno || dueno.pid !== pid) return false
  rmSync(ruta, { force: true })
  return true
}

/** ¿Este proceso es el dueño vigente del bloqueo? Solo el dueño puede limpiar la base: una corrida que abortó por «ocupado» no debe tocar nada. */
export function esDueno(ruta: string, pid: number = process.pid): boolean {
  return leer(ruta)?.pid === pid
}
