// The test editor's draft and its undo/redo history (TestEditorProvider).
// Same design as PeraForm's editorReducer: every change is a snapshot, so
// Undo puts back exactly what was there - including a whole Dawn change,
// which is one edit. `version` bumps on every change; autosave records the
// version it sent.

const HISTORY_LIMIT = 100
// Edits with the same key within this window merge into one undo step, so
// Undo removes a typed word or sentence, not a single letter.
const COALESCE_MS = 1000

export const initialHistory = { draft: null, past: [], future: [], version: 0, lastKey: null, lastAt: 0 }

export function historyReducer(state, action) {
  switch (action.type) {
    // The first load (later server snapshots never replace the draft).
    case 'load':
      return { ...initialHistory, draft: action.draft }

    // action: { update(draft) → draft, key?: string, at: ms }
    case 'edit': {
      const draft = action.update(state.draft)
      if (draft === state.draft) return state
      const merge = Boolean(action.key) && action.key === state.lastKey && action.at - state.lastAt < COALESCE_MS
      return {
        ...state,
        draft,
        past: merge ? state.past : [...state.past, state.draft].slice(-HISTORY_LIMIT),
        future: [],
        version: state.version + 1,
        lastKey: action.key ?? null,
        lastAt: action.at,
      }
    }

    case 'undo':
      if (!state.past.length) return state
      return {
        ...state,
        draft: state.past[state.past.length - 1],
        past: state.past.slice(0, -1),
        future: [state.draft, ...state.future],
        version: state.version + 1,
        lastKey: null,
      }

    case 'redo':
      if (!state.future.length) return state
      return {
        ...state,
        draft: state.future[0],
        past: [...state.past, state.draft],
        future: state.future.slice(1),
        version: state.version + 1,
        lastKey: null,
      }

    default:
      return state
  }
}
