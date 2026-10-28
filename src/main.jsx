import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import './lib/ui.css'
import AuthProvider from './features/auth/AuthProvider.jsx'
import RequireSignIn from './features/auth/RequireSignIn.jsx'
import SignInPage from './features/auth/SignInPage.jsx'
import TakeLayout from './features/take/TakeLayout.jsx'
import StartTest from './features/take/StartTest.jsx'
import TestInterface from './features/take/TestInterface.jsx'
import Submission from './features/take/Submission.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import Dashboard from './pages/admin/Dashboard.jsx'
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
            <Route path="/signin" element={<SignInPage />} />

            {/* The link a teacher shares. The start page signs people in
                itself (Google button / One Tap / email); the rest need it. */}
            <Route path="/test/:testId" element={<TakeLayout />}>
              <Route index element={<StartTest />} />
              <Route element={<RequireSignIn />}>
                <Route path="attempt" element={<TestInterface />} />
                <Route path="submitted" element={<Submission />} />
              </Route>
            </Route>

            {/* Making and managing tests - any signed-in user, scoped to
                the tests they own. */}
            <Route element={<RequireSignIn />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="/manage/tests" element={<TestsList />} />
                <Route path="/manage/tests/new" element={<NewTest />} />
                <Route path="/manage/:testId" element={<TestDetail />} />
                <Route path="/manage/:testId/questions" element={<QuestionsEditor />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
