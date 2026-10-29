import { useEffect, useRef } from 'react'
import './ConfirmModal.css'

// A message that only needs "OK" (e.g. why a test can't open yet).
//   items - optional list shown under the message
export default function NoticeDialog({ open, title, message, items = [], onClose }) {
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
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="confirm-body">
        <h2>{title}</h2>
        {message && <p>{message}</p>}
        {items.length > 0 && (
          <ul className="notice-list">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <div className="confirm-actions">
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
            OK
          </button>
        </div>
      </div>
    </dialog>
  )
}
