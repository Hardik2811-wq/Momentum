import React, { useMemo, useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Timer,
  ListChecks,
  Repeat,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Flame,
  Check,
  AlertTriangle,
  Sparkles,
  Inbox,
  RotateCcw
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { triggerCelebration } from '../lib/celebrate';
import { todayKey } from '../store/useStore';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import TaskCard from '../components/TaskCard';
import TaskDetailModal from '../components/TaskDetailModal';
import ScheduleDetailModal from '../components/ScheduleDetailModal';
import { deadlineStatus, effortLabel, IMPACT_LABELS, taskImpact, taskPlanDate, todayPlanDate, isTaskScheduledForDate, calculateEndTime } from '../lib/taskMetadata';
import {
  classifyDayItems,
  findIntelligentRecoverySlot,
  buildBacklogTaskPatch,
  getItemTimeWindow,
  isScheduleActiveForDate
} from '../lib/missedScheduleEngine';

const IMPACT_ORDER = { high: 1, medium: 2, low: 3 };

function formatTime(time) {
  if (!time) return 'Unscheduled';
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function SortableTaskItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 30 : 'auto',
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-manipulation">
      {children}
    </div>
  );
}

const DashboardView = React.memo(function DashboardView({
  tasks = [], onToggleTask, onDeleteTask, onUpdateTask, onToggleSubtask, onReorderTasks,
  onOpenQuickAdd, onStartFocus, onCheckInHabit, stats = {}, setActiveTab,
  settings = {}, onUpdateSettings, goals = [], habits = [],
  schedules = [], onUpdateSchedule, onDeleteSchedule, moveTaskToBacklog, sweepMissedTasksToBacklog,
}) {
  const [filter, setFilter] = useState('all');
  const [editingTask, setEditingTask] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const todaySchedules = useMemo(() => {
    const today = todayPlanDate();
    return (schedules || [])
      .filter(s => isScheduleActiveForDate(s, today))
      .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
  }, [schedules]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 20000);
    return () => clearInterval(timer);
  }, []);

  const userName = settings?.profile?.name || 'Friend';
  const hour = currentTime.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = todayKey();
  const todayPlan = todayPlanDate();
  const quickWinMinutes = settings.quickWinMinutes || 30;

  // Real-time Day Classification (Passed Window, Live Now, Upcoming, Totally Missed)
  const dayClassification = useMemo(() => {
    return classifyDayItems({
      tasks,
      schedules,
      targetDate: todayPlan,
      now: currentTime
    });
  }, [tasks, schedules, todayPlan, currentTime]);

  // dnd-kit sensors: 8px threshold so regular clicks/taps don't trigger drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Single-pass filter + O(N log N) primitive comparison via Schwartzian transform
  const todayTasks = useMemo(() => {
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
  }, [tasks, todayPlan]);

  // Focus target: live now or next upcoming task (strictly excludes missed items whose window passed)
  const nextTask = dayClassification.focusTarget;

  const missedTasksList = useMemo(() => {
    return dayClassification.missedTasks || (dayClassification.missed || []).filter(m => m.itemType === 'task');
  }, [dayClassification.missedTasks, dayClassification.missed]);

  // Active tasks for upcoming queue (excludes missed tasks and current focus target)
  const activeUpcomingTasks = useMemo(() => {
    const missedIds = new Set(missedTasksList.map(m => String(m.id)));
    const focusId = nextTask ? String(nextTask.id) : null;

    return todayTasks.filter(t => !t.completed && !missedIds.has(String(t.id)) && String(t.id) !== focusId);
  }, [todayTasks, missedTasksList, nextTask]);

  // Single-pass counters for queue filters
  const { filterCounts, completedTodayTasksCount } = useMemo(() => {
    let high = 0;
    let quick = 0;
    let completed = 0;
    const len = activeUpcomingTasks.length;
    for (let i = 0; i < len; i++) {
      const t = activeUpcomingTasks[i];
      if (taskImpact(t) === 'high') high++;
      if ((t.durationMinutes || 60) <= quickWinMinutes) quick++;
    }
    for (let i = 0; i < todayTasks.length; i++) {
      if (todayTasks[i].completed) completed++;
    }
    return {
      filterCounts: { all: len, high, quick },
      completedTodayTasksCount: completed
    };
  }, [activeUpcomingTasks, todayTasks, quickWinMinutes]);

  const visibleTasks = useMemo(() => {
    if (filter === 'all') return activeUpcomingTasks;
    if (filter === 'high') return activeUpcomingTasks.filter(task => taskImpact(task) === 'high');
    return activeUpcomingTasks.filter(task => (task.durationMinutes || 60) <= quickWinMinutes);
  }, [activeUpcomingTasks, filter, quickWinMinutes]);

  const activeQueueTasks = visibleTasks;
  const completedQueueTasks = useMemo(() => todayTasks.filter(t => t.completed), [todayTasks]);

  // Live Reactive Morphing & Emotion
  const progressPercent = todayTasks.length ? Math.round((completedTodayTasksCount / todayTasks.length) * 100) : 0;
  const progressEmotion = progressPercent >= 100 ? { color: 'text-emerald-500', emoji: '🔥', stroke: '#10b981' } : progressPercent >= 50 ? { color: 'text-amber-500', emoji: '🚀', stroke: '#f59e0b' } : { color: 'text-primary', emoji: '🎯', stroke: '#0a84ff' };

  const checkedHabits = useMemo(() => habits.filter(habit => habit.completedDays?.includes(today)).length, [habits, today]);
  const activeGoals = useMemo(() => goals.filter(goal => goal.velocity !== 'complete').slice(0, 3), [goals]);

  // Handlers for Smart Reschedule & Backlog routing
  const handleSmartReschedule = (item, rec) => {
    if (!rec) return;
    if (item.itemType === 'schedule') {
      onUpdateSchedule?.(item.id, {
        plannedDate: rec.date,
        startTime: rec.startTime
      });
    } else {
      onUpdateTask?.(item.id, {
        plannedDate: rec.date,
        startTime: rec.startTime,
        dueDate: rec.dateLabel === 'Today' ? 'Today' : 'Tomorrow',
        date: rec.dateLabel === 'Today' ? 'Today' : 'Tomorrow',
        isBacklog: false
      });
    }
  };

  const handleMoveToBacklog = (taskId) => {
    if (moveTaskToBacklog) {
      moveTaskToBacklog(taskId);
    } else {
      onUpdateTask?.(taskId, buildBacklogTaskPatch());
    }
  };

  const handleSweepTotallyMissed = () => {
    const taskIds = dayClassification.totallyMissedTasks.map(t => t.id);
    if (sweepMissedTasksToBacklog) {
      sweepMissedTasksToBacklog(taskIds);
    } else {
      taskIds.forEach(id => onUpdateTask?.(id, buildBacklogTaskPatch()));
    }
  };

  // Micro-reward Celebration triggers
  const handleToggleTask = (taskId) => {
    const task = todayTasks.find(t => t.id === taskId);
    if (task && !task.completed) {
      const remainingUncompleted = todayTasks.filter(t => !t.completed && t.id !== taskId).length;
      if (remainingUncompleted === 0) {
        triggerCelebration({ count: 90, spread: 80 });
      }
    }
    onToggleTask?.(taskId);
  };

  const handleHabitCheck = (habitId) => {
    const habit = habits.find(h => h.id === habitId);
    const wasDone = habit?.completedDays?.includes(today);
    if (!wasDone) {
      const remainingHabits = habits.filter(h => h.id !== habitId && !(h.completedDays || []).includes(today)).length;
      if (remainingHabits === 0) {
        triggerCelebration({ count: 70, spread: 60 });
      }
    }
    onCheckInHabit?.(habitId);
  };

  const handleToggleScheduleDone = (sched, targetDate = todayPlan, e) => {
    if (e) e.stopPropagation();
    const isDone = Boolean(
      sched.completed ||
      (Array.isArray(sched.completedDates) && sched.completedDates.includes(targetDate))
    );
    const currentDates = Array.isArray(sched.completedDates) ? sched.completedDates : [];

    if (isDone) {
      const updatedDates = currentDates.filter(d => d !== targetDate);
      onUpdateSchedule?.(sched.id, {
        completed: false,
        completedDates: updatedDates,
      });
    } else {
      const updatedDates = currentDates.includes(targetDate) ? currentDates : [...currentDates, targetDate];
      const isOneTime = !sched.recurrence || sched.recurrence === 'once' || sched.recurrence === 'none';
      onUpdateSchedule?.(sched.id, {
        completed: isOneTime ? true : false,
        completedDates: updatedDates,
        lastCompletedAt: Date.now()
      });
      triggerCelebration({ count: 60, spread: 70 });
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = activeQueueTasks.findIndex(t => t.id === active.id);
      const newIndex = activeQueueTasks.findIndex(t => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(activeQueueTasks, oldIndex, newIndex);
        onReorderTasks?.(reordered.map(t => t.id));
      }
    }
  };

  return (
    <main className="w-full min-h-screen bg-surface pt-16 md:pt-14 px-4 sm:px-6 md:px-8 py-4 sm:py-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-6 sm:space-y-8">
        <header data-block-id="dashboard-header" className="flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1 text-[11px] font-semibold text-on-surface-variant border border-black/[0.04] mb-2">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-on-surface truncate">
              {greeting}, {userName} {progressEmotion.emoji}
            </h1>
            <p className="hidden sm:block font-editorial text-sm sm:text-base italic text-on-surface-variant mt-0.5">
              Plan today. Do next task. Review week.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Live Progress Ring Widget */}
            <div className="flex items-center gap-2.5 bg-surface-container-lowest border border-black/[0.04] rounded-2xl p-2 sm:px-3.5 sm:py-2 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
                <svg className="w-8 h-8 sm:w-9 sm:h-9 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-surface-container-high"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`${progressEmotion.color} transition-all duration-700 ease-out`}
                    strokeDasharray={`${todayTasks.length ? Math.round((completedTodayTasksCount / todayTasks.length) * 100) : 0}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute font-mono tabular-nums text-[9px] sm:text-[10px] font-extrabold text-on-surface">
                  {todayTasks.length ? Math.round((completedTodayTasksCount / todayTasks.length) * 100) : 0}%
                </span>
              </div>
              <div className="hidden sm:flex flex-col text-left pr-1">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Today</span>
                <span className="text-xs font-mono font-bold tabular-nums text-primary">{completedTodayTasksCount}/{todayTasks.length} Done</span>
              </div>
            </div>

            {/* Desktop Add Task Button */}
            <button
              onClick={onOpenQuickAdd}
              className="hidden md:inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm hover:shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add task</span>
            </button>
          </div>
        </header>

        
        {/* 🔥 EXPERT BENTO DASHBOARD: Values over Labels, Fluid Odometers, Tinted Ambient Shadows */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_32px_rgba(10,132,255,0.04)] border border-black/[0.04] flex flex-col justify-between transition-all hover:scale-[1.02]">
             <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5 text-primary"/> FOCUS LEFT</div>
             <div className="text-4xl sm:text-5xl font-display font-extrabold text-on-surface mt-2 tracking-tighter">
                <AnimatedNumber value={activeUpcomingTasks.length} />
             </div>
          </div>
          <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_32px_rgba(245,158,11,0.04)] border border-black/[0.04] flex flex-col justify-between transition-all hover:scale-[1.02]">
             <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-amber-500"/> COMPLETED</div>
             <div className="text-4xl sm:text-5xl font-display font-extrabold text-on-surface mt-2 tracking-tighter flex items-baseline gap-2">
                <AnimatedNumber value={completedTodayTasksCount} />
                <span className="text-sm font-semibold text-on-surface-variant/50 tracking-normal">/ <AnimatedNumber value={todayTasks.length} /></span>
             </div>
          </div>
          <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_32px_rgba(16,185,129,0.04)] border border-black/[0.04] flex flex-col justify-between transition-all hover:scale-[1.02]">
             <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5 text-emerald-500"/> HABITS DONE</div>
             <div className="text-4xl sm:text-5xl font-display font-extrabold text-on-surface mt-2 tracking-tighter flex items-baseline gap-2">
                <AnimatedNumber value={checkedHabits} />
                <span className="text-sm font-semibold text-on-surface-variant/50 tracking-normal">/ <AnimatedNumber value={habits.length} /></span>
             </div>
          </div>
          <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_32px_rgba(139,92,246,0.04)] border border-black/[0.04] flex flex-col justify-between transition-all hover:scale-[1.02]">
             <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-purple-500"/> MOMENTUM</div>
             <div className="text-4xl sm:text-5xl font-display font-extrabold text-on-surface mt-2 tracking-tighter flex items-baseline gap-0.5">
                <AnimatedNumber value={progressPercent} /><span className="text-2xl text-on-surface-variant/50 font-medium">%</span>
             </div>
          </div>
        </section>

        {/* NOW FOCUS HERO CARD (Spacious Negative-Spacing Architecture) */}
        <section data-block-id="dashboard-now-hero" className="rounded-3xl border border-black/[0.04] bg-surface-container-lowest p-6 sm:p-7 md:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_16px_32px_rgba(10,132,255,0.08)] relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-primary/[0.04] blur-3xl pointer-events-none" />

          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between relative z-10">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-[11px] font-display font-extrabold uppercase tracking-wider text-primary">Now Focus Target</span>
                {nextTask && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    taskImpact(nextTask) === 'high'
                      ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                      : 'bg-amber-50 text-amber-800 border-amber-200/50'
                  }`}>
                    {IMPACT_LABELS[taskImpact(nextTask)]} Impact
                  </span>
                )}
              </div>

              {nextTask ? (
                <>
                  <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-on-surface truncate">{nextTask.title}</h2>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums font-medium text-primary">
                      <Clock className="w-3.5 h-3.5" />
                      {nextTask.startTime ? formatTime(nextTask.startTime) : 'Planned today'}
                    </span>
                    <span className="text-outline-variant/60">•</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums text-on-surface-variant">
                      <Timer className="w-3.5 h-3.5 text-amber-600" />
                      {effortLabel(nextTask.durationMinutes)} effort
                    </span>
                    {nextTask.subtasks && nextTask.subtasks.length > 0 && (
                      <>
                        <span className="text-outline-variant/60">•</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums font-medium text-on-surface-variant">
                          <ListChecks className="w-3.5 h-3.5" />
                          {nextTask.subtasks.filter(s => s.completed).length}/{nextTask.subtasks.length} subtasks
                        </span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-1 text-xl font-display font-bold text-on-surface">
                    {missedTasksList.length > 0 ? 'All active tasks completed or window passed.' : 'No task needs attention now.'}
                  </h2>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {missedTasksList.length > 0
                      ? `${missedTasksList.length} ${missedTasksList.length === 1 ? 'task' : 'tasks'} passed designated time. Check Missed Tasks Window below to reschedule or allocate to backlog.`
                      : 'All scheduled tasks completed. Add new task or plan tomorrow.'}
                  </p>
                </>
              )}
            </div>

            {nextTask ? (
              <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0">
                <button
                  onClick={() => setEditingTask(nextTask)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all cursor-pointer"
                >
                  View task
                </button>
                <button
                  onClick={() => handleToggleTask(nextTask.id)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-on-primary text-sm font-semibold shadow-xs hover:shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Complete task</span>
                </button>
              </div>
            ) : missedTasksList.length > 0 ? (
              <button
                onClick={() => {
                  const el = document.getElementById('missed-window-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="rounded-full bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                Review Missed Tasks ({missedTasksList.length})
              </button>
            ) : (
              <button onClick={onOpenQuickAdd} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-xs hover:shadow-sm transition-all cursor-pointer">
                Add first task
              </button>
            )}
          </div>
        </section>

        {/* ── MAIN WORKSPACE GRID ── */}
        <section className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
          {/* Left Column: Today Tasks (8 cols) */}
          <div data-block-id="dashboard-today-tasks" className="space-y-4 lg:col-span-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-1">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-display font-bold tracking-tight text-on-surface">
                    {nextTask ? 'Upcoming Queue' : 'Today'}
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold tabular-nums bg-primary/10 text-primary">
                    {activeQueueTasks.length} {activeQueueTasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {completedTodayTasksCount} of {todayTasks.length} tasks complete · {checkedHabits}/{habits.length} habits checked in
                </p>
              </div>

              {/* Filter Pills with Live Count Badges */}
              <div className="inline-flex rounded-full bg-surface-container/60 p-1 gap-1 self-start sm:self-auto">
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
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
                      filter === id ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Drag and drop sortable queue */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={activeQueueTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3 sm:space-y-3.5">
                  {activeQueueTasks.length ? (
                    activeQueueTasks.map(task => (
                      <SortableTaskItem key={task.id} id={task.id}>
                        <TaskCard
                          task={task}
                          onToggleTask={handleToggleTask}
                          onDeleteTask={onDeleteTask}
                          onUpdateTask={onUpdateTask}
                          onToggleSubtask={onToggleSubtask}
                          onEditTask={setEditingTask}
                          goals={goals}
                          habits={habits}
                        />
                      </SortableTaskItem>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-outline-variant/30 bg-surface-container-lowest p-8 text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 mx-auto" />
                      <p className="text-sm font-semibold text-on-surface">
                        {nextTask ? 'All queue tasks complete!' : 'All today tasks completed!'}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {nextTask ? 'Focus on your active target above.' : 'Add new tasks or plan tomorrow.'}
                      </p>
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>

            {/* ── MISSED TASKS WINDOW & RESCHEDULE ZONE ── */}
            {(missedTasksList.length > 0 || dayClassification.totallyMissedTasks.length > 0) && (
              <section id="missed-window-section" className="rounded-3xl border border-amber-500/25 bg-amber-500/[0.03] dark:bg-amber-500/[0.05] p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-display font-bold text-on-surface">Missed Tasks Window</h3>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-bold tabular-nums bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          {missedTasksList.length} missed
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Designated task time passed. Reschedule with AI recommendation or allocate to backlog.
                      </p>
                    </div>
                  </div>

                  {dayClassification.totallyMissedTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSweepTotallyMissed}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 text-xs font-semibold transition-all self-start sm:self-auto cursor-pointer"
                    >
                      <Inbox className="w-3.5 h-3.5" />
                      <span>Sweep {dayClassification.totallyMissedTasks.length} past to Backlog</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {missedTasksList.map(item => {
                    const rec = findIntelligentRecoverySlot({
                      item,
                      tasks,
                      schedules,
                      targetDate: todayPlan,
                      now: currentTime
                    });
                    const startFormatted = formatTime(item.startTime);
                    const endFormatted = formatTime(calculateEndTime(item.startTime, item.durationMinutes || 60));

                    return (
                      <div
                        key={`task-${item.id}`}
                        className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-surface-container-lowest p-4 sm:p-4.5 space-y-3 shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300">
                                Task
                              </span>
                              <span className="text-xs font-mono font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Window passed ({startFormatted} – {endFormatted})</span>
                              </span>
                            </div>
                            <h4 className="text-sm sm:text-base font-bold text-on-surface truncate">{item.title}</h4>
                            <div className="mt-1 flex items-center gap-3 text-xs text-on-surface-variant font-mono">
                              <span>{effortLabel(item.durationMinutes)}</span>
                              {item.category && <span>• {item.category}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Intelligent AI Recovery Suggestion */}
                        {rec && (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/[0.05] border border-primary/15 text-xs text-on-surface">
                            <Sparkles className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-medium flex-1">
                              <span className="font-bold text-primary">AI Suggestion:</span> {rec.explanation}
                            </span>
                          </div>
                        )}

                        {/* Action Row */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {rec && (
                            <button
                              type="button"
                              onClick={() => handleSmartReschedule(item, rec)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Reschedule: {rec.dateLabel} {rec.formattedTime}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleMoveToBacklog(item.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold border border-black/[0.05] transition-all cursor-pointer"
                          >
                            <Inbox className="w-3.5 h-3.5 text-on-surface-variant" />
                            <span>To Backlog</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleTask(item.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition-all ml-auto cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Mark Done</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Completed Tasks Accordion — Keeps canvas spacious and clutter-free */}
            {completedQueueTasks.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface py-2 px-1 cursor-pointer transition-colors"
                >
                  {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>Completed ({completedQueueTasks.length})</span>
                </button>
                {showCompleted && (
                  <div className="space-y-2.5 mt-2 animate-fadeIn">
                    {completedQueueTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggleTask={handleToggleTask}
                        onDeleteTask={onDeleteTask}
                        onUpdateTask={onUpdateTask}
                        onToggleSubtask={onToggleSubtask}
                        onEditTask={setEditingTask}
                        goals={goals}
                        habits={habits}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onOpenQuickAdd}
              className="hidden sm:flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/20 hover:border-primary/50 bg-primary/[0.02] hover:bg-primary/[0.05] p-3 text-sm font-semibold text-primary transition-all active:scale-[0.99] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add task for today</span>
            </button>
          </div>

          {/* Right Column: Habits (4 cols) */}
          <aside data-block-id="dashboard-sidebar-column" className="space-y-6 lg:col-span-4">
            {/* Habits Widget (Spacious Negative-Spacing Architecture) */}
            <div data-block-id="dashboard-habits-card" className="rounded-3xl bg-surface-container-lowest p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_24px_rgba(0,0,0,0.05)] border border-black/[0.04]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-display font-bold text-on-surface">Daily Habits</h2>
                    <p className="text-[11px] text-on-surface-variant">
                      <span className="font-mono tabular-nums font-semibold">{checkedHabits}</span> of <span className="font-mono tabular-nums font-semibold">{habits.length}</span> locked today
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('habits')}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <span>All habits</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Habit Completion Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden my-3.5">
                <div
                  className="h-full bg-secondary rounded-full transition-all duration-500"
                  style={{ width: `${habits.length > 0 ? Math.round((checkedHabits / habits.length) * 100) : 0}%` }}
                />
              </div>

              <div className="space-y-2">
                {habits.slice(0, 4).map(habit => {
                  const done = habit.completedDays?.includes(today);
                  const streak = (habit.completedDays || []).length;
                  return (
                    <button
                      key={habit.id}
                      onClick={() => handleHabitCheck(habit.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left transition-all active:scale-[0.99] ${
                        done
                          ? 'bg-emerald-500/[0.05] text-on-surface-variant'
                          : 'bg-surface-container-low/50 hover:bg-surface-container-low text-on-surface'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                          done ? 'border-primary bg-primary text-white shadow-2xs' : 'border-outline/40 bg-surface'
                        }`}>
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                        <span className={`text-xs font-medium truncate ${
                          done ? 'text-on-surface-variant/70 line-through' : 'text-on-surface'
                        }`}>
                          {habit.title}
                        </span>
                      </div>
                      {streak > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold tabular-nums text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/50 shrink-0">
                          <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
                          <span>{streak}d</span>
                        </span>
                      )}
                    </button>
                  );
                })}
                {!habits.length && (
                  <p className="text-xs text-on-surface-variant text-center py-4">No habits configured yet.</p>
                )}
              </div>
            </div>

            {/* Today's Timetable & Schedule Card */}
            <div data-block-id="dashboard-today-schedules-card" className="rounded-3xl bg-surface-container-lowest p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_24px_rgba(0,0,0,0.05)] border border-black/[0.04]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-display font-bold text-on-surface">Today's Schedule</h2>
                    <p className="text-[11px] text-on-surface-variant">
                      <span className="font-mono tabular-nums font-semibold">{todaySchedules.length}</span> {todaySchedules.length === 1 ? 'block' : 'blocks'} scheduled today
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onOpenQuickAdd?.({ initialMode: 'schedule' })}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline cursor-pointer"
                  title="Add timetable class block"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {todaySchedules.length > 0 ? (
                (() => {
                  const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
                  const liveSchedule = todaySchedules.find(sched => {
                    const win = getItemTimeWindow(sched);
                    return win && currentMins >= win.startMins && currentMins <= win.endMins;
                  });
                  const upNextSchedule = !liveSchedule
                    ? todaySchedules.find(sched => {
                        const win = getItemTimeWindow(sched);
                        return win && currentMins < win.startMins;
                      })
                    : null;

                  return (
                    <div className="relative pl-3 space-y-3 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-indigo-100 dark:before:bg-indigo-900/40">
                      {todaySchedules.map(sched => {
                        const startLabel = sched.startTime ? formatTime(sched.startTime) : 'Flexible';
                        const endLabel = sched.endTime ? formatTime(sched.endTime) : (sched.startTime ? formatTime(calculateEndTime(sched.startTime, sched.durationMinutes || 60)) : '');
                        const win = getItemTimeWindow(sched);
                        const isDone = Boolean(
                          sched.completed ||
                          (Array.isArray(sched.completedDates) && sched.completedDates.includes(todayPlan))
                        );
                        const isOngoing = !isDone && win && currentMins >= win.startMins && currentMins <= win.endMins;
                        const isUpNext = !isDone && !isOngoing && upNextSchedule && String(sched.id) === String(upNextSchedule.id);
                        const isPassed = !isDone && win && currentMins > win.endMins;

                        return (
                          <div
                            key={sched.id}
                            onClick={() => setEditingSchedule(sched)}
                            className={`group relative flex items-start gap-3.5 rounded-2xl p-3 transition-all cursor-pointer active:scale-[0.99] ${
                              isDone
                                ? 'bg-emerald-50/50 hover:bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 opacity-90'
                                : isOngoing
                                  ? 'bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border-2 border-indigo-500/80 ring-2 ring-indigo-500/20 shadow-sm'
                                  : isUpNext
                                    ? 'bg-indigo-50/70 hover:bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs'
                                    : isPassed
                                      ? 'bg-surface-container-low/30 hover:bg-surface-container-low/60 border border-black/[0.04] opacity-75'
                                      : 'bg-indigo-50/40 hover:bg-indigo-50/80 border border-indigo-100/70'
                            }`}
                          >
                            {/* Timeline Node */}
                            <div className={`relative z-10 -ml-[18px] mt-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white shadow-2xs ${
                              isDone ? 'bg-emerald-600' : 'bg-indigo-600'
                            }`}>
                              {isOngoing && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              )}
                              <div className="relative h-1.5 w-1.5 rounded-full bg-white" />
                            </div>

                            {/* Schedule Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-bold truncate transition ${
                                  isDone
                                    ? 'line-through text-slate-400 dark:text-slate-500 group-hover:text-emerald-700'
                                    : 'text-indigo-950 dark:text-indigo-200 group-hover:text-indigo-700'
                                }`}>
                                  {sched.title}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isDone && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[9px] font-extrabold uppercase tracking-wider">
                                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      Attended
                                    </span>
                                  )}
                                  {isOngoing && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-extrabold uppercase tracking-wider shadow-2xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                      Live Now
                                    </span>
                                  )}
                                  {isUpNext && (
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-[9px] font-bold uppercase tracking-wider">
                                      Up Next
                                    </span>
                                  )}
                                  {isPassed && (
                                    <span className="px-1.5 py-0.2 rounded-md bg-black/[0.04] dark:bg-white/[0.06] text-on-surface-variant text-[9px] font-medium">
                                      Passed
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono font-bold text-indigo-600/90 dark:text-indigo-400">
                                    {sched.durationMinutes || 60}m
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
                                    {startLabel}{endLabel ? ` – ${endLabel}` : ''}
                                  </span>
                                  {sched.category && (
                                    <span className="px-1.5 py-0.2 rounded-md bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold uppercase tracking-wider shrink-0">
                                      {sched.category}
                                    </span>
                                  )}
                                </div>

                                {/* Done Toggle Button */}
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleScheduleDone(sched, todayPlan, e)}
                                  className={`p-1.5 rounded-xl border transition-all shrink-0 cursor-pointer ${
                                    isDone
                                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                                      : 'border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-surface-container hover:border-emerald-500 hover:text-emerald-600 text-slate-300 shadow-2xs'
                                  }`}
                                  title={isDone ? "Mark as not attended" : "Mark as attended / completed"}
                                  aria-label={isDone ? "Mark schedule as incomplete" : "Mark schedule as completed"}
                                >
                                  <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isDone ? 'text-white' : ''}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-5 px-3 rounded-2xl bg-surface-container-low/40 border border-dashed border-black/[0.06] space-y-2">
                  <p className="text-xs text-on-surface-variant">No classes or timetable routines today</p>
                  <button
                    onClick={() => onOpenQuickAdd?.({ initialMode: 'schedule' })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Schedule a Class</span>
                  </button>
                </div>
              )}
            </div>
          </aside>
        </section>

        {/* ── GOALS CAROUSEL SECTION (Spacious Negative-Spacing Architecture) ── */}
        <section data-block-id="dashboard-goals-card" className="rounded-3xl bg-surface-container-lowest p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_24px_rgba(0,0,0,0.05)] border border-black/[0.04]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Active Horizons</p>
              <h2 className="mt-0.5 text-lg sm:text-xl font-display font-bold text-on-surface">Goals Moving Forward</h2>
            </div>
            <button
              onClick={() => setActiveTab('goals')}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>View all goals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex overflow-x-auto gap-4 pb-3 scrollbar-none snap-x md:grid md:grid-cols-3">
            {activeGoals.length ? (
              activeGoals.map(goal => {
                const progress = goal.workProgress ?? goal.progress ?? 0;
                const next = goal.nextTask?.title;
                return (
                  <div key={goal.id} className="min-w-[280px] sm:min-w-0 flex-1 snap-start rounded-2xl bg-surface-container-low/50 hover:bg-surface-container-low border border-black/[0.03] p-5 flex flex-col justify-between transition-all">
                    <button onClick={() => setActiveTab('goals')} className="w-full text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-display font-bold text-on-surface">{goal.title}</span>
                        <span className="text-xs font-mono font-extrabold tabular-nums text-primary">{progress}%</span>
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
                      className="mt-3.5 text-xs font-semibold text-primary hover:underline text-left inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add next task</span>
                    </button>
                  </div>
                );
              })
            ) : (
              <button onClick={() => setActiveTab('goals')} className="rounded-2xl bg-surface-container-low/60 p-5 text-left text-sm font-semibold text-primary">
                Create first goal
              </button>
            )}
          </div>
        </section>
      </div>

      <TaskDetailModal task={editingTask} isOpen={!!editingTask} onClose={() => setEditingTask(null)} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} goals={goals} habits={habits} onStartFocus={onStartFocus} />
      <ScheduleDetailModal
        schedule={editingSchedule}
        isOpen={Boolean(editingSchedule)}
        onClose={() => setEditingSchedule(null)}
        onUpdateSchedule={onUpdateSchedule}
        onDeleteSchedule={onDeleteSchedule}
      />
    </main>
  );
});

export default DashboardView;
