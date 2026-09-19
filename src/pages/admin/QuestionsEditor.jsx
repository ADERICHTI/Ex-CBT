import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTest, getTestAnswerKey, updateTest } from '../../services/firestore';
import { downloadCsv, downloadJson, normalizeQuestion, questionsToCsv } from '../../services/csv';
import SpreadsheetTable from '../../components/SpreadsheetTable';

function toRow(q, i) {
  return normalizeQuestion({ question: q.question, options: q.options.join('|'), answer: q.answer }, i);
}

export default function QuestionsEditor() {
  const { testId } = useParams();
  const { user } = useAuth();

  const [test, setTest] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([getTest(testId), getTestAnswerKey(testId)]).then(([found, answers]) => {
      setTest(found);
      const questionsWithAnswers = (found?.questions ?? []).map((q, i) => ({ ...q, answer: answers[i] ?? '' }));
      setRows(questionsWithAnswers.map(toRow));
      setLoading(false);
    });
  }, [testId]);

  function handleCellChange(rowIndex, key, value) {
    setSaved(false);
    setRows((prev) => {
      const next = [...prev];
      const raw = { question: next[rowIndex].question, options: next[rowIndex].options.join('|'), answer: next[rowIndex].answer, [key]: value };
      next[rowIndex] = normalizeQuestion(raw, rowIndex);
      return next;
    });
  }

  function handleDeleteRow(rowIndex) {
    setSaved(false);
    setRows((prev) => prev.filter((_, i) => i !== rowIndex).map((r, i) => ({ ...r, row: i + 1 })));
  }

  function handleAddRow() {
    setSaved(false);
    setRows((prev) => [...prev, normalizeQuestion({ question: '', options: '', answer: '' }, prev.length)]);
  }

  const invalidCount = rows.filter((r) => !r.valid).length;

  function handleDownloadCsv() {
    downloadCsv(`${testId}-questions.csv`, questionsToCsv(rows));
  }

  function handleDownloadJson() {
    downloadJson(`${testId}-questions.json`, rows.map((r) => ({ question: r.question, options: r.options, answer: r.answer })));
  }

  async function handleSave() {
    if (invalidCount > 0) return;
    setSaving(true);
    try {
      await updateTest(testId, {
        questions: rows.map((r) => ({ question: r.question, options: r.options, answer: r.answer })),
        updatedBy: user.email,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!test) return <p className="text-slate-500">Test not found.</p>;
  if (test.createdBy !== user.email) return <p className="text-slate-500">You don't have access to manage this test.</p>;

  return (
    <div>
      <Link to={`/manage/${testId}`} className="text-sm text-[#444746] hover:text-[#1F1F1F] mb-4 inline-flex items-center gap-1">
        <i className="fa-solid fa-chevron-left"></i> {test.displayName}
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-2xl font-medium text-[#1F1F1F]">Edit Questions</h1>
        <div className="flex items-center gap-3">
          {invalidCount > 0 && <span className="text-sm text-red-500 font-medium">{invalidCount} row(s) need fixing</span>}
          {saved && <span className="text-sm text-[#1E7E34] font-medium">Saved</span>}
          <button onClick={handleDownloadCsv} disabled={rows.length === 0} className="gpill gpill-neutral disabled:opacity-50 disabled:cursor-not-allowed">
            <i className="fa-solid fa-download"></i> CSV
          </button>
          <button onClick={handleDownloadJson} disabled={rows.length === 0} className="gpill gpill-neutral disabled:opacity-50 disabled:cursor-not-allowed">
            <i className="fa-solid fa-download"></i> JSON
          </button>
          <button onClick={handleAddRow} className="gpill gpill-neutral">
            <i className="fa-solid fa-plus"></i> Add Question
          </button>
          <button onClick={handleSave} disabled={saving || invalidCount > 0 || rows.length === 0} className="btn-primary !w-auto px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <p className="text-xs text-[#444746] mb-4">
        Separate options with a pipe (<code>|</code>). The answer must match one of the options exactly.
      </p>

      <SpreadsheetTable
        columns={[
          { key: 'row', label: '#', width: 40, editable: false },
          { key: 'question', label: 'Question' },
          { key: 'optionsText', label: 'Options (pipe-separated)' },
          { key: 'answer', label: 'Answer', width: 160 },
        ]}
        rows={rows.map((r) => ({ ...r, optionsText: r.options.join('|') }))}
        editable
        onCellChange={(rowIndex, key, value) => handleCellChange(rowIndex, key === 'optionsText' ? 'options' : key, value)}
        onDeleteRow={handleDeleteRow}
        emptyMessage="No questions yet — add one to get started."
      />

      {rows.some((r) => !r.valid) && (
        <ul className="mt-4 text-xs text-red-500 space-y-1">
          {rows.filter((r) => !r.valid).map((r) => (
            <li key={r.row}>Row {r.row}: {r.errors.join(', ')}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
