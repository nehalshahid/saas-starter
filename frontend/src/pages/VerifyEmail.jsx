import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // verifying | success | error

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    api('/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        {status === 'verifying' && (
          <>
            <div className="text-4xl mb-4 animate-pulse">⏳</div>
            <h1 className="text-xl font-semibold text-slate-900">Verifying your email…</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Email verified!</h1>
            <p className="text-sm text-slate-500 mb-6">Your account is confirmed. You can now sign in.</p>
            <Link
              to="/login"
              className="block bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700"
            >
              Go to sign in
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Verification failed</h1>
            <p className="text-sm text-slate-500 mb-6">
              This link is invalid or has already been used. Try signing in directly — if your
              email is already verified, that'll work fine.
            </p>
            <Link to="/login" className="text-sm text-indigo-600 font-medium hover:underline">
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
