import React, { useEffect, useState } from 'react';
import { deleteByokKey, getByokStatus, hasAiService, saveByokKey } from '../lib/groqClient';

export default function ApiKeyModal({ isOpen, onClose, onSuccess }) {
  const [apiKey, setApiKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setApiKey('');
    setError('');
    setConfigured(false);
    if (!hasAiService()) return;
    let active = true;
    getByokStatus().then((result) => {
      if (!active) return;
      if (result.success) setConfigured(Boolean(result.configured));
      else setError(result.error || 'Could not read BYOK status.');
    });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const save = async (event) => {
    event.preventDefault();
    const key = apiKey.trim();
    if (!/^gsk_[A-Za-z0-9_-]{20,}$/.test(key)) {
      setError('Enter a valid Groq API key.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await saveByokKey(key);
    setApiKey('');
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Could not save BYOK key.');
      return;
    }
    setConfigured(true);
    onSuccess?.();
    onClose();
  };

  const remove = async () => {
    setLoading(true);
    setError('');
    const result = await deleteByokKey();
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Could not remove BYOK key.');
      return;
    }
    setConfigured(false);
  };

  const unavailable = !hasAiService();
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="byok-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-black/[0.08] space-y-4 animate-scaleUp" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-200/60 flex items-center justify-center text-violet-600">
              <span className="material-symbols-outlined text-[18px]">key</span>
            </div>
            <div>
              <h2 id="byok-title" className="text-[15px] font-bold text-[#1A1B1F] tracking-tight">Secure Groq BYOK</h2>
              <p className="text-[11px] text-[#64748B]">Your key. Encrypted server storage.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"><span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>

        <div className="p-3 bg-emerald-50 border border-emerald-200/70 rounded-xl text-[11px] text-emerald-900 leading-relaxed">
          Key sends once over TLS for validation and encryption. Browser never saves it. Database stores AES-256-GCM ciphertext only. Key decrypts only inside authenticated AI request.
        </div>

        {unavailable ? (
          <p className="text-[12px] leading-5 text-rose-700">Secure BYOK service is not configured. Deploy Edge Functions and server secrets first.</p>
        ) : (
          <form onSubmit={save} autoComplete="off" className="space-y-3">
            {configured && <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800"><span>BYOK key configured.</span><button type="button" disabled={loading} onClick={remove} className="font-bold text-rose-700 hover:text-rose-900 disabled:opacity-50">Remove</button></div>}
            <div>
              <label htmlFor="byok-key" className="block text-[11px] font-semibold text-[#1A1B1F] mb-1">{configured ? 'Replace Groq API key' : 'Groq API key'}</label>
              <input id="byok-key" type="password" required autoFocus autoComplete="off" spellCheck="false" data-1p-ignore="true" data-lpignore="true" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setError(''); }} placeholder="gsk_..." className="w-full px-3 py-2 text-[12px] font-mono rounded-xl border border-black/[0.1] bg-[#F5F4FA] focus:bg-white focus:border-[#0A84FF] outline-none transition" />
            </div>
            {error && <p className="text-[11px] text-rose-700">{error}</p>}
            <div className="flex items-center justify-between pt-2 border-t border-black/[0.05]">
              <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#0A84FF] font-semibold hover:underline">Get Groq key</a>
              <div className="flex gap-2"><button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-xl text-[12px] font-medium text-slate-600 hover:bg-slate-100">Cancel</button><button type="submit" disabled={loading || !apiKey.trim()} className="px-4 py-1.5 rounded-xl text-[12px] font-semibold bg-[#0A84FF] text-white hover:bg-[#0071E3] disabled:opacity-50">{loading ? 'Securing…' : configured ? 'Replace key' : 'Secure key'}</button></div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
