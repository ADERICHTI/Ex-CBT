import { Outlet, useLocation } from 'react-router-dom'
import AppShell from '../../lib/AppShell.jsx'

// Candidate screens. The test itself (…/attempt) takes the whole window
// with its own bar; the start and submitted pages sit in the QT frame,
// without the apps grid - a candidate is here to sit one test.
export default function TakeLayout() {
  const { pathname } = useLocation()
  if (pathname.endsWith('/attempt')) return <Outlet />
  return (
    <AppShell switcher={false}>
      <Outlet />
    </AppShell>
  )
}
