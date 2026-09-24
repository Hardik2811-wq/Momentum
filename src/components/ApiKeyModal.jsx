import React, { useState } from 'react';
import { getGroqApiKey, setGroqApiKey, testGroqConnection } from '../lib/groqClient';

export default function ApiKeyModal({ isOpen, onClose, onSuccess }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [allowForceSave, setAllowForceSave] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e, force = false) => {
    if (e && e.preventDefault) e.preventDefault();
    const clean = apiKey.trim();
    if (!clean) {
      setError('Please paste your Groq API key.');
      return;
    }
    if (!clean.startsWith('gsk_')) {
      setError('Invalid format. Groq API keys start with "gsk_".');
      return;
    }

    if (!force) {
      setIsTesting(true);
      setError('');
      const testRes = await testGroqConnection(clean);
      setIsTesting(false);

      if (!testRes.success) {
        setError(`Verification failed: ${testRes.error}. Double check your key or console.groq.com status.`);
        setAllowForceSave(true);
        return;
      }
    }

    setGroqApiKey(clean);
    onSuccess?.(clean);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-black/[0.08] space-y-4 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-200/60 flex items-center justify-center text-violet-600">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#1A1B1F] tracking-tight">Groq API Key Required</h2>
              <p className="text-[11px] text-[#64748B]">Bring Your Own Key (BYOK) for Instant AI Breakdown</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-amber-800 text-[11px] font-bold">
            <span className="material-symbols-outlined text-[14px]">shield</span>
            <span>Private & Free Forever</span>
          </div>
          <p className="text-[11px] text-amber-900/80 leading-relaxed">
            Groq provides generous free tier credits with ultra-fast inference (~500 tokens/sec). Your key is stored securely in your local browser storage and never shared.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#1A1B1F] mb-1">
              Groq API Key
            </label>
            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                required
                autoFocus
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError('');
                }}
                placeholder="gsk_..."
                className="w-full px-3 py-2 pr-10 text-[12px] font-mono rounded-xl border border-black/[0.1] bg-[#F5F4FA] focus:bg-white focus:border-[#0A84FF] outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 text-slate-400 hover:text-slate-700 text-[14px]"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {showKey ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0A84FF] font-semibold hover:underline inline-flex items-center gap-1"
            >
              <span>Get free key at console.groq.com</span>
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            </a>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.05]">
            <button
              type="button"
              onClick={onClose}
              disabled={isTesting}
              className="px-3.5 py-1.5 rounded-xl text-[12px] font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
            {allowForceSave && (
              <button
                type="button"
                onClick={(e) => handleSave(e, true)}
                className="px-3 py-1.5 rounded-xl text-[12px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
              >
                Save Anyway
              </button>
            )}
            <button
              type="submit"
              disabled={isTesting || !apiKey.trim()}
              className="px-4 py-1.5 rounded-xl text-[12px] font-semibold bg-[#0A84FF] text-white hover:bg-[#0071E3] transition shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isTesting && (
                <span className="material-symbols-outlined text-[14px] animate-spin">
                  progress_activity
                </span>
              )}
              <span>{isTesting ? 'Verifying Key…' : 'Save Key & Activate'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
