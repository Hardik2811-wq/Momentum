import React, { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured || session === undefined) return isSupabaseConfigured ? null : children;
  if (session) return children;

  const signIn = async (event) => {
    event.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    setMessage(error ? error.message : 'Check your email for a secure sign-in link.');
  };

  return (
    <main className="min-h-screen bg-[#EFEFF5] flex items-center justify-center p-5">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl border border-black/5 space-y-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-[#0A84FF]">Momentum</p><h1 className="mt-2 text-2xl font-bold">Continue securely</h1><p className="mt-2 text-sm text-[#666]">Use email link. No password required.</p></div>
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-black/10 px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#0A84FF]/30" />
        <button className="w-full rounded-xl bg-[#0A84FF] py-2.5 text-sm font-semibold text-white">Send sign-in link</button>
        {message && <p className="text-sm text-[#666]">{message}</p>}
      </form>
    </main>
  );
}
