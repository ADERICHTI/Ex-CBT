import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowDownAZ, ChevronRight, Filter, Folder, FolderPlus, LayoutGrid, List, MoreVertical, Plus, Star, Upload } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import MenuButton from '../../lib/MenuButton.jsx'
import { createFolder, deleteFolder, moveToFolder, renameFolder, setStarred, useOrganize } from '../../lib/organize.js'
import PromptDialog from '../../lib/PromptDialog.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { createTest, deleteTest, STATUS_LABELS } from '../../services/firestore.js'
import { useAuth } from '../auth/useAuth.js'
import ImportDialog from './ImportDialog.jsx'
import MoveDialog from './MoveDialog.jsx'
import TestCard from './TestCard.jsx'
import TestThumbnail from './TestThumbnail.jsx'
import TemplateGallery from './TemplateGallery.jsx'
import { saveRecentTemplateKey, START_ROW_KEYS, TEMPLATE_BY_KEY } from './templates.js'
import { useMyTests } from './useMyTests.js'
import './DashboardPage.css'

const VIEW_KEY = 'hypercbt-dashboard-view'
const START_TEMPLATES = START_ROW_KEYS.map((k) => TEMPLATE_BY_KEY[k])

const FILTERS = {
  all: { label: 'Any status', test: () => true },
  ...Object.fromEntries(
    Object.entries(STATUS_LABELS).map(([key, label]) => [
      key,
      { label, test: (t) => (t.status ?? 'draft') === key },
    ]),
  ),
}

const SORTS = {
  edited: { label: 'Last edited', compare: null }, // the query's own order
  title: {
    label: 'Title A–Z',
    compare: (a, b) =>
      (a.displayName || '').localeCompare(b.displayName || '', undefined, { sensitivity: 'base' }),
  },
}

function readSavedView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { tests, loading, error } = useMyTests(user.email)
  const navigate = useNavigate()
  const { search: rawSearch } = useOutletContext()
  const search = rawSearch.trim().toLowerCase()

  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('edited')
  const [view, setView] = useState(readSavedView)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toast, showToast] = useToast()
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  // Where the list is looking: 'all', 'starred', or a folder id.
  const [place, setPlace] = useState('all')
  const { meta, folders } = useOrganize(user.email)
  const [moving, setMoving] = useState(null)
  const [naming, setNaming] = useState(null) // { kind: 'new' | 'rename', folder?, then? }
  const [deletingFolder, setDeletingFolder] = useState(null)
  const activeFolder = folders.find((f) => f.id === place)
  const where = place === 'all' || place === 'starred' || activeFolder ? place : 'all'

  const visible = useMemo(() => {
    const list = tests.filter(
      (t) =>
        FILTERS[filter].test(t) &&
        (t.displayName || 'untitled test').toLowerCase().includes(search) &&
        (where === 'all' || (where === 'starred' ? meta[t.id]?.starred : meta[t.id]?.folderId === where)),
    )
    const compare = SORTS[sort].compare
    return compare ? [...list].sort(compare) : list
  }, [tests, filter, sort, search, where, meta])

  function toggleView() {
    const next = view === 'grid' ? 'list' : 'grid'
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Storage blocked - the view just won't be remembered.
    }
  }

  async function startTest(content) {
    setCreating(true)
    setActionError('')
    try {
      const id = await createTest(user.email, content)
      navigate(`/tests/${id}/questions`)
    } catch {
      setActionError('Couldn’t create the test. Check your connection and try again.')
      setCreating(false)
    }
  }

  function startFromTemplate(t) {
    saveRecentTemplateKey(t.key, user.email)
    setGalleryOpen(false)
    startTest(t.build())
  }

  async function copyLink(testId) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/test/${testId}`)
      showToast('Link copied')
    } catch {
      showToast('Couldn’t copy the link')
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteTest(pendingDelete.id)
      showToast('Test deleted')
    } catch {
      setActionError('Couldn’t delete the test. Please try again.')
    } finally {
      setPendingDelete(null)
      setDeleting(false)
    }
  }

  return (
    <div className="dash">
      <div className="dash-start-header">
        <span className="dash-start-title">Start a new test</span>
        <button type="button" className="link-btn dash-gallery-btn" onClick={() => setGalleryOpen(true)}>
          <span>Template gallery</span>
          <ChevronRight size={16} />
        </button>
      </div>
      <section className="dash-start" aria-label="Start a new test">
        <button
          type="button"
          className="start-card"
          onClick={() => startTest({ questions: [] })}
          disabled={creating}
        >
          <span className="start-visual start-visual-icon">
            <Plus size={36} strokeWidth={1.5} />
          </span>
          <span className="start-label">Blank test</span>
        </button>
        {START_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            className="start-card"
            onClick={() => startFromTemplate(t)}
            disabled={creating}
          >
            <span className="start-visual">
              <TestThumbnail title={t.preview.displayName} questions={t.preview.questions} />
            </span>
            <span className="start-label">{t.name}</span>
          </button>
        ))}
        <button type="button" className="start-card" onClick={() => setImporting(true)} disabled={creating}>
          <span className="start-visual start-visual-icon">
            <Upload size={30} strokeWidth={1.5} />
          </span>
          <span className="start-label">Import questions</span>
        </button>
      </section>

      <TemplateGallery
        open={galleryOpen}
        email={user.email}
        onClose={() => setGalleryOpen(false)}
        onPick={startFromTemplate}
        creating={creating}
      />

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onCreate={startTest}
        busy={creating}
      />

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="dash-recent">
        <header className="dash-recent-head">
          <h2>Recent tests</h2>
          <div className="dash-tools">
            <MenuButton
              icon={<Filter size={18} />}
              label={`Show: ${FILTERS[filter].label}`}
              items={Object.entries(FILTERS).map(([key, f]) => ({
                label: f.label,
                checked: key === filter,
                onSelect: () => setFilter(key),
              }))}
            />
            <MenuButton
              icon={<ArrowDownAZ size={18} />}
              label={`Sort: ${SORTS[sort].label}`}
              items={Object.entries(SORTS).map(([key, s]) => ({
                label: s.label,
                checked: key === sort,
                onSelect: () => setSort(key),
              }))}
            />
            <button
              type="button"
              className="icon-btn"
              onClick={toggleView}
              aria-label={view === 'grid' ? 'List view' : 'Grid view'}
              title={view === 'grid' ? 'List view' : 'Grid view'}
            >
              {view === 'grid' ? <List size={18} /> : <LayoutGrid size={18} />}
            </button>
          </div>
        </header>

        <nav className="places" aria-label="Show tests from">
          <button type="button" className={`place${where === 'all' ? ' on' : ''}`} onClick={() => setPlace('all')}>
            All tests
          </button>
          <button
            type="button"
            className={`place${where === 'starred' ? ' on' : ''}`}
            onClick={() => setPlace('starred')}
          >
            <Star size={14} /> Starred
          </button>
          {folders.map((f) => (
            <span key={f.id} className={`place-wrap${where === f.id ? ' on' : ''}`}>
              <button type="button" className={`place${where === f.id ? ' on' : ''}`} onClick={() => setPlace(f.id)}>
                <Folder size={14} /> {f.name}
              </button>
              {where === f.id && (
                <MenuButton
                  className="place-menu"
                  icon={<MoreVertical size={14} />}
                  label={`Folder ${f.name} options`}
                  items={[
                    { label: 'Rename', onSelect: () => setNaming({ kind: 'rename', folder: f }) },
                    { label: 'Delete folder', danger: true, onSelect: () => setDeletingFolder(f) },
                  ]}
                />
              )}
            </span>
          ))}
          <button type="button" className="place place-new" onClick={() => setNaming({ kind: 'new' })}>
            <FolderPlus size={14} /> New folder
          </button>
        </nav>

        {loading ? (
          <div className={`tests tests-${view}`} aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" />
            ))}
          </div>
        ) : error ? (
          <p className="form-error" role="alert">
            Couldn’t load your tests. Check your connection and refresh.
          </p>
        ) : visible.length === 0 ? (
          <p className="dash-empty">
            {tests.length === 0
              ? 'No tests yet. Start with a blank test, a template, or import your questions above.'
              : search
                ? `No tests match “${rawSearch.trim()}”.`
                : where === 'starred'
                  ? 'No starred tests yet. Use the ☆ on a test to star it.'
                  : activeFolder
                    ? 'This folder is empty. Use “Move to folder…” on a test to add it here.'
                    : 'No tests match this filter.'}
          </p>
        ) : (
          <div className={`tests tests-${view}`}>
            {visible.map((test) => (
              <TestCard
                key={test.id}
                test={test}
                view={view}
                starred={Boolean(meta[test.id]?.starred)}
                onToggleStar={(id, on) =>
                  setStarred(user.email, id, on).catch(() => showToast('Couldn’t update the star'))
                }
                onMove={setMoving}
                onOpen={(id, tab) => navigate(`/tests/${id}/${tab}`)}
                onCopyLink={copyLink}
                onDelete={setPendingDelete}
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.displayName || 'Untitled test'}”?`}
        message="This permanently deletes the test, its approved list and every candidate’s result. This can’t be undone."
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <MoveDialog
        test={moving}
        folders={folders}
        currentId={moving ? meta[moving.id]?.folderId : null}
        onClose={() => setMoving(null)}
        onNewFolder={() => setNaming({ kind: 'new', then: moving })}
        onMove={async (folderId, name) => {
          const test = moving
          setMoving(null)
          try {
            await moveToFolder(user.email, test.id, folderId)
            showToast(folderId ? `Moved to ${name}` : 'Moved to My tests')
          } catch {
            showToast('Couldn’t move the test. Please try again.')
          }
        }}
      />

      <PromptDialog
        open={Boolean(naming)}
        title={naming?.kind === 'rename' ? 'Rename folder' : 'New folder'}
        label="Folder name"
        initial={naming?.folder?.name ?? ''}
        confirmLabel={naming?.kind === 'rename' ? 'Rename' : 'Create'}
        onCancel={() => setNaming(null)}
        onSubmit={async (name) => {
          const job = naming
          setNaming(null)
          try {
            if (job.kind === 'rename') {
              await renameFolder(user.email, job.folder.id, name)
              return
            }
            const id = await createFolder(user.email, name)
            if (job.then) {
              await moveToFolder(user.email, job.then.id, id)
              setMoving(null)
              showToast(`Moved to ${name}`)
            } else {
              setPlace(id)
            }
          } catch {
            showToast('Couldn’t save the folder. Please try again.')
          }
        }}
      />

      <ConfirmModal
        open={Boolean(deletingFolder)}
        title={`Delete the folder “${deletingFolder?.name}”?`}
        message="The tests inside aren’t deleted - they move back to My tests."
        confirmLabel="Delete folder"
        onConfirm={async () => {
          const f = deletingFolder
          setDeletingFolder(null)
          setPlace('all')
          try {
            await deleteFolder(user.email, f.id)
            showToast('Folder deleted')
          } catch {
            showToast('Couldn’t delete the folder. Please try again.')
          }
        }}
        onCancel={() => setDeletingFolder(null)}
      />
      {toast}
    </div>
  )
}
