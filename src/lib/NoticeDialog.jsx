import { Info } from 'lucide-react'
import QtWindow, { QtActions } from './QtWindow.jsx'

// A message that only needs "OK" (e.g. why a test can't open yet), in the
// Quality Tools window.
//   items - optional list shown under the message
export default function NoticeDialog({ open, title, message, items = [], label = 'Before you publish', icon = Info, onClose }) {
  return (
    <QtWindow open={open} onClose={onClose} icon={icon} label={label} title={title} hint={message}>
      {items.length > 0 && (
        <ul className="notice-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <QtActions>
        <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
          OK
        </button>
      </QtActions>
    </QtWindow>
  )
}
