import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Plus, Upload, UserMinus, X } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import Spinner from '../../lib/Spinner.jsx'
import { timeAgo } from '../../lib/timeAgo.js'
import { useToast } from '../../lib/useToast.jsx'
import {
  ALLOWED_USERS_CSV_TEMPLATE,
  allowedUsersToCsv,
  downloadCsv,
  normalizeAllowedUser,
  parseAllowedUsersFile,
} from '../../services/csv.js'
import { getRoster, saveRoster, updateTestFields, watchSubmissions } from '../../services/firestore.js'
import { useAuth } from '../auth/useAuth.js'
import { useTestEditor } from './testContext.js'

const toRows = (list) => list.map((u, i) => normalizeAllowedUser(u, i))
const sameList = (a, b) =>
  a.length === b.length && a.every((r, i) => r.name === b[i].name && r.studentId === b[i].studentId)

// Candidates tab: who may take the test (everyone with the link, or only
// people on the approved list), the list itself, and who's mid-test.
export default function CandidatesTab() {
  const { test } = useTestEditor()
  const { user } = useAuth()
  const [toast, showToast] = useToast()
  const [saved, setSaved] = useState(null) // the list as stored
  const [rows, setRows] = useState([])
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [removing, setRemoving] = useState(null) // row index
  const [started, setStarted] = useState([])
  const fileRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getRoster(test.id).then(
      (list) => {
        if (cancelled) return
        setSaved(list)
        setRows(toRows(list))
      },
      () => !cancelled && setLoadError(true),
    )
    return () => {
      cancelled = true
    }
  }, [test.id])

  useEffect(
    () =>
      watchSubmissions(
        test.id,
        user.email,
        (subs) => setStarted(subs.filter((s) => !s.testTaken)),
        () => {},
      ),
    [test.id, user.email],
  )

  const restrict = test.restrictAccess ?? false
  const invalid = rows.filter((r) => !r.valid).length
  const dirty = saved && !sameList(rows, saved)
  const duplicateIds = useMemo(() => {
    const seen = new Map()
    rows.forEach((r) => {
      const key = r.studentId.trim().toLowerCase()
      if (key) seen.set(key, (seen.get(key) ?? 0) + 1)
    })
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k))
  }, [rows])

  async function toggleRestrict() {
    setToggling(true)
    try {
      await updateTestFields(test.id, user.email, { restrictAccess: !restrict })
      showToast(restrict ? 'Anyone with the link can take the test' : 'Only people on the list can take the test')
    } catch {
      showToast('Couldn’t change who can take the test. Please try again.')
    } finally {
      setToggling(false)
    }
  }

  function setCell(index, key, value) {
    setRows((prev) => prev.map((r, i) => (i === index ? normalizeAllowedUser({ ...r, [key]: value }, i) : r)))
  }

  function removeRow(index) {
    setRows((prev) => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, row: i + 1 })))
  }

  async function upload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = await parseAllowedUsersFile(file)
      setRows((prev) => [...prev, ...parsed].map((r, i) => ({ ...r, row: i + 1 })))
      showToast(`Added ${parsed.length} row${parsed.length === 1 ? '' : 's'} - press Save list to keep them`)
    } catch (err) {
      showToast(err.message || 'Couldn’t read that file')
    }
  }

  async function save() {
    setSaving(true)
    try {
      const list = rows.map((r) => ({ name: r.name.trim(), studentId: r.studentId.trim() }))
      await saveRoster(test.id, user.email, list)
      setSaved(list)
      setRows(toRows(list))
      showToast('List saved')
    } catch {
      showToast('Couldn’t save the list. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <p className="form-error" role="alert">
        Couldn’t load the approved list. Check your connection and refresh.
      </p>
    )
  }
  if (!saved) return <Spinner fill="box" label="Loading the approved list" />

  const canRestrict = restrict || saved.length > 0

  return (
    <div className="tab-stack">
      <section className="panel">
        <div className="switch-row">
          <span>
            <strong>Only people on the approved list</strong>
            <small>
              {restrict
                ? 'Candidates must enter a name and Student ID that match a row below.'
                : 'Off: anyone with the link can take the test.'}
              {!canRestrict && ' Save a list first to turn this on.'}
            </small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={restrict}
            aria-label="Only people on the approved list"
            className="switch"
            onClick={toggleRestrict}
            disabled={toggling || !canRestrict}
          />
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Approved list</h2>
          <span className="panel-tools">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Upload CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={upload} />
            {saved.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => downloadCsv(`${test.id}-approved-list.csv`, allowedUsersToCsv(saved))}
              >
                <Download size={15} /> Download
              </button>
            )}
          </span>
        </header>
        <p className="take-muted">
          Name and Student ID must both match (capital letters and extra spaces don’t matter).{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => downloadCsv('approved-list-template.csv', ALLOWED_USERS_CSV_TEMPLATE)}
          >
            CSV template
          </button>
        </p>

        {rows.length > 0 && (
          <div className="grid-table roster-table" role="table" aria-label="Approved list">
            <div className="grid-row grid-head" role="row">
              <span role="columnheader">#</span>
              <span role="columnheader">Full name</span>
              <span role="columnheader">Student ID</span>
              <span role="columnheader" className="sr-only">
                Remove
              </span>
            </div>
            {rows.map((r, i) => {
              const dup = duplicateIds.has(r.studentId.trim().toLowerCase())
              return (
                <div key={i} className={`grid-row${r.valid && !dup ? '' : ' grid-row-bad'}`} role="row">
                  <span className="grid-num" role="cell">
                    {i + 1}
                  </span>
                  <span role="cell" className="grid-cell">
                    <input
                      value={r.name}
                      onChange={(e) => setCell(i, 'name', e.target.value)}
                      placeholder="Full name"
                      aria-label={`Row ${i + 1} name`}
                    />
                  </span>
                  <span role="cell" className="grid-cell">
                    <input
                      value={r.studentId}
                      onChange={(e) => setCell(i, 'studentId', e.target.value)}
                      placeholder="Student ID"
                      aria-label={`Row ${i + 1} Student ID`}
                      title={dup ? 'This Student ID appears more than once' : undefined}
                    />
                  </span>
                  <span role="cell">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => (r.name.trim() || r.studentId.trim() ? setRemoving(i) : removeRow(i))}
                      aria-label={`Remove row ${i + 1}`}
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {(invalid > 0 || duplicateIds.size > 0) && (
          <p className="form-error" role="alert">
            {invalid > 0 && `${invalid} row${invalid === 1 ? ' is' : 's are'} missing a name or Student ID. `}
            {duplicateIds.size > 0 && 'Some Student IDs appear more than once - each person should have one row.'}
          </p>
        )}

        <div className="panel-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setRows((prev) => [...prev, normalizeAllowedUser({ name: '', studentId: '' }, prev.length)])}
          >
            <Plus size={16} /> Add person
          </button>
          {dirty && (
            <>
              <span className="unsaved">Unsaved changes</span>
              <button type="button" className="btn btn-ghost" onClick={() => setRows(toRows(saved))} disabled={saving}>
                Undo changes
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving || invalid > 0}>
                {saving ? 'Saving…' : 'Save list'}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Taking the test now</h2>
        </header>
        {started.length === 0 ? (
          <p className="take-muted">Nobody is in the middle of this test.</p>
        ) : (
          <ul className="people">
            {started.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong>
                <span>{s.studentId}</span>
                <span className="take-muted">{s.userEmail}</span>
                <span className="take-muted">started {timeAgo(s.startedAt?.toDate?.() ?? null)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={removing !== null}
        label="Remove from the list"
        icon={UserMinus}
        title="Remove this person from the list?"
        message={
          removing !== null
            ? `${rows[removing]?.name || 'This row'} (${rows[removing]?.studentId || 'no ID'}) won’t be able to start the test once you save the list.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={() => {
          removeRow(removing)
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
      {toast}
    </div>
  )
}
