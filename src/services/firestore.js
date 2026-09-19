import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../utility/config';

// ---------- tests ----------

function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'test';
}

function randomSuffix(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function answerKeyDoc(testId) {
  return doc(db, 'tests', testId, 'answerKey', 'data');
}

// The public test doc never carries an `answer` field - only the owner-only
// answerKey subdoc does (see firestore.rules). This is the split point: any
// write of `questions` here always writes both docs together, in the same
// batch, so they can never drift out of index-alignment.
function splitQuestions(questions) {
  return {
    publicQuestions: questions.map(({ question, options }) => ({ question, options })),
    answers: questions.map((q) => q.answer),
  };
}

export async function getTest(testId) {
  if (!testId) return null;
  const snap = await getDoc(doc(db, 'tests', testId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Owner-only: re-merges the private answerKey back into `questions` so
// TestDetail/QuestionsEditor can display and edit the full
// { question, options, answer } shape they already work with.
export async function getTestAnswerKey(testId) {
  const snap = await getDoc(answerKeyDoc(testId));
  return snap.exists() ? snap.data().answers ?? [] : [];
}

export async function listTests(ownerEmail) {
  const snap = await getDocs(
    query(collection(db, 'tests'), where('createdBy', '==', ownerEmail), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createTest({ adminEnteredId, displayName, minutes, questions, allowedUsers, restrictAccess, strictMode, createdBy }) {
  // Collision-checked id: admin-entered id + random suffix, retried on the
  // (astronomically unlikely) chance of a collision.
  let testId;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${slugify(adminEnteredId)}-${randomSuffix()}`;
    const existing = await getDoc(doc(db, 'tests', candidate));
    if (!existing.exists()) {
      testId = candidate;
      break;
    }
  }
  if (!testId) throw new Error('Could not allocate a unique test id, please try again.');

  const { publicQuestions, answers } = splitQuestions(questions);

  const batch = writeBatch(db);
  batch.set(doc(db, 'tests', testId), {
    adminEnteredId,
    displayName,
    minutes,
    questions: publicQuestions,
    // Saved list of name + student id pairs; only enforced when restrictAccess
    // is true (checked in StartTest.jsx). Kept even when restriction is off so
    // an admin can re-enable it later without re-uploading.
    allowedUsers: allowedUsers ?? [],
    restrictAccess: Boolean(restrictAccess),
    // Strict mode: no exit button, forces fullscreen, auto-submits if the
    // student navigates away or leaves fullscreen (enforced in TestInterface.jsx).
    strictMode: Boolean(strictMode),
    active: true,
    createdAt: serverTimestamp(),
    createdBy,
    updatedAt: serverTimestamp(),
    updatedBy: createdBy,
    submissionCount: 0,
    lastSubmissionAt: null,
  });
  // createdBy here is checked directly by firestore.rules' answerKey create
  // rule (not via isTestOwner's get() on the parent doc, which can't see
  // this same batch's sibling write yet - see the rule's comment).
  batch.set(answerKeyDoc(testId), { answers, createdBy });
  await batch.commit();

  return testId;
}

export async function updateTest(testId, { displayName, minutes, questions, allowedUsers, restrictAccess, strictMode, active, updatedBy }) {
  const patch = { updatedAt: serverTimestamp(), updatedBy };
  if (displayName !== undefined) patch.displayName = displayName;
  if (minutes !== undefined) patch.minutes = minutes;
  if (allowedUsers !== undefined) patch.allowedUsers = allowedUsers;
  if (restrictAccess !== undefined) patch.restrictAccess = restrictAccess;
  if (strictMode !== undefined) patch.strictMode = strictMode;
  if (active !== undefined) patch.active = active;

  if (questions !== undefined) {
    const { publicQuestions, answers } = splitQuestions(questions);
    patch.questions = publicQuestions;
    const batch = writeBatch(db);
    batch.update(doc(db, 'tests', testId), patch);
    batch.set(answerKeyDoc(testId), { answers });
    await batch.commit();
    return;
  }

  await updateDoc(doc(db, 'tests', testId), patch);
}

export async function deleteTest(testId) {
  await deleteDoc(doc(db, 'tests', testId));
}

// ---------- users ----------

export async function upsertUser(email, data) {
  await setDoc(doc(db, 'users', email), { email, ...data, lastSignInAt: serverTimestamp() }, { merge: true });
}

export async function getUser(email) {
  const snap = await getDoc(doc(db, 'users', email));
  return snap.exists() ? snap.data() : null;
}

export async function hasUserTakenTest(email, testId) {
  const user = await getUser(email);
  return Boolean(user?.testsTaken?.[testId]);
}

// ---------- submissions: tests/{testId}/submissions/{normalizedStudentId} ----------

function submissionsCol(testId) {
  return collection(db, 'tests', testId, 'submissions');
}

export async function getSubmission(testId, attemptId) {
  const snap = await getDoc(doc(db, 'tests', testId, 'submissions', attemptId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Starting an attempt (roster check + dedupe against an existing completed
// attempt + the write itself) all happen inside the startTest Cloud
// Function now - firestore.rules makes submissions writes function-only, so
// this is the only way to create one. Returns the attempt id (the
// normalized Student ID) to carry in the ?sid= param from here on.
const startTestCallable = httpsCallable(functions, 'startTest');

export async function startTestAttempt(testId, name, studentId) {
  const { data } = await startTestCallable({ testId, name, studentId });
  return data.attemptId;
}

// Grading happens server-side (functions/index.js) so the answer key never
// reaches a test-taker's browser - this just hands off the student's raw
// picks and gets a score back.
const submitTestCallable = httpsCallable(functions, 'submitTest');

export async function submitTestAttempt({ testId, attemptId, answers }) {
  const { data } = await submitTestCallable({ testId, attemptId, answers });
  return data; // { score, total }
}

export async function listSubmissionsForTest(testId, ownerEmail) {
  const snap = await getDocs(query(submissionsCol(testId), where('testOwnerEmail', '==', ownerEmail)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Deleting a submission touches another user's users/{email}.testsTaken flag
// and the test's submissionCount - cross-document writes a client can't be
// trusted to make correctly, so this goes through a Cloud Function too.
const deleteSubmissionCallable = httpsCallable(functions, 'deleteSubmission');

export async function deleteSubmission(testId, attemptId) {
  await deleteSubmissionCallable({ testId, attemptId });
}

// ---------- dashboard recents ----------

export async function listRecentSubmissions(ownerEmail, max = 20) {
  const snap = await getDocs(
    query(
      collectionGroup(db, 'submissions'),
      where('testOwnerEmail', '==', ownerEmail),
      where('testTaken', '==', true),
      orderBy('submittedAt', 'desc'),
      limit(max)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, testId: d.ref.parent.parent.id, ...d.data() }));
}

export async function listRecentlyCreatedTests(ownerEmail, max = 20) {
  const snap = await getDocs(
    query(collection(db, 'tests'), where('createdBy', '==', ownerEmail), orderBy('createdAt', 'desc'), limit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listRecentlyEditedTests(ownerEmail, max = 20) {
  const snap = await getDocs(
    query(collection(db, 'tests'), where('createdBy', '==', ownerEmail), orderBy('updatedAt', 'desc'), limit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
