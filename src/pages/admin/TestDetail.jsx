import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { deleteSubmission, deleteTest, getTest, listSubmissionsForTest, updateTest } from '../../services/firestore';
import {
  ALLOWED_USERS_CSV_TEMPLATE,
  allowedUsersToCsv,
  copyToClipboard,
  downloadCsv,
  normalizeAllowedUser,
  parseAllowedUsersFile,
  submissionsToCsv,
} from '../../services/csv';
import SpreadsheetTable from '../../components/SpreadsheetTable';

function toDate(ts) {
  return ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
}

export default function TestDetail() {
  const { testId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [minutes, setMinutes] = useState(0);
  const [togglingActive, setTogglingActive] = useState(false);
  const [togglingStrict, setTogglingStrict] = useState(false);
  const [togglingRestrict, setTogglingRestrict] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [deleteSubmissionTarget, setDeleteSubmissionTarget] = useState(null);
  const [deleteSubmissionConfirmText, setDeleteSubmissionConfirmText] = useState('');
  const [deletingSubmission, setDeletingSubmission] = useState(false);

  const [view, setView] = useState('list'); // list | spreadsheet
  const [search, setSearch] = useState('');
  const [submittedOnly, setSubmittedOnly] = useState(false);

  const [copiedLabel, setCopiedLabel] = useState('');

  const [accessOpen, setAccessOpen] = useState(true);
  const [submissionsOpen, setSubmissionsOpen] = useState(true);

  const [accessEditing, setAccessEditing] = useState(false);
  const [allowedRows, setAllowedRows] = useState([]);
  const [accessSaving, setAccessSaving] = useState(false);
  const [allowedParseError, setAllowedParseError] = useState('');
  const allowedFileInputRef = useRef(null);

  async function reload() {
    const [foundTest, foundSubmissions] = await Promise.all([
      getTest(testId),
      listSubmissionsForTest(testId, user.email),
    ]);
    setTest(foundTest);
    setDisplayName(foundTest?.displayName ?? '');
    setMinutes(foundTest?.minutes ?? 0);
    setAllowedRows((foundTest?.allowedUsers ?? []).map((u, i) => normalizeAllowedUser(u, i)));
    setSubmissions(foundSubmissions);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      if (submittedOnly && !s.testTaken) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!(s.studentId || '').toLowerCase().includes(q) && !(s.name || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [submissions, search, submittedOnly]);

  async function toggleActive() {
    setTogglingActive(true);
    try {
      await updateTest(testId, { active: !(test.active !== false), updatedBy: user.email });
      await reload();
    } finally {
      setTogglingActive(false);
    }
  }

  async function toggleStrictMode() {
    setTogglingStrict(true);
    try {
      await updateTest(testId, { strictMode: !test.strictMode, updatedBy: user.email });
      await reload();
    } finally {
      setTogglingStrict(false);
    }
  }

  // Older tests never wrote restrictAccess - infer "on" from a non-empty
  // list so their existing behavior doesn't silently change.
  const restrictAccess = test?.restrictAccess ?? Boolean(test?.allowedUsers?.length);

  async function toggleRestrictAccess() {
    setTogglingRestrict(true);
    try {
      await updateTest(testId, { restrictAccess: !restrictAccess, updatedBy: user.email });
      await reload();
    } finally {
      setTogglingRestrict(false);
    }
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await updateTest(testId, { displayName: displayName.trim(), minutes: Number(minutes), updatedBy: user.email });
      setEditing(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirmText !== testId) return;
    setDeleting(true);
    try {
      await deleteTest(testId);
      navigate('/manage/tests');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteSubmission() {
    if (deleteSubmissionConfirmText !== testId || !deleteSubmissionTarget) return;
    setDeletingSubmission(true);
    try {
      await deleteSubmission(testId, deleteSubmissionTarget.id);
      setDeleteSubmissionTarget(null);
      setDeleteSubmissionConfirmText('');
      await reload();
    } finally {
      setDeletingSubmission(false);
    }
  }

  async function handleCopyLink() {
    await copyToClipboard(`${window.location.origin}/test/${testId}`);
    setCopiedLabel('link');
    setTimeout(() => setCopiedLabel(''), 2000);
  }

  function handleAddAllowedRow() {
    setAllowedRows((prev) => [...prev, normalizeAllowedUser({ name: '', studentId: '' }, prev.length)]);
  }

  function handleAllowedCellChange(rowIndex, key, value) {
    setAllowedRows((prev) => {
      const next = [...prev];
      next[rowIndex] = normalizeAllowedUser({ ...next[rowIndex], [key]: value }, rowIndex);
      return next;
    });
  }

  function handleDeleteAllowedRow(rowIndex) {
    setAllowedRows((prev) => prev.filter((_, i) => i !== rowIndex).map((r, i) => ({ ...r, row: i + 1 })));
  }

  async function handleAllowedFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAllowedParseError('');
    try {
      const parsed = await parseAllowedUsersFile(file);
      setAllowedRows((prev) => [...prev, ...parsed].map((r, i) => ({ ...r, row: i + 1 })));
    } catch (err) {
      setAllowedParseError(err.message);
    }
  }

  async function handleCopyAllowedTemplate() {
    await copyToClipboard(ALLOWED_USERS_CSV_TEMPLATE);
    setCopiedLabel('template');
    setTimeout(() => setCopiedLabel(''), 2000);
  }

  const invalidAllowedCount = allowedRows.filter((r) => !r.valid).length;

  async function handleSaveAccess() {
    if (invalidAllowedCount > 0) return;
    setAccessSaving(true);
    try {
      await updateTest(testId, {
        allowedUsers: allowedRows.map((r) => ({ name: r.name, studentId: r.studentId })),
        updatedBy: user.email,
      });
      setAccessEditing(false);
      reload();
    } finally {
      setAccessSaving(false);
    }
  }

  function handleCancelAccessEdit() {
    setAllowedRows((test.allowedUsers ?? []).map((u, i) => normalizeAllowedUser(u, i)));
    setAllowedParseError('');
    setAccessEditing(false);
  }

  function handleDownloadAllowedCsv() {
    downloadCsv(`${testId}-allowed-users.csv`, allowedUsersToCsv(test.allowedUsers));
  }

  function handleDownloadCsv() {
    const rows = filteredSubmissions.map((s) => ({
      studentId: s.studentId,
      name: s.name,
      userEmail: s.userEmail,
      testTaken: s.testTaken,
      score: s.score,
      totalQuestions: test.questions?.length ?? '',
      startedAt: toDate(s.startedAt)?.toISOString() ?? '',
      submittedAt: toDate(s.submittedAt)?.toISOString() ?? '',
    }));
    downloadCsv(`${testId}-submissions.csv`, submissionsToCsv(rows));
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!test) return <p className="text-slate-500">Test not found.</p>;
  if (test.createdBy !== user.email) return <p className="text-slate-500">You don't have access to manage this test.</p>;

  return (
    <div>
      <Link to="/manage/tests" className="text-sm text-[#444746] hover:text-[#1F1F1F] mb-4 inline-flex items-center gap-1">
        <i className="fa-solid fa-chevron-left"></i> All tests
      </Link>

      {/* Metadata */}
      <div className="gcard mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            {editing ? (
              <input className="input-field text-xl font-bold" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            ) : (
              <h1 className="text-2xl font-medium text-[#1F1F1F]">{test.displayName}</h1>
            )}
            <p className="text-xs font-mono text-[#444746] mt-1">{test.id}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleActive}
              disabled={togglingActive}
              className={`gpill disabled:opacity-70 disabled:cursor-not-allowed ${test.active !== false ? 'gpill-success' : 'gpill-neutral'}`}
            >
              {togglingActive ? (
                <i className="fa-solid fa-circle-notch fa-spin text-[10px]"></i>
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${test.active !== false ? 'bg-[#1E7E34]' : 'bg-[#444746]'}`}></span>
              )}
              {test.active !== false ? 'Active' : 'Disabled'}
            </button>
            <button
              type="button"
              onClick={toggleStrictMode}
              disabled={togglingStrict}
              title="No exit button, forces fullscreen, auto-submits if the student leaves"
              className={`gpill disabled:opacity-70 disabled:cursor-not-allowed ${test.strictMode ? 'gpill-danger' : 'gpill-neutral'}`}
            >
              {togglingStrict ? (
                <i className="fa-solid fa-circle-notch fa-spin text-[10px]"></i>
              ) : (
                <i className="fa-solid fa-lock"></i>
              )}
              Strict {test.strictMode ? 'On' : 'Off'}
            </button>
            <button onClick={handleCopyLink} className="gpill gpill-secondary">
              <i className={`fa-solid ${copiedLabel === 'link' ? 'fa-check' : 'fa-link'}`}></i> {copiedLabel === 'link' ? 'Copied!' : 'Copy Test Link'}
            </button>
            <Link to={`/manage/${testId}/questions`} className="gpill gpill-secondary">
              <i className="fa-solid fa-table-cells"></i> Edit Questions
            </Link>
            {editing ? (
              <button onClick={handleSaveEdit} disabled={saving} className="gpill gpill-primary disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            ) : (
              <button onClick={() => setEditing(true)} className="gpill gpill-neutral">
                <i className="fa-solid fa-pen"></i> Edit
              </button>
            )}
            <button onClick={() => setDeleteOpen(true)} className="gpill gpill-danger">
              <i className="fa-solid fa-trash"></i> Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm border-t border-[#F1F3F4] pt-4">
          <div>
            <div className="text-xs text-[#444746] uppercase tracking-wide mb-1">Questions</div>
            <div className="font-semibold text-[#1F1F1F]">{test.questions?.length ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-[#444746] uppercase tracking-wide mb-1">Time Limit</div>
            {editing ? (
              <input type="number" className="input-field !py-1 !px-2 w-20" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            ) : (
              <div className="font-semibold text-[#1F1F1F]">{test.minutes} min</div>
            )}
          </div>
          <div>
            <div className="text-xs text-[#444746] uppercase tracking-wide mb-1">Submissions</div>
            <div className="font-semibold text-[#1F1F1F]">{test.submissionCount ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-[#444746] uppercase tracking-wide mb-1">Created</div>
            <div className="font-semibold text-[#1F1F1F]">{toDate(test.createdAt)?.toLocaleDateString() ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Access restriction */}
      <div className="gcard mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setAccessOpen((open) => !open)}
            className="flex items-center gap-2 text-left"
          >
            <i className={`fa-solid fa-chevron-right text-xs text-[#444746] transition-transform ${accessOpen ? 'rotate-90' : ''}`}></i>
            <h2 className="text-lg font-medium text-[#1F1F1F]">Access Restriction</h2>
          </button>
          {!accessEditing && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={toggleRestrictAccess}
                disabled={togglingRestrict || (!restrictAccess && !test.allowedUsers?.length)}
                title={!restrictAccess && !test.allowedUsers?.length ? 'Add students to the list before turning restriction on' : ''}
                className={`gpill disabled:opacity-70 disabled:cursor-not-allowed ${restrictAccess ? 'gpill-success' : 'gpill-neutral'}`}
              >
                {togglingRestrict ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-[10px]"></i>
                ) : (
                  <span className={`w-1.5 h-1.5 rounded-full ${restrictAccess ? 'bg-[#1E7E34]' : 'bg-[#444746]'}`}></span>
                )}
                Restriction {restrictAccess ? 'On' : 'Off'}
              </button>
              {test.allowedUsers?.length > 0 && (
                <button onClick={handleDownloadAllowedCsv} className="gpill gpill-neutral">
                  <i className="fa-solid fa-download"></i> CSV
                </button>
              )}
              <button onClick={() => { setAccessOpen(true); setAccessEditing(true); }} className="gpill gpill-neutral">
                <i className="fa-solid fa-pen"></i> Edit
              </button>
            </div>
          )}
        </div>

        {accessOpen && (!accessEditing ? (
          <>
            <p className="text-sm text-[#444746] mt-1">
              {restrictAccess && test.allowedUsers?.length ? (
                <><span className="font-semibold text-[#1F1F1F]">{test.allowedUsers.length} student{test.allowedUsers.length === 1 ? '' : 's'}</span> may start this test — everyone else is blocked.</>
              ) : test.allowedUsers?.length ? (
                <>Restriction is off — anyone with the link may start, even though <span className="font-semibold text-[#1F1F1F]">{test.allowedUsers.length} saved student{test.allowedUsers.length === 1 ? '' : 's'}</span> would apply if turned on.</>
              ) : (
                'Open to anyone with the link.'
              )}
            </p>
            {test.allowedUsers?.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {test.allowedUsers.map((u) => (
                  <li key={u.studentId} className="text-xs bg-[#F1F3F4] rounded-full px-3 py-1 text-[#444746]">
                    {u.name} <span className="font-mono">({u.studentId})</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="mt-3">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex gap-2">
                <button type="button" onClick={handleAddAllowedRow} className="gpill gpill-neutral">
                  <i className="fa-solid fa-plus"></i> Add Student
                </button>
                <button type="button" onClick={() => allowedFileInputRef.current?.click()} className="gpill gpill-neutral">
                  <i className="fa-solid fa-file-arrow-up"></i> Upload CSV
                </button>
                <input ref={allowedFileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleAllowedFile} />
              </div>
              <button type="button" onClick={handleCopyAllowedTemplate} className="text-xs font-medium text-[#0B57D0] hover:underline">
                {copiedLabel === 'template' ? 'Copied!' : 'Copy CSV template'}
              </button>
            </div>

            <p className="text-xs text-[#444746] mb-3">Clear the list entirely and save to reopen this test to anyone with the link.</p>

            {allowedParseError && <p className="text-sm text-red-500 mb-3">{allowedParseError}</p>}

            {invalidAllowedCount > 0 && <p className="text-sm text-red-500 mb-3">{invalidAllowedCount} row(s) need fixing before you can save.</p>}

            <SpreadsheetTable
              columns={[
                { key: 'row', label: '#', width: 40, editable: false },
                { key: 'name', label: 'Name' },
                { key: 'studentId', label: 'Student ID' },
              ]}
              rows={allowedRows}
              editable
              onCellChange={handleAllowedCellChange}
              onDeleteRow={handleDeleteAllowedRow}
              emptyMessage="No students added — this test is open to anyone with the link."
            />

            <div className="flex gap-3 mt-4">
              <button onClick={handleCancelAccessEdit} className="px-4 py-2.5 rounded-full text-[#444746] text-sm font-medium hover:bg-[#F1F3F4]">Cancel</button>
              <button onClick={handleSaveAccess} disabled={accessSaving || invalidAllowedCount > 0} className="gpill gpill-primary !px-5 !py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {accessSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Submissions */}
      <div className="gcard">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <button
            type="button"
            onClick={() => setSubmissionsOpen((open) => !open)}
            className="flex items-center gap-2 text-left"
          >
            <i className={`fa-solid fa-chevron-right text-xs text-[#444746] transition-transform ${submissionsOpen ? 'rotate-90' : ''}`}></i>
            <h2 className="text-lg font-medium text-[#1F1F1F]">Submissions</h2>
          </button>
          {submissionsOpen && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                className="input-field !py-1.5 !w-40 text-sm"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <label className="flex items-center gap-1.5 text-xs text-[#444746]">
                <input type="checkbox" checked={submittedOnly} onChange={(e) => setSubmittedOnly(e.target.checked)} />
                Submitted only
              </label>
              <div className="flex rounded-full bg-[#F1F3F4] p-1">
                <button onClick={() => setView('list')} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${view === 'list' ? 'bg-white text-[#1F1F1F] shadow-sm' : 'text-[#444746]'}`}>List</button>
                <button onClick={() => setView('spreadsheet')} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${view === 'spreadsheet' ? 'bg-white text-[#1F1F1F] shadow-sm' : 'text-[#444746]'}`}>Spreadsheet</button>
              </div>
              <button onClick={handleDownloadCsv} className="gpill gpill-neutral">
                <i className="fa-solid fa-download"></i> CSV
              </button>
            </div>
          )}
        </div>

        {submissionsOpen && (view === 'spreadsheet' ? (
          <SpreadsheetTable
            columns={[
              { key: 'studentId', label: 'Student ID' },
              { key: 'name', label: 'Name' },
              { key: 'score', label: 'Score', render: (v) => (v == null ? '—' : `${v}/${test.questions?.length ?? '?'}`) },
              { key: 'testTaken', label: 'Submitted', render: (v) => (v ? 'Yes' : 'No') },
              { key: 'submittedAt', label: 'Submitted At', render: (v) => toDate(v)?.toLocaleString() ?? '—' },
              { key: 'deleteAction', label: '', width: 40, render: (_, row) => (
                <button type="button" onClick={() => setDeleteSubmissionTarget(row)} className="text-[#C5221F] hover:opacity-70" title="Delete submission">
                  <i className="fa-solid fa-trash"></i>
                </button>
              ) },
            ]}
            rows={filteredSubmissions}
            emptyMessage="No submissions match your filters."
          />
        ) : (
          <ul className="divide-y divide-[#F1F3F4]">
            {filteredSubmissions.length === 0 && <p className="text-sm text-[#444746] py-8 text-center">No submissions match your filters.</p>}
            {filteredSubmissions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-[#1F1F1F] truncate">{s.name} <span className="text-[#444746] font-mono text-xs">({s.studentId})</span></div>
                  <div className="text-xs text-[#444746]">{s.testTaken ? `Submitted ${toDate(s.submittedAt)?.toLocaleString() ?? ''}` : 'In progress / not submitted'}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {s.testTaken && (
                    <span className="text-sm font-semibold text-[#1F1F1F]">{s.score}/{test.questions?.length ?? '?'}</span>
                  )}
                  <button type="button" onClick={() => setDeleteSubmissionTarget(s)} className="text-[#C5221F] hover:opacity-70" title="Delete submission">
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}
      </div>

      {deleteSubmissionTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-medium text-[#1F1F1F] text-lg mb-2">Delete this submission?</h3>
            <p className="text-sm text-[#444746] mb-4">
              This removes <span className="font-semibold text-[#1F1F1F]">{deleteSubmissionTarget.name}</span>'s attempt ({deleteSubmissionTarget.studentId}) permanently. Type the test ID <span className="font-mono font-semibold">{testId}</span> to confirm.
            </p>
            <input
              className="input-field mb-4"
              value={deleteSubmissionConfirmText}
              onChange={(e) => setDeleteSubmissionConfirmText(e.target.value)}
              placeholder={testId}
            />
            <div className="flex gap-3">
              <button onClick={() => { setDeleteSubmissionTarget(null); setDeleteSubmissionConfirmText(''); }} className="flex-1 py-2.5 rounded-full text-[#444746] font-medium hover:bg-[#F1F3F4]">Cancel</button>
              <button
                onClick={handleDeleteSubmission}
                disabled={deleteSubmissionConfirmText !== testId || deletingSubmission}
                className="flex-1 py-2.5 bg-[#C5221F] text-white rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingSubmission ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-medium text-[#1F1F1F] text-lg mb-2">Delete this test?</h3>
            <p className="text-sm text-[#444746] mb-4">This can't be undone. Type <span className="font-mono font-semibold">{testId}</span> to confirm.</p>
            <input
              className="input-field mb-4"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={testId}
            />
            <div className="flex gap-3">
              <button onClick={() => { setDeleteOpen(false); setDeleteConfirmText(''); }} className="flex-1 py-2.5 rounded-full text-[#444746] font-medium hover:bg-[#F1F3F4]">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== testId || deleting}
                className="flex-1 py-2.5 bg-[#C5221F] text-white rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
