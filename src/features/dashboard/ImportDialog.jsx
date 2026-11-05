import { useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import QtWindow, { QtActions } from '../../lib/QtWindow.jsx'
import { CSV_TEMPLATE, JSON_TEMPLATE, downloadCsv, downloadJson, parseQuestionsFile } from '../../services/csv.js'
import { newQuestionId } from '../../services/firestore.js'
import DawnOrb from '../ai/DawnOrb.jsx'
import IdeaArt from '../ai/IdeaArt.jsx'

const HYPERCBT_ART = { sky: '#fff3e8', sky2: '#fed7aa', ground: '#f97316', accent: '#ea7a10' }
const FILE_ART = { sky: '#eaf7e4', sky2: '#c8ecb8', ground: '#8fcf72', accent: '#3e9b3a' }
const NOTES_ART = { sky: '#fff1dc', sky2: '#ffd9b0', ground: '#f4b183', accent: '#e8743b' }

// Dashboard → Import, in the Quality Tools window: a HyperCBT backup file,
// a CSV/JSON file of questions, or notes/a document with Dawn.
export default function ImportDialog({ open, onClose, onCreate, onDawn, busy }) {
  const inputRef = useRef(null)
  const hypercbtInputRef = useRef(null)
  const [file, setFile] = useState(null) // { kind: 'csv' | 'hypercbt', name, rows?, data? }
  const [error, setError] = useState('')

  // Fresh each time it opens.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on open
    setFile(null)
    setError('')
  }, [open])

  async function pickHypercbt(e) {
    const chosen = e.target.files?.[0]
    e.target.value = ''
    if (!chosen) return
    setError('')
    try {
      const text = await chosen.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('Couldn’t read that file. Invalid JSON.')
      }

      if (data.format !== 'hypercbt-test') {
        throw new Error('This file isn’t a HyperCBT test file.')
      }
      if (data.version !== 1) {
        throw new Error(`Unknown or newer version of HyperCBT file (version ${data.version ?? 'unknown'}).`)
      }
      if (!Array.isArray(data.questions) || !data.questions.length) {
        throw new Error('This HyperCBT test file has no questions in it.')
      }

      setFile({
        kind: 'hypercbt',
        name: data.displayName || chosen.name.replace(/\.(hypercbt\.)?json$/i, ''),
        data,
      })
    } catch (err) {
      setFile(null)
      setError(err.message || 'Couldn’t read that file.')
    }
  }

  async function pick(e) {
    const chosen = e.target.files?.[0]
    e.target.value = ''
    if (!chosen) return
    setError('')
    try {
      // If the user selected a HyperCBT JSON file here, detect it and route smoothly
      if (chosen.name.toLowerCase().endsWith('.json') || chosen.type === 'application/json') {
        const text = await chosen.text()
        try {
          const data = JSON.parse(text)
          if (data && data.format === 'hypercbt-test') {
            if (data.version !== 1) {
              throw new Error(`Unknown or newer version of HyperCBT file (version ${data.version ?? 'unknown'}).`)
            }
            if (!Array.isArray(data.questions) || !data.questions.length) {
              throw new Error('This HyperCBT test file has no questions in it.')
            }
            setFile({
              kind: 'hypercbt',
              name: data.displayName || chosen.name.replace(/\.(hypercbt\.)?json$/i, ''),
              data,
            })
            return
          }
        } catch (jsonErr) {
          if (jsonErr.message.includes('version of HyperCBT') || jsonErr.message.includes('HyperCBT test file')) {
            throw jsonErr
          }
          // otherwise continue to standard file parser
        }
      }

      const rows = await parseQuestionsFile(chosen)
      if (!rows.length) throw new Error('That file has no questions in it.')
      setFile({ kind: 'csv', name: chosen.name.replace(/\.(csv|json)$/i, ''), rows })
    } catch (err) {
      setFile(null)
      setError(err.message || 'Couldn’t read that file.')
    }
  }

  const isHypercbt = file?.kind === 'hypercbt'
  const good = !isHypercbt ? (file?.rows?.filter((r) => r.valid) ?? []) : []
  const bad = !isHypercbt ? (file?.rows?.filter((r) => !r.valid) ?? []) : []

  function create() {
    if (isHypercbt) {
      const questions = file.data.questions.map((q) => ({
        id: newQuestionId(),
        question: q.question,
        options: Array.isArray(q.options) ? [...q.options] : [],
        correct: typeof q.correct === 'number' ? q.correct : null,
        explanation: q.explanation || '',
        difficulty: q.difficulty || '',
      }))
      onCreate({
        displayName: file.data.displayName || file.name,
        minutes: Number(file.data.minutes) || 15,
        strictMode: Boolean(file.data.strictMode),
        questions,
        roster: Array.isArray(file.data.roster) ? file.data.roster : undefined,
      })
      return
    }

    const questions = good.map((r) => ({
      id: newQuestionId(),
      question: r.question,
      options: r.options,
      correct: r.options.findIndex((o) => o.toLowerCase() === r.answer.toLowerCase()),
    }))
    onCreate({ displayName: file.name, questions })
  }

  let title = 'Where are your questions coming from?'
  let hint = 'Bring in questions you already have. Nothing is changed where they came from.'

  if (file) {
    if (isHypercbt) {
      const qCount = file.data.questions.length
      const rCount = file.data.roster?.length ?? 0
      title = `Ready to import “${file.name}”`
      hint = `${qCount} question${qCount === 1 ? '' : 's'}${rCount > 0 ? ` · approved list with ${rCount} candidate${rCount === 1 ? '' : 's'}` : ''}`
    } else {
      title = `${good.length} question${good.length === 1 ? '' : 's'} ready`
      hint = 'The test starts as a draft. You can change anything before you open it.'
    }
  }

  return (
    <QtWindow
      open={open}
      onClose={onClose}
      icon={Upload}
      label="Import questions"
      context={file?.name}
      title={title}
      hint={hint}
      size={file ? 'small' : 'wide'}
      busy={busy}
    >
      {!file && (
        <>
          <div className="qt-cards">
            <button type="button" className="qt-card" onClick={() => hypercbtInputRef.current?.click()} disabled={busy}>
              <IdeaArt art={HYPERCBT_ART} icon="ClipboardList" />
              <b>HyperCBT file</b>
              <small>Restore a full test from a downloaded .json backup, including answers and settings.</small>
            </button>
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
          <input ref={hypercbtInputRef} type="file" accept=".json,application/json" hidden onChange={pickHypercbt} />
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

      {file && !isHypercbt && bad.length > 0 && (
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
          <button
            type="button"
            className="btn btn-primary"
            onClick={create}
            disabled={(isHypercbt ? file.data.questions.length === 0 : good.length === 0) || busy}
          >
            {busy ? 'Creating…' : 'Create test'}
          </button>
        </QtActions>
      )}
    </QtWindow>
  )
}
