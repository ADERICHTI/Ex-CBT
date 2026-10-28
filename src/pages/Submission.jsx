import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTestSession } from '../hooks/useTestSession';
import { hasUserTakenTest } from '../services/firestore';
import LoadingScreen from '../components/LoadingScreen';

export default function Submission() {
  const location = useLocation();
  const { user } = useAuth();
  const { testId, goTo } = useTestSession();
  const reason = location.state?.reason;

  // location.state survives page reloads (it's stored in the browser's
  // History API entry), so it can't be trusted as a "just redirected here"
  // signal - always re-verify against Firestore on mount instead.
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function verify() {
      const taken = testId && (await hasUserTakenTest(user.email, testId));

      if (cancelled) return;

      if (!taken) {
        goTo('', {}, { replace: true });
        return;
      }
      setChecking(false);
    }

    verify();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, user.email]);

  if (checking) return <LoadingScreen />;

  const alreadyTaken = reason === 'already-taken';

  return (
    <div id="page-submitted" className="page active items-center justify-center text-center relative">

      <div className="max-w-sm">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-5xl mx-auto mb-6">
          <i className="fa-solid fa-check"></i>
        </div>
        <h2 className="text-2xl font-bold text-[#1F1F1F] mb-2">
          {alreadyTaken ? 'A Submission Already Exists' : 'Submission Successful!'}
        </h2>
        <p className="text-[#00000080] mb-8 text-sm leading-relaxed">
          {alreadyTaken ? (
            <>A submission has already been made under this ID for {testId ? 'this test' : 'this test link'}.</>
          ) : (
            'Your test has been successfully submitted.'
          )}
          <br /><br />
          <span className="font-semibold text-[#000000b3] text-base">You cannot retake this test again.</span>{' '}
          Please contact your administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
}
