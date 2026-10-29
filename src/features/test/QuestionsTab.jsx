import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, CircleCheck, Copy, Lock, MessageSquareText, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import MenuButton from '../../lib/MenuButton.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { parseQuestionsFile } from '../../services/csv.js'
import { DIFFICULTIES, newQuestionId } from '../../services/firestore.js'
import ReviewDialog from '../ai/ReviewDialog.jsx'
import { useTestEditor } from './testContext.js'

const blankQuestion = () => ({
  id: newQuestionId(),
  question: '',
  options: ['', '', '', ''],
  correct: null,
  explanation: '',
  difficulty: '',
})

const DIFFICULTY_LABELS = { '': 'No difficulty', easy: 'Easy', medium: 'Medium', hard: 'Hard' }

// Questions tab: one card per question - its text, the answer options, and
// which option is correct (the radio). Saved automatically.
export default function QuestionsTab() {
  const { test, draft, edit } = useTestEditor()
  const [toast, showToast] = useToast()
  const [pending, setPending] = useState(null) // { kind: 'question' | 'option', index, option? }
  const [reviewing, setReviewing] = useState(false)
  // Questions whose explanation box was opened (ones with text always show it).
  const [explaining, setExplaining] = useState(() => new Set())
  const fileRef = useRef(null)
  // Answers are matched to questions by position, so changing questions
  // while candidates are sitting the test would mark them wrongly.
  const locked = test.status === 'open'
  const questions = draft.questions

  const setQuestion = (index, fn) =>
    edit((d) => ({ ...d, questions: d.questions.map((q, i) => (i === index ? fn(q) : q)) }))

  function addQuestion() {
    edit((d) => ({ ...d, questions: [...d.questions, blankQuestion()] }))
    // Focus the new question once it's drawn.
    requestAnimationFrame(() => {
      const all = document.querySelectorAll('.q-text')
      all[all.length - 1]?.focus()
    })
  }

  function move(index, by) {
    edit((d) => {
      const next = [...d.questions]
      const [q] = next.splice(index, 1)
      next.splice(index + by, 0, q)
      return { ...d, questions: next }
    })
  }

  function duplicate(index) {
    edit((d) => {
      const next = [...d.questions]
      next.splice(index + 1, 0, { ...d.questions[index], id: newQuestionId(), options: [...d.questions[index].options] })
      return { ...d, questions: next }
    })
  }

  function removeOption(qIndex, oIndex) {
    setQuestion(qIndex, (q) => {
      const options = q.options.filter((_, i) => i !== oIndex)
      let correct = q.correct
      if (correct === oIndex) correct = null
      else if (correct != null && correct > oIndex) correct -= 1
      return { ...q, options, correct }
    })
  }

  function confirmRemove() {
    if (pending.kind === 'question') {
      edit((d) => ({ ...d, questions: d.questions.filter((_, i) => i !== pending.index) }))
      showToast('Question deleted')
    } else {
      removeOption(pending.index, pending.option)
    }
    setPending(null)
  }

  async function importMore(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const rows = await parseQuestionsFile(file)
      const good = rows.filter((r) => r.valid)
      const skipped = rows.length - good.length
      if (!good.length) {
        showToast('No usable questions in that file')
        return
      }
      edit((d) => ({
        ...d,
        questions: [
          ...d.questions,
          ...good.map((r) => ({
            id: newQuestionId(),
            question: r.question,
            options: r.options,
            correct: r.options.findIndex((o) => o.toLowerCase() === r.answer.toLowerCase()),
          })),
        ],
      }))
      showToast(
        `Added ${good.length} question${good.length === 1 ? '' : 's'}` +
          (skipped ? ` - ${skipped} row${skipped === 1 ? '' : 's'} had problems and were left out` : ''),
      )
    } catch (err) {
      showToast(err.message || 'Couldn’t read that file')
    }
  }

  const unmarked = questions.filter((q) => q.correct == null).length

  return (
    <div className="questions">
      {locked && (
        <p className="form-notice questions-locked" role="status">
          <Lock size={15} />
          <span>
            This test is open, so its questions can’t change while candidates are taking it. Close the test
            (top right) to edit them.
          </span>
        </p>
      )}
      {!locked && (test.submissionCount ?? 0) > 0 && (
        <p className="form-notice" role="status">
          Results already in keep the scores they got. Changes apply to anyone who takes the test from now on.
        </p>
      )}

      <div className="questions-head">
        <p className="questions-count">
          {questions.length} question{questions.length === 1 ? '' : 's'}
          {unmarked > 0 && questions.length > 0 && (
            <span className="questions-warn"> · {unmarked} without a correct answer</span>
          )}
        </p>
        {!locked && questions.length > 0 && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setReviewing(true)}>
            <Sparkles size={15} /> Review with AI
          </button>
        )}
      </div>

      {questions.length === 0 && (
        <div className="questions-empty">
          <p>No questions yet.</p>
          <p className="take-muted">Add your first question, or import a CSV or JSON file of them.</p>
        </div>
      )}

      <fieldset className="questions-list" disabled={locked}>
        {questions.map((q, index) => (
          <section key={q.id} className="q-card" aria-label={`Question ${index + 1}`}>
            <div className="q-head">
              <span className="q-num">{index + 1}</span>
              <textarea
                className="q-text"
                value={q.question}
                rows={Math.min(6, Math.max(1, Math.ceil(q.question.length / 70)))}
                onChange={(e) => {
                  const question = e.target.value
                  setQuestion(index, (x) => ({ ...x, question }))
                }}
                placeholder="Type the question"
                aria-label={`Question ${index + 1}`}
              />
            </div>

            <div className="q-options" role="radiogroup" aria-label={`Correct answer for question ${index + 1}`}>
              {q.options.map((option, oIndex) => {
                const correct = q.correct === oIndex
                return (
                  <div key={oIndex} className={`q-option${correct ? ' correct' : ''}`}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={correct}
                      className="q-mark"
                      onClick={() => setQuestion(index, (x) => ({ ...x, correct: oIndex }))}
                      title={correct ? 'Correct answer' : 'Mark as the correct answer'}
                      aria-label={`Mark option ${String.fromCharCode(65 + oIndex)} as correct`}
                    >
                      {correct ? <CircleCheck size={18} /> : String.fromCharCode(65 + oIndex)}
                    </button>
                    <input
                      value={option}
                      onChange={(e) => {
                        const text = e.target.value
                        setQuestion(index, (x) => ({ ...x, options: x.options.map((o, i) => (i === oIndex ? text : o)) }))
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                      aria-label={`Question ${index + 1}, option ${String.fromCharCode(65 + oIndex)}`}
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() =>
                          option.trim()
                            ? setPending({ kind: 'option', index, option: oIndex })
                            : removeOption(index, oIndex)
                        }
                        aria-label={`Remove option ${String.fromCharCode(65 + oIndex)}`}
                        title="Remove option"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )
              })}
              {q.options.length < 8 && (
                <button
                  type="button"
                  className="link-btn q-add-option"
                  onClick={() => setQuestion(index, (x) => ({ ...x, options: [...x.options, ''] }))}
                >
                  <Plus size={14} /> Add option
                </button>
              )}
            </div>

            {(q.explanation || explaining.has(q.id)) && (
              <label className="q-explain">
                <span>Explanation (only you see this)</span>
                <textarea
                  value={q.explanation ?? ''}
                  rows={2}
                  onChange={(e) => {
                    const explanation = e.target.value
                    setQuestion(index, (x) => ({ ...x, explanation }))
                  }}
                  placeholder="Why the answer is right - handy when you go over the test with candidates"
                />
              </label>
            )}

            <div className="q-foot">
              <MenuButton
                className={`q-difficulty q-difficulty-${q.difficulty || 'none'}`}
                align="left"
                icon={
                  <>
                    {DIFFICULTY_LABELS[q.difficulty ?? '']} <ChevronDown size={13} />
                  </>
                }
                label={`Difficulty: ${DIFFICULTY_LABELS[q.difficulty ?? '']}`}
                items={['', ...DIFFICULTIES].map((d) => ({
                  label: DIFFICULTY_LABELS[d],
                  checked: (q.difficulty ?? '') === d,
                  onSelect: () => setQuestion(index, (x) => ({ ...x, difficulty: d })),
                }))}
              />
              {q.correct == null && <span className="q-hint">Click a letter to mark the correct answer</span>}
              <span className="q-tools">
                {!q.explanation && !explaining.has(q.id) && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setExplaining((prev) => new Set(prev).add(q.id))}
                    aria-label="Add an explanation"
                    title="Add an explanation"
                  >
                    <MessageSquareText size={16} />
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                  title="Move up"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(index, 1)}
                  disabled={index === questions.length - 1}
                  aria-label="Move down"
                  title="Move down"
                >
                  <ArrowDown size={16} />
                </button>
                <button type="button" className="icon-btn" onClick={() => duplicate(index)} aria-label="Duplicate" title="Duplicate">
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn q-delete"
                  onClick={() => setPending({ kind: 'question', index })}
                  aria-label="Delete question"
                  title="Delete question"
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          </section>
        ))}
      </fieldset>

      {!locked && (
        <div className="questions-add">
          <button type="button" className="btn btn-primary" onClick={addQuestion}>
            <Plus size={18} /> Add question
          </button>
          <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Import from file
          </button>
          <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={importMore} />
        </div>
      )}

      <ReviewDialog open={reviewing} onClose={() => setReviewing(false)} />

      <ConfirmModal
        open={Boolean(pending)}
        title={pending?.kind === 'question' ? `Delete question ${pending.index + 1}?` : 'Remove this option?'}
        message={
          pending?.kind === 'question'
            ? 'The question and its answer options are removed from the test.'
            : 'The option and its text are removed from the question.'
        }
        confirmLabel={pending?.kind === 'question' ? 'Delete' : 'Remove'}
        onConfirm={confirmRemove}
        onCancel={() => setPending(null)}
      />
      {toast}
    </div>
  )
}
