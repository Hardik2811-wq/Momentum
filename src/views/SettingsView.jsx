import React, { useState, useRef } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import { playChime, sendNotification } from '../store/useStore';

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
  const fileInputRef = useRef(null);

  const inputCls = 'bg-[#F5F4FA] border-black/[0.07] text-[#1A1B1F]';
  const profile = settings?.profile || {};
  
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
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Full Name', value: profile.name || '' },
                { key: 'role', label: 'Role / Title', value: profile.role || '' },
                { key: 'timezone', label: 'Timezone', value: profile.timezone || '' },
                { key: 'workCycle', label: 'Work Cycle', value: profile.workCycle || '' },
              ].map(({ key, label, value }) => (
                <div key={key}>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1 text-[#BBBBC0]">
                    {label}
                  </label>
                  <input
                    type="text"
                    defaultValue={value}
                    onBlur={(e) => updateProfile({ [key]: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-[12px] outline-none border transition-colors ${inputCls}`}
                  />
                </div>
              ))}
            </div>
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
