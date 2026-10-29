import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../lib/firebase.js'

// ── Data model ────────────────────────────────────────────────
// tests/{testId}                  public test: title, time, questions
//   { displayName, minutes, status: 'draft'|'open'|'closed', strictMode,
//     restrictAccess, questions: [{ id, question, options[] }],
//     createdBy, createdAt, updatedAt, updatedBy, submissionCount }
// tests/{testId}/answerKey/data   owner-only: { answers[] } (option text,
//                                 index-aligned with questions)
// tests/{testId}/roster/data      owner-only: { allowedUsers[{ name, studentId }] }
// tests/{testId}/submissions/{id} one per candidate (written by functions)
// users/{email}                   profile + testsTaken (functions only)
// users/{email}/testMeta/{testId} this person's star/folder for a test
// users/{email}/folders/{id}      this person's folders

export const STATUS_LABELS = { draft: 'Draft', open: 'Open', closed: 'Closed' }

export function newQuestionId() {
  return Math.random().toString(36).slice(2, 10)
}

function slugify(input) {
  return (
    String(input)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'test'
  )
}

function randomSuffix(length = 6) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

const testRef = (testId) => doc(db, 'tests', testId)
const answerKeyRef = (testId) => doc(db, 'tests', testId, 'answerKey', 'data')
const rosterRef = (testId) => doc(db, 'tests', testId, 'roster', 'data')

// Editor questions ({ id, question, options[], correct: index|null }) split
// into what candidates may read and the owner-only answer key.
export function splitQuestions(questions) {
  return {
    publicQuestions: questions.map(({ id, question, options }) => ({ id, question, options })),
    answers: questions.map((q) => (q.correct != null ? (q.options[q.correct] ?? '') : '')),
  }
}

// The reverse: public questions + answer key → editor questions.
export function joinQuestions(questions = [], answers = []) {
  return questions.map((q, i) => {
    const answer = String(answers[i] ?? '').trim().toLowerCase()
    const correct = answer ? q.options.findIndex((o) => o.trim().toLowerCase() === answer) : -1
    return { id: q.id || newQuestionId(), question: q.question, options: [...q.options], correct: correct >= 0 ? correct : null }
  })
}

// Problems that stop a test from opening, in plain words ([] = ready).
export function testProblems(draft) {
  const problems = []
  if (!draft.questions.length) problems.push('Add at least one question.')
  draft.questions.forEach((q, i) => {
    const n = i + 1
    const options = q.options.filter((o) => o.trim())
    if (!q.question.trim()) problems.push(`Question ${n} has no text.`)
    if (options.length < 2) problems.push(`Question ${n} needs at least 2 answer options.`)
    if (q.correct == null || !q.options[q.correct]?.trim()) problems.push(`Question ${n} has no correct answer marked.`)
  })
  if (!(Number(draft.minutes) > 0)) problems.push('Set a time limit of at least 1 minute.')
  return problems
}

// ── Tests ─────────────────────────────────────────────────────

export async function getTest(testId) {
  if (!testId) return null
  const snap = await getDoc(testRef(testId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Live list of the tests this person owns, newest edit first.
export function watchMyTests(email, onChange, onError) {
  const q = query(collection(db, 'tests'), where('createdBy', '==', email), orderBy('updatedAt', 'desc'))
  return onSnapshot(
    q,
    (snap) =>
      onChange(
        snap.docs.map((d) => {
          // 'estimate': a just-written serverTimestamp shows local time, not null.
          const data = d.data({ serverTimestamps: 'estimate' })
          return { id: d.id, ...data, updatedAt: data.updatedAt?.toDate() ?? null }
        }),
      ),
    onError,
  )
}

export function watchTest(testId, onChange, onError) {
  return onSnapshot(
    testRef(testId),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) } : null),
    onError,
  )
}

export async function getAnswerKey(testId) {
  const snap = await getDoc(answerKeyRef(testId))
  return snap.exists() ? (snap.data().answers ?? []) : []
}

export async function getRoster(testId) {
  const snap = await getDoc(rosterRef(testId))
  return snap.exists() ? (snap.data().allowedUsers ?? []) : []
}

// A new draft test (with its answer key and an empty roster), from editor
// questions. Returns its id: a readable slug of the title + a random suffix.
export async function createTest(email, { displayName = '', minutes = 15, questions = [], strictMode = false } = {}) {
  const testId = `${slugify(displayName || 'untitled-test')}-${randomSuffix()}`
  const { publicQuestions, answers } = splitQuestions(questions)
  const batch = writeBatch(db)
  batch.set(testRef(testId), {
    displayName,
    minutes,
    questions: publicQuestions,
    status: 'draft',
    strictMode,
    restrictAccess: false,
    createdBy: email,
    createdAt: serverTimestamp(),
    updatedBy: email,
    updatedAt: serverTimestamp(),
    submissionCount: 0,
    lastSubmissionAt: null,
  })
  // createdBy on the subdocs lets the rules check ownership in this same batch.
  batch.set(answerKeyRef(testId), { answers, createdBy: email })
  batch.set(rosterRef(testId), { allowedUsers: [], createdBy: email })
  await batch.commit()
  return testId
}

// Saves the editor's draft: test fields, and the answer key with them so
// the two never drift out of line.
export async function saveTestDraft(testId, email, { displayName, minutes, questions }) {
  const { publicQuestions, answers } = splitQuestions(questions)
  const batch = writeBatch(db)
  batch.update(testRef(testId), {
    displayName,
    minutes: Number(minutes) || 0,
    questions: publicQuestions,
    updatedBy: email,
    updatedAt: serverTimestamp(),
  })
  batch.set(answerKeyRef(testId), { answers, createdBy: email })
  await batch.commit()
}

// One-off settings (status, strict mode, access): saved straight away.
export function updateTestFields(testId, email, fields) {
  return updateDoc(testRef(testId), { ...fields, updatedBy: email, updatedAt: serverTimestamp() })
}

export async function saveRoster(testId, email, allowedUsers) {
  const batch = writeBatch(db)
  batch.set(rosterRef(testId), { allowedUsers, createdBy: email })
  batch.update(testRef(testId), { updatedBy: email, updatedAt: serverTimestamp() })
  await batch.commit()
}

// Deleting a test also removes its answer key, list and every submission -
// writes a client can't make (submissions are functions-only), so it's a
// Cloud Function.
const deleteTestCallable = httpsCallable(functions, 'deleteTest')
export async function deleteTest(testId) {
  await deleteTestCallable({ testId })
}

// ── People ────────────────────────────────────────────────────

export async function upsertUser(email, data) {
  await setDoc(doc(db, 'users', email), { email, ...data, lastSignInAt: serverTimestamp() }, { merge: true })
}

export async function hasUserTakenTest(email, testId) {
  const snap = await getDoc(doc(db, 'users', email))
  return Boolean(snap.exists() && snap.data().testsTaken?.[testId])
}

// ── Submissions: tests/{testId}/submissions/{normalized Student ID} ──

export async function getSubmission(testId, attemptId) {
  const snap = await getDoc(doc(db, 'tests', testId, 'submissions', attemptId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export function watchSubmissions(testId, ownerEmail, onChange, onError) {
  const q = query(collection(db, 'tests', testId, 'submissions'), where('testOwnerEmail', '==', ownerEmail))
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

// Starting an attempt (roster check + dedupe + the write) happens inside the
// startTest Cloud Function. Returns the attempt id (the normalized Student ID).
const startTestCallable = httpsCallable(functions, 'startTest')
export async function startTestAttempt(testId, name, studentId) {
  const { data } = await startTestCallable({ testId, name, studentId })
  return data.attemptId
}

// Grading happens server-side so the answer key never reaches a candidate.
const submitTestCallable = httpsCallable(functions, 'submitTest')
export async function submitTestAttempt({ testId, attemptId, answers }) {
  const { data } = await submitTestCallable({ testId, attemptId, answers })
  return data // { score, total }
}

const deleteSubmissionCallable = httpsCallable(functions, 'deleteSubmission')
export async function deleteSubmission(testId, attemptId) {
  await deleteSubmissionCallable({ testId, attemptId })
}
