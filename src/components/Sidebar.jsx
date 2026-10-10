import React from 'react';

/* ============================================================
   Momentum OS — Bauhaus Monolith & Titanium Sidebar
   - 80% Bauhaus Editorial: Warm bone surface, Newsreader wordmark,
     fine hairline dividers, utilitarian ink typography.
   - 20% Titanium Minimalist: Double-bezel elevation, tactile push.
   ============================================================ */

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: 'space_dashboard' },
  { id: 'today',       label: 'Planner',     icon: 'calendar_view_week' },
  { id: 'goals',       label: 'Goals',       icon: 'flag_circle' },
  { id: 'habits',      label: 'Habits',      icon: 'loop' },
  { id: 'reflections', label: 'Reflections', icon: 'auto_stories' },
  { id: 'analytics',   label: 'Analytics',   icon: 'insights' },
  { id: 'settings',    label: 'Settings',    icon: 'tune' },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  onOpenQuickAdd,
  onOpenAiCopilot,
  settings,
  isCollapsed = false,
  onToggleCollapse
}) {
  const bg = 'bg-[#FBFBFA] dark:bg-[#161619]';
  const border = 'border-black/[0.07] dark:border-white/[0.08]';
  const activeCard = 'bg-white dark:bg-[#1E1E22] text-[#161618] dark:text-[#F7F6F2] border border-black/[0.07] dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)] font-semibold';
  const inactiveText = 'text-[#6B6A72] dark:text-[#9A98A0] hover:text-[#161618] dark:hover:text-[#F7F6F2] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] font-medium';

  const profile = settings?.profile || { name: 'Elena Vance', role: 'Product Lead' };
  const initials = (profile.name || 'EV')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'EV';

  return (
    <aside className={`hidden md:flex fixed left-0 top-0 h-screen ${isCollapsed ? 'w-[64px]' : 'w-[240px]'} z-50 flex-col select-none border-r transition-all duration-200 ${bg} ${border}`}>

      {/* ── Window controls ── */}
      <div className={`flex items-center gap-1.5 ${isCollapsed ? 'justify-center px-2' : 'px-5'} pt-4 pb-2`}>
        <span className="w-2.5 h-2.5 rounded-full bg-[#E05244] opacity-80 hover:opacity-100 transition-opacity cursor-pointer" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#E5A53D] opacity-80 hover:opacity-100 transition-opacity cursor-pointer" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#3FB950] opacity-80 hover:opacity-100 transition-opacity cursor-pointer" />
      </div>

      {/* ── Brand Logotype (Newsreader editorial) ── */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-5'} py-3`}>
        <div className="flex items-center gap-2.5" title="Momentum OS">
          <div className="w-8 h-8 rounded-lg bg-[#161618] dark:bg-[#F7F6F2] flex items-center justify-center text-white dark:text-[#161618] shadow-xs flex-shrink-0 cursor-pointer" onClick={onToggleCollapse}>
            <span className="font-mono font-bold text-xs tracking-tighter">M</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-editorial italic text-[17px] text-[#161618] dark:text-[#F7F6F2] tracking-tight">
                Momentum
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#6B6A72] dark:text-[#8E8E93]">
                Personal OS
              </span>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider bg-black/[0.05] dark:bg-white/[0.08] text-[#6B6A72] dark:text-[#8E8E93]">
            v3.0
          </span>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <div className={`px-2.5 py-2 space-y-1.5`}>
        <button
          type="button"
          onClick={onOpenQuickAdd}
          title="Quick Add Task"
          className={`w-full flex items-center justify-center gap-2 ${isCollapsed ? 'h-9 w-9 mx-auto p-0 rounded-xl' : 'py-2 px-3 rounded-xl'} text-[12.5px] font-semibold tracking-tight transition-all active:scale-[0.98] bg-[#161618] hover:bg-[#2A2A2E] text-white dark:bg-[#F7F6F2] dark:text-[#161618] dark:hover:bg-white shadow-double-bezel cursor-pointer`}
        >
          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'wght' 600" }}>add</span>
          {!isCollapsed && <span>Quick Add</span>}
        </button>

        <button
          type="button"
          onClick={onOpenAiCopilot}
          title="AI Executive Copilot"
          className={`w-full flex items-center justify-center gap-2 ${isCollapsed ? 'h-9 w-9 mx-auto p-0 rounded-xl' : 'py-1.5 px-3 rounded-xl'} text-[11.5px] font-semibold tracking-tight transition-all active:scale-[0.98] bg-white dark:bg-[#1E1E22] text-[#161618] dark:text-[#F7F6F2] hover:bg-black/[0.02] dark:hover:bg-white/[0.04] border border-black/[0.07] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer`}
        >
          <span className="material-symbols-outlined text-[15px] text-[#0F52BA]">auto_awesome</span>
          {!isCollapsed && <span>AI Copilot</span>}
        </button>
      </div>

      {/* ── Hairline Divider ── */}
      <div className="mx-3 h-px my-1.5 bg-black/[0.07] dark:border-white/[0.08]" />

      {/* ── Navigation List ── */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-3'} py-1 space-y-1 overflow-y-auto`}>
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              title={label}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center h-10 w-10 mx-auto px-0 rounded-xl' : 'gap-3 px-3 py-2 rounded-xl text-left'} text-[13px] tracking-tight transition-all duration-150 cursor-pointer ${
                isActive ? activeCard : inactiveText
              }`}
            >
              <span
                className={`material-symbols-outlined text-[19px] flex-shrink-0 transition-colors ${
                  isActive ? 'text-[#0F52BA] dark:text-[#6495ED]' : ''
                }`}
                style={{ fontVariationSettings: isActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400" }}
              >
                {icon}
              </span>
              {!isCollapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* ── Toggle Collapse Button ── */}
      {onToggleCollapse && (
        <div className="px-2 py-1 flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar to Icon Rail'}
            className="p-1.5 rounded-lg text-[#8E8E93] hover:text-[#161618] dark:hover:text-[#F7F6F2] hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isCollapsed ? 'dock_to_left' : 'chevron_left'}
            </span>
          </button>
        </div>
      )}

      {/* ── User Profile at Bottom ── */}
      <div
        className={`${isCollapsed ? 'mx-2 justify-center p-1.5' : 'mx-3 p-2.5 gap-2.5'} mb-3 rounded-xl flex items-center border cursor-pointer transition-all ${
          activeTab === 'settings'
            ? 'bg-white dark:bg-[#1E1E22] border-[#0F52BA]/40 shadow-xs'
            : 'bg-white/80 dark:bg-[#1A1A1E]/80 border-black/[0.07] dark:border-white/[0.08] hover:bg-white dark:hover:bg-[#1E1E22] shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
        }`}
        onClick={() => setActiveTab('settings')}
        title={profile.name || 'User Profile'}
      >
        <div className="w-7 h-7 rounded-lg bg-[#161618] dark:bg-[#F7F6F2] flex items-center justify-center text-white dark:text-[#161618] font-mono font-semibold text-[11px] flex-shrink-0 shadow-2xs">
          {initials}
        </div>
        {!isCollapsed && (
          <>
            <div className="flex flex-col min-w-0 flex-1 leading-tight">
              <span className="text-[12px] font-semibold truncate text-[#161618] dark:text-[#F7F6F2]">
                {profile.name || 'User Profile'}
              </span>
              <span className="text-[10px] font-mono truncate text-[#6B6A72] dark:text-[#8E8E93]">
                {profile.role || 'Personal OS'}
              </span>
            </div>
            <span className="material-symbols-outlined text-[15px] flex-shrink-0 text-[#8E8E93]">
              chevron_right
            </span>
          </>
        )}
      </div>
    </aside>
  );
}
