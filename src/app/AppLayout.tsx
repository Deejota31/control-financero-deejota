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
      className="min-h-screen lg:grid lg:[grid-template-columns:var(--ancho-barra)_minmax(0,1fr)] lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out motion-reduce:lg:transition-none"
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
        <main id="contenido" tabIndex={-1} className="px-4 py-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-6 lg:pb-24">
          <AvisoInstalacion />
          <InvitacionPlanificacion />
          <Suspense fallback={<div role="status" aria-label="Cargando módulo" className="flex flex-col gap-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /><Skeleton className="h-64" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <AvisoConexion />
      <nav aria-label="Módulos" className={cn('fixed inset-x-0 bottom-0 z-20 grid grid-cols-[repeat(3,minmax(0,1fr))_3.5rem_repeat(3,minmax(0,1fr))] min-[360px]:grid-cols-[repeat(3,minmax(0,1fr))_4.5rem_repeat(3,minmax(0,1fr))] items-end border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.18)] lg:hidden', tecladoAbierto && 'hidden')}>
        {MODULOS.slice(0, 3).map((m) => <EnlaceInferior key={m.path} modulo={m} />)}
        <button type="button" onClick={abrir} aria-label="Registrar gasto" className="fab-gasto relative -top-4 mx-auto grid size-14 place-items-center rounded-full bg-pri text-pri-fg shadow-pop ring-4 ring-surface">
          <Plus className="size-7" aria-hidden="true" />
        </button>
        {MODULOS.slice(3).map((m) => <EnlaceInferior key={m.path} modulo={m} />)}
      </nav>

      <button type="button" onClick={abrir} className="fab-gasto fixed bottom-6 right-6 z-20 hidden items-center gap-2 rounded-full bg-pri px-5 py-3 text-sm font-semibold text-pri-fg shadow-pop hover:opacity-90 lg:inline-flex">
        <Plus className="size-5" aria-hidden="true" /> Registrar gasto
      </button>
    </div>
  )
}

function EnlaceInferior({ modulo: { path, label, corto, icon: Icon } }: { modulo: Modulo }) {
  return (
    <NavLink
      to={path}
      end={path === '/'}
      aria-label={label}
      className={({ isActive }) => cn('flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-0 text-[9.5px] font-medium tracking-tight min-[360px]:px-0.5 min-[360px]:text-[11px] min-[360px]:tracking-normal', isActive ? 'text-pri' : 'text-muted')}
    >
      {({ isActive }) => (
        <>
          <span className={cn('grid h-7 w-10 place-items-center rounded-full min-[360px]:w-12', isActive && 'bg-pri-soft')}><Icon className="size-5" aria-hidden="true" /></span>
          <span className={cn('max-w-full', isActive && 'font-bold')}>{corto}</span>
        </>
      )}
    </NavLink>
  )
}

/**
 * Detecta el teclado virtual (el viewport visual se encoge respecto al de la página). Con el teclado abierto la barra inferior se oculta
 * para no invadir el formulario que se está editando.
 */
function useTecladoVirtual(): boolean {
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const medir = () => setAbierto(window.innerHeight - vv.height > 140 && window.matchMedia('(max-width: 1023px)').matches)
    vv.addEventListener('resize', medir)
    return () => vv.removeEventListener('resize', medir)
  }, [])
  return abierto
}
