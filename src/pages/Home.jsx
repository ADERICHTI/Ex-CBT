import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import App from '../App';
import Auth from './Auth';
import AdminLayout from './admin/AdminLayout';
import Dashboard from './admin/Dashboard';

// The root route: signed out, it's the sign-in screen (with the marketing
// panel); signed in, it's the dashboard (with the app shell) - no separate
// /admin vs /auth split, one account does both.
export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <App>
        <Auth />
      </App>
    );
  }

  return (
    <AdminLayout>
      <Dashboard />
    </AdminLayout>
  );
}
