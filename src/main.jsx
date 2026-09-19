import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import RequireAuth from './routes/RequireAuth.jsx'
import Home from './pages/Home.jsx'
import StartTest from './pages/StartTest.jsx'
import TestInterface from './pages/TestInterface.jsx'
import Submission from './pages/Submission.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import TestsList from './pages/admin/TestsList.jsx'
import NewTest from './pages/admin/NewTest.jsx'
import TestDetail from './pages/admin/TestDetail.jsx'
import QuestionsEditor from './pages/admin/QuestionsEditor.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />

            {/* The link an owner shares - anyone signed in can open it to take the test. */}
            <Route element={<App />}>
              <Route path="/test/:testId" element={<RequireAuth />}>
                <Route index element={<StartTest />} />
                <Route path="attempt" element={<TestInterface />} />
                <Route path="submitted" element={<Submission />} />
              </Route>
            </Route>

            {/* Test management - any signed-in user, scoped to tests they own. */}
            <Route path="/manage" element={<RequireAuth />}>
              <Route element={<AdminLayout />}>
                <Route path="tests" element={<TestsList />} />
                <Route path="tests/new" element={<NewTest />} />
                <Route path=":testId" element={<TestDetail />} />
                <Route path=":testId/questions" element={<QuestionsEditor />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
