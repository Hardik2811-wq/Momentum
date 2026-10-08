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
  calculateDuration,
  formatTimeString,
  parseTimeString
} from './taskMetadata.js';

import {
  timeToMinutes,
  minutesToTime,
  detectScheduleCollisions
} from './scheduleCollisionGuard.js';

/**
 * Checks if a schedule item (fixed routine/timetable) is active for target date
 */
export function isScheduleActiveForDate(sched = {}, dateStr = todayPlanDate()) {
  if (!sched || !dateStr) return false;

  const repeatType = sched.recurrence || sched.repeat;
  const isRecurring = Boolean(
    repeatType &&
    repeatType !== 'none' &&
    repeatType !== 'never'
  );

  if (isRecurring) {
    // If schedule has a starting plannedDate, do not activate before that date
    if (sched.plannedDate && dateStr < sched.plannedDate) return false;
    if (sched.recurrenceEndDate && dateStr > sched.recurrenceEndDate) return false;
    if (sched.recurrenceUntil && dateStr >= sched.recurrenceUntil) return false;

    if (repeatType === 'daily' || repeatType === 'everyday') return true;

    const targetDate = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(targetDate.getTime())) return false;
    const dayOfWeek = targetDate.getDay();

    if (repeatType === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
    if (repeatType === 'weekends') return dayOfWeek === 0 || dayOfWeek === 6;
    if (repeatType === 'custom' || repeatType === 'weekly') {
      const days = Array.isArray(sched.repeatDays) && sched.repeatDays.length > 0
        ? sched.repeatDays
        : (sched.plannedDate ? [new Date(`${sched.plannedDate}T12:00:00`).getDay()] : [1]);
      return days.includes(dayOfWeek);
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
    if (t.completed) {
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
  const activeTask = activeNow.find(item => item.itemType === 'task');
  const upcomingTask = upcoming.find(item => item.itemType === 'task');
  const focusTarget = activeTask || upcomingTask || null;

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
