import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleProvider } from '../utility/config';
import { upsertUser } from '../services/firestore';

const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn';

function friendlyAuthError(err) {
  switch (err?.code) {
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try logging in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsEmailForLink, setNeedsEmailForLink] = useState(
    () =>
      isSignInWithEmailLink(auth, window.location.href) &&
      !window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)
  );
  const [linkEmail, setLinkEmail] = useState('');

  function buildEmailLinkUrl() {
    const url = new URL('/', window.location.origin);
    const redirect = searchParams.get('redirect');
    if (redirect) url.searchParams.set('redirect', redirect);
    return url.toString();
  }

  async function finishSignIn(user) {
    await upsertUser(user.email, {
      displayName: user.displayName,
      photoURL: user.photoURL,
    });

    navigate(searchParams.get('redirect') || '/');
  }

  async function completeEmailLinkSignIn(emailToUse) {
    setError('');
    setBusy(true);
    try {
      const { user } = await signInWithEmailLink(auth, emailToUse, window.location.href);
      window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
      await finishSignIn(user);
    } catch {
      setError('That sign-in link is invalid or has expired.');
      setNeedsEmailForLink(false);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const storedEmail = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
    if (storedEmail) {
      queueMicrotask(() => completeEmailLinkSignIn(storedEmail));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to consume the sign-in link
  }, []);

  async function handleConfirmLinkEmail(e) {
    e.preventDefault();
    if (!linkEmail.trim()) return;
    completeEmailLinkSignIn(linkEmail.trim());
  }

  async function handleGoogleSignIn() {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      await finishSignIn(user);
    } catch {
      setError('Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { user } =
        mode === 'signup'
          ? await createUserWithEmailAndPassword(auth, email.trim(), password)
          : await signInWithEmailAndPassword(auth, email.trim(), password);
      await finishSignIn(user);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendEmailLink() {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Enter your email above first.');
      return;
    }

    setBusy(true);
    try {
      await sendSignInLinkToEmail(auth, email.trim(), {
        url: buildEmailLinkUrl(),
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email.trim());
      setInfo('Check your email for a sign-in link.');
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  if (needsEmailForLink) {
    return (
      <div id="page-login" className="page active items-center justify-center relative">
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="mb-10 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 text-2xl font-bold mx-auto mb-4 shadow-lg shadow-blue-50">
              <i className="fa-solid fa-envelope"></i>
            </div>
            <h1 className="text-3xl font-bold text-slate-800">Confirm your email</h1>
            <p className="text-slate-500 text-sm mt-1">
              Enter the email you used to request this sign-in link.
            </p>
          </div>

          <form onSubmit={handleConfirmLinkEmail} className="space-y-4">
            <input
              type="email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-slate-700"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? 'Signing in…' : 'Continue'}
            </button>
          </form>

          {error && <p className="text-sm text-red-500 text-center mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div id="page-login" className="page active items-center justify-center relative">
      <div className="absolute top-6 left-6 flex items-center gap-2 lg:hidden">
        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 text-sm">
          <i className="fa-solid fa-graduation-cap"></i>
        </div>
        <span className="text-sm font-bold tracking-tight text-slate-800">Examiner</span>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 text-2xl font-bold mx-auto mb-4 shadow-lg shadow-blue-50">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {mode === 'signup' ? 'Sign up to get started.' : 'Sign in to continue.'}
          </p>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setInfo('');
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError('');
              setInfo('');
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'signup' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-slate-700"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-slate-700"
            required
            minLength={6}
          />
          {mode === 'signup' && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-slate-700"
              required
              minLength={6}
            />
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>

        {mode === 'login' && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-slate-400">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy}
                className="w-full py-3 border border-gray-200 rounded-xl flex justify-center items-center gap-2 hover:bg-gray-50 transition-colors text-slate-600 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <i className="fa-brands fa-google text-red-500"></i> Continue with Google
              </button>
              <button
                type="button"
                onClick={handleSendEmailLink}
                disabled={busy}
                className="w-full py-3 border border-gray-200 rounded-xl flex justify-center items-center gap-2 hover:bg-gray-50 transition-colors text-slate-600 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-link text-blue-500"></i> Email me a sign-in link
              </button>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-500 text-center mt-4">{error}</p>}
        {info && <p className="text-sm text-green-600 text-center mt-4">{info}</p>}
      </div>
    </div>
  );
}
