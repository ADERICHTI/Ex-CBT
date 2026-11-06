import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { useTestSession } from '../../hooks/useTestSession'
import { getTest, hasUserTakenTest, watchMySubmission } from '../../services/firestore'
import Spinner from '../../lib/Spinner.jsx'
import { useTestTheme } from '../../lib/useTestTheme.js'
import { useAuth } from '../auth/useAuth.js'
import './take.css'

const norm = (v) => String(v ?? '').trim().toLowerCase()

export default function Submission() {
  const location = useLocation()
  const { user } = useAuth()
  const { testId, goTo } = useTestSession()
  const reason = location.state?.reason
  const [test, setTest] = useState(null)
  const [mine, setMine] = useState(null) // their own finished attempt (live: shows the result once released)
  useTestTheme(test)

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
      setTest(await getTest(testId).catch(() => null))
      setChecking(false)
    }

    verify()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, user.email])

  // The teacher may release scores while this page is open.
  useEffect(() => {
    if (checking || !testId) return
    return watchMySubmission(testId, user.email, setMine, () => setMine(null))
  }, [checking, testId, user.email])

  if (checking) return <Spinner />

  // Released (Results → Release scores): the score, then each question with
  // their answer, the right one and the teacher's explanation.
  if (mine?.released && mine.review && test) {
    const total = mine.total ?? mine.review.length
    const score = mine.score ?? 0
    return (
      <div className="preview-result result-page">
        <section className="take-card">
          <p className="take-muted">{test.displayName || 'Your test'}</p>
          <h1>
            {score} / {total} correct · {total ? Math.round((score / total) * 100) : 0}%
          </h1>
          <ol className="preview-rows">
            {(test.questions ?? []).map((q, i) => {
              const picked = mine.answers?.[i] ?? null
              const correct = mine.review[i]?.correct ?? ''
              const right = Boolean(picked) && norm(picked) === norm(correct)
              const explanation = mine.review[i]?.explanation
              return (
                <li key={q.id ?? i} className={right ? 'is-right' : 'is-wrong'}>
                  <strong>{q.question}</strong>
                  <span>
                    {right ? '✓ ' : '✗ '}
                    {picked ? `You chose “${picked}”` : 'No answer'}
                    {!right && correct && ` · correct: “${correct}”`}
                  </span>
                  {explanation && <em className="result-why">{explanation}</em>}
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    )
  }

  const alreadyTaken = reason === 'already-taken'

  return (
    <section className="take-card take-center">
      <CircleCheck size={40} className="take-icon take-icon-ok" />
      <h1>{alreadyTaken ? 'You’ve already taken this test' : 'Test submitted'}</h1>
      <p className="take-muted">
        {alreadyTaken
          ? 'A submission already exists for this test under your account.'
          : 'Your answers are in. Your result shows here (and you get an email) when your teacher releases it.'}
      </p>
      <p className="take-muted">
        Each test can be taken once. If you think this is a mistake, contact your teacher.
      </p>
    </section>
  )
}
