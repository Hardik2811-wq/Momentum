const fs = require('fs');
const file_path = 'd:\\Projects\\Momentum\\src\\views\\HabitsView.jsx';
let content = fs.readFileSync(file_path, 'utf-8');

// 1. Imports
content = content.replace(
    /import React from 'react';/,
    `import React, { useState } from 'react';\nimport { calcStreak, last7Days, todayKey, DAY_LABELS } from '../store/useStore';`
);

// 2. Component signature
content = content.replace(
    /export default function HabitsView\(\{.*?\}\) \{/,
    `export default function HabitsView({ habits = [], checkInHabit, addHabit, deleteHabit, useGraceDay, stats = {} }) {\n  const [dailyToggle, setDailyToggle] = useState('Daily');\n  const [showNewHabit, setShowNewHabit] = useState(false);\n  const [showGraceInfo, setShowGraceInfo] = useState(true);\n  const [activeDropdown, setActiveDropdown] = useState(null);\n  const [newHabitForm, setNewHabitForm] = useState({ title: '', duration: '', icon: '', linkedGoal: '', description: '' });\n\n  const completionPct = stats.totalHabits ? Math.round((stats.habitsCompletedToday / stats.totalHabits) * 100) : 0;\n  const totalGraceDays = habits.reduce((acc, h) => acc + (h.graceDays || 0), 0);`
);

// 3. New Habit button
content = content.replace(
    /<button className="flex items-center gap-gutter-sm px-gutter-lg py-2\.5 rounded-full bg-primary-container text-on-primary-container hover:bg-primary transition-all shadow-sm active:scale-\[0\.98\]">\s*<span className="material-symbols-outlined text-\[20px\]">add<\/span>\s*<span className="font-label-md text-label-md">New Habit<\/span>\s*<\/button>/,
    `<button onClick={() => setShowNewHabit(true)} className="flex items-center gap-gutter-sm px-gutter-lg py-2.5 rounded-full bg-primary-container text-on-primary-container hover:bg-primary transition-all shadow-sm active:scale-[0.98]">
<span className="material-symbols-outlined text-[20px]">add</span>
<span className="font-label-md text-label-md">New Habit</span>
</button>`
);

// 4. Grace Protocol button
content = content.replace(
    /<button className="flex items-center gap-gutter-sm px-gutter-lg py-2\.5 rounded-full bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-all shadow-sm active:scale-\[0\.98\]" id="grace-popover-trigger">/,
    `<button onClick={() => setShowGraceInfo(!showGraceInfo)} className="flex items-center gap-gutter-sm px-gutter-lg py-2.5 rounded-full bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-all shadow-sm active:scale-[0.98]" id="grace-popover-trigger">`
);

// 5. Metrics
content = content.replace(
    /<span className="absolute font-label-sm text-label-sm text-on-surface">94%<\/span>/,
    `<span className="absolute font-label-sm text-label-sm text-on-surface">{completionPct}%</span>`
);

content = content.replace(
    /<span>24 of 28 targets checked<\/span>/,
    `<span>{stats.habitsCompletedToday || 0} of {stats.totalHabits || 0} targets checked</span>`
);

content = content.replace(
    /<div className="font-title text-title text-on-surface">2 Grace Days Ready<\/div>/,
    `<div className="font-title text-title text-on-surface">{totalGraceDays} Grace Days Ready</div>`
);

content = content.replace(
    /<span className="font-title text-title text-on-surface">34d<\/span>/,
    `<span className="font-title text-title text-on-surface">{stats.longestStreak || 0}d</span>`
);

// 6. Daily / Weekly Toggle
content = content.replace(
    /<button className="px-gutter-md py-1 rounded-full bg-surface-container-lowest text-on-surface shadow-sm transition-all">Daily<\/button>\s*<button className="px-gutter-md py-1 rounded-full hover:text-on-surface transition-all">Weekly<\/button>/,
    `<button onClick={() => setDailyToggle('Daily')} className={\`px-gutter-md py-1 rounded-full transition-all \${dailyToggle === 'Daily' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'hover:text-on-surface'}\`}>Daily</button>\n<button onClick={() => setDailyToggle('Weekly')} className={\`px-gutter-md py-1 rounded-full transition-all \${dailyToggle === 'Weekly' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'hover:text-on-surface'}\`}>Weekly</button>`
);
content = content.replace(/4 Tracked/, `{habits.length} Tracked`);

// 7. Habit Cards Map
const parts = content.split("{/* Habit Card 1: Morning Deep Work */}");
if (parts.length === 2) {
    const start_part = parts[0];
    const parts2 = parts[1].split("{/* Right Column: Non-Punitive Grace Popover Mockup & Quick Reflections (4 cols) */}");
    const end_part = "{/* Right Column: Non-Punitive Grace Popover Mockup & Quick Reflections (4 cols) */}\n" + parts2[1];
    
    const habit_map_str = `
{habits.map(habit => {
  const streakInfo = stats.habitStreaks?.find(s => s.id === habit.id);
  const streak = streakInfo ? streakInfo.streak : calcStreak(habit.completedDays || []);
  
  return (
    <div key={habit.id} className="group relative rounded-2xl bg-surface-container-lowest p-gutter-lg sm:p-gutter-xl shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-gutter-base pb-gutter-md">
        <div className="flex items-start gap-gutter-base min-w-0">
          <div className={\`w-12 h-12 rounded-2xl bg-\${habit.colorToken || 'primary'}-fixed flex items-center justify-center text-on-\${habit.colorToken || 'primary'}-fixed-variant flex-shrink-0 shadow-sm\`}>
            <span className="material-symbols-outlined text-[24px]">{habit.icon || 'star'}</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-gutter-sm">
              <h3 className="font-title text-title text-on-surface truncate">{habit.title}</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low font-caption text-caption text-on-surface-variant">{habit.duration}</span>
              {habit.linkedGoal && (
                <a className={\`font-label-sm text-label-sm text-\${habit.colorToken || 'primary'} hover:underline flex items-center gap-0.5\`} href="#">
                  <span>→ {habit.linkedGoal}</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
                </a>
              )}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{habit.description}</p>
          </div>
        </div>
        <div className="flex md:flex-col items-end justify-between md:justify-center gap-1 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low">
            <span className="material-symbols-outlined text-[18px] text-on-surface" style={{ 'fontVariationSettings': "\\"FILL\\" 1" }}>local_fire_department</span>
            <span className="font-title text-title text-on-surface tracking-tight">{streak} Days</span>
          </div>
          <div className="flex items-center gap-1 text-secondary font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[15px]" style={{ 'fontVariationSettings': "\\"FILL\\" 1" }}>verified_user</span>
            <span>Shield Active ({habit.graceDays || 0} stored)</span>
          </div>
        </div>
      </div>
      
      <div className="pt-gutter-base mt-gutter-xs flex flex-col sm:flex-row sm:items-center justify-between gap-gutter-md">
        <div className="flex items-center gap-2">
          {last7Days().map((dayStr, idx) => {
            const isToday = dayStr === todayKey();
            const isCompleted = habit.completedDays?.includes(dayStr);
            const jsDayOfWeek = new Date(dayStr).getDay();
            const dayLabel = DAY_LABELS[jsDayOfWeek] || 'D';
            
            if (isToday) {
              return (
                <div key={dayStr} className="flex flex-col items-center gap-1.5">
                  <span className={\`font-caption text-caption text-\${habit.colorToken || 'primary'} font-bold\`}>{dayLabel}</span>
                  <button onClick={() => checkInHabit(habit.id)} className={\`w-9 h-9 rounded-xl \${isCompleted ? \`bg-\${habit.colorToken || 'primary'} text-on-\${habit.colorToken || 'primary'}\` : 'bg-surface-container text-on-surface'} flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-transform\`} title="Check in today">
                    <span className="material-symbols-outlined text-[18px]">{isCompleted ? 'done' : 'radio_button_unchecked'}</span>
                  </button>
                </div>
              );
            }
            
            return (
              <div key={dayStr} className="flex flex-col items-center gap-1.5">
                <span className="font-caption text-caption text-on-surface-variant">{dayLabel}</span>
                <div className={\`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs \${isCompleted ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-outline'}\`}>
                  {isCompleted ? <span className="material-symbols-outlined text-[18px] font-semibold">check</span> : <span className="text-[12px] font-bold">-</span>}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="flex items-center gap-gutter-sm self-end sm:self-center relative">
          <span className="font-caption text-caption text-on-surface-variant">Today's Block</span>
          <button onClick={() => setActiveDropdown(activeDropdown === habit.id ? null : habit.id)} className="p-1.5 rounded-full hover:bg-surface-container text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-[18px]">more_horiz</span>
          </button>
          {activeDropdown === habit.id && (
            <div className="absolute top-full right-0 mt-1 w-32 bg-surface-container-highest rounded-lg shadow-lg py-1 z-50 overflow-hidden">
              <button onClick={() => { if(window.confirm('Delete habit?')) { deleteHabit(habit.id); setActiveDropdown(null); } }} className="w-full text-left px-4 py-2 text-sm text-error hover:bg-surface-container transition-colors">Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
})}
`;
    content = start_part + habit_map_str + end_part;
}

// 8. Hide/show Grace protocol based on showGraceInfo
content = content.replace(
    /<div className="rounded-3xl bg-surface-container-lowest p-gutter-xl shadow-\[0_8px_30px_rgba\(0,0,0,0\.06\)\] relative overflow-hidden">/,
    `{showGraceInfo && (\n<div className="rounded-3xl bg-surface-container-lowest p-gutter-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] relative overflow-hidden">`
);
content = content.replace(
    /Healthy habit design<\/span>\s*<\/div>\s*<\/div>/,
    `Healthy habit design</span>\n</div>\n</div>\n)}`
);

// 9. New Habit Modal
const modal_html = `
      {showNewHabit && (
        <div className="fixed inset-0 bg-surface/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-md shadow-lg border border-outline-variant">
            <h2 className="text-xl font-semibold mb-4 text-on-surface">New Habit</h2>
            <div className="space-y-4">
              <input className="w-full bg-surface-container p-3 rounded-xl text-on-surface" placeholder="Title" value={newHabitForm.title} onChange={e => setNewHabitForm({...newHabitForm, title: e.target.value})} />
              <input className="w-full bg-surface-container p-3 rounded-xl text-on-surface" placeholder="Duration (e.g. 30 mins)" value={newHabitForm.duration} onChange={e => setNewHabitForm({...newHabitForm, duration: e.target.value})} />
              <input className="w-full bg-surface-container p-3 rounded-xl text-on-surface" placeholder="Icon (Material Symbol)" value={newHabitForm.icon} onChange={e => setNewHabitForm({...newHabitForm, icon: e.target.value})} />
              <input className="w-full bg-surface-container p-3 rounded-xl text-on-surface" placeholder="Linked Goal" value={newHabitForm.linkedGoal} onChange={e => setNewHabitForm({...newHabitForm, linkedGoal: e.target.value})} />
              <input className="w-full bg-surface-container p-3 rounded-xl text-on-surface" placeholder="Description" value={newHabitForm.description} onChange={e => setNewHabitForm({...newHabitForm, description: e.target.value})} />
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowNewHabit(false)} className="px-4 py-2 rounded-full text-on-surface-variant hover:bg-surface-container">Cancel</button>
                <button onClick={() => { addHabit({...newHabitForm, id: Date.now().toString(), completedDays: [], graceDays: 0, colorToken: 'primary'}); setShowNewHabit(false); setNewHabitForm({title:'', duration:'', icon:'', linkedGoal:'', description:''}); }} className="px-4 py-2 rounded-full bg-primary text-on-primary">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
`;
content = content.replace(
    /<\/main>/,
    modal_html + "\n    </main>"
);

fs.writeFileSync(file_path, content, 'utf-8');
console.log('Done!');
