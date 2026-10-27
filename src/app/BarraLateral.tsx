import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router'
import { Hint } from '@/components/ui/Hint'
import { cn } from '@/lib/cn'
import { MODULOS } from './modulos'

interface Props {
  compacta: boolean
  onAlternar: () => void
  nombre: string
  correo?: string | null
}

const inicial = (s: string) => (s.trim()[0] ?? '?').toUpperCase()

/**
 * Barra lateral de escritorio con dos modos. Expandida: logotipo, nombre y etiquetas completas. Compacta: solo iconos centrados; el nombre
 * completo aparece en un tooltip al pasar el cursor o al enfocar con el teclado. El botón de contraer/expandir comunica su estado con aria-expanded.
 */
export function BarraLateral({ compacta, onAlternar, nombre, correo }: Props) {
  const Toggle = compacta ? PanelLeftOpen : PanelLeftClose
  const etiquetaToggle = compacta ? 'Expandir la barra lateral' : 'Contraer la barra lateral'

  return (
    <aside id="barra-lateral" aria-label="Barra lateral" className="sticky top-0 hidden h-screen flex-col overflow-hidden border-r border-line bg-surface lg:flex">
      <div className={cn('flex shrink-0 items-center gap-2 px-3 pb-3 pt-4', compacta ? 'flex-col' : 'justify-between pl-4')}>
        <div className="flex min-w-0 items-center gap-2.5 font-display text-lg font-bold">
          <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-lg bg-pri text-pri-fg', compacta ? 'size-8 text-sm' : 'size-8 text-sm')}>G</span>
          {!compacta && <span className="truncate">Gasto Deejota</span>}
          {compacta && <span className="sr-only">Gasto Deejota</span>}
        </div>
        <Hint contenido={etiquetaToggle} side="right">
          <button type="button" onClick={onAlternar} aria-expanded={!compacta} aria-controls="barra-lateral" aria-label={etiquetaToggle}
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg">
            <Toggle className="size-[18px]" aria-hidden="true" />
          </button>
        </Hint>
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
                compacta ? 'justify-center' : 'gap-3 px-3',
                isActive ? 'bg-pri-soft text-pri' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {({ isActive }) => (
                <>
                  <span aria-hidden="true" className={cn('absolute left-0 top-2.5 h-5 w-[3px] rounded-r-full bg-pri transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
                  <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                  {!compacta && <span className="truncate">{label}</span>}
                </>
              )}
            </NavLink>
          )
          return compacta ? <Hint key={path} contenido={label} side="right">{enlace}</Hint> : enlace
        })}
      </nav>

      <div className="shrink-0 border-t border-line p-2">
        {(() => {
          const cuenta = (
            <NavLink to="/configuracion?seccion=cuenta" aria-label={compacta ? `Cuenta: ${correo || nombre}` : undefined}
              className={cn('flex items-center rounded-lg transition-colors hover:bg-surface-2', compacta ? 'justify-center p-1.5' : 'gap-2.5 px-2 py-1.5')}>
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-pri-soft text-sm font-bold text-pri">{inicial(nombre)}</span>
              {!compacta && (
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold">{nombre}</span>
                  {correo && correo !== nombre && <span className="truncate text-xs text-muted">{correo}</span>}
                </span>
              )}
            </NavLink>
          )
          return compacta ? <Hint contenido={<><span className="block font-semibold">{nombre}</span>{correo && correo !== nombre && <span className="block text-muted">{correo}</span>}</>} side="right">{cuenta}</Hint> : cuenta
        })()}
      </div>
    </aside>
  )
}
