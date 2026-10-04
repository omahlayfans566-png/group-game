import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../shared/LoadingScreen';

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: Props) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  // Not logged in at all → go to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but setup not complete:
  // Allow /setup through; redirect everything else to /setup
  if (user?.role === 'player' && !user?.isSetupComplete) {
    if (location.pathname !== '/setup') {
      return <Navigate to="/setup" replace />;
    }
  }

  // Admin-only route guard
  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
