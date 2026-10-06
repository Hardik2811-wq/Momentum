import { useEffect, useRef } from 'react';
import {
  syncAndroidTodayWidget,
  getPendingWidgetCompletedTasks,
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

export default function AndroidWidgetSync({ tasks = [], onToggleTask, onOpenQuickAdd }) {
  const onToggleRef = useRef(onToggleTask);
  const onOpenQuickAddRef = useRef(onOpenQuickAdd);
  const tasksRef = useRef(tasks);

  useEffect(() => {
    onToggleRef.current = onToggleTask;
    onOpenQuickAddRef.current = onOpenQuickAdd;
    tasksRef.current = tasks;
  }, [onToggleTask, onOpenQuickAdd, tasks]);

  // Sync snapshot to Android widget
  useEffect(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) return;

    const today = todayPlanDate();
    let todayTasks = tasks.filter(
      (task) =>
        isTaskScheduledForDate(task, today) ||
        (!task.completed && task.plannedDate && task.plannedDate < today) ||
        (!task.plannedDate && (task.dueDate === 'Today' || !task.dueDate))
    );

    // Graceful fallback to any pending tasks if no date-specific tasks exist
    if (todayTasks.length === 0) {
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

    const snapshot = {
      date: today,
      pendingCount,
      completedCount,
      totalCount,
      completionPercentage,
      tasks: sorted.slice(0, 6).map((task) => ({
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
    };

    syncAndroidTodayWidget(snapshot).catch(() => {});
  }, [tasks]);

  // Handle widget actions & pending completed task sync
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

        const action = await getPendingWidgetAction();
        if (!isCancelled && action === 'quick_add' && onOpenQuickAddRef.current) {
          onOpenQuickAddRef.current();
        }
      } catch {}
    };

    // Check immediately
    checkWidgetEvents();

    // Listen on window focus & document visibility change
    const onFocus = () => checkWidgetEvents();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkWidgetEvents();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Polling interval while app is in foreground
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
