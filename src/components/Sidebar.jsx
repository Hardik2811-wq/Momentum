import React from 'react';

/* ============================================================
   Momentum OS — Sleek Sidebar v2
   - Compact window controls (traffic lights)
   - Brand wordmark with gradient M icon
   - Icon + label nav with soft pill indicator
   - User profile at bottom → opens settings
   ============================================================ */

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: 'space_dashboard' },
  { id: 'today',       label: 'Today',       icon: 'today' },
  { id: 'goals',       label: 'Goals',       icon: 'flag_circle' },
  { id: 'habits',      label: 'Habits',      icon: 'loop' },
  { id: 'reflections', label: 'Reflections', icon: 'auto_stories' },
  { id: 'analytics',   label: 'Analytics',   icon: 'insights' },
  { id: 'settings',    label: 'Settings',    icon: 'tune' },
];

export default function Sidebar({ activeTab, setActiveTab, onOpenQuickAdd, settings }) {
  const bg         = 'bg-[#F5F4F9]';
  const border     = 'border-black/[0.06]';
  const activeCard = 'bg-white text-[#1A1B1F] border border-black/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.08)]';
  const inactiveText = 'text-[#5E5E6A] hover:text-[#1A1B1F] hover:bg-black/[0.04]';

  const profile = settings?.profile || { name: 'Elena Vance', role: 'Product Lead' };
  const initials = (profile.name || 'EV')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'EV';

  return (
    <aside className={`hidden md:flex fixed left-0 top-0 h-screen w-[248px] z-50 flex-col select-none border-r transition-colors duration-300 ${bg} ${border}`}>

      {/* ── Traffic light dots ── */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <span className="w-3 h-3 rounded-full bg-[#FF5F57] hover:brightness-90 transition-all cursor-pointer" />
        <span className="w-3 h-3 rounded-full bg-[#FEBC2E] hover:brightness-90 transition-all cursor-pointer" />
        <span className="w-3 h-3 rounded-full bg-[#28C840] hover:brightness-90 transition-all cursor-pointer" />
      </div>

      {/* ── Brand ── */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
            <span className="text-white font-bold text-sm tracking-tight">M</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-semibold text-[14px] tracking-tight text-[#1A1B1F]">
              Momentum
            </span>
            <span className="text-[10px] font-medium text-[#999]">
              Personal OS
            </span>
          </div>
        </div>
        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-black/[0.06] text-[#9a9a9a]">
          v3
        </span>
      </div>

      {/* ── Quick Add ── */}
      <div className="px-3 py-2.5">
        <button
          onClick={onOpenQuickAdd}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold tracking-tight transition-all active:scale-[0.97] bg-[#0A84FF] text-white hover:bg-[#0071E3] shadow-[0_4px_16px_rgba(10,132,255,0.2)]"
        >
          <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'wght' 600" }}>add</span>
          Quick Add
        </button>
      </div>

      {/* ── Divider ── */}
      <div className="mx-4 h-px my-1 bg-black/[0.06]" />

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[13px] font-medium tracking-tight transition-all duration-150 ${
                isActive ? activeCard : inactiveText
              }`}
            >
              <span className={`material-symbols-outlined text-[19px] flex-shrink-0 transition-colors ${
                isActive ? 'text-[#0A84FF]' : ''
              }`}>
                {icon}
              </span>
              {label}
            </button>
          );
        })}
      </nav>

      {/* ── User Profile ── */}
      <div className={`mx-3 mb-3 p-3 rounded-xl flex items-center gap-3 border cursor-pointer transition-all ${
        activeTab === 'settings'
          ? 'bg-white border-[#0A84FF]/30 shadow-sm'
          : 'bg-white/70 border-black/[0.06] hover:bg-white'
      }`}
        onClick={() => setActiveTab('settings')}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm">
          {initials}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[12px] font-semibold truncate text-[#1A1B1F]">
            {profile.name || 'User Profile'}
          </span>
          <span className="text-[10px] truncate text-[#9a9a9a]">
            {profile.role || 'Personal OS'}
          </span>
        </div>
        <span className="material-symbols-outlined text-[16px] flex-shrink-0 text-[#ccc]">
          chevron_right
        </span>
      </div>
    </aside>
  );
}
