import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import './index.css'
import './lib/ui.css'
import AuthProvider from './features/auth/AuthProvider.jsx'
import RequireSignIn from './features/auth/RequireSignIn.jsx'
import RequireVerified from './features/auth/RequireVerified.jsx'
import SignInPage from './features/auth/SignInPage.jsx'
import TakeLayout from './features/take/TakeLayout.jsx'
import StartTest from './features/take/StartTest.jsx'
import TestInterface from './features/take/TestInterface.jsx'
import Submission from './features/take/Submission.jsx'
import AppShell from './lib/AppShell.jsx'
import WalletProvider from './features/credits/WalletProvider.jsx'
import DashboardPage from './features/dashboard/DashboardPage.jsx'
import TestLayout from './features/test/TestLayout.jsx'
import QuestionsTab from './features/test/QuestionsTab.jsx'
import CandidatesTab from './features/test/CandidatesTab.jsx'
import ResultsTab from './features/test/ResultsTab.jsx'
import SettingsTab from './features/test/SettingsTab.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
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
            {/* Test makers have an AI credit wallet (the balance streams in;
                candidates never load one). */}
            <Route
              element={
                <WalletProvider>
                  <Outlet />
                </WalletProvider>
              }
            >
              <Route element={<RequireVerified />}>
              <Route element={<AppShell search />}>
                <Route index element={<DashboardPage />} />
              </Route>
              <Route path="/tests/:testId" element={<TestLayout />}>
                <Route index element={<Navigate to="questions" replace />} />
                <Route path="questions" element={<QuestionsTab />} />
                <Route path="candidates" element={<CandidatesTab />} />
                <Route path="results" element={<ResultsTab />} />
                <Route path="settings" element={<SettingsTab />} />
              </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
