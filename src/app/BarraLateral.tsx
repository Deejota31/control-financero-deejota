import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router'
import { Isotipo } from '@/components/brand/BrandLogo'
import { Hint } from '@/components/ui/Hint'
import { cn } from '@/lib/cn'
import { MARCA } from '@/lib/marca'
import { MODULOS } from './modulos'

interface Props {
  compacta: boolean
  onAlternar: () => void
  nombre: string
  correo?: string | null
}

const inicial = (s: string) => (s.trim()[0] ?? '?').toUpperCase()

/**
 * Barra lateral de escritorio con dos modos. Expandida: logotipo, nombre y etiquetas completas. Compacta: solo iconos; el nombre completo aparece
 * en un tooltip al pasar el cursor o al enfocar con el teclado. Los iconos y el isotipo tienen una posición fija: al contraer solo se desliza la
 * columna y las etiquetas se desvanecen (sin remontar ni reordenar nada), así la transición es fluida. El botón de contraer/expandir va al pie
 * de la navegación y comunica su estado con aria-expanded.
 */
export function BarraLateral({ compacta, onAlternar, nombre, correo }: Props) {
  const Toggle = compacta ? PanelLeftOpen : PanelLeftClose
  const etiquetaToggle = compacta ? 'Expandir la barra lateral' : 'Contraer la barra lateral'

  return (
    <aside id="barra-lateral" aria-label="Barra lateral" className="sticky top-0 hidden h-screen flex-col overflow-hidden border-r border-line bg-surface lg:flex">
      {/* Cabecera de altura fija: el isotipo no se mueve al contraer; solo el nombre se desvanece y la barra lo recorta. */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 overflow-hidden pl-5 pr-3">
        <Isotipo tono="aurora" tamano={32} titulo={compacta ? MARCA.nombre : undefined} />
        <span aria-hidden={compacta || undefined} className={cn('truncate whitespace-nowrap font-display text-base font-bold leading-none transition-opacity duration-200 motion-reduce:transition-none', compacta && 'opacity-0')}>{MARCA.nombre}</span>
      </div>

      <nav aria-label="Módulos" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
        {MODULOS.map(({ path, label, icon: Icon }) => {
          const enlace = (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              aria-label={compacta ? label : undefined}
              className={({ isActive }) => cn(
                'group relative flex h-10 items-center rounded-lg text-sm font-medium transition-colors',
                'gap-3 pl-[1.1875rem]',
                isActive ? 'bg-pri-soft text-pri' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {({ isActive }) => (
                <>
                  <span aria-hidden="true" className={cn('absolute left-0 top-2.5 h-5 w-[3px] rounded-r-full bg-pri transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
                  <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                  <span aria-hidden={compacta || undefined} className={cn('truncate whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none', compacta && 'opacity-0')}>{label}</span>
                </>
              )}
            </NavLink>
          )
          // El disparador del tooltip es un contenedor: Radix fusiona className en su hijo y NavLink usa className como función.
          return compacta ? <Hint key={path} contenido={label} side="right"><span className="block">{enlace}</span></Hint> : enlace
        })}
      </nav>

      <div className="shrink-0 px-2 pb-2">
        <Hint contenido={etiquetaToggle} side="right">
          <button type="button" onClick={onAlternar} aria-expanded={!compacta} aria-controls="barra-lateral" aria-label={etiquetaToggle}
            className="flex h-10 w-full items-center gap-3 rounded-lg pl-[1.1875rem] text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg">
            <Toggle className="size-[18px] shrink-0" aria-hidden="true" />
            <span aria-hidden="true" className={cn('truncate whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none', compacta && 'opacity-0')}>{etiquetaToggle}</span>
          </button>
        </Hint>
      </div>

      <div className="shrink-0 border-t border-line p-2">
        {(() => {
          const cuenta = (
            <NavLink to="/configuracion?seccion=cuenta" aria-label={compacta ? `Cuenta: ${correo || nombre}` : undefined}
              className={cn('flex items-center rounded-lg transition-colors hover:bg-surface-2', 'gap-2.5 py-1.5 pl-[0.6875rem]')}>
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-pri-soft text-sm font-bold text-pri">{inicial(nombre)}</span>
              {(
                <span aria-hidden={compacta || undefined} className={cn('flex min-w-0 flex-col leading-tight transition-opacity duration-200 motion-reduce:transition-none', compacta && 'opacity-0')}>
                  <span className="truncate text-sm font-semibold">{nombre}</span>
                  {correo && correo !== nombre && <span className="truncate text-xs text-muted">{correo}</span>}
                </span>
              )}
            </NavLink>
          )
          return compacta ? <Hint contenido={<><span className="block font-semibold">{nombre}</span>{correo && correo !== nombre && <span className="block text-muted">{correo}</span>}</>} side="right"><span className="block">{cuenta}</span></Hint> : cuenta
        })()}
      </div>
    </aside>
  )
}
