import { useEffect, useRef } from 'react';
import {
  syncAndroidTodayWidget,
  getPendingWidgetCompletedTasks,
  getPendingWidgetCompletedHabits,
  getPendingWidgetAction,
} from '../lib/androidWidget';
import { isTaskScheduledForDate, todayPlanDate } from '../lib/taskMetadata';

function calculatePriorityScore(task, currentMinutes) {
  let score = 0;

  // 1. Time factor
  let startMinutes = -1;
  if (task.startTime && typeof task.startTime === 'string') {
    const parts = task.startTime.split(':');
    if (parts.length === 2) {
      startMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
  }

  const duration = task.durationMinutes || 45;

  if (startMinutes >= 0) {
    const endMinutes = startMinutes + Math.max(15, duration);
    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      score += 10000; // NOW Active block
    } else if (startMinutes > currentMinutes) {
      score += 2000 - Math.min(1000, startMinutes - currentMinutes); // Next upcoming
    } else {
      score += 800; // Earlier today
    }
  } else {
    score += 500; // Floating task
  }

  // 2. Impact factor
  const impact = String(task.impact || task.energy || task.priority || 'medium').toLowerCase();
  if (impact.includes('high')) {
    score += 300;
  } else if (impact.includes('med')) {
    score += 150;
  } else {
    score += 50;
  }

  // 3. Effort factor (quick win bonus)
  score += Math.max(0, 100 - Math.min(100, duration));

  return score;
}

export default function AndroidWidgetSync({
  tasks = [],
  habits = [],
  onToggleTask,
  onCheckInHabit,
  onOpenQuickAdd,
  onOpenNewGoal,
  onOpenNewHabit
}) {
  const onToggleRef = useRef(onToggleTask);
  const onCheckInHabitRef = useRef(onCheckInHabit);
  const onOpenQuickAddRef = useRef(onOpenQuickAdd);
  const onOpenNewGoalRef = useRef(onOpenNewGoal);
  const onOpenNewHabitRef = useRef(onOpenNewHabit);
  const tasksRef = useRef(tasks);
  const habitsRef = useRef(habits);

  useEffect(() => {
    onToggleRef.current = onToggleTask;
    onCheckInHabitRef.current = onCheckInHabit;
    onOpenQuickAddRef.current = onOpenQuickAdd;
    onOpenNewGoalRef.current = onOpenNewGoal;
    onOpenNewHabitRef.current = onOpenNewHabit;
    tasksRef.current = tasks;
    habitsRef.current = habits;
  }, [onToggleTask, onCheckInHabit, onOpenQuickAdd, onOpenNewGoal, onOpenNewHabit, tasks, habits]);

  // Sync snapshot to Android widgets (Today Hub, Bento Dial, Pill, Quick Add)
  useEffect(() => {
    const today = todayPlanDate();
    let todayTasks = (tasks || []).filter(
      (task) =>
        isTaskScheduledForDate(task, today) ||
        (!task.completed && task.plannedDate && task.plannedDate < today) ||
        (!task.plannedDate && (task.dueDate === 'Today' || !task.dueDate))
    );

    if (todayTasks.length === 0 && Array.isArray(tasks) && tasks.length > 0) {
      const pending = tasks.filter((t) => !t.completed);
      todayTasks = pending.length > 0 ? pending.slice(0, 6) : tasks.slice(0, 6);
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Sort: pending first by priority score descending, then completed
    const sorted = [...todayTasks].sort((a, b) => {
      if (Boolean(a.completed) !== Boolean(b.completed)) {
        return a.completed ? 1 : -1;
      }
      if (!a.completed) {
        const scoreA = calculatePriorityScore(a, currentMinutes);
        const scoreB = calculatePriorityScore(b, currentMinutes);
        return scoreB - scoreA;
      }
      return 0;
    });

    const pendingCount = todayTasks.filter((t) => !t.completed).length;
    const completedCount = todayTasks.filter((t) => t.completed).length;
    const totalCount = todayTasks.length;
    const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Serialize habits for today
    const habitItems = (habits || []).map((h) => ({
      id: String(h.id),
      title: String(h.title || '').slice(0, 80),
      isDone: Array.isArray(h.completedDays) ? h.completedDays.includes(today) : false,
      streakCount: Array.isArray(h.completedDays) ? h.completedDays.length : 0,
    }));

    const snapshot = {
      date: today,
      pendingCount,
      completedCount,
      totalCount,
      completionPercentage,
      tasks: sorted.slice(0, 10).map((task) => ({
        id: String(task.id),
        title: String(task.title || '').slice(0, 100),
        completed: Boolean(task.completed),
        startTime: task.startTime || '',
        durationMinutes: task.durationMinutes || 45,
        impact: String(task.impact || task.energy || task.priority || 'medium').toLowerCase(),
        area: (Array.isArray(task.areas) && task.areas[0]) || task.category || '',
        subtasksCount: Array.isArray(task.subtasks) ? task.subtasks.length : 0,
        subtasksDone: Array.isArray(task.subtasks)
          ? task.subtasks.filter((s) => s.completed).length
          : 0,
      })),
      habits: habitItems.slice(0, 8),
    };

    syncAndroidTodayWidget(snapshot).catch(() => {});
  }, [tasks, habits]);

  // Handle widget actions & pending completed task and habit sync
  useEffect(() => {
    let isCancelled = false;

    const checkWidgetEvents = async () => {
      try {
        const completedIds = await getPendingWidgetCompletedTasks();
        if (!isCancelled && completedIds && completedIds.length > 0) {
          const currentTasks = tasksRef.current || [];
          completedIds.forEach((id) => {
            const match = currentTasks.find((t) => String(t.id) === String(id));
            if (match && !match.completed && onToggleRef.current) {
              onToggleRef.current(id);
            }
          });
        }

        const completedHabitIds = await getPendingWidgetCompletedHabits();
        if (!isCancelled && completedHabitIds && completedHabitIds.length > 0) {
          const currentHabits = habitsRef.current || [];
          const today = todayPlanDate();
          completedHabitIds.forEach((id) => {
            const match = currentHabits.find((h) => String(h.id) === String(id));
            const isDone = match && Array.isArray(match.completedDays) && match.completedDays.includes(today);
            if (match && !isDone && onCheckInHabitRef.current) {
              onCheckInHabitRef.current(id);
            }
          });
        }

        const action = await getPendingWidgetAction();
        if (!isCancelled && action) {
          if ((action === 'quick_add' || action === 'quick_add_task') && onOpenQuickAddRef.current) {
            onOpenQuickAddRef.current();
          } else if (action === 'quick_add_goal' && onOpenNewGoalRef.current) {
            onOpenNewGoalRef.current();
          } else if (action === 'quick_add_habit' && onOpenNewHabitRef.current) {
            onOpenNewHabitRef.current();
          }
        }
      } catch {}
    };

    // Check immediately
    checkWidgetEvents();

    const onFocus = () => checkWidgetEvents();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkWidgetEvents();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const interval = setInterval(checkWidgetEvents, 1500);

    return () => {
      isCancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  return null;
}
