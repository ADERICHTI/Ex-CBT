# Ex-CBT — Architecture & Contributor Guide

Ex-CBT is a Google-Forms-shaped computer-based testing app: any signed-in
account can create and own tests, share a link, and see results — all on
Firebase (Auth + Firestore + Cloud Functions), React 19 + Vite on the front
end.

This document maps every piece of behavior to the file and function that
implements it, explains *how* it works, and — for each one — what changing
it will actually affect. If you're new to the codebase, read
[Core Concepts](#core-concepts) first; it explains the two non-obvious design
decisions (ownership model, server-side grading) that shape almost every
file below.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Core Concepts](#core-concepts)
  - [Ownership replaces admin roles](#ownership-replaces-admin-roles)
  - [Answers never reach the browser](#answers-never-reach-the-browser)
  - [Everything is re-derived from the URL + Firestore](#everything-is-re-derived-from-the-url--firestore)
- [Route Map](#route-map)
- [Directory Structure](#directory-structure)
- [File-by-File Reference](#file-by-file-reference)
  - [Entry & Routing](#entry--routing)
  - [Authentication](#authentication)
  - [Firebase Config](#firebase-config)
  - [Data Layer — `services/firestore.js`](#data-layer--servicesfirestorejs)
  - [CSV Parsing — `services/csv.js`](#csv-parsing--servicescsvjs)
  - [Student-Facing Pages](#student-facing-pages)
  - [Test Management (Owner) Pages](#test-management-owner-pages)
  - [Shared Components](#shared-components)
  - [Cloud Functions](#cloud-functions)
  - [Security Rules — `firestore.rules`](#security-rules--firestorerules)
  - [Config Files](#config-files)
- [Data Model Reference](#data-model-reference)
- [Cookbook: "If I want to change X…"](#cookbook-if-i-want-to-change-x)
- [Deployment](#deployment)

---

## Tech Stack

| Layer | Choice | Where |
|---|---|---|
| UI | React 19 + Vite, Tailwind (CDN), FontAwesome (CDN) | `src/` |
| Routing | react-router-dom v7 | `src/main.jsx` |
| Auth | Firebase Authentication (email/password, Google, email-link) | `src/pages/Auth.jsx` |
| Database | Cloud Firestore, **named database `"ex-cbt"`** (not the `(default)` database) | `src/utility/config.js` |
| Server logic | Cloud Functions v2 (`onCall`), Node 22 | `functions/` |
| Hosting | Firebase Hosting | `firebase.json` |

⚠️ The Firestore database is named `ex-cbt`, not `(default)`. Every
`getFirestore(app, "ex-cbt")` / `getFirestore(app, "ex-cbt")` (Admin SDK) call
and every `firebase.json` / CLI command must reference that name explicitly,
or it'll silently read/write an empty, unrelated database.

## Getting Started

```bash
npm install                # frontend deps
cd functions && npm install  # Cloud Functions deps (separate package.json)
npm run dev                 # Vite dev server
npm run build                # production build → dist/
npm run lint                 # eslint src/
```

To test against a local Firebase emulator instead of production, set
`VITE_USE_FIREBASE_EMULATOR=true` and run `firebase emulators:start`
(auth :9099, firestore :8080, functions :5001, hosting :5000) — see the
guard in [`src/utility/config.js`](#firebase-config).

## Core Concepts

### Ownership replaces admin roles

There is no admin allowlist. Every `tests/{testId}` document has a
`createdBy` field (the creator's email), set once and never changed. That
field is the *only* authority for "who can manage this test" — checked in
[`firestore.rules`](#security-rules--firestorerules) and, for a friendlier
UI, in `TestDetail.jsx` / `QuestionsEditor.jsx`. Any signed-in user can
create tests; they only ever see and manage their own.

### Answers never reach the browser

`tests/{testId}.questions[]` only ever contains `{ question, options }` —
never the correct answer. The answer key lives in a separate,
owner-only-readable document, `tests/{testId}/answerKey/data`. Grading
happens inside a Cloud Function (`submitTest`, using the Admin SDK, which
bypasses Firestore rules) — the only code path where a student's picks and
the answer key are ever in the same place. See
[Answers never reach the browser](#answers-never-reach-the-browser) and
[`functions/index.js`](#cloud-functions).

### Everything is re-derived from the URL + Firestore

The test-taking flow never keeps state that can't be reconstructed after a
page refresh. `testId` comes from the route (`/test/:testId`), the attempt
id comes from a `?sid=` query param, and every page re-fetches / re-verifies
against Firestore on mount rather than trusting in-memory or
`location.state` data (see the comment in `Submission.jsx`). This is
[`useTestSession.js`](#hooks--usetestsessionjs)'s job.

## Route Map

| Route | Component | Guard | Purpose |
|---|---|---|---|
| `/` | `Home.jsx` → `Auth.jsx` or `Dashboard.jsx` | — (self-gating) | Sign-in screen when signed out; "my tests" dashboard when signed in |
| `/manage/tests` | `TestsList.jsx` | `RequireAuth` | List of tests *you* own |
| `/manage/tests/new` | `NewTest.jsx` | `RequireAuth` | Create a test |
| `/manage/:testId` | `TestDetail.jsx` | `RequireAuth` + ownership check | Settings, access list, submissions |
| `/manage/:testId/questions` | `QuestionsEditor.jsx` | `RequireAuth` + ownership check | Edit questions + answers |
| `/test/:testId` | `StartTest.jsx` | `RequireAuth` | The link an owner shares; name/Student ID entry |
| `/test/:testId/attempt` | `TestInterface.jsx` | `RequireAuth` | The exam itself (`?sid=` attempt id) |
| `/test/:testId/submitted` | `Submission.jsx` | `RequireAuth` | Confirmation screen |

Defined in [`src/main.jsx`](#entry--routing).

## Directory Structure

```
src/
  main.jsx                 route table (entry point)
  App.jsx                  branded shell (sidebar) wrapping student-facing pages
  context/
    AuthContext.jsx         current Firebase user + loading state
    ToastContext.jsx         toast notifications
  routes/
    RequireAuth.jsx          redirect-to-sign-in guard
  hooks/
    useTestSession.js        testId/attemptId + relative navigation helper
  pages/
    Home.jsx                 root route gate (Auth vs Dashboard)
    Auth.jsx                  sign-in / sign-up
    StartTest.jsx             pre-exam name/Student ID entry
    TestInterface.jsx         the exam UI
    Submission.jsx            post-submit confirmation
    admin/
      AdminLayout.jsx          topbar/sidebar chrome for management pages
      Dashboard.jsx             stats + recent activity
      TestsList.jsx             your tests
      NewTest.jsx               create-test form
      TestDetail.jsx            settings/access/submissions for one test
      QuestionsEditor.jsx       spreadsheet editor for questions+answers
  components/                 presentational/shared pieces
  services/
    firestore.js               all Firestore reads/writes + Cloud Function calls
    csv.js                     CSV/JSON parsing + validation
  utility/
    config.js                  Firebase app/Auth/Firestore/Functions init

functions/
  index.js                    submitTest, deleteSubmission (Cloud Functions)
  scripts/migrate-answer-keys.mjs  one-time data migration script

firestore.rules                security rules
firestore.indexes.json         composite index definitions
firebase.json                  hosting/firestore/functions/emulator config
```

## File-by-File Reference

### Entry & Routing

#### `src/main.jsx`
Mounts the React tree and defines every route (see [Route Map](#route-map)).
`AuthProvider` and `ToastProvider` wrap everything so `useAuth()` /
`useToast()` work anywhere.

```jsx
<Routes>
  <Route path="/" element={<Home />} />

  <Route element={<App />}>
    <Route path="/test/:testId" element={<RequireAuth />}>
      <Route index element={<StartTest />} />
      <Route path="attempt" element={<TestInterface />} />
      <Route path="submitted" element={<Submission />} />
    </Route>
  </Route>

  <Route path="/manage" element={<RequireAuth />}>
    <Route element={<AdminLayout />}>
      <Route path="tests" element={<TestsList />} />
      <Route path="tests/new" element={<NewTest />} />
      <Route path=":testId" element={<TestDetail />} />
      <Route path=":testId/questions" element={<QuestionsEditor />} />
    </Route>
  </Route>
</Routes>
```
**Change effect:** adding a new top-level *static* route (e.g. `/settings`)
is safe. Adding a new bare *dynamic* segment at root (e.g. `/:something`)
risks colliding with `/manage` or `/test` — that's exactly why management
pages are namespaced under `/manage/*` instead of living at root.

#### `src/pages/Home.jsx`
The root route (`/`). Not itself protected by `RequireAuth` — it *is* the
sign-in gate. Composes `App` (branded shell) around `Auth` when signed out,
or `AdminLayout` (topbar/sidebar) around `Dashboard` when signed in.

```jsx
export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <App><Auth /></App>;
  return <AdminLayout><Dashboard /></AdminLayout>;
}
```
**Change effect:** this is where you'd add a marketing/landing page for
logged-out visitors, or change what a freshly-signed-in user lands on.

#### `src/App.jsx`
The branded shell used by the student-facing test-taking routes (and, via
`Home.jsx`, the signed-out `/` screen). Renders a left "Examiner" marketing
panel, unless `isFullScreen` is true, in which case it collapses so the
page's own layout (StartTest/TestInterface each have their own) can use the
full width.

```jsx
const isFullScreen = /^\/test\/[^/]+(\/attempt)?$/.test(location.pathname);
```
Matches `/test/:testId` and `/test/:testId/attempt`, but **not**
`/test/:testId/submitted` (which keeps the sidebar, like the sign-in
screen).
**Change effect:** editing this regex changes which test-taking screens show
the branded sidebar vs go full-width. Accepts an optional `children` prop
(falls back to `<Outlet/>`) specifically so `Home.jsx` can reuse it outside
the normal nested-route tree.

### Authentication

#### `src/context/AuthContext.jsx`
Wraps Firebase's `onAuthStateChanged` in a React context: `{ user, loading }`.
No role/admin concept — just "is someone signed in."

```jsx
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser);
    setLoading(false);
  });
  return unsubscribe;
}, []);
```
Consumed via `useAuth()` everywhere a component needs `user.email` (used
constantly as the "who's asking" identity for ownership checks and
Firestore document ids).
**Change effect:** this is the single source of truth for "am I signed in."
If you ever reintroduce roles/permissions beyond ownership, this is where
they'd be fetched and exposed.

#### `src/routes/RequireAuth.jsx`
Route guard used by both `/manage/*` and `/test/:testId/*`. Redirects to `/`
with a `redirect` query param if not signed in; renders `<Outlet/>`
otherwise.

```jsx
if (!user) {
  const redirectTarget = `${location.pathname}${location.search}`;
  return <Navigate to={`/?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
}
return <Outlet />;
```
**Change effect:** this is the *only* place unauthenticated access is
blocked at the routing layer — Firestore rules are the real security
boundary underneath it (never rely on this alone).

#### `src/pages/Auth.jsx`
One sign-in page for everyone — no separate admin login. Supports:
- Email/password (login or sign-up)
- Google popup (`signInWithPopup`)
- Passwordless email link (`sendSignInLinkToEmail` / `signInWithEmailLink`,
  with the pending email cached in `localStorage` under
  `emailForSignIn` so the link can complete in a different tab/device)

```jsx
async function finishSignIn(user) {
  await upsertUser(user.email, { displayName: user.displayName, photoURL: user.photoURL });
  navigate(searchParams.get('redirect') || '/');
}
```
**Change effect:** `redirect` is the only param this reads now (no more
separate `?id=` — the shareable test link *is* `/test/:testId`, so
`RequireAuth`'s `redirect` already encodes it). Add a new sign-in method
here; `finishSignIn` is the single funnel every method goes through
afterward.

### Firebase Config

#### `src/utility/config.js`
Initializes the Firebase app and exports `db`, `auth`, `googleProvider`,
`analytics`, `functions`. Points Firestore at the **named database
`"ex-cbt"`** — not `(default)`.

```js
const db = getFirestore(app, "ex-cbt");
const auth = getAuth(app);
const functions = getFunctions(app);

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
```
**Change effect:** changing the database name here means also updating it
in `functions/index.js`, `functions/scripts/migrate-answer-keys.mjs`, and
`firebase.json`'s `firestore[0].database` — all four must agree.

### Data Layer — `src/services/firestore.js`

Every Firestore read/write in the app goes through this file. Grouped by
purpose:

**Tests**
| Function | Does | Effect of changing |
|---|---|---|
| `getTest(testId)` | Single-doc read of the public (answer-free) test | Used by every page that needs test metadata/questions but not answers (StartTest, TestInterface, TestsList, Dashboard) |
| `getTestAnswerKey(testId)` | Reads `tests/{id}/answerKey/data`, returns the raw `answers[]` array | Owner-only per rules; used solely by `QuestionsEditor` to re-merge answers for editing |
| `listTests(ownerEmail)` | Tests you created, newest first | Requires `where('createdBy', ...)` to match the Firestore rule's `list` condition — **don't remove that filter**, the rule will reject the query without it (see [rules note](#security-rules--firestorerules)) |
| `createTest({...})` | Allocates a collision-checked id, splits `questions` into the public doc + `answerKey/data`, writes both in one batch | The single place `answer` values leave the browser and land in the private subdoc |
| `updateTest(testId, {...})` | Patches test fields; if `questions` is included, re-splits and rewrites both docs | Always keeps `questions[]` and `answerKey/data` index-aligned because they're only ever written together |
| `deleteTest(testId)` | Deletes the test doc (not its subcollections — Firestore doesn't cascade-delete) | Orphans `answerKey/data` and `submissions/*` under the deleted id; harmless but not reclaimed automatically |

**Submissions** (`tests/{testId}/submissions/{normalizedStudentId}`)

Submission docs are keyed by a *normalized* Student ID (lowercased, spaces →
hyphens), not `studentId_timestamp` like an earlier version. This makes
"does this student already have an attempt" a plain `get()` instead of a
`where()` query — see the long comment in `firestore.rules` for why that
matters for Firestore's list-query security-rule provability.

| Function | Does | Effect of changing |
|---|---|---|
| `startTestAttempt(testId, name, studentId)` | Calls the `startTest` Cloud Function | **Not a direct Firestore write** — the function does the roster check, the dedupe-against-a-completed-attempt check, and the write itself, all server-side. Returns the attempt id |
| `getSubmission(testId, attemptId)` | Single-doc read | Used by `TestInterface` on load to confirm the attempt is real and not already submitted |
| `submitTestAttempt({ testId, attemptId, answers })` | Calls the `submitTest` Cloud Function | **Does not grade locally** — hands off raw picks, gets back `{ score, total }` (currently unused by the UI) |
| `listSubmissionsForTest(testId, ownerEmail)` | All submissions for one test, filtered by `testOwnerEmail` | Same list-provability requirement as `listTests` |
| `deleteSubmission(testId, attemptId)` | Calls the `deleteSubmission` Cloud Function | Cross-account write (clearing the *student's* `testsTaken` flag) — can't safely be a direct client write |

**Users**
| Function | Does |
|---|---|
| `upsertUser(email, data)` | Merges profile fields into `users/{email}` on every sign-in |
| `getUser(email)` / `hasUserTakenTest(email, testId)` | Reads `users/{email}.testsTaken[testId]` — the retake gate |

**Dashboard recents** — `listRecentSubmissions`, `listRecentlyCreatedTests`,
`listRecentlyEditedTests` all take `ownerEmail` as their first argument and
filter accordingly; used only by `Dashboard.jsx`.

**Internal helpers** (not exported): `slugify`/`randomSuffix` (test id
generation), `splitQuestions` (the answer/question split),
`submissionsCol`/`answerKeyDoc` (path builders). Submission-doc keying
(`normalizeStudentId`) now lives in `functions/index.js` instead, since the
client no longer builds that document reference itself.

### CSV Parsing — `src/services/csv.js`

Pure functions, no Firebase — safe to unit-test in isolation.

| Function | Does |
|---|---|
| `normalizeQuestion(raw, rowIndex)` | Validates one question row (question non-empty, ≥2 options, answer matches an option case-insensitively); returns `{ ...fields, valid, errors }` |
| `parseQuestionsFile(file)` | Detects CSV vs JSON by extension/mime, parses (Papa Parse for CSV), maps every row through `normalizeQuestion` |
| `questionsToCsv` / `downloadCsv` / `downloadJson` | Export helpers, used by `QuestionsEditor` and `TestDetail` |
| `normalizeAllowedUser` / `parseAllowedUsersFile` / `allowedUsersToCsv` | Same pattern for the access-restriction roster (name + Student ID pairs) |
| `isUserAllowed(allowedUsers, restrictAccess, name, studentId)` | Case-insensitive, trimmed match against the roster; `restrictAccess ?? Boolean(allowedUsers?.length)` so pre-existing tests that never wrote the flag still behave correctly |

**Change effect:** this is purely client-side UX validation — see the
[Cookbook](#cookbook-if-i-want-to-change-x) entry on `isUserAllowed` for why
it isn't currently enforced by Firestore rules.

### Hooks — `src/hooks/useTestSession.js`

```js
export function useTestSession() {
  const { testId } = useParams();          // from /test/:testId
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('sid'); // the attempt id, once started

  function goTo(path, extra = {}, options) {
    const target = path.startsWith('/') ? path : `/test/${testId}/${path}`;
    navigate(`${target}${paramsFor(extra)}`, options);
  }
  return { testId, studentId, paramsFor, goTo };
}
```
`goTo('')` → `/test/:testId` (start), `goTo('attempt', {sid})` →
`/test/:testId/attempt?sid=...`, `goTo('submitted')` →
`/test/:testId/submitted`. An absolute path (starting with `/`) is used
as-is.
**Change effect:** every navigation in StartTest/TestInterface/Submission
goes through `goTo` with a *relative* segment name — never a hardcoded
absolute path. If you rename a route segment (e.g. `attempt` →
`in-progress`), update both the route in `main.jsx` and every `goTo('attempt', ...)` call site.

### Student-Facing Pages

#### `src/pages/StartTest.jsx` (`/test/:testId`)
1. Loads the test; if missing/inactive → "expired" screen.
2. If `hasUserTakenTest` → redirect straight to `submitted`.
3. Collects Name + Student ID. On "Begin":
   - `isUserAllowed(...)` client-side gate — instant feedback only; the
     `startTest` Cloud Function enforces the same check server-side
     regardless (see Cookbook).
   - `startAttemptWithRetry()` calls `startTestAttempt`, which calls
     `startTest` — the function does the roster check, the dedupe-against-a-
     completed-attempt check, and the write, all in one round trip. Retries
     once with a forced token refresh on `functions/unauthenticated`
     (guards against a race between sign-in completing and the ID token
     attaching to the Functions client).
   - A `functions/already-exists` error means a completed attempt already
     exists under that Student ID → redirect to `submitted` instead of
     surfacing it as a form error.
   - If `test.strictMode`, requests fullscreen **inside the click handler**
     (required — browsers reject fullscreen requests from async callbacks).
   - Navigates to `attempt` with `?sid=<attemptId>` (the id `startTest`
     returned).

**Change effect:** the "no second attempt" guarantee comes from the
submission doc's deterministic id (normalized Student ID, computed inside
`startTest`) plus its own check that a completed attempt doesn't already
exist — changing that id scheme back to something non-deterministic would
silently allow duplicate attempts to accumulate.

#### `src/pages/TestInterface.jsx` (`/test/:testId/attempt`)
- Loads test + the existing submission; bounces back to `StartTest` if
  either is missing, or to `submitted` if `attempt.testTaken`.
- Countdown timer (`timeRemaining`, ticking every second) auto-submits at
  zero via a ref (`handleSubmitRef`) that's kept pointed at the *latest*
  `handleSubmit` closure — otherwise the `setInterval` set up once on mount
  would keep calling a stale version with empty `userAnswers`.
- Strict mode: `visibilitychange`/`fullscreenchange` listeners start a
  3-second countdown overlay; returning cancels it, expiring auto-submits.
- `handleSubmit` builds `answers = questions.map((_, i) => userAnswers[i] ?? null)`
  and hands it to `submitTestAttempt` — **no grading happens here**, that's
  entirely inside the Cloud Function now.

**Change effect:** any UI change here (new question type, different nav
layout) is purely presentational and doesn't touch security. Changing the
*grading logic* means editing `functions/index.js`'s `gradeAnswers`, not
this file.

#### `src/pages/Submission.jsx` (`/test/:testId/submitted`)
Re-verifies `hasUserTakenTest` against Firestore on every mount — the
"submitted" reason shown (`already-taken` vs `submitted`) comes from
router `location.state`, but *whether to show this page at all* never
trusts state alone (it survives page reloads via the History API, so it
can't be trusted as a "we just got here" signal).

### Test Management (Owner) Pages

#### `src/pages/admin/AdminLayout.jsx`
Topbar + sidebar chrome (`Dashboard` / `Tests` nav links) wrapping every
`/manage/*` page, and also composed directly by `Home.jsx` for `/`. Accepts
optional `children` (falls back to `<Outlet/>`) for that reuse.

#### `src/pages/admin/Dashboard.jsx` (`/`, when signed in)
Fetches four owner-scoped queries in parallel via `Promise.allSettled`
(one failing doesn't block the others — each shows its own toast warning).
Stat tiles are computed client-side from the `tests` list (`metrics`
via `useMemo`); the three "recent" panels are filterable by a time-range
dropdown, filtered client-side with `withinRange`.

#### `src/pages/admin/TestsList.jsx` (`/manage/tests`)
Simple expandable list of your tests, `listTests(user.email)`.

#### `src/pages/admin/NewTest.jsx` (`/manage/tests/new`)
Form → `createTest`. Handles both the questions upload (CSV/JSON via
`parseQuestionsFile`) and the optional access-restriction roster
(`parseAllowedUsersFile`). `canCreate` gates the submit button on: id +
name + minutes filled, at least one valid question row, and (if
`restrictAccess`) at least one valid roster row.

#### `src/pages/admin/TestDetail.jsx` (`/manage/:testId`)
The busiest page — settings, access-restriction editor, and the
submissions list/spreadsheet, all in one. Key points:
- `if (test.createdBy !== user.email) return <p>...access...</p>` — the
  ownership guard (friendly UI on top of the rules-level enforcement).
- `handleCopyLink` builds `${origin}/test/${testId}` — the actual link
  students receive.
- Toggles (`Active`, `Strict Mode`, `Restriction`) are each independent
  `updateTest` calls followed by `reload()`.
- Delete flows (test, individual submission) require typing the test id to
  confirm, matching a common "destructive action" UX pattern.

#### `src/pages/admin/QuestionsEditor.jsx` (`/manage/:testId/questions`)
Loads `getTest` + `getTestAnswerKey` together and re-merges them into rows
so the spreadsheet UI can show/edit `{ question, options, answer }` as if
it were one array — even though it's stored as two documents.
`handleSave` sends the merged rows straight to `updateTest`, which
re-splits them.

### Shared Components

| Component | Purpose |
|---|---|
| `LoadingScreen.jsx` | Full-page spinner shown while auth/route/data guards resolve |
| `StatTile.jsx` | Dashboard metric card (icon + number + label, tone-colored) |
| `SpreadsheetTable.jsx` | Generic editable/read-only grid — powers both the question editor and the submissions spreadsheet view, avoiding a heavier grid dependency |
| `TriangleBackground.jsx` | Purely decorative (StartTest's hero panel) |
| `Toaster.jsx` + `context/ToastContext.jsx` | Toast notifications; `useToast().warning/success/info(message)` auto-dismisses after 4s |

### Cloud Functions

#### `functions/index.js`
Three `onCall` (v2) functions, all using `firebase-admin`'s Firestore client
pointed at the **`ex-cbt`** named database (`getFirestore(app, 'ex-cbt')` —
must match `config.js`).

**`startTest({ testId, name, studentId })`**
```js
const testSnap = await db.doc(`tests/${testId}`).get();
if (!testSnap.exists || testSnap.data().active === false) {
  throw new HttpsError('not-found', 'This test is not available.');
}
if (!isRosterAllowed(test.allowedUsers, test.restrictAccess, name, studentId)) {
  throw new HttpsError('permission-denied', "You're not on the approved list for this test.");
}
const attemptId = normalizeStudentId(studentId);
const existing = await submissionRef.get();
if (existing.exists && existing.data().testTaken) {
  throw new HttpsError('already-exists', 'A submission already exists for this Student ID.');
}
await submissionRef.set({ testId, testOwnerEmail: test.createdBy, studentId: studentId.trim(), name: name.trim(), userEmail: email, ... });
return { attemptId };
```
`firestore.rules` makes submissions writes function-only (`allow write: if
false`), so this is the **only** code path that can create a submission
doc. It folds together what used to be three separate client-side steps
(roster check, dedupe check, the write) into one round trip, and returns
distinct error codes (`not-found` / `permission-denied` / `already-exists`)
that `StartTest.jsx` branches on directly instead of inferring meaning from
a generic Firestore `permission-denied`.
**Change effect:** `isRosterAllowed` here is the single enforced copy of the
roster-matching logic — `csv.js`'s `isUserAllowed` (used by `StartTest.jsx`
for instant feedback) must stay logically equivalent to it, but is no
longer the security boundary itself.

**`submitTest({ testId, attemptId, answers })`**
```js
const correctAnswers = answerKeySnap.exists ? answerKeySnap.data().answers ?? [] : [];
const score = gradeAnswers(answers, correctAnswers); // case-insensitive exact match

const batch = db.batch();
batch.update(submissionRef, { testTaken: true, submittedAt: ..., answers, score });
batch.update(testRef, { submissionCount: FieldValue.increment(1), lastSubmissionAt: ... });
batch.set(userRef, { testsTaken: { [testId]: true } }, { merge: true });
await batch.commit();
return { score, total: correctAnswers.length };
```
Validates the caller is signed in, owns the submission (`userEmail` match),
and hasn't already submitted, *before* touching the answer key. This is the
**only code path in the entire app that ever has both the answer key and a
student's picks in memory at the same time.**
**Change effect:** if you change the grading algorithm (partial credit,
weighted questions, etc.), this is the one place to do it — nowhere on the
client can safely replicate this logic without re-exposing the answer key.

**`deleteSubmission({ testId, attemptId })`**
Verifies the caller is the test's owner (`tests/{testId}.createdBy`), then
deletes the submission and — if it had been completed — decrements the
test's `submissionCount` and clears the *student's* `testsTaken[testId]`
flag. That cross-account write is why this can't be a plain client write
under the current rules.

#### `functions/scripts/migrate-answer-keys.mjs`
One-time, manually-run script (not deployed, not triggered automatically).
For every existing `tests/{id}` doc that still has `answer` embedded in
`questions[]`, splits it: writes `tests/{id}/answerKey/data` and strips
`answer` from the public doc. Run once against the emulator, then once
against production, **before** deploying rules that make the split doc
owner-only (otherwise older tests would have no readable answer key at
all).

### Security Rules — `firestore.rules`

The security boundary the whole ownership + answer-key design depends on.
Key functions:

```
function isTestOwner(testId) {
  return isSignedIn() &&
    get(/databases/$(database)/documents/tests/$(testId)).data.createdBy == request.auth.token.email;
}
```
Used for **single-document** checks only (`get`/`update`/`delete` on one
test, or the `answerKey` subdoc).

```
match /tests/{testId}/submissions/{submissionId} {
  allow read: if isSignedIn() &&
    (resource.data.userEmail == request.auth.token.email ||
     resource.data.testOwnerEmail == request.auth.token.email);
  allow write: if false;  // startTest / submitTest / deleteSubmission only
}
```

**Every submission write goes through a Cloud Function.** There's no
`create` condition to express here because there's no legitimate direct
client write left: starting an attempt (roster check + dedupe) is
`startTest`, finalizing is `submitTest`, deleting is `deleteSubmission` —
all three use the Admin SDK, which bypasses these rules entirely. An
earlier version of this rule tried to replicate the roster check
(`isUserAllowed()` from `src/services/csv.js`) directly in Rules language;
it worked, but duplicated business logic across two languages that had to
be kept manually in sync, so it was moved into `startTest` instead (see
[Cloud Functions](#cloud-functions)) — the rule collapsed to `if false`
once nothing else needed a `create` condition.

**Why `testOwnerEmail` is denormalized onto every submission instead of
using `isTestOwner()` for reads:** Firestore can only skip evaluating a
security rule against *every* document in the database for a `list()`/
`collectionGroup()` query when the query's own `where()` clause matches the
rule's condition on a *plain field*. A `get()` call inside the rule can't be
matched to a query filter that way — Firestore would reject the entire
`list` request rather than silently filter results. That's why
`listSubmissionsForTest`/`listRecentSubmissions` always add a matching
`where('testOwnerEmail', '==', ownerEmail)`. The field itself is
authoritative rather than client-supplied: `startTest` sets it directly from
the test doc it just read server-side (`test.createdBy`), so there's nothing
for a client to forge in the first place.

**Change effect:** if you add a new list-style query against `submissions`,
it **must** filter on a field the rule can check directly (no `get()`), or
Firestore will reject it outright in production even though it might appear
to work in the emulator's more lenient mode — test list queries against the
real rules, not just the emulator UI.

### Config Files

| File | Purpose | Watch out for |
|---|---|---|
| `firebase.json` | Hosting/Firestore/Functions/emulator config | `firestore` is an **array** with an explicit `"database": "ex-cbt"` — the default (no array) form would target the wrong database |
| `firestore.indexes.json` | Composite indexes for owner-scoped queries | Three indexes: `tests(createdBy, createdAt)`, `tests(createdBy, updatedAt)`, `submissions(testOwnerEmail, testTaken, submittedAt)` — each corresponds 1:1 to a query in `firestore.js`. Adding a new filtered+sorted query almost always needs a new entry here |
| `functions/package.json` | Cloud Functions deps, `engines.node: "22"` | Separate `node_modules` from the root — `npm install` must be run inside `functions/` too |

## Data Model Reference

```
tests/{testId}
  adminEnteredId, displayName, minutes
  questions: [{ question, options[] }]   ← answer-free
  allowedUsers: [{ name, studentId }]
  restrictAccess: bool
  strictMode: bool
  active: bool
  createdAt, createdBy, updatedAt, updatedBy
  submissionCount, lastSubmissionAt

tests/{testId}/answerKey/data           ← owner-only
  answers: [string]                      index-aligned with questions[]

tests/{testId}/submissions/{normalizedStudentId}
  testId, testOwnerEmail                 denormalized, rule-verified
  studentId, name, userEmail
  startedAt, testTaken, submittedAt
  answers, score                         null until submitTest runs

users/{email}
  email, displayName, photoURL, lastSignInAt
  testsTaken: { [testId]: bool }         the retake gate
```

## Cookbook: "If I want to change X…"

**...allow a second attempt per test (currently blocked).**
`startTest`'s dedupe check (an existing submission with `testTaken: true`
throws `already-exists`) is what prevents it. You'd need to change the
submission doc id scheme (currently one doc per normalized Student ID
*forever*) to something that allows multiple docs per student — but see the
rules note above about why that id scheme exists (list-query safety), and
revisit `hasUserTakenTest`/`users/{email}.testsTaken` too, since that's a
second, independent retake gate.

**...enforce the access-restriction roster server-side.**
Done: the `startTest` Cloud Function's `isRosterAllowed()` mirrors
`isUserAllowed` (in `csv.js`) and is the only code path that can create a
submission (`firestore.rules` makes submissions writes `if false` otherwise)
— so calling it directly for a restricted test with a `(name, studentId)`
pair that isn't on the roster throws `permission-denied` regardless of what
the client checked first. `StartTest.jsx`'s `isUserAllowed` check is still
there too, purely for instant feedback without a round trip; the function is
the real boundary now, same pattern as ownership and grading.

**...add partial credit or weighted questions.**
Change `gradeAnswers` in `functions/index.js` only — never add scoring
logic to `TestInterface.jsx`, since the client never has the answer key to
score against correctly (and shouldn't).

**...let an owner see who's currently mid-exam (not just completed).**
`listSubmissionsForTest` already returns in-progress docs (`testTaken:
false`); `TestDetail.jsx`'s "Submitted only" filter just hides them by
default — flip that default or add a status badge.

**...change what happens right after sign-in.**
`Auth.jsx`'s `finishSignIn` is the single funnel every sign-in method
(password, Google, email link) goes through — change the `navigate(...)`
call there.

**...rename a route segment (e.g. `/manage` → `/owner`).**
Update `main.jsx`'s route tree, `AdminLayout.jsx`'s `NAV_ITEMS`, and every
hardcoded `Link to="/manage/..."` (`TestsList.jsx`, `NewTest.jsx`,
`TestDetail.jsx`, `QuestionsEditor.jsx`, `Dashboard.jsx`) — these aren't
centralized through a helper the way `/test/:testId/*` is via `useTestSession`'s
`goTo`.

## Deployment

```bash
firebase deploy --only firestore   # rules + indexes, targets the ex-cbt database
firebase deploy --only functions   # submitTest, deleteSubmission
firebase deploy --only hosting     # the built dist/
```

Before the **first** deploy of the current (post-rewrite) rules against a
project that already has test data: run
`functions/scripts/migrate-answer-keys.mjs` against production first (see
that file's header comment), or existing tests will have no answer key to
grade against.
