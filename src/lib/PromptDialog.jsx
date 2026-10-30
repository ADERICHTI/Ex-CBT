import { useEffect, useState } from 'react'
import { FolderPlus } from 'lucide-react'
import QtWindow from './QtWindow.jsx'

// Small "name this" window (new folder, rename folder), in the Quality
// Tools window: the question, then one clean field with its button inside.
export default function PromptDialog({ open, title, label, question, initial = '', confirmLabel = 'Save', icon = FolderPlus, onSubmit, onCancel }) {
  const [value, setValue] = useState(initial)

  // A fresh value each time it opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on open
    if (open) setValue(initial)
  }, [open, initial])

  return (
    <QtWindow
      open={open}
      onClose={onCancel}
      icon={icon}
      label={title}
      title={question ?? `${label}?`}
      as="form"
      onSubmit={() => value.trim() && onSubmit(value.trim())}
    >
      <label className="qt-field">
        <span className="sr-only">{label}</span>
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} autoFocus placeholder={label} />
        <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
          {confirmLabel}
        </button>
      </label>
    </QtWindow>
  )
}
