import test from 'node:test';
import assert from 'node:assert/strict';

import {
  curatePromptIngress,
  enforceCavemanSystemPrompt,
  sanitizeCavemanEgress
} from '../src/lib/cavemanCompressor.js';

import {
  calculateTransitionBuffer,
  computeCollisionRisk,
  detectScheduleCollisions,
  findOptimalTimeGap,
  timeToMinutes,
  minutesToTime
} from '../src/lib/scheduleCollisionGuard.js';

import {
  computeHabitDecayMetrics,
  getHabitsAtRisk
} from '../src/lib/habitDecayGuard.js';

import {
  evaluateCapacityLoad
} from '../src/lib/capacityOverloadGuard.js';

import {
  buildLifeGraph
} from '../src/lib/lifeGraph.js';

test('Passive Caveman Engine: curates conversational fluff into dense payload', () => {
  const verboseInput = 'Hey could you please help me to schedule task: Study Quantum Mechanics tomorrow at 10:00 90m for me if you do not mind? Thank you so much!';
  const result = curatePromptIngress(verboseInput);

  assert.ok(result.curatedChars < result.originalChars, 'Curated length should be strictly less than original');
  assert.ok(result.curatedPrompt.includes('Study Quantum Mechanics'), 'Must preserve semantic task title');
  assert.ok(result.curatedPrompt.includes('10:00'), 'Must preserve time expression');
  assert.ok(!result.curatedPrompt.toLowerCase().includes('thank you so much'), 'Must strip polite thank-you filler');
  assert.ok(!result.curatedPrompt.toLowerCase().startsWith('hey could you please'), 'Must strip leading greeting boilerplate');
});

test('Passive Caveman Engine: enforceCavemanSystemPrompt appends zero-fluff directive', () => {
  const base = 'You are a planner.';
  const system = enforceCavemanSystemPrompt(base);
  assert.ok(system.includes('STRICT CAVEMAN EFFICIENCY PROTOCOL'));
  assert.ok(system.includes('BAN ALL CONVERSATIONAL GREETINGS'));
});

test('Passive Caveman Engine: sanitizeCavemanEgress strips code fences and conversational wrappers', () => {
  const markdownWrapped = '```json\n{"message": "Done", "hasPlan": true}\n```';
  const clean = sanitizeCavemanEgress(markdownWrapped);
  assert.equal(clean, '{"message": "Done", "hasPlan": true}');

  const chatWrapped = 'Sure! Here is your plan:\n{"title": "Workout"}\nHope this helps!';
  const clean2 = sanitizeCavemanEgress(chatWrapped);
  assert.equal(clean2, '{"title": "Workout"}');
});

test('Schedule Collision Guard: calculates transition buffer with modality and effort dilation', () => {
  const deskTask = { title: 'Code Review', areas: ['Career & Craft'], energy: 'Low', effort: 'low' };
  const gymTask = { title: 'Heavy Deadlifts', areas: ['Health & Vitality'], energy: 'High', effort: 'high' };

  // Desk to Desk
  const bufDesk = calculateTransitionBuffer(deskTask, deskTask);
  assert.equal(bufDesk, 5, 'Base buffer for same modality is 5 min');

  // Gym to Desk (modality switch + heavy effort dilation)
  const bufGym = calculateTransitionBuffer(gymTask, deskTask);
  assert.ok(bufGym >= 35, 'Modality shift + high effort must require >= 35 min buffer');
});

test('Schedule Collision Guard: detects direct overlap as hard collision (R >= 0.75)', () => {
  const candidate = { title: 'Task B', startTime: '10:00', durationMinutes: 60 };
  const existing = { title: 'Class A', startTime: '10:30', durationMinutes: 60 };

  const risk = computeCollisionRisk(candidate, existing);
  assert.equal(risk.level, 'hard');
  assert.ok(risk.riskScore >= 0.75);
  assert.equal(risk.overlapMins, 30);
});

test('Schedule Collision Guard: detects transition buffer squeeze as soft collision', () => {
  const existing = { title: 'Intense Gym Workout', startTime: '09:00', durationMinutes: 60, energy: 'High', effort: 'high', areas: ['Health & Vitality'] };
  const candidate = { title: 'Deep Work Coding', startTime: '10:10', durationMinutes: 60, areas: ['Deep Focus'] }; // only 10m gap, needs 35m+

  const risk = computeCollisionRisk(candidate, existing);
  assert.equal(risk.level, 'soft');
  assert.ok(risk.riskScore >= 0.35 && risk.riskScore < 0.75);
  assert.ok(risk.gapDeficit > 0);
});

test('Schedule Collision Guard: detects collision against fixed schedule and recommends optimal gap', () => {
  const candidate = { id: 'cand-1', title: 'Study', startTime: '09:30', durationMinutes: 60 };
  const schedules = [{ id: 'sched-1', title: 'Physics Lecture', startTime: '09:00', durationMinutes: 90, plannedDate: '2026-10-08' }];
  const tasks = [];

  const evalRes = detectScheduleCollisions({ candidate, tasks, schedules, date: '2026-10-08' });
  assert.equal(evalRes.hasCollision, true);
  assert.equal(evalRes.riskLevel, 'hard');

  const optimal = findOptimalTimeGap({ candidate, tasks, schedules, date: '2026-10-08', workDayStart: '08:00', workDayEnd: '14:00' });
  assert.ok(optimal.suggestedTime, 'Should find suggested gap');
  assert.notEqual(optimal.suggestedTime, '09:30', 'Suggested time must not collide with lecture');
});

test('Habit Decay Guard: Lindy-modulated exponential decay predicts higher retention for mature habits', () => {
  const youngHabit = {
    id: 'h-young',
    title: 'Guitar',
    duration: '60 mins',
    completedDays: ['2026-10-05'] // 1 completion, 2 days ago
  };

  const matureHabit = {
    id: 'h-mature',
    title: 'Meditation',
    duration: '20 mins',
    completedDays: [
      '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05',
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
      '2026-10-05' // 2 days ago
    ]
  };

  const youngMetrics = computeHabitDecayMetrics(youngHabit, '2026-10-07');
  const matureMetrics = computeHabitDecayMetrics(matureHabit, '2026-10-07');

  assert.ok(youngMetrics.lambda > matureMetrics.lambda, 'Young high-effort habit must decay with larger lambda than mature habit');
  assert.ok(matureMetrics.survivalProb > youngMetrics.survivalProb, 'Mature habit must retain higher survival probability');
  assert.ok(youngMetrics.mvrSuggestion, 'Must provide 2-min MVR suggestion');
});

test('Capacity Overload Guard: flags high cognitive entropy and Kingman saturation', () => {
  const tasks = [
    { id: 1, title: 'Deep Work A', startTime: '09:00', durationMinutes: 120, energy: 'High', impact: 'high', plannedDate: '2026-10-08', areas: ['Deep Focus'] },
    { id: 2, title: 'Meeting 1', startTime: '11:15', durationMinutes: 60, energy: 'Medium', plannedDate: '2026-10-08', areas: ['Career & Craft'] },
    { id: 3, title: 'Heavy Gym', startTime: '13:00', durationMinutes: 90, energy: 'High', plannedDate: '2026-10-08', areas: ['Health & Vitality'] },
    { id: 4, title: 'Exam Prep', startTime: '15:00', durationMinutes: 180, energy: 'High', impact: 'high', plannedDate: '2026-10-08', areas: ['Deep Focus'] },
    { id: 5, title: 'Guitar Practice', startTime: '19:00', durationMinutes: 60, energy: 'Low', plannedDate: '2026-10-08', areas: ['Creative & Expression'] }
  ];

  const result = evaluateCapacityLoad({ tasks, schedules: [], date: '2026-10-08', dailyTargetHours: 6.0 });
  assert.ok(result.rawHours >= 8.0, 'Raw scheduled hours must exceed 8h');
  assert.ok(result.effectiveHours > result.rawHours, 'Effective cognitive hours must amplify due to context switches and circadian dip');
  assert.equal(result.isOverloaded, true);
  assert.ok(result.status === 'overload' || result.status === 'burnout');
});

test('Life Graph DAG Engine: detects dependency cycles and topological execution order', () => {
  const tasks = [
    { id: 't1', title: 'Task 1: Research', dependsOn: [] },
    { id: 't2', title: 'Task 2: Design', dependsOn: ['t1'] },
    { id: 't3', title: 'Task 3: Code', dependsOn: ['t2'] }
  ];
  const goals = [{ id: 'g1', title: 'Ship App' }];

  const graph = buildLifeGraph({ tasks, goals });
  assert.equal(graph.hasCycles(), false, 'Linear pipeline has no cycles');

  const topo = graph.getTopologicalOrder();
  assert.equal(topo[0].id, 't:t1');
  assert.equal(topo[1].id, 't:t2');
  assert.equal(topo[2].id, 't:t3');

  // Test cycle detection
  const cyclicTasks = [
    { id: 'ca', title: 'A', dependsOn: ['cb'] },
    { id: 'cb', title: 'B', dependsOn: ['ca'] }
  ];
  const cyclicGraph = buildLifeGraph({ tasks: cyclicTasks });
  assert.equal(cyclicGraph.hasCycles(), true, 'Cyclic dependency must be detected');
});
