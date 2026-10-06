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
  onOpenNewHabit,
  onOpenAiCopilot
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

  const speedDialItems = [
    {
      id: 'ai-copilot',
      label: 'AI Copilot',
      icon: 'auto_awesome',
      gradient: 'from-[#0A84FF] via-[#8B5CF6] to-[#EC4899]',
      shadow: 'shadow-[0_4px_14px_rgba(139,92,246,0.45)]',
      animClass: 'animate-in fade-in slide-in-from-bottom-6 duration-200 delay-150',
      action: onOpenAiCopilot
    },
    {
      id: 'goal',
      label: 'New Goal',
      icon: 'flag',
      gradient: 'from-[#F59E0B] to-[#EA580C]',
      shadow: 'shadow-[0_4px_14px_rgba(245,158,11,0.4)]',
      animClass: 'animate-in fade-in slide-in-from-bottom-5 duration-200 delay-100',
      action: onOpenNewGoal
    },
    {
      id: 'habit',
      label: 'New Habit',
      icon: 'cached',
      gradient: 'from-[#8B5CF6] to-[#6366F1]',
      shadow: 'shadow-[0_4px_14px_rgba(139,92,246,0.4)]',
      animClass: 'animate-in fade-in slide-in-from-bottom-4 duration-200 delay-75',
      action: onOpenNewHabit
    },
    {
      id: 'task',
      label: 'New Task',
      icon: 'task_alt',
      gradient: 'from-[#0A84FF] to-[#5E5CE6]',
      shadow: 'shadow-[0_4px_14px_rgba(10,132,255,0.4)]',
      animClass: 'animate-in fade-in slide-in-from-bottom-3 duration-150',
      action: onOpenQuickAdd
    }
  ];

  return (
    <>
      {/* Background backdrop dismissal */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border-t border-black/[0.08] dark:border-white/[0.08] px-3 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between max-w-md mx-auto relative">
          
          {/* Vertical Staggered Speed Dial (Material 3 / Notion style) */}
          {isOpen && (
            <div
              role="menu"
              aria-label="Create new item"
              className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3.5 select-none"
            >
              {speedDialItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    item.action?.();
                  }}
                  className={`relative flex items-center justify-center group cursor-pointer focus:outline-none ${item.animClass}`}
                >
                  {/* Floating Pill Label on the left */}
                  <div className="absolute right-[56px] whitespace-nowrap">
                    <span className="px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.14)] text-[12px] font-bold text-[#1A1B1F] dark:text-white tracking-tight group-hover:scale-105 group-active:scale-95 transition-all">
                      {item.label}
                    </span>
                  </div>

                  {/* Circular Button aligned vertically with center FAB */}
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-tr ${item.gradient} text-white flex items-center justify-center ${item.shadow} group-hover:scale-110 group-active:scale-90 transition-all`}>
                    <span className="material-symbols-outlined text-[21px]">{item.icon}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Left 2 Tabs */}
          {NAV_ITEMS_LEFT.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex-1 min-w-[56px] min-h-[44px] flex flex-col items-center justify-center py-0.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'text-[#0A84FF] font-bold scale-[1.08] bg-[#0A84FF]/[0.06] dark:bg-[#0A84FF]/10'
                    : 'text-[#8E8E93] hover:text-[#1A1B1F] dark:hover:text-white font-medium hover:scale-105'
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
              onClick={() => {
                if (isOpen) {
                  setIsOpen(false);
                  return;
                }
                if (activeTab === 'dashboard') {
                  onOpenQuickAdd?.();
                } else if (activeTab === 'goals') {
                  onOpenNewGoal?.();
                } else if (activeTab === 'habits') {
                  onOpenNewHabit?.();
                } else {
                  // In Planner (activeTab === 'today'), open multi-option speed dial
                  setIsOpen(true);
                }
              }}
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
                className={`flex-1 min-w-[56px] min-h-[44px] flex flex-col items-center justify-center py-0.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'text-[#0A84FF] font-bold scale-[1.08] bg-[#0A84FF]/[0.06] dark:bg-[#0A84FF]/10'
                    : 'text-[#8E8E93] hover:text-[#1A1B1F] dark:hover:text-white font-medium hover:scale-105'
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
