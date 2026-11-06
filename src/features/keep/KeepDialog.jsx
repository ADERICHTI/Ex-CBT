import { useEffect, useState } from 'react'
import { Bookmark, ClipboardPaste, Copy, FileText, Link2, ListChecks, Pencil, Trash2 } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import QtWindow from '../../lib/QtWindow.jsx'
import { KEEP_KINDS, keepSummary, keepText, readPayload, visibleHere } from '../../lib/keep.js'
import { useKeep } from './keepContext.js'
import { deleteKeep, renameKeep, saveKeep, watchKeeps } from './keepStore.js'
import IdeaArt from '../ai/IdeaArt.jsx'
import './keep.css'

const ICONS = { question: ListChecks, text: FileText, link: Link2 }
// Each kind's colour, on its badge.
const KIND_COLOURS = { question: '#b85a00', text: '#c58a06', link: '#2f80d1' }
const EMPTY_ART = { sky: '#fff7e0', sky2: '#ffe8a8', ground: '#f2cf6a', accent: '#c58a06' }

// Which page target pastes this kind (keepContext.js → useKeepTargets).
const targetFor = (targets, kind) => (kind === 'text' || kind === 'link' ? targets?.text : targets?.[kind])

// The Keep (a copy of PeraForm's, on HyperCBT's QtWindow): everything you
// kept, by kind, with Paste (where this page can take it), Copy (text and
// links), Rename and Delete. Items from other Quality Tools apps only show
// when HyperCBT can use them.
export default function KeepDialog({ open, onClose, uid }) {
  const { targetsRef, showToast } = useKeep()
  const [items, setItems] = useState(null) // null = loading
  const [error, setError] = useState('')
  const [tab, setTab] = useState('all')
  const [draft, setDraft] = useState('')
  const [renaming, setRenaming] = useState(null) // { id, label }
  const [removing, setRemoving] = useState(null) // item
  const [targets, setTargets] = useState(null)

  // Listen while open (the list stays fresh across apps and tabs).
  useEffect(() => {
    if (!open) return
    return watchKeeps(
      uid,
      (list) => {
        setItems(list.filter(visibleHere))
        setError('')
      },
      () => setError('Couldn’t load your Keep. Check your connection.'),
    )
  }, [open, uid])

  // What this page can take, read each time the Keep opens.
  useEffect(() => {
    if (open) setTargets(targetsRef.current)
  }, [open, targetsRef])

  // Filters only for kinds you actually have (no row of zeros); if the
  // chosen kind has emptied, show everything.
  const have = Object.keys(KEEP_KINDS).filter((k) => (items ?? []).some((i) => i.kind === k))
  const current = tab !== 'all' && have.includes(tab) ? tab : 'all'
  const shown = (items ?? []).filter((i) => current === 'all' || i.kind === current)

  async function addText(e) {
    e.preventDefault()
    const item = keepText(draft)
    if (!item) return
    try {
      await saveKeep(uid, item)
      setDraft('')
    } catch {
      setError('Couldn’t keep that. Try again.')
    }
  }

  function paste(item) {
    const target = targetFor(targets, item.kind)
    const data = readPayload(item)
    if (!target || !data) return
    target(data, item.kind)
    onClose()
    showToast(`Pasted “${item.label}”`)
  }

  async function copy(item) {
    const data = readPayload(item)
    try {
      await navigator.clipboard.writeText(data?.url ?? data?.text ?? '')
      showToast('Copied')
    } catch {
      showToast('Couldn’t copy. Select the text and copy it instead.')
    }
  }

  return (
    <QtWindow
      open={open}
      onClose={onClose}
      icon={Bookmark}
      label="Keep"
      context="in every Quality Tools app"
      title="Your Keep"
      hint="Things to paste later. Text and links work in every Quality Tools app; questions are HyperCBT’s."
      size="wide"
    >
      <form className="win-field" onSubmit={addText}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={1}
          maxLength={20000}
          placeholder="Write a note or paste a link…"
          aria-label="Text or link to keep"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form.requestSubmit()
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
          Keep it
        </button>
      </form>

      {have.length > 1 && (
        <div className="win-chips" role="tablist" aria-label="Kinds">
          {['all', ...have].map((k) => (
            <button key={k} type="button" role="tab" aria-selected={current === k} onClick={() => setTab(k)}>
              {k === 'all' ? 'All' : `${KEEP_KINDS[k].label} · ${items.filter((i) => i.kind === k).length}`}
            </button>
          ))}
        </div>
      )}
      {current !== 'all' && <p className="keep-where">{KEEP_KINDS[current].where}</p>}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {items === null && !error ? (
        <div className="keep-grid" role="status" aria-label="Loading your Keep">
          <span className="keep-ghost" />
          <span className="keep-ghost" />
          <span className="keep-ghost" />
        </div>
      ) : items !== null && !items.length ? (
        <div className="win-art">
          <IdeaArt art={EMPTY_ART} icon={Bookmark} />
          <h3>Nothing kept yet</h3>
          <p>
            Keep a question or some text here (use <Bookmark size={13} aria-hidden="true" /> Keep on a question card),
            then paste it into any test.
          </p>
        </div>
      ) : null}
      <ul className="keep-grid">
        {shown.map((item) => {
          const Icon = ICONS[item.kind] ?? FileText
          const target = targetFor(targets, item.kind)
          return (
            <li key={item.id} className="keep-item" style={{ '--k': KIND_COLOURS[item.kind] ?? 'var(--accent)' }}>
              <span className="keep-kind">
                <span className="keep-badge">
                  <Icon size={16} aria-hidden="true" />
                </span>
                {KEEP_KINDS[item.kind]?.label ?? item.kind}
              </span>
              <div className="keep-main">
                {renaming?.id === item.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (renaming.label.trim()) renameKeep(uid, item.id, renaming.label.trim()).catch(() => {})
                      setRenaming(null)
                    }}
                  >
                    <input
                      autoFocus
                      value={renaming.label}
                      maxLength={200}
                      onChange={(e) => setRenaming({ ...renaming, label: e.target.value })}
                      onBlur={(e) => e.currentTarget.form.requestSubmit()}
                      aria-label="Name"
                    />
                  </form>
                ) : (
                  <strong>{item.label}</strong>
                )}
                <span className="keep-sub">{keepSummary(item)}</span>
              </div>
              <div className="keep-actions">
                <button
                  type="button"
                  className="btn btn-primary keep-paste"
                  onClick={() => paste(item)}
                  disabled={!target}
                  title={target ? 'Paste it here' : KEEP_KINDS[item.kind]?.where}
                >
                  <ClipboardPaste size={15} /> Paste
                </button>
                {(item.kind === 'text' || item.kind === 'link') && (
                  <button type="button" className="icon-btn" onClick={() => copy(item)} aria-label="Copy" title="Copy">
                    <Copy size={16} />
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setRenaming({ id: item.id, label: item.label })}
                  aria-label="Rename"
                  title="Rename"
                >
                  <Pencil size={16} />
                </button>
                <button type="button" className="icon-btn" onClick={() => setRemoving(item)} aria-label="Delete" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <ConfirmModal
        open={Boolean(removing)}
        label="Keep"
        icon={Trash2}
        title={`Delete “${removing?.label ?? ''}” from your Keep?`}
        message="It’s gone from every Quality Tools app. Anything you already pasted stays."
        confirmLabel="Delete"
        onConfirm={() => {
          deleteKeep(uid, removing.id).catch(() => setError('Couldn’t delete it. Try again.'))
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </QtWindow>
  )
}
