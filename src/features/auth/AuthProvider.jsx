import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseAuth } from '../../lib/firebase.js'
import { upsertUser } from '../../services/firestore.js'
import { AuthContext } from './authContext.js'

export default function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: true })

  useEffect(
    () =>
      onAuthStateChanged(getFirebaseAuth(), (user) => {
        setState({ user, loading: false })
        // Every way in (sign-in page, One Tap, in-page Google, email link,
        // or a session from before) keeps users/{email} current. Not
        // awaited: a slow write never holds up the screen.
        if (user?.email && !user.isAnonymous) {
          upsertUser(user.email, { displayName: user.displayName, photoURL: user.photoURL }).catch(() => {})
        }
      }),
    [],
  )

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
