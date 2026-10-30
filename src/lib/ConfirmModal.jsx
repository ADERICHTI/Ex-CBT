import { CircleHelp, Trash2 } from 'lucide-react'
import IdeaArt from '../features/ai/IdeaArt.jsx'
import QtWindow, { QtActions } from './QtWindow.jsx'

const DANGER_ART = { sky: '#ffeceb', sky2: '#ffcdca', ground: '#f59c95', accent: '#d64541' }

// "Are you sure?" - every delete/remove action goes through this (and the
// test's Submit/Leave questions), in the Quality Tools window.
//   tone    - 'danger' (red, the default) or 'primary'
//   label   - the window's name on top (defaults to the confirm button's)
//   context - the thing it's about, e.g. the test's name
//   icon    - the tile's icon (bin for danger, a question mark otherwise)
//   art     - show the illustration (for big, can't-undo deletes)
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  label,
  context,
  icon,
  art = false,
  onConfirm,
  onCancel,
}) {
  const danger = tone !== 'primary'
  return (
    <QtWindow
      open={open}
      onClose={onCancel}
      icon={icon ?? (danger ? Trash2 : CircleHelp)}
      label={label ?? confirmLabel}
      context={context}
      tone={danger ? 'danger' : 'accent'}
      busy={busy}
    >
      {art && danger && (
        <span className="qt-win-art">
          <IdeaArt art={DANGER_ART} icon="Trash2" />
        </span>
      )}
      <h2 className="qt-win-title">{title}</h2>
      {message && <p className="qt-win-hint">{message}</p>}
      <QtActions>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={busy}
          autoFocus={!danger}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </QtActions>
    </QtWindow>
  )
}
