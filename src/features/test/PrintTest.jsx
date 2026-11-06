import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import Spinner from '../../lib/Spinner.jsx'
import { canEditTest, getAnswerKey, getTest, joinQuestions } from '../../services/firestore.js'
import { useAuth } from '../auth/useAuth.js'
import './print.css'

export default function PrintTest() {
  const { testId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [test, setTest] = useState(null)
  const [questions, setQuestions] = useState([])
  const [version, setVersion] = useState('questions') // 'questions' | 'answers'

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [foundTest, key] = await Promise.all([getTest(testId), getAnswerKey(testId)])
        if (cancelled) return

        if (!canEditTest(foundTest, user)) {
          setLoadError('not-found')
          return
        }

        setTest(foundTest)
        setQuestions(joinQuestions(foundTest.questions, key))
      } catch {
        if (!cancelled) setLoadError('failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [testId, user])

  useEffect(() => {
    if (!test) return
    const prevTitle = document.title
    const titleSuffix = version === 'answers' ? ' (With answers)' : ''
    document.title = `${test.displayName || 'Untitled test'}${titleSuffix} · Print`
    return () => {
      document.title = prevTitle
    }
  }, [test, version])

  if (loading) {
    return <Spinner fill="page" label="Loading test for printing" />
  }

  if (loadError || !test) {
    return (
      <div className="print-page-wrapper">
        <div className="test-missing" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>
            {loadError === 'not-found' ? 'Test not found' : 'Couldn’t load this test'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            {loadError === 'not-found'
              ? 'This test doesn’t exist or belongs to another account.'
              : 'Check your connection and try again.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
            Back to my tests
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="print-page-wrapper">
      <header className="print-screen-bar" role="banner">
        <Link to={`/tests/${testId}/questions`} className="print-back-link" title="Return to editor">
          <ArrowLeft size={16} /> Back to editor
        </Link>

        <div className="print-segmented" role="radiogroup" aria-label="Print version">
          <button
            type="button"
            className={`print-seg-btn ${version === 'questions' ? 'active' : ''}`}
            onClick={() => setVersion('questions')}
            role="radio"
            aria-checked={version === 'questions'}
          >
            Questions only
          </button>
          <button
            type="button"
            className={`print-seg-btn ${version === 'answers' ? 'active' : ''}`}
            onClick={() => setVersion('answers')}
            role="radio"
            aria-checked={version === 'answers'}
          >
            With answers (owner’s copy)
          </button>
        </div>

        <div className="print-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
        </div>
      </header>

      <main className="print-paper">
        <header className="print-header">
          <div className="print-title-row">
            <h1 className="print-title">{test.displayName || 'Untitled test'}</h1>
            {version === 'answers' && <span className="print-badge">Owner’s copy · With answers</span>}
          </div>
          <div className="print-meta-row">
            <span>
              <strong>Time allowed:</strong> {test.minutes} {test.minutes === 1 ? 'minute' : 'minutes'}
            </span>
            <span>
              <strong>Total questions:</strong> {questions.length}
            </span>
          </div>

          <div className="print-candidate-lines">
            <div className="print-field-line">
              <span className="print-field-label">Candidate Name:</span>
              <span className="print-field-rule" />
            </div>
            <div className="print-field-line">
              <span className="print-field-label">Student ID:</span>
              <span className="print-field-rule" />
            </div>
            <div className="print-field-line">
              <span className="print-field-label">Date:</span>
              <span className="print-field-rule" />
            </div>
          </div>
        </header>

        {questions.length === 0 ? (
          <div className="print-empty-questions">No questions in this test yet.</div>
        ) : (
          <div className="print-questions">
            {questions.map((q, qIndex) => (
              <article className="print-question" key={q.id || qIndex}>
                <div className="print-q-text">
                  <span className="print-q-num">{qIndex + 1}.</span>
                  <span className="print-q-body">{q.question}</span>
                </div>

                <div className="print-options">
                  {q.options.map((opt, optIndex) => {
                    const letter = String.fromCharCode(65 + optIndex)
                    const isCorrect = version === 'answers' && q.correct === optIndex
                    return (
                      <div key={optIndex} className={`print-option ${isCorrect ? 'is-correct' : ''}`}>
                        <span className="print-option-letter">({letter})</span>
                        <span className="print-option-text">{opt}</span>
                        {isCorrect && <span className="print-correct-tag">✓ Correct</span>}
                      </div>
                    )
                  })}
                </div>

                {version === 'answers' && q.explanation && (
                  <div className="print-explanation">
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
