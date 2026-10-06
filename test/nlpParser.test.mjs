import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNaturalTask, extractRecurrenceMatch } from '../src/lib/nlpParser.js';
import { parseCompoundDuration, isTaskScheduledForDate } from '../src/lib/taskMetadata.js';

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

test('parseNaturalTask classifies effort from task nature independently from duration', () => {
  // Short duration high physical effort
  const workout = parseNaturalTask('Urgent gym workout 30m');
  assert.equal(workout.extracted.durationMinutes, 30);
  assert.equal(workout.extracted.energy, 'High');
  assert.equal(workout.extracted.effort, 'high');

  // Short duration high cognitive effort
  const debug = parseNaturalTask('Debug race condition bug 20m');
  assert.equal(debug.extracted.durationMinutes, 20);
  assert.equal(debug.extracted.energy, 'High');
  assert.equal(debug.extracted.effort, 'high');

  // Long duration low effort routine task
  const walk = parseNaturalTask('Relaxing walk in the park 1h');
  assert.equal(walk.extracted.durationMinutes, 60);
  assert.equal(walk.extracted.energy, 'Low');
  assert.equal(walk.extracted.effort, 'low');
});

test('parseNaturalTask handles compound "repeat [xyz] at [abc] for [1234] repeat every [qwe] till [890]"', () => {
  const input = 'repeat deep work at 10am for 2h repeat every weekday till nov 30';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'deep work', 'Title should be cleanly stripped of repeat tokens and prepositions');
  assert.equal(result.extracted.startTime, '10:00');
  assert.equal(result.extracted.endTime, '12:00');
  assert.equal(result.extracted.durationMinutes, 120);
  assert.equal(result.extracted.recurrence, 'custom');
  assert.deepEqual(result.extracted.repeatDays, [1, 2, 3, 4, 5]);
  assert.equal(result.extracted.recurrenceEndDate, '2026-11-30');
  assert.equal(result.extracted.recurrenceUntil, '2026-12-01');
  assert.equal(result.extracted.energy, 'High');
  assert.equal(result.hasDetected, true);
});

test('parseNaturalTask handles typo "fot 1234 duration" and specific day combinations', () => {
  const input = 'repeat math class at 11am fot 90m duration repeat every tue, thu till 2026-12-31';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'math class');
  assert.equal(result.extracted.startTime, '11:00');
  assert.equal(result.extracted.endTime, '12:30');
  assert.equal(result.extracted.durationMinutes, 90);
  assert.equal(result.extracted.recurrence, 'custom');
  assert.deepEqual(result.extracted.repeatDays, [2, 4]); // Tuesday = 2, Thursday = 4
  assert.equal(result.extracted.recurrenceEndDate, '2026-12-31');
  assert.equal(result.extracted.recurrenceUntil, '2027-01-01');
  assert.equal(result.hasDetected, true);
});

test('parseNaturalTask handles daily recurrence with relative until date', () => {
  const input = 'workout at 7am for 45 mins every day till next friday';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'workout');
  assert.equal(result.extracted.startTime, '07:00');
  assert.equal(result.extracted.endTime, '07:45');
  assert.equal(result.extracted.durationMinutes, 45);
  assert.equal(result.extracted.recurrence, 'daily');
  assert.ok(result.extracted.recurrenceEndDate);
  assert.deepEqual(result.extracted.areas, ['Health & Vitality']);
  assert.equal(result.hasDetected, true);
});

test('parseNaturalTask handles weekend recurrence with time window', () => {
  const input = 'repeat study session 14:00 - 16:00 every weekend until end of year';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'study session');
  assert.equal(result.extracted.startTime, '14:00');
  assert.equal(result.extracted.endTime, '16:00');
  assert.equal(result.extracted.durationMinutes, 120);
  assert.equal(result.extracted.recurrence, 'custom');
  assert.deepEqual(result.extracted.repeatDays, [0, 6]); // Sunday = 0, Saturday = 6
  assert.equal(result.extracted.recurrenceEndDate, '2026-12-31');
  assert.equal(result.hasDetected, true);
});

test('parseNaturalTask handles mwf shortcut with numeric duration', () => {
  const input = 'repeat piano practice at 5pm fot 45 duration repeat every mwf till dec 15';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'piano practice');
  assert.equal(result.extracted.startTime, '17:00');
  assert.equal(result.extracted.endTime, '17:45');
  assert.equal(result.extracted.durationMinutes, 45);
  assert.equal(result.extracted.recurrence, 'custom');
  assert.deepEqual(result.extracted.repeatDays, [1, 3, 5]); // Mon, Wed, Fri
  assert.equal(result.extracted.recurrenceEndDate, '2026-12-15');
  assert.equal(result.hasDetected, true);
});

test('isTaskScheduledForDate respects recurrenceEndDate inclusiveness', () => {
  const task = {
    id: 'test-sched-1',
    title: 'Deep Work',
    plannedDate: '2026-11-01',
    recurrence: 'custom',
    repeatDays: [1, 2, 3, 4, 5], // weekdays
    recurrenceEndDate: '2026-11-30', // inclusive end date
    recurrenceUntil: '2026-12-01'     // exclusive cutoff
  };

  // 2026-11-30 is a Monday (day 1) -> should be SCHEDULED
  assert.equal(isTaskScheduledForDate(task, '2026-11-30'), true, 'Nov 30 (inclusive end date) must be scheduled');

  // 2026-12-01 is a Tuesday (day 2) -> past recurrenceEndDate -> should NOT be scheduled
  assert.equal(isTaskScheduledForDate(task, '2026-12-01'), false, 'Dec 01 (after recurrence end date) must not be scheduled');

  // 2026-11-29 is a Sunday (day 0) -> weekend -> should NOT be scheduled
  assert.equal(isTaskScheduledForDate(task, '2026-11-29'), false, 'Sunday is not in repeatDays');

  // 2026-11-27 is a Friday (day 5) -> weekday -> should be SCHEDULED
  assert.equal(isTaskScheduledForDate(task, '2026-11-27'), true, 'Nov 27 is a weekday within series');
});

test('parseNaturalTask handles user verbatim pattern "repeat xyz at abc time fot 1234 duration repeat every qwe till 890 date"', () => {
  const input = 'repeat algorithmic trading at 9am fot 120 duration repeat every weekday till nov 30';
  const result = parseNaturalTask(input, mockGoals);

  assert.equal(result.cleanTitle, 'algorithmic trading');
  assert.equal(result.extracted.startTime, '09:00');
  assert.equal(result.extracted.endTime, '11:00');
  assert.equal(result.extracted.durationMinutes, 120);
  assert.equal(result.extracted.recurrence, 'custom');
  assert.deepEqual(result.extracted.repeatDays, [1, 2, 3, 4, 5]);
  assert.equal(result.extracted.recurrenceEndDate, '2026-11-30');
  assert.equal(result.extracted.recurrenceUntil, '2026-12-01');
  assert.equal(result.hasDetected, true);
});

