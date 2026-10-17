import React, { useEffect, useRef, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import TimezoneSelect from '../components/TimezoneSelect';
import ApiKeyModal from '../components/ApiKeyModal';
import { sendNotification } from '../store/useStore';
import {
  generateMcpBridgeToken,
  getByokStatus,
  getCustomCopilotDirective,
  getSavedMcpBridgeInfo,
  setCustomCopilotDirective
} from '../lib/groqClient';
import { getNlpInsights, resetNlpMemory } from '../lib/nlpMemory';
import MobileWidgetsShowcase from '../components/MobileWidgetsShowcase';

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-10 h-[22px] rounded-full relative transition-colors duration-200 cursor-pointer ${
      checked ? 'bg-[#0F52BA]' : 'bg-black/15 dark:bg-white/20'
    }`}
  >
    <span className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
      checked ? 'translate-x-[18px]' : 'translate-x-0'
    }`} />
  </button>
);

const Section = ({ title, badge, children }) => (
  <section className="rounded-2xl border overflow-hidden transition-colors bg-white dark:bg-[#1A1A1E] border-black/[0.07] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.03)]">
    <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#6B6A72] dark:text-[#8E8E93]">
        {title}
      </span>
      {badge}
    </div>
    <div className="px-5 py-4">{children}</div>
  </section>
);

const Row = ({ label, hint, children, noBorder }) => (
  <div className={`flex items-center justify-between py-3 gap-4 ${!noBorder ? 'border-b border-black/[0.04] dark:border-white/[0.05]' : ''}`}>
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-[#161618] dark:text-[#F7F6F2]">{label}</p>
      {hint && <p className="text-[11px] mt-0.5 text-[#6B6A72] dark:text-[#8E8E93]">{hint}</p>}
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
  importFullBackup,
  cloudSync,
  tasks = [],
  habits = [],
  stats = {},
  onToggleTask,
  onCheckInHabit,
  onOpenQuickAdd,
  onOpenNewGoal,
  onOpenNewHabit,
  agentControls = null,
  onOpenAgentStudio = null
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showByokModal, setShowByokModal] = useState(false);
  const [intelligence, setIntelligence] = useState(() => getNlpInsights());
  const [customDirective, setCustomDirective] = useState(() => getCustomCopilotDirective());
  const [directiveSaved, setDirectiveSaved] = useState(false);
  const [mcpInfo, setMcpInfo] = useState(() => getSavedMcpBridgeInfo());
  const [mcpCopiedField, setMcpCopiedField] = useState('');
  const [isGeneratingMcp, setIsGeneratingMcp] = useState(false);
  const fileInputRef = useRef(null);

  const inputCls = 'bg-[#F0EFEA] dark:bg-[#202024] border-black/[0.08] dark:border-white/[0.08] text-ink-primary dark:text-[#F7F6F2] focus:border-accent-cobalt';
  const profile = settings?.profile || {};

  const [byokStatus, setByokStatus] = useState(null);
  const loadByokStatus = async () => {
    try {
      const res = await getByokStatus();
      if (res && res.success) setByokStatus(res);
    } catch {}
  };

  const refreshIntelligence = () => setIntelligence(getNlpInsights());

  useEffect(() => {
    loadByokStatus();
    window.addEventListener('momentum:nlp-learned', refreshIntelligence);
    return () => window.removeEventListener('momentum:nlp-learned', refreshIntelligence);
  }, []);

  const handleGenerateMcpToken = async () => {
    setIsGeneratingMcp(true);
    try {
      const info = await generateMcpBridgeToken();
      setMcpInfo({ configured: true, ...info });
      updateSettings?.({
        mcpBridgeTokenHash: info.tokenHash,
        mcpBridgeUpdatedAt: new Date().toISOString()
      });
      setTimeout(() => cloudSync?.syncNow?.(), 250);
    } finally {
      setIsGeneratingMcp(false);
    }
  };

  const copyMcpText = async (text, field) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setMcpCopiedField(field);
      setTimeout(() => setMcpCopiedField(''), 2000);
    } catch {}
  };

  const [showClearLearningConfirm, setShowClearLearningConfirm] = useState(false);

  const clearLearning = () => {
    setShowClearLearningConfirm(true);
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
    <main className="w-full pt-[calc(3.85rem+env(safe-area-inset-top))] md:pt-15 min-h-screen transition-colors duration-300 bg-canvas dark:bg-canvas-dark text-ink-primary dark:text-[#F7F6F2]">
      <div className="max-w-3xl mx-auto px-3.5 sm:px-8 pb-24 space-y-4 sm:space-y-6">

        {/* Page header */}
        <div className="pb-2 border-b border-black/[0.07] dark:border-white/[0.08]">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10 border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center">
              <span className="material-symbols-outlined text-ink-primary dark:text-white text-[17px]">tune</span>
            </div>
            <div>
              <h1 className="font-editorial text-xl sm:text-[32px] font-normal tracking-tight text-ink-primary dark:text-[#F7F6F2]">
                System Settings
              </h1>
              <p className="font-mono text-[10.5px] sm:text-[11px] uppercase tracking-wider text-ink-secondary dark:text-[#8E8E93]">
                Preferences, focus engine & cloud sync
              </p>
            </div>
          </div>
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

        {/* ── Cloud Account & Multi-Device Sync ── */}
        <Section
          title="Cloud Account & Real-Time Sync"
          badge={
            cloudSync?.isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                CLOUD ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/20">
                OFFLINE ONLY
              </span>
            )
          }
        >
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.04]">
              <div>
                <p className="text-[13px] font-semibold text-[#1A1B1F]">
                  {cloudSync?.email || 'Logged In Operator'}
                </p>
                <p className="text-[11px] text-[#BBBBC0]">
                  {cloudSync?.lastSyncedAt
                    ? `Last synced: ${new Date(cloudSync.lastSyncedAt).toLocaleTimeString()}`
                    : 'Real-time WebSocket active for Web & Android'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cloudSync?.syncNow}
                  className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold text-[#0A84FF] border border-[#0A84FF]/30 hover:bg-[#0A84FF]/5 transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">sync</span>
                  Sync Now
                </button>
                <button
                  type="button"
                  onClick={cloudSync?.signOut}
                  className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold text-rose-500 border border-rose-500/30 hover:bg-rose-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[#8E8E93]">
              Tasks, goals, habits, and schedules synchronize across Laptop Web and Android App via live Supabase snapshots.
            </p>
          </div>
        </Section>

        {/* ── Autonomous Background AI Copilot Agent ── */}
        <Section
          title="Autonomous Background Copilot Agent"
          badge={
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 font-semibold border border-violet-500/30">
              {agentControls?.agentState?.mode === 'FULL_AUTOPILOT' ? 'Autopilot Active' : 'Proactive Approval'}
            </span>
          }
        >
          <p className="text-[12px] leading-5 text-ink-secondary dark:text-[#9A9AA0] mb-3">
            Audits your entire Momentum OS in the background. Understands human fatigue, protects streaks from evening decay, detects somatic clashes (e.g. gym before deep coding), and surfaces visual timeline diffs with multi-perspective benefit analysis.
          </p>

          <Row
            label="Background Agent Enablement"
            hint="Continuously monitor and harmonize schedule friction in background"
          >
            <input
              type="checkbox"
              checked={agentControls?.agentState?.enabled ?? true}
              onChange={(e) => agentControls?.updateAgentSettings?.({ enabled: e.target.checked })}
              className="w-4 h-4 accent-violet-600 cursor-pointer"
            />
          </Row>

          <Row
            label="Operating Agency Level"
            hint={agentControls?.agentState?.mode === 'FULL_AUTOPILOT'
              ? 'Full Autopilot: auto-shifts slipped tasks & inserts buffers with 1-tap Undo'
              : 'Proactive Approval: asks for 1-tap approval with visual timeline diff'}
          >
            <select
              value={agentControls?.agentState?.mode || 'PROACTIVE_APPROVAL'}
              onChange={(e) => agentControls?.updateAgentSettings?.({ mode: e.target.value })}
              className="px-2.5 py-1 text-[12px] rounded-lg bg-[#F7F6F2] dark:bg-[#202024] border border-black/[0.08] dark:border-white/[0.08] text-ink-primary dark:text-[#F7F6F2] outline-none cursor-pointer"
            >
              <option value="PROACTIVE_APPROVAL">Proactive Approval (1-Tap Review)</option>
              <option value="FULL_AUTOPILOT">Full Autopilot (Background Harmony)</option>
            </select>
          </Row>

          <Row
            label="Background Heartbeat Frequency"
            hint="How frequently the autonomous engine audits and harmonizes your day"
          >
            <select
              value={agentControls?.agentState?.auditIntervalMinutes || 5}
              onChange={(e) => agentControls?.updateAgentSettings?.({ auditIntervalMinutes: Number(e.target.value) })}
              className="px-2.5 py-1 text-[12px] rounded-lg bg-[#F7F6F2] dark:bg-[#202024] border border-black/[0.08] dark:border-white/[0.08] text-ink-primary dark:text-[#F7F6F2] outline-none cursor-pointer"
            >
              <option value={1}>Every 1 minute (Aggressive)</option>
              <option value={5}>Every 5 minutes (Recommended)</option>
              <option value={15}>Every 15 minutes (Balanced)</option>
              <option value={30}>Every 30 minutes (Quiet)</option>
            </select>
          </Row>

          <Row
            label="Circadian Biological Profile"
            hint="Calibrate peak focus and trough windows to your biological chronotype"
          >
            <select
              value={agentControls?.agentState?.circadianProfile || 'STANDARD'}
              onChange={(e) => {
                const profile = e.target.value;
                const offset = profile === 'NIGHT_OWL' ? 3 : profile === 'EARLY_BIRD' ? -2 : 0;
                agentControls?.updateAgentSettings?.({ circadianProfile: profile, circadianOffset: offset });
              }}
              className="px-2.5 py-1 text-[12px] rounded-lg bg-[#F7F6F2] dark:bg-[#202024] border border-black/[0.08] dark:border-white/[0.08] text-ink-primary dark:text-[#F7F6F2] outline-none cursor-pointer"
            >
              <option value="STANDARD">Standard (Peak 08:00–12:00, Dip 13:30–15:30)</option>
              <option value="NIGHT_OWL">Night Owl (+3h: Peak 11:00–15:00, Dip 16:30–18:30)</option>
              <option value="EARLY_BIRD">Early Bird (-2h: Peak 06:00–10:00, Dip 12:00–13:30)</option>
            </select>
          </Row>

          <Row
            label="Daily Deep Work Budget"
            hint="Maximum sustainable minutes of high-intensity prefrontal logic synthesis"
          >
            <select
              value={agentControls?.agentState?.deepWorkBudgetMinutes || 240}
              onChange={(e) => agentControls?.updateAgentSettings?.({ deepWorkBudgetMinutes: Number(e.target.value) })}
              className="px-2.5 py-1 text-[12px] rounded-lg bg-[#F7F6F2] dark:bg-[#202024] border border-black/[0.08] dark:border-white/[0.08] text-ink-primary dark:text-[#F7F6F2] outline-none cursor-pointer"
            >
              <option value={120}>2 hours (Light focus capacity)</option>
              <option value={180}>3 hours (Moderate focus)</option>
              <option value={240}>4 hours (Recommended: Newport Deep Work ceiling)</option>
              <option value={300}>5 hours (High cognitive stamina)</option>
              <option value={360}>6 hours (Extreme intensity)</option>
            </select>
          </Row>

          <Row
            label="Audio Chimes & Sound Effects"
            hint="Crisp harmonic audio chime when actions are harmonized"
          >
            <input
              type="checkbox"
              checked={agentControls?.agentState?.soundEffects ?? true}
              onChange={(e) => agentControls?.updateAgentSettings?.({ soundEffects: e.target.checked })}
              className="w-4 h-4 accent-violet-600 cursor-pointer"
            />
          </Row>

          <Row
            label="Autonomous Mission Studio"
            hint="Launch interactive time-lapse video player, holographic radar & decision matrix"
            noBorder
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => agentControls?.triggerAudit?.(true)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[12px] font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[14px]">explore</span>
                <span>Run Forensic Audit</span>
              </button>

              <button
                type="button"
                onClick={onOpenAgentStudio}
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                <span>Open Agent Studio</span>
              </button>
            </div>
          </Row>
        </Section>

        <Section
          title="Local Intelligence & Groq AI"
          badge={<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/15">LOCAL-FIRST</span>}
        >
          <p className="text-[12px] leading-5 text-ink-secondary dark:text-[#9A9AA0]">Momentum checks local rules first. Groq runs when you click AI Fill. Accepted suggestions become local patterns automatically.</p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: 'Local resolved', value: `${intelligence.offlineRatio}%`, color: 'text-ink-primary dark:text-[#F7F6F2]' },
              { label: 'Local tasks', value: intelligence.localHits, color: 'text-emerald-700 dark:text-emerald-400' },
              { label: 'Groq parsed', value: intelligence.apiHits, color: 'text-accent-cobalt dark:text-blue-400' },
              { label: 'Groq failed', value: intelligence.apiFailures || 0, color: (intelligence.apiFailures || 0) > 0 ? 'text-accent-terracotta dark:text-rose-400 font-bold' : 'text-ink-secondary dark:text-[#8E8E93]' },
              { label: 'Learned patterns', value: intelligence.totalLearned, color: 'text-purple-700 dark:text-purple-400' }
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-black/[0.07] dark:border-white/[0.08] bg-[#F7F6F2] dark:bg-[#151518] p-3">
                <p className="font-mono text-[10px] font-medium text-ink-secondary dark:text-[#8E8E93]">{label}</p>
                <p className={`mt-1 font-mono tabular-nums text-[18px] font-semibold tracking-tight ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-secondary dark:text-[#8E8E93]">Most used local patterns</p>
              <div className="mt-2 space-y-1.5">
                {intelligence.learnedPatterns.slice(0, 4).map((pattern) => (
                  <div key={pattern.name} className="flex items-center justify-between rounded-lg bg-[#F0EFEA] dark:bg-[#202024] px-3 py-2 text-[11px] text-ink-primary dark:text-[#E0DFD5] border border-black/[0.05] dark:border-white/[0.06]">
                    <span className="font-medium">{pattern.name}</span>
                    <span className="font-mono text-[10px] text-ink-secondary dark:text-[#8E8E93]">{(Array.isArray(pattern.areas) ? pattern.areas.join(', ') : pattern.context) || 'Career & Craft'} · {pattern.durationMinutes} min</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-secondary dark:text-[#8E8E93]">Recent decisions & AI logs</p>
              <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {intelligence.recentActivity.length ? intelligence.recentActivity.slice(0, 6).map((entry) => {
                  const isLocal = entry.type === 'local';
                  const isSuccess = entry.type === 'ai_success';
                  const isError = entry.type === 'ai_error';

                  return (
                    <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#F0EFEA] dark:bg-[#202024] px-3 py-2 text-[11px] text-ink-primary dark:text-[#E0DFD5] border border-black/[0.05] dark:border-white/[0.06]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${
                          isSuccess ? 'bg-blue-500' : isError ? 'bg-rose-500' : 'bg-emerald-500'
                        }`} />
                        <span className="font-semibold shrink-0">
                          {isSuccess ? 'Groq AI' : isError ? 'Groq failed' : 'Local rule'}
                        </span>
                        <span className="truncate text-ink-secondary dark:text-[#8E8E93]">{entry.label}</span>
                      </div>
                      {isSuccess && entry.model && (
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-accent-cobalt dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 font-mono shrink-0">
                          {entry.model}
                        </span>
                      )}
                      {isError && (
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-accent-terracotta dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40 font-mono shrink-0 truncate max-w-[120px]" title={entry.error}>
                          {entry.error}
                        </span>
                      )}
                    </div>
                  );
                }) : <p className="rounded-lg bg-[#F0EFEA] dark:bg-[#202024] px-3 py-2 text-[11px] text-ink-secondary dark:text-[#8E8E93]">No decisions yet.</p>}
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-black/[0.06] dark:border-white/[0.06] pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[12px] font-semibold text-ink-primary dark:text-[#F7F6F2]">Multi-Engine AI Key (Gemini 2.5 / Groq / OpenRouter)</p>
                  {byokStatus?.groqKeyCount > 0 && (
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                      {byokStatus.groqKeyCount} Groq Key{byokStatus.groqKeyCount > 1 ? 's' : ''} (Failover Pool)
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-4 text-[#8E8E93]">
                  {byokStatus?.groqKeyCount > 1
                    ? `Round-robin load distribution across ${byokStatus.groqKeyCount} Groq keys with automatic 429 rate limit failover.`
                    : 'Supports free Google Gemini 2.5 Flash (`AIza...`), multiple Groq keys (`gsk_...`), and OpenRouter (`sk-or-...`).'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowByokModal(true)}
                className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#0A84FF] bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 border border-blue-200/60 dark:border-blue-800/40 transition"
              >
                {byokStatus?.groqKeyCount > 0 ? 'Manage keys' : 'Add keys'}
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-black/[0.06] dark:border-white/[0.06] pt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-primary dark:text-[#F7F6F2]">
                Master Copilot Strategy &amp; Behavior Directive
              </label>
              {directiveSaved && (
                <span className="text-[11px] font-semibold text-emerald-600">Saved to AI memory</span>
              )}
            </div>
            <p className="text-[11px] text-[#8E8E93] mb-2 leading-relaxed">
              Define your strict personal operating rules, exam timetable, time blocking, and psychological mandates. Copilot respects this on every single plan without eating repetitive prompt tokens.
            </p>
            <textarea
              rows={4}
              value={customDirective}
              onChange={(e) => {
                setCustomDirective(e.target.value);
                setDirectiveSaved(false);
              }}
              placeholder="e.g. MISSION: 90+ in CN/CML/MERN. Direct discipline. No hedging. When plan breaks, reschedule immediately. Daily check-in at 8 AM and 8 PM."
              className={`w-full p-2.5 rounded-xl text-[12px] font-mono leading-relaxed outline-none border resize-y ${inputCls}`}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-[#BBBBC0]">
                {customDirective.length} characters • Injected into all Copilot plans
              </span>
              <button
                type="button"
                onClick={() => {
                  setCustomCopilotDirective(customDirective);
                  setDirectiveSaved(true);
                  setTimeout(() => setDirectiveSaved(false), 2500);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#1A1B1F] dark:bg-white text-white dark:text-[#1A1B1F] text-[11px] font-semibold hover:opacity-90 transition-colors"
              >
                Save Strategy Directive
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.06] pt-4">
            <p className="text-[11px] text-[#8E8E93]">Accepted AI: {intelligence.aiAccepted} · Discarded AI: {intelligence.aiDismissed}</p>
            <button type="button" onClick={clearLearning} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#5E5E6A] dark:text-[#9A9AA0] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]">Reset learning</button>
          </div>
        </Section>

        {/* ── Claude.ai & ChatGPT.com Live MCP Bridge ── */}
        <Section
          title="Claude.ai & ChatGPT.com Live MCP Bridge"
          badge={
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              WEB + ANDROID LIVE SYNC
            </span>
          }
        >
          <div className="space-y-3.5">
            <p className="text-[12px] leading-relaxed text-ink-secondary dark:text-[#9A9AA0]">
              Connect literal <strong>claude.ai</strong> (Remote MCP Connector / Skill) or <strong>chatgpt.com</strong> (Custom GPT Actions) directly to your live Momentum OS workspace. Any task, timetable block, habit, or goal created in Claude or ChatGPT dynamically syncs to your <strong>Android App &amp; Laptop Web</strong> in ~150ms via Supabase Realtime WebSockets.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#151518] border border-black/[0.07] dark:border-white/[0.08]">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-ink-primary dark:text-[#F7F6F2]">
                  {mcpInfo.configured ? 'Personal MCP Bridge Token Active' : 'Step 1: Generate Personal Bridge Token'}
                </p>
                <p className="text-[11px] text-[#8E8E93] mt-0.5">
                  {mcpInfo.configured
                    ? 'SHA-256 token hash synced to cloud snapshot. Ready for Claude.ai & ChatGPT.com.'
                    : 'Generates your encrypted mom_<userId>_<secret> bridge token and syncs its hash to cloud.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleGenerateMcpToken}
                  disabled={isGeneratingMcp}
                  className="px-3 py-1.5 rounded-xl bg-[#0A84FF] text-white text-[11px] font-semibold hover:bg-[#0071E3] transition cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingMcp ? 'Generating…' : mcpInfo.configured ? 'Regenerate Token' : 'Generate Bridge Token'}
                </button>
                <a
                  href="/MOMENTUM_CLAUDE_SKILL.md"
                  download="MOMENTUM_CLAUDE_SKILL.md"
                  className="px-3 py-1.5 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] text-ink-primary dark:text-[#F7F6F2] text-[11px] font-semibold hover:bg-black/[0.1] dark:hover:bg-white/[0.14] transition flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  <span>Skill .MD</span>
                </a>
              </div>
            </div>

            {mcpInfo.configured && (
              <div className="space-y-2.5 pt-1">
                <div className="rounded-xl bg-[#F0EFEA] dark:bg-[#202024] p-2.5 border border-black/[0.06] dark:border-white/[0.07]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                      Claude.ai Remote MCP Server URL (Settings → Integrations → Add MCP)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyMcpText(mcpInfo.mcpUrl, 'mcpUrl')}
                      className="text-[10.5px] font-semibold text-[#0A84FF] hover:underline shrink-0 cursor-pointer"
                    >
                      {mcpCopiedField === 'mcpUrl' ? '✓ Copied' : 'Copy URL'}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-ink-primary dark:text-[#E0DFD5] truncate select-all">
                    {mcpInfo.mcpUrl}
                  </p>
                </div>

                <div className="rounded-xl bg-[#F0EFEA] dark:bg-[#202024] p-2.5 border border-black/[0.06] dark:border-white/[0.07]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      ChatGPT.com Custom Action OpenAPI URL (Create GPT → Actions → Import URL)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyMcpText(mcpInfo.openApiUrl, 'openApiUrl')}
                      className="text-[10.5px] font-semibold text-[#0A84FF] hover:underline shrink-0 cursor-pointer"
                    >
                      {mcpCopiedField === 'openApiUrl' ? '✓ Copied' : 'Copy OpenAPI URL'}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-ink-primary dark:text-[#E0DFD5] truncate select-all">
                    {mcpInfo.openApiUrl}
                  </p>
                </div>

                <div className="rounded-xl bg-[#F0EFEA] dark:bg-[#202024] p-2.5 border border-black/[0.06] dark:border-white/[0.07] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-secondary dark:text-[#8E8E93] block">
                      Bearer Token (For Claude Desktop / ChatGPT Bearer Auth)
                    </span>
                    <p className="font-mono text-[11px] text-ink-primary dark:text-[#E0DFD5] truncate select-all mt-0.5">
                      {mcpInfo.token}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyMcpText(mcpInfo.token, 'token')}
                    className="text-[10.5px] font-semibold text-[#0A84FF] hover:underline shrink-0 cursor-pointer"
                  >
                    {mcpCopiedField === 'token' ? '✓ Copied' : 'Copy Token'}
                  </button>
                </div>
              </div>
            )}
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
          <Row label="Auto-Chain Series (CN Lecture 1 → 2 → 3)" hint="Automatically enforce sequence for numbered lectures and parts. Turn off to manage all dependencies manually.">
            <Toggle checked={settings?.autoSeriesChaining ?? true} onChange={(v) => updateSettings({ autoSeriesChaining: v })} />
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

        {/* ── Android Home Screen Widgets Simulation & Mock UI ── */}
        <Section
          title="Android App Widgets (Home Screen Mock UI)"
          badge={
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-500 border border-blue-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              CAPACITOR NATIVE BRIDGE
            </span>
          }
        >
          <MobileWidgetsShowcase
            tasks={tasks}
            habits={habits}
            stats={stats}
            onToggleTask={onToggleTask}
            onCheckInHabit={onCheckInHabit}
            onOpenQuickAdd={onOpenQuickAdd}
            onOpenNewGoal={onOpenNewGoal}
            onOpenNewHabit={onOpenNewHabit}
          />
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

      {/* Modern In-App Confirm Modal for Clear Learning */}
      <ConfirmModal
        isOpen={showClearLearningConfirm}
        title="Reset Intelligence History?"
        message="Remove local task patterns and cognitive learning history? This cannot be undone."
        confirmText="Yes, Reset Learning"
        isDanger={true}
        onConfirm={() => {
          resetNlpMemory();
          refreshIntelligence();
          setShowClearLearningConfirm(false);
        }}
        onCancel={() => setShowClearLearningConfirm(false)}
      />
      <ApiKeyModal
        isOpen={showByokModal}
        onClose={() => {
          setShowByokModal(false);
          loadByokStatus();
        }}
        onSuccess={loadByokStatus}
      />
    </main>
  );
}
