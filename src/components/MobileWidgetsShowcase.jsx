import React, { useMemo } from 'react';
import { Check, Plus, Flame, Sparkles, Clock, Target, Calendar } from 'lucide-react';
import { isTaskScheduledForDate, todayPlanDate } from '../lib/taskMetadata';

export default function MobileWidgetsShowcase({
  tasks = [],
  habits = [],
  stats = {},
  onToggleTask,
  onCheckInHabit,
  onOpenQuickAdd,
  onOpenNewGoal,
  onOpenNewHabit
}) {
  const today = todayPlanDate();

  // Tasks for today
  const todayTasks = useMemo(() => {
    const list = tasks.filter(
      (t) =>
        isTaskScheduledForDate(t, today) ||
        (!t.completed && t.plannedDate && t.plannedDate < today) ||
        (!t.plannedDate && (t.dueDate === 'Today' || !t.dueDate))
    );
    return list.length > 0 ? list : tasks.slice(0, 8);
  }, [tasks, today]);

  const pendingTasks = useMemo(() => todayTasks.filter((t) => !t.completed), [todayTasks]);
  const completedTasks = useMemo(() => todayTasks.filter((t) => t.completed), [todayTasks]);

  const totalCount = todayTasks.length;
  const completedCount = completedTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Next upcoming or active task for the 4x1 Pill
  const nextTask = pendingTasks[0] || null;

  // Today's habits with streak info
  const habitItems = useMemo(() => {
    return (habits || []).map((h) => {
      const isDone = (h.completedDays || []).includes(today);
      return {
        ...h,
        isDone,
        streakCount: Array.isArray(h.completedDays) ? h.completedDays.length : 0
      };
    });
  }, [habits, today]);

  const habitsDoneCount = habitItems.filter((h) => h.isDone).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-black/[0.06] dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              COMPLETE ANDROID SUITE
            </span>
            <span className="text-[11px] text-[#8E8E93] font-mono">4 WIDGETS • LIVE REACTIVE</span>
          </div>
          <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] mt-1">
            Production Android home screen layouts with real workspace synchronization.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Synced
          </span>
        </div>
      </div>

      {/* ── 1. 4x1 UPCOMING TASK PILL (Google Search Bar Dimensions) ── */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] dark:text-[#A1A1AA]">
            1. Next Upcoming Pill (4×1 - Search Bar Shape)
          </span>
          <span className="text-[10px] text-[#A1A1AA] font-mono">widget_upcoming_pill.xml</span>
        </div>

        <div className="rounded-full px-5 py-3 bg-gradient-to-r from-[#17171F] via-[#121217] to-[#17171F] text-white border border-white/15 shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] font-mono font-bold tracking-wider text-sky-400 uppercase flex-shrink-0">
              NEXT:
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold truncate text-white">
                {nextTask ? nextTask.title : 'All daily blocks cleared'}
              </p>
              <p className="text-[10px] text-zinc-400 truncate">
                {nextTask
                  ? `${nextTask.startTime ? `At ${nextTask.startTime} • ` : ''}${nextTask.durationMinutes || 45}m sprint`
                  : 'Tap to plan next sprint'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/10 text-sky-300">
              {nextTask ? `${nextTask.durationMinutes || 45}m` : '✓'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. 4x3 TODAY FOCUS HUB (Tasks + Habits with high capacity handling) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] dark:text-[#A1A1AA]">
              2. Today Focus Hub (4×3 Combo)
            </span>
            <span className="text-[10px] text-[#A1A1AA] font-mono">widget_today.xml</span>
          </div>

          <div className="rounded-[28px] p-5 bg-gradient-to-b from-[#181822] to-[#0F0F14] text-white border border-white/10 shadow-2xl flex flex-col justify-between space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div>
                <div className="text-[9px] font-mono tracking-widest text-blue-400 font-bold uppercase">
                  MOMENTUM • TODAY'S FOCUS
                </div>
                <div className="text-[14px] font-bold text-white tracking-tight mt-0.5">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white/10 text-white/90">
                  {pendingTasks.length} left
                </span>
                <button
                  type="button"
                  onClick={() => onOpenQuickAdd?.()}
                  title="Quick Add Task"
                  className="w-7 h-7 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center transition-all shadow-md shadow-blue-500/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tasks section */}
            <div>
              <div className="text-[9px] font-mono font-bold tracking-widest text-zinc-400 uppercase mb-2">
                TASKS ({pendingTasks.length} PENDING)
              </div>
              <div className="space-y-1.5">
                {todayTasks.slice(0, 3).map((task, idx) => (
                  <div
                    key={task.id}
                    onClick={() => onToggleTask?.(task.id)}
                    className={`group flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer border ${
                      task.completed
                        ? 'bg-white/[0.02] border-transparent opacity-50'
                        : idx === 0
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-white/[0.05] hover:bg-white/[0.08] border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                          task.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-white/30 group-hover:border-blue-400'
                        }`}
                      >
                        {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span
                        className={`text-xs truncate transition-all ${
                          task.completed ? 'line-through text-zinc-400' : 'text-zinc-100 font-medium'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {idx === 0 && !task.completed && (
                        <span className="text-[9px] font-mono font-bold text-sky-400 bg-sky-500/15 px-1.5 py-0.5 rounded">
                          NOW
                        </span>
                      )}
                      {task.startTime && (
                        <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded">
                          {task.startTime}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Habits section */}
            <div>
              <div className="text-[9px] font-mono font-bold tracking-widest text-amber-400 uppercase mb-2 flex items-center justify-between">
                <span>TODAY'S HABITS ({habitsDoneCount}/{habitItems.length})</span>
                <span className="text-zinc-400">STREAK</span>
              </div>
              <div className="space-y-1.5">
                {habitItems.slice(0, 2).map((h) => (
                  <div
                    key={h.id}
                    onClick={() => onCheckInHabit?.(h.id)}
                    className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer border ${
                      h.isDone
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-white/[0.04] hover:bg-white/[0.07] border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                          h.isDone ? 'bg-amber-500 border-amber-500 text-black font-bold' : 'border-zinc-500'
                        }`}
                      >
                        {h.isDone && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span
                        className={`text-xs font-medium truncate ${
                          h.isDone ? 'text-zinc-300' : 'text-zinc-100'
                        }`}
                      >
                        {h.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 flex-shrink-0">
                      <Flame className="w-3 h-3 fill-amber-500" />
                      <span>{h.streakCount}d</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overflow footer */}
            {(todayTasks.length > 3 || habitItems.length > 2) && (
              <div className="text-right text-[10px] text-zinc-400 font-mono pt-1 border-t border-white/[0.06]">
                +{Math.max(0, todayTasks.length - 3)} tasks, +{Math.max(0, habitItems.length - 2)} habits in app →
              </div>
            )}
          </div>
        </div>

        {/* ── 3. 2x2 BENTO DIAL + 4. 2x2 QUICK-ADD STACK ── */}
        <div className="flex flex-col space-y-6">
          {/* Progress dial */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] dark:text-[#A1A1AA]">
                3. Bento Dial (2×2)
              </span>
              <span className="text-[10px] text-[#A1A1AA] font-mono">widget_bento_stats.xml</span>
            </div>

            <div className="rounded-[28px] p-4 bg-gradient-to-b from-[#141418] to-[#0A0A0C] text-white border border-white/10 shadow-xl flex flex-col justify-between h-[180px]">
              <div className="flex items-center justify-between text-[9px] font-mono font-bold text-zinc-400">
                <span>MOMENTUM_INDEX</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <div className="relative flex items-center justify-center my-auto">
                <svg className="w-24 h-24 -rotate-90 transform" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="48" className="stroke-zinc-800" strokeWidth="10" fill="transparent" />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke={progressPercent >= 100 ? '#10B981' : '#38BDF8'}
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - progressPercent / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black font-mono">{progressPercent}%</span>
                  <span className="text-[8px] uppercase tracking-wider text-zinc-400">NOMINAL</span>
                </div>
              </div>

              <div className="text-[9px] font-mono text-zinc-400 text-center">
                {completedCount}/{totalCount} DONE • {pendingTasks.length} LEFT
              </div>
            </div>
          </div>

          {/* 3-Action Quick-Add */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] dark:text-[#A1A1AA]">
                4. Circular Quick Add (2×2)
              </span>
              <span className="text-[10px] text-[#A1A1AA] font-mono">widget_quick_actions.xml</span>
            </div>

            <div className="rounded-[28px] p-4 bg-gradient-to-b from-[#171720] to-[#0D0D12] text-white border border-white/10 shadow-xl flex items-center justify-around h-[180px]">
              {/* Task circle */}
              <button
                type="button"
                onClick={() => onOpenQuickAdd?.()}
                className="flex flex-col items-center group cursor-pointer"
              >
                <span className="text-[9px] font-mono font-bold text-sky-400 tracking-wider mb-2">TASK</span>
                <div className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-90 flex items-center justify-center shadow-lg shadow-blue-500/25 transition-transform">
                  <Plus className="w-5 h-5 text-white stroke-[2.5]" />
                </div>
              </button>

              {/* Goal circle */}
              <button
                type="button"
                onClick={() => onOpenNewGoal?.()}
                className="flex flex-col items-center group cursor-pointer"
              >
                <span className="text-[9px] font-mono font-bold text-violet-400 tracking-wider mb-2">GOAL</span>
                <div className="w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-500 active:scale-90 flex items-center justify-center shadow-lg shadow-violet-500/25 transition-transform">
                  <Plus className="w-5 h-5 text-white stroke-[2.5]" />
                </div>
              </button>

              {/* Habit circle */}
              <button
                type="button"
                onClick={() => onOpenNewHabit?.()}
                className="flex flex-col items-center group cursor-pointer"
              >
                <span className="text-[9px] font-mono font-bold text-orange-400 tracking-wider mb-2">HABIT</span>
                <div className="w-12 h-12 rounded-full bg-orange-600 hover:bg-orange-500 active:scale-90 flex items-center justify-center shadow-lg shadow-orange-500/25 transition-transform">
                  <Plus className="w-5 h-5 text-white stroke-[2.5]" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
