import Papa from 'papaparse';

export const CSV_TEMPLATE = `question,options,answer
"What is the SI unit of force?","Newton|Joule|Watt|Pascal","Newton"
`;

export const JSON_TEMPLATE = JSON.stringify(
  [
    {
      question: 'What is the SI unit of force?',
      options: ['Newton', 'Joule', 'Watt', 'Pascal'],
      answer: 'Newton',
    },
  ],
  null,
  2
);

export function normalizeQuestion(raw, rowIndex) {
  const errors = [];
  const question = String(raw.question ?? '').trim();

  let options = raw.options;
  if (typeof options === 'string') {
    options = options.split('|').map((o) => o.trim());
  }
  options = Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : [];

  const answer = String(raw.answer ?? '').trim();

  if (!question) errors.push('question is empty');
  if (options.length < 2) errors.push('needs at least 2 options');
  if (!answer) errors.push('answer is empty');
  else if (!options.some((o) => o.toLowerCase() === answer.toLowerCase())) {
    errors.push(`answer "${answer}" doesn't match any option`);
  }

  return { row: rowIndex + 1, question, options, answer, valid: errors.length === 0, errors };
}

// Parses a File (CSV or JSON) into normalized { question, options, answer } rows,
// each flagged valid/invalid with a reason so the upload UI can show per-row feedback.
export async function parseQuestionsFile(file) {
  const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
  const text = await file.text();

  if (isJson) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON file: ${e.message}`, { cause: e });
    }
    if (!Array.isArray(data)) throw new Error('JSON must be an array of questions.');
    return data.map((row, i) => normalizeQuestion(row, i));
  }

  const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }
  return parsed.data.map((row, i) => normalizeQuestion(row, i));
}

export function questionsToCsv(questions) {
  return Papa.unparse(
    questions.map((q) => ({ question: q.question, options: q.options.join('|'), answer: q.answer }))
  );
}

export function submissionsToCsv(submissions) {
  return Papa.unparse(submissions);
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename, csvContent) {
  downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');
}

export function downloadJson(filename, data) {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8;');
}

export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

// ---------- test access restriction (allowed name + student id pairs) ----------

export const ALLOWED_USERS_CSV_TEMPLATE = `name,studentId
"Jane Doe","stu2024001"
`;

export function normalizeAllowedUser(raw, rowIndex) {
  const errors = [];
  const name = String(raw.name ?? '').trim();
  const studentId = String(raw.studentId ?? '').trim();

  if (!name) errors.push('name is empty');
  if (!studentId) errors.push('studentId is empty');

  return { row: rowIndex + 1, name, studentId, valid: errors.length === 0, errors };
}

export async function parseAllowedUsersFile(file) {
  const text = await file.text();
  const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }
  return parsed.data.map((row, i) => normalizeAllowedUser(row, i));
}

export function allowedUsersToCsv(allowedUsers) {
  return Papa.unparse((allowedUsers ?? []).map((u) => ({ name: u.name, studentId: u.studentId })));
}
