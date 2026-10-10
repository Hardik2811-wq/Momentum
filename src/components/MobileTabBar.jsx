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
      bgClass: 'bg-[#0F52BA] text-white',
      shadow: 'shadow-[0_4px_14px_rgba(15,82,186,0.35)]',
      animClass: 'animate-in fade-in slide-in-from-bottom-6 duration-200 delay-150',
      action: onOpenAiCopilot
    },
    {
      id: 'goal',
      label: 'New Goal',
      icon: 'flag',
      bgClass: 'bg-[#C84B31] text-white',
      shadow: 'shadow-[0_4px_14px_rgba(200,75,49,0.35)]',
      animClass: 'animate-in fade-in slide-in-from-bottom-5 duration-200 delay-100',
      action: onOpenNewGoal
    },
    {
      id: 'habit',
      label: 'New Habit',
      icon: 'cached',
      bgClass: 'bg-[#2E6F40] text-white',
      shadow: 'shadow-[0_4px_14px_rgba(46,111,64,0.35)]',
      animClass: 'animate-in fade-in slide-in-from-bottom-4 duration-200 delay-75',
      action: onOpenNewHabit
    },
    {
      id: 'task',
      label: 'New Task',
      icon: 'task_alt',
      bgClass: 'bg-[#161618] dark:bg-[#F7F6F2] text-white dark:text-[#161618]',
      shadow: 'shadow-[0_4px_14px_rgba(0,0,0,0.25)]',
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FBFBFA]/95 dark:bg-[#161619]/95 backdrop-blur-2xl border-t border-black/[0.07] dark:border-white/[0.08] px-3 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between max-w-md mx-auto relative">
          
          {/* Vertical Staggered Speed Dial */}
          {isOpen && (
            <div
              role="menu"
              aria-label="Create new item"
              className="absolute bottom-[68px] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 select-none"
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
                  <div className="absolute right-[54px] whitespace-nowrap">
                    <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E1E22] border border-black/[0.07] dark:border-white/[0.08] shadow-double-bezel text-[12px] font-semibold text-[#161618] dark:text-[#F7F6F2] tracking-tight group-hover:scale-105 group-active:scale-95 transition-all">
                      {item.label}
                    </span>
                  </div>

                  {/* Circular Button aligned vertically with center FAB */}
                  <div className={`w-11 h-11 rounded-full ${item.bgClass} flex items-center justify-center ${item.shadow} group-hover:scale-105 group-active:scale-95 transition-all`}>
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
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
                className={`flex-1 min-w-[56px] min-h-[44px] flex flex-col items-center justify-center py-0.5 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'text-[#161618] dark:text-[#F7F6F2] font-semibold'
                    : 'text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-white font-medium'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[22px] transition-colors ${
                    isActive ? 'text-[#0F52BA] dark:text-[#6495ED]' : ''
                  }`}
                  style={{ fontVariationSettings: isActive ? '"FILL" 1, "wght" 500' : '"FILL" 0, "wght" 400' }}
                >
                  {item.icon}
                </span>
                <span className="text-[10.5px] tracking-tight mt-0.5">
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-[#0F52BA] dark:bg-[#6495ED] mt-0.5" />
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
                  setIsOpen(true);
                }
              }}
              aria-label={isOpen ? 'Close creation menu' : 'Open creation menu'}
              aria-expanded={isOpen}
              className={`w-11 h-11 rounded-full flex items-center justify-center shadow-double-bezel active:scale-95 transition-all duration-200 -mt-2 cursor-pointer ${
                isOpen
                  ? 'bg-white dark:bg-[#1E1E22] text-[#161618] dark:text-white border border-black/[0.08] dark:border-white/[0.08] rotate-45'
                  : 'bg-[#161618] dark:bg-[#F7F6F2] text-white dark:text-[#161618] rotate-0'
              }`}
            >
              <span className="material-symbols-outlined text-[23px]">add</span>
            </button>
          </div>

          {/* Right 2 Tabs */}
          {NAV_ITEMS_RIGHT.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex-1 min-w-[56px] min-h-[44px] flex flex-col items-center justify-center py-0.5 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'text-[#161618] dark:text-[#F7F6F2] font-semibold'
                    : 'text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-white font-medium'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[22px] transition-colors ${
                    isActive ? 'text-[#0F52BA] dark:text-[#6495ED]' : ''
                  }`}
                  style={{ fontVariationSettings: isActive ? '"FILL" 1, "wght" 500' : '"FILL" 0, "wght" 400' }}
                >
                  {item.icon}
                </span>
                <span className="text-[10.5px] tracking-tight mt-0.5">
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-[#0F52BA] dark:bg-[#6495ED] mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
