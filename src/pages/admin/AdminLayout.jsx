import { NavLink, Outlet } from 'react-router-dom'
import AppShell from '../../lib/AppShell.jsx'
import './Admin.css'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/manage/tests', label: 'Tests' },
]

// Test-management screens in the Quality Tools frame. (Stage 2 replaces
// these screens with the PeraForm-style dashboard and test page.)
export default function AdminLayout() {
  return (
    <AppShell
      center={
        <nav className="admin-topnav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      }
    >
      <div className="admin-container">
        <Outlet />
      </div>
    </AppShell>
  )
}
