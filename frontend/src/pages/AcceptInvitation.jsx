import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState('idle'); // idle | accepting | success | error | needsLogin
  const [error, setError] = useState('');

  // If the user is already logged in when they land here, try to accept immediately.
  useEffect(() => {
  if (user && token) {
    if (status === 'idle' || status === 'needsLogin') {
      accept();
    }
  } else if (!user && status === 'idle') {
    setStatus('needsLogin');
  }
}, [user, token]);

  async function accept() {
    setStatus('accepting');
    try {
      const data = await api('/orgs/invitations/accept', { method: 'POST', body: { token } });
      setStatus('success');
      setTimeout(() => navigate('/dashboard'), 2000); // redirect to dashboard
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  // Login form for users who aren't logged in yet
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [mode, setMode] = useState('login'); // login | register

 async function handleAuth(e) {
  e.preventDefault();
  setLoggingIn(true);
  setLoginError('');
  try {
    if (mode === 'register') {
      await api('/auth/register', { method: 'POST', body: { email, password } });
      // After registering, log them in
      await login(email, password);
    } else {
      await login(email, password);
    }
    // useEffect above will fire again now that user is set, triggering accept()
  } catch (err) {
    setLoginError(err.message);
  } finally {
    setLoggingIn(false);
  }
}

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Invalid invitation link</h1>
          <p className="text-sm text-slate-500 mb-4">This link is missing a token.</p>
          <Link to="/" className="text-sm text-indigo-600 font-medium hover:underline">Go home</Link>
        </div>
      </div>
    );
  }

  if (status === 'accepting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <h1 className="text-xl font-semibold text-slate-900">Accepting invitation…</h1>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">You're in!</h1>
          <p className="text-sm text-slate-500">Redirecting you to the dashboard…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Invitation failed</h1>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <p className="text-xs text-slate-400 mb-4">
            Common reasons: the link expired (7 days), was already used, or was sent to a different email address than the one you signed in with.
          </p>
          <Link to="/" className="text-sm text-indigo-600 font-medium hover:underline">Go to dashboard</Link>
        </div>
      </div>
    );
  }

  // needsLogin — show a combined login/register form before accepting
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">✉️</div>
          <h1 className="text-xl font-semibold text-slate-900 mb-1">You've been invited</h1>
          <p className="text-sm text-slate-500">
            Sign in or create an account to accept this invitation and join the organization.
          </p>
        </div>

        <div className="flex rounded-lg border border-slate-200 mb-6 overflow-hidden">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 text-sm py-2 font-medium transition ${mode === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 text-sm py-2 font-medium transition ${mode === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          {loginError && <p className="text-sm text-red-600">{loginError}</p>}

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loggingIn
              ? 'Please wait…'
              : mode === 'login'
              ? 'Sign in & accept invite'
              : 'Create account & accept invite'}
          </button>
        </form>
      </div>
    </div>
  );
}
