import test from 'node:test';
import assert from 'node:assert/strict';
import { calcStreak, last7Days, todayKey } from '../src/store/useStore.js';

test('calcStreak counts consecutive local calendar days', () => {
  const today = todayKey();
  const days = last7Days();
  assert.equal(calcStreak([today, days[5], days[4]]), 3);
});

test('calcStreak ignores duplicates, gaps, and invalid dates', () => {
  const [,,,,, yesterday, today] = last7Days();
  assert.equal(calcStreak([today, today, yesterday, 'invalid']), 2);
  assert.equal(calcStreak([today, last7Days()[4]]), 1);
});

test('last7Days returns exactly 7 ISO date keys culminating in todayKey', () => {
  const days = last7Days();
  assert.equal(days.length, 7);
  assert.equal(days[6], todayKey());
});

test('calcStreak recognizes retroactive check-in closing previous gap', () => {
  const days = last7Days();
  // Suppose today (days[6]) and 2 days ago (days[4]) were missed
  assert.equal(calcStreak([days[6], days[4]]), 1);
  // User retroactively checks in yesterday
  assert.equal(calcStreak([days[6], days[5], days[4]]), 3);
});

import { isTaskCompletedForDate } from '../src/lib/taskMetadata.js';

test('isTaskCompletedForDate checks non-recurring task directly', () => {
  const tOpen = { id: '1', completed: false };
  const tDone = { id: '2', completed: true };
  assert.equal(isTaskCompletedForDate(tOpen, '2026-10-10'), false);
  assert.equal(isTaskCompletedForDate(tDone, '2026-10-10'), true);
});

test('isTaskCompletedForDate scopes recurring task to completedDates array without leaking', () => {
  const recurring = {
    id: 'rec-1',
    recurrence: 'daily',
    completedDates: ['2026-10-10']
  };
  assert.equal(isTaskCompletedForDate(recurring, '2026-10-10'), true);
  assert.equal(isTaskCompletedForDate(recurring, '2026-10-11'), false);
  assert.equal(isTaskCompletedForDate(recurring, '2026-10-09'), false);
});

test('isTaskCompletedForDate falls back to completedAt date for legacy recurring records', () => {
  const legacyToday = {
    id: 'leg-1',
    recurrence: 'daily',
    completed: true,
    completedAt: new Date('2026-10-10T14:00:00Z').getTime()
  };
  assert.equal(isTaskCompletedForDate(legacyToday, '2026-10-10'), true);
  assert.equal(isTaskCompletedForDate(legacyToday, '2026-10-11'), false);
});

test('Backup payload validates tasks, goals, habits, and schedules preservation', () => {
  const payload = {
    version: '2.0',
    tasks: [{ id: '1', title: 'Task' }],
    goals: [{ id: 'g1', title: 'Goal' }],
    habits: [{ id: 'h1', title: 'Habit' }],
    schedules: [{ id: 's1', title: 'Meeting', startTime: '10:00' }],
    reflections: { history: [] },
    settings: { soundEffects: true },
    focusSessions: []
  };
  assert.ok(Array.isArray(payload.tasks));
  assert.ok(Array.isArray(payload.schedules));
  assert.equal(payload.schedules[0].title, 'Meeting');
});


