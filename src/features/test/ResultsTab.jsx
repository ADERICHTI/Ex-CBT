import { useEffect, useMemo, useState } from 'react'
import { Download, EyeOff, Search, Send, Trash2 } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import Spinner from '../../lib/Spinner.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { downloadCsv, submissionsToCsv } from '../../services/csv.js'
import { testStats } from '../../lib/resultStats.js'
import { callReleaseScores, deleteSubmission, getAnswerKey, watchSubmissions } from '../../services/firestore.js'
import AnalyseResultsDialog from '../ai/AnalyseResultsDialog.jsx'
import { useAuth } from '../auth/useAuth.js'
import ResultsSummary from './ResultsSummary.jsx'
import { useTestEditor } from './testContext.js'

const toDate = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null)
const pct = (score, total) => (total ? Math.round((score / total) * 100) : 0)
const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

// Results tab, as in PeraForm: Summary (numbers, the spread of scores, each
// question's picks, Analyse with AI) and Individual (every submitted
// attempt with its score, search, CSV download, and removing a result -
// which lets that person retake it).
export default function ResultsTab() {
  const { test } = useTestEditor()
  const { user } = useAuth()
  const [toast, showToast] = useToast()
  const [subs, setSubs] = useState(null)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [view, setView] = useState('summary') // summary | individual
  const [analysing, setAnalysing] = useState(false)
  const [releasing, setReleasing] = useState(null) // 'release' | 'hide' (asking first)
  const [releaseBusy, setReleaseBusy] = useState(false)
  const [answers, setAnswers] = useState(null) // the answer key's correct options
  const total = test.questions?.length ?? 0

  useEffect(() => {
    let cancelled = false
    getAnswerKey(test.id).then(
      (key) => !cancelled && setAnswers(key.answers ?? []),
      () => !cancelled && setAnswers([]),
    )
    return () => {
      cancelled = true
    }
    // The key changes only when questions are saved; reload with the test.
  }, [test.id, test.updatedAt])

  useEffect(
    () =>
      watchSubmissions(
        test.id,
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

  const stats = useMemo(
    () => (subs?.length && answers ? testStats(test.questions ?? [], answers, subs) : null),
    [subs, answers, test.questions],
  )

  function download() {
    const rows = visible.map((s) => ({
      name: s.name,
      studentId: s.studentId,
      email: s.userEmail,
      // false = signed in with an email nobody proved; blank for older results.
      emailVerified: s.emailVerified ?? '',
      score: s.score ?? 0,
      outOf: total,
      percent: pct(s.score ?? 0, total),
      startedAt: toDate(s.startedAt)?.toISOString() ?? '',
      submittedAt: toDate(s.submittedAt)?.toISOString() ?? '',
    }))
    downloadCsv(`${test.id}-results.csv`, submissionsToCsv(rows))
    showToast('Saved to your downloads')
  }

  // Release scores: candidates see their result, the right answers and the
  // explanations (functions → releaseTestScores). Results that come in later
  // wait until the teacher releases them too.
  const unreleased = (subs ?? []).filter((s) => !s.released)
  async function confirmRelease() {
    setReleaseBusy(true)
    try {
      const release = releasing === 'release'
      await callReleaseScores({ testId: test.id, attemptIds: (release ? unreleased : subs).map((s) => s.id), release })
      showToast(release ? `Released to ${unreleased.length} ${unreleased.length === 1 ? 'candidate' : 'candidates'}` : 'Scores hidden')
    } catch (err) {
      showToast(err.message || 'Couldn’t do that. Please try again.')
    } finally {
      setReleaseBusy(false)
      setReleasing(null)
    }
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
  if (!subs) return <Spinner fill="box" label="Loading results" />

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
      <div className="results-release">
        <p className="take-muted">
          {unreleased.length === 0
            ? 'Scores released: candidates can see their result, the right answers and your explanations.'
            : unreleased.length === subs.length
              ? 'Candidates can’t see their scores yet.'
              : `${unreleased.length} new ${unreleased.length === 1 ? 'result hasn’t' : 'results haven’t'} been released yet.`}
        </p>
        {unreleased.length > 0 ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setReleasing('release')}>
            <Send size={15} /> Release scores ({unreleased.length})
          </button>
        ) : (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setReleasing('hide')}>
            <EyeOff size={15} /> Hide scores
          </button>
        )}
      </div>
      <div className="segmented results-switch" role="tablist" aria-label="Results view">
        <button type="button" role="tab" aria-selected={view === 'summary'} className={view === 'summary' ? 'active' : ''} onClick={() => setView('summary')}>
          Summary
        </button>
        <button type="button" role="tab" aria-selected={view === 'individual'} className={view === 'individual' ? 'active' : ''} onClick={() => setView('individual')}>
          Individual
        </button>
      </div>

      {view === 'summary' ? (
        stats ? (
          <ResultsSummary stats={stats} onAnalyse={() => setAnalysing(true)} />
        ) : (
          <Spinner fill="box" label="Working out the summary" />
        )
      ) : (
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
                  <small>
                    {s.userEmail}
                    {s.emailVerified === false && (
                      <span className="unverified-tag" title="This candidate signed in with an email that hasn’t been verified, so it may not be theirs.">
                        email not verified
                      </span>
                    )}
                  </small>
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
      )}

      <AnalyseResultsDialog
        open={analysing}
        onClose={() => setAnalysing(false)}
        testId={test.id}
        title={test.displayName}
        questions={test.questions ?? []}
        count={subs.length}
      />

      <ConfirmModal
        open={Boolean(releasing)}
        label={releasing === 'hide' ? 'Hide scores' : 'Release scores'}
        context={test.displayName || 'Untitled test'}
        icon={releasing === 'hide' ? EyeOff : Send}
        title={releasing === 'hide' ? 'Hide everyone’s scores?' : `Release scores to ${unreleased.length} ${unreleased.length === 1 ? 'candidate' : 'candidates'}?`}
        message={
          releasing === 'hide'
            ? 'Candidates won’t see their result or the answers until you release them again. Emails already sent can’t be taken back.'
            : 'Each one sees their score, which answers were right, the correct answers and your explanations, and gets an email with a link.'
        }
        confirmLabel={releasing === 'hide' ? 'Hide scores' : 'Release'}
        tone={releasing === 'hide' ? 'danger' : 'primary'}
        busy={releaseBusy}
        onConfirm={confirmRelease}
        onCancel={() => setReleasing(null)}
      />
      <ConfirmModal
        open={Boolean(pending)}
        label="Delete result"
        context={test.displayName}
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
