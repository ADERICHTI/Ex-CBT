import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

export default function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!user) {
    const redirectTarget = `${location.pathname}${location.search}`;
    return <Navigate to={`/?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  return <Outlet />;
}
