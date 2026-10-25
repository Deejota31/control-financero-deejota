import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { HintProvider } from '@/components/ui/Hint'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { RecoverPage } from '@/features/auth/RecoverPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { PublicOnly, RequireAuth } from '@/features/auth/RouteGuards'
import { SessionExpiredPage } from '@/features/auth/SessionExpiredPage'
import { CatalogoPage } from '@/features/catalogo/CatalogoPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { FondosPage } from '@/features/fondos/FondosPage'
import { GastosPage } from '@/features/gastos/GastosPage'
import { ConfiguracionPage } from '@/features/perfil/ConfiguracionPage'
import { SaludPage } from '@/features/salud/SaludPage'
import { ThemeProvider, useTema } from '@/features/tema/ThemeProvider'
import { AppLayout } from './AppLayout'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

function Notificaciones() {
  const { tema } = useTema()
  return <Toaster position="top-right" closeButton theme={tema === 'oscuro' ? 'dark' : 'light'} />
}

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
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
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
