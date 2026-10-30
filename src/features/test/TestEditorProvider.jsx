import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { getAnswerKey, joinQuestions, saveTestDraft, watchTest } from '../../services/firestore.js'
import { useAuth } from '../auth/useAuth.js'
import { historyReducer, initialHistory } from './editorHistory.js'
import { TestContext } from './testContext.js'

const AUTOSAVE_MS = 800
const RETRY_MS = 5000

// Loads one test live and owns its editing session: the draft (title, time
// limit, questions with their correct answers), undo/redo (editorHistory.js)
// and a debounced autosave.
// The person's own edits are what get saved - nothing is changed for them.
export default function TestEditorProvider({ testId, children }) {
  const { user } = useAuth()
  const [test, setTest] = useState(null)
  const [history, dispatch] = useReducer(historyReducer, initialHistory)
  const { draft, version } = history
  const [loadError, setLoadError] = useState(null)
  const [saveState, setSaveState] = useState('saved')
  const savedVersion = useRef(0)
  const draftRef = useRef(null)
  // Autosave reads the latest draft from here (after the render it's in).
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
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
            const key = await getAnswerKey(testId)
            const initial = {
              displayName: data.displayName ?? '',
              minutes: data.minutes ?? 15,
              questions: joinQuestions(data.questions, key),
            }
            dispatch({ type: 'load', draft: initial })
          } catch {
            setLoadError('failed')
          }
        },
        (error) => setLoadError(error.code === 'permission-denied' ? 'not-found' : 'failed'),
      ),
    [testId, user.email],
  )

  // edit(draft => draft, key?): typing passes a key per field so a word
  // is one undo step; other changes (add, delete, move, Dawn) are one each.
  const edit = useCallback((update, key) => dispatch({ type: 'edit', update, key, at: Date.now() }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

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
    <TestContext.Provider value={{ test, draft, edit, undo, redo, canUndo, canRedo, saveState, flush, loadError }}>
      {children}
    </TestContext.Provider>
  )
}
