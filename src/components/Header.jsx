import React, { useRef, useEffect, useState } from 'react';

const TITLE_MAP = {
  dashboard:   'Dashboard',
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
  setActiveTab,
  isUniversalEditorMode = false,
  onToggleUniversalEditor
}) {
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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
    goals?.forEach(g => {
      if (g.title?.toLowerCase().includes(q)) filteredResults.push({ ...g, type: 'goal', tab: 'goals' });
    });
  }
  const topResults = filteredResults.slice(0, 5);

  const recentTasks = (tasks || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 3);

  return (
    <header className="fixed top-0 left-0 md:left-[248px] right-0 h-14 md:h-12 z-40 flex items-center justify-between px-4 md:px-6 backdrop-blur-2xl border-b transition-colors duration-300 bg-white/85 border-black/[0.06]">

      {/* ── Breadcrumb & Mobile App Brand ── */}
      <div className="flex items-center gap-2">
        <div className="md:hidden w-7 h-7 rounded-lg bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-xs">M</span>
        </div>
        <div className="flex items-center gap-1.5 text-[13px] md:text-[12px]">
          <span className="hidden sm:inline text-[#BBBBC0]">Momentum</span>
          <span className="hidden sm:inline text-[#DEDEE3]">/</span>
          <span className="font-semibold tracking-tight text-[#1A1B1F]">
            {TITLE_MAP[activeTab] || 'Workspace'}
          </span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="flex-1 max-w-[220px] sm:max-w-[280px] md:max-w-[320px] mx-2 sm:mx-4 md:mx-6 relative">
        <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[15px] pointer-events-none transition-colors ${
          searchFocused ? 'text-[#0A84FF]' : 'text-[#BBBBC0]'
        }`}>search</span>
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          className={`w-full h-8 pl-8 sm:pl-9 pr-3 sm:pr-9 rounded-full md:rounded-lg text-[12px] tracking-tight outline-none border transition-all bg-[#F0EFF5] border-black/[0.06] text-[#1A1B1F] placeholder:text-[#BBBBC0] ${
            searchFocused ? 'bg-white border-[#0A84FF]/50 shadow-[0_0_0_3px_rgba(10,132,255,0.12)]' : ''
          }`}
        />
        <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1 py-0.5 rounded text-[9px] font-medium pointer-events-none border bg-black/[0.04] text-[#BBBBC0] border-black/[0.06]">⌘K</kbd>
        
        {searchFocused && searchQuery.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/[0.06] rounded-lg shadow-lg overflow-hidden z-50">
            {topResults.length > 0 ? (
              <ul className="py-1">
                {topResults.map((result, idx) => (
                  <li key={idx}>
                    <button
                      className="w-full text-left px-4 py-2 text-[12px] text-[#1A1B1F] hover:bg-[#F0EFF5] transition-colors"
                      onClick={() => {
                        if (setActiveTab) setActiveTab(result.tab);
                        setSearchQuery('');
                        setSearchFocused(false);
                      }}
                    >
                      <div className="font-medium truncate">{result.title}</div>
                      <div className="text-[10px] text-[#BBBBC0] capitalize">{result.type}</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-3 text-[12px] text-[#BBBBC0]">No results found.</div>
            )}
          </div>
        )}
      </div>

      {/* ── Right controls ── */}
      <div className="flex items-center gap-2">

        {/* Universal UI Editor Mode Toggle */}
        <button
          onClick={onToggleUniversalEditor}
          title="Universal UI Editor Mode — Hold Ctrl/⌘ and click any block to resize"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
            isUniversalEditorMode
              ? 'bg-[#0A84FF] text-white border-[#0A84FF] shadow-[0_2px_8px_rgba(10,132,255,0.35)]'
              : 'bg-black/[0.03] text-[#555] border-black/[0.06] hover:text-[#1A1B1F] hover:bg-black/[0.06]'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">
            {isUniversalEditorMode ? 'design_services' : 'edit'}
          </span>
          <span className="hidden sm:inline">
            {isUniversalEditorMode ? 'Editing UI' : 'UI Editor'}
          </span>
          {isUniversalEditorMode && (
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          )}
        </button>

        {/* Sync badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-emerald-600 bg-emerald-50">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Synced
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-1.5 rounded-lg transition-colors text-[#BBBBC0] hover:text-[#1A1B1F] hover:bg-black/[0.05]"
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
          </button>

          {showNotifications && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-black/[0.06] rounded-lg shadow-lg overflow-hidden z-50">
              <div className="px-4 py-2 border-b border-black/[0.06] text-[12px] font-semibold text-[#1A1B1F]">
                Recent Tasks
              </div>
              <ul className="py-1 max-h-60 overflow-auto">
                {recentTasks.length > 0 ? (
                  recentTasks.map(task => (
                    <li key={task.id || task.title} className="px-4 py-2 text-[12px] text-[#1A1B1F] border-b border-black/[0.03] last:border-0">
                      <div className="truncate font-medium">{task.title}</div>
                      <div className="text-[10px] text-[#BBBBC0]">
                        {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'No date'}
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-3 text-[12px] text-[#BBBBC0]">No recent tasks.</li>
                )}
              </ul>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
