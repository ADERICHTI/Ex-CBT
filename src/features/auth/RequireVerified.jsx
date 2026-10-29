import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import AppShell from '../../lib/AppShell.jsx'
import { recheckVerification, resendVerification, signOut } from './authActions.js'
import { needsVerification, useAuth } from './useAuth.js'
import './RequireVerified.css'

// Gate for the test-making screens: a password account whose email isn't
// verified yet sees why, and how to fix it, instead of empty pages.
// Nothing is lost: its tests appear as soon as the email is verified.
export default function RequireVerified() {
  const { user } = useAuth()
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  if (!needsVerification(user)) return <Outlet />

  async function resend() {
    setBusy(true)
    try {
      if ((await resendVerification()) === 'verified') {
        // Already verified (e.g. in another tab): pick it up straight away.
        await recheck()
        return
      }
      setStatus(`Sent. Check ${user.email} (and the spam folder), then press “I’ve verified”.`)
    } catch (err) {
      setStatus(
        err?.code === 'auth/too-many-requests'
          ? 'An email was sent very recently. Wait a few minutes before asking for another.'
          : 'Couldn’t send the email. Try again in a few minutes.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function recheck() {
    setBusy(true)
    setStatus('Checking…')
    try {
      if (await recheckVerification()) {
        // Reload so every screen starts with the new, verified sign-in.
        window.location.reload()
        return
      }
      setStatus('Not verified yet. Open the link in the email we sent, then try again.')
    } catch {
      setStatus('Couldn’t check. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <section className="verify-card">
        <MailCheck size={36} className="verify-icon" />
        <h1>Verify your email to make tests</h1>
        <p>
          HyperCBT needs to know <strong>{user.email}</strong> is yours before you create or manage tests. We sent
          a link to it when you signed up. Your tests are safe and appear as soon as you verify.
        </p>
        <p className="verify-muted">You don’t need this to sit a test: candidates can use any account.</p>
        <div className="verify-actions">
          <button type="button" className="btn btn-primary" onClick={recheck} disabled={busy}>
            I’ve verified
          </button>
          <button type="button" className="btn btn-outline" onClick={resend} disabled={busy}>
            Resend email
          </button>
        </div>
        {status && (
          <p className="form-notice" role="status">
            {status}
          </p>
        )}
        <button type="button" className="link-btn" onClick={signOut}>
          Use a different account
        </button>
      </section>
    </AppShell>
  )
}
