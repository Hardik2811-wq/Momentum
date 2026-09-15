import React, { useState } from 'react';
import { todayKey } from '../store/useStore';

const PRIORITY_COLORS = {
  high: 'bg-error-container text-on-error-container',
  normal: 'bg-surface-container-low text-on-surface-variant',
  low: 'bg-surface-container-high text-on-surface-variant',
};

const PRIORITY_ORDER = { high: 1, normal: 2, low: 3 };

import TaskDetailModal from '../components/TaskDetailModal';

export default function DashboardView({
  tasks = [],
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onOpenQuickAdd,
  stats = {},
  setActiveTab,
  settings = {},
  goals = [],
  habits = []
}) {
  const [filter, setFilter] = useState('all');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const userName = settings?.profile?.name || 'Friend';
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const filtered = (filter === 'all' ? tasks
    : filter === 'high' ? tasks.filter(t => t.priority === 'high')
    : tasks.filter(t => t.priority === 'low' || t.priority === 'normal')
  ).slice().sort((a, b) => {
    // 1. Incomplete first, completed last
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // 2. High priority first, then normal, then low
    const pA = PRIORITY_ORDER[a.priority] || 99;
    const pB = PRIORITY_ORDER[b.priority] || 99;
    if (pA !== pB) {
      return pA - pB;
    }
    // 3. Newest first
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const filterTabs = [
    { id: 'all', label: `All (${tasks.length})` },
    { id: 'high', label: 'High Impact' },
    { id: 'quick', label: 'Quick Wins' },
  ];

  return (
    <main className="w-full pt-16 md:pt-12 px-4 sm:px-6 md:px-margin-desktop py-4 sm:py-gutter-xl min-h-screen bg-surface">
      <div className="flex flex-col w-full">
{/* Top Ambient Halo */}
<div className="relative w-full overflow-hidden pb-4 md:pb-gutter-xl">
<div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none"></div>
<div className="absolute -top-20 right-10 w-80 h-80 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none"></div>
{/* Header Section */}
<div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-gutter-base pb-4 md:pb-gutter-xl">
<div>
<div className="inline-flex items-center gap-gutter-xs px-gutter-md py-1 rounded-full bg-surface-container-low shadow-sm mb-gutter-sm">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-caption text-caption text-on-surface-variant font-medium tracking-tight">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} • Focus Mode Active</span>
</div>
<h1 className="font-display text-[26px] sm:text-[34px] md:text-display text-on-surface tracking-tight leading-tight">{timeGreeting}, {userName}</h1>
</div>
<div className="flex items-center gap-gutter-sm">
<button onClick={() => setShowCustomizer(true)} className="hidden sm:flex items-center gap-gutter-xs px-gutter-base py-gutter-sm rounded-full bg-surface-container-low hover:bg-surface-container-high transition-colors shadow-sm text-on-surface font-label-md text-label-md active:scale-[0.98]">
<span className="material-symbols-outlined text-[18px] text-on-surface-variant">tune</span>
<span>Customize View</span>
</button>
<button onClick={onOpenQuickAdd} className="hidden md:flex items-center justify-center w-9 h-9 rounded-full bg-primary-container text-on-primary-container shadow-sm hover:opacity-95 transition-opacity active:scale-[0.98]">
<span className="material-symbols-outlined text-[20px]">add</span>
</button>
</div>
</div>
{/* Key Metrics 4-Pack: Compact 2x2 on Mobile, 4-Pack on Laptop */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-gutter-base">
{/* Card 1: Tasks Due */}
<div className="flex flex-col justify-between p-3 sm:p-gutter-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow">
<div className="flex items-center justify-between">
<span className="font-label-md text-[11px] sm:text-label-md text-on-surface-variant font-medium">Tasks Due</span>
<span className="material-symbols-outlined text-[16px] sm:text-[20px] text-primary">check_circle</span>
</div>
<div className="my-1 sm:my-gutter-md">
<span className="text-2xl sm:text-display-mobile text-on-surface font-semibold tracking-tight">{stats.pending}</span>
<span className="font-body-md text-xs sm:text-body-md text-on-surface-variant ml-1">rem.</span>
</div>
<div className="flex items-center gap-1 sm:gap-gutter-xs">
{stats.highPriority > 0 && <span className="px-1.5 sm:px-2 py-0.2 rounded-full bg-error-container text-on-error-container font-caption text-[10px] sm:text-caption font-semibold">{stats.highPriority} High</span>}
<span className="px-1.5 sm:px-2 py-0.2 rounded-full bg-surface-container-low text-on-surface-variant font-caption text-[10px] sm:text-caption">{stats.normalPriority + stats.lowPriority} Norm</span>
</div>
</div>
{/* Card 2: Completion */}
<div className="flex flex-col justify-between p-3 sm:p-gutter-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow">
<div className="flex items-center justify-between">
<span className="font-label-md text-[11px] sm:text-label-md text-on-surface-variant font-medium">Completion</span>
<span className="material-symbols-outlined text-[16px] sm:text-[20px] text-amber-500" style={{ fontVariationSettings: '"FILL" 1' }}>local_fire_department</span>
</div>
<div className="my-1 sm:my-gutter-md">
<span className="text-2xl sm:text-display-mobile text-on-surface font-semibold tracking-tight">{stats.completionRate}%</span>
<span className="font-body-md text-xs sm:text-body-md text-on-surface-variant ml-1">done</span>
</div>
<div className="flex items-center gap-1 sm:gap-gutter-xs text-on-surface-variant font-caption text-[10px] sm:text-caption">
<span className="material-symbols-outlined text-[12px] sm:text-[14px]">history</span>
<span>{stats.completed}/{stats.total} done</span>
</div>
</div>
{/* Card 3: Goals On Track */}
<div className="flex flex-col justify-between p-3 sm:p-gutter-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow">
<div className="flex items-center justify-between">
<span className="font-label-md text-[11px] sm:text-label-md text-on-surface-variant font-medium">Goals</span>
<span className="material-symbols-outlined text-[16px] sm:text-[20px] text-secondary">flag_circle</span>
</div>
<div className="flex items-center justify-between my-0.5 sm:my-gutter-sm">
<div>
<span className="text-2xl sm:text-display-mobile text-on-surface font-semibold tracking-tight">{stats.goalsOnTrack}</span>
<span className="font-body-md text-xs sm:text-body-md text-on-surface-variant">/{stats.totalGoals}</span>
<p className="font-caption text-[10px] sm:text-caption text-secondary font-medium mt-0.5">{stats.totalGoals > 0 ? Math.round((stats.goalsOnTrack / stats.totalGoals) * 100) : 0}% target</p>
</div>
<div className="relative w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center flex-shrink-0">
<svg className="w-8 h-8 sm:w-12 sm:h-12 -rotate-90" viewBox="0 0 36 36">
<path className="text-surface-container-high" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
<path className="text-secondary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${stats.totalGoals > 0 ? Math.round((stats.goalsOnTrack / stats.totalGoals) * 100) : 0}, 100`} strokeLinecap="round" strokeWidth="3" />
</svg>
<span className="absolute font-caption text-[9px] sm:text-caption font-semibold text-on-surface">{stats.totalGoals > 0 ? Math.round((stats.goalsOnTrack / stats.totalGoals) * 100) : 0}%</span>
</div>
</div>
<span className="font-caption text-[10px] sm:text-caption text-on-surface-variant cursor-pointer hover:text-primary" onClick={() => setActiveTab('goals')}>View goals →</span>
</div>
{/* Card 4: Habits Today */}
<div className="flex flex-col justify-between p-3 sm:p-gutter-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow">
<div className="flex items-center justify-between">
<span className="font-label-md text-[11px] sm:text-label-md text-on-surface-variant font-medium">Habits</span>
<span className="px-1.5 sm:px-2 py-0.2 rounded-full bg-secondary-container/60 text-secondary font-caption text-[10px] sm:text-caption font-semibold">{stats.habitsCompletedToday}/{stats.totalHabits}</span>
</div>
<div className="flex items-baseline justify-between mt-0.5 sm:mt-gutter-xs">
<div>
<span className="text-2xl sm:text-display-mobile text-on-surface font-semibold tracking-tight">{stats.longestStreak}</span>
<span className="font-body-md text-xs sm:text-body-md text-on-surface-variant ml-1">streak</span>
<span className="font-caption text-[10px] sm:text-caption text-on-surface-variant block mt-0.5">Best active</span>
</div>
</div>
<span className="font-caption text-[10px] sm:text-caption text-on-surface-variant cursor-pointer hover:text-primary" onClick={() => setActiveTab('habits')}>View habits →</span>
</div>
</div>
</div>
{/* Primary 60/40 Workstation Grid */}
<div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-xl items-start pb-gutter-2xl">
{/* LEFT COLUMN: Focus Stream (60%) */}
<div className="lg:col-span-7 flex flex-col gap-gutter-base">
{/* List Title + Segmented Control */}
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-gutter-sm">
<div>
<h2 className="font-headline-sm text-headline-sm text-on-surface">Today's Focus</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant">Prioritized by high leverage and mental energy</p>
</div>
{/* Apple Segmented Pill */}
<div className="inline-flex p-0.5 rounded-full bg-surface-container-high/60 backdrop-blur-md">
{filterTabs.map(tab => (
<button key={tab.id} onClick={() => setFilter(tab.id)} className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-medium transition-all ${filter === tab.id ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface'}`}>{tab.label}</button>
))}
</div>
</div>
{/* Task Items Container */}
<div className="flex flex-col gap-gutter-sm">
{filtered.length === 0 && (
<div className="p-gutter-lg rounded-xl bg-surface-container-lowest text-center text-on-surface-variant font-body-md text-body-md">No tasks match this filter. Add one!</div>
)}
{filtered.map(task => (
<div key={task.id} onClick={() => setEditingTask(task)} className={`task-item group flex items-start justify-between p-gutter-base rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all cursor-pointer ${task.completed ? 'animate-taskDown' : 'animate-taskUp'}`}>
<div className="flex items-start gap-gutter-md min-w-0">
<button onClick={(e) => { e.stopPropagation(); onToggleTask(task.id); }} className={`task-checkbox mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all flex-shrink-0 active:scale-90 ${task.completed ? 'bg-primary text-white animate-checkPop' : 'bg-surface-container-low text-transparent hover:text-primary'}`}>
<span className="material-symbols-outlined text-[15px]">done</span>
</button>
<div className="flex flex-col min-w-0">
<span className={`task-title font-title text-title text-on-surface tracking-tight group-hover:text-primary transition-colors truncate ${task.completed ? 'line-through opacity-50' : ''}`}>{task.title}</span>
<div className="flex flex-wrap items-center gap-gutter-xs mt-1">
<span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-caption text-caption font-medium">{task.category}</span>
<span className="text-outline-variant font-caption text-caption">•</span>
<span className="font-caption text-caption text-on-surface-variant">{task.dueDate || task.date || 'Today'}</span>
{task.subtasks?.length > 0 && (
  <span className="px-1.5 py-0.2 rounded-full bg-surface-container font-caption text-[10px] text-on-surface-variant">
    {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
  </span>
)}
</div>
</div>
</div>
<div className="flex items-center gap-gutter-xs flex-shrink-0 ml-gutter-sm">
<span className={`px-2 py-0.5 rounded-full font-caption text-caption font-semibold ${PRIORITY_COLORS[task.priority]}`}>{task.priority === 'high' ? 'Priority 1' : task.priority === 'normal' ? 'Normal' : 'Low'}</span>
<button onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }} className="p-1 rounded-full text-outline hover:text-error hover:bg-error-container/30 transition-colors opacity-0 group-hover:opacity-100" title="Delete task">
<span className="material-symbols-outlined text-[15px]">close</span>
</button>
</div>
</div>
))}
{/* Quick Add Row In-flow */}
<div onClick={onOpenQuickAdd} className="flex items-center gap-gutter-sm p-gutter-base rounded-xl bg-surface-container-low/60 hover:bg-surface-container-low transition-colors cursor-pointer text-on-surface-variant">
<span className="material-symbols-outlined text-[20px] text-primary">add_circle</span>
<span className="font-body-md text-body-md font-medium text-on-surface-variant">Add focus item for today...</span>
</div>
</div>
</div>
{/* RIGHT COLUMN: Balance & Equilibrium (40%) */}
<div className="lg:col-span-5 flex flex-col gap-gutter-base">
  {(() => {
    const careerGoals = goals.filter(g => g.category === 'career');
    const careerPct = careerGoals.length > 0
      ? Math.round(careerGoals.reduce((a, b) => a + (b.progress || 0), 0) / careerGoals.length)
      : (stats.completionRate || 0);

    const healthHabitsPct = stats.totalHabits > 0
      ? Math.round((stats.habitsCompletedToday / stats.totalHabits) * 100)
      : 0;

    const creativeGoals = goals.filter(g => g.category === 'creative');
    const creativePct = creativeGoals.length > 0
      ? Math.round(creativeGoals.reduce((a, b) => a + (b.progress || 0), 0) / creativeGoals.length)
      : 0;

    const focusPct = Math.min(100, Math.round(((stats.completedFocusHours || 0) / (settings?.dailyTarget || 4.5)) * 100));
    const socialPct = stats.completed > 0 ? Math.min(100, 40 + stats.completed * 10) : 0;

    const scores = [careerPct, healthHabitsPct, focusPct, creativePct, socialPct];
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    // 5 Pentagon Vertices: Angles: -90, -18, 54, 126, 198 deg
    const cx = 100;
    const cy = 100;
    const maxR = 76;
    const angles = [-Math.PI / 2, -Math.PI / 10, (3 * Math.PI) / 10, (7 * Math.PI) / 10, (11 * Math.PI) / 10];
    const polyPoints = angles.map((ang, i) => {
      const r = Math.max(8, (scores[i] / 100) * maxR);
      const x = (cx + r * Math.cos(ang)).toFixed(1);
      const y = (cy + r * Math.sin(ang)).toFixed(1);
      return { x, y, str: `${x},${y}` };
    });
    const polygonStr = polyPoints.map(p => p.str).join(' ');

    return (
      <>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Life &amp; Focus Balance</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Holistic equilibrium across active quadrants</p>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
            avgScore > 60 ? 'bg-secondary-container/60 text-secondary' : 'bg-surface-container text-on-surface-variant'
          }`}>
            {avgScore}% Balanced
          </span>
        </div>

        {/* Clean Apple Health-style Widget Card */}
        <div className="flex flex-col p-gutter-lg rounded-xl bg-surface-container-lowest shadow-sm">
          {/* Radar / Pentagon Visualization SVG */}
          <div className="relative w-full h-56 flex items-center justify-center">
            <svg className="w-full h-full max-w-[280px]" viewBox="0 0 200 200">
              {/* Background Web Rings */}
              <polygon className="text-outline-variant/40" fill="none" points="100,24 172,76 145,161 55,161 28,76" stroke="currentColor" strokeWidth="0.75" />
              <polygon className="text-outline-variant/30" fill="none" points="100,49 148,84 130,141 70,141 52,84" stroke="currentColor" strokeWidth="0.75" />
              <polygon className="text-outline-variant/20" fill="none" points="100,74 124,92 115,120 85,120 76,92" stroke="currentColor" strokeWidth="0.75" />
              {/* Axis lines */}
              <line className="text-outline-variant/40" stroke="currentColor" strokeWidth="0.75" x1="100" x2="100" y1="100" y2="24" />
              <line className="text-outline-variant/40" stroke="currentColor" strokeWidth="0.75" x1="100" x2="172" y1="100" y2="76" />
              <line className="text-outline-variant/40" stroke="currentColor" strokeWidth="0.75" x1="100" x2="145" y1="100" y2="161" />
              <line className="text-outline-variant/40" stroke="currentColor" strokeWidth="0.75" x1="100" x2="55" y1="100" y2="161" />
              <line className="text-outline-variant/40" stroke="currentColor" strokeWidth="0.75" x1="100" x2="28" y1="100" y2="76" />
              {/* Real Dynamic Shape */}
              <polygon className="text-primary/20 stroke-primary transition-all duration-700" fill="currentColor" points={polygonStr} stroke="currentColor" strokeWidth="2" />
              {polyPoints.map((pt, idx) => (
                <circle key={idx} className="fill-primary transition-all duration-700" cx={pt.x} cy={pt.y} r="3.5" />
              ))}
            </svg>
            <span className="absolute top-1 left-1/2 -translate-x-1/2 font-caption text-caption text-on-surface font-semibold">Career {careerPct}%</span>
            <span className="absolute top-16 right-0 font-caption text-caption text-on-surface font-semibold">Health {healthHabitsPct}%</span>
            <span className="absolute bottom-1 right-8 font-caption text-caption text-on-surface font-semibold">Focus {focusPct}%</span>
            <span className="absolute bottom-1 left-8 font-caption text-caption text-on-surface font-semibold">Creative {creativePct}%</span>
            <span className="absolute top-16 left-0 font-caption text-caption text-on-surface font-semibold">Social {socialPct}%</span>
          </div>
{/* Metric Details Bars */}
<div className="flex flex-col gap-gutter-sm mt-gutter-base">
<div className="flex items-center justify-between font-label-sm text-label-sm">
<span className="text-on-surface-variant">Deep Work Focus • Daily Sprint Log</span>
<span className="font-semibold text-primary">{stats.completedFocusHours || 0}h / {settings?.dailyTarget || 4.5}h</span>
</div>
<div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round(((stats.completedFocusHours || 0) / (settings?.dailyTarget || 4.5)) * 100))}%` }}></div>
</div>
<div className="flex items-center justify-between font-label-sm text-label-sm mt-1">
<span className="text-on-surface-variant">Habits Consistency • Today's Check-ins</span>
<span className="font-semibold text-secondary">{stats.habitsCompletedToday || 0}/{stats.totalHabits || 0}</span>
</div>
<div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full transition-all duration-500" style={{ width: `${stats.totalHabits > 0 ? Math.round(((stats.habitsCompletedToday || 0) / stats.totalHabits) * 100) : 0}%` }}></div>
</div>
<div className="flex items-center justify-between font-label-sm text-label-sm mt-1">
<span className="text-on-surface-variant">Creative • Unstructured exploration</span>
<span className="font-semibold text-outline">
  {goals.some(g => g.category === 'creative' && g.progress > 50) ? 'Optimal' : 'Under Target'}
</span>
</div>
<div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
<div className="bg-outline h-full rounded-full transition-all duration-500" style={{ width: `${goals.filter(g => g.category === 'creative').length > 0 ? Math.round(goals.filter(g => g.category === 'creative').reduce((a, b) => a + (b.progress || 0), 0) / goals.filter(g => g.category === 'creative').length) : 0}%` }}></div>
</div>
</div>
{/* Micro Insight Callout */}
<div className="mt-gutter-md p-gutter-sm rounded-lg bg-surface-container-low flex items-start gap-gutter-xs">
<span className="material-symbols-outlined text-[16px] text-primary mt-0.5">lightbulb</span>
<p className="font-caption text-caption text-on-surface-variant leading-relaxed">
  {stats.completed > 0 ? 'High execution tempo active. Maintain recovery breaks between deep work sessions.' : 'Zero active cognitive debt. Add or check off a focus deliverable to initiate momentum.'}
</p>
</div>
</div>
</>
);
})()}
</div>
</div>
{/* Activity & Achievements Section */}
<div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-xl pb-gutter-2xl">
{/* LEFT: 16-Week Consistency Matrix (8 cols) */}
<div className="lg:col-span-8 flex flex-col p-gutter-lg rounded-xl bg-surface-container-lowest shadow-sm">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-gutter-xs mb-gutter-base">
<div>
<h3 className="font-headline-sm text-headline-sm text-on-surface">Activity Consistency</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant"><strong className="text-on-surface font-medium">{stats.completed} tasks</strong> completed so far</p>
</div>
<div className="flex items-center gap-gutter-xs">
<span className="font-caption text-caption text-on-surface-variant">Less</span>
<span className="w-2.5 h-2.5 rounded-sm bg-surface-container-high"></span>
<span className="w-2.5 h-2.5 rounded-sm bg-primary-fixed"></span>
<span className="w-2.5 h-2.5 rounded-sm bg-primary-fixed-dim"></span>
<span className="w-2.5 h-2.5 rounded-sm bg-primary"></span>
<span className="font-caption text-caption text-on-surface-variant">More</span>
</div>
</div>
{/* Real dynamic Activity Heatmap grid based on user tasks & habits */}
<div className="overflow-x-auto pb-gutter-xs">
<div className="grid grid-flow-col grid-rows-7 gap-1 min-w-[500px]">
{(() => {
  // 16 weeks * 7 days = 112 cells
  const totalCells = 112;
  const cells = [];
  const today = new Date();

  // Build dates from 111 days ago to today
  for (let i = totalCells - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = todayKey(d);

    // Calculate real activity score for this date
    let count = 0;
    // 1. Completed tasks around this date
    tasks.forEach(t => {
      const completedAt = t.completedAt || t.createdAt;
      if (t.completed && completedAt && todayKey(new Date(completedAt)) === dateStr) {
        count += 1;
      }
    });
    // 2. Habit checkins on this date
    habits.forEach(h => {
      if ((h.completedDays || []).includes(dateStr)) {
        count += 1;
      }
    });

    const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;
    cells.push(level);
  }

  const colors = ['bg-surface-container-high', 'bg-primary-fixed', 'bg-primary-fixed-dim', 'bg-primary'];
  return cells.map((level, idx) => (
    <div
      key={idx}
      className={`w-3 h-3 rounded-sm transition-colors ${colors[level]}`}
      title={level === 0 ? 'No recorded activity' : `${level} activities logged`}
    />
  ));
})()}
</div>
</div>
<div className="flex items-center justify-between pt-gutter-sm font-caption text-caption text-on-surface-variant">
<span>16 weeks ago</span>
<span>12 weeks</span>
<span>8 weeks</span>
<span className="font-medium text-on-surface">This week</span>
</div>
</div>
{/* RIGHT: Personal Records Trophy Widget (4 cols) */}
<div className="lg:col-span-4 flex flex-col justify-between p-gutter-lg rounded-xl bg-surface-container-lowest shadow-sm">
<div className="flex items-center justify-between">
<h3 className="font-headline-sm text-headline-sm text-on-surface">Personal Records</h3>
<span className="material-symbols-outlined text-[20px] text-amber-500" style={{ fontVariationSettings: '"FILL" 1' }}>military_tech</span>
</div>
<div className="flex flex-col gap-gutter-md my-gutter-base">
<div className="flex items-center justify-between p-gutter-sm rounded-lg bg-surface-container-low">
<div className="flex items-center gap-gutter-sm">
<span className="material-symbols-outlined text-[20px] text-primary">bolt</span>
<span className="font-label-md text-label-md text-on-surface">Longest Streak</span>
</div>
<span className="font-headline-sm text-headline-sm text-on-surface font-semibold">{stats.longestStreak} <span className="font-body-sm text-body-sm text-on-surface-variant font-normal">days</span></span>
</div>
<div className="flex items-center justify-between p-gutter-sm rounded-lg bg-surface-container-low">
<div className="flex items-center gap-gutter-sm">
<span className="material-symbols-outlined text-[20px] text-secondary">insights</span>
<span className="font-label-md text-label-md text-on-surface">Tasks Completed</span>
</div>
<span className="font-headline-sm text-headline-sm text-on-surface font-semibold">{stats.completed} <span className="font-body-sm text-body-sm text-on-surface-variant font-normal">total</span></span>
</div>
<div className="flex items-center justify-between p-gutter-sm rounded-lg bg-surface-container-low">
<div className="flex items-center gap-gutter-sm">
<span className="material-symbols-outlined text-[20px] text-tertiary">all_inclusive</span>
<span className="font-label-md text-label-md text-on-surface">Completion Rate</span>
</div>
<span className="font-headline-sm text-headline-sm text-on-surface font-semibold">{stats.completionRate}%</span>
</div>
</div>
<span className="font-caption text-caption text-on-surface-variant">Keep building momentum every day</span>
</div>
</div>
{/* Bottom Row: Active Horizons */}
<div className="flex flex-col gap-gutter-base pb-gutter-xl">
<div className="flex items-center justify-between">
<div>
<h2 className="font-headline-sm text-headline-sm text-on-surface">Active Horizons</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant">Strategic long-term targets anchored in intention</p>
</div>
<button onClick={() => setActiveTab('goals')} className="flex items-center gap-gutter-xs text-primary font-label-md text-label-md hover:opacity-80 transition-opacity">
<span>View all horizons</span>
<span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</button>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-base">
{/* Active Horizon cards rendered dynamically from real goals */}
{goals.slice(0, 3).map((g, idx) => {
  const colorToken = g.color === 'secondary' ? 'text-secondary' : g.color === 'tertiary' ? 'text-tertiary' : 'text-primary';
  const tagColor = g.color === 'secondary' ? 'bg-secondary-container/60 text-secondary' : g.color === 'tertiary' ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary';
  const pct = g.progress || 0;

  return (
    <div key={g.id || idx} onClick={() => setActiveTab('goals')} className="flex flex-col justify-between p-gutter-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div>
        <div className="flex items-center justify-between mb-gutter-sm">
          <span className={`px-2 py-0.5 rounded-full font-caption text-caption font-semibold ${tagColor}`}>
            {g.category ? g.category.toUpperCase() : 'HORIZON'}
          </span>
          <span className="font-caption text-caption text-on-surface-variant font-medium">
            {g.daysLeft ? `${g.daysLeft} days left` : 'Active'}
          </span>
        </div>
        <h3 className="font-title text-title text-on-surface">{g.title}</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant italic mt-gutter-xs leading-relaxed line-clamp-2">
          {g.why ? `"${g.why}"` : '"Deliver deliberate progress on high-impact milestone."'}
        </p>
      </div>
      <div className="flex items-center justify-between mt-gutter-lg pt-gutter-md border-t border-surface-container-high/40">
        <div className="flex flex-col">
          <span className="font-caption text-caption text-on-surface-variant">{g.targetDate || 'Target Cycle'}</span>
          <span className="font-label-md text-label-md font-semibold text-on-surface">
            {g.tasksActive !== undefined ? `${g.tasksActive} active tasks` : 'On track'}
          </span>
        </div>
        <div className="relative w-10 h-10 flex items-center justify-center">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <path className="text-surface-container-high" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
            <path className={colorToken} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${pct}, 100`} strokeLinecap="round" strokeWidth="3" />
          </svg>
          <span className="absolute font-caption text-[10px] font-semibold text-on-surface">{pct}%</span>
        </div>
      </div>
    </div>
  );
})}
</div>
</div>

</div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
        goals={goals}
      />

      {/* Customize View Modal */}
      {showCustomizer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-black/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.18)] p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
                <h3 className="font-semibold text-[14px] text-[#1A1B1F]">Customize Dashboard</h3>
              </div>
              <button onClick={() => setShowCustomizer(false)} className="p-1 rounded-lg hover:bg-black/[0.05] text-[#888]">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-[#1A1B1F]">
              <p className="text-[11px] text-[#888]">Filter priority default:</p>
              <div className="flex gap-2">
                {['all', 'high', 'quick'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${
                      filter === f ? 'bg-primary text-white border-primary' : 'bg-surface-container-low border-black/[0.08]'
                    }`}
                  >
                    {f === 'all' ? 'All Tasks' : f === 'high' ? 'High Impact Only' : 'Quick Wins Only'}
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-black/[0.05]">
                <p className="text-[11px] text-[#888] mb-1">Quick Actions:</p>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => { setActiveTab('today'); setShowCustomizer(false); }} className="w-full text-left px-3 py-2 rounded-xl bg-[#F5F4FA] hover:bg-[#ECEBF2] text-[12px] font-medium transition-colors flex items-center justify-between">
                    <span>Open Today's Day Ruler</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                  <button onClick={() => { setActiveTab('goals'); setShowCustomizer(false); }} className="w-full text-left px-3 py-2 rounded-xl bg-[#F5F4FA] hover:bg-[#ECEBF2] text-[12px] font-medium transition-colors flex items-center justify-between">
                    <span>Manage Strategic Goals</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowCustomizer(false)}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
