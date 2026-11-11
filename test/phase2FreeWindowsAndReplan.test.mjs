import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDayTripBuffers,
  getDayAnchors,
  resolveHabitForDate,
  getFreeWindows,
  replanFromNow,
  isScheduleActiveForDate
} from '../src/lib/missedScheduleEngine.js';

import {
  detectScheduleCollisions
} from '../src/lib/scheduleCollisionGuard.js';

import {
  getCircadianZone,
  getCircadianType
} from '../src/lib/circadianEnergyModel.js';

test('Circadian Model: tags time slots with peak, dip, second_wind, and evening_low', () => {
  assert.equal(getCircadianType('08:00'), 'peak');
  assert.equal(getCircadianType('11:00'), 'peak');
  assert.equal(getCircadianType('13:00'), 'dip');
  assert.equal(getCircadianType('14:30'), 'dip');
  assert.equal(getCircadianType('16:30'), 'second_wind');
  assert.equal(getCircadianType('19:00'), 'evening_low');
  assert.equal(getCircadianType('22:00'), 'evening_low');

  const morning = getCircadianZone('09:00');
  assert.equal(morning.label, 'PEAK_COGNITIVE');
  assert.equal(morning.multiplier, 1.0);
  assert.equal(morning.type, 'peak');
});

test('Trip Buffers: groups a day classes into one trip with prep and travel buffers', () => {
  const schedules = [
    {
      id: 'sched-1',
      title: 'CS301 Distributed Systems',
      startTime: '10:00',
      endTime: '11:30',
      durationMinutes: 90,
      category: 'College',
      recurrence: 'weekly',
      repeatDays: [1] // Monday
    },
    {
      id: 'sched-2',
      title: 'CS302 Database Internals',
      startTime: '13:00',
      endTime: '14:30',
      durationMinutes: 90,
      category: 'College',
      recurrence: 'weekly',
      repeatDays: [1] // Monday
    }
  ];

  const date = '2026-11-09'; // Monday
  const buffers = getDayTripBuffers(schedules, date, {
    profile: { prepMin: 60, travelMin: 35 }
  });

  assert.equal(buffers.length, 3);

  // 1. Morning prep: first class at 10:00 (600m).
  // prepStart = 600 - 35 - 60 = 505 (08:25), prepEnd = 600 - 35 = 565 (09:25)
  const prep = buffers.find((b) => b.title === 'Trip: Morning Prep');
  assert.ok(prep);
  assert.equal(prep.startTime, '08:25');
  assert.equal(prep.endTime, '09:25');
  assert.equal(prep.durationMinutes, 60);
  assert.equal(prep.striped, true);
  assert.equal(prep.readOnly, true);

  // 2. Commute to Campus: [09:25, 10:00] (35m)
  const commuteTo = buffers.find((b) => b.title === 'Trip: Commute to Campus');
  assert.ok(commuteTo);
  assert.equal(commuteTo.startTime, '09:25');
  assert.equal(commuteTo.endTime, '10:00');
  assert.equal(commuteTo.durationMinutes, 35);

  // 3. Commute Home: last class ends at 14:30. [14:30, 15:05] (35m)
  const commuteHome = buffers.find((b) => b.title === 'Trip: Commute Home');
  assert.ok(commuteHome);
  assert.equal(commuteHome.startTime, '14:30');
  assert.equal(commuteHome.endTime, '15:05');
  assert.equal(commuteHome.durationMinutes, 35);

  // On a day with no classes, buffers array is empty
  const noClassBuffers = getDayTripBuffers(schedules, '2026-11-10'); // Tuesday
  assert.equal(noClassBuffers.length, 0);
});

test('Daily Anchors: generates breakfast, dinner, and sleep blocks', () => {
  const settings = {
    anchors: {
      breakfast: { enabled: true, startTime: '08:00', durationMinutes: 30, title: 'Breakfast' },
      dinner: { enabled: true, startTime: '19:30', durationMinutes: 45, title: 'Dinner' },
      lightsOut: { enabled: true, startTime: '23:30', durationMinutes: 420, title: 'Sleep / Lights Out' }
    }
  };

  const anchors = getDayAnchors(settings, '2026-11-09');
  assert.equal(anchors.length, 3);

  const bf = anchors.find((a) => a.title === 'Breakfast');
  assert.equal(bf.startTime, '08:00');
  assert.equal(bf.endTime, '08:30');
  assert.equal(bf.durationMinutes, 30);
  assert.equal(bf.isAnchor, true);

  const din = anchors.find((a) => a.title === 'Dinner');
  assert.equal(din.startTime, '19:30');
  assert.equal(din.endTime, '20:15');
  assert.equal(din.durationMinutes, 45);

  const sleep = anchors.find((a) => a.title === 'Sleep / Lights Out');
  assert.equal(sleep.startTime, '23:30');
  assert.equal(sleep.isAnchor, true);
});

test('Collision Guard: protects against candidate overlap with commute buffers and anchors', () => {
  const schedules = [
    {
      id: 'sched-1',
      title: 'CS301 Distributed Systems',
      startTime: '10:00',
      endTime: '11:30',
      durationMinutes: 90,
      category: 'College',
      plannedDate: '2026-11-09'
    }
  ];

  const date = '2026-11-09';
  const tripBuffers = getDayTripBuffers(schedules, date, { profile: { prepMin: 60, travelMin: 35 } });
  const anchors = getDayAnchors({}, date);

  // Candidate task during commute time (09:30-10:00)
  const candidateCommuteOverlap = {
    id: 'probe-1',
    title: 'Study Session',
    startTime: '09:30',
    durationMinutes: 30
  };

  // Test against trip buffers
  const collisionWithBuffer = detectScheduleCollisions({
    candidate: candidateCommuteOverlap,
    schedules: tripBuffers,
    tasks: [],
    date
  });

  assert.equal(collisionWithBuffer.hasCollision, true);
  assert.equal(collisionWithBuffer.conflictingItem.title, 'Trip: Commute to Campus');

  // Candidate task during dinner anchor (19:40-20:20)
  const candidateDinnerOverlap = {
    id: 'probe-2',
    title: 'Gym Workout',
    startTime: '19:40',
    durationMinutes: 40
  };

  const collisionWithAnchor = detectScheduleCollisions({
    candidate: candidateDinnerOverlap,
    schedules: anchors,
    tasks: [],
    date
  });

  assert.equal(collisionWithAnchor.hasCollision, true);
  assert.equal(collisionWithAnchor.conflictingItem.title, 'Dinner');
});

test('Free Windows: returns open intervals tagged with circadian zones', () => {
  const schedules = [
    {
      id: 'sched-1',
      title: 'Algorithms Lecture',
      startTime: '10:00',
      endTime: '11:30',
      durationMinutes: 90,
      category: 'College',
      plannedDate: '2026-11-09'
    }
  ];

  const tasks = [
    {
      id: 't-1',
      title: 'Research Paper Reading',
      startTime: '16:00',
      endTime: '17:00',
      durationMinutes: 60,
      plannedDate: '2026-11-09'
    }
  ];

  const date = '2026-11-09';
  const result = getFreeWindows({
    date,
    schedules,
    tasks,
    habits: [],
    settings: {
      profile: { prepMin: 60, travelMin: 35 },
      anchors: {
        breakfast: { enabled: true, startTime: '07:30', durationMinutes: 30 },
        dinner: { enabled: true, startTime: '19:30', durationMinutes: 45 },
        lightsOut: { enabled: true, startTime: '23:30', durationMinutes: 420 }
      }
    },
    workDayStart: '07:00',
    workDayEnd: '23:30',
    minDurationMinutes: 15
  });

  assert.equal(result.dayType, 'classDay');
  assert.ok(result.totalFreeMinutes > 0);
  assert.ok(result.windows.length >= 3);

  // Every free window must have a valid circadianType
  for (const win of result.windows) {
    assert.ok(['peak', 'dip', 'second_wind', 'evening_low'].includes(win.circadianType));
    assert.ok(win.durationMinutes >= 15);
    assert.ok(win.recommendedModality);
  }

  // Afternoon window after last class commute home (11:30 + 35m = 12:05) until 16:00
  const afternoonWin = result.windows.find((w) => w.startTime <= '13:00' && w.endTime >= '15:00');
  assert.ok(afternoonWin);
  assert.equal(afternoonWin.startTime, '12:05');
  assert.equal(afternoonWin.endTime, '16:00');
  assert.equal(afternoonWin.durationMinutes, 235);
  // Evaluated at window start (12:05) -> SUSTAIN_CREATIVE (peak)
  assert.equal(afternoonWin.circadianZone, 'SUSTAIN_CREATIVE');
  assert.equal(afternoonWin.circadianType, 'peak');
});

test('Per-Day Habit Times: resolves classDay vs freeDay rules and single-day overrides', () => {
  const habit = {
    id: 'habit-wake',
    title: 'Morning Wakeup & Hydrate',
    startTime: '07:30',
    durationMinutes: 20,
    rules: [
      { dayType: 'classDay', startTime: '06:30', durationMinutes: 20 },
      { dayType: 'freeDay', startTime: '08:30', durationMinutes: 30 }
    ],
    excludedDates: ['2026-11-15'],
    overrides: {
      '2026-11-12': { startTime: '05:45', durationMinutes: 25 }
    }
  };

  const classSchedule = [
    {
      id: 's-1',
      title: 'Lab Session',
      startTime: '09:00',
      endTime: '11:00',
      category: 'College',
      plannedDate: '2026-11-09'
    }
  ];

  // 1. On class day (2026-11-09): should trigger classDay rule (06:30)
  const classDayResolved = resolveHabitForDate(habit, '2026-11-09', classSchedule);
  assert.equal(classDayResolved.startTime, '06:30');
  assert.equal(classDayResolved.durationMinutes, 20);
  assert.equal(classDayResolved.dayType, 'classDay');

  // 2. On free day (2026-11-10, no classes): should trigger freeDay rule (08:30)
  const freeDayResolved = resolveHabitForDate(habit, '2026-11-10', classSchedule);
  assert.equal(freeDayResolved.startTime, '08:30');
  assert.equal(freeDayResolved.durationMinutes, 30);
  assert.equal(freeDayResolved.dayType, 'freeDay');

  // 3. On single-day override date (2026-11-12): should trigger override (05:45)
  const overrideResolved = resolveHabitForDate(habit, '2026-11-12', classSchedule);
  assert.equal(overrideResolved.startTime, '05:45');
  assert.equal(overrideResolved.durationMinutes, 25);
  assert.equal(overrideResolved.isOverride, true);

  // 4. On excluded date (2026-11-15): should be marked excluded/inactive
  const excludedResolved = resolveHabitForDate(habit, '2026-11-15', classSchedule);
  assert.equal(excludedResolved.isExcluded, true);
  assert.equal(excludedResolved.active, false);

  // 5. Habit without rules behaves as legacy
  const simpleHabit = { id: 'h-simple', title: 'Meditation', startTime: '21:00', durationMinutes: 15 };
  const simpleResolved = resolveHabitForDate(simpleHabit, '2026-11-09', classSchedule);
  assert.equal(simpleResolved.startTime, '21:00');
  assert.equal(simpleResolved.durationMinutes, 15);
});

test('Replan from Now: moves missed and unpinned tasks into optimal slots, protects pinned tasks', () => {
  const date = '2026-11-09';
  const schedules = [
    {
      id: 'sched-1',
      title: 'Distributed Systems',
      startTime: '09:00',
      endTime: '11:00',
      durationMinutes: 120,
      category: 'College',
      plannedDate: date
    }
  ];

  const tasks = [
    // Task 1: Missed task scheduled at 07:00-08:00 (now is 11:30)
    {
      id: 'task-missed',
      title: 'Problem Set 1',
      startTime: '07:00',
      endTime: '08:00',
      durationMinutes: 60,
      priority: 'high',
      energy: 'High',
      completed: false,
      plannedDate: date
    },
    // Task 2: Pinned task (MUST NOT MOVE)
    {
      id: 'task-pinned',
      title: 'Dentist Appointment',
      startTime: '15:00',
      endTime: '16:00',
      durationMinutes: 60,
      isPinned: true,
      completed: false,
      plannedDate: date
    },
    // Task 3: Upcoming unpinned task with a hard deadline at 17:00
    {
      id: 'task-upcoming',
      title: 'Submit Code Review',
      startTime: '14:00',
      endTime: '14:45',
      durationMinutes: 45,
      deadlineTime: '17:00',
      priority: 'normal',
      completed: false,
      plannedDate: date
    }
  ];

  // Replan from 11:30 AM forward
  const result = replanFromNow({
    date,
    fromTime: '11:30',
    tasks,
    schedules,
    habits: [],
    settings: {
      profile: { prepMin: 30, travelMin: 15 },
      anchors: {
        dinner: { enabled: true, startTime: '19:30', durationMinutes: 45 },
        lightsOut: { enabled: true, startTime: '23:30', durationMinutes: 420 }
      },
      deepWorkCeilingMin: 240
    },
    dryRun: true
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.movedCount >= 2, true);

  // Pinned task must be skipped and preserved
  const pinnedSkipped = result.pinnedTasksSkipped.find((p) => p.id === 'task-pinned');
  assert.ok(pinnedSkipped);
  assert.equal(pinnedSkipped.startTime, '15:00');

  // Moved task: Problem Set 1 must start at or after 11:30 (and after class commute home if any)
  const movedMissed = result.movedTasks.find((m) => m.id === 'task-missed');
  assert.ok(movedMissed);
  assert.ok(movedMissed.newStartTime >= '11:30');
  assert.equal(movedMissed.durationMinutes, 60);

  // Moved task: Submit Code Review must not collide with Dentist Appointment (15:00-16:00)
  const movedUpcoming = result.movedTasks.find((m) => m.id === 'task-upcoming');
  assert.ok(movedUpcoming);
  assert.ok(movedUpcoming.newStartTime >= '11:30');

  // Ensure no overlap between moved tasks and pinned task
  const [sMissedH, sMissedM] = movedMissed.newStartTime.split(':').map(Number);
  const missedStartM = sMissedH * 60 + sMissedM;
  const missedEndM = missedStartM + 60;

  const [sUpH, sUpM] = movedUpcoming.newStartTime.split(':').map(Number);
  const upStartM = sUpH * 60 + sUpM;
  const upEndM = upStartM + 45;

  // Cannot overlap Dentist (15:00-16:00 = 900-960)
  assert.ok(missedEndM <= 900 || missedStartM >= 960);
  assert.ok(upEndM <= 900 || upStartM >= 960);
});
