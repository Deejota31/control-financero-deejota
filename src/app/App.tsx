import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { HintProvider } from '@/components/ui/Hint'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { RecoverPage } from '@/features/auth/RecoverPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { PublicOnly, RequireAuth } from '@/features/auth/RouteGuards'
import { SessionExpiredPage } from '@/features/auth/SessionExpiredPage'
import { ThemeProvider, useTema } from '@/features/tema/ThemeProvider'
import { AppLayout } from './AppLayout'
import { ConsultasPorUsuario } from './ConsultasPorUsuario'

// Cada módulo se carga al visitarlo: el primer paquete (acceso + estructura) queda ligero y los gráficos/catálogos pesados no bloquean el inicio.
const CatalogoPage = lazy(() => import('@/features/catalogo/CatalogoPage').then((m) => ({ default: m.CatalogoPage })))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const FondosPage = lazy(() => import('@/features/fondos/FondosPage').then((m) => ({ default: m.FondosPage })))
const GastosPage = lazy(() => import('@/features/gastos/GastosPage').then((m) => ({ default: m.GastosPage })))
const ConfiguracionPage = lazy(() => import('@/features/perfil/ConfiguracionPage').then((m) => ({ default: m.ConfiguracionPage })))
const SaludPage = lazy(() => import('@/features/salud/SaludPage').then((m) => ({ default: m.SaludPage })))

function Notificaciones() {
  const { tema } = useTema()
  return <Toaster position="top-right" closeButton theme={tema === 'oscuro' ? 'dark' : 'light'} />
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ConsultasPorUsuario>
            <HintProvider>
            <Routes>
              <Route element={<PublicOnly />}>
                <Route path="/acceso" element={<LoginPage />} />
                <Route path="/recuperar" element={<RecoverPage />} />
              </Route>
              <Route path="/restablecer" element={<ResetPasswordPage />} />
              <Route path="/sesion-expirada" element={<SessionExpiredPage />} />

              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="gastos" element={<GastosPage />} />
                  <Route path="fondos" element={<FondosPage />} />
                  <Route path="catalogo" element={<CatalogoPage />} />
                  <Route path="salud" element={<SaludPage />} />
                  <Route path="configuracion" element={<ConfiguracionPage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Notificaciones />
            </HintProvider>
          </ConsultasPorUsuario>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
