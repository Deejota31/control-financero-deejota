import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { RecoverPage } from '@/features/auth/RecoverPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { PublicOnly, RequireAuth } from '@/features/auth/RouteGuards'
import { SessionExpiredPage } from '@/features/auth/SessionExpiredPage'
import { CatalogoPage } from '@/features/catalogo/CatalogoPage'
import { FondosPage } from '@/features/fondos/FondosPage'
import { GastosPage } from '@/features/gastos/GastosPage'
import { ConfiguracionPage } from '@/features/perfil/ConfiguracionPage'
import { ThemeProvider, useTema } from '@/features/tema/ThemeProvider'
import { AppLayout } from './AppLayout'
import { ModuloPendiente } from './ModuloPendiente'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

function Notificaciones() {
  const { tema } = useTema()
  return <Toaster richColors position="top-right" theme={tema === 'oscuro' ? 'dark' : 'light'} />
}

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route element={<PublicOnly />}>
                <Route path="/acceso" element={<LoginPage />} />
                <Route path="/recuperar" element={<RecoverPage />} />
              </Route>
              <Route path="/restablecer" element={<ResetPasswordPage />} />
              <Route path="/sesion-expirada" element={<SessionExpiredPage />} />

              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route index element={<ModuloPendiente nombre="Dashboard" descripcion="Presupuesto, gasto acumulado y gráficos del período." />} />
                  <Route path="gastos" element={<GastosPage />} />
                  <Route path="fondos" element={<FondosPage />} />
                  <Route path="catalogo" element={<CatalogoPage />} />
                  <Route path="salud" element={<ModuloPendiente nombre="Salud financiera" descripcion="Disponible, tendencias y compromisos mensuales." />} />
                  <Route path="configuracion" element={<ConfiguracionPage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Notificaciones />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
