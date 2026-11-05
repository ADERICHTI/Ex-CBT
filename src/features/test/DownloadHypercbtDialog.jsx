import { useState } from 'react'
import { Download, FileJson } from 'lucide-react'
import QtWindow, { QtActions } from '../../lib/QtWindow.jsx'
import { downloadJson } from '../../services/csv.js'
import { getRoster } from '../../services/firestore.js'

export default function DownloadHypercbtDialog({ open, onClose, test, draft, onToast }) {
  const [includeRoster, setIncludeRoster] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const payload = {
        format: 'hypercbt-test',
        version: 1,
        displayName: draft.displayName || 'Untitled test',
        minutes: Number(draft.minutes) || 15,
        strictMode: Boolean(test.strictMode),
        questions: draft.questions.map((q) => ({
          question: q.question,
          options: [...q.options],
          correct: q.correct ?? null,
          explanation: q.explanation ?? '',
          difficulty: q.difficulty ?? '',
        })),
      }

      if (includeRoster) {
        const roster = await getRoster(test.id)
        payload.roster = roster.map((u) => ({
          name: u.name,
          studentId: u.studentId,
        }))
      }

      const slug =
        (draft.displayName || 'test')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'test'
      downloadJson(`${slug}.hypercbt.json`, payload)
      onToast?.('Saved to your downloads')
      onClose()
    } catch {
      onToast?.('Couldn’t create the download file. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <QtWindow
      open={open}
      onClose={onClose}
      icon={FileJson}
      label="Download HyperCBT file"
      context={draft.displayName || 'Untitled test'}
      title="Download as a HyperCBT file"
      hint="Save a complete backup of this test (questions, correct answers, time limit and settings) to import back any time."
    >
      <div style={{ margin: '8px 0 20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={includeRoster}
            onChange={(e) => setIncludeRoster(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: 'var(--brand)' }}
          />
          <span>Include the approved list (names and Student IDs)</span>
        </label>
      </div>

      <QtActions>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={downloading}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
          <Download size={15} />
          <span>{downloading ? 'Preparing…' : 'Download file'}</span>
        </button>
      </QtActions>
    </QtWindow>
  )
}
