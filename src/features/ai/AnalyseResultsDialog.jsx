import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, CircleSlash, Info, Sparkles, ThumbsUp, X } from 'lucide-react'
import { CREDITS_URL } from '../credits/BalanceChip.jsx'
import { formatCredits } from '../credits/pricing.js'
import { useWallet } from '../credits/walletContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import { AI_FEATURES, holdRange } from './catalog.js'
import { useAiRun } from './useAiRun.js'
import './ai.css'

const FEATURE = 'analyse-test-results'
const spec = AI_FEATURES[FEATURE]

const KINDS = {
  'too-easy': { label: 'Too easy', icon: ArrowDown },
  'too-hard': { label: 'Too hard', icon: ArrowUp },
  'unused-option': { label: 'Unused option', icon: CircleSlash },
  'possible-problem': { label: 'Check this question', icon: AlertTriangle },
  'strong-result': { label: 'Went well', icon: ThumbsUp },
  other: { label: 'Worth a look', icon: Info },
}

// Results → "Analyse with AI": the server sums up the results (totals only:
// no names, no one's own answers) and the AI writes a plain-language report.
// Read-only: it changes nothing.
//   questions: the test's questions (to name them "Question 3")
export default function AnalyseResultsDialog({ open, onClose, testId, questions, count }) {
  const ref = useRef(null)
  const { spendable, billing, loaded } = useWallet()
  const [tier, setTier] = useState(spec.defaultTier)
  const [focus, setFocus] = useState('')
  const [report, setReport] = useState(null)
  const ai = useAiRun()

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // The statistics are sized roughly on the questions and their options.
  const chars = JSON.stringify(questions).length + 300 + focus.length
  const range = holdRange(billing, FEATURE, tier, 'analyse', chars)
  const short = loaded && spendable < range.min
  const numberOf = new Map(questions.map((q, i) => [q.id, i + 1]))

  function close() {
    if (!ai.running) onClose()
  }

  async function run() {
    setReport(null)
    const data = await ai.run(FEATURE, tier, { testId, focus }, { needed: range.min, spendable })
    if (!data) return
    ai.finish()
    setReport({ ...data.result, charged: data.charged })
  }

  return (
    <dialog
      ref={ref}
      className="confirm review-dialog"
      aria-label="Analyse results with AI"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <div className="confirm-body">
        <div className="collab-head">
          <h2>
            <Sparkles size={18} /> Analyse results with AI
          </h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close" disabled={ai.running}>
            <X size={18} />
          </button>
        </div>

        {!report && !ai.running && (
          <>
            <p>
              A plain-language report on how the test went across {count} result{count === 1 ? '' : 's'}: which
              questions were too easy or too hard, and which may be faulty. Only totals are sent - never names,
              emails or anyone’s own answers. It changes nothing.
            </p>
            <label className="field">
              <span>Anything you want to know? (optional)</span>
              <input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                maxLength={spec.maxChars.analyse}
                placeholder="e.g. what should I reteach next week?"
              />
            </label>
          </>
        )}

        {ai.running && (
          <Progress progress={ai.progress} elapsed={ai.elapsed} doing="Finishing the report…" unit="finding" />
        )}

        {report && (
          <div className="review-report">
            <p className="review-summary">{report.summary}</p>
            {report.findings.length > 0 && (
              <ul className="review-list">
                {report.findings.map((f, i) => {
                  const kind = KINDS[f.kind] ?? KINDS.other
                  const Icon = kind.icon
                  const n = numberOf.get(f.questionId)
                  return (
                    <li key={i} className="review-item">
                      <p className="review-kind">
                        <Icon size={14} aria-hidden="true" /> <strong>{n ? `Question ${n}` : 'The whole test'}</strong>{' '}
                        · {kind.label}
                      </p>
                      <p>{f.detail}</p>
                    </li>
                  )
                })}
              </ul>
            )}
            {report.nextSteps.length > 0 && (
              <>
                <h3 className="report-steps-title">Next steps</h3>
                <ul className="report-steps">
                  {report.nextSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="ai-create-note">
              Used {formatCredits(report.charged)} credits. AI can make mistakes - check against the numbers in the
              Summary.
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
                  <Sparkles size={16} /> {report ? 'Analyse again' : 'Analyse'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}
