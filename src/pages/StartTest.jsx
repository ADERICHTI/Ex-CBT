import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTestSession } from '../hooks/useTestSession';
import { getTest, hasUserTakenTest, startTestAttempt } from '../services/firestore';
import LoadingScreen from '../components/LoadingScreen';

export default function StartTest() {
  const { user } = useAuth();
  const { testId, goTo } = useTestSession();

  const [status, setStatus] = useState('loading'); // loading | no-id | expired | ready
  const [test, setTest] = useState(null);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [beginError, setBeginError] = useState('');
  const [beginning, setBeginning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const found = await getTest(testId);
      if (cancelled) return;

      if (!found || found.active === false) {
        setStatus('expired');
        return;
      }

      const alreadyTaken = await hasUserTakenTest(user.email, testId);
      if (cancelled) return;

      if (alreadyTaken) {
        goTo('submitted', {}, { replace: true, state: { reason: 'already-taken' } });
        return;
      }

      setTest(found);
      setStatus('ready');
    }

    if (testId) {
      load();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no id to fetch, nothing async to wait on
      setStatus('no-id');
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, user.email]);

  const totalFields = 2;
  const filledFields = [name, studentId].filter((v) => v.trim() !== '').length;
  const progress = (filledFields / totalFields) * 100;

  // The very first Cloud Function call right after sign-in can occasionally
  // race the auth token attaching to the Functions client, getting rejected
  // as unauthenticated even though the user is genuinely signed in - force a
  // fresh token and retry once before surfacing an error.
  async function startAttemptWithRetry() {
    try {
      return await startTestAttempt(testId, name.trim(), studentId.trim());
    } catch (err) {
      if (err?.code !== 'functions/unauthenticated') throw err;
      await user.getIdToken(true);
      return await startTestAttempt(testId, name.trim(), studentId.trim());
    }
  }

  async function handleBegin() {
    if (!name.trim() || !studentId.trim()) {
      setBeginError('Please fill in both your Name and Student ID to begin.');
      return;
    }

    setBeginError('');
    setBeginning(true);
    try {
      const attemptId = await startAttemptWithRetry();

      if (test.strictMode && document.documentElement.requestFullscreen) {
        // Best-effort: must be requested inside this click handler (a real user
        // gesture) - browsers reject it if called later from an effect.
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // Fullscreen denied/unsupported - proceed anyway, the tab/visibility
          // detection in TestInterface still enforces strict mode.
        }
      }

      goTo('attempt', { sid: attemptId });
    } catch (err) {
      console.error('Failed to start test attempt:', err);
      if (err?.code === 'functions/already-exists') {
        goTo('submitted', {}, { replace: true, state: { reason: 'already-taken' } });
        return;
      }
      setBeginError(
        err?.code === 'functions/permission-denied'
          ? "You're not on the approved list for this test. Check your name and Student ID, or contact your instructor."
          : `Something went wrong starting the test${err?.code ? ` (${err.code})` : ''}. Please try again.`
      );
    } finally {
      setBeginning(false);
    }
  }

  if (status === 'loading') return <LoadingScreen />;

  if (status === 'expired') {
    return (
      <div id="page-start-invalid" className="page active items-center justify-center text-center">
        <div className="max-w-sm">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-4xl mx-auto mb-6">
            <i className="fa-solid fa-hourglass-end"></i>
          </div>
          <h2 className="text-2xl font-bold text-[#1F1F1F] mb-2">This Link Has Expired</h2>
          <p className="text-[#00000080] text-sm leading-relaxed">
            The test link "<span className="font-mono text-[#000000b3]">{testId}</span>" is no longer available. It may have been closed by your instructor or never existed. Please request a current link.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'no-id') {
    return (
      <div id="page-start-invalid" className="page active items-center justify-center text-center">
        <div className="max-w-sm">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-4xl mx-auto mb-6">
            <i className="fa-solid fa-link-slash"></i>
          </div>
          <h2 className="text-2xl font-bold text-[#1F1F1F] mb-2">No Test Found</h2>
          <p className="text-[#00000080] text-sm leading-relaxed">
            No test ID was specified. Please use the link provided by your instructor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="page-start" className="page active">
      <div id="startLayout">
        <div id="startInfo" className="start-info">
          <h3 className="text-2xl font-bold text-[#1F1F1F] mb-1">{test.displayName}</h3>
          <p className="text-sm text-[#00000066] mb-4">{test.questions.length} Questions • {test.minutes} Minutes</p>
          <p className="text-sm text-[#00000099] leading-relaxed max-w-sm mx-auto">
            Read each question carefully and select the best answer. Keep this tab focused and submit when you're confident — this test can only be taken once.
          </p>
        </div>

        <div id="startFormCard">
          <div className="test-progress-track mb-6">
            <div className="test-progress-fill" style={{ width: `${progress}%` }}></div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-[#000000b3] mb-1">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Enter your full name" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#000000b3] mb-1">Student ID</label>
              <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input-field" placeholder="Enter your Student ID" required />
            </div>
          </div>

          {beginError && <p className="text-sm text-red-500 mb-4">{beginError}</p>}

          <button onClick={handleBegin} disabled={beginning} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
            {beginning ? 'Starting…' : 'Begin Test'} <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
