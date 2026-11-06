import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Info, Link2, Lock, Mail, MailPlus, UserCheck, Users, X } from 'lucide-react'
import ConfirmModal from '../../lib/ConfirmModal.jsx'
import QtWindow, { QtActions } from '../../lib/QtWindow.jsx'
import Spinner from '../../lib/Spinner.jsx'
import { callEmailTestLink, callManageEditors } from '../../services/firestore.js'
import { useTestEditor } from './testContext.js'
import './share.css'

// Share (as in PeraForm): who can edit the test (owner + editors; only the
// owner adds or removes people), Email the test link, who can take it, and
// Copy link. Editors change the questions and see the results.
export default function ShareDialog({ open, onClose, showToast, onPublish, onCopyLink }) {
  const navigate = useNavigate()
  const { test, draft } = useTestEditor()
  const [data, setData] = useState(null) // { isOwner, members, invites }
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { kind: 'error' | 'notice', text }
  const [pending, setPending] = useState(null) // { kind: 'remove' | 'cancelInvite', … }

  const [emailing, setEmailing] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError] = useState('')

  const title = draft?.displayName || 'Untitled test'
  const isOpen = test.status === 'open'

  const load = () =>
    callManageEditors({ action: 'list', testId: test.id }).then(
      ({ data }) => {
        setData(data)
        setLoadError('')
      },
      () => setLoadError('Couldn’t load who has access. Check your connection and try again.'),
    )

  // A fresh list each time the window opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    callManageEditors({ action: 'list', testId: test.id }).then(
      ({ data }) => !cancelled && (setData(data), setLoadError('')),
      () => !cancelled && setLoadError('Couldn’t load who has access. Check your connection and try again.'),
    )
    return () => {
      cancelled = true
    }
  }, [open, test.id])

  async function add(e) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const { data: res } = await callManageEditors({ action: 'add', testId: test.id, email })
      const text = {
        added: `${email.trim()} can now edit this test.`,
        invited: `${email.trim()} doesn’t have a HyperCBT account yet. They’ll get access when they sign up with that email.`,
        already: `${email.trim()} already has access.`,
      }[res.status]
      setMessage({ kind: 'notice', text })
      setEmail('')
      await load()
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || 'Couldn’t add them. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  async function confirmPending() {
    setBusy(true)
    try {
      await callManageEditors({ action: pending.kind, testId: test.id, uid: pending.uid, email: pending.email })
      showToast(pending.kind === 'remove' ? 'Editor removed' : 'Invite cancelled')
      await load()
    } catch {
      showToast('Something went wrong. Please try again.')
    } finally {
      setPending(null)
      setBusy(false)
    }
  }

  async function sendEmail(e) {
    e.preventDefault()
    if (!emailTo.trim()) return
    setEmailSending(true)
    setEmailError('')
    try {
      const { data: res } = await callEmailTestLink({
        testId: test.id,
        to: emailTo,
        subject: emailSubject.trim() || `Your test: ${title}`,
        message: emailMessage,
      })
      showToast(`Sent to ${res.sent} ${res.sent === 1 ? 'person' : 'people'}`)
      setEmailTo('')
      setEmailMessage('')
      setEmailing(false)
    } catch (err) {
      setEmailError(err.message || 'Couldn’t send the email. Please try again.')
    } finally {
      setEmailSending(false)
    }
  }

  const restricted = Boolean(test.restrictAccess)

  return (
    <QtWindow
      open={open}
      onClose={onClose}
      icon={Users}
      label="Share"
      context={title}
      title="Who can edit this test?"
      hint="Editors can change the questions and see the results. Only the owner adds or removes people."
      size="wide"
    >
      {data?.isOwner && (
        <form className="collab-add" onSubmit={add}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Add people by email"
            aria-label="Editor’s email"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !email.trim()}>
            <MailPlus size={16} />
            Add
          </button>
        </form>
      )}
      {message && (
        <p className={message.kind === 'error' ? 'form-error' : 'form-notice'} role="status">
          {message.text}
        </p>
      )}

      {loadError ? (
        <p className="form-error">{loadError}</p>
      ) : !data ? (
        <Spinner fill="box" />
      ) : (
        <ul className="collab-list">
          {data.members.map((m) => (
            <li key={m.uid || m.email}>
              <span className="collab-avatar" aria-hidden="true">
                {m.photo ? (
                  <img src={m.photo} alt="" referrerPolicy="no-referrer" />
                ) : (
                  (m.name || m.email || '?').charAt(0).toUpperCase()
                )}
              </span>
              <span className="collab-who">
                <strong>{m.name || m.email}</strong>
                {m.name && <span>{m.email}</span>}
              </span>
              <span className="collab-role">{m.role === 'owner' ? 'Owner' : 'Editor'}</span>
              {data.isOwner && m.role !== 'owner' && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setPending({ kind: 'remove', uid: m.uid, label: m.name || m.email })}
                  aria-label={`Remove ${m.name || m.email}`}
                >
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
          {data.invites.map((inviteEmail) => (
            <li key={inviteEmail}>
              <span className="collab-avatar collab-avatar-pending" aria-hidden="true">
                {inviteEmail.charAt(0).toUpperCase()}
              </span>
              <span className="collab-who">
                <strong>{inviteEmail}</strong>
                <span>Waiting for them to sign up</span>
              </span>
              <span className="collab-role">Invited</span>
              {data.isOwner && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setPending({ kind: 'cancelInvite', email: inviteEmail, label: inviteEmail })}
                  aria-label={`Cancel invite for ${inviteEmail}`}
                >
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="share-email-toggle">
        <button type="button" className="btn btn-outline" onClick={() => setEmailing((v) => !v)}>
          <Mail size={16} />
          {emailing ? 'Hide' : 'Email the test link'}
        </button>
      </div>

      {emailing && (
        <form className="share-email-form" onSubmit={sendEmail}>
          <label className="share-field">
            <span>To (comma-separated, up to 25)</span>
            <input
              type="text"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="ada@example.com, tunde@example.com"
              required
            />
          </label>
          <label className="share-field">
            <span>Subject</span>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={`Your test: ${title}`}
            />
          </label>
          <label className="share-field">
            <span>Message (optional)</span>
            <textarea
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              placeholder="For example: The test opens at 9am. Have your Student ID ready."
              rows={3}
            />
          </label>
          {emailError && (
            <p className="form-error" role="status">
              {emailError}
            </p>
          )}
          <div className="share-email-actions">
            <button type="submit" className="btn btn-primary" disabled={emailSending || !emailTo.trim() || !isOpen}>
              {emailSending ? 'Sending…' : 'Send email'}
            </button>
          </div>
          {!isOpen && <p className="share-field-hint">Publish the test before emailing its link to candidates.</p>}
        </form>
      )}

      <h3 className="share-heading">General access</h3>
      <div className="share-access">
        <span className="share-access-icon">
          <Lock size={16} />
        </span>
        <span className="share-access-text">
          <strong>Editor view · Restricted</strong>
          <span>Only the people above can open the editor</span>
        </span>
      </div>
      <div className="share-access">
        <span className={`share-access-icon${restricted ? '' : ' share-access-open'}`}>
          {restricted ? <UserCheck size={16} /> : <Globe size={16} />}
        </span>
        <span className="share-access-text">
          <strong>Candidates</strong>
          <span>
            {restricted
              ? 'Only people on your approved list (name and Student ID) can start it'
              : 'Anyone who signs in with the link can start it'}
          </span>
        </span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => {
            onClose()
            navigate(`/tests/${test.id}/candidates`)
          }}
        >
          Change
        </button>
      </div>

      {!isOpen && (
        <div className="share-status">
          <Info size={16} />
          <span>
            {test.status === 'closed'
              ? 'This test is closed, so candidates can’t start it right now.'
              : 'Publish the test so candidates can start it.'}
          </span>
          {test.status === 'draft' && (
            <button type="button" className="link-btn" onClick={onPublish}>
              Publish
            </button>
          )}
        </div>
      )}

      <QtActions align="between">
        <button type="button" className="btn btn-outline" onClick={onCopyLink}>
          <Link2 size={16} />
          Copy test link
        </button>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </QtActions>

      <ConfirmModal
        open={Boolean(pending)}
        label={pending?.kind === 'remove' ? 'Remove editor' : 'Cancel invite'}
        context={title}
        icon={Users}
        title={pending?.kind === 'remove' ? `Remove ${pending?.label}?` : `Cancel the invite for ${pending?.label}?`}
        message={
          pending?.kind === 'remove'
            ? 'They’ll lose access to this test and its results straight away.'
            : 'They won’t get access when they sign up.'
        }
        confirmLabel={pending?.kind === 'remove' ? 'Remove' : 'Cancel invite'}
        busy={busy}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </QtWindow>
  )
}
