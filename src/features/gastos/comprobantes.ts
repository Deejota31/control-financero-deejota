import { supabase } from '@/lib/supabase'

const BUCKET = 'comprobantes'
const COLA_LOCAL = 'gd-limpieza-pendiente'

type Razon = 'intencion' | 'compensacion' | 'reemplazo'

function leerCola(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COLA_LOCAL) ?? '[]') as string[]
  } catch {
    return []
  }
}
function guardarCola(paths: string[]) {
  try {
    localStorage.setItem(COLA_LOCAL, JSON.stringify([...new Set(paths)]))
  } catch {
    /* sin almacenamiento: no hay más respaldo posible */
  }
}

/** Registra en el servidor una tarea de limpieza. Si ni eso es posible (sin red), queda en una cola local. */
export async function registrarLimpieza(paths: string[], razon: Razon, demoraMin = 0): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('registrar_limpieza', { p_paths: paths, p_reason: razon, p_demora_min: demoraMin })
    if (error) throw error
    return true
  } catch {
    if (razon !== 'intencion') guardarCola([...leerCola(), ...paths])
    return false
  }
}

/**
 * Elimina un archivo recién subido o reemplazado. Si el borrado falla, deja una tarea de limpieza reintentable.
 * Devuelve true si el archivo se eliminó en el acto.
 */
export async function borrarArchivo(path: string, razon: Exclude<Razon, 'intencion'> = 'compensacion'): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (error) throw error
    return true
  } catch {
    await registrarLimpieza([path], razon)
    return false
  }
}

/**
 * Reintenta las limpiezas pendientes: primero vuelca la cola local al servidor y después borra lo que el servidor
 * declara huérfano (nunca archivos asociados a un gasto: el servidor los descarta).
 */
export async function procesarLimpieza(): Promise<{ borrados: number; fallidos: number }> {
  const local = leerCola()
  if (local.length > 0) {
    try {
      const { error } = await supabase.rpc('registrar_limpieza', { p_paths: local, p_reason: 'compensacion', p_demora_min: 0 })
      if (!error) guardarCola([])
    } catch {
      /* se reintentará en la próxima sesión */
    }
  }
  const { data, error } = await supabase.rpc('listar_limpieza')
  if (error || !data || data.length === 0) return { borrados: 0, fallidos: 0 }

  const hechos: string[] = []
  const fallos: string[] = []
  let ultimoError = ''
  for (const t of data) {
    try {
      const r = await supabase.storage.from(BUCKET).remove([t.path])
      if (r.error) throw r.error
      hechos.push(t.id)
    } catch (e) {
      fallos.push(t.id)
      ultimoError = e instanceof Error ? e.message : 'error al borrar'
    }
  }
  if (hechos.length) await supabase.rpc('completar_limpieza', { p_ids: hechos })
  if (fallos.length) await supabase.rpc('fallo_limpieza', { p_ids: fallos, p_error: ultimoError })
  return { borrados: hechos.length, fallidos: fallos.length }
}
