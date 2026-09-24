import React from 'react';

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard', icon: 'space_dashboard' },
  { id: 'today',       label: 'Planner',   icon: 'calendar_view_week' },
  { id: 'goals',       label: 'Goals',     icon: 'flag_circle' },
  { id: 'habits',      label: 'Habits',    icon: 'loop' },
  { id: 'reflections', label: 'Review',    icon: 'auto_stories' },
  { id: 'analytics',   label: 'Stats',     icon: 'insights' },
  { id: 'settings',    label: 'Config',    icon: 'tune' },
];

export default function MobileTabBar({ activeTab, setActiveTab, onOpenQuickAdd }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-2xl border-t border-black/[0.08] px-2 py-1.5 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around relative">
        {NAV_ITEMS.map((item, idx) => {
          const isActive = activeTab === item.id;
          // Insert Quick Add button in the middle if needed, or keep compact 6 items
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
                isActive
                  ? 'text-[#0A84FF]'
                  : 'text-[#8E8E93] hover:text-[#1A1B1F]'
              }`}
            >
              <span
                className="material-symbols-outlined text-[22px] transition-transform active:scale-90"
                style={{ fontVariationSettings: isActive ? '"FILL" 1' : '"FILL" 0' }}
              >
                {item.icon}
              </span>
              <span className={`text-[10px] tracking-tight mt-0.5 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-1 w-4 h-0.5 rounded-full bg-[#0A84FF]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
