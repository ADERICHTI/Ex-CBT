import { Outlet, useLocation } from 'react-router-dom';
import './App.css';

function App({ children }) {
  const location = useLocation();
  // Full-screen (no marketing sidebar) for the test-taking flow itself
  // (/test/:testId and /test/:testId/attempt, each of which brings its own
  // layout) but not /test/:testId/submitted, which keeps the branded panel
  // like the sign-in screen does.
  const isFullScreen = /^\/test\/[^/]+(\/attempt)?$/.test(location.pathname);

  return (
    <div id="app-container" className={isFullScreen ? 'test-mode' : ''}>
      <aside id="brandPanel">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <span className="text-lg font-bold tracking-tight">Examiner</span>
        </div>

        <div className="relative z-10">
          <h2 className="text-4xl font-extrabold leading-tight mb-4">Test smarter,<br />not harder.</h2>
          <p className="text-blue-100/90 text-sm leading-relaxed max-w-xs">
            A focused, distraction-free environment for taking your assessments online — built for accuracy and speed.
          </p>

          <ul className="mt-10 space-y-4">
            <li className="flex items-center gap-3 text-sm text-blue-50">
              <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm"><i className="fa-solid fa-bolt"></i></span>
              Instant, secure access to your tests
            </li>
            <li className="flex items-center gap-3 text-sm text-blue-50">
              <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm"><i className="fa-solid fa-shield-halved"></i></span>
              Secure, single-attempt exams
            </li>
            <li className="flex items-center gap-3 text-sm text-blue-50">
              <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm"><i className="fa-solid fa-chart-line"></i></span>
              Clear results
            </li>
          </ul>
        </div>

        <p className="relative z-10 text-xs text-blue-100/70">&copy; 2026 Examiner. All rights reserved.</p>
      </aside>

      <div id="pagesWrap">
        {children ?? <Outlet />}
      </div>
    </div>
  );
}

export default App;
