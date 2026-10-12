import React, { useRef, useEffect, useState } from 'react';

const TITLE_MAP = {
  dashboard:   'Today',
  today:       'Planner',
  goals:       'Goals',
  habits:      'Habits',
  reflections: 'Reflections',
  analytics:   'Analytics',
  settings:    'Settings',
};

export default function Header({
  activeTab,
  tasks = [],
  goals = [],
  habits = [],
  onEditHabit,
  setActiveTab,
  isUniversalEditorMode = false,
  onToggleUniversalEditor,
  onOpenAiCopilot,
  onOpenQuickAdd,
  isSidebarCollapsed = false,
  onToggleSidebar
}) {
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef(null);

  const completedTasksCount = tasks.filter(t => t.completed).length;
  const totalTasksCount = tasks.length;
  const completionPct = totalTasksCount ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const todayDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchFocused(false);
        setShowNotifications(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setShowMobileMenu(false);
      }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  const filteredResults = [];
  if (searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase();
    tasks?.forEach(t => {
      if (t.title?.toLowerCase().includes(q)) filteredResults.push({ ...t, type: 'task', tab: 'today' });
    });
    habits?.forEach(h => {
      if (h.title?.toLowerCase().includes(q)) filteredResults.push({ ...h, type: 'habit', tab: 'habits' });
    });
    goals?.forEach(g => {
      if (g.title?.toLowerCase().includes(q)) filteredResults.push({ ...g, type: 'goal', tab: 'goals' });
    });
  }
  const topResults = filteredResults.slice(0, 6);

  const recentTasks = (tasks || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 3);

  const TABS = [
    { id: 'dashboard', label: 'Today' },
    { id: 'today',     label: 'Planner' },
    { id: 'habits',    label: 'Habits' },
    { id: 'goals',     label: 'Goals' },
    { id: 'analytics', label: 'Analytics' }
  ];

  return (
    <header className={`fixed top-0 left-0 ${isSidebarCollapsed ? 'md:left-[64px]' : 'md:left-[240px]'} right-0 h-[calc(3.25rem+env(safe-area-inset-top))] md:h-12 pt-[env(safe-area-inset-top)] md:pt-0 z-40 flex items-center justify-between px-3.5 md:px-5 backdrop-blur-xl border-b transition-all duration-200 bg-[#F7F6F2]/92 dark:bg-[#121214]/92 border-black/[0.07] dark:border-white/[0.08]`}>

      {/* ── Left: Sidebar Toggle & Screen Title / Date ── */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 shrink-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={isSidebarCollapsed ? "Expand sidebar navigation" : "Collapse sidebar"}
          className="hidden md:flex p-1.5 rounded-lg text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-[#F7F6F2] hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[19px]">
            {isSidebarCollapsed ? "dock_to_left" : "menu_open"}
          </span>
        </button>

        <div className="flex items-baseline gap-2 min-w-0">
          <span className="md:hidden text-[16px] font-bold text-[#161618] dark:text-[#F7F6F2] tracking-tight">
            {TITLE_MAP[activeTab] || 'Today'}
          </span>
          <span className="font-mono md:font-editorial text-[11px] md:text-[18px] text-[#6B6A72] md:text-[#161618] dark:text-[#8E8E93] dark:md:text-[#F7F6F2] tracking-tight whitespace-nowrap">
            {todayDateFormatted}
          </span>
        </div>

        {/* Things 3 Mini Progress Circle */}
        <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-black/[0.08] dark:border-white/[0.08]">
          <div className="relative w-4.5 h-4.5 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 -rotate-90" viewBox="0 0 36 36">
              <path className="text-black/10 dark:text-white/10" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-[#0F52BA] transition-all duration-500" strokeDasharray={`${completionPct}, 100`} strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
          </div>
          <span className="font-mono text-[10px] text-[#6B6A72] dark:text-[#8E8E93] tabular-nums whitespace-nowrap">
            {completedTasksCount}/{totalTasksCount} done
          </span>
        </div>
      </div>

      {/* ── Center: Segmented Navigation Switcher (Things 3 / Sunsama style) ── */}
      <div className="hidden md:flex items-center p-0.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-xl border border-black/[0.05] dark:border-white/[0.07] mx-2">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-[#1E1E22] text-[#161618] dark:text-[#F7F6F2] shadow-xs font-semibold'
                  : 'text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Right Controls: + New Task (Desktop), Search, Copilot, Status ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* + New Task Button (Desktop/Tablet only — Mobile uses Bottom Nav FAB) */}
        <button
          type="button"
          onClick={onOpenQuickAdd}
          className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#161618] dark:bg-[#F7F6F2] text-white dark:text-[#161618] text-[11px] font-semibold hover:opacity-90 active:scale-95 shadow-tactile transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          <span>New Task</span>
        </button>

        {/* ── Search Input ── */}
        <div className="w-[128px] sm:w-[175px] lg:w-[215px] relative">
          <span className={`material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[14px] pointer-events-none transition-colors ${
            searchFocused ? 'text-[#0F52BA]' : 'text-[#8E8E93]'
          }`}>search</span>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            className={`w-full h-7 pl-7 pr-2 sm:pr-7 rounded-lg text-[11.5px] tracking-tight outline-none border transition-all bg-white/80 dark:bg-[#1A1A1E]/80 border-black/[0.07] dark:border-white/[0.08] text-[#161618] dark:text-[#F7F6F2] placeholder:text-[#8E8E93] ${
              searchFocused ? 'bg-white dark:bg-[#1E1E22] border-[#0F52BA]/60 shadow-[0_0_0_2px_rgba(15,82,186,0.12)]' : 'hover:border-black/[0.12]'
            }`}
          />
          <kbd className="hidden sm:inline-block absolute right-1.5 top-1/2 -translate-y-1/2 px-1 py-0.2 rounded text-[8.5px] font-mono pointer-events-none border bg-black/[0.03] dark:bg-white/[0.05] text-[#8E8E93] border-black/[0.06] dark:border-white/[0.06]">⌘K</kbd>
          
          {searchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute top-full right-0 w-64 mt-1 bg-white dark:bg-[#1A1A1E] border border-black/[0.07] dark:border-white/[0.08] rounded-xl shadow-double-bezel overflow-hidden z-50">
              {topResults.length > 0 ? (
                <ul className="py-1">
                  {topResults.map((result, idx) => (
                    <li key={idx}>
                      <button
                        className="w-full text-left px-3 py-1.5 text-[11.5px] text-[#161618] dark:text-[#F7F6F2] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors flex items-center justify-between gap-2"
                        onClick={() => {
                          if (result.type === 'habit' && onEditHabit) {
                            onEditHabit(result);
                          } else if (setActiveTab) {
                            setActiveTab(result.tab);
                          }
                          setSearchQuery('');
                          setSearchFocused(false);
                        }}
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{result.title}</div>
                          <div className="text-[9.5px] font-mono text-[#8E8E93] capitalize">{result.type}</div>
                        </div>
                        {result.type === 'habit' && (
                          <span className="material-symbols-outlined text-[13px] text-[#8E8E93] shrink-0">edit</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-3 py-2 text-[11px] text-[#8E8E93]">No results found.</div>
              )}
            </div>
          )}
        </div>

      {/* ── Right Controls ── */}
      <div className="flex items-center gap-2">

        {/* AI Executive Copilot Pill */}
        <button
          type="button"
          onClick={onOpenAiCopilot}
          title="AI Executive Copilot — Upload docs & create intelligent schedules"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-[#1A1A1E] text-[#161618] dark:text-[#F7F6F2] border border-black/[0.07] dark:border-white/[0.08] hover:border-black/[0.15] dark:hover:border-white/[0.15] shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[15px] text-[#0F52BA]">
            auto_awesome
          </span>
          <span className="hidden sm:inline">Copilot</span>
        </button>

        {/* Universal UI Editor Mode Toggle (desktop only) */}
        <button
          onClick={onToggleUniversalEditor}
          title="Universal UI Editor Mode — Hold Ctrl/⌘ and click any block to resize"
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
            isUniversalEditorMode
              ? 'bg-[#161618] dark:bg-white text-white dark:text-[#161618] border-[#161618] dark:border-white shadow-xs'
              : 'bg-white dark:bg-[#1A1A1E] text-[#6B6A72] dark:text-[#8E8E93] border-black/[0.07] dark:border-white/[0.08] hover:text-[#161618] dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">
            {isUniversalEditorMode ? 'design_services' : 'edit'}
          </span>
          <span className="hidden sm:inline">
            {isUniversalEditorMode ? 'Editing UI' : 'UI Editor'}
          </span>
          {isUniversalEditorMode && (
            <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#161618] animate-pulse" />
          )}
        </button>

        {/* Sync badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium text-[#2E6F40] dark:text-[#4ADE80] bg-[#2E6F40]/10 dark:bg-[#2E6F40]/20 border border-[#2E6F40]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2E6F40] dark:bg-[#4ADE80] animate-pulse" />
          SYNCED
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-1.5 rounded-lg transition-colors text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#C84B31]" />
          </button>

          {showNotifications && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-[#1A1A1E] border border-black/[0.07] dark:border-white/[0.08] rounded-xl shadow-double-bezel overflow-hidden z-50">
              <div className="px-3.5 py-2 border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] font-mono uppercase tracking-wider text-[#6B6A72] dark:text-[#8E8E93]">
                Recent Tasks
              </div>
              <ul className="py-1 max-h-60 overflow-auto">
                {recentTasks.length > 0 ? (
                  recentTasks.map(task => (
                    <li key={task.id || task.title} className="px-3.5 py-2 text-[12px] text-[#161618] dark:text-[#F7F6F2] border-b border-black/[0.03] dark:border-white/[0.04] last:border-0">
                      <div className="truncate font-medium">{task.title}</div>
                      <div className="text-[10px] font-mono text-[#8E8E93]">
                        {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'No date'}
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="px-3.5 py-3 text-[12px] text-[#8E8E93]">No recent tasks.</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Mobile Extra Menu (Stats, Review, Config) */}
        <div className="relative md:hidden" ref={mobileMenuRef}>
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label="More options"
            className="p-1.5 rounded-lg text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-white hover:bg-black/[0.04] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">more_vert</span>
          </button>

          {showMobileMenu && (
            <div className="absolute top-full right-0 mt-1 w-44 bg-white dark:bg-[#1A1A1E] border border-black/[0.07] dark:border-white/[0.08] rounded-xl shadow-double-bezel overflow-hidden z-50 py-1 animate-fadeIn">
              <button
                onClick={() => { onOpenAiCopilot?.(); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#0F52BA] hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors"
              >
                <span className="material-symbols-outlined text-[17px] text-[#0F52BA]">auto_awesome</span>
                <span>AI Copilot</span>
              </button>
              <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.06]" />
              <button
                onClick={() => { setActiveTab('reflections'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold transition-colors ${
                  activeTab === 'reflections' ? 'text-[#0F52BA] bg-[#0F52BA]/5' : 'text-[#161618] dark:text-[#F7F6F2] hover:bg-black/[0.03]'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">auto_stories</span>
                <span>Review</span>
              </button>
              <button
                onClick={() => { setActiveTab('analytics'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold transition-colors ${
                  activeTab === 'analytics' ? 'text-[#0F52BA] bg-[#0F52BA]/5' : 'text-[#161618] dark:text-[#F7F6F2] hover:bg-black/[0.03]'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">insights</span>
                <span>Stats</span>
              </button>
              <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.06]" />
              <button
                onClick={() => { setActiveTab('settings'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold transition-colors ${
                  activeTab === 'settings' ? 'text-[#0F52BA] bg-[#0F52BA]/5' : 'text-[#161618] dark:text-[#F7F6F2] hover:bg-black/[0.03]'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">tune</span>
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  </header>
);
}
