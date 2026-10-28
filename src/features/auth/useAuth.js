import { useContext } from 'react'
import { AuthContext } from './authContext.js'

export function useAuth() {
  return useContext(AuthContext)
}

// A real account (HyperCBT has no anonymous sessions, but Quality Tools
// does - an anonymous PeraForm-style session never counts as signed in).
export function isSignedIn(user) {
  return Boolean(user && !user.isAnonymous)
}
