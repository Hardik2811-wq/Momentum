import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeDenseMemory } from '../src/lib/groqClient.js';

test('serializeDenseMemory compacts goals, habits, schedule, and analytics', () => {
  const mockGoals = [
    { id: 'g1', title: 'Launch Momentum v3', targetDate: '2026-10-15', progress: 45 },
    { id: 'g2', title: 'Half Marathon', targetDate: '2026-12-01', progress: 20 }
  ];

  const mockHabits = [
    { id: 'h1', title: 'Morning Run', streak: 14, cadence: 'Morning', linkedGoal: 'Half Marathon' },
    { id: 'h2', title: 'Deep Work Block', streak: 5, cadence: 'Afternoon' }
  ];

  const mockTasks = [
    { id: 1, title: 'Refactor Auth', plannedDate: '2026-09-27', startTime: '09:00', durationMinutes: 45, goalId: 'g1', completed: false },
    { id: 2, title: 'Gym workout', plannedDate: '2026-09-27', startTime: '18:00', durationMinutes: 60, linkedHabitId: 'h1', completed: true },
    { id: 3, title: 'Distant task next year', plannedDate: '2027-05-01', completed: false }
  ];

  const mockStats = {
    completionRate: 85,
    longestStreak: 14,
    habitsCompletedToday: 2,
    totalHabits: 3,
    completedFocusMinutes: 90,
    momentumScore: 82,
    pending: 4
  };

  const dense = serializeDenseMemory({
    goals: mockGoals,
    habits: mockHabits,
    tasks: mockTasks,
    stats: mockStats,
    todayDate: '2026-09-27'
  });

  // Verify memory structure
  assert.ok(dense.includes('GOALS:'));
  assert.ok(dense.includes('[g:g1|"Launch Momentum v3"|due:2026-10-15|prog:45%]'));
  assert.ok(dense.includes('HABITS:'));
  assert.ok(dense.includes('[h:h1|"Morning Run"|streak:14d|cadence:Morning|goal:"Half Marathon"]'));
  assert.ok(dense.includes('SCHEDULE (Active Horizon):'));
  assert.ok(dense.includes('[t:1|"Refactor Auth"|2026-09-27 09:00|45m|g:g1|open]'));
  assert.ok(dense.includes('[t:2|"Gym workout"|2026-09-27 18:00|60m|h:h1|done]'));
  // Distant task must be filtered out
  assert.ok(!dense.includes('Distant task next year'));

  // Verify analytics digest
  assert.ok(dense.includes('ANALYTICS: compRate:85%'));
  assert.ok(dense.includes('streak:14d'));
  assert.ok(dense.includes('habitsToday:2/3'));
  assert.ok(dense.includes('focusToday:90m'));
});

test('serializeDenseMemory cuts payload characters by over 70% compared to raw JSON', () => {
  const mockGoals = Array.from({ length: 5 }, (_, i) => ({
    id: `g${i}`,
    title: `Quarterly Milestone Horizon ${i + 1}`,
    targetDate: '2026-10-15',
    progress: 35,
    category: 'career',
    description: 'Detailed roadmap notes and strategic motivation for achievement.',
    linkedHabitIds: ['h1', 'h2']
  }));

  const mockHabits = Array.from({ length: 5 }, (_, i) => ({
    id: `h${i}`,
    title: `Daily Habit Formation Ritual ${i + 1}`,
    streak: 10 + i,
    cadence: 'Morning',
    targetFrequency: 'Every Day',
    linkedGoal: 'Quarterly Milestone Horizon 1',
    completedDays: ['2026-09-25', '2026-09-26', '2026-09-27']
  }));

  const mockTasks = Array.from({ length: 15 }, (_, i) => ({
    id: 100 + i,
    title: `Deliverable task item execution spec ${i + 1}`,
    plannedDate: '2026-09-28',
    startTime: '10:00',
    durationMinutes: 45,
    goalId: 'g0',
    linkedHabitId: 'h0',
    impact: 'high',
    priority: 'normal',
    areas: ['Career & Craft', 'Deep Focus'],
    completed: i % 2 === 0,
    subtasks: [
      { id: `s${i}_1`, title: 'Verify specs', completed: true },
      { id: `s${i}_2`, title: 'Run verification tests', completed: false }
    ],
    notes: 'Extended descriptive commentary about operational deployment.'
  }));

  const mockStats = {
    completionRate: 80,
    longestStreak: 12,
    habitsCompletedToday: 3,
    totalHabits: 5,
    completedFocusMinutes: 120,
    momentumScore: 78,
    pending: 8
  };

  const rawJsonSize = JSON.stringify({
    goals: mockGoals,
    habits: mockHabits,
    tasks: mockTasks,
    stats: mockStats
  }).length;

  const dense = serializeDenseMemory({
    goals: mockGoals,
    habits: mockHabits,
    tasks: mockTasks,
    stats: mockStats,
    todayDate: '2026-09-27'
  });

  const denseSize = dense.length;
  const reductionPercent = ((rawJsonSize - denseSize) / rawJsonSize) * 100;

  // Assert reduction is at least 70%
  assert.ok(reductionPercent >= 70, `Expected >= 70% reduction, got ${reductionPercent.toFixed(1)}%`);
});
