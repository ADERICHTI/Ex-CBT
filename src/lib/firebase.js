import { initializeApp } from 'firebase/app'
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'

// Values come from Vite's VITE_-prefixed env vars - see .env.example.
// HyperCBT lives in the "Quality Tools" Firebase project (quality-toolsx),
// alongside PeraForm - each app with its own database and site, sharing
// one sign-in.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseApp = initializeApp(firebaseConfig)

// `npm run dev:emulators` sets this, so local testing never touches the
// real project's data or user list.
const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'
// Shifts every emulator port, for running alongside another project's
// emulators (match it in a copy of firebase.json).
const port = (base) => base + Number(import.meta.env.VITE_EMULATOR_PORT_OFFSET || 0)

// App Check: proves requests come from this site (invisible reCAPTCHA
// Enterprise). It's enforced project-wide on quality-toolsx, so the real
// project needs VITE_RECAPTCHA_SITE_KEY. On localhost, set
// VITE_APPCHECK_DEBUG_TOKEN to a debug token registered in the console.
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
if (recaptchaKey && !useEmulators) {
  // Development builds only: import.meta.env.DEV is false in production
  // builds, so the debug token never ships in the published site.
  if (import.meta.env.DEV && location.hostname === 'localhost') {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true
  }
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
    isTokenAutoRefreshEnabled: true,
  })
}

// Named database, not the project's default one - that's what separates
// HyperCBT's data (and its security rules) from the other Quality Tools apps.
export const db = getFirestore(firebaseApp, 'hypercbt')
if (useEmulators) connectFirestoreEmulator(db, '127.0.0.1', port(8080))

// Same region as the database and the functions (functions/index.js).
export const functions = getFunctions(firebaseApp, 'europe-west1')
if (useEmulators) connectFunctionsEmulator(functions, '127.0.0.1', port(5001))

// The suite-wide billing database: one AI credit wallet per Quality Tools
// account, whichever app spends it. Read-only here; functions write it.
export const billingDb = getFirestore(firebaseApp, 'billing')
if (useEmulators) connectFirestoreEmulator(billingDb, '127.0.0.1', port(8080))

// The suite's shared AI endpoint and wallet set-up (they live in PeraForm's
// functions; HyperCBT's features are added there - functions/ai/hypercbt.js).
// AI runs stream progress and can take a while (the function allows 300 s).
export const callAiRun = httpsCallable(functions, 'aiRun', { timeout: 305_000 })
export const callEnsureWallet = httpsCallable(functions, 'ensureWallet')
// Sends the verify-your-email link from the Quality Tools mailbox, in
// HyperCBT's wording (also in PeraForm's functions). 5 an hour per account.
export const callSendVerification = httpsCallable(functions, 'sendVerification')

export const googleProvider = new GoogleAuthProvider()

// Lazy: getAuth() throws synchronously on a missing/invalid API key, which
// would crash every screen at import time while .env is still unfilled.
let authInstance
export function getFirebaseAuth() {
  if (!authInstance) {
    authInstance = getAuth(firebaseApp)
    if (useEmulators) {
      connectAuthEmulator(authInstance, `http://127.0.0.1:${port(9099)}`, { disableWarnings: true })
    }
  }
  return authInstance
}
