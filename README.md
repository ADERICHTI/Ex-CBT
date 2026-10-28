# HyperCBT

Quality Tools' assessment app: create, run and mark computer-based tests.
Formerly ex-cbt. Vite + React + Firebase, in the **Quality Tools** Firebase
project (`quality-toolsx`) alongside PeraForm. HyperCBT's own pieces there:

| Piece | Name |
|---|---|
| Firestore database | `hypercbt` (europe-west1) |
| Hosting site | `hypercbt-qt` → https://hypercbt-qt.web.app |
| Functions codebase | `hypercbt` (europe-west1) |
| Sign-in | shared with every Quality Tools app |

The old site (`ex-cbt` on project `quick-cbt`, alias `old`) stays up until
it's retired; its data was not carried over.

## Develop

```
npm install
cd functions && npm install && cd ..
npm run emulators          # auth, firestore, functions
npm run dev:emulators      # the app, against the emulators
```

`npm run dev` runs against the real project and needs `.env` (copy
`.env.example`) plus an App Check debug token.

If another project's emulators already use the default ports, run a copy of
`firebase.json` with every emulator port shifted by 100 and put
`VITE_EMULATOR_PORT_OFFSET=100` in `.env.emulators.local`.

## One-time set-up in quality-toolsx

1. Register the web app and copy its config into `.env`:
   `firebase apps:create web HyperCBT --project quality-toolsx`, then
   `firebase apps:sdkconfig web <app id> --project quality-toolsx`.
2. Create the database:
   `firebase firestore:databases:create hypercbt --location europe-west1 --project quality-toolsx`
3. Create the hosting site:
   `firebase hosting:sites:create hypercbt-qt --project quality-toolsx`
4. Authentication (Firebase console → Authentication):
   - Settings → Authorized domains → add `hypercbt-qt.web.app`.
   - Sign-in method → Email/Password → turn on **Email link** (used by
     "Email me a sign-in link").
5. App Check (enforced project-wide):
   - `gcloud recaptcha keys create --display-name="HyperCBT" --web --integration-type=score --domains=hypercbt-qt.web.app --project quality-toolsx`
   - Firebase console → App Check → Apps → HyperCBT → reCAPTCHA Enterprise →
     paste the key ID; put the same ID in `.env` as `VITE_RECAPTCHA_SITE_KEY`.
   - Copy `functions/.env.example` to `functions/.env` (`ENFORCE_APP_CHECK=true`).
6. Google One Tap: in Google Cloud console → APIs & Services → Credentials,
   open the project's OAuth web client (the one PeraForm uses), add
   `https://hypercbt-qt.web.app` to **Authorized JavaScript origins**, and put
   its client ID in `.env` as `VITE_GOOGLE_OAUTH_CLIENT_ID`.

## Deploy

```
npm run build
FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions:hypercbt,firestore,hosting --project quality-toolsx
```

Deploy all three together: the site, the security rules and the functions
depend on each other. `functions:hypercbt` touches only HyperCBT's
functions, never PeraForm's.
