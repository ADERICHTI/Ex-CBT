import { Outlet, useLocation } from 'react-router-dom';
import './App.css';

function App({ children }) {
  const location = useLocation();
  // The attempt screen brings its own header, so it runs without the
  // navbar/footer chrome and gets the full window.
  const isFullScreen = /^\/test\/[^/]+\/attempt$/.test(location.pathname);

  return (
    <div id="app-container" className={isFullScreen ? 'test-mode' : ''}>
      {!isFullScreen && (
        <nav className="mn-navbar">
          <span className="mn-logo">ex-cbt</span>
        </nav>
      )}

      <div id="pagesWrap">
        {children ?? <Outlet />}
      </div>

      {!isFullScreen && (
        <footer className="mn-footer">&copy; 2026 ex-cbt</footer>
      )}
    </div>
  );
}

export default App;
