import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, CircleCheck, Sparkles, X } from 'lucide-react'
import { CREDITS_URL } from '../credits/BalanceChip.jsx'
import { formatCredits } from '../credits/pricing.js'
import { useWallet } from '../credits/walletContext.js'
import { useTestEditor } from '../test/testContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import { AI_FEATURES, holdRange } from './catalog.js'
import { applied, hasFix } from './reviewFix.js'
import { useAiRun } from './useAiRun.js'
import './ai.css'

const FEATURE = 'review-test'
const spec = AI_FEATURES[FEATURE]

const KIND_LABELS = {
  'unclear-wording': 'Unclear wording',
  'doubtful-answer': 'Check the answer',
  'two-correct': 'More than one right answer',
  'weak-options': 'Weak wrong options',
  spelling: 'Spelling and grammar',
  giveaway: 'Gives the answer away',
  other: 'Worth a look',
}


// "Review with AI" on the Questions tab: the AI reads the saved test (its
// questions, options and marked answers) and suggests fixes. Nothing
// changes until the teacher presses Apply on a suggestion.
export default function ReviewDialog({ open, onClose }) {
  const ref = useRef(null)
  const { test, draft, edit, flush } = useTestEditor()
  const { spendable, billing, loaded } = useWallet()
  const [tier, setTier] = useState(spec.defaultTier)
  const [focus, setFocus] = useState('')
  const [report, setReport] = useState(null) // { summary, suggestions, charged }
  const [done, setDone] = useState({}) // index → 'applied' | 'dismissed'
  const ai = useAiRun()

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // The test goes in as JSON; size the estimate on it.
  const chars = useMemo(() => JSON.stringify(draft.questions).length + focus.length, [draft.questions, focus])
  const range = holdRange(billing, FEATURE, tier, 'review', chars)
  const short = loaded && spendable < range.min
  const byId = useMemo(() => new Map(draft.questions.map((q, i) => [q.id, { q, n: i + 1 }])), [draft.questions])

  function close() {
    if (ai.running) return
    onClose()
  }

  async function run() {
    setReport(null)
    setDone({})
    // The server reads the saved test, so save any typing first.
    if (!(await flush())) {
      ai.setError('Your latest changes couldn’t be saved, so the review would miss them. Try again in a moment.')
      return
    }
    const data = await ai.run(FEATURE, tier, { testId: test.id, focus }, { needed: range.min, spendable })
    if (!data) return
    ai.finish()
    setReport({ ...data.result, charged: data.charged })
  }

  function apply(index, s) {
    const target = byId.get(s.questionId)
    const next = applied(target?.q, s)
    if (!next) return
    edit((d) => ({ ...d, questions: d.questions.map((q) => (q.id === s.questionId ? { ...q, ...next } : q)) }))
    setDone((prev) => ({ ...prev, [index]: 'applied' }))
  }

  const suggestions = report?.suggestions ?? []
  const open_ = suggestions.filter((_, i) => !done[i]).length

  return (
    <dialog
      ref={ref}
      className="confirm review-dialog"
      aria-label="Review with AI"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <div className="confirm-body">
        <div className="collab-head">
          <h2>
            <Sparkles size={18} /> Review with AI
          </h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" disabled={ai.running}>
            <X size={18} />
          </button>
        </div>

        {!report && !ai.running && (
          <>
            <p>
              The AI checks each question for unclear wording, a doubtful answer, more than one right option, weak
              wrong options and spelling. Nothing changes until you press <strong>Apply</strong> on a suggestion.
            </p>
            <label className="field">
              <span>Anything to focus on? (optional)</span>
              <input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                maxLength={spec.maxChars.review}
                placeholder="e.g. it’s for Primary 4 - keep the English simple"
              />
            </label>
          </>
        )}

        {ai.running && (
          <Progress progress={ai.progress} elapsed={ai.elapsed} doing="Finishing the review…" unit="suggestion" />
        )}

        {report && (
          <div className="review-report">
            {report.summary && <p className="review-summary">{report.summary}</p>}
            {suggestions.length === 0 ? (
              <p className="form-success">No problems found. The questions look sound.</p>
            ) : (
              <ul className="review-list">
                {suggestions.map((s, i) => {
                  const target = byId.get(s.questionId)
                  const next = applied(target?.q, s)
                  const state = done[i]
                  return (
                    <li key={i} className={`review-item${state ? ` is-${state}` : ''}`}>
                      <p className="review-kind">
                        <strong>{target ? `Question ${target.n}` : 'A removed question'}</strong> ·{' '}
                        {KIND_LABELS[s.kind] ?? KIND_LABELS.other}
                      </p>
                      <p>{s.detail}</p>
                      {hasFix(s) && next && (
                        <div className="review-fix">
                          {s.question && <p className="review-fix-q">{s.question}</p>}
                          {(s.options || s.answerIndex != null) && (
                            <ol className="review-fix-options">
                              {next.options.map((o, j) => (
                                <li key={j} className={next.correct === j ? 'is-correct' : ''}>
                                  {next.correct === j && <CircleCheck size={14} aria-label="Correct answer" />}
                                  {o}
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                      {state ? (
                        <p className="review-state">
                          {state === 'applied' ? (
                            <>
                              <Check size={14} /> Applied
                            </>
                          ) : (
                            'Dismissed'
                          )}
                        </p>
                      ) : (
                        <div className="review-actions">
                          {hasFix(s) && next && test.status !== 'open' && (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => apply(i, s)}>
                              Apply
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDone((prev) => ({ ...prev, [i]: 'dismissed' }))}
                          >
                            {hasFix(s) ? 'Dismiss' : 'OK'}
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="ai-create-note">
              Used {formatCredits(report.charged)} credits.{' '}
              {suggestions.length > 0 && (open_ > 0 ? `${open_} suggestion${open_ === 1 ? '' : 's'} left.` : 'All done.')}
            </p>
          </div>
        )}

        {ai.error && (
          <p className="form-error" role="alert">
            {ai.error}
          </p>
        )}

        {!ai.running && (
          <details className="ai-create-options">
            <summary>
              Options · {tier[0].toUpperCase() + tier.slice(1)} quality · up to {formatCredits(range.max)} credits
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <TierPicker feature={FEATURE} billing={billing} tier={tier} onTier={setTier} />
            <HoldLine range={range} spendable={spendable} loaded={loaded} />
          </details>
        )}

        <div className="confirm-actions">
          {ai.running ? (
            <button type="button" className="btn btn-ghost" onClick={ai.cancel}>
              Cancel (free)
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={close}>
                Close
              </button>
              {short ? (
                <a href={CREDITS_URL} target="_blank" rel="noopener" className="btn btn-primary">
                  Top up
                </a>
              ) : (
                <button type="button" className="btn btn-primary" onClick={run}>
                  <Sparkles size={16} /> {report ? 'Review again' : 'Review'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}
