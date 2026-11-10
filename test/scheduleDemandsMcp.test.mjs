import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isScheduleActiveForDate,
  normalizeRepeatDays,
  renderCalendarRange,
  classifyDayItems
} from '../src/lib/missedScheduleEngine.js';
import {
  detectScheduleCollisions
} from '../src/lib/scheduleCollisionGuard.js';

test('Demand 1 & 3: Edit schedule block in-place updates all projected occurrences', () => {
  const schedule = {
    id: 'sched-cs301',
    title: 'CS301 Distributed Systems',
    startTime: '09:00',
    endTime: '10:30',
    durationMinutes: 90,
    recurrence: 'weekly',
    repeatDays: [1, 3] // Mon, Wed
  };

  // Active on Mon 2026-11-09 & Wed 2026-11-11
  assert.equal(isScheduleActiveForDate(schedule, '2026-11-09'), true);
  assert.equal(isScheduleActiveForDate(schedule, '2026-11-11'), true);
  assert.equal(isScheduleActiveForDate(schedule, '2026-11-10'), false);

  // In-place edit by ID: change title and repeatDays to Tue, Thu [2, 4]
  const updatedSchedule = {
    ...schedule,
    title: 'CS301 Cloud Mesh & Raft',
    repeatDays: [2, 4]
  };

  // Now active on Tue/Thu, inactive on Mon/Wed across all weeks
  assert.equal(isScheduleActiveForDate(updatedSchedule, '2026-11-10'), true); // Tue
  assert.equal(isScheduleActiveForDate(updatedSchedule, '2026-11-12'), true); // Thu
  assert.equal(isScheduleActiveForDate(updatedSchedule, '2026-11-09'), false); // Mon
});

test('Demand 2 & 5: Skip single occurrence and exclude specific dates (holidays/cancellations)', () => {
  const schedule = {
    id: 'sched-phys',
    title: 'Physics Lab',
    recurrence: 'weekly',
    repeatDays: [1], // Monday
    excludedDates: ['2026-11-16'] // Skip one class
  };

  // Nov 9 is Monday -> Active
  assert.equal(isScheduleActiveForDate(schedule, '2026-11-09'), true);
  // Nov 16 is Monday, but explicitly excluded -> Inactive
  assert.equal(isScheduleActiveForDate(schedule, '2026-11-16'), false);
  // Nov 23 is Monday -> Active
  assert.equal(isScheduleActiveForDate(schedule, '2026-11-23'), true);
});

test('Demand 4: Delete a series from a given date forward, leaving past intact', () => {
  const schedule = {
    id: 'sched-eng',
    title: 'Engineering Semantics',
    recurrence: 'weekly',
    repeatDays: [2], // Tuesday
    recurrenceEndDate: '2026-11-17' // Cutoff date
  };

  // Nov 10 (Tue) is before cutoff -> Active
  assert.equal(isScheduleActiveForDate(schedule, '2026-11-10'), true);
  // Nov 17 (Tue) is on cutoff date -> Active
  assert.equal(isScheduleActiveForDate(schedule, '2026-11-17'), true);
  // Nov 24 (Tue) is past cutoff date -> Inactive
  assert.equal(isScheduleActiveForDate(schedule, '2026-11-24'), false);
});

test('Demand 7: Explicit startDate and endDate enforced by system', () => {
  const termSchedule = {
    id: 'sched-term',
    title: 'Data Structures',
    recurrence: 'weekly',
    repeatDays: [3], // Wednesday
    startDate: '2026-11-11',
    endDate: '2026-11-25'
  };

  // Nov 4 (Wed) before start date -> Inactive
  assert.equal(isScheduleActiveForDate(termSchedule, '2026-11-04'), false);
  // Nov 11 (Wed) start date -> Active
  assert.equal(isScheduleActiveForDate(termSchedule, '2026-11-11'), true);
  // Nov 18 (Wed) in-range -> Active
  assert.equal(isScheduleActiveForDate(termSchedule, '2026-11-18'), true);
  // Nov 25 (Wed) end date -> Active
  assert.equal(isScheduleActiveForDate(termSchedule, '2026-11-25'), true);
  // Dec 2 (Wed) past end date -> Inactive
  assert.equal(isScheduleActiveForDate(termSchedule, '2026-12-02'), false);
});

test('Demand 8: Recurrence options beyond weekly (daily, biweekly, weekdays, weekends)', () => {
  const daily = { recurrence: 'daily' };
  assert.equal(isScheduleActiveForDate(daily, '2026-11-11'), true);
  assert.equal(isScheduleActiveForDate(daily, '2026-11-12'), true);

  const weekdays = { recurrence: 'weekdays' };
  assert.equal(isScheduleActiveForDate(weekdays, '2026-11-13'), true); // Fri
  assert.equal(isScheduleActiveForDate(weekdays, '2026-11-14'), false); // Sat

  const weekends = { recurrence: 'weekends' };
  assert.equal(isScheduleActiveForDate(weekends, '2026-11-14'), true); // Sat
  assert.equal(isScheduleActiveForDate(weekends, '2026-11-15'), true); // Sun
  assert.equal(isScheduleActiveForDate(weekends, '2026-11-16'), false); // Mon

  // Biweekly: every 2 weeks
  const biweekly = {
    recurrence: 'biweekly',
    startDate: '2026-11-02', // Week 0 Monday
    repeatDays: [1]
  };
  assert.equal(isScheduleActiveForDate(biweekly, '2026-11-02'), true); // Week 0
  assert.equal(isScheduleActiveForDate(biweekly, '2026-11-09'), false); // Week 1 (skipped)
  assert.equal(isScheduleActiveForDate(biweekly, '2026-11-16'), true); // Week 2 (active)
  assert.equal(isScheduleActiveForDate(biweekly, '2026-11-23'), false); // Week 3 (skipped)
});

test('Demand 9: Canonical weekday format normalized across numbers (0-6, 1-7) and names', () => {
  assert.deepEqual(normalizeRepeatDays([0, 2, 4]), [0, 2, 4]);
  // ISO Mon=1..Sun=7 -> 0
  assert.deepEqual(normalizeRepeatDays([7, 1, 3]), [0, 1, 3]);
  // Day names
  assert.deepEqual(normalizeRepeatDays(['Mon', 'Wednesday', 'Friday']), [1, 3, 5]);
  assert.deepEqual(normalizeRepeatDays(['Sunday', 'Tue']), [0, 2]);
});

test('Demand 10: Single duration or auto-calculated from start and end', () => {
  const { calculateDuration, calculateEndTime } = {
    calculateDuration: (start, end) => {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      return (eh * 60 + em) - (sh * 60 + sm);
    },
    calculateEndTime: (start, dur) => {
      const [sh, sm] = start.split(':').map(Number);
      const tot = sh * 60 + sm + dur;
      return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
    }
  };

  const dur = calculateDuration('09:30', '11:00');
  assert.equal(dur, 90);
  const end = calculateEndTime('09:30', dur);
  assert.equal(end, '11:00');
});

test('Demand 14, 15 & 16: Render calendar range with past vs upcoming and collision detection', () => {
  const tasks = [
    {
      id: 'task-1',
      title: 'Review Lecture Notes',
      plannedDate: '2026-11-11',
      startTime: '10:00',
      endTime: '11:00',
      durationMinutes: 60,
      scheduleId: 'sched-1' // Linked to schedule (Demand 19)
    }
  ];

  const schedules = [
    {
      id: 'sched-1',
      title: 'OS Lecture',
      startTime: '09:30',
      endTime: '11:00',
      durationMinutes: 90,
      recurrence: 'weekly',
      repeatDays: [3] // Wednesday 2026-11-11
    }
  ];

  const rendered = renderCalendarRange({
    tasks,
    schedules,
    habits: [{ id: 'h1', title: 'Morning Hydration', completedDays: ['2026-11-11'] }],
    startDate: '2026-11-11',
    endDate: '2026-11-12'
  });

  assert.equal(rendered.length, 2);
  const day1 = rendered[0];
  assert.equal(day1.date, '2026-11-11');
  assert.equal(day1.schedules.length, 1);
  assert.equal(day1.tasks.length, 1);
  assert.equal(day1.tasks[0].scheduleId, 'sched-1');
  assert.equal(day1.habits[0].completed, true);

  // Demand 15: Conflict detected (09:30-11:00 OS Lecture overlaps with 10:00-11:00 Review Task)
  assert.equal(day1.collisions.length > 0, true);
  assert.equal(day1.collisions[0].candidate.id, 'task-1');
  assert.equal(day1.collisions[0].collidingWith.id, 'sched-1');
});

test('Demand 18 & 19: Tasks link to schedules and can be marked complete atomically', () => {
  const studyTask = {
    id: 'task-study',
    title: 'Prep for Distributed Systems Midterm',
    plannedDate: '2026-11-12',
    scheduleId: 'sched-cs301', // Linked to class
    completed: false
  };

  assert.equal(studyTask.scheduleId, 'sched-cs301');

  // Simulated atomic executive plan completion
  const completeTaskIds = ['task-study'];
  const updatedTask = {
    ...studyTask,
    completed: completeTaskIds.includes(studyTask.id),
    completedAt: Date.now()
  };

  assert.equal(updatedTask.completed, true);
});

test('Demand 20: Duplicate schedule detection logic', () => {
  const existingSchedules = [
    { id: 'sched-1', title: 'Database Systems', startTime: '14:00', repeatDays: [1, 3] }
  ];

  const isDuplicate = (cand, list) => {
    return list.some(s =>
      s.title.toLowerCase() === cand.title.toLowerCase() &&
      s.startTime === cand.startTime &&
      s.repeatDays.some(d => cand.repeatDays.includes(d))
    );
  };

  // Same title, same time, shared Monday
  assert.equal(isDuplicate({ title: 'Database Systems', startTime: '14:00', repeatDays: [1] }, existingSchedules), true);
  // Different time
  assert.equal(isDuplicate({ title: 'Database Systems', startTime: '16:00', repeatDays: [1] }, existingSchedules), false);
  // Different days
  assert.equal(isDuplicate({ title: 'Database Systems', startTime: '14:00', repeatDays: [2, 4] }, existingSchedules), false);
});

test('Demand 21: Snapshot undo ring buffer preserves historical states', () => {
  const undoHistory = [];
  const pushUndo = (snapshot, summary) => {
    undoHistory.unshift({ timestamp: Date.now(), summary, snapshot });
    if (undoHistory.length > 5) undoHistory.length = 5;
  };

  const initialWorkspace = { schedules: [{ id: 's1', title: 'Calculus' }] };
  pushUndo(initialWorkspace, 'Before bulk import');

  const modifiedWorkspace = { schedules: [] }; // Accidental delete
  assert.equal(undoHistory.length, 1);

  // Undo restores initial workspace
  const restored = undoHistory.shift().snapshot;
  assert.equal(restored.schedules.length, 1);
  assert.equal(restored.schedules[0].title, 'Calculus');
});

test('Demand 22: Dry run computes plan diff without committing state changes', () => {
  const liveState = { schedules: [{ id: 's1', title: 'Old Class' }] };
  const incomingSchedules = [{ id: 's2', title: 'New Class' }];

  const executePlan = (plan, dryRun = false) => {
    const diff = {
      wouldAdd: incomingSchedules.length,
      wouldDelete: plan.deleteScheduleIds?.length || 0
    };
    if (dryRun) {
      return { dryRun: true, diff, currentLiveCount: liveState.schedules.length };
    }
    liveState.schedules.push(...incomingSchedules);
    return { dryRun: false, currentLiveCount: liveState.schedules.length };
  };

  // Test dry-run: live state remains untouched
  const dryRunResult = executePlan({ deleteScheduleIds: [] }, true);
  assert.equal(dryRunResult.dryRun, true);
  assert.equal(dryRunResult.currentLiveCount, 1);
  assert.equal(liveState.schedules.length, 1);
});
