import { LogOut, Plus } from 'lucide-react'
import { MARCA } from '@/lib/marca'
import { useTituloPagina } from '@/lib/useTituloPagina'
import { Suspense, useEffect, useState, type CSSProperties } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { useAuth } from '@/features/auth/AuthProvider'
import { useHogar } from '@/features/dashboard/useDashboard'
import { usePerfil } from '@/features/perfil/usePerfil'
import { useTema } from '@/features/tema/ThemeProvider'
import { ThemeSwitch } from '@/features/tema/ThemeSwitch'
import { procesarLimpieza } from '@/features/gastos/comprobantes'
import { RegistroGastoProvider, useRegistroGasto } from '@/features/gastos/RegistroGasto'
import { InvitacionPlanificacion } from '@/features/planificacion/InvitacionPlanificacion'
import { AvisoConexion } from '@/features/pwa/AvisoConexion'
import { AvisoInstalacion } from '@/features/pwa/AvisoInstalacion'
import { useActualizacionApp } from '@/features/pwa/useActualizacionApp'
import { PlanificacionProvider } from '@/features/planificacion/PlanificacionProvider'
import { BarraLateral } from './BarraLateral'
import { MODULOS, type Modulo } from './modulos'
import { useBarraLateral } from './useBarraLateral'

export function AppLayout() {
  return (
    <RegistroGastoProvider>
      <PlanificacionProvider>
        <Estructura />
      </PlanificacionProvider>
    </RegistroGastoProvider>
  )
}

function Estructura() {
  const { abrir } = useRegistroGasto()
  const { user, signOut } = useAuth()
  const { setTema } = useTema()
  const perfil = usePerfil()
  const hogar = useHogar()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [saliendo, setSaliendo] = useState(false)
  const { compacta, alternar } = useBarraLateral()
  const tecladoAbierto = useTecladoVirtual()

  // El tema guardado en el perfil manda al iniciar sesión.
  const temaPerfil = perfil.data?.theme
  useEffect(() => {
    if (temaPerfil === 'claro' || temaPerfil === 'oscuro') setTema(temaPerfil)
  }, [temaPerfil, setTema])

  // Reintenta borrar comprobantes huérfanos pendientes (el servidor descarta los que estén asociados a un gasto).
  useEffect(() => {
    void procesarLimpieza()
  }, [])

  const actual = MODULOS.find((m) => (m.path === '/' ? pathname === '/' : pathname.startsWith(m.path)))
  useTituloPagina(actual?.label) // «Gastos | Control Financiero»
  useActualizacionApp() // avisa de versiones nuevas; nunca recarga sola
  const nombre = perfil.data?.display_name || user?.email || ''

  async function cerrarSesion() {
    setSaliendo(true)
    await signOut()
    toast.success('Sesión cerrada.')
    navigate('/acceso', { replace: true })
  }

  return (
    <div
      className="min-h-dvh lg:grid lg:[grid-template-columns:var(--ancho-barra)_minmax(0,1fr)] lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out motion-reduce:lg:transition-none"
      style={{ '--ancho-barra': compacta ? '4.5rem' : '15rem' } as CSSProperties}
    >
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-pri focus:px-3 focus:py-2 focus:text-pri-fg">
        Saltar al contenido
      </a>

      <BarraLateral compacta={compacta} onAlternar={alternar} nombre={nombre} correo={user?.email} />

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate font-display text-lg font-bold">{actual?.label ?? MARCA.nombre}</h1>
            {hogar.data?.is_demo && <span className="shrink-0 rounded-md bg-acc-soft px-2 py-0.5 text-xs font-semibold text-warn" title="Los datos de este hogar son de demostración">Datos DEMO</span>}
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitch />
            <button
              type="button"
              onClick={cerrarSesion}
              disabled={saliendo}
              aria-label="Salir (cerrar sesión)"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{saliendo ? 'Saliendo…' : 'Salir'}</span>
            </button>
          </div>
        </header>
        <main id="contenido" tabIndex={-1} className={cn('px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6', actual?.finLibre ? 'pb-(--espacio-libre)' : 'pb-(--espacio-final)')}>
          <AvisoInstalacion />
          <InvitacionPlanificacion />
          <Suspense fallback={<div role="status" aria-label="Cargando módulo" className="flex flex-col gap-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /><Skeleton className="h-64" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <AvisoConexion />
      {/* Barra inferior (hasta 1023 px): exactamente un enlace por módulo, en cinco columnas iguales. El botón «+» no forma parte de la cuadrícula. */}
      <nav aria-label="Módulos" className={cn('fixed inset-x-0 bottom-0 z-20 h-[calc(var(--alto-barra)+env(safe-area-inset-bottom,0px))] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.18)] lg:hidden', tecladoAbierto && 'hidden')}>
        <div className="grid h-full grid-cols-5">{MODULOS.map((m) => <EnlaceInferior key={m.path} modulo={m} />)}</div>
      </nav>

      {/* Acción flotante única de «Registrar gasto»: círculo sobre la zona derecha de la barra (móvil y tablet) y píldora con texto en escritorio. Las medidas salen de index.css. */}
      <button
        type="button"
        onClick={abrir}
        className={cn(
          'fab-gasto fixed bottom-(--y-fab) right-(--x-fab) z-20 place-items-center rounded-full bg-pri text-pri-fg shadow-pop transition-transform active:scale-95 motion-reduce:transition-none',
          tecladoAbierto ? 'hidden' : 'grid size-(--tam-fab) lg:inline-flex lg:w-auto lg:items-center lg:gap-2 lg:px-5 lg:text-sm lg:font-semibold lg:hover:opacity-90',
        )}
      >
        <Plus className="size-7 lg:size-5" aria-hidden="true" />
        <span className="sr-only lg:not-sr-only">Registrar gasto</span>
      </button>
    </div>
  )
}

/** El nombre accesible es el texto visible («Inicio», «Ajustes»): quien dicta «tocar Ajustes» o lee la pantalla oye lo mismo que ve. */
function EnlaceInferior({ modulo: { path, corto, icon: Icon } }: { modulo: Modulo }) {
  return (
    <NavLink
      to={path}
      end={path === '/'}
      className={({ isActive }) => cn('enlace-barra flex h-full min-w-0 flex-col items-center justify-center gap-0.5 text-[0.6875rem] leading-tight font-medium transition-colors min-[400px]:text-xs motion-reduce:transition-none', isActive ? 'text-pri' : 'text-muted hover:text-fg')}
    >
      {({ isActive }) => (
        <>
          <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors motion-reduce:transition-none', isActive && 'bg-pri-soft')}><Icon className="size-5" aria-hidden="true" /></span>
          <span className={cn('max-w-full whitespace-nowrap', isActive && 'font-bold')}>{corto}</span>
        </>
      )}
    </NavLink>
  )
}

/**
 * Detecta el teclado virtual (el viewport visual se encoge respecto al de la página). Con el teclado abierto la barra inferior y el botón
 * «Registrar gasto» se ocultan para no invadir el formulario que se está editando. El zoom de pellizco también encoge el viewport visual,
 * pero no es un teclado: se compensa con la escala para que quien amplía la pantalla no pierda la navegación.
 */
function useTecladoVirtual(): boolean {
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const medir = () => setAbierto(window.innerHeight - vv.height * vv.scale > 140 && window.matchMedia('(max-width: 1023px)').matches)
    vv.addEventListener('resize', medir)
    return () => vv.removeEventListener('resize', medir)
  }, [])
  return abierto
}
