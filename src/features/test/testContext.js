import { createContext, useContext } from 'react'

// The open test's editing session (TestEditorProvider.jsx):
//   test      - live server copy (status, settings, counts)
//   draft     - { displayName, minutes, questions } being edited
//   edit(fn)  - draft => draft; saved automatically shortly after
//   saveState - 'saved' | 'saving' | 'error'
//   flush()   - save now (before publishing)
//   loadError - 'not-found' | 'failed' | null
export const TestContext = createContext(null)

export function useTestEditor() {
  return useContext(TestContext)
}
