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
