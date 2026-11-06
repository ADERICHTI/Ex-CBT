import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, Moon, PanelLeft, Search, Sun, X } from 'lucide-react'
import AccountMenu from '../features/auth/AccountMenu.jsx'
import BalanceChip from '../features/credits/BalanceChip.jsx'
import AppSwitcher from './AppSwitcher.jsx'
import LogoMark from './LogoMark.jsx'
import { useTheme } from './useTheme.js'
import './AppShell.css'

// The Quality Tools frame (as in PeraForm): top bar - logo, optional centre
// (search or a title), then actions, theme switch, the QT apps grid and the
// account - and, with `nav`, PeraForm's sidebar (collapses in place on
// desktop; a slide-over drawer below 768px). Only the content card scrolls.
//   nav      - sidebar items ({ to, label, icon }); no sidebar without it
//   search   - centred search bar; the page reads useOutletContext().search
//   center   - any other centred top-bar content
//   actions  - extra top-bar buttons, before the theme switch
//   switcher - show the QT apps grid (off for candidates sitting a test)
//   children - content to show instead of the route's <Outlet />
export default function AppShell({ nav = null, search = false, center = null, actions = null, switcher = true, children }) {
  const { theme, toggleTheme } = useTheme()
  const [searchText, setSearchText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const hasCenter = Boolean(search || center)

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const card = <main className="content-card">{children ?? <Outlet context={{ search: searchText }} />}</main>

  return (
    <div
      className="shell"
      data-sidebar={!nav ? 'none' : sidebarOpen ? 'open' : 'closed'}
      data-drawer={drawerOpen ? 'open' : 'closed'}
    >
      <header className={`topbar${hasCenter ? ' topbar-has-center' : ''}`}>
        <div className="topbar-start">
          {nav && (
            <button type="button" className="icon-btn drawer-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <Menu size={18} />
            </button>
          )}
          <Link to="/" className="logo">
            <LogoMark />
            HyperCBT
          </Link>
        </div>
        {hasCenter && (
          <div className="topbar-center">
            {search ? <SearchBar value={searchText} onChange={setSearchText} /> : center}
          </div>
        )}
        <div className="topbar-actions">
          {actions}
          <BalanceChip />
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {switcher && <AppSwitcher />}
          <AccountMenu />
        </div>
      </header>

      {nav ? (
        <div className="shell-main">
          <aside className="sidebar" aria-label="Test sections">
            <div className="drawer-head">
              <span className="logo">
                <LogoMark />
                HyperCBT
              </span>
              <button type="button" className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="sidebar-nav">
              {nav.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className="nav-item" onClick={() => setDrawerOpen(false)}>
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>
          <button
            type="button"
            className="icon-btn sidebar-toggle"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
          >
            <PanelLeft size={16} />
          </button>
          {card}
        </div>
      ) : (
        card
      )}

      <footer className="footerbar">
        HyperCBT · by <a href="https://quality-toolsx.web.app/">Quality Tools</a>
      </footer>

      {nav && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
    </div>
  )
}

function SearchBar({ value, onChange }) {
  return (
    <label className="searchbar">
      <Search size={17} />
      <input
        type="search"
        placeholder="Search tests"
        aria-label="Search tests"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
