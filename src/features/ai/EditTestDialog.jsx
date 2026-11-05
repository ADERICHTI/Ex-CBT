import { useMemo, useState } from 'react'
import { formatCredits } from '../credits/pricing.js'
import { useWallet } from '../credits/walletContext.js'
import { newQuestionId } from '../../services/firestore.js'
import { useTestEditor } from '../test/testContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import AiStudio from './AiStudio.jsx'
import { AI_FEATURES, holdRange } from './catalog.js'
import { useAiRun } from './useAiRun.js'

const FEATURE = 'edit-test'
const spec = AI_FEATURES[FEATURE]

// Starting points for the instruction (Dawn's idea cards).
const EDIT_IDEAS = [
  {
    key: 'harder',
    title: 'Add 5 harder questions',
    prompt: 'Add 5 harder questions on the same topics, at the end.',
    art: { sky: '#fff1dc', sky2: '#ffd9b0', ground: '#f4b183', accent: '#e8743b' },
    icon: 'GraduationCap',
  },
  {
    key: 'simple',
    title: 'Simpler English',
    prompt: 'Rewrite the questions and options in simpler English for younger pupils. Keep the same answers.',
    art: { sky: '#eaf7e4', sky2: '#c8ecb8', ground: '#8fcf72', accent: '#3e9b3a' },
    icon: 'BookOpen',
  },
  {
    key: 'explain',
    title: 'Explain every answer',
    prompt: 'Add a short explanation to every question that doesn’t have one.',
    art: { sky: '#eef0ff', sky2: '#d3d8ff', ground: '#a3acf5', accent: '#4f46e5' },
    icon: 'ClipboardList',
  },
]

// Dawn's test → the editor's draft. Questions keep their ids ("new-…" ones
// get fresh ids); answerIndex -1 means no marked answer.
function toDraft(draft, test) {
  const known = new Set(draft.questions.map((q) => q.id))
  const questions = test.questions.map((q) => ({
    id: known.has(q.id) ? q.id : newQuestionId(),
    question: q.question,
    options: q.options,
    correct: q.answerIndex >= 0 ? q.answerIndex : null,
    explanation: q.explanation ?? '',
    difficulty: q.difficulty ?? '',
  }))
  return {
    ...draft,
    displayName: test.title || draft.displayName,
    minutes: test.minutes ?? draft.minutes,
    questions,
  }
}

// What the change does, in counts, so the teacher can judge it before Apply.
function changes(before, after) {
  const old = new Map(before.questions.map((q) => [q.id, JSON.stringify(q)]))
  const kept = new Set(after.questions.map((q) => q.id))
  const added = after.questions.filter((q) => !old.has(q.id)).length
  const changed = after.questions.filter((q) => old.has(q.id) && old.get(q.id) !== JSON.stringify(q)).length
  const removed = before.questions.filter((q) => !kept.has(q.id)).length
  const lines = []
  if (added) lines.push(`${added} question${added === 1 ? '' : 's'} added`)
  if (changed) lines.push(`${changed} changed`)
  if (removed) lines.push(`${removed} removed`)
  if (after.displayName !== before.displayName) lines.push('title changed')
  if (after.minutes !== before.minutes) lines.push(`time limit ${after.minutes} min`)
  return { lines, removed }
}

// "Edit with Dawn": the teacher says what to change ("add 5 harder
// questions", "translate to French"); Dawn returns the whole test. Nothing
// changes until Apply, which is one step that Undo takes back.
export default function EditTestDialog({ open, onClose, onApplied }) {
  const { test, draft, edit, flush } = useTestEditor()
  const { spendable, billing, loaded } = useWallet()
  const [tier, setTier] = useState(spec.defaultTier)
  const [instruction, setInstruction] = useState('')
  const [proposal, setProposal] = useState(null) // { next, summary, lines, removed, charged }
  const ai = useAiRun()

  const chars = useMemo(() => JSON.stringify(draft.questions).length + instruction.length, [draft.questions, instruction])
  const range = holdRange(billing, FEATURE, tier, 'edit', chars)
  const short = loaded && spendable < range.min

  function close() {
    if (ai.running) return
    setProposal(null)
    onClose()
  }

  async function run() {
    setProposal(null)
    // The server reads the saved test, so save any typing first.
    if (!(await flush())) {
      ai.setError('Your latest changes couldn’t be saved, so Dawn would miss them. Try again in a moment.')
      return
    }
    const data = await ai.run(FEATURE, tier, { testId: test.id, instruction }, { needed: range.min, spendable })
    if (!data) return
    ai.finish()
    const result = data.result?.test
    if (!result?.questions?.length) {
      ai.setError('Dawn didn’t return a usable test. Nothing was changed. Try wording it another way.')
      return
    }
    const next = toDraft(draft, result)
    setProposal({ next, summary: data.result.summary, ...changes(draft, next), charged: data.charged })
  }

  function apply() {
    const { next } = proposal
    edit((d) => ({ ...d, displayName: next.displayName, minutes: next.minutes, questions: next.questions }))
    setProposal(null)
    setInstruction('')
    onClose()
    onApplied?.('Dawn’s changes applied. Press Ctrl+Z to undo.')
  }

  const proposal_ = proposal && (
    <div className="review-report">
      {proposal.summary && <p className="review-summary">{proposal.summary}</p>}
      <p className={proposal.lines.length ? 'form-success' : 'take-muted'}>
        {proposal.lines.length ? proposal.lines.join(' · ') : 'Dawn made no changes.'}
      </p>
      {proposal.removed > 0 && (
        <p className="questions-warn">
          {proposal.removed} of your questions {proposal.removed === 1 ? 'is' : 'are'} not in Dawn’s version. Check
          before applying.
        </p>
      )}
      <p className="ai-create-note">Used {formatCredits(proposal.charged)} credits. Nothing changes until you press Apply.</p>
    </div>
  )

  return (
    <AiStudio
      open={open}
      onClose={close}
      running={ai.running}
      label="Edit with Dawn"
      context={`${draft.displayName || 'Untitled test'} · ${draft.questions.length} question${draft.questions.length === 1 ? '' : 's'} · saved`}
      sub="What should Dawn change?"
      ideas={EDIT_IDEAS}
      onIdea={(idea) => setInstruction(idea.prompt)}
      middle={
        ai.running ? (
          <Progress progress={ai.progress} elapsed={ai.elapsed} doing="Finishing the edit…" unit="question" />
        ) : (
          proposal_
        )
      }
      prompt={{
        value: instruction,
        onChange: setInstruction,
        placeholder: 'For example: add 5 harder questions, or translate it to French',
        maxChars: spec.maxChars.edit,
        onSubmit: run,
      }}
      actions={
        proposal && !ai.running ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setProposal(null)}>
              Discard
            </button>
            <button type="button" className="btn btn-primary" onClick={apply} disabled={!proposal.lines.length}>
              Apply
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
      note="Dawn changes the whole test as you ask: questions, options, answers and explanations. You see what changed before anything is applied, and Undo takes it back. Uses your Quality Tools AI credits; cancelling is free."
    />
  )
}
