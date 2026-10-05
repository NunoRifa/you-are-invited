import React, { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useTurnstile } from '../../features/turnstile/use-turnstile.js';

export const AdminLogin: React.FC<{ returnTo: string; onLogin: () => void }> = ({ returnTo, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const turnstile = useTurnstile('admin-login');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      // Acquire a fresh single-use Turnstile token before hitting the API.
      // When the gate is disabled this resolves to '' and the server no-ops.
      const turnstileToken = await turnstile.getToken();
      const response = await fetch('/api/admin/login', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      if (!response.ok) {
        // A Turnstile token is single-use; discard it so the next attempt is fresh.
        turnstile.reset();
        if (response.status === 401) throw new Error('Email atau password salah.');
        if (response.status === 400 || response.status === 403 || response.status === 503) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Verifikasi keamanan gagal. Silakan coba lagi.');
        }
        throw new Error('Login gagal. Coba lagi.');
      }
      setPassword('');
      onLogin();
      window.history.replaceState({}, '', returnTo);
    } catch (cause) {
      turnstile.reset();
      setError(cause instanceof Error ? cause.message : 'Login gagal.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="grid min-h-screen place-items-center bg-stone-100 p-5 text-stone-900">
    <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-900"><LockKeyhole size={20}/></div>
      <div><h1 className="font-serif text-2xl font-semibold">Login Admin</h1><p className="mt-1 text-sm text-stone-600">Masuk untuk mengelola data undangan.</p></div>
      <label className="block text-sm font-medium">Email<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100"/></label>
      <label className="block text-sm font-medium">Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100"/></label>
      <div ref={turnstile.containerRef} aria-hidden="true" />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy || (turnstile.enabled && !turnstile.ready)} className="w-full rounded-lg bg-amber-800 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-60">{busy ? 'Memeriksa…' : 'Masuk'}</button>
    </form>
  </main>;
};
