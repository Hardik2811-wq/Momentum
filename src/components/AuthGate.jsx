import React, { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import TimezoneSelect from './TimezoneSelect';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured || session === undefined) return isSupabaseConfigured ? null : children;
  if (session) return children;

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setMessage('');
    setPassword('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const redirectTo = window.location.origin;
    let error;

    if (mode === 'signup') {
      const metadata = {
        full_name: fullName.trim(),
        name: fullName.trim(),
        role: role.trim(),
        timezone: timezone.trim()
      };
      ({ error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: metadata
        }
      }));
      setMessage(error ? error.message : 'Account created. Check your email to confirm it.');
    } else if (mode === 'login') {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
      if (error) setMessage(error.message);
    } else {
      ({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo }));
      setMessage(error ? error.message : 'Password reset link sent. Check your email.');
    }
    setBusy(false);
  };

  const title = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Log in';
  const action = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Log in';

  return (
    <main className="min-h-screen bg-[#f4f5f7] flex items-center justify-center p-5">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl border border-black/5 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#0A84FF]">Momentum</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#202a33]">{title}</h1>
          {mode === 'signup' && <p className="mt-1 text-xs text-[#666]">Set up your personal operator profile to begin.</p>}
          {mode === 'reset' && <p className="mt-1 text-xs text-[#666]">Enter your email for a password-reset link.</p>}
        </div>

        {mode === 'signup' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-[#202a33]">Your Name
                <input
                  required
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="e.g. Alex River"
                  className="mt-1 w-full rounded-lg border border-black/20 px-3 py-2 text-xs outline-none focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/20"
                />
              </label>

              <label className="block text-xs font-semibold text-[#202a33]">Role / Title
                <input
                  type="text"
                  autoComplete="organization-title"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  placeholder="e.g. Product Lead"
                  className="mt-1 w-full rounded-lg border border-black/20 px-3 py-2 text-xs outline-none focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/20"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202a33] mb-1">Timezone</label>
              <TimezoneSelect
                value={timezone}
                onChange={setTimezone}
              />
            </div>
          </>
        )}

        <label className="block text-xs font-semibold text-[#202a33]">Email
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-1 w-full rounded-lg border border-black/20 px-3 py-2.5 text-xs outline-none focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/20" />
        </label>

        {mode !== 'reset' && (
          <label className="block text-xs font-semibold text-[#202a33]">Password
            <input required minLength="6" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-black/20 px-3 py-2.5 text-xs outline-none focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/20" />
          </label>
        )}
        {mode === 'login' && <button type="button" onClick={() => switchMode('reset')} className="-mt-2 block text-sm font-medium text-[#0879cf] hover:underline">Forgot your password?</button>}
        <button disabled={busy} className="w-full rounded-lg bg-[#147db6] py-3 text-sm font-bold text-white hover:bg-[#0d6da4] disabled:opacity-60">{busy ? 'Please wait…' : action}</button>
        {message && <p className="rounded-lg bg-[#eef7ff] p-3 text-sm text-[#24536e]">{message}</p>}
        <p className="text-center text-sm text-[#555]">
          {mode === 'signup' ? 'Already have an account? ' : mode === 'login' ? 'No account? ' : 'Remembered your password? '}
          <button type="button" onClick={() => switchMode(mode === 'signup' ? 'login' : mode === 'login' ? 'signup' : 'login')} className="font-semibold text-[#0879cf] hover:underline">{mode === 'signup' ? 'Log in' : mode === 'login' ? 'Sign up' : 'Log in'}</button>
        </p>
      </form>
    </main>
  );
}
