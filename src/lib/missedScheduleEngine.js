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

import {
  getCircadianZone
} from './circadianEnergyModel.js';

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

/**
 * Calculates commute and prep buffers for university class schedules on a given date.
 * Groups classes into one campus trip:
 * - Prep Buffer: [firstClassStart - travelMin - prepMin, firstClassStart - travelMin]
 * - Commute to Campus: [firstClassStart - travelMin, firstClassStart]
 * - Commute Home: [lastClassEnd, lastClassEnd + travelMin]
 */
export function getDayTripBuffers(schedules = [], date = todayPlanDate(), settings = {}) {
  if (!date || !Array.isArray(schedules) || schedules.length === 0) return [];

  // Filter for active classes on this date (exclude personal / anchor blocks)
  const activeClasses = schedules.filter(s => {
    if (!isScheduleActiveForDate(s, date)) return false;
    const cat = String(s.category || 'College').toLowerCase();
    return cat !== 'personal' && cat !== 'anchor' && cat !== 'buffer';
  });

  if (activeClasses.length === 0) return [];

  // Sort by start time
  const sorted = [...activeClasses].sort((a, b) => {
    const sA = timeToMinutes(a.startTime) ?? 1440;
    const sB = timeToMinutes(b.startTime) ?? 1440;
    return sA - sB;
  });

  const firstClass = sorted[0];
  const lastClass = sorted[sorted.length - 1];

  const firstClassStart = timeToMinutes(firstClass.startTime);
  if (firstClassStart === null) return [];

  let lastClassEnd = timeToMinutes(lastClass.endTime);
  if (lastClassEnd === null) {
    const dur = Number(lastClass.durationMinutes || lastClass.duration) || 60;
    const s = timeToMinutes(lastClass.startTime);
    lastClassEnd = s !== null ? s + dur : firstClassStart + 60;
  }

  const prepMin = Number(settings?.profile?.prepMin ?? settings?.prepMin ?? 60);
  const travelMin = Number(settings?.profile?.travelMin ?? settings?.travelMin ?? 35);

  const buffers = [];

  // 1. Morning Prep Buffer: [firstClassStart - travelMin - prepMin, firstClassStart - travelMin]
  const prepStart = Math.max(0, firstClassStart - travelMin - prepMin);
  const prepEnd = Math.max(0, firstClassStart - travelMin);
  if (prepEnd > prepStart) {
    buffers.push({
      id: `buffer-prep-${date}`,
      title: 'Trip: Morning Prep',
      startTime: minutesToTime(prepStart),
      endTime: minutesToTime(prepEnd),
      durationMinutes: prepEnd - prepStart,
      category: 'Buffer',
      isBuffer: true,
      isFixed: true,
      readOnly: true,
      striped: true,
      isSchedule: true,
      plannedDate: date
    });
  }

  // 2. Commute to Campus (Travel): [firstClassStart - travelMin, firstClassStart]
  const travelToStart = prepEnd;
  const travelToEnd = firstClassStart;
  if (travelToEnd > travelToStart) {
    buffers.push({
      id: `buffer-commute-to-${date}`,
      title: 'Trip: Commute to Campus',
      startTime: minutesToTime(travelToStart),
      endTime: minutesToTime(travelToEnd),
      durationMinutes: travelToEnd - travelToStart,
      category: 'Buffer',
      isBuffer: true,
      isFixed: true,
      readOnly: true,
      striped: true,
      isSchedule: true,
      plannedDate: date
    });
  }

  // 3. Commute Home (Travel): [lastClassEnd, lastClassEnd + travelMin]
  const travelHomeStart = lastClassEnd;
  const travelHomeEnd = Math.min(1439, lastClassEnd + travelMin);
  if (travelHomeEnd > travelHomeStart) {
    buffers.push({
      id: `buffer-commute-home-${date}`,
      title: 'Trip: Commute Home',
      startTime: minutesToTime(travelHomeStart),
      endTime: minutesToTime(travelHomeEnd),
      durationMinutes: travelHomeEnd - travelHomeStart,
      category: 'Buffer',
      isBuffer: true,
      isFixed: true,
      readOnly: true,
      striped: true,
      isSchedule: true,
      plannedDate: date
    });
  }

  return buffers;
}

/**
 * Calculates daily anchors (breakfast, dinner, sleep/lights out) for collision guard and free windows.
 */
export function getDayAnchors(settings = {}, date = todayPlanDate()) {
  const anchorsConfig = settings?.anchors || {};
  const anchors = [];

  // Breakfast: default 08:00 - 08:30
  const bConf = anchorsConfig.breakfast !== undefined ? anchorsConfig.breakfast : { enabled: true, startTime: '08:00', durationMinutes: 30, title: 'Breakfast' };
  if (bConf && bConf.enabled !== false && bConf.startTime) {
    const dur = Number(bConf.durationMinutes) || 30;
    const startMins = timeToMinutes(bConf.startTime);
    if (startMins !== null) {
      anchors.push({
        id: `anchor-breakfast-${date}`,
        title: bConf.title || 'Breakfast',
        startTime: bConf.startTime,
        endTime: minutesToTime(startMins + dur),
        durationMinutes: dur,
        category: 'Anchor',
        isAnchor: true,
        isFixed: true,
        readOnly: true,
        striped: true,
        isSchedule: true,
        plannedDate: date
      });
    }
  }

  // Dinner: default 19:30 - 20:15
  const dConf = anchorsConfig.dinner !== undefined ? anchorsConfig.dinner : { enabled: true, startTime: '19:30', durationMinutes: 45, title: 'Dinner' };
  if (dConf && dConf.enabled !== false && dConf.startTime) {
    const dur = Number(dConf.durationMinutes) || 45;
    const startMins = timeToMinutes(dConf.startTime);
    if (startMins !== null) {
      anchors.push({
        id: `anchor-dinner-${date}`,
        title: dConf.title || 'Dinner',
        startTime: dConf.startTime,
        endTime: minutesToTime(startMins + dur),
        durationMinutes: dur,
        category: 'Anchor',
        isAnchor: true,
        isFixed: true,
        readOnly: true,
        striped: true,
        isSchedule: true,
        plannedDate: date
      });
    }
  }

  // Sleep / Lights Out: default 23:30 - 06:30
  const sConf = anchorsConfig.lightsOut !== undefined ? anchorsConfig.lightsOut : { enabled: true, startTime: '23:30', durationMinutes: 420, title: 'Sleep / Lights Out' };
  if (sConf && sConf.enabled !== false && sConf.startTime) {
    const startMins = timeToMinutes(sConf.startTime);
    if (startMins !== null) {
      const dur = Number(sConf.durationMinutes) || 420;
      anchors.push({
        id: `anchor-lights-out-${date}`,
        title: sConf.title || 'Sleep / Lights Out',
        startTime: sConf.startTime,
        endTime: minutesToTime(Math.min(1439, startMins + Math.min(dur, 1440 - startMins))),
        durationMinutes: Math.min(dur, 1440 - startMins),
        category: 'Anchor',
        isAnchor: true,
        isFixed: true,
        readOnly: true,
        striped: true,
        isSchedule: true,
        plannedDate: date
      });
    }
  }

  return anchors;
}

/**
 * Resolves a habit's effective time, duration, and active status for a given date.
 * Supports:
 * - habit.excludedDates[] (skips for specific dates)
 * - habit.overrides[dateStr] ({ startTime, durationMinutes, skipped })
 * - habit.rules[] ({ dayType: 'classDay' | 'freeDay', days: [1, 2], startTime: '07:00', duration: 30 })
 * - Fallback to top-level startTime & durationMinutes
 */
export function resolveHabitForDate(habit = {}, dateStr = todayPlanDate(), schedules = []) {
  if (!habit) return null;

  // 1. Check date exclusions
  if (Array.isArray(habit.excludedDates) && habit.excludedDates.includes(dateStr)) {
    return { ...habit, isExcluded: true, active: false, skipReason: 'Excluded date' };
  }

  // 2. Check single-day date override
  const override = habit.overrides && habit.overrides[dateStr];
  if (override) {
    if (override.skipped) {
      return { ...habit, isExcluded: true, active: false, skipReason: 'Single-day skip override' };
    }
    return {
      ...habit,
      startTime: override.startTime || habit.startTime,
      durationMinutes: Number(override.durationMinutes || override.duration || habit.durationMinutes) || 15,
      isOverride: true,
      active: true
    };
  }

  // 3. Check habit.rules
  if (Array.isArray(habit.rules) && habit.rules.length > 0) {
    const targetDate = new Date(`${dateStr}T12:00:00`);
    const dayOfWeek = isNaN(targetDate.getTime()) ? 0 : targetDate.getDay();

    // Check if target date is a classDay
    const hasClasses = Array.isArray(schedules) && schedules.some(s => {
      if (!isScheduleActiveForDate(s, dateStr)) return false;
      const cat = String(s.category || 'College').toLowerCase();
      return cat !== 'personal' && cat !== 'anchor' && cat !== 'buffer';
    });
    const currentDayType = hasClasses ? 'classDay' : 'freeDay';

    // Find rule matching either specific days or dayType
    let matchedRule = null;
    for (const rule of habit.rules) {
      if (rule.days) {
        const normDays = normalizeRepeatDays(rule.days);
        if (normDays.includes(dayOfWeek)) {
          matchedRule = rule;
          break;
        }
      } else if (rule.dayType && rule.dayType === currentDayType) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule) {
      return {
        ...habit,
        startTime: matchedRule.startTime || habit.startTime,
        durationMinutes: Number(matchedRule.durationMinutes || matchedRule.duration || habit.durationMinutes) || 15,
        matchedRule,
        dayType: currentDayType,
        active: true
      };
    }
  }

  // 4. Default fallback: behave as existing habit
  return {
    ...habit,
    startTime: habit.startTime || null,
    durationMinutes: Number(habit.durationMinutes || habit.duration) || 15,
    active: true
  };
}

/**
 * Calculates open free intervals on a date after subtracting:
 * - Timetable classes
 * - Commute and prep buffers (morning prep, commute to campus, commute home)
 * - Daily anchors (breakfast, dinner, sleep/lights out)
 * - Timed tasks (both scheduled and completed)
 * - Timed habits
 * Tags each free window with its circadian type (peak, dip, second_wind, evening_low)
 * and recommended cognitive modality.
 */
export function getFreeWindows({
  date = todayPlanDate(),
  tasks = [],
  schedules = [],
  habits = [],
  settings = {},
  workDayStart = '06:00',
  workDayEnd = '23:30',
  minDurationMinutes = 15,
  now = new Date()
}) {
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const isToday = date === todayPlanDate(now);

  const startLimit = Math.max(0, timeToMinutes(workDayStart) ?? 360);
  const endLimit = Math.min(1439, timeToMinutes(workDayEnd) ?? 1410);

  // 1. Gather all occupied intervals
  const occupied = [];

  // Active schedules (classes)
  const activeSchedules = (schedules || []).filter(s => isScheduleActiveForDate(s, date));
  for (const s of activeSchedules) {
    const sM = timeToMinutes(s.startTime);
    if (sM === null) continue;
    let dur = Number(s.durationMinutes || s.duration);
    if (!dur || isNaN(dur)) {
      if (s.endTime) {
        const diff = calculateDuration(s.startTime, s.endTime);
        if (diff > 0) dur = diff;
      }
    }
    if (!dur || isNaN(dur)) dur = 60;
    occupied.push({
      startMins: sM,
      endMins: sM + dur,
      title: s.title || 'Schedule Block',
      category: s.category || 'College',
      itemType: 'schedule',
      startTime: s.startTime,
      endTime: s.endTime || minutesToTime(sM + dur),
      durationMinutes: dur
    });
  }

  // Trip buffers
  const tripBuffers = getDayTripBuffers(schedules, date, settings);
  for (const b of tripBuffers) {
    const sM = timeToMinutes(b.startTime);
    const eM = timeToMinutes(b.endTime);
    if (sM !== null && eM !== null && eM > sM) {
      occupied.push({
        startMins: sM,
        endMins: eM,
        title: b.title,
        category: 'Buffer',
        itemType: 'buffer',
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes: eM - sM
      });
    }
  }

  // Daily anchors
  const anchors = getDayAnchors(settings, date);
  for (const a of anchors) {
    const sM = timeToMinutes(a.startTime);
    const eM = timeToMinutes(a.endTime);
    if (sM !== null && eM !== null && eM > sM) {
      occupied.push({
        startMins: sM,
        endMins: eM,
        title: a.title,
        category: 'Anchor',
        itemType: 'anchor',
        startTime: a.startTime,
        endTime: a.endTime,
        durationMinutes: eM - sM
      });
    }
  }

  // Timed tasks
  for (const t of tasks || []) {
    if (t.isBacklog || t.dueDate === 'Someday') continue;
    if (!isTaskScheduledForDate(t, date)) continue;
    if (!t.startTime) continue;
    const sM = timeToMinutes(t.startTime);
    if (sM === null) continue;
    const dur = Number(t.durationMinutes || t.duration) || 45;
    occupied.push({
      startMins: sM,
      endMins: sM + dur,
      title: t.title || 'Task',
      category: (Array.isArray(t.areas) ? t.areas[0] : t.category) || 'Tasks',
      itemType: 'task',
      startTime: t.startTime,
      endTime: t.endTime || minutesToTime(sM + dur),
      durationMinutes: dur,
      completed: Boolean(t.completed)
    });
  }

  // Timed habits
  for (const h of habits || []) {
    const resolved = resolveHabitForDate(h, date, schedules);
    if (!resolved || !resolved.active || !resolved.startTime) continue;
    const sM = timeToMinutes(resolved.startTime);
    if (sM === null) continue;
    const dur = Number(resolved.durationMinutes) || 15;
    occupied.push({
      startMins: sM,
      endMins: sM + dur,
      title: resolved.title || 'Habit',
      category: 'Habit',
      itemType: 'habit',
      startTime: resolved.startTime,
      endTime: minutesToTime(sM + dur),
      durationMinutes: dur
    });
  }

  // 2. Sort and merge overlapping occupied intervals
  occupied.sort((a, b) => a.startMins - b.startMins);

  const mergedBusy = [];
  for (const item of occupied) {
    const s = Math.max(startLimit, item.startMins);
    const e = Math.min(endLimit, item.endMins);
    if (e <= s) continue;

    if (mergedBusy.length === 0) {
      mergedBusy.push({ startMins: s, endMins: e });
    } else {
      const last = mergedBusy[mergedBusy.length - 1];
      if (s <= last.endMins) {
        last.endMins = Math.max(last.endMins, e);
      } else {
        mergedBusy.push({ startMins: s, endMins: e });
      }
    }
  }

  // 3. Invert to calculate free windows
  const windows = [];
  let cursor = startLimit;

  for (const busy of mergedBusy) {
    if (busy.startMins > cursor) {
      const freeDur = busy.startMins - cursor;
      if (freeDur >= minDurationMinutes) {
        windows.push({ startMins: cursor, endMins: busy.startMins, durationMinutes: freeDur });
      }
    }
    cursor = Math.max(cursor, busy.endMins);
  }

  if (cursor < endLimit) {
    const freeDur = endLimit - cursor;
    if (freeDur >= minDurationMinutes) {
      windows.push({ startMins: cursor, endMins: endLimit, durationMinutes: freeDur });
    }
  }

  // 4. Enrich windows with Circadian metadata
  const enrichedWindows = windows.map(w => {
    const startTime = minutesToTime(w.startMins);
    const endTime = minutesToTime(w.endMins);
    const zone = getCircadianZone(startTime);
    const isPast = isToday && w.endMins <= currentMins;
    const isCurrent = isToday && currentMins >= w.startMins && currentMins < w.endMins;
    const remainingMinutes = isCurrent ? w.endMins - currentMins : (isPast ? 0 : w.durationMinutes);

    return {
      startTime,
      endTime,
      durationMinutes: w.durationMinutes,
      startMins: w.startMins,
      endMins: w.endMins,
      circadianZone: zone.label,
      circadianType: zone.type || (zone.multiplier >= 0.85 ? 'peak' : zone.multiplier <= 0.5 ? 'dip' : 'second_wind'),
      circadianMultiplier: zone.multiplier,
      recommendedModality: (zone.ideal && zone.ideal[0]) || 'Deep Focus',
      description: zone.desc,
      isCurrent,
      isPast,
      remainingMinutes
    };
  });

  const totalFreeMinutes = enrichedWindows.reduce((acc, w) => acc + (w.isPast ? 0 : w.remainingMinutes || w.durationMinutes), 0);
  const dayType = activeSchedules.length > 0 ? 'classDay' : 'freeDay';

  return {
    date,
    dayType,
    totalFreeMinutes,
    freeWindowCount: enrichedWindows.length,
    windows: enrichedWindows,
    occupiedBlocks: occupied
  };
}

/**
 * Missed Tasks & "Replan from Now":
 * Automatically rollovers overdue/missed and upcoming unpinned tasks into optimal free slots.
 * - Pinned tasks (isPinned/pinned: true) are NEVER moved.
 * - Orders tasks by: dependencies -> hard deadlines (dueDate) -> priority (high > normal > low) -> energy fit.
 * - Respects daily deep work cap (deepWorkCeilingMin, default 240 mins).
 * - Leaves 5m transition buffer between placed tasks.
 * - Flags deadline shortfalls if task cannot fit before its required completion time.
 * - Returns detailed diff preview or applies changes.
 */
export function replanFromNow({
  date = todayPlanDate(),
  fromTime = null,
  tasks = [],
  schedules = [],
  habits = [],
  settings = {},
  taskIds = null,
  deepWorkCeilingMin = null,
  dryRun = true,
  now = new Date()
}) {
  const isToday = date === todayPlanDate(now);
  const currentMins = now.getHours() * 60 + now.getMinutes();

  let fromMins;
  if (fromTime) {
    fromMins = timeToMinutes(fromTime) ?? (isToday ? currentMins : 8 * 60);
  } else {
    fromMins = isToday ? currentMins : 8 * 60;
  }
  fromMins = Math.ceil(fromMins / 5) * 5;

  const ceilingMin = Number(deepWorkCeilingMin ?? settings?.deepWorkCeilingMin ?? 240);

  // 1. Separate tasks
  const targetIdSet = Array.isArray(taskIds) && taskIds.length > 0 ? new Set(taskIds.map(String)) : null;

  const pinnedTasks = [];
  const candidateTasks = [];
  const untouchedTasks = [];

  for (const t of tasks || []) {
    if (t.isBacklog || t.dueDate === 'Someday') {
      untouchedTasks.push(t);
      continue;
    }
    const isDone = isTaskCompletedForDate(t, date);
    if (isDone) {
      untouchedTasks.push(t);
      continue;
    }

    const isScheduled = isTaskScheduledForDate(t, date);
    const matchesIdFilter = targetIdSet ? targetIdSet.has(String(t.id)) : true;

    if (t.isPinned || t.pinned) {
      pinnedTasks.push(t);
      continue;
    }

    if (targetIdSet) {
      if (matchesIdFilter) {
        candidateTasks.push(t);
      } else {
        untouchedTasks.push(t);
      }
      continue;
    }

    if (!isScheduled) {
      untouchedTasks.push(t);
      continue;
    }

    candidateTasks.push(t);
  }

  // 2. Compute free windows starting from fromMins
  // Treat pinned tasks as fixed occupied schedules
  const effectiveSchedules = [
    ...(schedules || []),
    ...pinnedTasks.map(pt => ({
      ...pt,
      isSchedule: true,
      category: 'PinnedTask'
    }))
  ];

  const freeWindowsResult = getFreeWindows({
    date,
    tasks: [], // Don't block candidate tasks since we're rescheduling them
    schedules: effectiveSchedules,
    habits,
    settings,
    workDayStart: minutesToTime(fromMins),
    workDayEnd: settings?.anchors?.lightsOut?.startTime || '23:30',
    minDurationMinutes: 10,
    now
  });

  const availableWindows = freeWindowsResult.windows.filter(w => w.endMins > fromMins).map(w => ({
    ...w,
    startMins: Math.max(w.startMins, fromMins),
    durationMinutes: w.endMins - Math.max(w.startMins, fromMins)
  }));

  // 3. Sort candidate tasks
  const priorityRank = (p = '') => {
    const s = String(p).toLowerCase();
    if (s === 'high' || s === 'urgent') return 3;
    if (s === 'normal' || s === 'medium') return 2;
    return 1;
  };

  candidateTasks.sort((a, b) => {
    if (Array.isArray(b.dependsOn) && b.dependsOn.includes(a.id)) return -1;
    if (Array.isArray(a.dependsOn) && a.dependsOn.includes(b.id)) return 1;

    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }

    const pDiff = priorityRank(b.priority) - priorityRank(a.priority);
    if (pDiff !== 0) return pDiff;

    const sA = timeToMinutes(a.startTime) ?? 9999;
    const sB = timeToMinutes(b.startTime) ?? 9999;
    return sA - sB;
  });

  // 4. Greedy placement into available windows
  const movedTasks = [];
  const unplacedTasks = [];
  let accumulatedDeepWorkMins = 0;

  for (const pt of pinnedTasks) {
    if (pt.energy === 'High' || pt.effort === 'high') {
      accumulatedDeepWorkMins += Number(pt.durationMinutes || pt.duration) || 45;
    }
  }

  for (const task of candidateTasks) {
    const dur = Number(task.durationMinutes || task.duration) || 45;
    const isDeepWork = task.energy === 'High' || task.effort === 'high';

    let placed = false;

    for (let i = 0; i < availableWindows.length; i++) {
      const win = availableWindows[i];
      if (win.durationMinutes >= dur) {
        let exceedsDeepWork = false;
        if (isDeepWork && (accumulatedDeepWorkMins + dur > ceilingMin)) {
          exceedsDeepWork = true;
        }

        const newStartMins = win.startMins;
        const newEndMins = newStartMins + dur;
        const newStart = minutesToTime(newStartMins);
        const newEnd = minutesToTime(newEndMins);

        let shortfallMinutes = 0;
        let warning;
        if (task.deadlineTime) {
          const deadMins = timeToMinutes(task.deadlineTime);
          if (deadMins !== null && newEndMins > deadMins) {
            shortfallMinutes = newEndMins - deadMins;
            warning = `Task misses deadline (${task.deadlineTime}) by ${shortfallMinutes} minutes`;
          }
        }

        if (exceedsDeepWork) {
          warning = (warning ? warning + '. ' : '') + `Exceeds deep work daily ceiling (${ceilingMin}m).`;
        }

        const zone = getCircadianZone(newStart);

        movedTasks.push({
          id: task.id,
          title: task.title,
          oldStartTime: task.startTime || null,
          oldEndTime: task.endTime || null,
          newStartTime: newStart,
          newEndTime: newEnd,
          durationMinutes: dur,
          plannedDate: date,
          circadianZone: zone.label,
          circadianType: zone.type || 'peak',
          warning
        });

        if (isDeepWork) accumulatedDeepWorkMins += dur;

        // Consume time from window + 5m transition buffer
        const nextStartMins = newEndMins + 5;
        if (nextStartMins < win.endMins) {
          win.startMins = nextStartMins;
          win.durationMinutes = win.endMins - nextStartMins;
        } else {
          availableWindows.splice(i, 1);
        }

        placed = true;
        break;
      }
    }

    if (!placed) {
      unplacedTasks.push({
        id: task.id,
        title: task.title,
        durationMinutes: dur,
        reason: 'No remaining free window of required duration before day end',
        shortfallMinutes: dur
      });
    }
  }

  // 5. Build updated task list
  const movedMap = new Map(movedTasks.map(m => [String(m.id), m]));
  const updatedTasks = (tasks || []).map(t => {
    const moved = movedMap.get(String(t.id));
    if (moved) {
      return {
        ...t,
        startTime: moved.newStartTime,
        endTime: moved.newEndTime,
        durationMinutes: moved.durationMinutes,
        plannedDate: moved.plannedDate,
        date: moved.plannedDate
      };
    }
    return t;
  });

  return {
    date,
    fromTime: minutesToTime(fromMins),
    dryRun: Boolean(dryRun),
    deepWorkCeilingMin: ceilingMin,
    accumulatedDeepWorkMinutes: accumulatedDeepWorkMins,
    totalCandidates: candidateTasks.length,
    movedCount: movedTasks.length,
    unplacedCount: unplacedTasks.length,
    movedTasks,
    pinnedTasksSkipped: pinnedTasks.map(p => ({
      id: p.id,
      title: p.title,
      startTime: p.startTime,
      reason: 'Pinned by user'
    })),
    unplacedTasks,
    remainingFreeWindows: availableWindows.map(w => ({
      startTime: minutesToTime(w.startMins),
      endTime: minutesToTime(w.endMins),
      durationMinutes: w.durationMinutes
    })),
    updatedTasks
  };
}
