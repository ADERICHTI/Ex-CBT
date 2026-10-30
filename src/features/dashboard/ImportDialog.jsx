import { useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import QtWindow, { QtActions } from '../../lib/QtWindow.jsx'
import { CSV_TEMPLATE, JSON_TEMPLATE, downloadCsv, downloadJson, parseQuestionsFile } from '../../services/csv.js'
import { newQuestionId } from '../../services/firestore.js'
import DawnOrb from '../ai/DawnOrb.jsx'
import IdeaArt from '../ai/IdeaArt.jsx'

const FILE_ART = { sky: '#eaf7e4', sky2: '#c8ecb8', ground: '#8fcf72', accent: '#3e9b3a' }
const NOTES_ART = { sky: '#fff1dc', sky2: '#ffd9b0', ground: '#f4b183', accent: '#e8743b' }

// Dashboard → Import, in the Quality Tools window: a CSV/JSON file of
// questions becomes a new draft test (rows with problems are listed, never
// silently dropped), or notes/a document go to Dawn's Create window.
export default function ImportDialog({ open, onClose, onCreate, onDawn, busy }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null) // { name, rows }
  const [error, setError] = useState('')

  // Fresh each time it opens.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on open
    setFile(null)
    setError('')
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
    <QtWindow
      open={open}
      onClose={onClose}
      icon={Upload}
      label="Import questions"
      context={file?.name}
      title={file ? `${good.length} question${good.length === 1 ? '' : 's'} ready` : 'Where are your questions coming from?'}
      hint={
        file
          ? 'The test starts as a draft. You can change anything before you open it.'
          : 'Bring in questions you already have. Nothing is changed where they came from.'
      }
      size={file ? 'small' : 'wide'}
      busy={busy}
    >
      {!file && (
        <>
          <div className="qt-cards">
            <button type="button" className="qt-card" onClick={() => inputRef.current?.click()} disabled={busy}>
              <IdeaArt art={FILE_ART} icon="FileSpreadsheet" />
              <b>A CSV or JSON file</b>
              <small>
                One question per row: the question, its options separated by “|”, and the correct answer written
                exactly as one of the options.
              </small>
            </button>
            <button type="button" className="qt-card" onClick={onDawn} disabled={busy}>
              <IdeaArt art={NOTES_ART} icon="BookOpen" flip />
              <b>Notes or a document</b>
              <small>Paste lesson notes or a syllabus and Dawn writes the questions, with answers marked. Uses AI credits.</small>
              <span className="qt-card-tag">
                <DawnOrb size={20} /> with Dawn
              </span>
            </button>
          </div>
          <input ref={inputRef} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={pick} />
          <p className="qt-note">
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
      )}

      {file && bad.length > 0 && (
        <div className="form-error" role="alert">
          {bad.length} row{bad.length === 1 ? '' : 's'} can’t be used and will be left out:
          <ul className="import-bad">
            {bad.slice(0, 8).map((r) => (
              <li key={r.row}>
                Row {r.row}: {r.errors.join(', ')}
              </li>
            ))}
            {bad.length > 8 && <li>…and {bad.length - 8} more</li>}
          </ul>
        </div>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {file && (
        <QtActions>
          <button type="button" className="btn btn-ghost" onClick={() => setFile(null)} disabled={busy}>
            Choose another file
          </button>
          <button type="button" className="btn btn-primary" onClick={create} disabled={good.length === 0 || busy}>
            {busy ? 'Creating…' : 'Create test'}
          </button>
        </QtActions>
      )}
    </QtWindow>
  )
}
