'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, describeApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === 'login'
          ? await api.login(username, password)
          : await api.register(username, email, password);
      useAuthStore.getState().setAuth(res.token, res.user);
      router.push('/lobby');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <form onSubmit={submit} className="panel space-y-4 p-8">
        <h1 className="font-display text-center text-3xl font-bold">
          {mode === 'login' ? 'Welcome back' : 'Join the defense'}
        </h1>
        <div>
          <label className="label">{mode === 'login' ? 'Username or email' : 'Username'}</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={mode === 'login' ? 255 : 24}
          />
        </div>
        {mode === 'register' && (
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        )}
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 8 : 1}
          />
          {mode === 'register' && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
        </div>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <p className="text-center text-sm text-slate-400">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <Link href="/register" className="text-amber-300 hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Have an account?{' '}
              <Link href="/login" className="text-amber-300 hover:underline">
                Log in
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
