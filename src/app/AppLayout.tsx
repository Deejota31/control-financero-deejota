import { LogOut, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { useAuth } from '@/features/auth/AuthProvider'
import { useHogar } from '@/features/dashboard/useDashboard'
import { usePerfil } from '@/features/perfil/usePerfil'
import { useTema } from '@/features/tema/ThemeProvider'
import { ThemeToggle } from '@/features/tema/ThemeToggle'
import { procesarLimpieza } from '@/features/gastos/comprobantes'
import { RegistroGastoProvider, useRegistroGasto } from '@/features/gastos/RegistroGasto'
import { MODULOS, type Modulo } from './modulos'

export function AppLayout() {
  return (
    <RegistroGastoProvider>
      <Estructura />
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
  const nombre = perfil.data?.display_name || user?.email || ''

  async function cerrarSesion() {
    setSaliendo(true)
    await signOut()
    toast.success('Sesión cerrada.')
    navigate('/acceso', { replace: true })
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-pri focus:px-3 focus:py-2 focus:text-pri-fg">
        Saltar al contenido
      </a>

      <aside className="sticky top-0 hidden h-screen flex-col gap-1 border-r border-line bg-surface p-2 lg:flex xl:p-4">
        <div className="flex items-center justify-center gap-2 px-1 pb-4 pt-2 font-display text-lg font-bold xl:justify-start xl:px-3">
          <span aria-hidden="true" className="grid size-7 place-items-center rounded-md bg-pri text-sm text-pri-fg">
            G
          </span>
          <span className="hidden xl:inline">Gasto Deejota</span>
        </div>
        <nav aria-label="Módulos" className="flex flex-col gap-1">
          {MODULOS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-center gap-3 rounded-md px-3 py-2 text-sm font-medium xl:justify-start',
                  isActive ? 'bg-pri-soft text-pri' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              <span className="hidden xl:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden flex-col gap-0.5 border-t border-line px-3 pt-3 text-sm xl:flex">
          <span className="truncate font-semibold">{nombre}</span>
          {perfil.data?.display_name && <span className="truncate text-muted">{user?.email}</span>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate font-display text-lg font-bold">{actual?.label ?? 'Gasto Deejota'}</h1>
            {hogar.data?.is_demo && <span className="shrink-0 rounded-md bg-acc-soft px-2 py-0.5 text-xs font-semibold text-warn" title="Los datos de este hogar son de demostración">Datos DEMO</span>}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
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
        <main id="contenido" tabIndex={-1} className="p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:p-8 lg:pb-24">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Módulos" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-[repeat(3,minmax(0,1fr))_4.5rem_repeat(3,minmax(0,1fr))] items-end border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
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
      className={({ isActive }) => cn('flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium', isActive ? 'text-pri' : 'text-muted')}
    >
      {({ isActive }) => (
        <>
          <span className={cn('grid h-7 w-12 place-items-center rounded-full', isActive && 'bg-pri-soft')}><Icon className="size-5" aria-hidden="true" /></span>
          <span className={cn('max-w-full truncate', isActive && 'font-bold')}>{corto}</span>
        </>
      )}
    </NavLink>
  )
}
