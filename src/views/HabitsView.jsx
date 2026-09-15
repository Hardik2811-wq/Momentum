import React, { useState } from 'react';
import { calcStreak, last7Days, todayKey, DAY_LABELS } from '../store/useStore';

const HABIT_COLOR_CLASSES = {
  primary: { fixed: 'bg-primary-fixed text-on-primary-fixed-variant', text: 'text-primary', checked: 'bg-primary text-on-primary' },
  secondary: { fixed: 'bg-secondary-fixed text-on-secondary-fixed-variant', text: 'text-secondary', checked: 'bg-secondary text-on-secondary' },
  tertiary: { fixed: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', text: 'text-tertiary', checked: 'bg-tertiary text-on-tertiary' }
};

export default function HabitsView({ habits = [], checkInHabit, addHabit, deleteHabit, useGraceDay, stats = {} }) {
  const [dailyToggle, setDailyToggle] = useState('Daily');
  const [showNewHabit, setShowNewHabit] = useState(false);
  const [showGraceInfo, setShowGraceInfo] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [newHabitForm, setNewHabitForm] = useState({ title: '', duration: '', icon: '', linkedGoal: '', description: '' });

  const completionPct = stats.totalHabits ? Math.round((stats.habitsCompletedToday / stats.totalHabits) * 100) : 0;
  const totalGraceDays = habits.reduce((acc, h) => acc + (h.graceDays || 0), 0);
  return (
    <main className="w-full pt-16 md:pt-12 px-4 sm:px-6 md:px-margin-desktop py-4 sm:py-gutter-xl min-h-screen bg-surface">
      <div className="flex flex-col w-full space-y-4 sm:space-y-gutter-2xl">
{/* Dynamic Atmospheric Glow Accent */}
<div className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-surface-container-lowest via-surface-container-low to-surface-container-lowest p-gutter-xl shadow-sm">
<div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-fixed-dim/30 blur-3xl pointer-events-none"></div>
<div className="absolute -left-12 -bottom-12 h-56 w-56 rounded-full bg-secondary-fixed/40 blur-3xl pointer-events-none"></div>
<div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-gutter-lg">
<div className="space-y-gutter-xs">
<div className="flex items-center gap-gutter-sm">
<span className="px-gutter-sm py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">Mindful Momentum</span>
<span className="flex items-center gap-1 font-caption text-caption text-secondary">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            Live Sync Active
          </span>
</div>
<h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Habits &amp; Streaks</h1>
<p className="font-body-md text-body-md text-on-surface-variant">Calibrated consistency without burnout. Built with graceful resilience.</p>
</div>
<div className="flex items-center gap-gutter-md self-stretch sm:self-auto">
<button onClick={() => setShowGraceInfo(!showGraceInfo)} className="flex items-center gap-gutter-sm px-gutter-lg py-2.5 rounded-full bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-all shadow-sm active:scale-[0.98]" id="grace-popover-trigger">
<span className="material-symbols-outlined text-[20px] text-tertiary">shield_with_heart</span>
<span className="font-label-md text-label-md">Grace Protocol</span>
</button>
<button onClick={() => setShowNewHabit(true)} className="flex items-center gap-gutter-sm px-gutter-lg py-2.5 rounded-full bg-primary-container text-on-primary-container hover:bg-primary transition-all shadow-sm active:scale-[0.98]">
<span className="material-symbols-outlined text-[20px]">add</span>
<span className="font-label-md text-label-md">New Habit</span>
</button>
</div>
</div>
{/* Apple Health Ring Inspired Status Bar */}
<div className="mt-gutter-xl pt-gutter-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-gutter-lg">
<div className="flex-1 flex flex-wrap items-center gap-gutter-xl">
{/* SVG Radial Multi-Ring Visualizer */}
<div className="flex items-center gap-gutter-md">
<div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
<svg className="w-full h-full -rotate-90" viewBox="0 0 52 52">
<circle className="stroke-surface-container-highest fill-none" cx="26" cy="26" r="21" strokeWidth="4.5" />
<circle className="stroke-secondary fill-none transition-all duration-1000 ease-out" cx="26" cy="26" r="21" strokeDasharray="131.9" strokeDashoffset="8" strokeLinecap="round" strokeWidth="4.5" />
<circle className="stroke-surface-container-highest fill-none" cx="26" cy="26" r="14" strokeWidth="4" />
<circle className="stroke-primary fill-none transition-all duration-1000 ease-out" cx="26" cy="26" r="14" strokeDasharray="87.9" strokeDashoffset="15" strokeLinecap="round" strokeWidth="4" />
</svg>
<span className="absolute font-label-sm text-label-sm text-on-surface">{completionPct}%</span>
</div>
<div>
<div className="font-headline-sm text-headline-sm text-on-surface">Weekly Completion</div>
<div className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
<span>{stats.habitsCompletedToday || 0} of {stats.totalHabits || 0} targets checked</span>
<span className="text-outline-variant">•</span>
<span className="text-secondary font-label-sm text-label-sm">Top 3% personal best</span>
</div>
</div>
</div>
<div className="h-8 w-px bg-surface-container-highest hidden sm:block"></div>
{/* Grace Days Reserve Badge */}
<div className="flex items-center gap-gutter-md">
<div className="w-10 h-10 rounded-full bg-secondary-fixed/50 flex items-center justify-center text-on-secondary-fixed">
<span className="material-symbols-outlined text-[20px]" style={{ 'fontVariationSettings': "\"FILL\" 1" }}>favorite</span>
</div>
<div>
<div className="font-title text-title text-on-surface">{totalGraceDays} Grace Days Ready</div>
<div className="font-caption text-caption text-on-surface-variant">Protects streaks automatically against missed check-ins</div>
</div>
</div>
</div>
{/* Quick Metrics Pill List */}
<div className="flex items-center gap-gutter-sm overflow-x-auto py-1">
<div className="px-gutter-md py-2 rounded-xl bg-surface-container-lowest/80 backdrop-blur shadow-sm flex items-center gap-gutter-sm flex-shrink-0">
<span className="material-symbols-outlined text-secondary text-[18px]">local_fire_department</span>
<div>
<span className="font-caption text-caption text-on-surface-variant block leading-none">Best Streak</span>
<span className="font-title text-title text-on-surface">{stats.longestStreak || 0}d</span>
</div>
</div>
<div className="px-gutter-md py-2 rounded-xl bg-surface-container-lowest/80 backdrop-blur shadow-sm flex items-center gap-gutter-sm flex-shrink-0">
<span className="material-symbols-outlined text-primary text-[18px]">timelapse</span>
<div>
<span className="font-caption text-caption text-on-surface-variant block leading-none">Total Flow</span>
<span className="font-title text-title text-on-surface">18.4h</span>
</div>
</div>
<div className="px-gutter-md py-2 rounded-xl bg-surface-container-lowest/80 backdrop-blur shadow-sm flex items-center gap-gutter-sm flex-shrink-0">
<span className="material-symbols-outlined text-tertiary text-[18px]">health_metrics</span>
<div>
<span className="font-caption text-caption text-on-surface-variant block leading-none">Health Index</span>
<span className="font-title text-title text-on-surface">9.8</span>
</div>
</div>
</div>
</div>
</div>
{/* Main Workstation Canvas: 2-Column Responsive Layout */}
<div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-xl items-start">
{/* Left Column: Active Habits Stack (8 cols) */}
<div className="xl:col-span-8 space-y-gutter-base">
<div className="flex items-center justify-between px-gutter-xs">
<div className="flex items-center gap-gutter-sm">
<h2 className="font-headline-sm text-headline-sm text-on-surface">Active Habit Sequences</h2>
<span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-caption text-caption">{habits.length} Tracked</span>
</div>
<div className="flex items-center gap-gutter-xs bg-surface-container-low p-1 rounded-full text-on-surface-variant font-label-sm text-label-sm">
<button onClick={() => setDailyToggle('Daily')} className={`px-gutter-md py-1 rounded-full transition-all ${dailyToggle === 'Daily' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'hover:text-on-surface'}`}>Daily</button>
<button onClick={() => setDailyToggle('Weekly')} className={`px-gutter-md py-1 rounded-full transition-all ${dailyToggle === 'Weekly' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'hover:text-on-surface'}`}>Weekly</button>
</div>
</div>
{habits.map(habit => {
  const streakInfo = stats.habitStreaks?.find(s => s.id === habit.id);
  const streak = streakInfo ? streakInfo.streak : calcStreak(habit.completedDays || []);
  const color = HABIT_COLOR_CLASSES[habit.colorToken] || HABIT_COLOR_CLASSES.primary;
  
  return (
    <div key={habit.id} className="group relative rounded-2xl bg-surface-container-lowest p-gutter-lg sm:p-gutter-xl shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-gutter-base pb-gutter-md">
        <div className="flex items-start gap-gutter-base min-w-0">
          <div className={`w-12 h-12 rounded-2xl ${color.fixed} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <span className="material-symbols-outlined text-[24px]">{habit.icon || 'star'}</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-gutter-sm">
              <h3 className="font-title text-title text-on-surface truncate">{habit.title}</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low font-caption text-caption text-on-surface-variant">{habit.duration}</span>
              {habit.linkedGoal && (
                <span className={`font-label-sm text-label-sm ${color.text} flex items-center gap-0.5`}>
                  <span>→ {habit.linkedGoal}</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
                </span>
              )}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{habit.description}</p>
          </div>
        </div>
        <div className="flex md:flex-col items-end justify-between md:justify-center gap-1 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low">
            <span className="material-symbols-outlined text-[18px] text-on-surface" style={{ 'fontVariationSettings': "\"FILL\" 1" }}>local_fire_department</span>
            <span className="font-title text-title text-on-surface tracking-tight">{streak} Days</span>
          </div>
          <div className="flex items-center gap-1 text-secondary font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[15px]" style={{ 'fontVariationSettings': "\"FILL\" 1" }}>verified_user</span>
            <span>Shield Active ({habit.graceDays || 0} stored)</span>
          </div>
        </div>
      </div>
      
      <div className="pt-gutter-base mt-gutter-xs flex flex-col sm:flex-row sm:items-center justify-between gap-gutter-md">
        <div className="flex items-center gap-2">
          {last7Days().map((dayStr, idx) => {
            const isToday = dayStr === todayKey();
            const isCompleted = habit.completedDays?.includes(dayStr);
            const jsDayOfWeek = new Date(`${dayStr}T12:00:00`).getDay();
            const dayLabel = DAY_LABELS[jsDayOfWeek] || 'D';
            
            if (isToday) {
              return (
                <div key={dayStr} className="flex flex-col items-center gap-1.5">
                  <span className={`font-caption text-caption ${color.text} font-bold`}>{dayLabel}</span>
                  <button onClick={() => checkInHabit(habit.id)} className={`w-9 h-9 rounded-xl ${isCompleted ? color.checked : 'bg-surface-container text-on-surface'} flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-transform`} title="Check in today" aria-label={`${isCompleted ? 'Undo' : 'Complete'} ${habit.title} for today`}>
                    <span className="material-symbols-outlined text-[18px]">{isCompleted ? 'done' : 'radio_button_unchecked'}</span>
                  </button>
                </div>
              );
            }
            
            return (
              <div key={dayStr} className="flex flex-col items-center gap-1.5">
                <span className="font-caption text-caption text-on-surface-variant">{dayLabel}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${isCompleted ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-outline'}`}>
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
</div>
{/* Right Column: Non-Punitive Grace Popover Mockup & Quick Reflections (4 cols) */}
<div className="xl:col-span-4 space-y-gutter-base">
{/* Live Non-Punitive Apple Philosophy Showcase Sheet */}
{showGraceInfo && (
<div className="rounded-3xl bg-surface-container-lowest p-gutter-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] relative overflow-hidden">
<div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary via-tertiary to-secondary"></div>
<div className="flex items-center justify-between pb-gutter-sm">
<div className="flex items-center gap-2">
<div className="w-7 h-7 rounded-full bg-tertiary-fixed flex items-center justify-center text-tertiary">
<span className="material-symbols-outlined text-[16px]">psychology</span>
</div>
<span className="font-caption text-caption uppercase tracking-wider text-on-surface-variant">Grace Safeguard Protocol</span>
</div>
<span className="w-2.5 h-2.5 rounded-full bg-secondary animate-ping"></span>
</div>
{/* Popover Body with friendly Cupertino microcopy */}
<div className="mt-gutter-sm space-y-gutter-sm">
<div className="w-12 h-12 rounded-2xl bg-surface-container-low flex items-center justify-center text-primary-container">
<span className="material-symbols-outlined text-[28px]" style={{ 'fontVariationSettings': "\"FILL\" 1" }}>spa</span>
</div>
<h4 className="font-headline-sm text-headline-sm text-on-surface">Missed yesterday? No big deal.</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Real life ebbs and flows. Momentum OS never penalizes your progress with zeroed tallies or alarming red flags. How would you like to recalibrate?
          </p>
</div>
{/* 3 Friendly Cupertino Action Options */}
<div className="mt-gutter-lg space-y-gutter-sm">
<button
  onClick={() => {
    const target = habits.find(h => (h.graceDays || 0) > 0) || habits[0];
    if (target) {
      useGraceDay(target.id);
    }
  }}
  className="w-full text-left p-gutter-md rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex items-center justify-between group active:scale-[0.99]"
>
<div className="flex items-center gap-gutter-sm">
<div className="w-8 h-8 rounded-xl bg-surface-container-lowest flex items-center justify-center text-secondary shadow-xs">
<span className="material-symbols-outlined text-[18px]">verified_user</span>
</div>
<div>
<div className="font-label-md text-label-md text-on-surface">Use 1 Grace Day</div>
<div className="font-caption text-caption text-on-surface-variant">Streak continues uninterrupted ({totalGraceDays} stored)</div>
</div>
</div>
<span className="material-symbols-outlined text-[18px] text-outline group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
</button>
<button
  onClick={() => {
    const firstHabit = habits[0];
    if (firstHabit) {
      checkInHabit(firstHabit.id);
    }
  }}
  className="w-full text-left p-gutter-md rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex items-center justify-between group active:scale-[0.99]"
>
<div className="flex items-center gap-gutter-sm">
<div className="w-8 h-8 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-xs">
<span className="material-symbols-outlined text-[18px]">schedule</span>
</div>
<div>
<div className="font-label-md text-label-md text-on-surface">Instant Check-In Sprints</div>
<div className="font-caption text-caption text-on-surface-variant">Quick toggle today's primary habit</div>
</div>
</div>
<span className="material-symbols-outlined text-[18px] text-outline group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
</button>
<button
  onClick={() => setShowNewHabit(true)}
  className="w-full text-left p-gutter-md rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex items-center justify-between group active:scale-[0.99]"
>
<div className="flex items-center gap-gutter-sm">
<div className="w-8 h-8 rounded-xl bg-surface-container-lowest flex items-center justify-center text-tertiary shadow-xs">
<span className="material-symbols-outlined text-[18px]">tune</span>
</div>
<div>
<div className="font-label-md text-label-md text-on-surface">Add Micro-Habit Step</div>
<div className="font-caption text-caption text-on-surface-variant">Downscale to 5m micro-version</div>
</div>
</div>
<span className="material-symbols-outlined text-[18px] text-outline group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
</button>
</div>
<div className="mt-gutter-md pt-gutter-md border-none flex items-center justify-between font-caption text-caption text-on-surface-variant">
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-[14px]">info</span>
            No guilt strikes policy
          </span>
<span className="font-medium text-secondary">Healthy habit design</span>
</div>
</div>
)}
{/* Quick Micro-Context Card with editorial photo */}
<div className="rounded-2xl bg-surface-container-lowest p-gutter-lg shadow-sm space-y-gutter-md">
<div className="relative w-full h-36 rounded-xl overflow-hidden">
<img className="w-full h-full object-cover" alt="Sunlit desk with notebook, pen, water glass, and plant" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZRXf20xAXDRT4q7ZylydiGoqLpFQ-09HdQjoVKCaWHn8OZmsWkcUSg6uxJpuK6z3-K1Wk8FIZzTp-dsbtncoAkuyVT4ppNhs9CbgT3TX3gYMoOSAUs7VrCHk3wuNDDksPDpOZd_s4pFD3-9wyFEv0UUl-BlgYiPs4RXJM322hox0Soi3q8d0HzabEKib1ZQ2IOcomCOgxKDJMQxg0RhGAesPyXziyNsZL05KLidRdr3WaPPDOlOoC"/>
<div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 via-transparent to-transparent"></div>
<div className="absolute bottom-3 left-3 right-3 text-on-primary">
<div className="font-caption text-caption uppercase tracking-wider text-secondary-fixed">Daily Wisdom</div>
<div className="font-label-md text-label-md font-medium leading-tight">"You do not rise to the level of your goals. You fall to the level of your systems."</div>
</div>
</div>
<div className="space-y-gutter-xs">
<div className="flex items-center justify-between">
<span className="font-title text-title text-on-surface">Weekly Rhythm</span>
<span className="font-label-sm text-label-sm text-secondary font-semibold">+8% vs last week</span>
</div>
<div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
<div className="h-full bg-secondary rounded-full" style={{ 'width': "86%" }}></div>
</div>
<div className="flex justify-between font-caption text-caption text-on-surface-variant pt-1">
<span>Optimal recovery window</span>
<span>Sundays: Light load</span>
</div>
</div>
</div>
</div>
</div>
{/* Annual Consistency Heatmap Section (GitHub / Apple Health Grid) */}
<div className="rounded-3xl bg-surface-container-lowest p-gutter-xl shadow-sm space-y-gutter-md">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-gutter-sm">
<div className="space-y-0.5">
<div className="flex items-center gap-gutter-sm">
<h2 className="font-headline-sm text-headline-sm text-on-surface">Annual Consistency Matrix</h2>
<span className="px-2 py-0.5 rounded-full bg-secondary-fixed-dim/40 text-on-secondary-fixed font-caption text-caption">2025 Ledger</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">365-day macro cadence tracking compound self-mastery over time.</p>
</div>
<div className="flex items-center gap-gutter-md">
<div className="flex items-center gap-1.5 font-caption text-caption text-on-surface-variant">
<span>Less</span>
<span className="w-3 h-3 rounded-[3px] bg-surface-container"></span>
<span className="w-3 h-3 rounded-[3px] bg-secondary-fixed/50"></span>
<span className="w-3 h-3 rounded-[3px] bg-secondary-container"></span>
<span className="w-3 h-3 rounded-[3px] bg-secondary"></span>
<span>More</span>
</div>
<div className="h-4 w-px bg-surface-container-highest hidden sm:block"></div>
<button className="flex items-center gap-1 text-primary font-label-sm text-label-sm hover:underline">
<span>Export Health Data</span>
<span className="material-symbols-outlined text-[16px]">ios_share</span>
</button>
</div>
</div>
{/* Scalable 52-Week Year-at-a-Glance Canvas */}
<div className="w-full overflow-x-auto pb-gutter-xs">
<div className="min-w-[760px] flex flex-col gap-1.5 select-none">
{/* Months Label Bar */}
<div className="flex justify-between pl-7 pr-2 font-caption text-caption text-on-surface-variant">
<span>Jan</span>
<span>Feb</span>
<span>Mar</span>
<span>Apr</span>
<span>May</span>
<span>Jun</span>
<span>Jul</span>
<span>Aug</span>
<span>Sep</span>
<span>Oct</span>
<span>Nov</span>
<span>Dec</span>
</div>
<div className="flex items-start gap-2">
{/* Day of week legends */}
<div className="flex flex-col justify-between h-[104px] font-caption text-caption text-outline py-0.5">
<span>M</span>
<span>W</span>
<span>F</span>
<span>S</span>
</div>
{/* Heatmap Grid SVG / Column Generation Simulation */}
<div className="flex-1 grid grid-flow-col grid-rows-7 gap-1 h-[104px]" id="annual-heatmap-cells">
{/* Heatmap blocks generated cleanly with intentional density patterns */}
{/* Week 1 - 10 (Light to active) */}
<div className="w-full rounded-[2.5px] bg-surface-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/50"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/50"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-surface-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/40"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/60"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/40"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/40"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-surface-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/50"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/40"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-surface-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/50"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/30"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container"></div>
{/* Weeks 11-20 (Spring burst) */}
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/50"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/40"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-surface-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/50"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/50"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-surface-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/60"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/50"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-surface-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/40"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
{/* Weeks 21-32 (Current stretch) */}
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-surface-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/50"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/50"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary-fixed/40"></div>
<div className="w-full rounded-[2.5px] bg-secondary-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
<div className="w-full rounded-[2.5px] bg-surface-container"></div>
<div className="w-full rounded-[2.5px] bg-secondary"></div>
{/* Future weeks placeholder buffer (soft neutral grey dots) */}
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
<div className="w-full rounded-[2.5px] bg-surface-container-high/60"></div>
</div>
</div>
</div>
</div>
{/* Heatmap Meta Footnote */}
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-gutter-sm pt-gutter-sm font-caption text-caption text-on-surface-variant">
<div className="flex items-center gap-gutter-md">
<span>Longest 2025 Streak: <strong className="text-on-surface">34 Days</strong></span>
<span>•</span>
<span>Grace Days Redeemed: <strong className="text-on-surface">4 Days</strong></span>
<span>•</span>
<span>Active Shield Pool: <strong className="text-secondary">2 Available</strong></span>
</div>
<span className="text-outline">Updated 14 mins ago via Momentum Engine</span>
</div>
</div>

</div>
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
    </main>
  );
}
