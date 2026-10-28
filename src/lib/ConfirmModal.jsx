import { useEffect, useRef } from 'react'
import './ConfirmModal.css'

// "Are you sure?" dialog - every delete/remove action goes through this
// (and the test's Submit/Exit questions). Built on <dialog> so focus
// trapping and Escape-to-close come for free.
//   tone - 'danger' (red confirm button, the default) or 'primary'
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="confirm"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      onClick={(e) => e.target === ref.current && !busy && onCancel()}
    >
      <div className="confirm-body">
        <h2>{title}</h2>
        {message && <p>{message}</p>}
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'primary' ? 'btn-primary' : 'btn-danger'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
