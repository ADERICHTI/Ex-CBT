import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../../components/LoadingScreen.jsx'
import { isSignedIn, useAuth } from './useAuth.js'

// Gate for signed-in screens: anyone else goes to /signin and comes back
// to where they were headed afterwards.
export default function RequireSignIn() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!isSignedIn(user)) {
    const next = location.pathname + location.search
    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}
