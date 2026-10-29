import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Copy, Download, Link2, MoreVertical, Send, Square, Trash2 } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import MenuButton from '../../lib/MenuButton.jsx'
import NoticeDialog from '../../lib/NoticeDialog.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { downloadCsv, downloadJson, questionsToCsv } from '../../services/csv.js'
import {
  createTest,
  deleteTest,
  newQuestionId,
  STATUS_LABELS,
  testProblems,
  updateTestFields,
} from '../../services/firestore.js'
import { useAuth } from '../auth/useAuth.js'
import { useTestEditor } from './testContext.js'

function fileBase(title) {
  return (title || 'untitled-test').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'test'
}

// Top-bar actions for the open test: status, Publish / Close, copy link, more.
export default function TestActions() {
  const { test, draft, flush } = useTestEditor()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [toast, showToast] = useToast()
  const [problems, setProblems] = useState([])
  const [confirm, setConfirm] = useState(null) // 'close' | 'delete'
  const [busy, setBusy] = useState(false)
  const status = test.status ?? 'draft'

  // A one-off note from the page that sent us here (e.g. "Made with AI ·
  // used 1.3 credits"), shown once and then cleared from history.
  const location = useLocation()
  const notice = location.state?.notice
  useEffect(() => {
    if (!notice) return
    showToast(notice)
    navigate(location.pathname, { replace: true, state: null })
  }, [notice, showToast, navigate, location.pathname])

  const link = `${window.location.origin}/test/${test.id}`

  async function publish() {
    const found = testProblems(draft)
    if (found.length) {
      setProblems(found)
      return
    }
    setBusy(true)
    try {
      if (!(await flush())) throw new Error('save failed')
      await updateTestFields(test.id, user.email, { status: 'open' })
      try {
        await navigator.clipboard.writeText(link)
        showToast('Test open - link copied')
      } catch {
        showToast('Test open')
      }
    } catch {
      showToast('Couldn’t open the test. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      showToast(status === 'open' ? 'Link copied' : 'Link copied - open the test so candidates can start')
    } catch {
      showToast('Couldn’t copy the link')
    }
  }

  // A full copy as a new draft: questions and answers, time, strict mode.
  async function makeCopy() {
    try {
      if (!(await flush())) throw new Error('save failed')
      const id = await createTest(user.email, {
        displayName: `Copy of ${draft.displayName || 'Untitled test'}`,
        minutes: Number(draft.minutes) || 15,
        strictMode: Boolean(test.strictMode),
        questions: draft.questions.map((q) => ({ ...q, id: newQuestionId(), options: [...q.options] })),
      })
      navigate(`/tests/${id}/questions`)
      showToast('Copy made - you’re now editing the copy')
    } catch {
      showToast('Couldn’t copy the test. Please try again.')
    }
  }

  function download(kind) {
    const rows = draft.questions.map((q) => ({
      question: q.question,
      options: q.options,
      answer: q.correct != null ? (q.options[q.correct] ?? '') : '',
    }))
    if (kind === 'csv') downloadCsv(`${fileBase(draft.displayName)}.csv`, questionsToCsv(rows))
    else downloadJson(`${fileBase(draft.displayName)}.json`, rows)
    showToast('Saved to your downloads')
  }

  async function onConfirm() {
    setBusy(true)
    try {
      if (confirm === 'delete') {
        await deleteTest(test.id)
        navigate('/')
        return
      }
      await updateTestFields(test.id, user.email, { status: 'closed' })
      showToast('Test closed - new candidates can’t start')
    } catch {
      showToast(confirm === 'delete' ? 'Couldn’t delete the test. Please try again.' : 'Couldn’t close the test. Please try again.')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  return (
    <div className="test-actions">
      <span className={`status status-${status}`} title="Status">
        {STATUS_LABELS[status]}
      </span>
      <button
        type="button"
        className="icon-btn test-copy-link"
        onClick={copyLink}
        aria-label="Copy test link"
        title="Copy test link"
      >
        <Link2 size={18} />
      </button>
      {status === 'open' ? (
        <button
          type="button"
          className="btn btn-outline test-publish"
          onClick={() => setConfirm('close')}
          disabled={busy}
          aria-label="Close test"
        >
          <Square size={14} /> <span className="test-publish-label">Close</span>
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary test-publish"
          onClick={publish}
          disabled={busy}
          aria-label={status === 'closed' ? 'Reopen test' : 'Publish test'}
        >
          <Send size={15} /> <span className="test-publish-label">{status === 'closed' ? 'Reopen' : 'Publish'}</span>
        </button>
      )}
      <MenuButton
        icon={<MoreVertical size={18} />}
        label="More"
        items={[
          { label: 'Make a copy', icon: Copy, onSelect: makeCopy },
          { label: 'Download questions (CSV)', icon: Download, onSelect: () => download('csv') },
          { label: 'Download questions (JSON)', icon: Download, onSelect: () => download('json') },
          { label: 'Delete test', icon: Trash2, danger: true, onSelect: () => setConfirm('delete') },
        ]}
      />

      <NoticeDialog
        open={problems.length > 0}
        title="Not ready to open yet"
        message="Fix these first, then press Publish again:"
        items={problems}
        onClose={() => setProblems([])}
      />
      <ConfirmModal
        open={confirm === 'close'}
        title="Close this test?"
        message="New candidates won’t be able to start it. Anyone already taking it can still submit. You can reopen it any time."
        confirmLabel="Close test"
        tone="primary"
        busy={busy}
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm === 'delete'}
        title={`Delete “${draft.displayName || 'Untitled test'}”?`}
        message="This permanently deletes the test, its approved list and every candidate’s result. This can’t be undone."
        busy={busy}
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
      {toast}
    </div>
  )
}
