import React, { useEffect, useState } from 'react';
import {
  addGroqKeys,
  deleteByokKey,
  detectAiProvider,
  getAiProviderLabel,
  getByokStatus,
  hasAiService,
  maskApiKey,
  parseKeyInput,
  removeGroqKey,
  saveByokKey,
  testGroqKey
} from '../lib/groqClient';

export default function ApiKeyModal({ isOpen, onClose, onSuccess }) {
  const [keyInput, setKeyInput] = useState('');
  const [status, setStatus] = useState({
    configured: false,
    provider: null,
    providerLabel: '',
    groqKeys: [],
    groqKeyCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [testingKey, setTestingKey] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const refreshStatus = async () => {
    try {
      const res = await getByokStatus();
      if (res && res.success) {
        setStatus({
          configured: Boolean(res.configured),
          provider: res.provider || null,
          providerLabel: res.providerLabel || '',
          groqKeys: Array.isArray(res.groqKeys) ? res.groqKeys : [],
          groqKeyCount: res.groqKeyCount || 0
        });
      }
    } catch (e) {
      console.warn('Failed to refresh BYOK status', e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setKeyInput('');
    setError('');
    setSuccessMsg('');
    setTestResults({});
    if (!hasAiService()) return;
    refreshStatus();
  }, [isOpen]);

  if (!isOpen) return null;

  // Detect tokens in input box
  const parsedTokens = parseKeyInput(keyInput);
  const detectedGroqCount = parsedTokens.filter(k => detectAiProvider(k) === 'groq').length;
  const singleDetectedProvider = parsedTokens.length === 1 ? detectAiProvider(parsedTokens[0]) : null;

  const handleAddKeys = async (e) => {
    e.preventDefault();
    const input = keyInput.trim();
    if (!input) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const tokens = parseKeyInput(input);
      if (tokens.length === 0) {
        setError('Paste at least one valid API key.');
        setLoading(false);
        return;
      }

      // If user provided Groq key(s)
      const hasGroq = tokens.some(t => detectAiProvider(t) === 'groq');
      if (hasGroq) {
        const res = await addGroqKeys(tokens);
        if (!res.success) {
          setError(res.error || 'Failed to add Groq keys.');
          setLoading(false);
          return;
        }
        setKeyInput('');
        setSuccessMsg(`Successfully added ${res.addedCount} Groq key${res.addedCount > 1 ? 's' : ''} to pool.`);
        await refreshStatus();
        onSuccess?.();
      } else {
        // Single non-Groq key (Gemini, OpenRouter, etc.)
        const res = await saveByokKey(tokens[0]);
        if (!res.success) {
          setError(res.error || 'Failed to save key.');
          setLoading(false);
          return;
        }
        setKeyInput('');
        setSuccessMsg(`Saved ${res.providerLabel || 'API key'}.`);
        await refreshStatus();
        onSuccess?.();
      }
    } catch (err) {
      setError(err.message || 'Error saving keys.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSingle = async (keyToRemove) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      removeGroqKey(keyToRemove);
      await refreshStatus();
      setSuccessMsg('Key removed from pool.');
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Failed to remove key.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestKey = async (keyToTest) => {
    setTestingKey(keyToTest);
    try {
      const res = await testGroqKey(keyToTest);
      setTestResults(prev => ({
        ...prev,
        [keyToTest]: res.success ? { valid: true } : { valid: false, error: res.error }
      }));
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [keyToTest]: { valid: false, error: err.message }
      }));
    } finally {
      setTestingKey(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Remove all configured AI keys?')) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await deleteByokKey();
      await refreshStatus();
      setSuccessMsg('All keys removed.');
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Failed to clear keys.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="byok-title"
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1A1A1E] p-5 sm:p-6 shadow-2xl border border-black/[0.08] dark:border-white/[0.08] space-y-4 animate-scaleUp text-[#1A1B1F] dark:text-[#F7F6F2]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 flex items-center justify-center text-violet-600 dark:text-violet-300 shadow-2xs">
              <span className="material-symbols-outlined text-[20px]">vpn_key</span>
            </div>
            <div>
              <h2 id="byok-title" className="text-[16px] font-bold tracking-tight">
                Groq &amp; Multi-Engine API Keys
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-[#8E8E93]">
                Add multiple Groq keys for automatic rate limit rotation &amp; failover.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Informative Tip */}
        <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/40 rounded-xl text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="material-symbols-outlined text-[15px] text-[#0A84FF]">bolt</span>
            <span>Multi-Key Failover Engine</span>
          </div>
          <p className="text-blue-800/80 dark:text-blue-300/80">
            Paste one or multiple Groq keys (<code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded text-[10px]">gsk_...</code>). Momentum automatically rotates across them with round-robin load distribution and seamlessly recovers if any key hits a 429 rate limit.
          </p>
        </div>

        {/* Existing Keys Pool */}
        {status.groqKeys && status.groqKeys.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Active Groq Key Pool ({status.groqKeys.length})
              </span>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={loading}
                className="text-[10.5px] font-semibold text-rose-500 hover:text-rose-700 transition"
              >
                Clear all keys
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
              {status.groqKeys.map((item, idx) => {
                const testRes = testResults[item.key];
                const isTesting = testingKey === item.key;

                return (
                  <div
                    key={item.key || idx}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F9F9FB] dark:bg-[#202024] border border-black/[0.06] dark:border-white/[0.08] text-[11.5px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-black/[0.05] dark:bg-white/[0.08] text-[10px] font-mono font-bold flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-mono text-[11px] text-[#1A1B1F] dark:text-[#E0DFD5] truncate">
                        {item.masked || maskApiKey(item.key)}
                      </span>
                      {item.isCooling ? (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40 shrink-0">
                          Cooldown ({item.cooldownSeconds}s)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Ready
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {testRes && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            testRes.valid
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                          }`}
                        >
                          {testRes.valid ? '✓ Valid' : '✗ Failed'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTestKey(item.key)}
                        disabled={isTesting || loading}
                        className="px-2 py-1 rounded-lg text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 transition"
                      >
                        {isTesting ? 'Testing…' : 'Test'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSingle(item.key)}
                        disabled={loading}
                        aria-label="Remove key"
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Non-Groq Active Provider Banner */}
        {status.configured && status.provider && status.provider !== 'groq' && (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-[11.5px] text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
            <span>
              Active Cloud Engine: <strong>{status.providerLabel}</strong>
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={handleClearAll}
              className="font-bold text-rose-600 hover:text-rose-800 text-[11px] disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        )}

        {/* Input Form for adding single or multiple keys */}
        <form onSubmit={handleAddKeys} autoComplete="off" className="space-y-3 pt-1">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="byok-multi-key"
                className="block text-[11px] font-semibold text-[#1A1B1F] dark:text-[#F7F6F2]"
              >
                Add Groq API Key(s) or Gemini Key
              </label>
              {detectedGroqCount > 1 ? (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/40">
                  {detectedGroqCount} Groq keys detected
                </span>
              ) : singleDetectedProvider ? (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#0A84FF] border border-blue-200/60 dark:border-blue-800/40">
                  Detected: {getAiProviderLabel(singleDetectedProvider)}
                </span>
              ) : null}
            </div>

            <textarea
              id="byok-multi-key"
              rows={3}
              autoFocus
              autoComplete="off"
              spellCheck="false"
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                setError('');
                setSuccessMsg('');
              }}
              placeholder="Paste one or multiple Groq keys (gsk_...)&#10;Keys can be separated by newlines, commas, or spaces."
              className="w-full px-3 py-2 text-[11.5px] font-mono rounded-xl border border-black/[0.1] dark:border-white/[0.1] bg-[#F5F4FA] dark:bg-[#202024] text-[#1A1B1F] dark:text-[#F7F6F2] focus:bg-white dark:focus:bg-[#252529] focus:border-[#0A84FF] outline-none transition resize-none leading-relaxed"
            />
          </div>

          {error && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </p>
          )}

          {successMsg && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ {successMsg}
            </p>
          )}

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
            <div className="flex items-center gap-3">
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#0A84FF] font-semibold hover:underline flex items-center gap-1"
              >
                <span>Get Groq keys</span>
                <span className="material-symbols-outlined text-[13px]">open_in_new</span>
              </a>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hover:underline"
              >
                Gemini key (Free)
              </a>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-[12px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition"
              >
                Done
              </button>
              <button
                type="submit"
                disabled={loading || !keyInput.trim()}
                className="px-4 py-1.5 rounded-xl text-[12px] font-semibold bg-[#0A84FF] text-white hover:bg-[#0071E3] disabled:opacity-50 transition shadow-2xs"
              >
                {loading ? 'Validating…' : detectedGroqCount > 1 ? `Add ${detectedGroqCount} Keys` : '+ Add Key'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
