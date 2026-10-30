import { type Page } from '@playwright/test'

const URL_API = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const CLAVE = process.env.VITE_SUPABASE_ANON_KEY ?? ''

/** Token de la sesión activa del navegador (para verificar el estado real del backend desde la prueba). */
export async function tokenDe(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (/^sb-.*-auth-token$/.test(k)) return JSON.parse(localStorage.getItem(k)!).access_token as string
    }
    return null
  })
  if (!token) throw new Error('No hay sesión en el navegador')
  return token
}

export async function rest<T = unknown>(page: Page, ruta: string): Promise<T> {
  const r = await page.request.get(`${URL_API}/rest/v1/${ruta}`, { headers: { apikey: CLAVE, Authorization: `Bearer ${await tokenDe(page)}` } })
  if (!r.ok()) throw new Error(`REST ${ruta}: ${r.status()}`)
  return (await r.json()) as T
}

/** ¿Existe el comprobante en el bucket privado? (con la sesión del usuario) */
export async function existeComprobante(page: Page, ruta: string): Promise<boolean> {
  const r = await page.request.get(`${URL_API}/storage/v1/object/authenticated/comprobantes/${ruta}`, {
    headers: { apikey: CLAVE, Authorization: `Bearer ${await tokenDe(page)}` },
  })
  return r.status() === 200
}

export const PDF = (nombre: string) => ({ name: nombre, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n% ${nombre}\n%%EOF`) })
