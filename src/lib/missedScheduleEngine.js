/**
 * Missed Schedule & Task Engine
 * Detects passed designated time windows, classifies live vs upcoming vs missed items,
 * routes uncompleted tasks to backlog (while protecting fixed schedules),
 * and computes intelligent recovery time-blocks via collision-free gap analysis.
 */

import {
  todayPlanDate,
  tomorrowPlanDate,
  taskPlanDate,
  isTaskScheduledForDate,
  isTaskCompletedForDate,
  calculateDuration,
  formatTimeString,
  parseTimeString
} from './taskMetadata.js';

import {
  isTaskBlocked,
  findRootBottleneck
} from './taskDependencies.js';

import {
  timeToMinutes,
  minutesToTime,
  detectScheduleCollisions,
  computeCollisionRisk
} from './scheduleCollisionGuard.js';

/**
 * Normalizes weekday representations into canonical 0=Sun..6=Sat array
 * Supports numbers (0-6, or ISO 1-7), and day names ('Mon', 'Monday', etc.)
 */
export function normalizeRepeatDays(input) {
  if (input === null || input === undefined) return [];
  const arr = Array.isArray(input) ? input : [input];
  const nameMap = {
    sun: 0, sunday: 0, su: 0,
    mon: 1, monday: 1, mo: 1,
    tue: 2, tues: 2, tuesday: 2, tu: 2,
    wed: 3, wednesday: 3, we: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4, th: 4,
    fri: 5, friday: 5, fr: 5,
    sat: 6, saturday: 6, sa: 6
  };
  const result = new Set();
  for (const item of arr) {
    if (typeof item === 'number') {
      if (item >= 0 && item <= 6) {
        result.add(item);
      } else if (item === 7) {
        // ISO Mon=1..Sun=7 -> 0
        result.add(0);
      }
    } else if (typeof item === 'string') {
      const lower = item.trim().toLowerCase();
      if (nameMap[lower] !== undefined) {
        result.add(nameMap[lower]);
      } else {
        const parsed = parseInt(lower, 10);
        if (!isNaN(parsed)) {
          if (parsed >= 0 && parsed <= 6) result.add(parsed);
          else if (parsed === 7) result.add(0);
        }
      }
    }
  }
  return Array.from(result).sort((a, b) => a - b);
}

/**
 * Checks if a schedule item (fixed routine/timetable) is active for target date
 */
export function isScheduleActiveForDate(sched = {}, dateStr = todayPlanDate()) {
  if (!sched || !dateStr) return false;

  // 1. Check excluded dates / single-occurrence skips (Holidays, cancellations, exceptions)
  if (Array.isArray(sched.excludedDates) && sched.excludedDates.includes(dateStr)) return false;
  if (Array.isArray(sched.exceptions) && sched.exceptions.includes(dateStr)) return false;

  const repeatType = sched.recurrence || sched.repeat;
  const isRecurring = Boolean(
    repeatType &&
    repeatType !== 'none' &&
    repeatType !== 'never'
  );

  if (isRecurring) {
    // Explicit end date enforcement (inclusive)
    const effectiveEndDate = sched.recurrenceEndDate || sched.endDate;
    if (effectiveEndDate && dateStr > effectiveEndDate) return false;
    if (sched.recurrenceUntil && dateStr >= sched.recurrenceUntil) return false;

    // Explicit start date enforcement
    const effectiveStartDate = sched.recurrenceStartDate || sched.startDate;
    if (effectiveStartDate && dateStr < effectiveStartDate) return false;

    const targetDate = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(targetDate.getTime())) return false;
    const dayOfWeek = targetDate.getDay();

    if (repeatType === 'daily' || repeatType === 'everyday') return true;

    if (repeatType === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
    if (repeatType === 'weekends') return dayOfWeek === 0 || dayOfWeek === 6;

    if (repeatType === 'biweekly') {
      const anchorStr = effectiveStartDate || sched.plannedDate || '2026-01-01';
      const anchorDate = new Date(`${anchorStr}T12:00:00`);
      if (!Number.isNaN(anchorDate.getTime())) {
        const diffDays = Math.round((targetDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
        const diffWeeks = Math.floor(diffDays / 7);
        if (Math.abs(diffWeeks) % 2 !== 0) return false;
      }
      const rawDays = Array.isArray(sched.repeatDays) && sched.repeatDays.length > 0
        ? sched.repeatDays
        : (sched.plannedDate ? [new Date(`${sched.plannedDate}T12:00:00`).getDay()] : [1]);
      const normalizedDays = normalizeRepeatDays(rawDays);
      return normalizedDays.includes(dayOfWeek);
    }

    if (repeatType === 'custom' || repeatType === 'weekly') {
      const rawDays = Array.isArray(sched.repeatDays) && sched.repeatDays.length > 0
        ? sched.repeatDays
        : (sched.plannedDate ? [new Date(`${sched.plannedDate}T12:00:00`).getDay()] : [1]);
      const normalizedDays = normalizeRepeatDays(rawDays);
      return normalizedDays.includes(dayOfWeek);
    }
    return false;
  }

  // Non-recurring schedule: exact date match
  return sched.plannedDate === dateStr;
}

/**
 * Calculates start and end minutes for a task or schedule item
 */
export function getItemTimeWindow(item = {}) {
  if (!item.startTime) return null;
  const startMins = timeToMinutes(item.startTime);
  if (startMins === null) return null;

  let dur = Number(item.durationMinutes || item.duration);
  if (!dur || isNaN(dur)) {
    if (item.startTime && item.endTime) {
      const diff = calculateDuration(item.startTime, item.endTime);
      if (diff > 0) dur = diff;
    }
  }
  if (!dur || isNaN(dur)) dur = 45;

  return {
    startMins,
    endMins: startMins + dur,
    durationMinutes: dur
  };
}

/**
 * Checks if an item's designated time window has passed for the given date/time
 */
export function isItemTimeWindowPassed(item = {}, now = new Date(), targetDate = todayPlanDate()) {
  if (!item || item.completed) return false;

  // Untimed items do not have an expired time window
  const window = getItemTimeWindow(item);
  if (!window) return false;

  const currentMins = now.getHours() * 60 + now.getMinutes();

  // If item is scheduled for today: check if current time > end window
  return currentMins > window.endMins;
}

function wasCreatedAfterWindow(item, window, targetDate) {
  if (!item || !window) return false;
  if (targetDate !== todayPlanDate()) return false;

  let createdTs = item.createdAt;
  if (!createdTs && typeof item.id === 'string') {
    const match = item.id.match(/-(?:t|sched|task)?(\d{10,13})/);
    if (match) createdTs = Number(match[1]);
  }

  if (createdTs) {
    const createdDate = new Date(createdTs);
    if (!isNaN(createdDate.getTime())) {
      const createdYMD = createdDate.toISOString().slice(0, 10);
      if (createdYMD === targetDate) {
        const createdMins = createdDate.getHours() * 60 + createdDate.getMinutes();
        if (createdMins >= window.endMins - 15) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Classifies all tasks and schedules for target date into:
 * - activeNow: currently inside designated time window
 * - upcoming: future time window OR untimed
 * - missed: designated time window has passed today and uncompleted
 * - totallyMissedTasks: past dates tasks (never schedules)
 * - completed: finished items
 */
export function classifyDayItems({
  tasks = [],
  schedules = [],
  targetDate = todayPlanDate(),
  now = new Date()
}) {
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const activeNow = [];
  const upcoming = [];
  const missed = [];
  const completed = [];
  const totallyMissedTasks = [];

  // 1. Process tasks for targetDate
  for (const t of tasks) {
    if (t.isBacklog || t.dueDate === 'Someday') continue;
    const isDone = isTaskCompletedForDate(t, targetDate);
    if (isDone) {
      if (isTaskScheduledForDate(t, targetDate)) {
        completed.push({ ...t, itemType: 'task' });
      }
      continue;
    }

    const pDate = taskPlanDate(t);
    const isRecurring = Boolean(t.recurrence && t.recurrence !== 'none');
    // Totally missed: non-recurring task scheduled for an earlier date in the past
    if (!isRecurring && pDate && pDate < targetDate) {
      totallyMissedTasks.push({ ...t, itemType: 'task', isTotallyMissed: true });
      continue;
    }

    if (!isTaskScheduledForDate(t, targetDate)) continue;

    const window = getItemTimeWindow(t);
    const enriched = { ...t, itemType: 'task', window };

    if (!window) {
      // Untimed task planned for today
      upcoming.push(enriched);
    } else if (currentMins >= window.startMins && currentMins <= window.endMins) {
      activeNow.push({ ...enriched, isLiveNow: true });
    } else if (currentMins < window.startMins) {
      upcoming.push(enriched);
    } else {
      // currentMins > window.endMins
      if (wasCreatedAfterWindow(t, window, targetDate)) {
        upcoming.push(enriched);
      } else {
        missed.push({
          ...enriched,
          isMissed: true,
          minutesOverdue: currentMins - window.endMins
        });
      }
    }
  }

  // 2. Process fixed schedules for targetDate
  for (const s of schedules) {
    if (!isScheduleActiveForDate(s, targetDate)) continue;

    const window = getItemTimeWindow(s);
    const enriched = { ...s, itemType: 'schedule', window };

    if (!window) {
      upcoming.push(enriched);
    } else if (currentMins >= window.startMins && currentMins <= window.endMins) {
      activeNow.push({ ...enriched, isLiveNow: true });
    } else if (currentMins < window.startMins) {
      upcoming.push(enriched);
    } else {
      // Fixed schedule missed today: schedules do NOT go to backlog
      if (wasCreatedAfterWindow(s, window, targetDate)) {
        upcoming.push(enriched);
      } else {
        missed.push({
          ...enriched,
          isMissed: true,
          minutesOverdue: currentMins - window.endMins
        });
      }
    }
  }

  // Sort upcoming: timed items ascending by startMins, untimed items after
  upcoming.sort((a, b) => {
    if (a.window && b.window) return a.window.startMins - b.window.startMins;
    if (a.window) return -1;
    if (b.window) return 1;
    return 0;
  });

  // Sort missed: most recently missed first
  missed.sort((a, b) => (a.minutesOverdue || 0) - (b.minutesOverdue || 0));

  // Determine current active focus target (Excludes missed items!)
  // Strictly for TASKS (next or ongoing tasks). Schedules are highlighted in Today's Schedule.
  // CRITICAL DEPENDENCY RULE: If a task has incomplete prerequisites, it cannot be the focus target.
  // Instead, elevate its unblocked root prerequisite bottleneck!
  const candidateTask = activeNow.find(item => item.itemType === 'task') || upcoming.find(item => item.itemType === 'task');
  
  let focusTarget = null;
  if (candidateTask) {
    if (isTaskBlocked(candidateTask, tasks, [], targetDate)) {
      // Find the root prerequisite causing the blockage
      const bottleneck = findRootBottleneck(candidateTask, tasks, [], targetDate);
      if (bottleneck) {
        // Enriched bottleneck task
        const isBottleneckMissed = missed.some(m => String(m.id) === String(bottleneck.id));
        focusTarget = {
          ...bottleneck,
          itemType: 'task',
          isDependencyBottleneck: true,
          blocksTaskTitle: candidateTask.title,
          isMissedPrerequisite: isBottleneckMissed
        };
      } else {
        // Find next task in upcoming that is NOT blocked
        const unblockedTask = upcoming.find(t => t.itemType === 'task' && !isTaskBlocked(t, tasks, [], targetDate));
        focusTarget = unblockedTask || candidateTask;
      }
    } else {
      focusTarget = candidateTask;
    }
  }

  const missedTasks = missed.filter(item => item.itemType === 'task');
  const missedSchedules = missed.filter(item => item.itemType === 'schedule');

  return {
    activeNow,
    upcoming,
    missed,
    missedTasks,
    missedSchedules,
    completed,
    totallyMissedTasks,
    focusTarget
  };
}

/**
 * Intelligent Recovery Slot Finder:
 * Examines candidate item duration, remaining day hours, and next day windows
 * to suggest optimal conflict-free time block without collisions.
 */
export function findIntelligentRecoverySlot({
  item = {},
  tasks = [],
  schedules = [],
  targetDate = todayPlanDate(),
  now = new Date(),
  workDayEndHour = 22 // 10:00 PM
}) {
  const dur = Number(item.durationMinutes || item.duration) || 45;
  const currentMins = now.getHours() * 60 + now.getMinutes();

  // Next round 15-minute slot from now + 10m buffer
  const earliestTodayMins = Math.ceil((currentMins + 10) / 15) * 15;
  const endLimitTodayMins = workDayEndHour * 60;

  // 1. Try finding a conflict-free gap Today
  if (earliestTodayMins + dur <= endLimitTodayMins) {
    for (let slot = earliestTodayMins; slot + dur <= endLimitTodayMins; slot += 15) {
      const slotTime = minutesToTime(slot);
      const testCandidate = {
        id: item.id,
        startTime: slotTime,
        durationMinutes: dur
      };
      const collisionEval = detectScheduleCollisions({
        candidate: testCandidate,
        tasks,
        schedules,
        date: targetDate
      });

      if (!collisionEval.hasCollision) {
        return {
          date: targetDate,
          dateLabel: 'Today',
          startTime: slotTime,
          durationMinutes: dur,
          formattedTime: formatTimeString(slotTime),
          riskScore: 0,
          explanation: `Today at ${formatTimeString(slotTime)} (${dur}m free block, zero conflicts)`
        };
      }
    }
  }

  // 2. If today is booked or too late, search Tomorrow
  const tomorrow = tomorrowPlanDate();
  const preferredStartMins = 9 * 60; // 09:00 AM
  const tomorrowEndMins = workDayEndHour * 60;

  let bestTomorrowSlot = null;
  let lowestTomorrowRisk = Infinity;

  for (let slot = preferredStartMins; slot + dur <= tomorrowEndMins; slot += 15) {
    const slotTime = minutesToTime(slot);
    const testCandidate = {
      id: item.id,
      startTime: slotTime,
      durationMinutes: dur
    };
    const collisionEval = detectScheduleCollisions({
      candidate: testCandidate,
      tasks,
      schedules,
      date: tomorrow
    });

    if (!collisionEval.hasCollision) {
      return {
        date: tomorrow,
        dateLabel: 'Tomorrow',
        startTime: slotTime,
        durationMinutes: dur,
        formattedTime: formatTimeString(slotTime),
        riskScore: 0,
        explanation: `Tomorrow at ${formatTimeString(slotTime)} (optimal recovery block)`
      };
    }

    if (collisionEval.riskScore < lowestTomorrowRisk) {
      lowestTomorrowRisk = collisionEval.riskScore;
      bestTomorrowSlot = slotTime;
    }
  }

  // Fallback to best available tomorrow slot
  const fallbackSlot = bestTomorrowSlot || '09:00';
  return {
    date: tomorrow,
    dateLabel: 'Tomorrow',
    startTime: fallbackSlot,
    durationMinutes: dur,
    formattedTime: formatTimeString(fallbackSlot),
    riskScore: lowestTomorrowRisk === Infinity ? 0 : lowestTomorrowRisk,
    explanation: `Tomorrow at ${formatTimeString(fallbackSlot)} (recommended gap)`
  };
}

/**
 * Prepares task patch to safely move a task to the backlog.
 * Clears temporal binding so it stays in backlog tray.
 * Note: Never call for fixed schedules.
 */
export function buildBacklogTaskPatch() {
  return {
    plannedDate: null,
    date: null,
    dueDate: 'Someday',
    startTime: null,
    endTime: null,
    isBacklog: true
  };
}

/**
 * Projects and renders calendar occurrences for any given date range (startDate to endDate)
 * Expands recurring schedules, attaches tasks, habits, and flags time-window collisions.
 */
export function renderCalendarRange({
  tasks = [],
  schedules = [],
  habits = [],
  startDate = todayPlanDate(),
  endDate = todayPlanDate(),
  now = new Date()
}) {
  const result = [];
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return result;
  }

  // Cap expansion at 90 days to avoid excessive allocations
  const maxDays = 90;
  let dayCount = 0;
  const curr = new Date(start);

  while (curr <= end && dayCount < maxDays) {
    const dStr = curr.toISOString().slice(0, 10);
    const dayClassification = classifyDayItems({
      tasks,
      schedules,
      targetDate: dStr,
      now
    });

    const activeSchedules = schedules.filter(s => isScheduleActiveForDate(s, dStr));
    const activeTasks = tasks.filter(t => isTaskScheduledForDate(t, dStr));

    // Pairwise collision evaluation for all scheduled items and tasks on target date
    const allDayItems = [
      ...activeTasks.map(t => ({ ...t, itemType: 'task' })),
      ...activeSchedules.map(s => ({ ...s, itemType: 'schedule' }))
    ];
    const dayCollisions = [];
    for (let i = 0; i < allDayItems.length; i++) {
      for (let j = i + 1; j < allDayItems.length; j++) {
        const itemA = allDayItems[i];
        const itemB = allDayItems[j];
        if (!itemA.startTime || !itemB.startTime) continue;
        const risk = computeCollisionRisk(itemA, itemB);
        if (risk.level !== 'clear') {
          dayCollisions.push({
            candidate: itemA,
            collidingWith: itemB,
            riskScore: risk.riskScore,
            level: risk.level,
            overlapMins: risk.overlapMins,
            explanation: risk.explanation
          });
        }
      }
    }

    const activeHabits = habits.map(h => ({
      id: h.id,
      title: h.title,
      cadence: h.cadence || 'Anytime',
      startTime: h.startTime || null,
      completed: Array.isArray(h.completedDays) && h.completedDays.includes(dStr)
    }));

    result.push({
      date: dStr,
      dayOfWeek: curr.getDay(),
      activeNow: dayClassification.activeNow,
      upcoming: dayClassification.upcoming,
      missed: dayClassification.missed,
      completed: dayClassification.completed,
      schedules: activeSchedules.map(s => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        category: s.category || 'College'
      })),
      tasks: activeTasks.map(t => ({
        id: t.id,
        title: t.title,
        startTime: t.startTime || null,
        endTime: t.endTime || null,
        durationMinutes: t.durationMinutes || 45,
        completed: Boolean(t.completed),
        scheduleId: t.scheduleId || t.linkedScheduleId || null,
        goalId: t.goalId || null
      })),
      collisions: dayCollisions,
      habits: activeHabits
    });

    curr.setDate(curr.getDate() + 1);
    dayCount++;
  }
  return result;
}
