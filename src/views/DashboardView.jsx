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
  RotateCcw,
  Pencil,
  Lock,
  Link2
} from 'lucide-react';
import {
  isTaskBlocked,
  getBlockingPrerequisites,
  calculateCascadeReschedule
} from '../lib/taskDependencies';
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
import HabitModal from '../components/HabitModal';
import { deadlineStatus, effortLabel, IMPACT_LABELS, taskImpact, taskPlanDate, todayPlanDate, isTaskScheduledForDate, isTaskCompletedForDate, calculateEndTime } from '../lib/taskMetadata';
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
  onOpenQuickAdd, onStartFocus, onCheckInHabit, onAddHabit, onUpdateHabit, onDeleteHabit, stats = {}, setActiveTab,
  settings = {}, onUpdateSettings, goals = [], habits = [],
  schedules = [], onUpdateSchedule, onDeleteSchedule, moveTaskToBacklog, sweepMissedTasksToBacklog,
}) {
  const [filter, setFilter] = useState('all');
  const [editingTask, setEditingTask] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editingHabit, setEditingHabit] = useState(null);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [mobileSection, setMobileSection] = useState('focus'); // 'focus' | 'timeline' | 'habits'
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
        completed: isTaskCompletedForDate(t, todayPlan) ? 1 : 0,
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
    const todayMissed = dayClassification.missedTasks || (dayClassification.missed || []).filter(m => m.itemType === 'task');
    const pastMissed = dayClassification.totallyMissedTasks || [];
    return [...todayMissed, ...pastMissed];
  }, [dayClassification.missedTasks, dayClassification.missed, dayClassification.totallyMissedTasks]);

  // Active tasks for upcoming queue (excludes missed tasks and current focus target)
  const activeUpcomingTasks = useMemo(() => {
    const missedIds = new Set(missedTasksList.map(m => String(m.id)));
    const focusId = nextTask ? String(nextTask.id) : null;

    return todayTasks.filter(t => !isTaskCompletedForDate(t, todayPlan) && !missedIds.has(String(t.id)) && String(t.id) !== focusId);
  }, [todayTasks, missedTasksList, nextTask, todayPlan]);

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
      if (isTaskCompletedForDate(todayTasks[i], todayPlan)) completed++;
    }
    return {
      filterCounts: { all: len, high, quick },
      completedTodayTasksCount: completed
    };
  }, [activeUpcomingTasks, todayTasks, quickWinMinutes, todayPlan]);

  const visibleTasks = useMemo(() => {
    if (filter === 'all') return activeUpcomingTasks;
    if (filter === 'high') return activeUpcomingTasks.filter(task => taskImpact(task) === 'high');
    return activeUpcomingTasks.filter(task => (task.durationMinutes || 60) <= quickWinMinutes);
  }, [activeUpcomingTasks, filter, quickWinMinutes]);

  const activeQueueTasks = visibleTasks;
  const completedQueueTasks = useMemo(() => todayTasks.filter(t => isTaskCompletedForDate(t, todayPlan)), [todayTasks, todayPlan]);

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

  const handleCascadeReschedule = (rootTask, rec) => {
    if (!rootTask || !rec) return;
    const patches = calculateCascadeReschedule({
      rootTask,
      newStartTime: rec.startTime || '18:00',
      newDate: rec.date,
      allTasks: tasks,
      goals
    });
    patches.forEach(patch => {
      onUpdateTask?.(patch.id, {
        plannedDate: patch.plannedDate,
        startTime: patch.startTime,
        dueDate: patch.plannedDate === todayPlan ? 'Today' : 'Tomorrow',
        date: patch.plannedDate === todayPlan ? 'Today' : 'Tomorrow',
        isBacklog: false
      });
    });
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
    if (task && !isTaskCompletedForDate(task, todayPlan)) {
      const remainingUncompleted = todayTasks.filter(t => !isTaskCompletedForDate(t, todayPlan) && t.id !== taskId).length;
      if (remainingUncompleted === 0) {
        triggerCelebration({ count: 90, spread: 80 });
      }
    }
    onToggleTask?.(taskId, todayPlan);
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

  const [inlineTaskTitle, setInlineTaskTitle] = useState('');

  const handleInlineQuickAdd = (e) => {
    e.preventDefault();
    if (!inlineTaskTitle.trim()) return;
    onOpenQuickAdd?.({ initialTitle: inlineTaskTitle.trim() });
    setInlineTaskTitle('');
  };

  const totalPlannedMinutes = useMemo(() => {
    return (
      todayTasks.reduce((acc, t) => acc + (t.durationMinutes || 30), 0) +
      todaySchedules.reduce((acc, s) => acc + (s.durationMinutes || 60), 0)
    );
  }, [todayTasks, todaySchedules]);

  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  const getScheduleColor = (category = '') => {
    const c = category.toLowerCase();
    if (c.includes('college') || c.includes('class') || c.includes('study') || c.includes('lecture')) {
      return {
        pillBg: 'bg-[#0F52BA]/10 text-[#0F52BA] dark:bg-[#0F52BA]/20 dark:text-[#6495ED] border-[#0F52BA]/25',
        badgeBg: 'bg-[#0F52BA]/20 text-[#0F52BA] dark:bg-[#0F52BA]/30 dark:text-[#6495ED]',
        ringBorder: 'border-[#0F52BA]',
        glow: 'from-[#0F52BA] to-[#1E3A8A]',
        accent: '#0F52BA'
      };
    }
    if (c.includes('gym') || c.includes('fitness') || c.includes('workout') || c.includes('sport')) {
      return {
        pillBg: 'bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#2E6F40]/20 dark:text-emerald-400 border-[#2E6F40]/25',
        badgeBg: 'bg-[#2E6F40]/20 text-[#2E6F40] dark:bg-[#2E6F40]/30 dark:text-emerald-400',
        ringBorder: 'border-[#2E6F40]',
        glow: 'from-[#2E6F40] to-[#1E4D2B]',
        accent: '#2E6F40'
      };
    }
    if (c.includes('deep') || c.includes('focus') || c.includes('lab') || c.includes('project') || c.includes('work')) {
      return {
        pillBg: 'bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/25',
        badgeBg: 'bg-purple-500/20 text-purple-700 dark:bg-purple-500/30 dark:text-purple-300',
        ringBorder: 'border-purple-500',
        glow: 'from-purple-700 to-indigo-900',
        accent: '#7c3aed'
      };
    }
    return {
      pillBg: 'bg-sky-500/10 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 border-sky-500/25',
      badgeBg: 'bg-sky-500/20 text-sky-700 dark:bg-sky-500/30 dark:text-sky-300',
      ringBorder: 'border-sky-500',
      glow: 'from-sky-700 to-blue-900',
      accent: '#0284c7'
    };
  };

  const activeScheduleInfo = useMemo(() => {
    if (!todaySchedules.length) return null;

    const parseToMin = (t) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    // 1. Is any schedule currently happening now?
    for (const sched of todaySchedules) {
      const sMin = parseToMin(sched.startTime);
      const dur = sched.durationMinutes || 60;
      const eMin = sched.endTime ? parseToMin(sched.endTime) : sMin + dur;
      const isDone = Boolean(
        sched.completed ||
        (Array.isArray(sched.completedDates) && sched.completedDates.includes(todayPlan))
      );
      if (!isDone && currentMinutes >= sMin && currentMinutes < eMin) {
        return {
          id: sched.id,
          sched,
          isActive: true,
          statusLabel: 'Active Now',
          countdownText: `${eMin - currentMinutes}m remaining`
        };
      }
    }

    // 2. Otherwise find the first upcoming uncompleted schedule
    for (const sched of todaySchedules) {
      const sMin = parseToMin(sched.startTime);
      const isDone = Boolean(
        sched.completed ||
        (Array.isArray(sched.completedDates) && sched.completedDates.includes(todayPlan))
      );
      if (!isDone && sMin > currentMinutes) {
        const diff = sMin - currentMinutes;
        const countdownText = diff <= 60
          ? `In ${diff} mins`
          : `In ${Math.floor(diff / 60)}h ${diff % 60 > 0 ? `${diff % 60}m` : ''}`;
        return {
          id: sched.id,
          sched,
          isActive: false,
          statusLabel: 'Up Next',
          countdownText
        };
      }
    }

    // 3. Fallback: first uncompleted or first item
    const fallback = todaySchedules.find(s => !s.completed && !(Array.isArray(s.completedDates) && s.completedDates.includes(todayPlan))) || todaySchedules[0];
    return fallback ? {
      id: fallback.id,
      sched: fallback,
      isActive: false,
      statusLabel: 'Scheduled',
      countdownText: formatTime(fallback.startTime)
    } : null;
  }, [todaySchedules, currentMinutes, todayPlan]);

  const todayTimelineItems = useMemo(() => {
    const parseToMin = (t) => {
      if (!t) return 9999;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const items = [];

    // 1. Real Schedules
    (todaySchedules || []).forEach(s => {
      const isDone = Boolean(
        s.completed ||
        (Array.isArray(s.completedDates) && s.completedDates.includes(todayPlan))
      );
      items.push({
        id: `sched-${s.id}`,
        rawId: s.id,
        type: 'schedule',
        raw: s,
        title: s.title,
        startTime: s.startTime || '09:00',
        endTime: s.endTime || (s.startTime ? calculateEndTime(s.startTime, s.durationMinutes || 60) : ''),
        timeMin: parseToMin(s.startTime || '09:00'),
        durationMinutes: s.durationMinutes || 60,
        category: s.category || 'Class',
        isDone,
      });
    });

    // 2. Real Habits (real user habits with scheduled/preferred time)
    const todayDayOfWeek = new Date(`${todayPlan}T12:00:00`).getDay();
    const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    (habits || []).forEach(h => {
      if (h.isTimeBlocked === false) return;
      const targetFreq = h.targetFrequency || 'Every Day';
      if (targetFreq === 'Weekdays' && (todayDayOfWeek < 1 || todayDayOfWeek > 5)) return;
      if (targetFreq === '3 Days / Wk' && !(todayDayOfWeek === 1 || todayDayOfWeek === 3 || todayDayOfWeek === 5)) return;
      if (targetFreq === 'Custom' && Array.isArray(h.customDays) && !h.customDays.includes(dayShorts[todayDayOfWeek])) return;
      const isDone = Boolean((h.completedDays || []).includes(today));
      const sTime = h.startTime || '08:00';
      items.push({
        id: `habit-${h.id}`,
        rawId: h.id,
        type: 'habit',
        raw: h,
        title: h.title,
        startTime: sTime,
        endTime: calculateEndTime(sTime, h.durationMinutes || 30),
        timeMin: parseToMin(sTime),
        durationMinutes: h.durationMinutes || 30,
        category: 'Habit',
        isDone,
      });
    });

    // 3. Real Today Tasks
    const scheduledTasks = (todayTasks || []).filter(t => t.startTime);
    scheduledTasks.forEach(t => {
      const isDone = isTaskCompletedForDate(t, todayPlan);
      items.push({
        id: `task-${t.id}`,
        rawId: t.id,
        type: 'task',
        raw: t,
        title: t.title,
        startTime: t.startTime,
        endTime: calculateEndTime(t.startTime, t.durationMinutes || 30),
        timeMin: parseToMin(t.startTime),
        durationMinutes: t.durationMinutes || 30,
        category: t.category || 'Task',
        isDone,
      });
    });

    // If total items is low (< 4), slot in unscheduled today tasks into open daytime hours so branches always exist naturally
    if (items.length < 4) {
      const unscheduledTasks = (todayTasks || []).filter(t => !t.startTime);
      const needed = 4 - items.length;
      const candidateSlots = ['10:00', '13:30', '15:30', '19:00'];

      unscheduledTasks.slice(0, needed).forEach((t, idx) => {
        const isDone = isTaskCompletedForDate(t, todayPlan);
        const assignedSlot = candidateSlots[idx % candidateSlots.length];
        items.push({
          id: `task-${t.id}`,
          rawId: t.id,
          type: 'task',
          raw: t,
          title: t.title,
          startTime: assignedSlot,
          endTime: calculateEndTime(assignedSlot, t.durationMinutes || 30),
          timeMin: parseToMin(assignedSlot),
          durationMinutes: t.durationMinutes || 30,
          category: t.category || 'Task',
          isDone,
        });
      });
    }

    // Sort chronologically by timeMin
    return items.sort((a, b) => {
      if (a.timeMin !== b.timeMin) return a.timeMin - b.timeMin;
      return a.title.localeCompare(b.title);
    });
  }, [todaySchedules, habits, todayTasks, todayPlan, today]);

  const getPillPalette = (item, index) => {
    if (item.isDone) {
      return {
        cardBg: 'bg-[#2E6F40]/[0.05] dark:bg-[#2E6F40]/[0.12] border-[#2E6F40]/20',
        barColor: 'bg-[#2E6F40]',
        timeColor: 'text-[#2E6F40] dark:text-emerald-400',
        nodeBorder: 'border-[#2E6F40]'
      };
    }

    const title = (item.title || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    const str = `${title} ${cat}`;

    // Academic / College / Class / Work Split -> Cobalt
    if (str.includes('college') || str.includes('class') || str.includes('lecture') || str.includes('study') || str.includes('work') || str.includes('split') || str.includes('meeting')) {
      return {
        cardBg: 'bg-[#F7F6F2]/85 dark:bg-[#222227] border-black/[0.07] dark:border-white/[0.08] hover:border-[#0F52BA]/35',
        barColor: 'bg-[#0F52BA]',
        timeColor: 'text-[#0F52BA] dark:text-[#6495ED]',
        nodeBorder: 'border-[#0F52BA]'
      };
    }

    // High Intensity / HIIT / Sprint / Cardio -> Terracotta / Amber
    if (str.includes('hiit') || str.includes('sprint') || str.includes('interval') || str.includes('zone 2') || str.includes('cardio') || str.includes('run')) {
      return {
        cardBg: 'bg-[#F7F6F2]/85 dark:bg-[#222227] border-black/[0.07] dark:border-white/[0.08] hover:border-[#C84B31]/35',
        barColor: 'bg-[#C84B31]',
        timeColor: 'text-[#C84B31] dark:text-orange-400',
        nodeBorder: 'border-[#C84B31]'
      };
    }

    // Strength / Gym / Mobility / Nutrition -> Forest
    if (str.includes('strength') || str.includes('gym') || str.includes('lift') || str.includes('workout') || str.includes('mobility') || str.includes('nutrition') || str.includes('protein')) {
      return {
        cardBg: 'bg-[#F7F6F2]/85 dark:bg-[#222227] border-black/[0.07] dark:border-white/[0.08] hover:border-[#2E6F40]/35',
        barColor: 'bg-[#2E6F40]',
        timeColor: 'text-[#2E6F40] dark:text-emerald-400',
        nodeBorder: 'border-[#2E6F40]'
      };
    }

    // Creative / Review / Reading -> Violet
    if (str.includes('dance') || str.includes('music') || str.includes('guitar') || str.includes('art') || str.includes('creative') || str.includes('review') || str.includes('sleep') || str.includes('reading')) {
      return {
        cardBg: 'bg-[#F7F6F2]/85 dark:bg-[#222227] border-black/[0.07] dark:border-white/[0.08] hover:border-purple-500/35',
        barColor: 'bg-purple-600 dark:bg-purple-400',
        timeColor: 'text-purple-700 dark:text-purple-300',
        nodeBorder: 'border-purple-600'
      };
    }

    const palettes = [
      { cardBg: 'bg-[#F7F6F2]/85 dark:bg-[#222227] border-black/[0.07] dark:border-white/[0.08]', barColor: 'bg-[#0F52BA]', timeColor: 'text-[#0F52BA] dark:text-[#6495ED]', nodeBorder: 'border-[#0F52BA]' },
      { cardBg: 'bg-[#F7F6F2]/85 dark:bg-[#222227] border-black/[0.07] dark:border-white/[0.08]', barColor: 'bg-[#2E6F40]', timeColor: 'text-[#2E6F40] dark:text-emerald-400', nodeBorder: 'border-[#2E6F40]' },
      { cardBg: 'bg-[#F7F6F2]/85 dark:bg-[#222227] border-black/[0.07] dark:border-white/[0.08]', barColor: 'bg-[#D97706]', timeColor: 'text-[#D97706] dark:text-amber-400', nodeBorder: 'border-[#D97706]' },
      { cardBg: 'bg-[#F7F6F2]/85 dark:bg-[#222227] border-black/[0.07] dark:border-white/[0.08]', barColor: 'bg-purple-600', timeColor: 'text-purple-700 dark:text-purple-300', nodeBorder: 'border-purple-600' }
    ];
    return palettes[index % palettes.length];
  };

  const nextTimelineItem = useMemo(() => {
    return todayTimelineItems.find(item => !item.isDone && (item.timeMin + (item.durationMinutes || 60)) > currentMinutes) || todayTimelineItems.find(item => !item.isDone) || null;
  }, [todayTimelineItems, currentMinutes]);

  const last7Days = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      days.push({ key, label, isToday: i === 0 });
    }
    return days;
  }, []);

  return (
    <main className="w-full min-h-screen bg-[#F7F6F2] dark:bg-[#121214] pt-[calc(3.85rem+env(safe-area-inset-top))] md:pt-15 pb-6 sm:pb-8 px-3.5 sm:px-5 lg:px-8 transition-colors duration-200">
      <div className="mx-auto w-full max-w-[1520px] space-y-3.5 sm:space-y-5">
        
        {/* ── Sub-header: Minimalist Focus Briefing ── */}
        <header data-block-id="dashboard-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-2 border-b border-black/[0.06] dark:border-white/[0.07]">
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-3xl font-editorial tracking-tight text-[#161618] dark:text-[#F7F6F2] truncate flex items-center gap-2 leading-tight">
              <span>{greeting}, {userName}</span>
              <span className="text-lg sm:text-xl">{progressEmotion.emoji}</span>
            </h1>
            <p className="font-editorial text-xs sm:text-sm italic text-[#6B6A72] dark:text-[#8E8E93] mt-0.5">
              Focus on what matters right now · Lock your momentum.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick Metrics Capsule */}
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 bg-white dark:bg-[#1A1A1E] border border-black/[0.07] dark:border-white/[0.08] rounded-xl px-3 py-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-mono font-bold text-[#0F52BA] dark:text-[#6495ED]">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{Math.round(totalPlannedMinutes / 60 * 10) / 10}h planned</span>
              </div>
              <span className="h-3 w-[1px] bg-black/10 dark:bg-white/10" />
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-mono text-[#6B6A72] dark:text-[#8E8E93]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{completedTodayTasksCount}/{todayTasks.length} done</span>
              </div>
              <span className="h-3 w-[1px] bg-black/10 dark:bg-white/10" />
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-mono text-[#6B6A72] dark:text-[#8E8E93]">
                <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{checkedHabits}/{habits.length} habits</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Android / Mobile Segmented Workspace Switcher (< lg) ── */}
        <div className="lg:hidden flex items-center p-1 rounded-2xl bg-black/[0.05] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.07]">
          {[
            { id: 'focus', label: 'Focus & Tasks', badge: activeQueueTasks.length + (nextTask ? 1 : 0) },
            { id: 'timeline', label: 'Timeline', badge: todayTimelineItems.length },
            { id: 'habits', label: 'Habits & Goals', badge: `${checkedHabits}/${habits.length}` }
          ].map((tab) => {
            const active = mobileSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileSection(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[11.5px] transition-all cursor-pointer select-none ${
                  active
                    ? 'bg-white dark:bg-[#1E1E24] text-[#161618] dark:text-[#F7F6F2] font-bold shadow-xs'
                    : 'text-[#6B6A72] dark:text-[#8E8E93] font-medium hover:text-[#161618] dark:hover:text-white'
                }`}
              >
                <span className="truncate">{tab.label}</span>
                <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full shrink-0 ${
                  active
                    ? 'bg-[#0F52BA]/12 text-[#0F52BA] dark:bg-[#6495ED]/20 dark:text-[#6495ED] font-bold'
                    : 'bg-black/[0.05] dark:bg-white/[0.06] text-[#6B6A72] dark:text-[#8E8E93]'
                }`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── 3-PANE THINGS 3 x SUNSAMA WORKSPACE ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6 items-start">
          
          {/* ══════════════════════════════════════════════════════════
              PANE 1: DAILY TIMELINE (Left 4 Cols)
              Tactile Editorial Timeline Rail (Zero Overflow)
              ══════════════════════════════════════════════════════════ */}
          <aside className={`${mobileSection === 'timeline' ? 'block' : 'hidden lg:block'} lg:col-span-4 bg-white dark:bg-[#1A1A1E] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] p-3.5 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.02)] space-y-3.5 min-w-0 overflow-hidden`}>
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 text-[#0F52BA] dark:text-[#6495ED] shrink-0" />
                <h2 className="text-sm font-bold tracking-tight text-[#161618] dark:text-[#F7F6F2] truncate">Daily Timeline</h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-black/[0.05] dark:bg-white/[0.08] text-[#6B6A72] dark:text-[#8E8E93] shrink-0">
                  {todayTimelineItems.length}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab?.('today')}
                  className="text-[11px] font-mono font-semibold text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#0F52BA] transition cursor-pointer"
                >
                  Grid →
                </button>
                <button
                  type="button"
                  onClick={() => onOpenQuickAdd?.({ initialMode: 'schedule' })}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0F52BA]/10 text-[11px] font-semibold text-[#0F52BA] dark:text-[#6495ED] hover:bg-[#0F52BA]/15 transition cursor-pointer"
                  title="Add timetable schedule block"
                >
                  <Plus className="w-3 h-3" />
                  <span>Block</span>
                </button>
              </div>
            </div>

            {/* Tactile Editorial Timeline List */}
            {todayTimelineItems.length > 0 ? (
              <div className="relative py-1 space-y-2.5 max-h-[calc(100dvh-250px)] overflow-y-auto overflow-x-hidden pr-0.5 scrollbar-thin">
                {/* Subtle Vertical Rail Track */}
                <div className="absolute left-[11px] top-2 bottom-2 w-[1.5px] bg-black/[0.08] dark:bg-white/[0.10]" />

                {todayTimelineItems.map((item, index) => {
                  const palette = getPillPalette(item, index);
                  const isDone = item.isDone;
                  const sMin = item.timeMin;
                  const dur = item.durationMinutes || 60;
                  const eMin = sMin + dur;
                  const isCurrentActive = currentMinutes >= sMin && currentMinutes < eMin && !isDone;

                  return (
                    <div key={item.id} className="relative flex items-center pl-7 min-w-0 w-full">
                      {/* Node on Vertical Rail */}
                      <div className={`absolute left-[6px] z-10 flex items-center justify-center transition-all ${
                        isCurrentActive
                          ? 'w-3.5 h-3.5 rounded-full bg-[#0F52BA] text-white ring-4 ring-[#0F52BA]/25 -translate-x-[1px]'
                          : isDone
                            ? 'w-3 h-3 rounded-full bg-[#2E6F40] text-white'
                            : `w-3 h-3 rounded-full border-2 ${palette.nodeBorder} bg-white dark:bg-[#1A1A1E]`
                      }`}>
                        {isDone && <Check className="w-2 h-2 stroke-[3]" />}
                      </div>

                      {/* Tactile Card — Strictly Contained (min-w-0) */}
                      <div
                        onClick={() => {
                          if (item.type === 'schedule') setEditingSchedule(item.raw);
                          else if (item.type === 'task') setEditingTask(item.raw);
                          else {
                            setEditingHabit(item.raw);
                            setIsHabitModalOpen(true);
                          }
                        }}
                        title={item.type === 'habit' ? 'Click to edit habit sequence' : 'Click to edit details'}
                        className={`flex-1 min-w-0 overflow-hidden flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border transition-all cursor-pointer select-none active:scale-[0.99] ${
                          isCurrentActive
                            ? 'bg-[#0F52BA]/[0.06] dark:bg-[#0F52BA]/[0.15] border-[#0F52BA]/35 shadow-2xs'
                            : palette.cardBg
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Left Semantic Accent Bar */}
                          <div className={`w-1 h-7 rounded-full shrink-0 ${palette.barColor}`} />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`font-mono text-[10.5px] font-bold tabular-nums shrink-0 ${palette.timeColor}`}>
                                {formatTime(item.startTime)}
                              </span>
                              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded bg-black/[0.04] dark:bg-white/[0.06] text-[#6B6A72] dark:text-[#8E8E93] shrink-0">
                                {item.category || item.type}
                              </span>
                              {isCurrentActive && (
                                <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-[#0F52BA] text-white shrink-0">
                                  Now
                                </span>
                              )}
                            </div>
                            <p className={`text-[12.5px] font-semibold truncate leading-snug mt-0.5 ${
                              isDone
                                ? 'line-through text-[#6B6A72] dark:text-[#8E8E93]'
                                : 'text-[#161618] dark:text-[#F7F6F2]'
                            }`}>
                              {item.title}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.type === 'schedule') handleToggleScheduleDone(item.raw, todayPlan, e);
                              else if (item.type === 'habit') handleHabitCheck(item.rawId);
                              else handleToggleTask(item.rawId);
                            }}
                            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                              isDone
                                ? 'bg-[#2E6F40] border-[#2E6F40] text-white shadow-2xs'
                                : 'border-black/20 dark:border-white/25 bg-white dark:bg-[#1A1A1E] text-transparent hover:border-[#2E6F40] hover:text-[#2E6F40]'
                            }`}
                            title={isDone ? 'Click to undo' : item.type === 'schedule' ? 'Mark attended' : 'Mark done'}
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center rounded-xl border border-dashed border-black/10 dark:border-white/10">
                <Clock className="w-8 h-8 text-[#6B6A72]/40 mx-auto mb-2" />
                <p className="text-xs font-medium text-[#161618] dark:text-[#F7F6F2]">No items scheduled today</p>
                <p className="text-[11px] text-[#6B6A72] dark:text-[#8E8E93] mt-0.5">
                  Click + Block or add tasks with a start time.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenQuickAdd?.({ initialMode: 'schedule' })}
                  className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-xs font-semibold text-[#0F52BA] hover:bg-black/[0.08] transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Timetable Event</span>
                </button>
              </div>
            )}
          </aside>

          {/* ══════════════════════════════════════════════════════════
              PANE 2: DAILY FOCUS QUEUE (Center 5 Cols)
              Unified Executive Workbench (Header, Triage, Active Target, Queue)
              ══════════════════════════════════════════════════════════ */}
          <section className={`${mobileSection === 'focus' ? 'block' : 'hidden lg:block'} lg:col-span-5 bg-white dark:bg-[#1A1A1E] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.02)] space-y-4 min-w-0 overflow-hidden`}>
            {/* Compact Mobile Schedule Peek Strip (Links directly to Timeline tab) */}
            {nextTimelineItem && (
              <div
                onClick={() => setMobileSection('timeline')}
                className="lg:hidden flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-[#F7F6F2] dark:bg-[#222227] border border-black/[0.06] dark:border-white/[0.07] cursor-pointer active:scale-[0.99] transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#0F52BA] shrink-0" />
                  <span className="font-mono text-[10.5px] font-bold text-[#0F52BA] dark:text-[#6495ED] shrink-0">
                    {formatTime(nextTimelineItem.startTime)}
                  </span>
                  <span className="text-xs font-semibold text-[#161618] dark:text-[#F7F6F2] truncate">
                    {nextTimelineItem.title}
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold text-[#0F52BA] dark:text-[#6495ED] shrink-0">
                  Timeline →
                </span>
              </div>
            )}
            
            {/* ── Workbench Header & Filter Tabs ── */}
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#0F52BA]" />
                <h2 className="text-sm font-semibold tracking-tight text-[#161618] dark:text-[#F7F6F2]">Focus Workbench</h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-black/[0.05] dark:bg-white/[0.08] text-[#6B6A72] dark:text-[#8E8E93]">
                  {activeQueueTasks.length} queued
                </span>
                {missedTasksList.length > 0 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    {missedTasksList.length} to triage
                  </span>
                )}
              </div>

              {/* Filter Pills */}
              <div className="inline-flex rounded-lg bg-black/[0.04] dark:bg-white/[0.06] p-0.5 gap-0.5 border border-black/[0.04] dark:border-white/[0.06]">
                {[
                  ['all', 'All', filterCounts.all],
                  ['high', 'High', filterCounts.high],
                  ['quick', `≤ ${quickWinMinutes}m`, filterCounts.quick]
                ].map(([id, label, count]) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-all cursor-pointer ${
                      filter === id
                        ? 'bg-white dark:bg-[#252529] text-[#161618] dark:text-[#F7F6F2] shadow-2xs font-semibold'
                        : 'text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] font-medium'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-[9px] font-mono opacity-70">({count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Inline Quick-Add Input (Clean Integrated Bar) ── */}
            <form onSubmit={handleInlineQuickAdd} className="relative flex items-center">
              <Plus className="absolute left-3 w-4 h-4 text-[#6B6A72] dark:text-[#8E8E93]" />
              <input
                type="text"
                value={inlineTaskTitle}
                onChange={(e) => setInlineTaskTitle(e.target.value)}
                placeholder="Add a task to Today... (Press Enter)"
                className="w-full pl-9 pr-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-[#161618] dark:text-[#F7F6F2] placeholder-[#6B6A72]/60 dark:placeholder-[#8E8E93]/60 focus:outline-none focus:ring-1 focus:ring-[#0F52BA] transition-all"
              />
            </form>

            {/* ── 1. ACTIVE FOCUS TARGET (If present) ── */}
            {nextTask && (
              <div data-block-id="dashboard-now-hero" className={`rounded-xl border ${
                nextTask.isDependencyBottleneck
                  ? 'border-amber-500/40 bg-amber-500/[0.05] dark:bg-amber-500/[0.08]'
                  : 'border-[#0F52BA]/25 bg-[#0F52BA]/[0.03] dark:bg-[#0F52BA]/[0.06]'
              } p-4 space-y-3 relative overflow-hidden`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                        nextTask.isDependencyBottleneck ? 'bg-amber-500' : 'bg-[#0F52BA]'
                      } opacity-60`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        nextTask.isDependencyBottleneck ? 'bg-amber-500' : 'bg-[#0F52BA]'
                      }`}></span>
                    </span>
                    <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${
                      nextTask.isDependencyBottleneck ? 'text-amber-700 dark:text-amber-400' : 'text-[#0F52BA] dark:text-[#6495ED]'
                    }`}>
                      {nextTask.isDependencyBottleneck ? '⚡ Priority Prerequisite Unblock' : 'Now Focus Target'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {nextTask.isDependencyBottleneck && nextTask.blocksTaskTitle && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                        <Link2 className="w-2.5 h-2.5" />
                        Unblocks: {nextTask.blocksTaskTitle}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                      taskImpact(nextTask) === 'high'
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/40'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/40'
                    }`}>
                      {IMPACT_LABELS[taskImpact(nextTask)]} Impact
                    </span>
                  </div>
                </div>

                <div>
                  <h3
                    onClick={() => setEditingTask(nextTask)}
                    className="text-base sm:text-lg font-editorial font-medium tracking-tight text-[#161618] dark:text-[#F7F6F2] hover:text-[#0F52BA] transition cursor-pointer truncate"
                  >
                    {nextTask.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6B6A72] dark:text-[#8E8E93]">
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#0F52BA] dark:text-[#6495ED]">
                      <Clock className="w-3.5 h-3.5" />
                      {nextTask.startTime ? formatTime(nextTask.startTime) : 'Planned today'}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Timer className="w-3.5 h-3.5 text-amber-600" />
                      {effortLabel(nextTask.durationMinutes)}
                    </span>
                    {nextTask.subtasks && nextTask.subtasks.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <ListChecks className="w-3.5 h-3.5" />
                          {nextTask.subtasks.filter(s => s.completed).length}/{nextTask.subtasks.length} subtasks
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => onStartFocus?.(nextTask.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F52BA] hover:bg-[#0D47A1] text-white text-xs font-semibold shadow-tactile active:scale-95 transition-all cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Start Sprint</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleTask(nextTask.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-[#161618] dark:text-[#F7F6F2] text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Done</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTask(nextTask)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] transition cursor-pointer ml-auto"
                  >
                    Details
                  </button>
                </div>
              </div>
            )}

            {/* ── 2. TRIAGE ZONE: MISSED TASKS (Elevated when actions needed) ── */}
            {missedTasksList.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-500/[0.07] p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Missed Schedule Window</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20">
                      {missedTasksList.length}
                    </span>
                  </div>
                  {dayClassification.totallyMissedTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSweepTotallyMissed}
                      className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Inbox className="w-3 h-3" />
                      <span>Sweep to Backlog</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
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
                        key={`missed-task-${item.id}`}
                        className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1E1E22] p-3 space-y-2 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-semibold text-[#161618] dark:text-[#F7F6F2] truncate">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                              {item.isTotallyMissed
                                ? `Scheduled for past date (${item.plannedDate || 'earlier'}) • Carried over`
                                : `Window passed (${startFormatted} – ${endFormatted}) • ${effortLabel(item.durationMinutes)}`}
                            </p>
                          </div>
                        </div>

                        {rec && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#0F52BA]/[0.06] text-[11px] text-[#161618] dark:text-[#F7F6F2]">
                            <Sparkles className="w-3.5 h-3.5 text-[#0F52BA] dark:text-[#6495ED] shrink-0" />
                            <span className="truncate">
                              <span className="font-bold text-[#0F52BA] dark:text-[#6495ED]">AI Suggestion:</span> {rec.explanation}
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {rec && (
                            <button
                              type="button"
                              onClick={() => handleSmartReschedule(item, rec)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0F52BA] hover:bg-[#0D47A1] text-white text-[11px] font-semibold transition cursor-pointer"
                            >
                              <Calendar className="w-3 h-3" />
                              <span>Reschedule: {rec.dateLabel} {rec.formattedTime}</span>
                            </button>
                          )}
                          {rec && (
                            <button
                              type="button"
                              title="Reschedule this task and shift all its downstream dependent lectures/tasks in order"
                              onClick={() => handleCascadeReschedule(item, rec)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold transition cursor-pointer"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>Cascade Chain</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleMoveToBacklog(item.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-xs font-semibold transition cursor-pointer text-[#6B6A72] dark:text-[#8E8E93]"
                          >
                            <Inbox className="w-3 h-3" />
                            <span>To Backlog</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTask(item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition ml-auto cursor-pointer"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Mark Done</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 3. FOCUS QUEUE TASKS ── */}
            {activeQueueTasks.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={activeQueueTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 max-h-[calc(100vh-360px)] overflow-y-auto pr-1 scrollbar-thin">
                    {activeQueueTasks.map(task => (
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
                          allTasks={tasks}
                        />
                      </SortableTaskItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : !nextTask && missedTasksList.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl border border-dashed border-black/[0.08] dark:border-white/[0.08]">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mb-1.5 mx-auto" />
                <p className="text-xs font-semibold text-[#161618] dark:text-[#F7F6F2]">
                  All focus queue tasks completed!
                </p>
                <p className="text-[11px] text-[#6B6A72] dark:text-[#8E8E93] mt-0.5">
                  Great momentum. Add a new task above or plan tomorrow.
                </p>
              </div>
            ) : null}

            {/* ── 4. COMPLETED ACCORDION ── */}
            {completedQueueTasks.length > 0 && (
              <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05]">
                <button
                  type="button"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] py-1 cursor-pointer transition-colors"
                >
                  {showCompleted ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>Completed ({completedQueueTasks.length})</span>
                </button>
                {showCompleted && (
                  <div className="space-y-2 mt-2 animate-fadeIn max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
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

          </section>

          {/* Pane 3: Habits & Horizons (3 cols) */}
          <aside data-block-id="dashboard-sidebar-column" className={`${mobileSection === 'habits' ? 'block' : 'hidden lg:block'} space-y-4 lg:col-span-3 min-w-0 overflow-hidden`}>
            {/* Habits Widget (Spacious Negative-Spacing Architecture) */}
            <div data-block-id="dashboard-habits-card" className="rounded-2xl bg-white dark:bg-[#1A1A1E] p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.03)] border border-black/[0.07] dark:border-white/[0.08]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#2E6F40]/10 text-[#2E6F40] flex items-center justify-center">
                    <Repeat className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h2 className="text-base font-editorial font-medium text-[#161618] dark:text-[#F7F6F2]">Daily Habits</h2>
                    <p className="text-[11px] text-[#6B6A72] dark:text-[#8E8E93]">
                      <span className="font-mono tabular-nums font-semibold text-[#161618] dark:text-[#F7F6F2]">{checkedHabits}</span> of <span className="font-mono tabular-nums font-semibold text-[#161618] dark:text-[#F7F6F2]">{habits.length}</span> locked today
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingHabit(null);
                      setIsHabitModalOpen(true);
                    }}
                    title="Create new habit"
                    className="w-6 h-6 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] flex items-center justify-center text-[#161618] dark:text-[#F7F6F2] transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveTab('habits')}
                    className="text-xs font-mono font-medium text-[#0F52BA] dark:text-[#6495ED] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>All</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Habit Completion Progress Bar */}
              <div className="w-full h-1 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden my-3">
                <div
                  className="h-full bg-[#2E6F40] rounded-full transition-all duration-500"
                  style={{ width: `${habits.length > 0 ? Math.round((checkedHabits / habits.length) * 100) : 0}%` }}
                />
              </div>

              <div className="space-y-2">
                {habits.slice(0, 5).map(habit => {
                  const doneToday = habit.completedDays?.includes(today);
                  const streak = (habit.completedDays || []).length;
                  return (
                    <div
                      key={habit.id}
                      className="group/habit p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleHabitCheck(habit.id)}
                            title={doneToday ? 'Checked in today (click to undo)' : 'Check in for today'}
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                              doneToday ? 'border-[#2E6F40] bg-[#2E6F40] text-white' : 'border-black/25 dark:border-white/30 hover:border-[#2E6F40]'
                            }`}
                          >
                            {doneToday && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingHabit(habit);
                              setIsHabitModalOpen(true);
                            }}
                            title="Click to edit habit sequence"
                            className={`text-xs font-semibold truncate text-left hover:text-[#0F52BA] dark:hover:text-[#6495ED] transition-colors cursor-pointer ${
                              doneToday ? 'line-through text-[#6B6A72] dark:text-[#8E8E93]' : 'text-[#161618] dark:text-[#F7F6F2]'
                            }`}
                          >
                            {habit.title}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {streak > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-[#C84B31] bg-[#C84B31]/10 px-1.5 py-0.2 rounded shrink-0">
                              <Flame className="w-2.5 h-2.5 fill-current" />
                              <span>{streak}d</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingHabit(habit);
                              setIsHabitModalOpen(true);
                            }}
                            title="Edit habit sequence"
                            className="p-1 rounded-md text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-[#F7F6F2] hover:bg-black/5 dark:hover:bg-white/5 opacity-70 group-hover/habit:opacity-100 transition cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* 7-day dot matrix */}
                      <div className="flex items-center justify-between pt-1 px-1 border-t border-black/[0.03] dark:border-white/[0.04]">
                        {last7Days.map((day) => {
                          const isCompletedOnDay = habit.completedDays?.includes(day.key);
                          return (
                            <button
                              key={day.key}
                              type="button"
                              onClick={() => onCheckInHabit?.(habit.id, day.key)}
                              title={`${day.label}: ${isCompletedOnDay ? 'Completed (click to undo)' : 'Click to check in'}`}
                              className="flex flex-col items-center gap-0.5 cursor-pointer group/dot"
                            >
                              <span className="text-[8px] font-mono text-[#6B6A72]/60 uppercase">{day.label}</span>
                              <div className={`w-2 h-2 rounded-full transition-all group-hover/dot:scale-125 ${
                                isCompletedOnDay
                                  ? 'bg-[#2E6F40]'
                                  : day.isToday
                                    ? 'border border-dashed border-[#2E6F40]'
                                    : 'bg-black/10 dark:bg-white/10'
                              }`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {!habits.length && (
                  <p className="text-xs text-[#6B6A72] dark:text-[#8E8E93] text-center py-4">No habits configured yet.</p>
                )}
              </div>
            </div>
            {/* ── Active Horizons Widget (Goals) ── */}
            <div data-block-id="dashboard-goals-card" className="rounded-2xl bg-white dark:bg-[#1A1A1E] p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.02)] border border-black/[0.07] dark:border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.05] dark:border-white/[0.06]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#161618] dark:text-[#F7F6F2]">Active Horizons</h2>
                <button
                  onClick={() => setActiveTab('goals')}
                  className="text-[11px] font-mono text-[#0F52BA] dark:text-[#6495ED] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Goals</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2.5">
                {activeGoals.length ? (
                  activeGoals.map(goal => {
                    const progress = goal.workProgress ?? goal.progress ?? 0;
                    return (
                      <div
                        key={goal.id}
                        className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            onClick={() => setActiveTab('goals')}
                            className="text-xs font-bold text-[#161618] dark:text-[#F7F6F2] truncate hover:text-[#0F52BA] cursor-pointer"
                          >
                            {goal.title}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-[#0F52BA] tabular-nums shrink-0">
                            {progress}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0F52BA] rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between pt-0.5 text-[10px] text-[#6B6A72] dark:text-[#8E8E93]">
                          <span className="truncate">{goal.milestone || goal.nextTask?.title || 'Next milestone'}</span>
                          <button
                            type="button"
                            onClick={() => onOpenQuickAdd?.({ initialGoalId: goal.id })}
                            className="text-[#0F52BA] hover:underline font-semibold shrink-0 cursor-pointer"
                          >
                            + Next task
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <button
                    onClick={() => setActiveTab('goals')}
                    className="w-full py-4 text-center text-xs text-[#0F52BA] hover:underline cursor-pointer"
                  >
                    + Define first goal
                  </button>
                )}
              </div>
            </div>

          </aside>
        </div>
      </div>

      <TaskDetailModal task={editingTask} isOpen={!!editingTask} onClose={() => setEditingTask(null)} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} goals={goals} habits={habits} tasks={tasks} onStartFocus={onStartFocus} />
      <ScheduleDetailModal
        schedule={editingSchedule}
        isOpen={Boolean(editingSchedule)}
        onClose={() => setEditingSchedule(null)}
        onUpdateSchedule={onUpdateSchedule}
        onDeleteSchedule={onDeleteSchedule}
      />
      <HabitModal
        isOpen={isHabitModalOpen}
        onClose={() => {
          setIsHabitModalOpen(false);
          setEditingHabit(null);
        }}
        habit={editingHabit}
        onSave={(data) => {
          if (editingHabit && editingHabit.id) {
            onUpdateHabit?.(editingHabit.id, data);
          } else {
            onAddHabit?.(data);
          }
          setIsHabitModalOpen(false);
          setEditingHabit(null);
        }}
        onDelete={editingHabit ? (id) => {
          onDeleteHabit?.(id);
          setIsHabitModalOpen(false);
          setEditingHabit(null);
        } : undefined}
        goals={goals}
      />
    </main>
  );
});

export default DashboardView;
