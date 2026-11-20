/** Tipo real de un archivo según sus primeros bytes (no el declarado por el navegador). */
export function tipoPorContenido(b: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | null {
  const es = (inicio: number, ...v: number[]) => v.every((x, i) => b[inicio + i] === x)
  if (es(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (es(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (es(0, 0x52, 0x49, 0x46, 0x46) && es(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'
  if (es(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf'
  return null
}

/** Lee la cabecera del archivo y devuelve su tipo real, o null si no es JPG, PNG, WebP ni PDF. */
export async function tipoRealDeArchivo(f: Blob): Promise<ReturnType<typeof tipoPorContenido>> {
  return tipoPorContenido(new Uint8Array(await f.slice(0, 16).arrayBuffer()))
}
