import { useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, CircleSlash, Info, ThumbsUp } from 'lucide-react'
import { formatCredits } from '../credits/pricing.js'
import { useWallet } from '../credits/walletContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import AiStudio from './AiStudio.jsx'
import { AI_FEATURES, holdRange } from './catalog.js'
import { useAiRun } from './useAiRun.js'

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

const ANALYSE_IDEAS = [
  {
    key: 'reteach',
    title: 'What should I reteach?',
    prompt: 'What should I reteach next week, and to whom?',
    art: { sky: '#fff1dc', sky2: '#ffd9b0', ground: '#f4b183', accent: '#e8743b' },
    icon: 'GraduationCap',
  },
  {
    key: 'fix',
    title: 'Which questions need fixing?',
    prompt: 'Which questions may be faulty or need rewording before I use this test again?',
    art: { sky: '#eef0ff', sky2: '#d3d8ff', ground: '#a3acf5', accent: '#4f46e5' },
    icon: 'ClipboardList',
  },
  {
    key: 'overall',
    title: 'How did the class do?',
    prompt: 'Give me a short overview of how the class did overall.',
    art: { sky: '#eaf7e4', sky2: '#c8ecb8', ground: '#8fcf72', accent: '#3e9b3a' },
    icon: 'BookOpen',
  },
]

// "Analyse results" in Dawn's window: the server sums up the results (totals
// only: no names, no one's own answers) and Dawn writes a plain-language
// report. Read-only: it changes nothing.
//   questions: the test's questions (to name them "Question 3")
export default function AnalyseResultsDialog({ open, onClose, testId, title, questions, count }) {
  const { spendable, billing, loaded } = useWallet()
  const [tier, setTier] = useState(spec.defaultTier)
  const [focus, setFocus] = useState('')
  const [report, setReport] = useState(null)
  const ai = useAiRun()

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

  const view = report && (
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
                  <Icon size={14} aria-hidden="true" /> <strong>{n ? `Question ${n}` : 'The whole test'}</strong> ·{' '}
                  {kind.label}
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
        Used {formatCredits(report.charged)} credits. Dawn can make mistakes - check against the numbers in the
        Summary.
      </p>
    </div>
  )

  return (
    <AiStudio
      open={open}
      onClose={close}
      running={ai.running}
      label="Analyse results"
      context={`${title || 'Untitled test'} · ${count} result${count === 1 ? '' : 's'}`}
      sub="What should the report look at?"
      ideas={ANALYSE_IDEAS}
      onIdea={(idea) => setFocus(idea.prompt)}
      middle={
        ai.running ? (
          <Progress progress={ai.progress} elapsed={ai.elapsed} doing="Finishing the report…" unit="finding" />
        ) : (
          view
        )
      }
      prompt={{
        value: focus,
        onChange: setFocus,
        placeholder: 'Anything you want to know? (optional) Or just press Ask Dawn',
        maxChars: spec.maxChars.analyse,
        onSubmit: run,
        optional: true,
      }}
      actions={
        report && !ai.running ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={run}>
              Analyse again
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
      note="A plain-language report: how the class did, questions that were too easy or too hard, and ones that may need a second look. Only totals go to Dawn - never names, emails or anyone’s own answers. Nothing in your test changes."
    />
  )
}
