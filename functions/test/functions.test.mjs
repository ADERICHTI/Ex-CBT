// Calls HyperCBT's Cloud Functions directly (no functions emulator needed)
// against the Firestore emulator:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-hypercbt node test/functions.test.mjs
// (from functions/). FUNCTIONS_EMULATOR=true skips the App Check check.
process.env.FUNCTIONS_EMULATOR = 'true'
const { getFirestore } = await import('firebase-admin/firestore')
const fns = await import('../index.js')
const db = getFirestore('hypercbt')

const OWNER = 'owner@example.com'
const STUDENT = 'student@example.com'
const req = (email, data, verified = true) => ({ auth: email ? { uid: email, token: { email, email_verified: verified } } : undefined, data })

let passed = 0
let failed = 0
async function check(name, fn) {
  try {
    await fn()
    passed++
    console.log('ok  ', name)
  } catch (err) {
    failed++
    console.log('FAIL', name, '-', err.message)
  }
}
const expectError = async (promise, code) => {
  try {
    await promise
  } catch (err) {
    if (err.code === code || err.httpErrorCode?.canonicalName?.toLowerCase().replace('_', '-') === code) return
    throw new Error(`expected ${code}, got ${err.code}: ${err.message}`)
  }
  throw new Error(`expected ${code}, but it succeeded`)
}
const equal = (a, b) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
}

const id = `fn-test-${Date.now()}`
const testRef = db.doc(`tests/${id}`)
await testRef.set({
  createdBy: OWNER,
  displayName: 'Functions test',
  status: 'draft',
  restrictAccess: true,
  minutes: 5,
  questions: [
    { id: 'a', question: '2 + 2?', options: ['3', '4'] },
    { id: 'b', question: 'Capital of France?', options: ['Paris', 'Rome'] },
  ],
  submissionCount: 0,
})
await db.doc(`tests/${id}/answerKey/data`).set({ answers: ['4', 'Paris'] })
await db.doc(`tests/${id}/roster/data`).set({ allowedUsers: [{ name: 'Ada Lovelace', studentId: 'S-1' }] })

await check('startTest refuses a draft', () =>
  expectError(fns.startTest.run(req(STUDENT, { testId: id, name: 'Ada Lovelace', studentId: 'S-1' })), 'not-found'),
)
await testRef.update({ status: 'open' })
await check('startTest refuses someone not on the list', () =>
  expectError(fns.startTest.run(req(STUDENT, { testId: id, name: 'Bob', studentId: 'S-9' })), 'permission-denied'),
)
let attemptId
await check('startTest lets a listed candidate in (any capitals/spaces)', async () => {
  const res = await fns.startTest.run(req(STUDENT, { testId: id, name: ' ada LOVELACE ', studentId: 's-1' }))
  attemptId = res.attemptId
  equal(attemptId, 's-1')
})
await check('submitTest grades on the server', async () => {
  const res = await fns.submitTest.run(req(STUDENT, { testId: id, attemptId, answers: ['4', 'Rome'] }))
  equal(res, { score: 1, total: 2 })
})
await check('a second attempt with the same Student ID is refused', () =>
  expectError(fns.startTest.run(req(STUDENT, { testId: id, name: 'Ada Lovelace', studentId: 'S-1' })), 'already-exists'),
)
await check('submission count went up', async () => equal((await testRef.get()).data().submissionCount, 1))
await testRef.update({ status: 'closed' })
await check('startTest refuses a closed test', () =>
  expectError(fns.startTest.run(req('x@example.com', { testId: id, name: 'Ada Lovelace', studentId: 'S-1' })), 'not-found'),
)
await check('startTest records whether the email was verified', async () => {
  const sub = (await db.doc(`tests/${id}/submissions/s-1`).get()).data()
  equal(sub.emailVerified, true)
})
await check('owner signed in unverified can’t delete the test', () =>
  expectError(fns.deleteTest.run(req(OWNER, { testId: id }, false)), 'failed-precondition'),
)
await check('only the owner can delete the test', () =>
  expectError(fns.deleteTest.run(req(STUDENT, { testId: id })), 'permission-denied'),
)
await check('deleteTest removes the test and everything under it', async () => {
  equal(await fns.deleteTest.run(req(OWNER, { testId: id })), { deleted: true })
  const left = await Promise.all(
    [`tests/${id}`, `tests/${id}/answerKey/data`, `tests/${id}/roster/data`, `tests/${id}/submissions/s-1`].map(
      async (p) => (await db.doc(p).get()).exists,
    ),
  )
  equal(left, [false, false, false, false])
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
