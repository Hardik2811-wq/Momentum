import React, { useEffect, useState } from 'react';
import {
  deleteByokKey,
  detectAiProvider,
  getAiProviderLabel,
  getByokStatus,
  hasAiService,
  saveByokKey
} from '../lib/groqClient';

export default function ApiKeyModal({ isOpen, onClose, onSuccess }) {
  const [apiKey, setApiKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [activeProviderLabel, setActiveProviderLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setApiKey('');
    setError('');
    setConfigured(false);
    setActiveProviderLabel('');
    if (!hasAiService()) return;
    let active = true;
    getByokStatus().then((result) => {
      if (!active) return;
      if (result.success) {
        setConfigured(Boolean(result.configured));
        setActiveProviderLabel(result.providerLabel || '');
      } else {
        setError(result.error || 'Could not read BYOK status.');
      }
    });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const detectedProvider = detectAiProvider(apiKey);

  const save = async (event) => {
    event.preventDefault();
    const key = apiKey.trim();
    if (!detectAiProvider(key)) {
      setError('Enter a valid key: Gemini (AIza...), Groq (gsk_...), or OpenRouter (sk-or-...).');
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
    setActiveProviderLabel(result.providerLabel || '');
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
    setActiveProviderLabel('');
  };

  const unavailable = !hasAiService();
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="byok-title">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1A1A1E] p-5 sm:p-6 shadow-2xl border border-black/[0.08] dark:border-white/[0.08] space-y-4 animate-scaleUp" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 flex items-center justify-center text-violet-600 dark:text-violet-300">
              <span className="material-symbols-outlined text-[18px]">key</span>
            </div>
            <div>
              <h2 id="byok-title" className="text-[15px] font-bold text-[#1A1B1F] dark:text-[#F7F6F2] tracking-tight">Multi-Engine AI Key (BYOK)</h2>
              <p className="text-[11px] text-[#64748B] dark:text-[#8E8E93]">Auto-detects Google Gemini 2.5, Groq LPU, or OpenRouter.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition"><span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>

        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 rounded-xl text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed space-y-1">
          <p className="font-semibold">Recommended: Google Gemini 2.5 Flash (`AIza...`) — Free 1M context</p>
          <p className="text-emerald-800/80 dark:text-emerald-300/80">Also supports Groq (`gsk_...` with Kimi-K2 &amp; GPT-OSS-120B) and OpenRouter (`sk-or-...` for Claude 3.7).</p>
        </div>

        {unavailable ? (
          <p className="text-[12px] leading-5 text-rose-700">AI service unavailable.</p>
        ) : (
          <form onSubmit={save} autoComplete="off" className="space-y-3">
            {configured && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                <span>Active: <strong>{activeProviderLabel || 'Configured'}</strong></span>
                <button type="button" disabled={loading} onClick={remove} className="font-bold text-rose-600 hover:text-rose-800 disabled:opacity-50">Remove</button>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="byok-key" className="block text-[11px] font-semibold text-[#1A1B1F] dark:text-[#F7F6F2]">
                  {configured ? 'Replace API Key' : 'Paste API Key'}
                </label>
                {detectedProvider && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#0A84FF] border border-blue-200/60 dark:border-blue-800/40">
                    Detected: {getAiProviderLabel(detectedProvider)}
                  </span>
                )}
              </div>
              <input
                id="byok-key"
                type="password"
                required
                autoFocus
                autoComplete="off"
                spellCheck="false"
                data-1p-ignore="true"
                data-lpignore="true"
                value={apiKey}
                onChange={(event) => { setApiKey(event.target.value); setError(''); }}
                placeholder="AIza... (Gemini) or gsk_... (Groq) or sk-or-... (OpenRouter)"
                className="w-full px-3 py-2 text-[12px] font-mono rounded-xl border border-black/[0.1] dark:border-white/[0.1] bg-[#F5F4FA] dark:bg-[#202024] text-[#1A1B1F] dark:text-[#F7F6F2] focus:bg-white dark:focus:bg-[#252529] focus:border-[#0A84FF] outline-none transition"
              />
            </div>
            {error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#0A84FF] font-semibold hover:underline">Get Gemini key (Free)</a>
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hover:underline">Groq key</a>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-xl text-[12px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">Cancel</button>
                <button type="submit" disabled={loading || !apiKey.trim()} className="px-4 py-1.5 rounded-xl text-[12px] font-semibold bg-[#0A84FF] text-white hover:bg-[#0071E3] disabled:opacity-50">{loading ? 'Verifying…' : configured ? 'Replace key' : 'Save key'}</button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

