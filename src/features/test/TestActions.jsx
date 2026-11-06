import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Copy, Download, Eye, FileJson, Keyboard, Link2, MoreVertical, Palette, Printer, QrCode as QrCodeIcon, Redo2, RotateCcw, Send, Square, Trash2, Undo2, UserPlus } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import ShareDialog from './ShareDialog.jsx'
import ThemePanel from './ThemePanel.jsx'
import DawnOrb from '../ai/DawnOrb.jsx'
import EditTestDialog from '../ai/EditTestDialog.jsx'
import MenuButton from '../../lib/MenuButton.jsx'
import NoticeDialog from '../../lib/NoticeDialog.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { downloadCsv, downloadJson, questionsToCsv } from '../../services/csv.js'
import {
  createTest,
  deleteTest,
  newQuestionId,
  testProblems,
  updateTestFields,
} from '../../services/firestore.js'
import { useAuth } from '../auth/useAuth.js'
import DownloadHypercbtDialog from './DownloadHypercbtDialog.jsx'
import QrCodeDialog from './QrCodeDialog.jsx'
import ShortcutsDialog from './ShortcutsDialog.jsx'
import { useTestEditor } from './testContext.js'

// Text boxes keep their own undo for typing (as in PeraForm): the test's
// Undo/Redo only takes Ctrl+Z when focus is somewhere else.
function isTextField(el) {
  return el?.matches?.('input, textarea, select, [contenteditable="true"]')
}

function fileBase(title) {
  return (title || 'untitled-test').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'test'
}

// Top-bar actions for the open test: status, Publish / Close, copy link, more.
export default function TestActions() {
  const { test, draft, flush, undo, redo, canUndo, canRedo } = useTestEditor()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [toast, showToast] = useToast()
  const [problems, setProblems] = useState([])
  const [confirm, setConfirm] = useState(null) // 'close' | 'delete'
  const [busy, setBusy] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [downloadHypercbtOpen, setDownloadHypercbtOpen] = useState(false)
  const status = test.status ?? 'draft'
  // While a test is open its questions are locked, so history is too.
  const historyOn = status !== 'open'

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

  // Saves first, so the preview shows exactly what's in the editor.
  async function openPreview() {
    await flush()
    window.open(`/tests/${test.id}/preview`, '_blank', 'noopener')
  }

  async function openPrint() {
    await flush()
    window.open(`/tests/${test.id}/print`, '_blank', 'noopener')
  }

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '/') {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (e.key.toLowerCase() !== 'z' || isTextField(e.target) || !historyOn) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, historyOn])

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
      if (confirm === 'unpublish') {
        await updateTestFields(test.id, user.email, { status: 'draft' })
        showToast('Test unpublished — back to Draft')
        return
      }
      await updateTestFields(test.id, user.email, { status: 'closed' })
      showToast('Test closed - new candidates can’t start')
    } catch {
      showToast(
        confirm === 'delete'
          ? 'Couldn’t delete the test. Please try again.'
          : confirm === 'unpublish'
            ? 'Couldn’t unpublish the test. Please try again.'
            : 'Couldn’t close the test. Please try again.',
      )
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  return (
    <div className="test-actions">
      {/* Questions can't change while candidates are sitting it. */}
      {status !== 'open' && (
        <button
          type="button"
          className="icon-btn test-ai test-desktop"
          onClick={() => setAiOpen(true)}
          aria-label="Edit with Dawn"
          title="Edit with Dawn"
        >
          <DawnOrb size={24} />
        </button>
      )}
      <button
        type="button"
        className="icon-btn test-desktop"
        onClick={() => setThemeOpen(true)}
        aria-label="Theme"
        title="Theme"
      >
        <Palette size={18} />
      </button>
      <span className="test-history" role="group" aria-label="Undo and redo">
        <button
          type="button"
          className="icon-btn"
          onClick={undo}
          disabled={!canUndo || !historyOn}
          aria-label="Undo"
          title={historyOn ? 'Undo (Ctrl+Z)' : 'Close the test to make changes'}
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={redo}
          disabled={!canRedo || !historyOn}
          aria-label="Redo"
          title={historyOn ? 'Redo (Ctrl+Shift+Z)' : 'Close the test to make changes'}
        >
          <Redo2 size={18} />
        </button>
      </span>
      <button
        type="button"
        className="icon-btn test-preview"
        onClick={openPreview}
        aria-label="Preview as a candidate"
        title="Preview as a candidate"
      >
        <Eye size={18} />
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setShareOpen(true)}
        aria-label="Share"
        title="Share"
      >
        <UserPlus size={18} />
      </button>
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
          ...(historyOn && canUndo ? [{ label: 'Undo', icon: Undo2, onSelect: undo }] : []),
          ...(historyOn && canRedo ? [{ label: 'Redo', icon: Redo2, onSelect: redo }] : []),
          ...(status !== 'open' ? [{ label: 'Edit with Dawn', icon: DawnOrb, onSelect: () => setAiOpen(true) }] : []),
          { label: 'Theme', icon: Palette, onSelect: () => setThemeOpen(true) },
          { label: 'Preview as a candidate', icon: Eye, onSelect: openPreview },
          { label: 'Print', icon: Printer, onSelect: openPrint },
          ...(status === 'open' || status === 'closed'
            ? [{ label: 'Unpublish', icon: RotateCcw, onSelect: () => setConfirm('unpublish') }]
            : []),
          { label: 'Share', icon: UserPlus, onSelect: () => setShareOpen(true) },
          { label: 'Make a copy', icon: Copy, onSelect: makeCopy },
          { label: 'Show QR code', icon: QrCodeIcon, onSelect: () => setQrOpen(true) },
          { label: 'Download as HyperCBT file', icon: FileJson, onSelect: () => setDownloadHypercbtOpen(true) },
          { label: 'Download questions (CSV)', icon: Download, onSelect: () => download('csv') },
          { label: 'Download questions (JSON)', icon: Download, onSelect: () => download('json') },
          { label: 'Keyboard shortcuts', icon: Keyboard, onSelect: () => setShortcutsOpen(true) },
          ...(test.createdBy === user.email
            ? [{ label: 'Delete test', icon: Trash2, danger: true, onSelect: () => setConfirm('delete') }]
            : []),
        ]}
      />

      <DownloadHypercbtDialog
        open={downloadHypercbtOpen}
        onClose={() => setDownloadHypercbtOpen(false)}
        test={test}
        draft={draft}
        onToast={showToast}
      />
      <EditTestDialog open={aiOpen} onClose={() => setAiOpen(false)} onApplied={showToast} />
      <ThemePanel open={themeOpen} onClose={() => setThemeOpen(false)} />
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        showToast={showToast}
        onPublish={() => {
          setShareOpen(false)
          publish()
        }}
        onCopyLink={copyLink}
      />
      <QrCodeDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        testId={test.id}
        testTitle={draft.displayName}
        status={status}
        onToast={showToast}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <NoticeDialog
        open={problems.length > 0}
        title="Not ready to open yet"
        message="Fix these first, then press Publish again:"
        items={problems}
        onClose={() => setProblems([])}
      />
      <ConfirmModal
        open={confirm === 'close'}
        label="Close test"
        context={draft.displayName || 'Untitled test'}
        icon={Square}
        title="Close this test?"
        message="New candidates won’t be able to start it. Anyone already taking it can still submit. You can reopen it any time."
        confirmLabel="Close test"
        tone="primary"
        busy={busy}
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm === 'unpublish'}
        label="Unpublish test"
        context={draft.displayName || 'Untitled test'}
        icon={RotateCcw}
        title="Unpublish this test?"
        message="Candidates can't open it until you publish again. Results stay."
        confirmLabel="Unpublish"
        tone="primary"
        busy={busy}
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm === 'delete'}
        label="Delete test"
        art
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
