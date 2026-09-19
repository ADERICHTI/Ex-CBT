import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const app = initializeApp();
// Same named database the client SDK points at (see src/utility/config.js) -
// the default "(default)" database is a different, unrelated instance.
const db = getFirestore(app, 'ex-cbt');

function normalize(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

// Same scheme as normalizeStudentId in src/services/firestore.js - keeping
// the submission doc id derived from the student id (not id+timestamp)
// makes "does this student already have an attempt" a plain get().
function normalizeStudentId(studentId) {
  return normalize(studentId).replace(/\s+/g, '-');
}

// Single source of truth for roster eligibility - StartTest.jsx still runs
// isUserAllowed() (src/services/csv.js) first for instant feedback, but this
// is the enforced copy; the two must stay logically equivalent.
function isRosterAllowed(allowedUsers, restrictAccess, name, studentId) {
  const restricted = restrictAccess ?? Boolean(allowedUsers?.length);
  if (!restricted) return true;
  const n = normalize(name);
  const s = normalize(studentId);
  return (allowedUsers ?? []).some((u) => normalize(u.name) === n && normalize(u.studentId) === s);
}

// Only place the answer key and a student's picks ever meet - everything
// downstream of this function only ever sees the resulting score, never the
// key itself. Mirrors the case-insensitive exact-match grading that used to
// run client-side in TestInterface.jsx's gradeAndBuildAnswers.
function gradeAnswers(studentAnswers, correctAnswers) {
  return correctAnswers.reduce((total, correct, i) => {
    const picked = normalize(studentAnswers[i]);
    return picked && picked === normalize(correct) ? total + 1 : total;
  }, 0);
}

// Replaces the old direct client write for starting an attempt - the only
// code path that may create a tests/{testId}/submissions/{id} doc now (see
// firestore.rules: submissions writes are `if false`, functions-only).
// Folds in what used to be three separate steps: the roster check
// (StartTest.jsx's isUserAllowed, now also enforced here), the dedupe check
// (findActiveSubmission), and the write itself.
export const startTest = onCall(async (request) => {
  const email = request.auth?.token?.email;
  if (!email) throw new HttpsError('unauthenticated', 'Sign in required.');

  const { testId, name, studentId } = request.data ?? {};
  if (!testId || !name?.trim() || !studentId?.trim()) {
    throw new HttpsError('invalid-argument', 'testId, name and studentId are required.');
  }

  const testSnap = await db.doc(`tests/${testId}`).get();
  if (!testSnap.exists || testSnap.data().active === false) {
    throw new HttpsError('not-found', 'This test is not available.');
  }
  const test = testSnap.data();

  if (!isRosterAllowed(test.allowedUsers, test.restrictAccess, name, studentId)) {
    throw new HttpsError('permission-denied', "You're not on the approved list for this test.");
  }

  const attemptId = normalizeStudentId(studentId);
  const submissionRef = db.doc(`tests/${testId}/submissions/${attemptId}`);
  const existing = await submissionRef.get();
  if (existing.exists && existing.data().testTaken) {
    throw new HttpsError('already-exists', 'A submission already exists for this Student ID.');
  }

  await submissionRef.set({
    testId,
    testOwnerEmail: test.createdBy,
    studentId: studentId.trim(),
    name: name.trim(),
    userEmail: email,
    startedAt: FieldValue.serverTimestamp(),
    testTaken: false,
    submittedAt: null,
    answers: null,
    score: null,
  });

  return { attemptId };
});

export const submitTest = onCall(async (request) => {
  const email = request.auth?.token?.email;
  if (!email) throw new HttpsError('unauthenticated', 'Sign in required.');

  const { testId, attemptId, answers } = request.data ?? {};
  if (!testId || !attemptId || !Array.isArray(answers)) {
    throw new HttpsError('invalid-argument', 'testId, attemptId and answers are required.');
  }

  const submissionRef = db.doc(`tests/${testId}/submissions/${attemptId}`);
  const answerKeyRef = db.doc(`tests/${testId}/answerKey/data`);

  const [submissionSnap, answerKeySnap] = await Promise.all([submissionRef.get(), answerKeyRef.get()]);

  if (!submissionSnap.exists) throw new HttpsError('not-found', 'No such attempt.');
  const submission = submissionSnap.data();
  if (submission.userEmail !== email) throw new HttpsError('permission-denied', 'Not your attempt.');
  if (submission.testTaken) throw new HttpsError('failed-precondition', 'Already submitted.');

  const correctAnswers = answerKeySnap.exists ? answerKeySnap.data().answers ?? [] : [];
  const score = gradeAnswers(answers, correctAnswers);

  const batch = db.batch();
  batch.update(submissionRef, {
    testTaken: true,
    submittedAt: FieldValue.serverTimestamp(),
    answers,
    score,
  });
  batch.update(db.doc(`tests/${testId}`), {
    submissionCount: FieldValue.increment(1),
    lastSubmissionAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`users/${email}`), { testsTaken: { [testId]: true } }, { merge: true });
  await batch.commit();

  return { score, total: correctAnswers.length };
});

export const deleteSubmission = onCall(async (request) => {
  const email = request.auth?.token?.email;
  if (!email) throw new HttpsError('unauthenticated', 'Sign in required.');

  const { testId, attemptId } = request.data ?? {};
  if (!testId || !attemptId) {
    throw new HttpsError('invalid-argument', 'testId and attemptId are required.');
  }

  const testRef = db.doc(`tests/${testId}`);
  const testSnap = await testRef.get();
  if (!testSnap.exists || testSnap.data().createdBy !== email) {
    throw new HttpsError('permission-denied', 'Only the test owner can delete submissions.');
  }

  const submissionRef = db.doc(`tests/${testId}/submissions/${attemptId}`);
  const submissionSnap = await submissionRef.get();
  if (!submissionSnap.exists) return { deleted: false };
  const submission = submissionSnap.data();

  const batch = db.batch();
  batch.delete(submissionRef);
  if (submission.testTaken === true) {
    batch.update(testRef, { submissionCount: FieldValue.increment(-1) });
    if (submission.userEmail) {
      batch.set(db.doc(`users/${submission.userEmail}`), { testsTaken: { [testId]: false } }, { merge: true });
    }
  }
  await batch.commit();

  return { deleted: true };
});
