import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Info, Upload, X } from 'lucide-react'
import { CSV_TEMPLATE, JSON_TEMPLATE, downloadCsv, downloadJson, parseQuestionsFile } from '../../services/csv.js'
import { newQuestionId } from '../../services/firestore.js'

// Dashboard → Import: a CSV or JSON file of questions becomes a new draft
// test. Shows what was read (and which rows have problems) before creating
// anything - rows with problems are listed, never silently dropped.
export default function ImportDialog({ open, onClose, onCreate, busy }) {
  const ref = useRef(null)
  const inputRef = useRef(null)
  const [file, setFile] = useState(null) // { name, rows }
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) {
      setFile(null)
      setError('')
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  async function pick(e) {
    const chosen = e.target.files?.[0]
    e.target.value = ''
    if (!chosen) return
    setError('')
    try {
      const rows = await parseQuestionsFile(chosen)
      if (!rows.length) throw new Error('That file has no questions in it.')
      setFile({ name: chosen.name.replace(/\.(csv|json)$/i, ''), rows })
    } catch (err) {
      setFile(null)
      setError(err.message || 'Couldn’t read that file.')
    }
  }

  const good = file?.rows.filter((r) => r.valid) ?? []
  const bad = file?.rows.filter((r) => !r.valid) ?? []

  function create() {
    const questions = good.map((r) => ({
      id: newQuestionId(),
      question: r.question,
      options: r.options,
      correct: r.options.findIndex((o) => o.toLowerCase() === r.answer.toLowerCase()),
    }))
    onCreate({ displayName: file.name, questions })
  }

  return (
    <dialog
      ref={ref}
      className="confirm import-dialog"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(e) => e.target === ref.current && !busy && onClose()}
    >
      <div className="confirm-body">
        <div className="collab-head">
          <h2>
            <Upload size={18} /> Import questions
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={18} />
          </button>
        </div>

        {!file ? (
          <>
            <button type="button" className="import-option" onClick={() => inputRef.current?.click()}>
              <FileSpreadsheet size={22} />
              <span>
                <strong>Choose a CSV or JSON file</strong>
                <small>
                  One question per row: the question, its options separated by “|”, and the correct
                  answer (written exactly as one of the options).
                </small>
              </span>
            </button>
            <input ref={inputRef} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={pick} />
            <p className="import-note">
              <Download size={15} />
              <span>
                Start from a template:{' '}
                <button type="button" className="link-btn" onClick={() => downloadCsv('hypercbt-questions.csv', CSV_TEMPLATE)}>
                  CSV
                </button>{' '}
                ·{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => downloadJson('hypercbt-questions.json', JSON.parse(JSON_TEMPLATE))}
                >
                  JSON
                </button>
              </span>
            </p>
          </>
        ) : (
          <div className="import-done">
            <p>
              <strong>{good.length}</strong> question{good.length === 1 ? '' : 's'} ready from “{file.name}”.
            </p>
            {bad.length > 0 && (
              <div className="form-error" role="alert">
                {bad.length} row{bad.length === 1 ? '' : 's'} can’t be used and will be left out:
                <ul>
                  {bad.slice(0, 8).map((r) => (
                    <li key={r.row}>
                      Row {r.row}: {r.errors.join(', ')}
                    </li>
                  ))}
                  {bad.length > 8 && <li>…and {bad.length - 8} more</li>}
                </ul>
              </div>
            )}
            <p className="import-note">
              <Info size={15} />
              <span>The test starts as a draft. You can change anything before you open it.</span>
            </p>
          </div>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="confirm-actions">
          {file && (
            <button type="button" className="btn btn-ghost" onClick={() => setFile(null)} disabled={busy}>
              Choose another file
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={create}
            disabled={!file || good.length === 0 || busy}
          >
            {busy ? 'Creating…' : 'Create test'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
