import React, { useState } from 'react';

export default function OnboardingModal({ isOpen, onSave, initialName = '', initialRole = '', initialTimezone = '' }) {
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState(initialRole);
  const [timezone, setTimezone] = useState(() => {
    if (initialTimezone) return initialTimezone;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      role: role.trim(),
      timezone: timezone.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-black/[0.08] p-6 space-y-5 animate-scaleUp">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#0A84FF]">Welcome to Momentum</span>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1B1F] mt-1">Configure Your Workspace</h2>
          <p className="text-xs text-[#64748B] mt-1">Tell us who is operating this command center.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#1A1B1F] mb-1">Your Full Name *</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Alex River"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-black/[0.1] bg-[#F5F4FA] focus:bg-white focus:border-[#0A84FF] outline-none transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#1A1B1F] mb-1">Role / Title</label>
            <input
              type="text"
              placeholder="e.g. Product Lead / Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-black/[0.1] bg-[#F5F4FA] focus:bg-white focus:border-[#0A84FF] outline-none transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#1A1B1F] mb-1">Timezone (Auto-detected)</label>
            <input
              type="text"
              required
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-black/[0.1] bg-[#F5F4FA] focus:bg-white focus:border-[#0A84FF] outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#0A84FF] text-white hover:bg-[#0071E3] transition active:scale-98 shadow-sm shadow-blue-500/25 disabled:opacity-40"
          >
            Get Started
          </button>
        </form>
      </div>
    </div>
  );
}
