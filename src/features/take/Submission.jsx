import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { useTestSession } from '../../hooks/useTestSession'
import { hasUserTakenTest } from '../../services/firestore'
import LoadingScreen from '../../components/LoadingScreen'
import { useAuth } from '../auth/useAuth.js'
import './take.css'

export default function Submission() {
  const location = useLocation()
  const { user } = useAuth()
  const { testId, goTo } = useTestSession()
  const reason = location.state?.reason

  // location.state survives page reloads (it's stored in the browser's
  // History API entry), so it can't be trusted as a "just redirected here"
  // signal - always re-verify against Firestore on mount instead.
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    let cancelled = false
    async function verify() {
      const taken = testId && (await hasUserTakenTest(user.email, testId))
      if (cancelled) return
      if (!taken) {
        goTo('', {}, { replace: true })
        return
      }
      setChecking(false)
    }

    verify()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, user.email])

  if (checking) return <LoadingScreen />

  const alreadyTaken = reason === 'already-taken'

  return (
    <section className="take-card take-center">
      <CircleCheck size={40} className="take-icon take-icon-ok" />
      <h1>{alreadyTaken ? 'You’ve already taken this test' : 'Test submitted'}</h1>
      <p className="take-muted">
        {alreadyTaken
          ? 'A submission already exists for this test under your account.'
          : 'Your answers are in. Your teacher will share your result.'}
      </p>
      <p className="take-muted">
        Each test can be taken once. If you think this is a mistake, contact your teacher.
      </p>
    </section>
  )
}
