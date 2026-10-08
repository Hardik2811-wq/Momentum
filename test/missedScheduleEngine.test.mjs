import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getItemTimeWindow,
  isItemTimeWindowPassed,
  classifyDayItems,
  findIntelligentRecoverySlot,
  buildBacklogTaskPatch
} from '../src/lib/missedScheduleEngine.js';

test('Missed Schedule Engine: calculates window correctly', () => {
  const item = { startTime: '10:00', durationMinutes: 120 };
  const win = getItemTimeWindow(item);
  assert.equal(win.startMins, 600);
  assert.equal(win.endMins, 720);
  assert.equal(win.durationMinutes, 120);
});

test('Missed Schedule Engine: detects passed time window at 1:57 PM (13:57)', () => {
  const item = { startTime: '10:00', durationMinutes: 120, plannedDate: '2026-10-07' };
  const mockNowPassed = new Date(2026, 9, 7, 13, 57); // 13:57 PM
  const mockNowActive = new Date(2026, 9, 7, 10, 30); // 10:30 AM
  const mockNowFuture = new Date(2026, 9, 7, 9, 0);   // 09:00 AM

  assert.equal(isItemTimeWindowPassed(item, mockNowPassed, '2026-10-07'), true);
  assert.equal(isItemTimeWindowPassed(item, mockNowActive, '2026-10-07'), false);
  assert.equal(isItemTimeWindowPassed(item, mockNowFuture, '2026-10-07'), false);
});

test('Missed Schedule Engine: excludes completed items from missed', () => {
  const completedTask = { startTime: '10:00', durationMinutes: 120, completed: true, plannedDate: '2026-10-07' };
  const mockNow = new Date(2026, 9, 7, 14, 0);
  assert.equal(isItemTimeWindowPassed(completedTask, mockNow, '2026-10-07'), false);
});

test('Missed Schedule Engine: classifies day items and skips passed task from focus target', () => {
  const passedTask = {
    id: 1,
    title: 'MERN Class',
    startTime: '10:00',
    durationMinutes: 120,
    plannedDate: '2026-10-07',
    completed: false
  };

  const upcomingTask = {
    id: 2,
    title: 'CML 1',
    startTime: '15:00',
    durationMinutes: 60,
    plannedDate: '2026-10-07',
    completed: false
  };

  const untimedTask = {
    id: 3,
    title: 'CN 3',
    plannedDate: '2026-10-07',
    completed: false
  };

  const mockNow = new Date(2026, 9, 7, 13, 57); // 13:57 PM
  const res = classifyDayItems({
    tasks: [passedTask, upcomingTask, untimedTask],
    schedules: [],
    targetDate: '2026-10-07',
    now: mockNow
  });

  // Passed task is in missed
  assert.equal(res.missed.length, 1);
  assert.equal(res.missed[0].title, 'MERN Class');
  assert.equal(res.missed[0].isMissed, true);

  // Focus target is CML 1 (upcoming), NOT MERN Class!
  assert.ok(res.focusTarget);
  assert.equal(res.focusTarget.title, 'CML 1');
});

test('Missed Schedule Engine: isolates fixed schedules from task backlog routing', () => {
  const fixedSchedule = {
    id: 's1',
    title: 'Operating Systems Lecture',
    startTime: '09:00',
    endTime: '10:30',
    plannedDate: '2026-10-07',
    type: 'schedule'
  };

  const mockNow = new Date(2026, 9, 7, 12, 0);
  const res = classifyDayItems({
    tasks: [],
    schedules: [fixedSchedule],
    targetDate: '2026-10-07',
    now: mockNow
  });

  assert.equal(res.missed.length, 1);
  assert.equal(res.missed[0].itemType, 'schedule');
  // Fixed schedule is in missed, but cannot be in totallyMissedTasks
  assert.equal(res.totallyMissedTasks.length, 0);
});

test('Missed Schedule Engine: preserves recurring tasks with older creation date', () => {
  const recurringTask = {
    id: 'r1',
    title: 'MERN Class',
    startTime: '10:00',
    durationMinutes: 120,
    plannedDate: '2026-09-30', // Created Sep 30
    recurrence: 'weekdays',     // Recurs every weekday including Wed Oct 7
    completed: false
  };

  // Mock afternoon 13:57: window 10:00-12:00 has passed today
  const mockNowAfternoon = new Date(2026, 9, 7, 13, 57);
  const resAfternoon = classifyDayItems({
    tasks: [recurringTask],
    schedules: [],
    targetDate: '2026-10-07',
    now: mockNowAfternoon
  });

  // Not treated as totally missed past task
  assert.equal(resAfternoon.totallyMissedTasks.length, 0);
  // Treated as missed today
  assert.equal(resAfternoon.missed.length, 1);
  assert.equal(resAfternoon.missed[0].title, 'MERN Class');
});

test('Missed Schedule Engine: finds conflict-free intelligent recovery slot', () => {
  const missedTask = {
    id: 1,
    title: 'MERN Class',
    startTime: '10:00',
    durationMinutes: 90
  };

  const existingOtherTask = {
    id: 2,
    title: 'Team Sync',
    startTime: '14:00',
    durationMinutes: 60,
    plannedDate: '2026-10-07'
  };

  const mockNow = new Date(2026, 9, 7, 13, 57); // 13:57
  const rec = findIntelligentRecoverySlot({
    item: missedTask,
    tasks: [existingOtherTask],
    schedules: [],
    targetDate: '2026-10-07',
    now: mockNow
  });

  assert.ok(rec.startTime);
  assert.equal(rec.dateLabel, 'Today');
  // At 13:57 with 14:00-15:00 occupied, next slot should be after 15:00 with buffer
  const mins = parseInt(rec.startTime.split(':')[0], 10) * 60 + parseInt(rec.startTime.split(':')[1], 10);
  assert.ok(mins >= 15 * 60, `Slot ${rec.startTime} must avoid 14:00-15:00 collision`);
});

test('Missed Schedule Engine: builds clean backlog patch for tasks', () => {
  const patch = buildBacklogTaskPatch();
  assert.equal(patch.plannedDate, null);
  assert.equal(patch.startTime, null);
  assert.equal(patch.dueDate, 'Someday');
  assert.equal(patch.isBacklog, true);
});

test('Missed Schedule Engine: recurring schedule only activates on matching days of week', async () => {
  const { isScheduleActiveForDate } = await import('../src/lib/missedScheduleEngine.js');

  const satSchedule = {
    id: 'sched-1',
    title: 'CML Class',
    plannedDate: '2026-10-08', // Thursday base date
    recurrence: 'weekly',
    repeatDays: [6] // Saturday only
  };

  // Thursday 2026-10-08: must NOT be active
  assert.equal(isScheduleActiveForDate(satSchedule, '2026-10-08'), false);
  // Friday 2026-10-09: must NOT be active
  assert.equal(isScheduleActiveForDate(satSchedule, '2026-10-09'), false);
  // Saturday 2026-10-10: MUST be active
  assert.equal(isScheduleActiveForDate(satSchedule, '2026-10-10'), true);
});

test('Missed Schedule Engine: Thursday schedule with future plannedDate still shows on current Thursday', async () => {
  const { isScheduleActiveForDate } = await import('../src/lib/missedScheduleEngine.js');

  const thuSchedule = {
    id: 'sched-2',
    title: 'MERN LAB',
    plannedDate: '2026-10-15', // next week plannedDate
    recurrence: 'weekly',
    repeatDays: [4] // Thursday
  };

  // Thursday 2026-10-08: MUST be active
  assert.equal(isScheduleActiveForDate(thuSchedule, '2026-10-08'), true);
  // Friday 2026-10-09: must NOT be active
  assert.equal(isScheduleActiveForDate(thuSchedule, '2026-10-09'), false);
});

test('Missed Schedule Engine: calculateNextArrivingDate advances past slots to next arrival', async () => {
  const { calculateNextArrivingDate } = await import('../src/lib/taskMetadata.js');

  // Thursday 16:02: slot at 14:15 on Thursday has passed -> advances to next Thursday (2026-10-15)
  const nextThu = calculateNextArrivingDate({
    repeatDays: [4],
    startTime: '14:15',
    baseDateStr: '2026-10-08',
    nowTimeStr: '16:02'
  });
  assert.equal(nextThu, '2026-10-15');

  // Saturday slot at 09:30 -> arrives on coming Saturday (2026-10-10)
  const nextSat = calculateNextArrivingDate({
    repeatDays: [6],
    startTime: '09:30',
    baseDateStr: '2026-10-08',
    nowTimeStr: '16:02'
  });
  assert.equal(nextSat, '2026-10-10');

  // Tuesday slot at 13:30 -> arrives next Tuesday (2026-10-13)
  const nextTue = calculateNextArrivingDate({
    repeatDays: [2],
    startTime: '13:30',
    baseDateStr: '2026-10-08',
    nowTimeStr: '16:02'
  });
  assert.equal(nextTue, '2026-10-13');
});
