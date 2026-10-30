import { Check, Folder, FolderInput, FolderPlus, Inbox } from 'lucide-react'
import QtWindow from '../../lib/QtWindow.jsx'

// "Move to folder" for a dashboard card, in the Quality Tools window.
export default function MoveDialog({ test, folders, currentId, onMove, onNewFolder, onClose }) {
  const choices = [{ id: null, name: 'My tests (no folder)', icon: Inbox }, ...folders.map((f) => ({ ...f, icon: Folder }))]
  const here = currentId ?? null
  return (
    <QtWindow
      open={Boolean(test)}
      onClose={onClose}
      icon={FolderInput}
      label="Move"
      context={test?.displayName || 'Untitled test'}
      title="Where should it go?"
      hint="Folders are just for you: they don’t change the test or who can take it."
    >
      <ul className="qt-list">
        {choices.map(({ id, name, icon: Icon }) => (
          <li key={id ?? 'none'}>
            <button type="button" className={`qt-choice${here === id ? ' is-on' : ''}`} onClick={() => onMove(id, name)}>
              <Icon size={18} />
              <span>{name}</span>
              {here === id && <Check size={16} aria-label="Here now" />}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="link-btn move-new" onClick={onNewFolder}>
        <FolderPlus size={16} />
        New folder
      </button>
    </QtWindow>
  )
}
