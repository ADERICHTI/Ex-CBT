import { Keyboard } from 'lucide-react'
import QtWindow, { QtActions } from '../../lib/QtWindow.jsx'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl'

const SHORTCUTS = [
  [[MOD, 'Z'], 'Undo the last change'],
  [[MOD, 'Shift', 'Z'], 'Redo'],
  [[MOD, '/'], 'Show these shortcuts'],
  [['Enter'], 'Ask Dawn (in a Dawn window)'],
  [['Shift', 'Enter'], 'New line in a Dawn window'],
  [['Esc'], 'Close a window'],
]

// The test editor's keyboard shortcuts, as in PeraForm (Ctrl + / opens it).
export default function ShortcutsDialog({ open, onClose }) {
  return (
    <QtWindow
      open={open}
      onClose={onClose}
      icon={Keyboard}
      label="Keyboard shortcuts"
      title="Work faster with the keyboard"
      hint="Undo and Redo work on the whole test when you’re not typing in a box; inside a box they undo your typing."
    >
      <dl className="shortcuts">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={what} className="shortcut">
            <dt>
              {keys.map((k, i) => (
                <span key={k}>
                  {i > 0 && ' + '}
                  <kbd>{k}</kbd>
                </span>
              ))}
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
      <QtActions>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Got it
        </button>
      </QtActions>
    </QtWindow>
  )
}
