import React, { useState, useEffect } from 'react';

const NAV_ITEMS_LEFT = [
  { id: 'dashboard', label: 'Today',   icon: 'space_dashboard' },
  { id: 'today',     label: 'Planner', icon: 'calendar_month' },
];

const NAV_ITEMS_RIGHT = [
  { id: 'goals',     label: 'Goals',   icon: 'flag' },
  { id: 'habits',    label: 'Habits',  icon: 'cached' },
];

export default function MobileTabBar({
  activeTab,
  setActiveTab,
  onOpenQuickAdd,
  onOpenNewGoal,
  onOpenNewHabit
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Close speed dial on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleTabClick = (tabId) => {
    setIsOpen(false);
    setActiveTab(tabId);
  };

  return (
    <>
      {/* Background backdrop dismissal */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border-t border-black/[0.08] dark:border-white/[0.08] px-3 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between max-w-md mx-auto relative">
          
          {/* Speed Dial Popup with 3 Small Circular Buttons */}
          {isOpen && (
            <div
              role="menu"
              aria-label="Create new item"
              className="absolute bottom-[66px] left-1/2 -translate-x-1/2 z-50 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.08] px-5 py-3 rounded-3xl shadow-[0_16px_40px_rgba(0,0,0,0.22)] flex items-center gap-5 animate-in fade-in zoom-in-95 duration-200 select-none"
            >
              {/* Button 1: New Task */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenQuickAdd?.();
                }}
                className="flex flex-col items-center gap-1 group cursor-pointer focus:outline-none"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#0A84FF] to-[#5E5CE6] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(10,132,255,0.4)] group-active:scale-90 group-hover:scale-105 transition-all">
                  <span className="material-symbols-outlined text-[21px]">task_alt</span>
                </div>
                <span className="text-[11px] font-bold text-[#1A1B1F] dark:text-white tracking-tight">
                  Task
                </span>
              </button>

              {/* Button 2: New Habit */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenNewHabit?.();
                }}
                className="flex flex-col items-center gap-1 group cursor-pointer focus:outline-none"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#6366F1] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(139,92,246,0.4)] group-active:scale-90 group-hover:scale-105 transition-all">
                  <span className="material-symbols-outlined text-[21px]">cached</span>
                </div>
                <span className="text-[11px] font-bold text-[#1A1B1F] dark:text-white tracking-tight">
                  Habit
                </span>
              </button>

              {/* Button 3: New Goal */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenNewGoal?.();
                }}
                className="flex flex-col items-center gap-1 group cursor-pointer focus:outline-none"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#F59E0B] to-[#EA580C] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(245,158,11,0.4)] group-active:scale-90 group-hover:scale-105 transition-all">
                  <span className="material-symbols-outlined text-[21px]">flag</span>
                </div>
                <span className="text-[11px] font-bold text-[#1A1B1F] dark:text-white tracking-tight">
                  Goal
                </span>
              </button>

              {/* Bottom Caret Pointer */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-[#1C1C1E] rotate-45 border-r border-b border-black/[0.08] dark:border-white/[0.08]" />
            </div>
          )}

          {/* Left 2 Tabs */}
          {NAV_ITEMS_LEFT.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex-1 min-w-[56px] min-h-[44px] flex flex-col items-center justify-center py-0.5 rounded-xl transition-all ${
                  isActive
                    ? 'text-[#0A84FF] font-bold'
                    : 'text-[#8E8E93] hover:text-[#1A1B1F] dark:hover:text-white font-medium'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[23px] transition-transform active:scale-90"
                  style={{ fontVariationSettings: isActive ? '"FILL" 1' : '"FILL" 0' }}
                >
                  {item.icon}
                </span>
                <span className={`text-[11px] font-display tracking-tight mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-4 h-0.5 rounded-full bg-[#0A84FF] mt-0.5" />
                )}
              </button>
            );
          })}

          {/* Center Primary Creation CTA */}
          <div className="flex items-center justify-center px-1">
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-label={isOpen ? 'Close creation menu' : 'Open creation menu'}
              aria-expanded={isOpen}
              className={`w-12 h-12 rounded-full text-white flex items-center justify-center shadow-[0_4px_16px_rgba(10,132,255,0.4)] active:scale-90 transition-all duration-200 -mt-2.5 cursor-pointer ${
                isOpen
                  ? 'bg-[#1C1C1E] dark:bg-white text-white dark:text-[#1C1C1E] shadow-[0_4px_16px_rgba(0,0,0,0.3)] rotate-45'
                  : 'bg-gradient-to-tr from-[#0A84FF] to-[#5E5CE6] rotate-0'
              }`}
            >
              <span className="material-symbols-outlined text-[26px]">add</span>
            </button>
          </div>

          {/* Right 2 Tabs */}
          {NAV_ITEMS_RIGHT.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex-1 min-w-[56px] min-h-[44px] flex flex-col items-center justify-center py-0.5 rounded-xl transition-all ${
                  isActive
                    ? 'text-[#0A84FF] font-bold'
                    : 'text-[#8E8E93] hover:text-[#1A1B1F] dark:hover:text-white font-medium'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[23px] transition-transform active:scale-90"
                  style={{ fontVariationSettings: isActive ? '"FILL" 1' : '"FILL" 0' }}
                >
                  {item.icon}
                </span>
                <span className={`text-[11px] font-display tracking-tight mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-4 h-0.5 rounded-full bg-[#0A84FF] mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
