import { useState } from 'react'
import { Folder, FolderPlus, Star } from 'lucide-react'
import MenuButton from '../../lib/MenuButton.jsx'
import { createFolder, moveToFolder, setStarred, useOrganize } from '../../lib/organize.js'
import PromptDialog from '../../lib/PromptDialog.jsx'
import { useToast } from '../../lib/useToast.jsx'
import { useAuth } from '../auth/useAuth.js'
import { useTestEditor } from './testContext.js'

const SAVE_LABELS = { saving: 'Saving…', saved: 'Saved', error: 'Couldn’t save - retrying' }

// Top-bar title, then "Move to folder" and star (this person's own), then
// save status - as in PeraForm.
export default function TestTitleField() {
  const { test, draft, edit, saveState } = useTestEditor()
  const { user } = useAuth()
  const { meta, folders } = useOrganize(user.email)
  const [naming, setNaming] = useState(false)
  const [toast, showToast] = useToast()
  const mine = meta[test.id] ?? {}
  const folderName = folders.find((f) => f.id === mine.folderId)?.name

  async function move(folderId, name) {
    try {
      await moveToFolder(user.email, test.id, folderId)
      showToast(folderId ? `Moved to ${name}` : 'Moved to My tests')
    } catch {
      showToast('Couldn’t move the test. Please try again.')
    }
  }

  return (
    <div className="title-field">
      <input
        value={draft.displayName}
        onChange={(e) => {
          const displayName = e.target.value
          edit((d) => ({ ...d, displayName }))
        }}
        placeholder="Untitled test"
        aria-label="Test title"
        maxLength={120}
      />
      <MenuButton
        className="title-tool"
        icon={<Folder size={17} />}
        label={folderName ? `In folder: ${folderName} - move` : 'Move to folder'}
        items={[
          { label: 'My tests (no folder)', checked: !mine.folderId, onSelect: () => move(null) },
          ...folders.map((f) => ({ label: f.name, checked: mine.folderId === f.id, onSelect: () => move(f.id, f.name) })),
          { label: 'New folder…', icon: FolderPlus, onSelect: () => setNaming(true) },
        ]}
      />
      <button
        type="button"
        className={`icon-btn title-tool star-btn${mine.starred ? ' on' : ''}`}
        onClick={() => setStarred(user.email, test.id, !mine.starred).catch(() => showToast('Couldn’t update the star'))}
        aria-label={mine.starred ? 'Unstar' : 'Star'}
        aria-pressed={Boolean(mine.starred)}
        title={mine.starred ? 'Starred' : 'Star'}
      >
        <Star size={17} />
      </button>
      <span className={`save-state save-${saveState}`} role="status">
        {SAVE_LABELS[saveState]}
      </span>

      <PromptDialog
        open={naming}
        title="New folder"
        label="Folder name"
        confirmLabel="Create and move"
        onCancel={() => setNaming(false)}
        onSubmit={async (name) => {
          setNaming(false)
          try {
            const id = await createFolder(user.email, name)
            await move(id, name)
          } catch {
            showToast('Couldn’t create the folder. Please try again.')
          }
        }}
      />
      {toast}
    </div>
  )
}
