import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createTest } from '../../services/firestore';
import {
  ALLOWED_USERS_CSV_TEMPLATE,
  CSV_TEMPLATE,
  JSON_TEMPLATE,
  copyToClipboard,
  normalizeAllowedUser,
  parseAllowedUsersFile,
  parseQuestionsFile,
} from '../../services/csv';
import SpreadsheetTable from '../../components/SpreadsheetTable';

export default function NewTest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const allowedFileInputRef = useRef(null);

  const [adminEnteredId, setAdminEnteredId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [minutes, setMinutes] = useState(15);

  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [copiedLabel, setCopiedLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const [restrictAccess, setRestrictAccess] = useState(false);
  const [allowedRows, setAllowedRows] = useState([]);
  const [allowedParseError, setAllowedParseError] = useState('');

  const [strictMode, setStrictMode] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setRows([]);
    try {
      const parsed = await parseQuestionsFile(file);
      setRows(parsed);
    } catch (err) {
      setParseError(err.message);
    }
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

  async function handleCopy(label, text) {
    await copyToClipboard(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(''), 2000);
  }

  const validRows = rows.filter((r) => r.valid);
  const invalidCount = rows.length - validRows.length;

  const validAllowedRows = allowedRows.filter((r) => r.valid);
  const invalidAllowedCount = allowedRows.length - validAllowedRows.length;

  const canCreate =
    adminEnteredId.trim() &&
    displayName.trim() &&
    Number(minutes) > 0 &&
    rows.length > 0 &&
    invalidCount === 0 &&
    (!restrictAccess || (allowedRows.length > 0 && invalidAllowedCount === 0));

  async function handleCreate() {
    if (!canCreate) return;
    setCreating(true);
    setFormError('');
    try {
      const testId = await createTest({
        adminEnteredId: adminEnteredId.trim(),
        displayName: displayName.trim(),
        minutes: Number(minutes),
        questions: validRows.map((r) => ({ question: r.question, options: r.options, answer: r.answer })),
        allowedUsers: restrictAccess ? validAllowedRows.map((r) => ({ name: r.name, studentId: r.studentId })) : [],
        restrictAccess,
        strictMode,
        createdBy: user.email,
      });
      navigate(`/manage/${testId}`);
    } catch {
      setFormError('Could not create the test. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-medium text-[#1F1F1F] mb-6">New Test</h1>

      <div className="gcard mb-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1F1F1F] mb-1">Test ID</label>
            <input
              className="input-field"
              value={adminEnteredId}
              onChange={(e) => setAdminEnteredId(e.target.value)}
              placeholder="e.g. eme401"
            />
            <p className="text-xs text-[#444746] mt-1">A random suffix is appended automatically, e.g. eme401-vg63f127.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1F1F1F] mb-1">Display Name</label>
            <input
              className="input-field"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. EME 401: Educational Planning"
            />
          </div>
        </div>

        <div className="max-w-[160px]">
          <label className="block text-sm font-medium text-[#1F1F1F] mb-1">Time Limit (minutes)</label>
          <input
            type="number"
            min="1"
            className="input-field"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
      </div>

      <div className="gcard mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-[#1F1F1F]">Upload Questions</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleCopy('csv', CSV_TEMPLATE)} className="text-xs font-medium text-[#0B57D0] hover:underline">
              {copiedLabel === 'csv' ? 'Copied!' : 'Copy CSV template'}
            </button>
            <span className="text-[#DADCE0]">|</span>
            <button type="button" onClick={() => handleCopy('json', JSON_TEMPLATE)} className="text-xs font-medium text-[#0B57D0] hover:underline">
              {copiedLabel === 'json' ? 'Copied!' : 'Copy JSON template'}
            </button>
          </div>
        </div>

        <p className="text-xs text-[#444746] mb-4">
          Each question needs a <code>question</code>, an <code>options</code> list, and an <code>answer</code> that exactly matches one option.
          In CSV, separate options with a pipe (<code>|</code>). Copy a template above to get the exact shape.
        </p>

        <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
          <i className="fa-solid fa-file-arrow-up text-2xl text-[#444746] mb-2"></i>
          <p className="text-sm text-[#444746] font-medium">Click to upload a .csv or .json file</p>
          <input ref={fileInputRef} type="file" accept=".csv,.json,application/json,text/csv" className="hidden" onChange={handleFile} />
        </div>

        {parseError && <p className="text-sm text-red-500 mt-4">{parseError}</p>}

        {rows.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-4 mb-3 text-sm">
              <span className="text-[#1E7E34] font-medium">{validRows.length} valid</span>
              {invalidCount > 0 && <span className="text-red-500 font-medium">{invalidCount} needs fixing</span>}
            </div>
            <SpreadsheetTable
              columns={[
                { key: 'row', label: '#', width: 40 },
                { key: 'question', label: 'Question' },
                { key: 'options', label: 'Options', render: (v) => v.join(' | ') },
                { key: 'answer', label: 'Answer', width: 140 },
                { key: 'status', label: 'Status', width: 160, render: (_, row) => (row.valid ? <span className="text-[#1E7E34]"><i className="fa-solid fa-check"></i> OK</span> : <span className="text-red-500 text-xs">{row.errors.join(', ')}</span>) },
              ]}
              rows={rows}
            />
          </div>
        )}
      </div>

      <div className="gcard mb-6">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={restrictAccess} onChange={(e) => setRestrictAccess(e.target.checked)} />
          <span className="text-sm font-semibold text-[#1F1F1F]">Restrict access to specific students</span>
        </label>
        <p className="text-xs text-[#444746] mt-1 mb-4">
          When on, only students whose name and Student ID exactly match an entry below can start this test.
        </p>

        {restrictAccess && (
          <>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex gap-2">
                <button type="button" onClick={handleAddAllowedRow} className="gpill gpill-neutral">
                  <i className="fa-solid fa-plus"></i> Add Student
                </button>
                <button type="button" onClick={() => allowedFileInputRef.current?.click()} className="gpill gpill-neutral">
                  <i className="fa-solid fa-file-arrow-up"></i> Upload CSV
                </button>
                <input ref={allowedFileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleAllowedFile} />
              </div>
              <button type="button" onClick={() => handleCopy('allowed-csv', ALLOWED_USERS_CSV_TEMPLATE)} className="text-xs font-medium text-[#0B57D0] hover:underline">
                {copiedLabel === 'allowed-csv' ? 'Copied!' : 'Copy CSV template'}
              </button>
            </div>

            {allowedParseError && <p className="text-sm text-red-500 mb-3">{allowedParseError}</p>}

            {allowedRows.length > 0 ? (
              <>
                <div className="flex items-center gap-4 mb-3 text-sm">
                  <span className="text-[#1E7E34] font-medium">{validAllowedRows.length} valid</span>
                  {invalidAllowedCount > 0 && <span className="text-red-500 font-medium">{invalidAllowedCount} needs fixing</span>}
                </div>
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
                />
              </>
            ) : (
              <p className="text-sm text-[#444746] py-6 text-center">No students added yet.</p>
            )}
          </>
        )}
      </div>

      <div className="gcard mb-6">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} />
          <span className="text-sm font-semibold text-[#1F1F1F]">Strict mode</span>
        </label>
        <p className="text-xs text-[#444746] mt-1">
          Hides the exit button and locks the browser into fullscreen. If a student switches tabs, exits fullscreen, or navigates away, a 3-second countdown starts and the test auto-submits unless they return in time.
        </p>
      </div>

      {formError && <p className="text-sm text-red-500 mb-4">{formError}</p>}

      <button onClick={handleCreate} disabled={!canCreate || creating} className="btn-primary !w-auto px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed">
        {creating ? 'Creating…' : 'Create Test'}
      </button>
    </div>
  );
}
