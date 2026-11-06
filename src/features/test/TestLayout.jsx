import { useEffect } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { BarChart3, ListChecks, Settings, Users } from 'lucide-react'
import AppShell from '../../lib/AppShell.jsx'
import Spinner from '../../lib/Spinner.jsx'
import TestActions from './TestActions.jsx'
import TestEditorProvider from './TestEditorProvider.jsx'
import TestTitleField from './TestTitleField.jsx'
import { useTestEditor } from './testContext.js'
import './test.css'

// Frame for /tests/:testId/* - the top bar holds the title and the test's
// actions; the four tabs are in the sidebar, as in PeraForm.
export default function TestLayout() {
  const { testId } = useParams()
  return (
    // key: switching tests starts a fresh editing session.
    <TestEditorProvider key={testId} testId={testId}>
      <TestFrame testId={testId} />
    </TestEditorProvider>
  )
}

function TestFrame({ testId }) {
  const { test, draft, loadError } = useTestEditor()
  const ready = Boolean(test && draft)

  // The browser tab shows which test this is, and follows renames.
  useEffect(() => {
    if (!draft) return
    document.title = `${draft.displayName || 'Untitled test'} · HyperCBT`
    return () => {
      document.title = 'HyperCBT'
    }
  }, [draft])

  if (loadError) {
    return (
      <AppShell>
        <div className="test-missing">
          <h1>{loadError === 'not-found' ? 'Test not found' : 'Couldn’t load this test'}</h1>
          <p>
            {loadError === 'not-found'
              ? 'It may have been deleted, or it belongs to another account.'
              : 'Check your connection and try again.'}
          </p>
          <Link to="/" className="btn btn-primary">
            Back to my tests
          </Link>
        </div>
      </AppShell>
    )
  }

  const submitted = test?.submissionCount ?? 0
  const tabs = [
    { to: 'questions', label: 'Questions', icon: ListChecks },
    { to: 'candidates', label: 'Candidates', icon: Users },
    { to: 'results', label: submitted ? `Results (${submitted})` : 'Results', icon: BarChart3 },
    { to: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <AppShell
      nav={tabs.map((t) => ({ ...t, to: `/tests/${testId}/${t.to}` }))}
      center={ready ? <TestTitleField /> : null}
      actions={ready ? <TestActions /> : null}
    >
      {ready ? (
        <div className="test-page">
          <Outlet />
        </div>
      ) : (
        <Spinner label="Opening the test" />
      )}
    </AppShell>
  )
}
