import { useEffect, useState } from 'react'
import { callAcceptInvites, watchMyTests } from '../../services/firestore.js'

// Invites (Share window) are claimed once per visit; the list then updates
// by itself, since it's live.
const claimed = new Set()

// Live list of the tests this person owns or edits, newest edit first.
// Needs the createdBy / editorIds + updatedAt indexes (firestore.indexes.json).
export function useMyTests(email, uid) {
  const [state, setState] = useState({ tests: [], loading: true, error: null })

  useEffect(() => {
    if (claimed.has(uid)) return
    claimed.add(uid)
    callAcceptInvites().catch(() => {})
  }, [uid])

  useEffect(
    () =>
      watchMyTests(
        email,
        uid,
        (tests) => setState({ tests, loading: false, error: null }),
        (error) => setState({ tests: [], loading: false, error }),
      ),
    [email, uid],
  )

  return state
}
