import React from 'react';

const NAV_ITEMS_LEFT = [
  { id: 'dashboard', label: 'Today',   icon: 'space_dashboard' },
  { id: 'today',     label: 'Planner', icon: 'calendar_month' },
];

const NAV_ITEMS_RIGHT = [
  { id: 'goals',     label: 'Goals',   icon: 'flag' },
  { id: 'habits',    label: 'Habits',  icon: 'cached' },
];

export default function MobileTabBar({ activeTab, setActiveTab, onOpenQuickAdd }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border-t border-black/[0.08] dark:border-white/[0.08] px-3 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between max-w-md mx-auto relative">
        {/* Left 2 Tabs */}
        {NAV_ITEMS_LEFT.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
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
              <span className={`text-[11px] tracking-tight mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
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
            onClick={onOpenQuickAdd}
            aria-label="Quick Add Task"
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0A84FF] to-[#5E5CE6] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(10,132,255,0.4)] active:scale-90 transition-transform -mt-2.5 cursor-pointer"
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
              onClick={() => setActiveTab(item.id)}
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
              <span className={`text-[11px] tracking-tight mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
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
  );
}
