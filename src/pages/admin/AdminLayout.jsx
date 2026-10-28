import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../utility/config';
import { useAuth } from '../../context/AuthContext';
import './Admin.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'fa-solid fa-gauge', end: true },
  { to: '/manage/tests', label: 'Tests', icon: 'fa-solid fa-file-lines' },
];

export default function AdminLayout({ children }) {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleRefresh() {
    setRefreshing(true);
    window.location.reload();
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar mn-navbar">
        <NavLink to="/" className="mn-logo">ex-cbt</NavLink>

        <nav className="admin-topnav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-topbar-actions items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh data"
            className="admin-icon-btn"
          >
            <i className={`fa-solid fa-arrows-rotate ${refreshing ? 'fa-spin' : ''}`}></i>
          </button>
          <span className="text-xs text-[#00000066]">{user?.email}</span>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="text-xs font-medium text-[#00000099] hover:text-[#1F1F1F] flex items-center gap-1"
          >
            <i className="fa-solid fa-right-from-bracket"></i> Sign out
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="admin-icon-btn admin-hamburger-btn"
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <i className={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
        </button>

        {menuOpen && (
          <nav className="admin-mobile-menu">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
              >
                <i className={item.icon}></i> {item.label}
              </NavLink>
            ))}
            <div className="admin-mobile-menu-divider" />
            <button
              type="button"
              onClick={() => { setMenuOpen(false); handleRefresh(); }}
              disabled={refreshing}
              className="admin-nav-link"
            >
              <i className={`fa-solid fa-arrows-rotate ${refreshing ? 'fa-spin' : ''}`}></i> Refresh
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="admin-nav-link"
            >
              <i className="fa-solid fa-right-from-bracket"></i> Sign out
            </button>
          </nav>
        )}
      </header>

      <main className="admin-main">
        <div className="admin-container">
          {children ?? <Outlet />}
        </div>
      </main>

      <footer className="mn-footer">&copy; 2026 ex-cbt</footer>
    </div>
  );
}
