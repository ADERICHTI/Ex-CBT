import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineBoolean } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall as onCallBase, HttpsError } from 'firebase-functions/v2/https';

const app = initializeApp();
// HyperCBT's named database in the Quality Tools project (quality-toolsx) -
// the same one the client points at (src/lib/firebase.js). The project's
// other databases belong to the other Quality Tools apps.
const db = getFirestore(app, 'hypercbt');

// Same region as the database and PeraForm's functions.
setGlobalOptions({ region: 'europe-west1' });

// App Check is enforced project-wide on quality-toolsx. Set
// ENFORCE_APP_CHECK=true in functions/.env once the site's reCAPTCHA key is
// in place; the emulators never need it.
const ENFORCE_APP_CHECK = defineBoolean('ENFORCE_APP_CHECK', { default: false });
const EMULATED = process.env.FUNCTIONS_EMULATOR === 'true';
function requireApp(request) {
  if (ENFORCE_APP_CHECK.value() && !EMULATED && !request.app) {
    throw new HttpsError('failed-precondition', 'This request didn’t come from HyperCBT.');
  }
}

// Test makers need a verified email (same rule as firestore.rules →
// isMaker): ownership is by email. Candidates don't.
function requireVerifiedMaker(request) {
  if (request.auth?.token?.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Verify your email to manage tests.');
  }
}

import { APP_URL, SMTP_PASS, emailHtml, sendMail } from './mail.js';

// Every callable starts with the App Check check.
function onCall(handler, options = {}) {
  return onCallBase(options, (request) => {
    requireApp(request);
    return handler(request);
  });
}

function normalize(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

// The attempt (submission doc) id is derived from the Student ID (not
// id+timestamp), which
// makes "does this student already have an attempt" a plain get().
function normalizeStudentId(studentId) {
  return normalize(studentId).replace(/\s+/g, '-');
}

// The only roster check - the roster lives in the owner-only
// tests/{testId}/roster/data doc, which test-takers can't read, so there's
// no client-side copy of this any more. Trimmed, case-insensitive match on
// both name and Student ID. Older tests never wrote restrictAccess, so a
// non-empty list means "restricted" for them.
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
// (now enforced only here), the dedupe check
// (findActiveSubmission), and the write itself.
export const startTest = onCall(async (request) => {
  const email = request.auth?.token?.email;
  if (!email) throw new HttpsError('unauthenticated', 'Sign in required.');

  const { testId, name, studentId } = request.data ?? {};
  if (!testId || !name?.trim() || !studentId?.trim()) {
    throw new HttpsError('invalid-argument', 'testId, name and studentId are required.');
  }

  const testSnap = await db.doc(`tests/${testId}`).get();
  if (!testSnap.exists || testSnap.data().status !== 'open' || !testSnap.data().questions?.length) {
    throw new HttpsError('not-found', 'This test is not available.');
  }
  const test = testSnap.data();

  const rosterSnap = await db.doc(`tests/${testId}/roster/data`).get();
  const allowedUsers = rosterSnap.exists ? rosterSnap.data().allowedUsers : [];

  if (!isRosterAllowed(allowedUsers, test.restrictAccess, name, studentId)) {
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
    // Shown to the teacher as "email not verified" when false: the email is
    // the candidate's sign-in, not proof of who they are.
    emailVerified: request.auth.token.email_verified === true,
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

  requireVerifiedMaker(request);

  const { testId, attemptId } = request.data ?? {};
  if (!testId || !attemptId) {
    throw new HttpsError('invalid-argument', 'testId and attemptId are required.');
  }

  const testRef = db.doc(`tests/${testId}`);
  const testSnap = await testRef.get();
  if (!testSnap.exists || !isEditor(testSnap.data(), request.auth)) {
    throw new HttpsError('permission-denied', 'Only the test’s owner and editors can delete results.');
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

// Deleting a test takes its answer key, approved list and every submission
// with it - submissions can't be deleted from a browser (firestore.rules),
// and Firestore doesn't remove subcollections along with their parent.
export const deleteTest = onCall(async (request) => {
  const email = request.auth?.token?.email;
  if (!email) throw new HttpsError('unauthenticated', 'Sign in required.');

  requireVerifiedMaker(request);

  const { testId } = request.data ?? {};
  if (!testId) throw new HttpsError('invalid-argument', 'testId is required.');

  const testRef = db.doc(`tests/${testId}`);
  const testSnap = await testRef.get();
  if (!testSnap.exists) return { deleted: false };
  if (testSnap.data().createdBy !== email) {
    throw new HttpsError('permission-denied', 'Only the test owner can delete it.');
  }

  await db.recursiveDelete(testRef);
  return { deleted: true };
});

// ── Sharing (as in PeraForm's Share window) ─────────────────
// tests/{id}.editorIds: the editors' uids (uids, not emails: candidates can
// read the test doc). Editors change the test and see results; only the
// owner (createdBy) adds or removes people and deletes the test.
// People without an account yet are invited by email: tests/{id}/sharing/data
// .invitedEmails (the owner's list) and invites/{email}.testIds (claimed by
// acceptInvites once they sign in with that email, verified). Both are
// Admin-only (firestore.rules).
function isEditor(test, auth) {
  return test.createdBy === auth?.token?.email || (test.editorIds ?? []).includes(auth?.uid);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function editableTest(testId, request, { ownerOnly = false } = {}) {
  if (typeof testId !== 'string' || !testId) throw new HttpsError('invalid-argument', 'No test.');
  const ref = db.doc(`tests/${testId}`);
  const test = (await ref.get()).data();
  if (!test || !isEditor(test, request.auth)) throw new HttpsError('not-found', 'Test not found.');
  if (ownerOnly && test.createdBy !== request.auth.token.email) {
    throw new HttpsError('permission-denied', 'Only the test’s owner can change who has access.');
  }
  return { ref, test };
}

// At most `limit` uses of `key` per `windowMs` (counts `n` at once).
async function allow(key, limit, windowMs, n = 1) {
  const ref = db.doc(`rate/${key}`);
  return db.runTransaction(async (tx) => {
    const now = Date.now();
    const d = (await tx.get(ref)).data();
    const fresh = !d || now - d.start > windowMs;
    const count = (fresh ? 0 : d.count) + n;
    if (count > limit) return false;
    tx.set(ref, { start: fresh ? now : d.start, count });
    return true;
  });
}

// action: 'list' | 'add' | 'remove' | 'cancelInvite'
export const manageEditors = onCall(
  async (request) => {
    requireVerifiedMaker(request);
    const { action, testId } = request.data ?? {};

    if (action === 'list') {
      const { ref, test } = await editableTest(testId, request);
      const owner = await getAuth().getUserByEmail(test.createdBy).catch(() => null);
      const ids = test.editorIds ?? [];
      const { users } = ids.length ? await getAuth().getUsers(ids.map((uid) => ({ uid }))) : { users: [] };
      const byUid = new Map(users.map((u) => [u.uid, u]));
      const person = (u, uid, role) => ({
        uid,
        email: u?.email ?? '',
        name: u?.displayName ?? '',
        photo: u?.photoURL ?? '',
        role,
      });
      const sharing = (await ref.collection('sharing').doc('data').get()).data();
      return {
        isOwner: test.createdBy === request.auth.token.email,
        members: [
          person(owner ?? { email: test.createdBy }, owner?.uid ?? '', 'owner'),
          ...ids.map((uid) => person(byUid.get(uid), uid, 'editor')),
        ],
        invites: sharing?.invitedEmails ?? [],
      };
    }

    const { ref, test } = await editableTest(testId, request, { ownerOnly: true });
    const title = test.displayName || 'Untitled test';

    if (action === 'add') {
      const email = normalize(request.data.email);
      if (!EMAIL_RE.test(email)) throw new HttpsError('invalid-argument', 'That doesn’t look like an email address.');
      if (email === test.createdBy) return { status: 'already' };
      if (!(await allow(`share:${request.auth.uid}`, 50, 86_400_000))) {
        throw new HttpsError('resource-exhausted', 'You’ve added a lot of people today. Try again tomorrow.');
      }
      const user = await getAuth().getUserByEmail(email).catch(() => null);
      if (user && (test.editorIds ?? []).includes(user.uid)) return { status: 'already' };
      if (user) {
        await ref.update({ editorIds: FieldValue.arrayUnion(user.uid) });
      } else {
        const batch = db.batch();
        batch.set(ref.collection('sharing').doc('data'), { invitedEmails: FieldValue.arrayUnion(email) }, { merge: true });
        batch.set(db.doc(`invites/${email}`), { testIds: FieldValue.arrayUnion(testId) }, { merge: true });
        await batch.commit();
      }

      const inviter = request.auth.token.name || request.auth.token.email;
      const href = user ? `${APP_URL}/tests/${testId}/questions` : `${APP_URL}/signin`;
      const body = user
        ? `${inviter} added you as an editor of “${title}” on HyperCBT.`
        : `${inviter} invited you to edit “${title}” on HyperCBT. Sign in or create an account with this email address (${email}) to get access.`;
      try {
        await sendMail({
          to: email,
          subject: `${inviter} shared “${title}” with you`,
          text: `${body}\n\n${href}`,
          html: emailHtml({ heading: 'A test was shared with you', body, cta: user ? 'Open the test' : 'Get started', href }),
        });
      } catch (err) {
        logger.error('Invite email failed', { testId, err: err.message });
      }
      return { status: user ? 'added' : 'invited' };
    }

    if (action === 'remove') {
      await ref.update({ editorIds: FieldValue.arrayRemove(String(request.data.uid ?? '')) });
      return { status: 'removed' };
    }

    if (action === 'cancelInvite') {
      const email = normalize(request.data.email);
      const batch = db.batch();
      batch.set(ref.collection('sharing').doc('data'), { invitedEmails: FieldValue.arrayRemove(email) }, { merge: true });
      batch.set(db.doc(`invites/${email}`), { testIds: FieldValue.arrayRemove(testId) }, { merge: true });
      await batch.commit();
      return { status: 'cancelled' };
    }

    throw new HttpsError('invalid-argument', 'Unknown action.');
  },
  { secrets: [SMTP_PASS] },
);

// Called after sign-in: turns invites for this (verified) email into editor
// access. Unverified emails can't claim them, or anyone could sign up with
// someone else's address.
export const acceptInvites = onCall(async (request) => {
  const token = request.auth?.token;
  if (!token?.email || token.email_verified !== true) return { joined: 0 };
  const email = normalize(token.email);
  const inviteRef = db.doc(`invites/${email}`);
  const testIds = (await inviteRef.get()).data()?.testIds ?? [];
  if (!testIds.length) return { joined: 0 };
  let joined = 0;
  const batch = db.batch();
  for (const testId of testIds) {
    const ref = db.doc(`tests/${testId}`);
    if (!(await ref.get()).exists) continue; // deleted since
    batch.update(ref, { editorIds: FieldValue.arrayUnion(request.auth.uid) });
    batch.set(ref.collection('sharing').doc('data'), { invitedEmails: FieldValue.arrayRemove(email) }, { merge: true });
    joined++;
  }
  batch.delete(inviteRef);
  await batch.commit();
  return { joined };
});

// "Email the test link": up to 25 people at a time, 100 a day per person.
export const emailTestLink = onCall(
  async (request) => {
    requireVerifiedMaker(request);
    const { testId, to, subject, message } = request.data ?? {};
    const { test } = await editableTest(testId, request);
    if (test.status !== 'open') {
      throw new HttpsError('failed-precondition', 'Publish the test before emailing its link to candidates.');
    }
    const raw = typeof to === 'string' ? to.split(/[,;\s]+/) : [];
    const emails = [...new Set(raw.map(normalize).filter(Boolean))];
    const bad = emails.filter((e) => !EMAIL_RE.test(e));
    if (bad.length) throw new HttpsError('invalid-argument', `Check this address: ${bad[0]}`);
    if (!emails.length) throw new HttpsError('invalid-argument', 'Add at least one email address.');
    if (emails.length > 25) throw new HttpsError('invalid-argument', 'You can send to at most 25 people at a time.');
    if (!(await allow(`email:${request.auth.uid}`, 100, 86_400_000, emails.length))) {
      throw new HttpsError('resource-exhausted', 'Daily email limit reached (100 a day). Try again tomorrow.');
    }

    const title = test.displayName || 'Untitled test';
    const sender = request.auth.token.name || request.auth.token.email;
    const note = typeof message === 'string' ? message.trim().slice(0, 2000) : '';
    const href = `${APP_URL}/test/${testId}`;
    const count = (test.questions ?? []).length;
    const body = `${note ? `${note}\n\n` : ''}${sender} invited you to take this test on HyperCBT. It has ${count} question${count === 1 ? '' : 's'} and a ${test.minutes ?? 15}-minute time limit.`;
    const footer = `You got this email because ${sender} sent you a HyperCBT test link.`;
    const mail = {
      subject: (typeof subject === 'string' && subject.trim().slice(0, 200)) || `Your test: ${title}`,
      text: `${body}\n\nStart the test: ${href}\n\n---\n${footer}`,
      html: emailHtml({ heading: title, body, cta: 'Start the test', href, footer }),
    };
    let sent = 0;
    for (const recipient of emails) {
      try {
        if (await sendMail({ to: recipient, ...mail })) sent++;
      } catch (err) {
        logger.error('emailTestLink send failed', { testId, err: err.message });
      }
    }
    if (!sent) throw new HttpsError('unavailable', 'The email couldn’t be sent. Try again later, or copy the link instead.');
    return { sent, total: emails.length };
  },
  { secrets: [SMTP_PASS] },
);
