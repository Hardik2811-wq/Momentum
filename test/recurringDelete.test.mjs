import test from 'node:test';
import assert from 'node:assert/strict';
import { isTaskScheduledForDate } from '../src/lib/taskMetadata.js';

test('isTaskScheduledForDate handles daily recurring tasks', () => {
  const task = {
    id: 1,
    title: 'Dinner',
    plannedDate: '2026-09-25',
    recurrence: 'daily'
  };

  assert.equal(isTaskScheduledForDate(task, '2026-09-24'), false, 'Should not appear before base date');
  assert.equal(isTaskScheduledForDate(task, '2026-09-25'), true, 'Should appear on base date');
  assert.equal(isTaskScheduledForDate(task, '2026-09-26'), true, 'Should appear tomorrow');
  assert.equal(isTaskScheduledForDate(task, '2026-09-27'), true, 'Should appear in 2 days');
});

test('mode: "this" excludes only the single target date', () => {
  const task = {
    id: 1,
    title: 'Dinner',
    plannedDate: '2026-09-25',
    recurrence: 'daily',
    excludedDates: ['2026-09-26']
  };

  assert.equal(isTaskScheduledForDate(task, '2026-09-25'), true, 'Past/base date remains scheduled');
  assert.equal(isTaskScheduledForDate(task, '2026-09-26'), false, 'Target excluded date is omitted');
  assert.equal(isTaskScheduledForDate(task, '2026-09-27'), true, 'Future date remains scheduled');
});

test('mode: "this" on base plannedDate excludes base date while keeping future occurrences', () => {
  const task = {
    id: 1,
    title: 'Dinner',
    plannedDate: '2026-09-25',
    recurrence: 'daily',
    excludedDates: ['2026-09-25']
  };

  assert.equal(isTaskScheduledForDate(task, '2026-09-25'), false, 'Base date omitted when specifically deleted');
  assert.equal(isTaskScheduledForDate(task, '2026-09-26'), true, 'Following day still recurs');
});

test('mode: "following" stops recurrence from target date onward while preserving past', () => {
  const task = {
    id: 1,
    title: 'Dinner',
    plannedDate: '2026-09-25',
    recurrence: 'daily',
    recurrenceUntil: '2026-09-27'
  };

  assert.equal(isTaskScheduledForDate(task, '2026-09-25'), true, 'Sep 25 is before recurrenceUntil');
  assert.equal(isTaskScheduledForDate(task, '2026-09-26'), true, 'Sep 26 is before recurrenceUntil');
  assert.equal(isTaskScheduledForDate(task, '2026-09-27'), false, 'Sep 27 is on/after recurrenceUntil (omitted)');
  assert.equal(isTaskScheduledForDate(task, '2026-09-28'), false, 'Sep 28 is after recurrenceUntil (omitted)');
});
