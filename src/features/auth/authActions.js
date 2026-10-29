import {
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { callSendVerification, getFirebaseAuth, googleProvider } from '../../lib/firebase.js'

export function signInWithGoogle() {
  return signInWithPopup(getFirebaseAuth(), googleProvider)
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password)
}

export async function createAccount(name, email, password) {
  const { user } = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
  if (name) await updateProfile(user, { displayName: name })
  await resendVerification().catch(() => {})
  return user
}

// The verify-your-email link. Sent from the Quality Tools mailbox in
// HyperCBT's wording when that works; otherwise Firebase's own email. Only
// "too many requests" is passed on (the person should wait, not get a
// second email). Returns 'verified' if the account turns out to be
// verified already.
export async function resendVerification() {
  try {
    const { data } = await callSendVerification({ app: 'hypercbt' })
    if (data?.verified) return 'verified'
    if (data?.sent) return 'sent'
  } catch (err) {
    if (err?.code === 'functions/resource-exhausted') {
      throw Object.assign(new Error(err.message), { code: 'auth/too-many-requests' })
    }
  }
  await sendEmailVerification(getFirebaseAuth().currentUser)
  return 'sent'
}

// After clicking the link in another tab: refresh the account and its
// token, so the new "verified" status reaches the database rules.
export async function recheckVerification() {
  const user = getFirebaseAuth().currentUser
  await user?.reload()
  await user?.getIdToken(true)
  return Boolean(getFirebaseAuth().currentUser?.emailVerified)
}

export function resetPassword(email) {
  return sendPasswordResetEmail(getFirebaseAuth(), email)
}

export function signOut() {
  return firebaseSignOut(getFirebaseAuth())
}

// ── Email sign-in link (no password) ─────────────────────────
// The address is remembered on this device so opening the link here signs
// straight in; opened on another device, the page asks for it again.
const EMAIL_FOR_LINK = 'hypercbt-email-for-link'

export async function sendSignInLink(email, next) {
  const url = new URL('/signin', window.location.origin)
  if (next) url.searchParams.set('next', next)
  await sendSignInLinkToEmail(getFirebaseAuth(), email, { url: url.toString(), handleCodeInApp: true })
  try {
    localStorage.setItem(EMAIL_FOR_LINK, email)
  } catch {
    // Storage blocked - the page will ask for the address when the link opens.
  }
}

export function isEmailLink(href = window.location.href) {
  return isSignInWithEmailLink(getFirebaseAuth(), href)
}

export function rememberedLinkEmail() {
  try {
    return localStorage.getItem(EMAIL_FOR_LINK) || ''
  } catch {
    return ''
  }
}

export async function finishEmailLink(email, href = window.location.href) {
  const result = await signInWithEmailLink(getFirebaseAuth(), email, href)
  try {
    localStorage.removeItem(EMAIL_FOR_LINK)
  } catch {
    // Nothing to clean up.
  }
  return result.user
}

const MESSAGES = {
  'auth/invalid-credential': 'That email and password don’t match.',
  'auth/invalid-email': 'That doesn’t look like a valid email address.',
  'auth/email-already-in-use': 'An account with that email already exists. Try signing in.',
  'auth/weak-password': 'Use at least 6 characters for your password.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Couldn’t reach the server. Check your connection.',
  'auth/unauthorized-domain': 'Sign-in isn’t enabled for this web address yet.',
  'auth/invalid-action-code': 'That sign-in link has expired or was already used. Send a new one.',
  'auth/expired-action-code': 'That sign-in link has expired. Send a new one.',
  'auth/operation-not-allowed': 'This way of signing in isn’t switched on yet.',
}

// null for errors that aren't worth showing (the user closed the popup).
export function authErrorMessage(error) {
  if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error?.code)) {
    return null
  }
  return MESSAGES[error?.code] ?? 'Something went wrong. Please try again.'
}
