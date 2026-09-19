import { useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useTestSession } from '../hooks/useTestSession';
import { getSubmission, getTest, submitTestAttempt } from '../services/firestore';
import LoadingScreen from '../components/LoadingScreen';

export default function TestInterface() {
  const toast = useToast();
  // The "sid" URL param holds the attempt/submission doc id (the normalized
  // student id), set by StartTest.jsx when it creates the attempt.
  const { testId, studentId: attemptId, goTo } = useTestSession();

  const [status, setStatus] = useState('loading'); // loading | blocked | ready
  const [test, setTest] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef(null);

  const [leaveCountdown, setLeaveCountdown] = useState(null);
  const leaveIntervalRef = useRef(null);

  // Timers/listeners set up once must always call the LATEST handleSubmit
  // (fresh userAnswers), not the one closed over when they were created.
  const handleSubmitRef = useRef(() => {});
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!testId || !attemptId) {
        goTo('', {}, { replace: true });
        return;
      }

      const [foundTest, attempt] = await Promise.all([
        getTest(testId),
        getSubmission(testId, attemptId),
      ]);
      if (cancelled) return;

      if (!foundTest || foundTest.active === false) {
        goTo('', {}, { replace: true });
        return;
      }
      if (!attempt) {
        // No active attempt for this student id - they didn't come through StartTest.
        goTo('', {}, { replace: true });
        return;
      }
      if (attempt.testTaken) {
        goTo('submitted', {}, { replace: true, state: { reason: 'already-taken' } });
        return;
      }

      setTest(foundTest);
      setTimeRemaining(foundTest.minutes * 60);
      setStatus('ready');
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, attemptId]);

  useEffect(() => {
    if (status !== 'ready') return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleSubmitRef.current();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [status]);

  // Strict mode: leaving the tab or exiting fullscreen starts a 3-second
  // countdown that auto-submits unless the student returns in time.
  useEffect(() => {
    if (status !== 'ready' || !test?.strictMode) return;

    function startCountdown() {
      if (leaveIntervalRef.current) return;
      setLeaveCountdown(3);
      leaveIntervalRef.current = setInterval(() => {
        setLeaveCountdown((n) => {
          if (n <= 1) {
            clearInterval(leaveIntervalRef.current);
            leaveIntervalRef.current = null;
            handleSubmitRef.current();
            return null;
          }
          return n - 1;
        });
      }, 1000);
    }

    function cancelCountdown() {
      if (leaveIntervalRef.current) {
        clearInterval(leaveIntervalRef.current);
        leaveIntervalRef.current = null;
      }
      setLeaveCountdown(null);
    }

    function handleVisibilityChange() {
      if (document.hidden) startCountdown();
      else cancelCountdown();
    }

    function handleFullscreenChange() {
      if (!document.fullscreenElement) startCountdown();
      else cancelCountdown();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      cancelCountdown();
    };
  }, [status, test?.strictMode]);

  if (status !== 'ready') return <LoadingScreen />;

  const questions = test.questions;

  // Grading itself happens server-side (functions/index.js submitTest) so the
  // answer key never reaches this browser - this just hands off the
  // student's raw picks, index-aligned with `questions`.
  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    clearInterval(timerRef.current);
    try {
      const answers = questions.map((_, i) => userAnswers[i] ?? null);
      await submitTestAttempt({ testId, attemptId, answers });
      goTo('submitted', {}, { replace: true, state: { reason: 'submitted' } });
    } finally {
      setSubmitting(false);
    }
  }

  function handleExit() {
    setShowExitModal(true);
  }

  function confirmExit() {
    setShowExitModal(false);
    clearInterval(timerRef.current);
    goTo('');
  }

  function selectOption(option) {
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: option }));
  }

  function goNext() {
    if (userAnswers[currentIndex] === undefined) {
      toast.warning('Please select an option before proceeding.');
      return;
    }
    if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1);
  }

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  const question = questions[currentIndex];
  const answeredCount = Object.keys(userAnswers).length;
  const progressPct = Math.round((answeredCount / questions.length) * 100);

  const m = Math.floor(timeRemaining / 60);
  const s = timeRemaining % 60;
  const timerClass = timeRemaining <= 120 ? 'danger' : timeRemaining <= 300 ? 'warning' : '';

  return (
    <div id="page-test" className="page active">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          {!test.strictMode && (
            <button onClick={handleExit} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-slate-600 hover:bg-gray-200 transition-colors">
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
          <span className="text-sm font-bold text-slate-700">{test.displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`test-timer ${timerClass}`}>
            <i className="fa-regular fa-clock"></i> <span>{m}:{s < 10 ? '0' : ''}{s}</span>
          </div>
          <div className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            <span>{currentIndex + 1}</span>/<span>{questions.length}</span>
          </div>
        </div>
      </div>

      <div className="test-progress-track">
        <div className="test-progress-fill" style={{ width: `${progressPct}%` }}></div>
      </div>

      <div id="questionArea" className="flex-1 flex flex-col bg-gray-50 rounded-2xl p-5 mb-4 relative">
        <h3 id="questionText" className="text-lg font-bold text-slate-800 leading-relaxed mb-6">{question.question}</h3>

        <div id="optionsContainer" className="space-y-2 flex-1">
          {question.options.map((opt, index) => {
            const selected = userAnswers[currentIndex] === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => selectOption(opt)}
                className={`option-btn ${selected ? 'selected' : ''}`}
              >
                <span className="option-badge w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-slate-500 flex-shrink-0">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        <div id="questionNav">
          <h4 className="question-nav-title">Questions</h4>
          <div className="question-nav-grid">
            {questions.map((_, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = userAnswers[idx] !== undefined;
              return (
                <button
                  key={idx}
                  type="button"
                  className={`question-nav-btn ${isCurrent ? 'current' : ''} ${!isCurrent && isAnswered ? 'answered' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {showModal && (
          <div className="absolute inset-0 bg-black/5 backdrop-blur-sm rounded-2xl z-20 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl mx-auto mb-3">
                <i className="fa-regular fa-clock"></i>
              </div>
              <h4 className="text-center font-bold text-slate-800 text-lg">Submit Exam?</h4>
              <p className="text-center text-sm text-slate-500 mb-6">Are you sure you want to submit? You cannot retake this test.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-slate-600 font-medium hover:bg-gray-50">No</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium shadow-md shadow-blue-200 hover:bg-blue-700 disabled:opacity-60">
                  {submitting ? 'Submitting…' : 'Yes, Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showExitModal && (
          <div className="absolute inset-0 bg-black/5 backdrop-blur-sm rounded-2xl z-20 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-xl mx-auto mb-3">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h4 className="text-center font-bold text-slate-800 text-lg">Exit Test?</h4>
              <p className="text-center text-sm text-slate-500 mb-6">Are you sure you want to exit? Your progress will be lost.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowExitModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-slate-600 font-medium hover:bg-gray-50">No</button>
                <button onClick={confirmExit} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-medium shadow-md shadow-amber-200 hover:bg-amber-600">
                  Yes, Exit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={goPrev} disabled={currentIndex === 0} className="flex-1 py-3 border border-gray-200 rounded-xl text-slate-600 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white">
          <i className="fa-solid fa-chevron-left mr-2"></i> Previous
        </button>
        <button onClick={goNext} disabled={currentIndex === questions.length - 1} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium shadow-md shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 disabled:cursor-not-allowed">
          Next <i className="fa-solid fa-chevron-right ml-2"></i>
        </button>
        <button onClick={() => setShowModal(true)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-medium shadow-md hover:bg-slate-900">
          Submit <i className="fa-regular fa-paper-plane ml-2"></i>
        </button>
      </div>

      {leaveCountdown !== null && (
        <div className="fixed inset-0 bg-[#C5221F] z-50 flex items-center justify-center p-6 text-center">
          <div className="text-white">
            <i className="fa-solid fa-triangle-exclamation text-4xl mb-4"></i>
            <h2 className="text-2xl font-bold mb-2">You left the test</h2>
            <p className="text-white/90 mb-6">Return now or it will auto-submit in</p>
            <div className="text-6xl font-extrabold tabular-nums">{leaveCountdown}</div>
          </div>
        </div>
      )}
    </div>
  );
}
