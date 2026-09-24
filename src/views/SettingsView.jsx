import React, { useEffect, useRef, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import TimezoneSelect from '../components/TimezoneSelect';
import { sendNotification } from '../store/useStore';
import { getGroqApiKey, setGroqApiKey, testGroqConnection } from '../lib/groqClient';
import { getNlpInsights, resetNlpMemory } from '../lib/nlpMemory';

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-10 h-[22px] rounded-full relative transition-colors duration-200 ${
      checked ? 'bg-[#0A84FF]' : 'bg-[#DCDCE0]'
    }`}
  >
    <span className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
      checked ? 'translate-x-[18px]' : 'translate-x-0'
    }`} />
  </button>
);

const Section = ({ title, badge, children }) => (
  <section className="rounded-2xl border overflow-hidden transition-colors bg-white border-black/[0.06] shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
    <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.05]">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[#BBBBC0]">
        {title}
      </span>
      {badge}
    </div>
    <div className="px-5 py-4">{children}</div>
  </section>
);

const Row = ({ label, hint, children, noBorder }) => (
  <div className={`flex items-center justify-between py-3 gap-4 ${!noBorder ? 'border-b border-black/[0.04]' : ''}`}>
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-[#1A1B1F]">{label}</p>
      {hint && <p className="text-[11px] mt-0.5 text-[#BBBBC0]">{hint}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

export default function SettingsView({
  settings,
  updateSettings,
  updateProfile,
  resetAllData,
  clearAllData,
  loadDemoData,
  exportFullBackup,
  importFullBackup
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [intelligence, setIntelligence] = useState(() => getNlpInsights());
  const [keySaved, setKeySaved] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const fileInputRef = useRef(null);

  const inputCls = 'bg-[#F5F4FA] border-black/[0.07] text-[#1A1B1F]';
  const profile = settings?.profile || {};

  const refreshIntelligence = () => setIntelligence(getNlpInsights());

  useEffect(() => {
    window.addEventListener('momentum:nlp-learned', refreshIntelligence);
    return () => window.removeEventListener('momentum:nlp-learned', refreshIntelligence);
  }, []);

  const handleTestGroq = async (customKey = null) => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await testGroqConnection(customKey);
      if (res.success) {
        setTestResult({ success: true, message: 'Valid! Connection to Groq succeeded.' });
      } else {
        setTestResult({ success: false, message: res.error || 'Connection failed' });
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Network error' });
    } finally {
      setTestingKey(false);
    }
  };

  const saveGroqKey = () => {
    if (!groqKeyInput.trim()) return;
    const clean = groqKeyInput.trim();
    setGroqApiKey(clean);
    updateSettings?.({ groqApiKey: clean });
    setGroqKeyInput('');
    setKeySaved(true);
    setTestResult(null);
  };

  const clearGroqKey = () => {
    setGroqApiKey('');
    updateSettings?.({ groqApiKey: '' });
    setKeySaved(false);
    setTestResult(null);
  };

  const clearLearning = () => {
    if (!window.confirm('Remove local task patterns and learning history? This cannot be undone.')) return;
    resetNlpMemory();
    refreshIntelligence();
  };
  
  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleNotificationToggle = async (val) => {
    if (val && 'Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        updateSettings({ desktopNotifications: true });
        sendNotification('Momentum Activated', { body: 'Desktop notifications are active.' });
      } else {
        updateSettings({ desktopNotifications: false });
      }
    } else {
      updateSettings({ desktopNotifications: val });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      importFullBackup?.(evt.target.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <main className="w-full pt-16 md:pt-12 min-h-screen transition-colors duration-300 bg-[#EFEFF5] text-[#1A1B1F]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-4 sm:py-8 pb-24 space-y-5">

        {/* Page header */}
        <div className="pb-2">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-white text-[15px]">tune</span>
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-[#1A1B1F]">
              System Settings
            </h1>
          </div>
          <p className="text-[12px] ml-9 text-[#BBBBC0]">
            Preferences, focus engine, and integrations
          </p>
        </div>

        {/* ── Profile ── */}
        <Section title="User Profile">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
              {getInitials(profile.name)}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1 text-[#BBBBC0]">
                  Full Name
                </label>
                <input
                  type="text"
                  defaultValue={profile.name || ''}
                  onBlur={(e) => updateProfile({ name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl text-[12px] outline-none border transition-colors ${inputCls}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1 text-[#BBBBC0]">
                  Role / Title
                </label>
                <input
                  type="text"
                  defaultValue={profile.role || ''}
                  onBlur={(e) => updateProfile({ role: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl text-[12px] outline-none border transition-colors ${inputCls}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1 text-[#BBBBC0]">
                  Timezone
                </label>
                <TimezoneSelect
                  value={profile.timezone}
                  onChange={(val) => updateProfile({ timezone: val })}
                />
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Local Intelligence & Groq AI"
          badge={<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/15">LOCAL-FIRST</span>}
        >
          <p className="text-[12px] leading-5 text-[#5E5E6A]">Momentum checks local rules first. Groq runs when you click AI Fill. Accepted suggestions become local patterns automatically.</p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: 'Local resolved', value: `${intelligence.offlineRatio}%`, color: 'text-[#1A1B1F]' },
              { label: 'Local tasks', value: intelligence.localHits, color: 'text-emerald-700' },
              { label: 'Groq parsed', value: intelligence.apiHits, color: 'text-blue-700' },
              { label: 'Groq failed', value: intelligence.apiFailures || 0, color: (intelligence.apiFailures || 0) > 0 ? 'text-rose-600 font-bold' : 'text-[#8E8E93]' },
              { label: 'Learned patterns', value: intelligence.totalLearned, color: 'text-purple-700' }
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-black/[0.06] bg-[#F8F8FB] p-3">
                <p className="text-[10px] font-medium text-[#8E8E93]">{label}</p>
                <p className={`mt-1 text-[18px] font-semibold tracking-tight ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">Most used local patterns</p>
              <div className="mt-2 space-y-1.5">
                {intelligence.learnedPatterns.slice(0, 4).map((pattern) => (
                  <div key={pattern.name} className="flex items-center justify-between rounded-lg bg-[#F5F4FA] px-3 py-2 text-[11px] text-[#52525B]">
                    <span className="font-medium">{pattern.name}</span>
                    <span>{(Array.isArray(pattern.areas) ? pattern.areas.join(', ') : pattern.context) || 'Career & Craft'} · {pattern.durationMinutes} min</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">Recent decisions & AI logs</p>
              <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {intelligence.recentActivity.length ? intelligence.recentActivity.slice(0, 6).map((entry) => {
                  const isLocal = entry.type === 'local';
                  const isSuccess = entry.type === 'ai_success';
                  const isError = entry.type === 'ai_error';

                  return (
                    <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#F5F4FA] px-3 py-2 text-[11px] text-[#52525B]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${
                          isSuccess ? 'bg-blue-500' : isError ? 'bg-rose-500' : 'bg-emerald-500'
                        }`} />
                        <span className="font-semibold shrink-0">
                          {isSuccess ? 'Groq AI' : isError ? 'Groq failed' : 'Local rule'}
                        </span>
                        <span className="truncate text-[#8E8E93]">{entry.label}</span>
                      </div>
                      {isSuccess && entry.model && (
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-mono shrink-0">
                          {entry.model}
                        </span>
                      )}
                      {isError && (
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200/60 shrink-0 truncate max-w-[120px]" title={entry.error}>
                          {entry.error}
                        </span>
                      )}
                    </div>
                  );
                }) : <p className="rounded-lg bg-[#F5F4FA] px-3 py-2 text-[11px] text-[#8E8E93]">No decisions yet.</p>}
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-black/[0.06] pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold text-[#1A1B1F]">Groq Cloud Inference (BYOK)</p>
                <p className="mt-0.5 text-[11px] leading-4 text-[#8E8E93]">
                  {getGroqApiKey() || keySaved ? 'Your personal Groq API key is active for this workspace.' : 'No key saved. AI task fill & intelligent parsing requires a free Groq API key.'}
                </p>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-[11px] text-[#0A84FF] font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <span>Get your free API key at console.groq.com</span>
                  <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                </a>
              </div>
              {(getGroqApiKey() || keySaved) && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTestGroq()}
                    disabled={testingKey}
                    className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#0A84FF] bg-blue-50 hover:bg-blue-100 border border-blue-200/60 transition disabled:opacity-50"
                  >
                    {testingKey ? 'Testing…' : 'Test Connection'}
                  </button>
                  <button
                    type="button"
                    onClick={clearGroqKey}
                    className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-50 transition"
                  >
                    Remove key
                  </button>
                </div>
              )}
            </div>

            {testResult && (
              <div className={`mt-2.5 px-3 py-1.5 rounded-xl text-[11px] font-medium border flex items-center justify-between gap-2 animate-fadeIn ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <span>{testResult.success ? '✓' : '✕'} {testResult.message}</span>
                <button type="button" onClick={() => setTestResult(null)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-[13px]">close</span>
                </button>
              </div>
            )}

            {!getGroqApiKey() && !keySaved && (
              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  value={groqKeyInput}
                  onChange={(event) => setGroqKeyInput(event.target.value)}
                  placeholder="Paste Groq API key (gsk_...)"
                  className={`min-w-0 flex-1 px-3 py-2 rounded-xl text-[12px] font-mono outline-none border ${inputCls}`}
                />
                <button
                  type="button"
                  onClick={saveGroqKey}
                  disabled={!groqKeyInput.trim()}
                  className="rounded-xl bg-[#0A84FF] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50 hover:bg-[#0071E3] transition"
                >
                  Save Key
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-black/[0.06] pt-4">
            <p className="text-[11px] text-[#8E8E93]">Accepted AI: {intelligence.aiAccepted} · Discarded AI: {intelligence.aiDismissed}</p>
            <button type="button" onClick={clearLearning} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#5E5E6A] hover:bg-black/[0.04]">Reset learning</button>
          </div>
        </Section>

        {/* ── Focus Engine ── */}
        <Section title="Focus & Deep Work Engine">
          <Row label="Show Deep Work Focus Bar" hint="Floating widget for focus sprint timers and active task anchor.">
            <Toggle
              checked={settings?.showFocusBar ?? true}
              onChange={(v) => updateSettings({ showFocusBar: v })}
            />
          </Row>
          <Row label="Default Deep Work Session" hint="Duration in minutes for active cognitive sprints.">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={settings?.focusLength ?? 45}
                onChange={(e) => updateSettings({ focusLength: Number(e.target.value) })}
                className={`w-16 px-2 py-1.5 text-center rounded-xl text-[12px] font-semibold border outline-none ${inputCls}`}
              />
              <span className="text-[11px] text-[#BBBBC0]">min</span>
            </div>
          </Row>
          <Row label="Daily Deep Work Target" hint="Target hours of uninterrupted focus daily.">
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                value={settings?.dailyTarget ?? 4.5}
                onChange={(e) => updateSettings({ dailyTarget: Number(e.target.value) })}
                className={`w-16 px-2 py-1.5 text-center rounded-xl text-[12px] font-semibold border outline-none ${inputCls}`}
              />
              <span className="text-[11px] text-[#BBBBC0]">hrs</span>
            </div>
          </Row>
          <Row label="Auto-start Recovery Breaks" hint="Transition to 5-minute break automatically when sprint concludes.">
            <Toggle checked={settings?.autoBreaks ?? true} onChange={(v) => updateSettings({ autoBreaks: v })} />
          </Row>
          <Row label="Desktop Notifications" hint="System alerts when focus timer finishes or cycle changes.">
            <div className="flex items-center gap-2">
              {settings?.desktopNotifications && (
                <button
                  type="button"
                  onClick={() => sendNotification('Test Alert', { body: 'Momentum notifications are working!' })}
                  className="px-2 py-1 rounded-lg bg-[#F5F4FA] hover:bg-[#EBEAF0] text-[10px] font-semibold text-[#1A1B1F] transition-colors"
                >
                  Test Alert
                </button>
              )}
              <Toggle checked={settings?.desktopNotifications ?? true} onChange={handleNotificationToggle} />
            </div>
          </Row>
          <Row label="Sound Effects" hint="Crisp harmonic audio feedback on task check-off & timer bell." noBorder>
            <div className="flex items-center gap-2">
              {settings?.soundEffects && (
                <button
                  type="button"
                  onClick={() => playChime('complete')}
                  className="px-2 py-1 rounded-lg bg-[#F5F4FA] hover:bg-[#EBEAF0] text-[10px] font-semibold text-[#1A1B1F] transition-colors"
                >
                  Test Chime 🔔
                </button>
              )}
              <Toggle checked={settings?.soundEffects ?? true} onChange={(v) => updateSettings({ soundEffects: v })} />
            </div>
          </Row>
        </Section>

        {/* ── Data & Backup (Cloud / Offline Safety) ── */}
        <Section title="Data Backup & Portability">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-black/[0.04]">
              <div>
                <p className="text-[13px] font-medium text-[#1A1B1F]">Export JSON Backup</p>
                <p className="text-[11px] mt-0.5 text-[#BBBBC0]">Save full database (tasks, goals, habits, reflections) to disk.</p>
              </div>
              <button
                type="button"
                onClick={exportFullBackup}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0A84FF] text-white text-[12px] font-semibold hover:bg-[#0071E3] transition-all shadow-sm shadow-blue-500/25 active:scale-95"
              >
                <span className="material-symbols-outlined text-[15px]">file_download</span>
                <span>Export Backup</span>
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[13px] font-medium text-[#1A1B1F]">Restore from Backup</p>
                <p className="text-[11px] mt-0.5 text-[#BBBBC0]">Load an existing Momentum JSON backup file.</p>
              </div>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".json"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F5F4FA] text-[#1A1B1F] border border-black/[0.08] text-[12px] font-semibold hover:bg-white transition-all shadow-sm active:scale-95"
                >
                  <span className="material-symbols-outlined text-[15px]">upload_file</span>
                  <span>Import Backup</span>
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Stitch AI ── */}
        <Section
          title="Stitch AI Integration"
          badge={
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              MCP ACTIVE
            </span>
          }
        >
          {[
            { label: 'Server Endpoint',   value: 'https://stitch.googleapis.com/mcp', mono: true },
            { label: 'Active Project',    value: 'projects/5789623352705408014',        mono: true },
            { label: 'API Key',           value: 'Configured from STITCH_API_KEY',      mono: true },
            { label: 'Synced Screens',    value: '14 screens',                           mono: false, accent: true },
          ].map(({ label, value, mono, accent }, i, arr) => (
            <Row key={label} label={label} noBorder={i === arr.length - 1}>
              <span className={`text-[11px] ${mono ? 'font-mono' : 'font-medium'} ${
                accent ? 'text-[#0A84FF]' : 'text-[#9A9AA0]'
              }`}>{value}</span>
            </Row>
          ))}
        </Section>

        {/* ── Workspace & Danger Zone ── */}
        <Section title="Workspace State & Reset">
          <div className="space-y-4">
            {/* Clean Slate */}
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
              <div>
                <p className="text-[13px] font-semibold text-[#1A1B1F]">Wipe Clean (Empty Workspace)</p>
                <p className="text-[11px] mt-0.5 text-[#BBBBC0]">Start 100% fresh with 0 sample tasks, goals, or habits.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold text-amber-600 border border-amber-500/30 hover:bg-amber-50 transition-colors">
                Wipe Clean
              </button>
            </div>

            {/* Load Demo Data */}
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
              <div>
                <p className="text-[13px] font-semibold text-[#1A1B1F]">Load Sample Workspace</p>
                <p className="text-[11px] mt-0.5 text-[#BBBBC0]">Populate rich demo tasks, strategic goals, habits, and reflections.</p>
              </div>
              <button 
                type="button"
                onClick={loadDemoData}
                className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold text-primary border border-primary/30 hover:bg-primary/5 transition-colors">
                Load Sample
              </button>
            </div>

            {/* Reset Defaults */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-red-600">Reset System Baseline</p>
                <p className="text-[11px] mt-0.5 text-[#BBBBC0]">Reset all preferences and restore default configuration.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors">
                Reset
              </button>
            </div>
          </div>
        </Section>

      </div>

      {/* Modern In-App Confirm Modal for Reset */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Entire Momentum OS?"
        message="This will restore default baseline settings and sample data. Ensure you have exported a backup if you need your custom data."
        confirmText="Yes, Reset Baseline"
        isDanger={true}
        onConfirm={() => {
          resetAllData();
          setShowResetConfirm(false);
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Modern In-App Confirm Modal for Wipe Clean */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Wipe to Clean Slate?"
        message="This will remove all sample tasks, goals, habits, and reflections so you can configure your own personal life workspace from scratch."
        confirmText="Yes, Wipe Workspace"
        isDanger={true}
        onConfirm={() => {
          clearAllData?.();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </main>
  );
}
