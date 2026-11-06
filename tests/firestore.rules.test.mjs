// Security-rules tests for HyperCBT's database (firestore.rules), run against
// the Firestore emulator:  npm run test:rules
// (or, with an emulator already running: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/firestore.rules.test.mjs)
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':')
const env = await initializeTestEnvironment({
  projectId: 'demo-hypercbt',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host, port: Number(port) },
})

const OWNER = 'owner@example.com'
const STUDENT = 'student@example.com'
// Makers sign in verified; the candidate deliberately isn't (candidates
// don't need a verified email). `unverified` is a maker who never clicked
// the verification link.
const as = (email, verified = true) => env.authenticatedContext(email, { email, email_verified: verified }).firestore()
const owner = as(OWNER)
const student = as(STUDENT, false)
const unverified = as('unverified@example.com', false)
const unverifiedOwner = as(OWNER, false)
const anon = env.unauthenticatedContext().firestore()
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()))

let passed = 0
let failed = 0
async function check(name, promise) {
  try {
    await promise
    passed++
    console.log('ok  ', name)
  } catch (err) {
    failed++
    console.log('FAIL', name, '-', String(err.message).slice(0, 120))
  }
}

// ── Creating a test (dashboard: blank / import) ──
const create = writeBatch(owner)
create.set(doc(owner, 'tests/t1'), { createdBy: OWNER, displayName: 'T', questions: [], status: 'draft', restrictAccess: false })
create.set(doc(owner, 'tests/t1/answerKey/data'), { answers: [], createdBy: OWNER })
create.set(doc(owner, 'tests/t1/roster/data'), { allowedUsers: [], createdBy: OWNER })
await check('owner creates test + answer key + list in one batch', assertSucceeds(create.commit()))
await check('a new test must be a draft', assertFails(setDoc(doc(owner, 'tests/t2'), { createdBy: OWNER, status: 'open' })))
await check('no approved list on the public test doc', assertFails(setDoc(doc(owner, 'tests/t2'), { createdBy: OWNER, status: 'draft', allowedUsers: [] })))
await check('can’t create a test in someone else’s name', assertFails(setDoc(doc(student, 'tests/t2'), { createdBy: OWNER, status: 'draft' })))

// ── Verified email for makers ──
await check('unverified account can’t create a test', assertFails(setDoc(doc(unverified, 'tests/u1'), { createdBy: 'unverified@example.com', status: 'draft' })))
await check('unverified account can’t list its tests', assertFails(getDocs(query(collection(unverified, 'tests'), where('createdBy', '==', 'unverified@example.com')))))
await check('owner signed in unverified can’t read the answer key', assertFails(getDoc(doc(unverifiedOwner, 'tests/t1/answerKey/data'))))
await check('owner signed in unverified can’t edit the test', assertFails(updateDoc(doc(unverifiedOwner, 'tests/t1'), { displayName: 'x' })))
await check('verified owner lists own tests', assertSucceeds(getDocs(query(collection(owner, 'tests'), where('createdBy', '==', OWNER)))))

// ── Reading ──
await check('signed-in candidate can read the test', assertSucceeds(getDoc(doc(student, 'tests/t1'))))
await check('signed-out visitor can’t read the test', assertFails(getDoc(doc(anon, 'tests/t1'))))
await check('candidate can’t read the answer key', assertFails(getDoc(doc(student, 'tests/t1/answerKey/data'))))
await check('candidate can’t read the approved list', assertFails(getDoc(doc(student, 'tests/t1/roster/data'))))
await check('owner reads answer key', assertSucceeds(getDoc(doc(owner, 'tests/t1/answerKey/data'))))
await check('owner reads approved list', assertSucceeds(getDoc(doc(owner, 'tests/t1/roster/data'))))

// ── Editing (autosave batch, settings, publish) ──
const save = writeBatch(owner)
save.update(doc(owner, 'tests/t1'), { displayName: 'T2', questions: [{ id: 'a', question: 'Q', options: ['x', 'y'] }] })
save.set(doc(owner, 'tests/t1/answerKey/data'), { answers: ['x'], createdBy: OWNER })
await check('owner autosave batch', assertSucceeds(save.commit()))
await check('owner publishes', assertSucceeds(updateDoc(doc(owner, 'tests/t1'), { status: 'open' })))
await check('owner saves the approved list', assertSucceeds(setDoc(doc(owner, 'tests/t1/roster/data'), { allowedUsers: [{ name: 'A', studentId: '1' }], createdBy: OWNER })))
await check('owner can’t hand the test to someone else', assertFails(updateDoc(doc(owner, 'tests/t1'), { createdBy: STUDENT })))
await check('owner can’t put the list back on the public doc', assertFails(updateDoc(doc(owner, 'tests/t1'), { allowedUsers: [] })))
await check('candidate can’t edit the test', assertFails(updateDoc(doc(student, 'tests/t1'), { status: 'closed' })))

// ── Planting answer keys / lists on someone else's test ──
await seed((db) => setDoc(doc(db, 'tests/t3'), { createdBy: OWNER, status: 'draft' }))
await check('candidate can’t plant an answer key', assertFails(setDoc(doc(student, 'tests/t3/answerKey/data'), { answers: [], createdBy: STUDENT })))
await check('candidate can’t plant an approved list', assertFails(setDoc(doc(student, 'tests/t3/roster/data'), { allowedUsers: [], createdBy: STUDENT })))
await check('no answer key for a test that doesn’t exist', assertFails(setDoc(doc(student, 'tests/none/answerKey/data'), { answers: [], createdBy: STUDENT })))

// ── Submissions (functions only) ──
await seed((db) => setDoc(doc(db, 'tests/t1/submissions/1'), { userEmail: STUDENT, testOwnerEmail: OWNER, testTaken: true }))
await check('candidate can’t write a submission', assertFails(setDoc(doc(student, 'tests/t1/submissions/2'), { userEmail: STUDENT })))
await check('candidate reads own submission', assertSucceeds(getDoc(doc(student, 'tests/t1/submissions/1'))))
await check('owner reads submissions', assertSucceeds(getDoc(doc(owner, 'tests/t1/submissions/1'))))
await check('owner signed in unverified can’t read submissions', assertFails(getDoc(doc(unverifiedOwner, 'tests/t1/submissions/1'))))
await check('others can’t read a submission', assertFails(getDoc(doc(as('other@example.com'), 'tests/t1/submissions/1'))))
await check('owner can’t delete a submission directly', assertFails(deleteDoc(doc(owner, 'tests/t1/submissions/1'))))

// ── People, stars and folders ──
await check('user creates own profile', assertSucceeds(setDoc(doc(student, `users/${STUDENT}`), { email: STUDENT }, { merge: true })))
await seed((db) => setDoc(doc(db, `users/${STUDENT}`), { testsTaken: { t1: true } }, { merge: true }))
await check('user can’t clear their “taken” flag', assertFails(setDoc(doc(student, `users/${STUDENT}`), { testsTaken: { t1: false } }, { merge: true })))
await check('user can still update their profile', assertSucceeds(setDoc(doc(student, `users/${STUDENT}`), { displayName: 'S' }, { merge: true })))
await check('can’t read someone else’s profile', assertFails(getDoc(doc(student, `users/${OWNER}`))))
await check('own star', assertSucceeds(setDoc(doc(owner, `users/${OWNER}/testMeta/t1`), { starred: true })))
await check('own folder', assertSucceeds(setDoc(doc(owner, `users/${OWNER}/folders/f1`), { name: 'Maths' })))
await check('can’t read someone else’s stars', assertFails(getDoc(doc(student, `users/${OWNER}/testMeta/t1`))))
await check('unverified account can’t keep stars', assertFails(setDoc(doc(unverified, 'users/unverified@example.com/testMeta/x'), { starred: true })))
await check('unverified candidate can still update their profile', assertSucceeds(setDoc(doc(unverified, 'users/unverified@example.com'), { email: 'unverified@example.com' }, { merge: true })))
await check('can’t write someone else’s folders', assertFails(setDoc(doc(student, `users/${OWNER}/folders/f2`), { name: 'x' })))

await check('own recent templates', assertSucceeds(setDoc(doc(owner, `users/${OWNER}/settings/templates`), { recentKeys: ['quick-quiz'] })))
await check('can’t read someone else’s recent templates', assertFails(getDoc(doc(student, `users/${OWNER}/settings/templates`))))

// ── Editors (Share window): uids in editorIds, written by functions only ──
const editorCtx = env.authenticatedContext('editor-uid', { email: 'editor@example.com', email_verified: true }).firestore()
const outsider = as('outsider@example.com')
await seed(async (db) => {
  await setDoc(doc(db, 'tests/s1'), { createdBy: OWNER, status: 'draft', editorIds: ['editor-uid'], questions: [] })
  await setDoc(doc(db, 'tests/s1/answerKey/data'), { answers: [], createdBy: OWNER })
  await setDoc(doc(db, 'tests/s1/roster/data'), { allowedUsers: [], createdBy: OWNER })
  await setDoc(doc(db, 'tests/s1/submissions/a1'), { testOwnerEmail: OWNER, userEmail: STUDENT, testTaken: true })
  await setDoc(doc(db, 'tests/s1/sharing/data'), { invitedEmails: ['new@example.com'] })
})
await check('editor lists tests shared with them', assertSucceeds(getDocs(query(collection(editorCtx, 'tests'), where('editorIds', 'array-contains', 'editor-uid')))))
await check('outsider can’t list someone’s shared tests', assertFails(getDocs(query(collection(outsider, 'tests'), where('editorIds', 'array-contains', 'editor-uid')))))
await check('editor edits the test', assertSucceeds(updateDoc(doc(editorCtx, 'tests/s1'), { displayName: 'Shared' })))
await check('editor reads and saves the answer key', assertSucceeds(setDoc(doc(editorCtx, 'tests/s1/answerKey/data'), { answers: ['x'], createdBy: OWNER })))
await check('editor reads the approved list', assertSucceeds(getDoc(doc(editorCtx, 'tests/s1/roster/data'))))
await check('editor reads all results', assertSucceeds(getDocs(collection(editorCtx, 'tests/s1/submissions'))))
await check('outsider can’t read all results', assertFails(getDocs(collection(outsider, 'tests/s1/submissions'))))
await check('outsider can’t read the answer key', assertFails(getDoc(doc(outsider, 'tests/s1/answerKey/data'))))
await check('editor can’t add editors directly', assertFails(updateDoc(doc(editorCtx, 'tests/s1'), { editorIds: ['editor-uid', 'x'] })))
await check('owner can’t change editors directly either', assertFails(updateDoc(doc(owner, 'tests/s1'), { editorIds: [] })))
await check('outsider can’t make themselves an editor', assertFails(updateDoc(doc(outsider, 'tests/s1'), { editorIds: ['outsider@example.com'] })))
await check('editor can’t delete the test', assertFails(deleteDoc(doc(editorCtx, 'tests/s1'))))
await check('nobody reads pending invites from the app', assertFails(getDoc(doc(owner, 'tests/s1/sharing/data'))))
await check('nobody reads invites/', assertFails(getDoc(doc(owner, 'invites/new@example.com'))))

await check('owner deletes the test doc', assertSucceeds(deleteDoc(doc(owner, 'tests/t1'))))

console.log(`\n${passed} passed, ${failed} failed`)
await env.cleanup()
process.exit(failed ? 1 : 0)
