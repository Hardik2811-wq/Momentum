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
  // Suppose today (days[6]) and 2 days ago (days[4]) were checked, but yesterday (days[5]) was missed
  assert.equal(calcStreak([days[6], days[4]]), 1);
  // User retroactively checks in yesterday
  assert.equal(calcStreak([days[6], days[5], days[4]]), 3);
});
