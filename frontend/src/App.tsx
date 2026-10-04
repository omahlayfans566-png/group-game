import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoadingScreen from './components/shared/LoadingScreen';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PlayerSetupPage from './pages/PlayerSetupPage';
import AdminLoginPage from './pages/AdminLoginPage';
import DashboardPage from './pages/DashboardPage';
import ChallengePage from './pages/ChallengePage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';

export default function App() {
  const { initFromStorage, isLoading } = useAuthStore();

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  if (isLoading) return <LoadingScreen />;

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* Player setup — protected but pre-setup state allowed */}
      <Route
        path="/setup"
        element={
          <ProtectedRoute>
            <PlayerSetupPage />
          </ProtectedRoute>
        }
      />

      {/* Player */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/challenge/:challengeId"
        element={
          <ProtectedRoute>
            <ChallengePage />
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
