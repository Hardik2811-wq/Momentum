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

  // Close action sheet on Escape key
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

  const quickCreateActions = [
    {
      id: 'task',
      label: 'New Task',
      sublabel: 'Action item or schedule block',
      icon: 'task_alt',
      iconBg: 'bg-[#161618] dark:bg-[#F7F6F2] text-white dark:text-[#161618]',
      action: onOpenQuickAdd
    },
    {
      id: 'habit',
      label: 'New Habit',
      sublabel: 'Recurring daily sequence',
      icon: 'cached',
      iconBg: 'bg-[#2E6F40] text-white',
      action: onOpenNewHabit
    },
    {
      id: 'goal',
      label: 'New Goal',
      sublabel: 'Horizon target & milestones',
      icon: 'flag',
      iconBg: 'bg-[#C84B31] text-white',
      action: onOpenNewGoal
    },
    {
      id: 'ai-copilot',
      label: 'AI Copilot',
      sublabel: 'Generate schedule from syllabus',
      icon: 'auto_awesome',
      iconBg: 'bg-[#0F52BA] text-white',
      action: onOpenAiCopilot
    }
  ];

  const renderTabButton = (item) => {
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleTabClick(item.id)}
        className={`flex-1 min-w-[60px] min-h-[52px] flex flex-col items-center justify-center py-1 rounded-2xl transition-all duration-200 cursor-pointer select-none active:scale-95 ${
          isActive
            ? 'text-[#161618] dark:text-[#F7F6F2] font-bold'
            : 'text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-white font-medium'
        }`}
      >
        {/* Material 3 Active Pill Indicator */}
        <div
          className={`w-14 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
            isActive
              ? 'bg-[#0F52BA]/14 dark:bg-[#6495ED]/20 text-[#0F52BA] dark:text-[#6495ED]'
              : 'bg-transparent'
          }`}
        >
          <span
            className="material-symbols-outlined text-[21px] transition-transform duration-200"
            style={{ fontVariationSettings: isActive ? '"FILL" 1, "wght" 600' : '"FILL" 0, "wght" 400' }}
          >
            {item.icon}
          </span>
        </div>
        <span className="text-[10.5px] tracking-tight mt-0.5 leading-none">
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Android Action Sheet Backdrop & Drawer */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-[3px] flex items-end justify-center animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Quick create menu"
        >
          <div
            className="w-full max-w-md bg-[#F7F6F2] dark:bg-[#1A1A1E] rounded-t-[28px] border-t border-black/[0.08] dark:border-white/[0.08] px-4 pt-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-16px_48px_rgba(0,0,0,0.28)] animate-androidSheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Android Sheet Drag Handle */}
            <div className="w-9 h-1 rounded-full bg-black/15 dark:bg-white/20 mx-auto mb-3" />

            <div className="flex items-center justify-between px-1 mb-3">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B6A72] dark:text-[#8E8E93]">
                  Quick Capture
                </span>
                <h3 className="font-editorial text-[18px] text-[#161618] dark:text-[#F7F6F2] tracking-tight leading-tight">
                  Create in Momentum
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-black/[0.05] dark:bg-white/[0.06] flex items-center justify-center text-[#6B6A72] dark:text-[#8E8E93]"
                aria-label="Close menu"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {quickCreateActions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    item.action?.();
                  }}
                  className="flex flex-col items-start gap-2 p-3.5 rounded-2xl bg-white dark:bg-[#222227] border border-black/[0.07] dark:border-white/[0.08] shadow-xs active:scale-[0.98] transition-all text-left cursor-pointer"
                >
                  <div className={`w-9 h-9 rounded-xl ${item.iconBg} flex items-center justify-center shadow-xs`}>
                    <span className="material-symbols-outlined text-[19px]">{item.icon}</span>
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[#161618] dark:text-[#F7F6F2] tracking-tight">
                      {item.label}
                    </div>
                    <div className="text-[10.5px] text-[#6B6A72] dark:text-[#8E8E93] leading-snug mt-0.5">
                      {item.sublabel}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Material 3 Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FBFBFA]/96 dark:bg-[#151518]/96 backdrop-blur-2xl border-t border-black/[0.07] dark:border-white/[0.08] px-2 pt-1 pb-[max(0.45rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between max-w-md mx-auto relative">
          {/* Left 2 Tabs */}
          {NAV_ITEMS_LEFT.map(renderTabButton)}

          {/* Center Android Squircle Creation FAB */}
          <div className="flex items-center justify-center px-1.5">
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-label={isOpen ? 'Close creation sheet' : 'Open creation sheet'}
              aria-expanded={isOpen}
              className={`w-12 h-11 rounded-2xl flex items-center justify-center shadow-[0_6px_16px_rgba(15,82,186,0.28)] active:scale-92 transition-all duration-200 cursor-pointer ${
                isOpen
                  ? 'bg-white dark:bg-[#242429] text-[#161618] dark:text-white border border-black/[0.1] dark:border-white/[0.12] rotate-45'
                  : 'bg-[#0F52BA] dark:bg-[#3B82F6] text-white rotate-0'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">add</span>
            </button>
          </div>

          {/* Right 2 Tabs */}
          {NAV_ITEMS_RIGHT.map(renderTabButton)}
        </div>
      </nav>
    </>
  );
}

