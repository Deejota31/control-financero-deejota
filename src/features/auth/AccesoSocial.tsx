import type { ComponentType } from 'react'
import { FacebookLogo, GoogleLogo } from '@/components/brand/LogosSociales'
import { cn } from '@/lib/cn'

export type IdProveedor = 'google' | 'facebook'
export interface ProveedorSocial { id: IdProveedor; nombre: string; Logo: ComponentType<{ className?: string }> }

export const PROVEEDORES_SOCIALES: readonly ProveedorSocial[] = [
  { id: 'google', nombre: 'Google', Logo: GoogleLogo },
  { id: 'facebook', nombre: 'Facebook', Logo: FacebookLogo },
]

interface Props {
  /**
   * Proveedores habilitados. HOY NINGUNO: los botones son solo visuales (deshabilitados), no hay OAuth ni SDK ni redirección.
   * Para activar uno en el futuro basta pasar su id aquí y `alElegir`; el diseño no cambia.
   */
  disponibles?: ReadonlySet<IdProveedor>
  alElegir?: (id: IdProveedor) => void
  className?: string
}

/**
 * «o continúa con» + botones de Google y Facebook en una fila (se apilan si no caben). Secundarios: no compiten con «Iniciar sesión».
 * Deshabilitados se ven como botones normales (sin etiquetas): lo comunican `disabled`, el cursor y un tooltip discreto en el contenedor.
 */
export function AccesoSocial({ disponibles, alElegir, className }: Props) {
  return (
    <section aria-label="Otros métodos de acceso" className={cn('@container flex flex-col gap-4', className)}>
      <div className="flex items-center gap-3 text-xs font-medium text-[var(--esc-suave,var(--muted))]" role="separator" aria-label="o continúa con">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--esc-campo-borde,var(--line))]" aria-hidden="true" />
        <span aria-hidden="true">o continúa con</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--esc-campo-borde,var(--line))]" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-1 gap-3 @min-[17rem]:grid-cols-2">
        {PROVEEDORES_SOCIALES.map(({ id, nombre, Logo }) => {
          const activo = Boolean(alElegir && disponibles?.has(id))
          return (
            // El tooltip va en el contenedor: un botón deshabilitado no recibe eventos del puntero.
            <span key={id} title={activo ? undefined : 'Aún no disponible'} className="block min-w-0">
              <button type="button" data-proveedor={id} disabled={!activo} aria-label={activo ? `Continuar con ${nombre}` : `Continuar con ${nombre} (no disponible por ahora)`}
                onClick={activo ? () => alElegir?.(id) : undefined}
                className={cn('esc-social flex h-[3.25rem] w-full min-w-0 items-center justify-center gap-3 px-3 text-[0.95rem] font-semibold transition-colors',
                  activo ? 'hover:border-[var(--esc-linea)]' : 'cursor-not-allowed')}>
                <Logo className="size-[1.4rem] shrink-0" />
                <span className="truncate">{nombre}</span>
              </button>
            </span>
          )
        })}
      </div>
    </section>
  )
}
