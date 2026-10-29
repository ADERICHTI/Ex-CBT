import { useEffect, useState } from 'react'
import { watchMyTests } from '../../services/firestore.js'

// Live list of the tests this person owns, newest edit first.
// Needs the createdBy + updatedAt index (firestore.indexes.json).
export function useMyTests(email) {
  const [state, setState] = useState({ tests: [], loading: true, error: null })

  useEffect(
    () =>
      watchMyTests(
        email,
        (tests) => setState({ tests, loading: false, error: null }),
        (error) => setState({ tests: [], loading: false, error }),
      ),
    [email],
  )

  return state
}
