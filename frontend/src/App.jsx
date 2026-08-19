import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const EditorPage = lazy(() => import('./pages/EditorPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SharedFilePage = lazy(() => import('./pages/SharedFilePage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))

function AppLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-base" role="status">
      <div className="flex flex-col items-center gap-3 text-sm text-ink-muted">
        <div className="spinner" />
        Chargement…
      </div>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AppLoading />
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<AppLoading />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/forgot-password" element={<ResetPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/shared/:token" element={<SharedFilePage />} />
            <Route path="/app" element={<PrivateRoute><EditorPage /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
