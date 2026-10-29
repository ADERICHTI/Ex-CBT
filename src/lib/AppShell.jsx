import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Moon, Search, Sun } from 'lucide-react'
import AccountMenu from '../features/auth/AccountMenu.jsx'
import BalanceChip from '../features/credits/BalanceChip.jsx'
import AppSwitcher from './AppSwitcher.jsx'
import LogoMark from './LogoMark.jsx'
import { useTheme } from './useTheme.js'
import './AppShell.css'

// The Quality Tools frame (as in PeraForm), without a sidebar: HyperCBT
// keeps everything in the top bar - logo, optional centre (search or a
// title), then actions, theme switch, the QT apps grid and the account.
// Only the content card scrolls.
//   search   - centred search bar; the page reads useOutletContext().search
//   center   - any other centred top-bar content
//   actions  - extra top-bar buttons, before the theme switch
//   switcher - show the QT apps grid (off for candidates sitting a test)
//   children - content to show instead of the route's <Outlet />
export default function AppShell({ search = false, center = null, actions = null, switcher = true, children }) {
  const { theme, toggleTheme } = useTheme()
  const [searchText, setSearchText] = useState('')
  const hasCenter = Boolean(search || center)

  return (
    <div className="shell">
      <header className={`topbar${hasCenter ? ' topbar-has-center' : ''}`}>
        <div className="topbar-start">
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

      <main className="content-card">{children ?? <Outlet context={{ search: searchText }} />}</main>

      <footer className="footerbar">
        HyperCBT · by <a href="https://quality-toolsx.web.app/">Quality Tools</a>
      </footer>
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
