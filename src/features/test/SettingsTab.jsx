import { useState } from 'react'
import { Copy } from 'lucide-react'
import { useToast } from '../../lib/useToast.jsx'
import { STATUS_LABELS, updateTestFields } from '../../services/firestore.js'
import { useAuth } from '../auth/useAuth.js'
import { useTestEditor } from './testContext.js'

const STATUS_HELP = {
  draft: 'Only you can see it. Press Publish (top right) when it’s ready.',
  open: 'Anyone with the link can start it (or only people on the approved list, if that’s on).',
  closed: 'Nobody new can start it. Results stay. Press Reopen to open it again.',
}

// Settings tab: time limit, strict mode, status and the test's link.
// (Deleting is in the ⋮ menu, top right.)
export default function SettingsTab() {
  const { test, draft, edit } = useTestEditor()
  const { user } = useAuth()
  const [toast, showToast] = useToast()
  const [toggling, setToggling] = useState(false)
  const status = test.status ?? 'draft'
  const link = `${window.location.origin}/test/${test.id}`
  const minutesOk = Number(draft.minutes) > 0

  async function toggleStrict() {
    setToggling(true)
    try {
      await updateTestFields(test.id, user.email, { strictMode: !test.strictMode })
      showToast(test.strictMode ? 'Strict mode off' : 'Strict mode on')
    } catch {
      showToast('Couldn’t change strict mode. Please try again.')
    } finally {
      setToggling(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      showToast('Link copied')
    } catch {
      showToast('Couldn’t copy the link')
    }
  }

  return (
    <div className="tab-stack settings">
      <section className="panel">
        <label className="field settings-minutes">
          <span>Time limit (minutes)</span>
          <input
            type="number"
            min={1}
            max={600}
            value={draft.minutes}
            disabled={status === 'open'}
            onChange={(e) => {
              const minutes = e.target.value === '' ? '' : Math.max(0, Math.round(Number(e.target.value)))
              edit((d) => ({ ...d, minutes }))
            }}
          />
        </label>
        {!minutesOk && <p className="form-error">Set at least 1 minute.</p>}
        {status === 'open' && <p className="take-muted">Close the test to change its time limit.</p>}
      </section>

      <section className="panel">
        <div className="switch-row">
          <span>
            <strong>Strict mode</strong>
            <small>
              The test runs full screen. Leaving the tab or full screen for 3 seconds submits it automatically,
              and there’s no exit button.
            </small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(test.strictMode)}
            aria-label="Strict mode"
            className="switch"
            onClick={toggleStrict}
            disabled={toggling}
          />
        </div>
      </section>

      <section className="panel">
        <p className="settings-status">
          Status: <span className={`status status-${status}`}>{STATUS_LABELS[status]}</span>
        </p>
        <p className="take-muted">{STATUS_HELP[status]}</p>
        <div className="settings-link">
          <code>{link}</code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
            <Copy size={15} /> Copy link
          </button>
        </div>
      </section>
      {toast}
    </div>
  )
}
