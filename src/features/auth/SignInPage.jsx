import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  authErrorMessage,
  createAccount,
  finishEmailLink,
  isEmailLink,
  rememberedLinkEmail,
  resetPassword,
  sendSignInLink,
  signInWithEmail,
  signInWithGoogle,
} from './authActions.js'
import { isSignedIn, useAuth } from './useAuth.js'
import Spinner from '../../lib/Spinner.jsx'
import GoogleMark from '../../lib/GoogleMark.jsx'
import LogoMark from '../../lib/LogoMark.jsx'
import './SignInPage.css'

const TITLES = {
  signin: 'Sign in to HyperCBT',
  signup: 'Create your account',
  reset: 'Reset your password',
  link: 'Get a sign-in link',
  finish: 'Confirm your email',
}

const SUBMIT_LABELS = {
  signin: 'Sign in',
  signup: 'Create account',
  reset: 'Send reset link',
  link: 'Email me a link',
  finish: 'Continue',
}

// Only same-site paths, so ?next= can't bounce users to another site.
function safeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export default function SignInPage() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  // Opened from an emailed sign-in link: finish signing in (asking for the
  // address only if this isn't the device that asked for the link).
  const [linkOpened] = useState(() => isEmailLink())
  const [mode, setMode] = useState(() =>
    linkOpened ? 'finish' : params.get('mode') === 'signup' ? 'signup' : 'signin',
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const autoFinished = useRef(false)

  useEffect(() => {
    if (!linkOpened || autoFinished.current) return
    autoFinished.current = true
    const remembered = rememberedLinkEmail()
    if (remembered) run(() => finishEmailLink(remembered))
    // Once, when the page opens from a link.
  }, [linkOpened])

  if (loading) return <Spinner fill="page" />
  if (isSignedIn(user)) return <Navigate to={next} replace />

  function switchMode(nextMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
  }

  async function run(action) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (err) {
      const message = authErrorMessage(err)
      if (message) setError(message)
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const address = email.trim()
    if (mode === 'signin') run(() => signInWithEmail(address, password))
    if (mode === 'signup') run(() => createAccount(name.trim(), address, password))
    if (mode === 'finish') run(() => finishEmailLink(address))
    if (mode === 'reset') {
      run(async () => {
        await resetPassword(address)
        // Same wording whether or not the account exists.
        setNotice('If an account exists for that email, a reset link is on its way.')
      })
    }
    if (mode === 'link') {
      run(async () => {
        await sendSignInLink(address, next)
        setNotice(`Link sent. Open it from ${address} on this device to sign in.`)
      })
    }
  }

  const showGoogle = mode === 'signin' || mode === 'signup'
  const showPassword = mode === 'signin' || mode === 'signup'

  return (
    <div className="signin">
      <Link to="/" className="logo">
        <LogoMark />
        HyperCBT
      </Link>

      <section className="signin-card">
        <h1>{TITLES[mode]}</h1>
        {mode === 'finish' && (
          <p className="signin-hint">Enter the email address the sign-in link was sent to.</p>
        )}
        {mode === 'link' && (
          <p className="signin-hint">We’ll email you a link that signs you in, no password needed.</p>
        )}

        {showGoogle && (
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => run(signInWithGoogle)}
              disabled={busy}
            >
              <GoogleMark />
              Continue with Google
            </button>
            <div className="signin-divider">
              <span>or</span>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="signin-form">
          {mode === 'signup' && (
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {showPassword && (
            // A <div>, not a <label>: a label belongs to the first control
            // inside it, which would make "Password" the Forgot button's.
            <div className="field">
              <span className="field-row">
                <label htmlFor="signin-password">Password</label>
                {mode === 'signin' && (
                  <button type="button" className="link-btn" onClick={() => switchMode('reset')}>
                    Forgot?
                  </button>
                )}
              </span>
              <input
                id="signin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                required
              />
            </div>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-notice" role="status">
              {notice}
            </p>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy && mode === 'finish' ? 'Signing in…' : SUBMIT_LABELS[mode]}
          </button>
        </form>

        {mode === 'signin' && (
          <button type="button" className="link-btn signin-alt" onClick={() => switchMode('link')}>
            Email me a sign-in link instead
          </button>
        )}

        <p className="signin-switch">
          {mode === 'signin' ? (
            <>
              New to HyperCBT?{' '}
              <button type="button" className="link-btn" onClick={() => switchMode('signup')}>
                Create an account
              </button>
            </>
          ) : (
            <button type="button" className="link-btn" onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
          )}
        </p>
      </section>

      <p className="signin-suite">One Quality Tools account works in HyperCBT and PeraForm.</p>

      <footer className="signin-legal">
        {/* Shared by every Quality Tools app (quality-tools/ site). */}
        <a href="https://quality-toolsx.web.app/privacy">Privacy</a>
        <a href="https://quality-toolsx.web.app/terms">Terms</a>
      </footer>
    </div>
  )
}
