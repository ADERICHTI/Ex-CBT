import { useCallback, useEffect, useRef, useState } from 'react'
import { getAnswerKey, joinQuestions, saveTestDraft, watchTest } from '../../services/firestore.js'
import { useAuth } from '../auth/useAuth.js'
import { TestContext } from './testContext.js'

const AUTOSAVE_MS = 800
const RETRY_MS = 5000

// Loads one test live and owns its editing session: the draft (title, time
// limit, questions with their correct answers) and a debounced autosave.
// The person's own edits are what get saved - nothing is changed for them.
export default function TestEditorProvider({ testId, children }) {
  const { user } = useAuth()
  const [test, setTest] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [saveState, setSaveState] = useState('saved')
  const [version, setVersion] = useState(0)
  const savedVersion = useRef(0)
  const draftRef = useRef(null)
  const started = useRef(false)

  useEffect(
    () =>
      watchTest(
        testId,
        async (data) => {
          if (!data || data.createdBy !== user.email) {
            setLoadError('not-found')
            return
          }
          setTest(data)
          // The draft is built once; later snapshots only refresh `test`
          // (status, counts), so typing is never overwritten.
          if (started.current) return
          started.current = true
          try {
            const answers = await getAnswerKey(testId)
            const initial = {
              displayName: data.displayName ?? '',
              minutes: data.minutes ?? 15,
              questions: joinQuestions(data.questions, answers),
            }
            draftRef.current = initial
            setDraft(initial)
          } catch {
            setLoadError('failed')
          }
        },
        (error) => setLoadError(error.code === 'permission-denied' ? 'not-found' : 'failed'),
      ),
    [testId, user.email],
  )

  const edit = useCallback((fn) => {
    setDraft((d) => {
      const next = fn(d)
      draftRef.current = next
      return next
    })
    setVersion((v) => v + 1)
  }, [])

  const save = useCallback(async () => {
    const at = version
    setSaveState('saving')
    try {
      await saveTestDraft(testId, user.email, draftRef.current)
      savedVersion.current = Math.max(savedVersion.current, at)
      setSaveState('saved')
      return true
    } catch {
      setSaveState('error')
      return false
    }
  }, [testId, user.email, version])

  // Debounced autosave; a failed save retries more slowly until it works.
  useEffect(() => {
    if (!draft || version === savedVersion.current) return
    const timer = setTimeout(save, saveState === 'error' ? RETRY_MS : AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [draft, version, save, saveState])

  // Unsaved edits: ask before the tab closes.
  useEffect(() => {
    const onLeave = (e) => {
      if (version !== savedVersion.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [version])

  const flush = useCallback(async () => (version === savedVersion.current ? true : save()), [version, save])

  return (
    <TestContext.Provider value={{ test, draft, edit, saveState, flush, loadError }}>
      {children}
    </TestContext.Provider>
  )
}
