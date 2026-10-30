import { useMemo, useState } from 'react'
import { Check, CircleCheck } from 'lucide-react'
import { formatCredits } from '../credits/pricing.js'
import { useWallet } from '../credits/walletContext.js'
import { useTestEditor } from '../test/testContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import AiStudio from './AiStudio.jsx'
import { AI_FEATURES, holdRange } from './catalog.js'
import { applied, hasFix } from './reviewFix.js'
import { useAiRun } from './useAiRun.js'

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

// Starting points for what to focus on (Dawn's idea cards).
const REVIEW_IDEAS = [
  {
    key: 'young',
    title: 'Simple English for young pupils',
    prompt: 'It’s for Primary 4 - flag anything worded too hard for them.',
    art: { sky: '#fff1dc', sky2: '#ffd9b0', ground: '#f4b183', accent: '#e8743b' },
    icon: 'BookOpen',
  },
  {
    key: 'exam',
    title: 'Exam standard: be strict',
    prompt: 'This is a final exam - be strict about doubtful answers and options that could both be right.',
    art: { sky: '#eef0ff', sky2: '#d3d8ff', ground: '#a3acf5', accent: '#4f46e5' },
    icon: 'GraduationCap',
  },
  {
    key: 'answers',
    title: 'Just check the answers',
    prompt: 'Only check that each marked answer is right; skip wording and spelling.',
    art: { sky: '#eaf7e4', sky2: '#c8ecb8', ground: '#8fcf72', accent: '#3e9b3a' },
    icon: 'ShieldCheck',
  },
]

// "Review this test" in Dawn's window: Dawn reads the saved test (its
// questions, options and marked answers) and suggests fixes. Nothing
// changes until the teacher presses Apply on a suggestion.
export default function ReviewDialog({ open, onClose }) {
  const { test, draft, edit, flush } = useTestEditor()
  const { spendable, billing, loaded } = useWallet()
  const [tier, setTier] = useState(spec.defaultTier)
  const [focus, setFocus] = useState('')
  const [report, setReport] = useState(null) // { summary, suggestions, charged }
  const [done, setDone] = useState({}) // index → 'applied' | 'dismissed'
  const ai = useAiRun()

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

  const report_ = report && (
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
  )

  return (
    <AiStudio
      open={open}
      onClose={close}
      running={ai.running}
      label="Review this test"
      context={`${draft.displayName || 'Untitled test'} · ${draft.questions.length} question${draft.questions.length === 1 ? '' : 's'} · saved`}
      sub="What should Dawn check?"
      ideas={REVIEW_IDEAS}
      onIdea={(idea) => setFocus(idea.prompt)}
      middle={
        ai.running ? (
          <Progress progress={ai.progress} elapsed={ai.elapsed} doing="Finishing the review…" unit="suggestion" />
        ) : (
          report_
        )
      }
      prompt={{
        value: focus,
        onChange: setFocus,
        placeholder: 'Anything to focus on? (optional) Or just press Ask Dawn',
        maxChars: spec.maxChars.review,
        onSubmit: run,
        optional: true,
      }}
      actions={
        report && !ai.running ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={run}>
              Review again
            </button>
            <button type="button" className="btn btn-primary" onClick={close}>
              Done
            </button>
          </>
        ) : null
      }
      short={short}
      onCancel={ai.cancel}
      error={ai.error}
      optionsSummary={`Options · ${tier[0].toUpperCase() + tier.slice(1)} quality · up to ${formatCredits(range.max)} credits`}
      options={
        <>
          <TierPicker feature={FEATURE} billing={billing} tier={tier} onTier={setTier} disabled={ai.running} />
          <HoldLine range={range} spendable={spendable} loaded={loaded} hidden={ai.running} />
        </>
      }
      note="Dawn checks for unclear wording, doubtful answers, more than one right option, weak wrong options and spelling. Nothing changes until you press Apply. Uses your Quality Tools AI credits; cancelling is free."
    />
  )
}
