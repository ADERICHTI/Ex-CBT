import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, FileUp, X } from 'lucide-react'
import { DOC_ACCEPT, DocumentError, readDocument } from '../../lib/readDocument.js'
import { createTest, newQuestionId } from '../../services/firestore.js'
import { useAuth } from '../auth/useAuth.js'
import { formatCredits } from '../credits/pricing.js'
import { useWallet } from '../credits/walletContext.js'
import { HoldLine, Progress, TierPicker } from './AiParts.jsx'
import AiStudio from './AiStudio.jsx'
import { AI_FEATURES, holdRange } from './catalog.js'
import { IDEAS } from './createIdeas.js'
import { useAiRun } from './useAiRun.js'

const FEATURE = 'create-test'
const spec = AI_FEATURES[FEATURE]

// "Create with AI" in Dawn's window (AiStudio, shared with PeraForm):
// describe the test (with exam ideas to start from), or switch to notes -
// add a document (drop it, paste a copied file, or choose it: PDF, Word or
// text, read in the browser by lib/readDocument.js) or paste its text. Questions appear as Dawn writes them; Cancel is
// free. The result is saved as a draft test, ready to check and publish.
export default function CreateTestDialog({ open, onClose, initialMode = 'describe' }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { spendable, billing, loaded } = useWallet()
  const [mode, setMode] = useState('describe')
  const [text, setText] = useState('')
  const [tier, setTier] = useState(spec.defaultTier)
  const [doc, setDoc] = useState(null) // { name, pages, chars, cut }
  const [reading, setReading] = useState('') // file name while it's read
  const [docError, setDocError] = useState('')
  const fileRef = useRef(null)
  const ai = useAiRun()

  // Opened from Import → "Notes or a document": start in notes mode.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follow how it was opened
    if (open) setMode(initialMode)
  }, [open, initialMode])

  const maxChars = spec.maxChars[mode]
  const range = holdRange(billing, FEATURE, tier, mode, Math.max(text.trim().length, 1))
  const short = loaded && spendable < range.min

  // A document dropped, pasted or picked: read it here (nothing is
  // uploaded) and put its text in the field, where it can still be edited.
  async function addFile([file]) {
    if (!file || reading) return
    setMode('notes')
    setDocError('')
    setReading(file.name)
    try {
      const read = await readDocument(file)
      const max = spec.maxChars.notes
      setText(read.text.slice(0, max))
      setDoc({ name: read.name, pages: read.pages, chars: Math.min(read.text.length, max), cut: read.text.length > max })
    } catch (err) {
      setDocError(err instanceof DocumentError ? err.message : `“${file.name}” couldn’t be read. Try again, or paste its text.`)
    } finally {
      setReading('')
    }
  }

  function removeDoc() {
    setDoc(null)
    setText('')
  }

  async function generate() {
    if (ai.running || text.trim().length < 3) return
    const data = await ai.run(FEATURE, tier, { mode, text }, { needed: range.min, spendable })
    if (!data) return
    const { title, minutes, questions } = data.result.test
    try {
      const id = await createTest(user.email, {
        displayName: title || 'Dawn’s test',
        minutes,
        questions: questions.map((q) => ({
          id: newQuestionId(),
          question: q.question,
          options: q.options,
          correct: q.answerIndex,
          explanation: q.explanation,
          difficulty: q.difficulty,
        })),
      })
      ai.finish()
      onClose()
      navigate(`/tests/${id}/questions`, {
        state: { notice: `Made with Dawn · used ${formatCredits(data.charged)} credits. Check it before you publish.` },
      })
    } catch {
      ai.finish()
      ai.setError('The test was written but couldn’t be saved. Please try again.')
    }
  }

  const modeButton = (
    <button
      type="button"
      className={`ai-prompt-mode${mode === 'notes' ? ' is-on' : ''}`}
      onClick={() => setMode((m) => (m === 'notes' ? 'describe' : 'notes'))}
      aria-pressed={mode === 'notes'}
      title={mode === 'notes' ? 'Describe it instead' : 'Use my notes instead'}
      aria-label={mode === 'notes' ? 'Describe it instead' : 'Use my notes instead'}
      disabled={ai.running}
    >
      <FileText size={18} />
    </button>
  )

  return (
    <AiStudio
      open={open}
      onClose={() => !ai.running && onClose()}
      running={ai.running}
      label="Create a test"
      sub={mode === 'describe' ? 'What should we create?' : 'Which notes should become a test?'}
      ideas={mode === 'describe' ? IDEAS : []}
      onIdea={(idea) => {
        setMode(idea.mode ?? 'describe')
        setText(idea.prompt)
      }}
      middle={
        ai.running ? (
          <Progress progress={ai.progress} elapsed={ai.elapsed} doing="Saving your test…" />
        ) : mode === 'notes' ? (
          <div className="dawn-doc">
            {reading ? (
              <p className="dawn-doc-chip" role="status">
                <FileText size={18} aria-hidden="true" /> Reading “{reading}”…
              </p>
            ) : doc ? (
              <p className="dawn-doc-chip">
                <FileText size={18} aria-hidden="true" />
                <span>
                  <b>{doc.name}</b>
                  <small>
                    {doc.pages ? `${doc.pages} ${doc.pages === 1 ? 'page' : 'pages'} · ` : ''}
                    {doc.chars.toLocaleString()} characters read
                    {doc.cut && ` · only the first ${spec.maxChars.notes.toLocaleString()} fit, the rest was left out`}
                  </small>
                </span>
                <button type="button" className="icon-btn" onClick={removeDoc} aria-label={`Remove ${doc.name}`}>
                  <X size={16} />
                </button>
              </p>
            ) : (
              <div className="dawn-doc-pick">
                <button type="button" className="btn btn-outline" onClick={() => fileRef.current.click()}>
                  <FileUp size={16} aria-hidden="true" /> Choose a file
                </button>
                <span>
                  or drop it here, or paste a copied file. PDF, Word or text. You can also paste the text below.
                </span>
              </div>
            )}
            {docError && (
              <p className="form-error" role="alert">
                {docError}
              </p>
            )}
            <p className="ai-doc-hint">
              Lesson notes, a textbook chapter or a syllabus: Dawn writes questions only about what it says, with the
              answers marked. Files are read in your browser, not uploaded.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept={DOC_ACCEPT}
              hidden
              onChange={(e) => {
                const files = [...e.target.files]
                e.target.value = '' // so the same file can be picked again
                addFile(files)
              }}
            />
          </div>
        ) : null
      }
      prompt={{
        value: text,
        onChange: setText,
        placeholder:
          mode === 'describe'
            ? 'Describe the test: subject, class or level, how many questions…'
            : 'Paste your notes or syllabus here…',
        maxChars,
        onSubmit: generate,
        multiline: mode === 'notes',
        leading: modeButton,
      }}
      onFiles={addFile}
      short={short}
      onCancel={ai.cancel}
      error={ai.error}
      optionsSummary={`Options · ${tier[0].toUpperCase() + tier.slice(1)} quality · up to ${formatCredits(range.max)} credits${
        text.length > 0 ? ` · ${text.length.toLocaleString()} / ${maxChars.toLocaleString()} characters` : ''
      }`}
      options={
        <>
          <TierPicker feature={FEATURE} billing={billing} tier={tier} onTier={setTier} disabled={ai.running} />
          <HoldLine range={range} spendable={spendable} loaded={loaded} hidden={ai.running} />
        </>
      }
      note="Dawn can make mistakes, so check every question and answer before you publish. Each question comes with an explanation and a difficulty (only you see them). Uses your Quality Tools AI credits; cancelling is free."
    />
  )
}
