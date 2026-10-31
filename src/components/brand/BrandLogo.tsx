import { useId } from 'react'
import { cn } from '@/lib/cn'
import { MARCA } from '@/lib/marca'

/**
 * Isotipo de Control Financiero: una «C» abierta (el aro de control) cruzada por una línea de progreso que sale por su abertura.
 * Geometría simple de trazos gruesos para que se lea desde 16 px. Los colores salen de los tokens del tema, así el logo funciona
 * en claro y oscuro sin versiones aparte: fondo = `--pri`, trazo = `--pri-fg`.
 */
export type TonoLogo = 'color' | 'aurora' | 'mono'
export type VarianteLogo = 'completo' | 'compacto' | 'isotipo'

const COLORES: Record<TonoLogo, { fondo: string; trazo: string }> = {
  color: { fondo: 'var(--pri)', trazo: 'var(--pri-fg)' }, // sobre superficies normales
  aurora: { fondo: 'url(#aurora)', trazo: '#ffffff' }, // azulejo violeta degradado de la pantalla de acceso (el id se sustituye por uno único)
  mono: { fondo: 'transparent', trazo: 'currentColor' }, // una sola tinta: hereda el color del texto
}

export function Isotipo({ tono = 'color', tamano = 32, titulo, className }: { tono?: TonoLogo; tamano?: number; titulo?: string; className?: string }) {
  const c = COLORES[tono]
  const gid = useId()
  const fondo = c.fondo.replace('#aurora', `#${gid}`)
  return (
    <svg viewBox="0 0 32 32" width={tamano} height={tamano} className={cn('shrink-0', className)} role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true} focusable="false">
      {tono === 'aurora' && <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6d5df0" /><stop offset="1" stopColor="#b25cf6" /></linearGradient></defs>}
      <rect width="32" height="32" rx="8" fill={fondo} stroke={tono === 'mono' ? 'currentColor' : 'none'} strokeWidth={tono === 'mono' ? 2 : 0} />
      <path d="M21.35 10.05A8 8 0 1 0 21.35 21.95" fill="none" stroke={c.trazo} strokeWidth="3" strokeLinecap="round" />
      <path d="M13.5 18.6 17 15.1 19.6 17.4 25.6 10.6" fill="none" stroke={c.trazo} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25.6" cy="10.6" r="1.9" fill={c.trazo} />
    </svg>
  )
}

interface Props {
  /** `completo`: isotipo + nombre grande · `compacto`: isotipo + nombre pequeño (barras) · `isotipo`: solo el símbolo. */
  variante?: VarianteLogo
  tono?: TonoLogo
  /** Alto del isotipo en px (el nombre escala con él). */
  tamano?: number
  className?: string
}

/** Logo reutilizable de la aplicación. Con el nombre visible, el isotipo es decorativo; solo, lleva el nombre accesible. */
export function BrandLogo({ variante = 'completo', tono = 'color', tamano, className }: Props) {
  if (variante === 'isotipo') return <Isotipo tono={tono} tamano={tamano ?? 32} titulo={MARCA.nombre} className={className} />
  const px = tamano ?? (variante === 'completo' ? 40 : 32)
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5 font-display font-bold leading-none', className)}>
      <Isotipo tono={tono} tamano={px} />
      <span className="truncate" style={{ fontSize: variante === 'completo' ? Math.round(px * 0.55) : Math.round(px * 0.5) }}>{MARCA.nombre}</span>
    </span>
  )
}
