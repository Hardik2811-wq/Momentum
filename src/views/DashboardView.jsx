import React, { useMemo, useState } from 'react';
import { todayKey } from '../store/useStore';
import TaskCard from '../components/TaskCard';
import TaskDetailModal from '../components/TaskDetailModal';
import { deadlineStatus, effortLabel, IMPACT_LABELS, planDateLabel, taskImpact, taskPlanDate, todayPlanDate, isTaskScheduledForDate } from '../lib/taskMetadata';

const IMPACT_ORDER = { high: 1, medium: 2, low: 3 };

function formatTime(time) {
  if (!time) return 'Unscheduled';
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

const DashboardView = React.memo(function DashboardView({
  tasks = [], onToggleTask, onDeleteTask, onUpdateTask, onToggleSubtask,
  onOpenQuickAdd, onStartFocus, onCheckInHabit, stats = {}, setActiveTab,
  settings = {}, onUpdateSettings, goals = [], habits = [],
}) {
  const [filter, setFilter] = useState('all');
  const [editingTask, setEditingTask] = useState(null);
  const userName = settings?.profile?.name || 'Friend';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = todayKey();
  const quickWinMinutes = settings.quickWinMinutes || 30;

  // Single-pass filter + O(N log N) primitive comparison via Schwartzian transform
  const todayTasks = useMemo(() => {
    const todayPlan = todayPlanDate();
    const filtered = [];
    for (let i = 0; i < tasks.length; i++) {
      if (isTaskScheduledForDate(tasks[i], todayPlan)) {
        filtered.push(tasks[i]);
      }
    }

    const len = filtered.length;
    const decorated = new Array(len);
    for (let i = 0; i < len; i++) {
      const t = filtered[i];
      const deadline = deadlineStatus(t);
      decorated[i] = {
        task: t,
        completed: t.completed ? 1 : 0,
        deadlineTs: deadline ? deadline.timestamp : Number.MAX_SAFE_INTEGER,
        impactRank: IMPACT_ORDER[taskImpact(t)] || 9,
        startTime: t.startTime || '99:99',
        effort: t.durationMinutes || 60
      };
    }

    decorated.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed - b.completed;
      const dDelta = a.deadlineTs - b.deadlineTs;
      if (dDelta !== 0) return dDelta;
      const iDelta = a.impactRank - b.impactRank;
      if (iDelta !== 0) return iDelta;
      const tCmp = a.startTime.localeCompare(b.startTime);
      if (tCmp !== 0) return tCmp;
      return a.effort - b.effort;
    });

    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = decorated[i].task;
    }
    return result;
  }, [tasks]);

  // Single-pass counters (O(N) time, O(1) space)
  const { filterCounts, completedTodayTasksCount } = useMemo(() => {
    let high = 0;
    let quick = 0;
    let completed = 0;
    const len = todayTasks.length;
    for (let i = 0; i < len; i++) {
      const t = todayTasks[i];
      if (t.completed) completed++;
      if (taskImpact(t) === 'high') high++;
      if ((t.durationMinutes || 60) <= quickWinMinutes) quick++;
    }
    return {
      filterCounts: { all: len, high, quick },
      completedTodayTasksCount: completed
    };
  }, [todayTasks, quickWinMinutes]);

  const visibleTasks = useMemo(() => {
    if (filter === 'all') return todayTasks;
    if (filter === 'high') return todayTasks.filter(task => taskImpact(task) === 'high');
    return todayTasks.filter(task => (task.durationMinutes || 60) <= quickWinMinutes);
  }, [todayTasks, filter, quickWinMinutes]);

  const nextTask = useMemo(() => todayTasks.find(task => !task.completed) || null, [todayTasks]);
  const checkedHabits = useMemo(() => habits.filter(habit => habit.completedDays?.includes(today)).length, [habits, today]);
  const activeGoals = useMemo(() => goals.filter(goal => goal.velocity !== 'complete').slice(0, 3), [goals]);

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
          <div className="flex items-center gap-2">
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

          {/* Right Column: Habits (4 cols) */}
          <aside data-block-id="dashboard-sidebar-column" className="space-y-6 lg:col-span-4">
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

      <TaskDetailModal task={editingTask} isOpen={!!editingTask} onClose={() => setEditingTask(null)} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} goals={goals} habits={habits} onStartFocus={onStartFocus} />
    </main>
  );
});

export default DashboardView;
