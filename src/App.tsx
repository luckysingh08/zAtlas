import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Subject from './pages/Subject'
import Planner from './pages/Planner'
import ChatFilesAlerts from './pages/ChatFilesAlerts'
import Settings from './pages/Settings'

function AppRoutes() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text)]">
        Loading...
      </div>
    )
  }

  const isFullyOnboarded = session && profile && profile.group_id
  const isPasswordRecovery = new URLSearchParams(window.location.search).get('mode') === 'reset'

  return (
    <Routes>
      <Route
        path="/login"
        element={isFullyOnboarded && !isPasswordRecovery ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={isFullyOnboarded ? <Dashboard /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/subject/:subjectId"
        element={isFullyOnboarded ? <Subject /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/planner"
        element={isFullyOnboarded ? <Planner /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/messages"
        element={isFullyOnboarded ? <ChatFilesAlerts /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/settings"
        element={isFullyOnboarded ? <Settings /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={isFullyOnboarded ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
