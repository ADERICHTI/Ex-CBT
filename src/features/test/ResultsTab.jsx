import { useEffect, useMemo, useState } from 'react'
import { Download, Search, Trash2 } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { downloadCsv, submissionsToCsv } from '../../services/csv.js'
import { deleteSubmission, watchSubmissions } from '../../services/firestore.js'
import { useAuth } from '../auth/useAuth.js'
import { useTestEditor } from './testContext.js'

const toDate = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null)
const pct = (score, total) => (total ? Math.round((score / total) * 100) : 0)
const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

// Results tab: every submitted attempt with its score, a summary, search,
// CSV download, and removing a result (which lets that person retake it).
export default function ResultsTab() {
  const { test } = useTestEditor()
  const { user } = useAuth()
  const [toast, showToast] = useToast()
  const [subs, setSubs] = useState(null)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const total = test.questions?.length ?? 0

  useEffect(
    () =>
      watchSubmissions(
        test.id,
        user.email,
        (all) => {
          setSubs(
            all
              .filter((s) => s.testTaken)
              .sort((a, b) => (toDate(b.submittedAt)?.getTime() ?? 0) - (toDate(a.submittedAt)?.getTime() ?? 0)),
          )
          setError(false)
        },
        () => setError(true),
      ),
    [test.id, user.email],
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!subs || !q) return subs ?? []
    return subs.filter((s) =>
      [s.name, s.studentId, s.userEmail].some((v) => String(v ?? '').toLowerCase().includes(q)),
    )
  }, [subs, search])

  const summary = useMemo(() => {
    if (!subs?.length) return null
    const scores = subs.map((s) => pct(s.score ?? 0, total))
    return {
      count: subs.length,
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      highest: Math.max(...scores),
      lowest: Math.min(...scores),
    }
  }, [subs, total])

  function download() {
    const rows = visible.map((s) => ({
      name: s.name,
      studentId: s.studentId,
      email: s.userEmail,
      score: s.score ?? 0,
      outOf: total,
      percent: pct(s.score ?? 0, total),
      startedAt: toDate(s.startedAt)?.toISOString() ?? '',
      submittedAt: toDate(s.submittedAt)?.toISOString() ?? '',
    }))
    downloadCsv(`${test.id}-results.csv`, submissionsToCsv(rows))
    showToast('Saved to your downloads')
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteSubmission(test.id, pending.id)
      showToast('Result deleted')
    } catch {
      showToast('Couldn’t delete the result. Please try again.')
    } finally {
      setDeleting(false)
      setPending(null)
    }
  }

  if (error) {
    return (
      <p className="form-error" role="alert">
        Couldn’t load the results. Check your connection and refresh.
      </p>
    )
  }
  if (!subs) return <p className="take-muted">Loading…</p>

  if (subs.length === 0) {
    return (
      <div className="questions-empty">
        <p>No results yet.</p>
        <p className="take-muted">
          {test.status === 'open'
            ? 'Results appear here as soon as candidates submit.'
            : 'Publish the test and share its link - results appear here as candidates submit.'}
        </p>
      </div>
    )
  }

  return (
    <div className="tab-stack">
      <section className="stats" aria-label="Summary">
        <div className="stat">
          <strong>{summary.count}</strong>
          <span>submitted</span>
        </div>
        <div className="stat">
          <strong>{summary.average}%</strong>
          <span>average</span>
        </div>
        <div className="stat">
          <strong>{summary.highest}%</strong>
          <span>highest</span>
        </div>
        <div className="stat">
          <strong>{summary.lowest}%</strong>
          <span>lowest</span>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <label className="searchbar results-search">
            <Search size={16} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, Student ID or email"
              aria-label="Search results"
            />
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={download}>
            <Download size={15} /> Download CSV
          </button>
        </header>

        {visible.length === 0 ? (
          <p className="take-muted">No results match “{search.trim()}”.</p>
        ) : (
          <div className="grid-table results-table" role="table" aria-label="Results">
            <div className="grid-row grid-head" role="row">
              <span role="columnheader">Candidate</span>
              <span role="columnheader">Student ID</span>
              <span role="columnheader">Score</span>
              <span role="columnheader">Submitted</span>
              <span role="columnheader" className="sr-only">
                Delete
              </span>
            </div>
            {visible.map((s) => (
              <div key={s.id} className="grid-row" role="row">
                <span role="cell" className="results-who">
                  <strong>{s.name}</strong>
                  <small>{s.userEmail}</small>
                </span>
                <span role="cell">{s.studentId}</span>
                <span role="cell" className="results-score">
                  {s.score ?? 0}/{total} <small>{pct(s.score ?? 0, total)}%</small>
                </span>
                <span role="cell" className="take-muted">
                  {toDate(s.submittedAt) ? when.format(toDate(s.submittedAt)) : '-'}
                </span>
                <span role="cell">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setPending(s)}
                    aria-label={`Delete ${s.name}’s result`}
                    title="Delete result"
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(pending)}
        title={`Delete ${pending?.name || 'this'}’s result?`}
        message="Their answers and score are removed for good, and they’ll be able to take the test again."
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
      {toast}
    </div>
  )
}
