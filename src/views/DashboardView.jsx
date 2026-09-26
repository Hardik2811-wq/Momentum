import React, { useMemo, useState } from 'react';
import { todayKey } from '../store/useStore';
import TaskCard from '../components/TaskCard';
import TaskDetailModal from '../components/TaskDetailModal';
import { deadlineStatus, effortLabel, IMPACT_LABELS, planDateLabel, taskImpact, taskPlanDate, todayPlanDate, tomorrowPlanDate, isTaskScheduledForDate } from '../lib/taskMetadata';

const IMPACT_ORDER = { high: 1, medium: 2, low: 3 };

function formatTime(time) {
  if (!time) return 'Unscheduled';
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function DashboardView({
  tasks = [], onToggleTask, onDeleteTask, onUpdateTask, onToggleSubtask,
  onOpenQuickAdd, onStartFocus, onCheckInHabit, stats = {}, setActiveTab,
  settings = {}, onUpdateSettings, goals = [], habits = [],
}) {
  const [filter, setFilter] = useState('all');
  const [editingTask, setEditingTask] = useState(null);
  const [showMorningPlan, setShowMorningPlan] = useState(false);
  const [showEveningReview, setShowEveningReview] = useState(false);
  const [planTasks, setPlanTasks] = useState([]);
  const [eveningNote, setEveningNote] = useState('');
  const [scheduleTimes, setScheduleTimes] = useState({});
  const userName = settings?.profile?.name || 'Friend';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = todayKey();
  const quickWinMinutes = settings.quickWinMinutes || 30;

  const todayTasks = useMemo(() => tasks
    .filter(task => isTaskScheduledForDate(task, todayPlanDate()))
    .slice()
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const deadlineA = deadlineStatus(a);
      const deadlineB = deadlineStatus(b);
      const deadlineDelta = (deadlineA?.timestamp || Number.MAX_SAFE_INTEGER) - (deadlineB?.timestamp || Number.MAX_SAFE_INTEGER);
      const impactDelta = (IMPACT_ORDER[taskImpact(a)] || 9) - (IMPACT_ORDER[taskImpact(b)] || 9);
      const effortDelta = (a.durationMinutes || 60) - (b.durationMinutes || 60);
      return deadlineDelta || impactDelta || (a.startTime || '99:99').localeCompare(b.startTime || '99:99') || effortDelta;
    }), [tasks]);

  const filterCounts = useMemo(() => ({
    all: todayTasks.length,
    high: todayTasks.filter(t => taskImpact(t) === 'high').length,
    quick: todayTasks.filter(t => (t.durationMinutes || 60) <= quickWinMinutes).length
  }), [todayTasks, quickWinMinutes]);

  const completedTodayTasksCount = useMemo(() => {
    return todayTasks.filter(t => t.completed).length;
  }, [todayTasks]);

  const visibleTasks = todayTasks.filter(task => {
    if (filter === 'high') return taskImpact(task) === 'high';
    return filter !== 'quick' || (task.durationMinutes || 60) <= quickWinMinutes;
  });
  const nextTask = todayTasks.find(task => !task.completed);
  const scheduledTasks = todayTasks.filter(task => task.startTime && !task.completed);
  const checkedHabits = habits.filter(habit => habit.completedDays?.includes(today)).length;
  const activeGoals = goals.filter(goal => goal.velocity !== 'complete').slice(0, 3);
  const dailyPlan = settings.dailyPlan?.date === today ? settings.dailyPlan : { topTaskIds: [], eveningNote: '' };
  const unfinishedTodayTasks = todayTasks.filter(task => !task.completed);

  const openMorningPlan = () => {
    const selected = (dailyPlan.topTaskIds || []).map(id => {
      const task = unfinishedTodayTasks.find(item => item.id === id);
      return task ? { id: task.id, startTime: task.startTime || '' } : null;
    }).filter(Boolean);
    setPlanTasks(selected);
    setShowMorningPlan(true);
  };

  const saveMorningPlan = () => {
    planTasks.forEach(item => onUpdateTask?.(item.id, { startTime: item.startTime || null, plannedDate: todayPlanDate(), dueDate: 'Today', urgency: 'today' }));
    onUpdateSettings?.({ dailyPlan: { date: today, topTaskIds: planTasks.map(item => item.id), eveningNote: dailyPlan.eveningNote || '' } });
    setShowMorningPlan(false);
  };

  const openEveningReview = () => {
    setEveningNote(dailyPlan.eveningNote || '');
    setScheduleTimes(Object.fromEntries(unfinishedTodayTasks.map((task, index) => [task.id, task.startTime || ['09:00', '11:00', '14:00'][index % 3]])));
    setShowEveningReview(true);
  };

  const saveEveningReview = () => {
    onUpdateSettings?.({ dailyPlan: { ...dailyPlan, date: today, eveningNote } });
    setShowEveningReview(false);
  };

  return (
    <main className="w-full min-h-screen bg-surface pt-16 md:pt-12 px-4 sm:px-6 md:px-margin-desktop py-4 sm:py-gutter-xl">
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <header data-block-id="dashboard-header" className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant border border-black/[0.04]">
              <span className="material-symbols-outlined text-[14px] text-primary">calendar_today</span>
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">{greeting}, {userName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
              <span>Plan today. Do next task. Review week.</span>
              <span className="hidden sm:inline-block opacity-40">•</span>
              <span className="font-semibold text-primary inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">trending_up</span>
                {completedTodayTasksCount}/{todayTasks.length} Completed ({todayTasks.length ? Math.round((completedTodayTasksCount / todayTasks.length) * 100) : 0}%)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openMorningPlan}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface border border-black/[0.05] hover:bg-surface-container active:scale-95 transition-all shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px] text-amber-500">sunny</span>
              <span>Morning plan</span>
            </button>
            <button
              onClick={openEveningReview}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface border border-black/[0.05] hover:bg-surface-container active:scale-95 transition-all shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px] text-indigo-500">bedtime</span>
              <span>Evening review</span>
            </button>
            <button
              onClick={onOpenQuickAdd}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-sm hover:shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add task</span>
            </button>
          </div>
        </header>

        {/* ── NOW FOCUS HERO CARD ── */}
        <section data-block-id="dashboard-now-hero" className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-surface-container-lowest to-surface-container-lowest p-5 sm:p-6 shadow-sm relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative z-10">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">Now Focus Target</span>
                {nextTask && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    taskImpact(nextTask) === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {IMPACT_LABELS[taskImpact(nextTask)]} Impact
                  </span>
                )}
              </div>

              {nextTask ? (
                <>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface truncate">{nextTask.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      <span className="material-symbols-outlined text-[15px]">schedule</span>
                      {nextTask.startTime ? formatTime(nextTask.startTime) : 'Planned today'}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-amber-600">timer</span>
                      {effortLabel(nextTask.durationMinutes)} effort
                    </span>
                    {nextTask.subtasks && nextTask.subtasks.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-medium">
                          <span className="material-symbols-outlined text-[15px]">checklist</span>
                          {nextTask.subtasks.filter(s => s.completed).length}/{nextTask.subtasks.length} subtasks
                        </span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-1 text-xl font-bold text-on-surface">No task needs attention now.</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">All scheduled tasks completed. Add new task or plan tomorrow.</p>
                </>
              )}
            </div>

            {nextTask ? (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditingTask(nextTask)}
                  className="px-4 py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-black/[0.06] text-sm font-semibold text-on-surface shadow-xs transition-all active:scale-95"
                >
                  View task
                </button>
                <button
                  onClick={() => onStartFocus?.(nextTask.id)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  <span>Start Focus</span>
                </button>
              </div>
            ) : (
              <button onClick={onOpenQuickAdd} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-sm hover:shadow-md transition-all">
                Add first task
              </button>
            )}
          </div>
        </section>

        {/* ── MAIN WORKSPACE GRID ── */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Today Tasks (8 cols) */}
          <div data-block-id="dashboard-today-tasks" className="space-y-4 lg:col-span-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-on-surface">Today</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
                    {visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {completedTodayTasksCount} of {todayTasks.length} tasks complete · {checkedHabits}/{habits.length} habits checked in
                </p>
              </div>

              {/* Filter Pills with Live Count Badges */}
              <div className="inline-flex rounded-full bg-surface-container p-1 gap-1">
                {[
                  ['all', 'All', filterCounts.all],
                  ['high', 'High impact', filterCounts.high],
                  ['quick', `≤ ${quickWinMinutes} min`, filterCounts.quick]
                ].map(([id, label, count]) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                      filter === id
                        ? 'bg-surface-container-lowest text-primary shadow-xs font-bold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span>{label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      filter === id ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {visibleTasks.length ? (
                visibleTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleTask={onToggleTask}
                    onDeleteTask={onDeleteTask}
                    onUpdateTask={onUpdateTask}
                    onToggleSubtask={onToggleSubtask}
                    onEditTask={setEditingTask}
                    goals={goals}
                    habits={habits}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-lowest p-8 text-center">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40 mb-2 block">task_alt</span>
                  <p className="text-sm font-semibold text-on-surface">No tasks match this view.</p>
                  <p className="text-xs text-on-surface-variant mt-1">Clear filters or queue a new priority below.</p>
                </div>
              )}

              <button
                onClick={onOpenQuickAdd}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/20 hover:border-primary/50 bg-primary/[0.02] hover:bg-primary/[0.05] p-3.5 text-sm font-semibold text-primary transition-all active:scale-[0.99] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Add task for today</span>
              </button>
            </div>
          </div>

          {/* Right Column: Time blocks & Habits (4 cols) */}
          <aside data-block-id="dashboard-sidebar-column" className="space-y-6 lg:col-span-4">
            {/* Timeline Blocks Widget */}
            <div data-block-id="dashboard-time-blocks" className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm border border-black/[0.04]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">schedule</span>
                  <div>
                    <h2 className="text-base font-bold text-on-surface">Time Blocks</h2>
                    <p className="text-[11px] text-on-surface-variant">Today's planned timeline</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('today')}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
                >
                  <span>Open day</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>

              {scheduledTasks.length ? (
                <div className="relative pl-4 space-y-3 mt-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container-high">
                  {scheduledTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => setEditingTask(task)}
                      className="group relative flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-black/[0.03] transition-all cursor-pointer"
                    >
                      {/* Timeline dot */}
                      <span className="absolute -left-[19px] w-2.5 h-2.5 rounded-full border-2 border-surface-container-lowest bg-primary group-hover:scale-125 transition-transform" />

                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-[11px] font-bold text-primary block">
                          {formatTime(task.startTime)}
                        </span>
                        <span className="text-xs font-semibold text-on-surface truncate block group-hover:text-primary transition-colors">
                          {task.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant shrink-0">
                        {task.durationMinutes || 45}m
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-surface-container-low p-4 text-center">
                  <p className="text-xs text-on-surface-variant">No scheduled time blocks today.</p>
                  <button
                    onClick={openMorningPlan}
                    className="mt-2 text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <span>Schedule in Morning Plan</span>
                    <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                  </button>
                </div>
              )}
            </div>

            {/* Habits Widget */}
            <div data-block-id="dashboard-habits-card" className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm border border-black/[0.04]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-secondary">repeat</span>
                  <div>
                    <h2 className="text-base font-bold text-on-surface">Daily Habits</h2>
                    <p className="text-[11px] text-on-surface-variant">
                      {checkedHabits} of {habits.length} locked today
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('habits')}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
                >
                  <span>All habits</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>

              {/* Habit Completion Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden my-3">
                <div
                  className="h-full bg-secondary rounded-full transition-all duration-500"
                  style={{ width: `${habits.length > 0 ? Math.round((checkedHabits / habits.length) * 100) : 0}%` }}
                />
              </div>

              <div className="space-y-1.5">
                {habits.slice(0, 4).map(habit => {
                  const done = habit.completedDays?.includes(today);
                  const streak = (habit.completedDays || []).length;
                  return (
                    <button
                      key={habit.id}
                      onClick={() => onCheckInHabit?.(habit.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl p-2.5 text-left border transition-all active:scale-[0.98] ${
                        done
                          ? 'bg-emerald-500/[0.06] border-emerald-500/20'
                          : 'hover:bg-surface-container-low border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                          done ? 'border-primary bg-primary text-white shadow-2xs' : 'border-outline-variant bg-surface'
                        }`}>
                          <span className="material-symbols-outlined text-[14px]">done</span>
                        </span>
                        <span className={`text-xs font-medium truncate ${
                          done ? 'text-on-surface-variant line-through' : 'text-on-surface'
                        }`}>
                          {habit.title}
                        </span>
                      </div>
                      {streak > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full border border-amber-200/60 shrink-0">
                          <span>🔥</span>
                          <span>{streak}d</span>
                        </span>
                      )}
                    </button>
                  );
                })}
                {!habits.length && (
                  <p className="text-xs text-on-surface-variant text-center py-2">No habits configured yet.</p>
                )}
              </div>
            </div>
          </aside>
        </section>

        {/* ── GOALS CAROUSEL SECTION ── */}
        <section data-block-id="dashboard-goals-card" className="rounded-2xl bg-surface-container-lowest p-5 sm:p-6 shadow-sm border border-black/[0.04]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Active Horizons</p>
              <h2 className="mt-0.5 text-lg sm:text-xl font-bold text-on-surface">Goals Moving Forward</h2>
            </div>
            <button
              onClick={() => setActiveTab('goals')}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
            >
              <span>View all goals</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {activeGoals.length ? (
              activeGoals.map(goal => {
                const progress = goal.workProgress ?? goal.progress ?? 0;
                const next = goal.nextTask?.title;
                return (
                  <div key={goal.id} className="rounded-xl bg-surface-container-low border border-black/[0.03] p-4 flex flex-col justify-between hover:shadow-xs transition-shadow">
                    <button onClick={() => setActiveTab('goals')} className="w-full text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-on-surface">{goal.title}</span>
                        <span className="text-xs font-extrabold text-primary">{progress}%</span>
                      </div>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-on-surface truncate">
                        {goal.milestone || next || 'Set next milestone'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-on-surface-variant">
                        Due {goal.targetDate || `${goal.daysLeft || 0} days`} · {goal.tasksActive || 0} tasks active
                      </p>
                    </button>
                    <button
                      onClick={() => onOpenQuickAdd?.({ initialGoalId: goal.id })}
                      className="mt-3 text-xs font-semibold text-primary hover:underline text-left inline-flex items-center gap-1"
                    >
                      <span>+ Add next task</span>
                    </button>
                  </div>
                );
              })
            ) : (
              <button onClick={() => setActiveTab('goals')} className="rounded-xl bg-surface-container-low p-4 text-left text-sm font-semibold text-primary">
                Create first goal
              </button>
            )}
          </div>
        </section>
      </div>
      {showMorningPlan && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Morning plan</p><h2 className="mt-1 text-xl font-bold text-[#1A1B1F]">Choose your Top 3</h2><p className="mt-1 text-sm text-[#71717A]">Pick work. Give each task a time block. Check habits.</p></div><button onClick={() => setShowMorningPlan(false)} className="p-1 text-[#888]"><span className="material-symbols-outlined">close</span></button></div><div className="mt-5 space-y-2">{unfinishedTodayTasks.map(task => { const selected = planTasks.find(item => item.id === task.id); return <div key={task.id} className={`rounded-xl border p-3 ${selected ? 'border-primary bg-primary/5' : 'border-black/[0.08]'}`}><div className="flex items-center gap-3"><button onClick={() => { if (selected) setPlanTasks(planTasks.filter(item => item.id !== task.id)); else if (planTasks.length < 3) setPlanTasks([...planTasks, { id: task.id, startTime: ['09:00', '11:00', '14:00'][planTasks.length] }]); }} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-primary bg-primary text-white' : 'border-[#BBB]'}`}><span className="material-symbols-outlined text-[14px]">done</span></button><span className="flex-1 text-sm font-semibold text-[#1A1B1F]">{task.title}</span>{selected && <select value={selected.startTime} onChange={event => setPlanTasks(planTasks.map(item => item.id === task.id ? { ...item, startTime: event.target.value } : item))} className="rounded-lg bg-[#F5F4FA] px-2 py-1 text-xs"><option value="">No time</option><option value="09:00">9:00 AM</option><option value="11:00">11:00 AM</option><option value="14:00">2:00 PM</option><option value="16:00">4:00 PM</option></select>}</div></div>})}{!unfinishedTodayTasks.length && <p className="rounded-xl bg-[#F5F4FA] p-3 text-sm text-[#71717A]">No unfinished tasks. Add work for today.</p>}</div><div className="mt-5 border-t border-black/[0.07] pt-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-[#1A1B1F]">Check habits</h3><span className="text-xs text-[#71717A]">{checkedHabits}/{habits.length}</span></div><div className="mt-2 grid grid-cols-2 gap-2">{habits.slice(0, 4).map(habit => { const done = habit.completedDays?.includes(today); return <button key={habit.id} onClick={() => onCheckInHabit?.(habit.id)} className={`rounded-lg px-3 py-2 text-left text-xs font-semibold ${done ? 'bg-primary text-white' : 'bg-[#F5F4FA] text-[#1A1B1F]'}`}>{done ? '✓ ' : ''}{habit.title}</button> })}</div></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowMorningPlan(false)} className="px-4 py-2 text-sm text-[#71717A]">Cancel</button><button disabled={!planTasks.length} onClick={saveMorningPlan} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Plan my day</button></div></div></div>}

      {showEveningReview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-tertiary">Evening review</p><h2 className="mt-1 text-xl font-bold text-[#1A1B1F]">Close your day</h2><p className="mt-1 text-sm text-[#71717A]">Review unfinished work. Choose next home for each task.</p></div><button onClick={() => setShowEveningReview(false)} className="p-1 text-[#888]"><span className="material-symbols-outlined">close</span></button></div><div className="mt-5 space-y-3">{unfinishedTodayTasks.length ? unfinishedTodayTasks.map(task => <div key={task.id} className="rounded-xl border border-black/[0.08] p-3"><p className="text-sm font-semibold text-[#1A1B1F]">{task.title}</p><div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={() => onToggleTask(task.id)} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">Mark done</button><button onClick={() => onUpdateTask(task.id, { plannedDate: tomorrowPlanDate(), dueDate: 'Tomorrow', urgency: 'week', startTime: null })} className="rounded-lg bg-[#F5F4FA] px-2.5 py-1.5 text-xs font-semibold text-[#1A1B1F]">Move tomorrow</button><select value={scheduleTimes[task.id] || '09:00'} onChange={event => setScheduleTimes({ ...scheduleTimes, [task.id]: event.target.value })} className="rounded-lg bg-[#F5F4FA] px-2 py-1.5 text-xs"><option value="09:00">9:00 AM</option><option value="11:00">11:00 AM</option><option value="14:00">2:00 PM</option><option value="16:00">4:00 PM</option></select><button onClick={() => onUpdateTask(task.id, { plannedDate: tomorrowPlanDate(), dueDate: 'Tomorrow', urgency: 'week', startTime: scheduleTimes[task.id] || '09:00' })} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">Schedule</button><button onClick={() => onDeleteTask(task.id)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500">Remove</button></div></div>) : <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">All today tasks complete.</p>}</div><div className="mt-5 border-t border-black/[0.07] pt-4"><label className="text-sm font-bold text-[#1A1B1F]">Note for tomorrow</label><textarea value={eveningNote} onChange={event => setEveningNote(event.target.value)} placeholder="What matters first tomorrow?" rows="3" className="mt-2 w-full resize-none rounded-xl bg-[#F5F4FA] p-3 text-sm outline-none" /></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowEveningReview(false)} className="px-4 py-2 text-sm text-[#71717A]">Cancel</button><button onClick={saveEveningReview} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">Finish review</button></div></div></div>}

      <TaskDetailModal task={editingTask} isOpen={!!editingTask} onClose={() => setEditingTask(null)} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} goals={goals} habits={habits} onStartFocus={onStartFocus} />
    </main>
  );
}
