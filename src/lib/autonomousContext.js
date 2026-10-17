/**
 * Autonomous Workspace Context Aggregator for Momentum OS
 * Compiles state across all pages: Today, Backlog, Goals, Habits, Schedule,
 * Focus Sessions, Reflections, and active viewport into a structured context snapshot.
 */

import { todayPlanDate, isTaskScheduledForDate } from './taskMetadata.js';
import { classifyDayItems } from './missedScheduleEngine.js';
import { getHabitsAtRisk, computeHabitDecayMetrics } from './habitDecayGuard.js';
import { evaluateCapacityLoad } from './capacityOverloadGuard.js';
import { isTaskBlocked, findRootBottleneck } from './taskDependencies.js';
import { classifySemanticEssence, detectHumanEnergyClashes } from './autonomousSemanticOntology.js';
import { evaluateCognitiveLoadBudget } from './cognitiveLoadBudget.js';

export function compileWorkspaceContext({
  tasks = [],
  goals = [],
  habits = [],
  schedules = [],
  reflections = {},
  focusSessions = [],
  activeTab = 'dashboard',
  stats = null,
  settings = {},
  currentTime = null // optional override for testing
}) {
  const today = todayPlanDate();
  const now = currentTime ? new Date(currentTime) : new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const timeString = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

  // 1. Task classification for Today
  const dayItems = classifyDayItems({ tasks, schedules, targetDate: today, now });
  const todayTasks = tasks.filter(t => isTaskScheduledForDate(t, today) || t.plannedDate === today || t.dueDate === 'Today');
  const todayPendingTasks = todayTasks.filter(t => !t.completed);
  const todayCompletedTasks = todayTasks.filter(t => t.completed);

  // Slipped tasks: pending tasks whose scheduled end time or start time is in the past
  const slippedTasks = (dayItems.missedTasks || dayItems.missed || []).filter(item => !item.isSchedule && !item.completed);

  // 2. Dependencies & Unblocked Tasks
  const unblockedTasks = todayPendingTasks.filter(t => {
    const isBlocked = isTaskBlocked(t, tasks);
    return !isBlocked && (t.dependsOn || []).length > 0;
  });

  const blockedTasks = todayPendingTasks.filter(t => isTaskBlocked(t, tasks)).map(t => ({
    task: t,
    bottleneck: findRootBottleneck(t, tasks)
  }));

  // 3. Habits At Risk of Streak Decay
  const habitsAtRisk = getHabitsAtRisk(habits, tasks, today);
  const habitMetrics = habits.map(h => ({
    habit: h,
    metrics: computeHabitDecayMetrics(h, today)
  }));

  // 4. Strategic Goals Evaluation (Progress, Velocity & Stagnation)
  const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const activeGoals = goals.map(g => {
    const linkedTasks = tasks.filter(t => String(t.goalId) === String(g.id));
    const completedLinked = linkedTasks.filter(t => t.completed);
    const pendingLinked = linkedTasks.filter(t => !t.completed);
    const completedPastWeek = completedLinked.filter(t => {
      const compTime = t.completedAt ? new Date(t.completedAt).getTime() : 0;
      return compTime >= oneWeekAgo;
    });

    const progressPct = linkedTasks.length > 0
      ? Math.round((completedLinked.length / linkedTasks.length) * 100)
      : (g.progress || 0);

    // Stagnant if active goal has 0 pending tasks or 0 tasks completed in past 7 days
    const isStagnant = linkedTasks.length === 0 || (pendingLinked.length === 0 && progressPct < 100);

    return {
      ...g,
      linkedTasksCount: linkedTasks.length,
      pendingTasksCount: pendingLinked.length,
      calculatedProgress: progressPct,
      completedPastWeekCount: completedPastWeek.length,
      velocityRating: completedPastWeek.length >= 3 ? 'HIGH' : completedPastWeek.length >= 1 ? 'STEADY' : 'STALLED',
      isStagnant
    };
  });

  // 5. Free Gap Windows in Today's Schedule
  const freeGaps = (dayItems.freeWindows || []).filter(w => w.durationMinutes >= 20);

  // 6. Cognitive Capacity & Circadian Load
  const capacity = evaluateCapacityLoad({ tasks, schedules, date: today });

  // 7. Timeline Items & Human Energy Clashes
  const timelineItems = [
    ...todayTasks.filter(t => t.startTime),
    ...(schedules || []).filter(s => s.startTime)
  ].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  const energyClashes = detectHumanEnergyClashes(timelineItems);

  // 8. Cognitive Load Budget Analysis
  const cognitiveBudget = evaluateCognitiveLoadBudget(timelineItems, {
    deepWorkMinutes: settings.deepWorkBudgetMinutes || 240
  });

  // 9. Multi-Horizon: Upcoming 72-Hour Deadlines
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = tasks.filter(t => {
    if (t.completed || !t.dueDate || t.dueDate === 'Today') return false;
    try {
      const dueTime = new Date(t.dueDate).getTime();
      return !isNaN(dueTime) && dueTime <= threeDaysOut.getTime() && dueTime >= now.getTime();
    } catch {
      return false;
    }
  });

  // 10. Focus Session State
  const activeFocus = focusSessions.find(s => !s.completedAt);

  return {
    timestamp: now.getTime(),
    todayDate: today,
    currentTime: timeString,
    activeTab,
    todayTasksCount: todayTasks.length,
    todayPendingCount: todayPendingTasks.length,
    todayCompletedCount: todayCompletedTasks.length,
    slippedTasks,
    unblockedTasks,
    blockedTasks,
    habitsAtRisk,
    habitMetrics,
    activeGoals,
    upcomingDeadlines,
    freeGaps,
    capacity,
    energyClashes,
    cognitiveBudget,
    activeFocus,
    timelineItems,
    tasks,
    goals,
    habits,
    schedules,
    settings
  };
}

export function assembleAutonomousContext(store = {}, options = {}) {
  return compileWorkspaceContext({
    tasks: store.tasks || [],
    goals: store.goals || [],
    habits: store.habits || [],
    schedules: store.schedules || [],
    reflections: store.reflections || {},
    focusSessions: store.focusSessions || [],
    activeTab: store.activeTab || 'dashboard',
    stats: store.stats || null,
    settings: store.settings || {},
    ...options
  });
}
