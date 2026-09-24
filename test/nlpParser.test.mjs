import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNaturalTask } from '../src/lib/nlpParser.js';
import { parseCompoundDuration } from '../src/lib/taskMetadata.js';

const mockGoals = [
  { id: 'g1', title: 'Ship Portfolio Website v3', category: 'career' },
  { id: 'g2', title: 'Marathon Sub 3:30', category: 'health' }
];

test('parseNaturalTask parses full natural language task string with Life Areas', () => {
  const input = 'Design landing page hero tomorrow 2:30pm !high 45m #career #g1';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'Design landing page hero');
  assert.equal(result.extracted.dueDate, 'Tomorrow');
  assert.equal(result.extracted.startTime, '14:30');
  assert.equal(result.extracted.durationMinutes, 45);
  assert.deepEqual(result.extracted.areas, ['Career & Craft']);
  assert.equal(result.extracted.priority, 'high');
  assert.equal(result.extracted.goalId, 'g1');
  assert.equal(result.hasDetected, true);
});

test('parseNaturalTask parses specific calendar date (Month Day)', () => {
  const input = 'Review budget on Oct 15 at 3pm 30m';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'Review budget');
  assert.equal(result.extracted.plannedDate, '2026-10-15');
  assert.equal(result.extracted.dueDate, 'Oct 15');
  assert.equal(result.extracted.startTime, '15:00');
  assert.equal(result.extracted.durationMinutes, 30);
});

test('parseNaturalTask parses ISO date format', () => {
  const input = 'Deploy infrastructure 2026-11-20 10:00';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'Deploy infrastructure');
  assert.equal(result.extracted.plannedDate, '2026-11-20');
  assert.equal(result.extracted.startTime, '10:00');
});

test('parseNaturalTask parses relative days offset (in 3 days)', () => {
  const input = 'Follow up with investor in 3 days';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'Follow up with investor');
  assert.ok(result.extracted.plannedDate);
  assert.ok(result.extracted.dueDate);
});

test('parseNaturalTask preserves title if no tags present', () => {
  const input = 'Review quarterly metrics';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'Review quarterly metrics');
  assert.equal(result.hasDetected, false);
});

test('parseNaturalTask parses flexible / open duration', () => {
  const input = 'Call friend tonight flexible';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'Call friend');
  assert.equal(result.extracted.isFlexible, true);
  assert.equal(result.extracted.durationMinutes, null);
  assert.equal(result.hasDetected, true);
});

test('parseNaturalTask parses start and end time window', () => {
  const input = 'Client workshop 2pm to 4:30pm !high';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'Client workshop');
  assert.equal(result.extracted.startTime, '14:00');
  assert.equal(result.extracted.endTime, '16:30');
  assert.equal(result.extracted.durationMinutes, 150); // 2.5 hours = 150m
  assert.equal(result.extracted.priority, 'high');
  assert.equal(result.hasDetected, true);
});

test('parseNaturalTask parses variable custom duration exceeding 120m', () => {
  const input = 'Deep focus architecture session 3h';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'Deep focus architecture session');
  assert.equal(result.extracted.durationMinutes, 180);
  assert.equal(result.hasDetected, true);
});

test('parseCompoundDuration parses xd yh zm and open formats', () => {
  assert.equal(parseCompoundDuration('1h 30m'), 90);
  assert.equal(parseCompoundDuration('2h'), 120);
  assert.equal(parseCompoundDuration('45m'), 45);
  assert.equal(parseCompoundDuration('1d 2h'), 1560);
  assert.equal(parseCompoundDuration('75'), 75);
  assert.equal(parseCompoundDuration('2.5h'), 150);
  assert.equal(parseCompoundDuration('open'), 'open');
  assert.equal(parseCompoundDuration('flexible'), 'open');
  assert.equal(parseCompoundDuration(''), null);
});

test('parseNaturalTask parses linked habit from tag', () => {
  const mockHabits = [
    { id: 'h1', title: 'Morning Deep Work', duration: '90 mins' },
    { id: 'h2', title: 'Zone 2 Cardio / Running', duration: '45 mins' }
  ];
  const input = 'Tempo intervals 45m #h2';
  const result = parseNaturalTask(input, mockGoals, mockHabits);

  assert.equal(result.cleanTitle, 'Tempo intervals');
  assert.equal(result.extracted.habitId, 'h2');
  assert.equal(result.extracted.linkedHabitId, 'h2');
  assert.equal(result.extracted.habitTitle, 'Zone 2 Cardio / Running');
  assert.equal(result.hasDetected, true);
});
