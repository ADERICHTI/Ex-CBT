import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Hourglass, Info, ListChecks, Unlink } from 'lucide-react'
import { useTestSession } from '../../hooks/useTestSession'
import { getTest, hasUserTakenTest, startTestAttempt } from '../../services/firestore'
import LoadingScreen from '../../components/LoadingScreen'
import GoogleMark from '../../lib/GoogleMark.jsx'
import { authErrorMessage, signInWithGoogle } from '../auth/authActions.js'
import { useGoogleOneTap } from '../auth/oneTap.js'
import { isSignedIn, useAuth } from '../auth/useAuth.js'
import './take.css'

// A test's shared link. Signed out: sign in right here (Google button, One
// Tap, or email via the sign-in page). Signed in: name + Student ID, then
// Begin.
export default function StartTest() {
  const { user, loading } = useAuth()
  const signedIn = isSignedIn(user)
  useGoogleOneTap({ enabled: !loading && !signedIn })

  if (loading) return <LoadingScreen />
  return signedIn ? <StartForm user={user} /> : <SignInHere />
}

function SignInHere() {
  const { testId } = useTestSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const next = `/test/${testId}`

  async function google() {
    setBusy(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      const message = authErrorMessage(err)
      if (message) setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="take-card take-center">
      <ListChecks size={32} className="take-icon" />
      <h1>Sign in to take this test</h1>
      <p className="take-muted">Your teacher will see your result under the account you sign in with.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="take-signin-actions">
        <button type="button" className="btn btn-outline" onClick={google} disabled={busy}>
          <GoogleMark />
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>
        <Link to={`/signin?next=${encodeURIComponent(next)}`} className="btn btn-ghost">
          Use email instead
        </Link>
      </div>
    </section>
  )
}

function StartForm({ user }) {
  const { testId, goTo } = useTestSession()

  const [status, setStatus] = useState('loading') // loading | no-id | expired | ready
  const [test, setTest] = useState(null)
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [beginError, setBeginError] = useState('')
  const [beginning, setBeginning] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const found = await getTest(testId)
      if (cancelled) return

      if (!found || found.status !== 'open') {
        setStatus('expired')
        return
      }

      const alreadyTaken = await hasUserTakenTest(user.email, testId)
      if (cancelled) return

      if (alreadyTaken) {
        goTo('submitted', {}, { replace: true, state: { reason: 'already-taken' } })
        return
      }

      setTest(found)
      setStatus('ready')
    }

    if (testId) {
      load().catch(() => !cancelled && setStatus('expired'))
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no id to fetch, nothing async to wait on
      setStatus('no-id')
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, user.email])

  // The very first Cloud Function call right after sign-in can occasionally
  // race the auth token attaching to the Functions client, getting rejected
  // as unauthenticated even though the user is genuinely signed in - force a
  // fresh token and retry once before surfacing an error.
  async function startAttemptWithRetry() {
    try {
      return await startTestAttempt(testId, name.trim(), studentId.trim())
    } catch (err) {
      if (err?.code !== 'functions/unauthenticated') throw err
      await user.getIdToken(true)
      return await startTestAttempt(testId, name.trim(), studentId.trim())
    }
  }

  // The approved-list check happens only in the startTest Cloud Function:
  // the list itself is never sent to this browser.
  async function handleBegin(e) {
    e.preventDefault()
    if (!name.trim() || !studentId.trim()) {
      setBeginError('Please fill in both your name and Student ID to begin.')
      return
    }

    setBeginError('')
    setBeginning(true)
    try {
      const attemptId = await startAttemptWithRetry()

      if (test.strictMode && document.documentElement.requestFullscreen) {
        // Best-effort: must be requested inside this click handler (a real user
        // gesture) - browsers reject it if called later from an effect.
        try {
          await document.documentElement.requestFullscreen()
        } catch {
          // Fullscreen denied/unsupported - proceed anyway, the tab/visibility
          // detection in TestInterface still enforces strict mode.
        }
      }

      goTo('attempt', { sid: attemptId })
    } catch (err) {
      console.error('Failed to start test attempt:', err)
      if (err?.code === 'functions/already-exists') {
        goTo('submitted', {}, { replace: true, state: { reason: 'already-taken' } })
        return
      }
      setBeginError(
        err?.code === 'functions/permission-denied'
          ? 'You’re not on the approved list for this test. Check your name and Student ID, or contact your teacher.'
          : 'Something went wrong starting the test. Please try again.',
      )
    } finally {
      setBeginning(false)
    }
  }

  if (status === 'loading') return <LoadingScreen label="Opening the test…" />

  if (status === 'expired' || status === 'no-id') {
    const Icon = status === 'expired' ? Hourglass : Unlink
    return (
      <section className="take-card take-center">
        <Icon size={32} className="take-icon take-icon-warn" />
        <h1>{status === 'expired' ? 'This test isn’t open' : 'No test found'}</h1>
        <p className="take-muted">
          {status === 'expired'
            ? 'It may have been closed by your teacher, or the link is wrong. Ask your teacher for the current link.'
            : 'Use the link your teacher gave you.'}
        </p>
      </section>
    )
  }

  const filled = [name, studentId].filter((v) => v.trim() !== '').length

  return (
    <div className="start">
      <header className="start-head">
        <h1>{test.displayName}</h1>
        <p className="start-meta">
          <span>
            <ListChecks size={16} /> {test.questions.length} question{test.questions.length === 1 ? '' : 's'}
          </span>
          <span>
            <Clock size={16} /> {test.minutes} minute{test.minutes === 1 ? '' : 's'}
          </span>
        </p>
      </header>

      <form className="take-card start-form" onSubmit={handleBegin}>
        <div className="take-progress" aria-hidden="true">
          <div className="take-progress-fill" style={{ width: `${(filled / 2) * 100}%` }} />
        </div>

        <label className="field">
          <span>Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </label>
        <label className="field">
          <span>Student ID</span>
          <input value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
        </label>

        <p className="take-note">
          <Info size={16} />
          <span>
            Read each question carefully. You can take this test only once.
            {test.strictMode && ' It runs full screen; leaving the tab or full screen for 3 seconds submits it automatically.'}
          </span>
        </p>

        {beginError && (
          <p className="form-error" role="alert">
            {beginError}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={beginning}>
          {beginning ? 'Starting…' : 'Begin test'} <ArrowRight size={18} />
        </button>
        <p className="take-signed-as">Signed in as {user.email}</p>
      </form>
    </div>
  )
}
