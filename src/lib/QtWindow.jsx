import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import './QtWindow.css'

// The Quality Tools window for everything that isn't AI (the approved
// peraform/mockups/qt-modals-mockup.html): a soft, rounded frame; on top a
// small icon tile, what the window is and a quiet context; then one big
// plain question and a hint. Same family as Dawn's window, without Dawn's
// light (no glow, greeting or sun button - those mean "AI"). Built on
// <dialog>, so focus stays inside and Escape closes it.
//
//   open, onClose        the dialog (onClose also for Escape / backdrop)
//   icon                 a lucide icon component for the tile
//   label, context       "Delete test" · "Biology mid-term"
//   title, hint          the big question and the line under it
//   tone                 'accent' (default) or 'danger' (red tile)
//   size                 'small' (confirms) or 'wide'
//   busy                 while working: no closing
//   as                   'form' to make the body a form (onSubmit)
export default function QtWindow({
  open,
  onClose,
  icon: Icon,
  label,
  context,
  title,
  hint,
  tone = 'accent',
  size = 'small',
  busy = false,
  as = 'div',
  onSubmit,
  children,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const Body = as
  return (
    <dialog
      ref={ref}
      className={`qt-dialog is-${size}`}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(e) => e.target === ref.current && !busy && onClose()}
    >
      <Body
        className="qt-win"
        onSubmit={
          as === 'form'
            ? (e) => {
                e.preventDefault()
                onSubmit?.(e)
              }
            : undefined
        }
      >
        <header className="qt-win-top">
          {Icon && (
            <span className={`qt-win-ico is-${tone}`} aria-hidden="true">
              <Icon size={17} />
            </span>
          )}
          <b>{label}</b>
          {context && <span className="qt-win-what">· {context}</span>}
          <button type="button" className="qt-win-x" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={20} />
          </button>
        </header>
        {title && <h2 className="qt-win-title">{title}</h2>}
        {hint && <p className="qt-win-hint">{hint}</p>}
        {children}
      </Body>
    </dialog>
  )
}

// The row of buttons at the bottom of a window.
export function QtActions({ children, align = 'end' }) {
  return <div className={`qt-win-acts is-${align}`}>{children}</div>
}
