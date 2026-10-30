import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, LogOut, Send, TriangleAlert, X } from 'lucide-react';
import { useTestSession } from '../../hooks/useTestSession';
import { getSubmission, getTest, submitTestAttempt } from '../../services/firestore';
import Spinner from '../../lib/Spinner.jsx';
import ConfirmModal from '../../lib/ConfirmModal.jsx';
import LogoMark from '../../lib/LogoMark.jsx';
import { useToast } from '../../lib/useToast.jsx';
import './take.css';

export default function TestInterface() {
  const [toast, showToast] = useToast();
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
  const [submitError, setSubmitError] = useState('');
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

      // A test closed mid-attempt can still be finished (see the Close dialog).
      if (!foundTest || foundTest.status === 'draft') {
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

  if (status !== 'ready') return <Spinner fill="page" label="Loading your test" />;

  const questions = test.questions;

  // Grading itself happens server-side (functions/index.js submitTest) so the
  // answer key never reaches this browser - this just hands off the
  // student's raw picks, index-aligned with `questions`.
  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    clearInterval(timerRef.current);
    try {
      const answers = questions.map((_, i) => userAnswers[i] ?? null);
      await submitTestAttempt({ testId, attemptId, answers });
      goTo('submitted', {}, { replace: true, state: { reason: 'submitted' } });
    } catch (err) {
      // Never leave a candidate guessing: say what happened and let them retry.
      console.error('Failed to submit test:', err);
      setShowModal(false);
      setSubmitError(
        err?.code === 'functions/failed-precondition'
          ? 'This test was already submitted.'
          : 'Your answers couldn’t be sent. Check your connection and press Submit again - nothing is lost.'
      );
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
      showToast('Choose an answer first, or use the question numbers to skip.');
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
  const timerClass = timeRemaining <= 120 ? ' danger' : timeRemaining <= 300 ? ' warning' : '';

  const answered = (i) => userAnswers[i] !== undefined;

  return (
    <div className="attempt">
      <header className="attempt-bar">
        <div className="attempt-title">
          {!test.strictMode && (
            <button type="button" className="icon-btn" onClick={handleExit} aria-label="Leave test" title="Leave test">
              <X size={18} />
            </button>
          )}
          <LogoMark size={22} />
          <span>{test.displayName}</span>
        </div>
        <div className="attempt-stats">
          <span className={`attempt-timer${timerClass}`} role="timer" aria-label="Time left">
            <Clock size={15} /> {m}:{s < 10 ? '0' : ''}{s}
          </span>
          <span className="attempt-count">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </header>

      <div className="take-progress attempt-progress" aria-label={`${answeredCount} of ${questions.length} answered`}>
        <div className="take-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="attempt-main">
        <section className="take-card attempt-question">
          <p className="attempt-qnum">Question {currentIndex + 1}</p>
          <h1 className="attempt-qtext">{question.question}</h1>

          <div className="attempt-options" role="radiogroup" aria-label={`Question ${currentIndex + 1} answers`}>
            {question.options.map((option, i) => {
              const selected = userAnswers[currentIndex] === option;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`option${selected ? ' selected' : ''}`}
                  onClick={() => selectOption(option)}
                >
                  <span className="option-badge">{String.fromCharCode(65 + i)}</span>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>

          {submitError && (
            <p className="form-error" role="alert">
              {submitError}
            </p>
          )}

          <div className="attempt-actions">
            <button type="button" className="btn btn-outline" onClick={goPrev} disabled={currentIndex === 0}>
              <ChevronLeft size={18} /> Previous
            </button>
            {currentIndex < questions.length - 1 && (
              <button type="button" className="btn btn-primary" onClick={goNext}>
                Next <ChevronRight size={18} />
              </button>
            )}
            <button type="button" className="btn btn-dark" onClick={() => setShowModal(true)} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'} <Send size={16} />
            </button>
          </div>
        </section>

        <nav className="take-card attempt-nav" aria-label="Questions">
          <p className="attempt-nav-title">Questions</p>
          <div className="attempt-nav-grid">
            {questions.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`qnav${i === currentIndex ? ' current' : answered(i) ? ' answered' : ''}`}
                onClick={() => setCurrentIndex(i)}
                aria-label={`Question ${i + 1}${answered(i) ? ', answered' : ''}`}
                aria-current={i === currentIndex ? 'step' : undefined}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="attempt-nav-key">
            {answeredCount} of {questions.length} answered
          </p>
        </nav>
      </div>

      <ConfirmModal
        open={showModal}
        label="Submit test"
        context={test.displayName}
        icon={Send}
        title="Submit your test?"
        message={
          answeredCount < questions.length
            ? `You’ve answered ${answeredCount} of ${questions.length} questions. You can’t change your answers or retake the test after submitting.`
            : 'You can’t change your answers or retake the test after submitting.'
        }
        confirmLabel="Submit"
        cancelLabel="Keep working"
        tone="primary"
        busy={submitting}
        onConfirm={handleSubmit}
        onCancel={() => setShowModal(false)}
      />
      <ConfirmModal
        open={showExitModal}
        label="Leave test"
        icon={LogOut}
        title="Leave the test?"
        message="Your answers so far won’t be saved."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={confirmExit}
        onCancel={() => setShowExitModal(false)}
      />

      {leaveCountdown !== null && (
        <div className="attempt-leave" role="alertdialog" aria-live="assertive">
          <TriangleAlert size={40} />
          <h2>You left the test</h2>
          <p>Come back now, or it submits automatically in</p>
          <div className="attempt-leave-count">{leaveCountdown}</div>
          {test.strictMode && !document.fullscreenElement && (
            <button
              type="button"
              className="btn attempt-leave-btn"
              onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            >
              Return to full screen
            </button>
          )}
        </div>
      )}

      {toast}
    </div>
  );
}
