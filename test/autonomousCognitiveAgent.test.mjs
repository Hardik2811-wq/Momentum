import test from 'node:test';
import assert from 'node:assert/strict';

import { classifySemanticEssence } from '../src/lib/autonomousSemanticOntology.js';
import { assembleAutonomousContext } from '../src/lib/autonomousContext.js';
import { runCognitiveAutonomousAudit } from '../src/lib/autonomousCognitiveReasoner.js';
import {
  getAgentState,
  saveAgentState,
  executeAutonomousRun,
  applyProposal,
  undoAuditAction
} from '../src/lib/autonomousAgentEngine.js';

// Setup Mock LocalStorage for Node.js test environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

test('1. Semantic Ontology - Accurate classification of human reality and modalities', () => {
  const gym = classifySemanticEssence('Heavy Leg Day Squats & Deadlifts', 'health');
  assert.equal(gym.modality, 'PHYSICAL_EXHAUSTION');
  assert.equal(gym.depletionType, 'SOMATIC');
  assert.equal(gym.requiresPostBufferMinutes, 45);

  const coding = classifySemanticEssence('Build MERN React State Architecture', 'career');
  assert.equal(gym.modality !== coding.modality, true);
  assert.equal(coding.modality, 'DEEP_CREATION');
  assert.equal(coding.depletionType, 'COGNITIVE');

  const taxes = classifySemanticEssence('File Tax Invoices & Bank Receipts', 'admin');
  assert.equal(taxes.modality, 'ADMINISTRATIVE_FRICTION');
  assert.equal(taxes.depletionType, 'WILLPOWER');
});

test('2. Somatic-Cognitive Clash Detection in Context Gathering', () => {
  const mockStore = {
    tasks: [
      {
        id: 't1',
        title: 'Heavy Leg Day Workout',
        category: 'health',
        startTime: '08:00',
        endTime: '09:00',
        durationMinutes: 60,
        completed: true,
        plannedDate: '2026-10-17'
      },
      {
        id: 't2',
        title: 'MERN Algorithm Architecture',
        category: 'career',
        startTime: '09:05', // Clashes: only 5m gap after intense leg day!
        endTime: '10:35',
        durationMinutes: 90,
        completed: false,
        plannedDate: '2026-10-17'
      }
    ],
    goals: [
      { id: 'g1', title: 'Ship Production SaaS', targetDate: '2026-11-01', keyResults: 3, progress: 40 }
    ],
    habits: [
      { id: 'h1', title: 'Daily Classical Guitar', streak: 12, completedDays: [] }
    ],
    schedules: [],
    focusSessions: [],
    settings: { todayDateKey: '2026-10-17' }
  };

  const context = assembleAutonomousContext(mockStore);
  assert.equal(context.energyClashes.length > 0, true, 'Should detect somatic-cognitive clash');
  const clash = context.energyClashes[0];
  assert.equal(clash.type, 'SOMATIC_COGNITIVE_CLASH');
  assert.equal(clash.requiredBufferMinutes, 45);
});

test('3. Cognitive Audit & 4-Perspective Benefit Attribution', () => {
  const mockStore = {
    tasks: [
      {
        id: 't1',
        title: 'Morning Gym Cardio',
        startTime: '08:00',
        endTime: '09:00',
        durationMinutes: 60,
        completed: true,
        plannedDate: '2026-10-17'
      },
      {
        id: 't2',
        title: 'Deep Creative Coding Sprint',
        startTime: '09:00',
        endTime: '10:30',
        durationMinutes: 90,
        completed: false,
        plannedDate: '2026-10-17'
      }
    ],
    goals: [],
    habits: [
      { id: 'h1', title: 'Evening Reading', streak: 15, completedDays: [] }
    ],
    schedules: [],
    focusSessions: []
  };

  const context = assembleAutonomousContext(mockStore);
  const audit = runCognitiveAutonomousAudit(context);

  assert.equal(audit.proposals.length > 0, true);
  const clashProp = audit.proposals.find(p => p.type === 'RESOLVE_ENERGY_CLASH');
  assert.ok(clashProp, 'Must have energy clash proposal');
  assert.ok(clashProp.pointers.cognitive, 'Must have cognitive benefit pointer');
  assert.ok(clashProp.pointers.biological, 'Must have biological benefit pointer');
  assert.ok(clashProp.pointers.strategic, 'Must have strategic benefit pointer');
  assert.ok(clashProp.pointers.habit, 'Must have habit benefit pointer');

  // Check harmonized flow
  assert.equal(audit.harmonizedFlow.length, 2);
  const shifted = audit.harmonizedFlow.find(i => i.id === 't2');
  assert.ok(shifted.isOptimized, 'Item should be marked optimized in harmonized flow');
  assert.equal(shifted.startTime, '09:45', 'Should be shifted after 45m buffer');
});

test('4. Proactive Approval & 1-Tap Undo Symmetry', () => {
  mockStorage.clear();

  let updatedTaskData = null;
  const mockStore = {
    tasks: [
      {
        id: 't1',
        title: 'Morning Heavy Gym',
        startTime: '08:00',
        endTime: '09:00',
        dueDate: 'Today',
        completed: true
      },
      {
        id: 't2',
        title: 'Deep Coding Architecture',
        startTime: '09:00',
        endTime: '10:30',
        dueDate: 'Today',
        completed: false
      }
    ],
    goals: [],
    habits: [],
    schedules: [],
    focusSessions: [],
    updateTask: (id, patch) => {
      updatedTaskData = { id, patch };
    }
  };

  // Run in PROACTIVE_APPROVAL mode
  saveAgentState({
    enabled: true,
    mode: 'PROACTIVE_APPROVAL',
    pendingProposals: [],
    auditLog: [],
    soundEffects: false,
    notificationsEnabled: false
  });

  const res = executeAutonomousRun(mockStore);
  assert.equal(res.appliedCount, 0, 'No actions auto-applied in approval mode');
  assert.equal(res.newProposalsCount > 0, true, 'Proposals queued for review');

  const stateBefore = getAgentState();
  const proposal = stateBefore.pendingProposals[0];
  assert.ok(proposal);

  // Apply proposal
  const applied = applyProposal(proposal.id, mockStore);
  assert.equal(applied, true);
  assert.ok(updatedTaskData, 'Store updateTask must be called');
  assert.equal(updatedTaskData.id, 't2');

  const stateAfterApply = getAgentState();
  assert.equal(stateAfterApply.pendingProposals.length, stateBefore.pendingProposals.length - 1);
  const auditEntry = stateAfterApply.auditLog[0];
  assert.equal(auditEntry.status, 'APPLIED');
  assert.ok(auditEntry.revertPatch);

  // Undo action
  const undone = undoAuditAction(auditEntry.id, mockStore);
  assert.equal(undone, true);
  assert.equal(updatedTaskData.patch.startTime, '09:00', 'Original start time reverted');
  const stateAfterUndo = getAgentState();
  assert.equal(stateAfterUndo.auditLog[0].status, 'REVERTED');
});

test('5. Full Autopilot Mode - Background Execution', () => {
  mockStorage.clear();

  let autoAppliedCount = 0;
  const mockStore = {
    tasks: [
      {
        id: 't1',
        title: 'Heavy Leg Day Workout',
        startTime: '08:00',
        endTime: '09:00',
        dueDate: 'Today',
        completed: true
      },
      {
        id: 't2',
        title: 'System Architecture Design',
        startTime: '09:05',
        endTime: '10:35',
        dueDate: 'Today',
        completed: false
      }
    ],
    goals: [],
    habits: [],
    schedules: [],
    focusSessions: [],
    updateTask: () => {
      autoAppliedCount++;
    }
  };

  saveAgentState({
    enabled: true,
    mode: 'FULL_AUTOPILOT',
    pendingProposals: [],
    auditLog: [],
    soundEffects: false,
    notificationsEnabled: false
  });

  const res = executeAutonomousRun(mockStore);
  assert.equal(res.appliedCount > 0, true, 'Must auto-apply in autopilot mode');
  assert.equal(autoAppliedCount > 0, true, 'Store updated directly');

  const state = getAgentState();
  assert.equal(state.auditLog[0].autoApplied, true);
});

test('6. Circadian Energy Curve - Evaluates task alignment and biological dips', async () => {
  const { scoreTaskPlacement } = await import('../src/lib/circadianEnergyModel.js');

  // Deep creation in peak morning window (09:00) -> high score
  const morningFit = scoreTaskPlacement('DEEP_CREATION', '09:00');
  assert.equal(morningFit.aligned, true);
  assert.equal(morningFit.score >= 0.85, true);

  // Deep creation in post-lunch trough (14:00) -> low score
  const afternoonDip = scoreTaskPlacement('DEEP_CREATION', '14:00');
  assert.equal(afternoonDip.aligned, false);
  assert.equal(afternoonDip.score < 0.5, true);
  assert.ok(afternoonDip.penalty);
});

test('7. Cascade Impact Analyzer - Predicts downstream schedule ripple collisions', async () => {
  const { analyzeCascadeImpact } = await import('../src/lib/cascadeImpactAnalyzer.js');

  const timeline = [
    { id: 'task_b', title: 'Client Sprint Demo', startTime: '10:00', endTime: '11:00', durationMinutes: 60 }
  ];

  // Proposal that would shift task A to 10:30 (directly overlapping task B)
  const overlappingProp = {
    targetId: 'task_a',
    type: 'RESCHEDULE_SLIPPED_TASK',
    patch: { startTime: '10:30', endTime: '11:30', durationMinutes: 60 }
  };

  const impact = analyzeCascadeImpact(overlappingProp, timeline, [overlappingProp]);
  assert.equal(impact.directCollisions.length, 1);
  assert.equal(impact.directCollisions[0].itemId, 'task_b');
  assert.equal(impact.directCollisions[0].overlapMinutes, 30);
  assert.equal(impact.netImpact.verdict, 'RISKY');
  assert.equal(impact.safeToAutoApply, false);
});

test('8. Cognitive Load Budget - Flags prefrontal capacity breach and forecasts crash point', async () => {
  const { evaluateCognitiveLoadBudget } = await import('../src/lib/cognitiveLoadBudget.js');

  // 5 hours of deep creation (300 mins) vs default 240 mins ceiling
  const heavyTimeline = [
    { title: 'Code React Core', startTime: '08:00', durationMinutes: 120 },
    { title: 'Architect System API', startTime: '10:30', durationMinutes: 120 },
    { title: 'Write Database Migrations', startTime: '14:00', durationMinutes: 60 }
  ];

  const budget = evaluateCognitiveLoadBudget(heavyTimeline, { deepWorkMinutes: 240 });
  assert.equal(budget.isOverloaded, true);
  assert.equal(budget.overloadVector, 'DEEP_WORK_EXCEEDED');
  assert.equal(budget.deepWork.spent, 300);
  assert.ok(budget.fatigueForecast.estimatedCrashTime);
});

test('9. Confidence and Risk Scorer - Derives multi-factor probability metrics', async () => {
  const { scoreProposalConfidence } = await import('../src/lib/auditConfidenceScorer.js');

  const prop = {
    targetEntity: 'task',
    targetId: 't1',
    type: 'RESCHEDULE_SLIPPED_TASK',
    patch: { startTime: '09:00', endTime: '10:00' }
  };

  const context = {
    tasks: [{ id: 't1', title: 'Deep System Architecture', durationMinutes: 60 }]
  };

  const confidenceData = scoreProposalConfidence({ proposal: prop, context });
  assert.equal(typeof confidenceData.confidence, 'number');
  assert.equal(confidenceData.confidence >= 0.7, true);
  assert.equal(confidenceData.risk.level, 'LOW');
  assert.equal(confidenceData.recommendation, 'STRONG_APPROVE');
});

test('10. 12-Vector Forensic Audit Engine - Compiles structured diagnostic report', () => {
  const mockStore = {
    tasks: [
      { id: 't1', title: 'Morning Gym Cardio', startTime: '08:00', durationMinutes: 60, completed: true },
      { id: 't2', title: 'Deep Code Refactor', startTime: '09:00', durationMinutes: 90, completed: false }
    ],
    goals: [{ id: 'g1', title: 'Build SaaS', progress: 0, targetDate: '2026-12-01' }],
    habits: [{ id: 'h1', title: 'Guitar Practice', streak: 10, completedDays: [] }],
    schedules: [],
    focusSessions: [],
    settings: { todayDateKey: '2026-10-17' }
  };

  const context = assembleAutonomousContext(mockStore);
  const audit = runCognitiveAutonomousAudit(context);

  assert.ok(audit.forensicReport, 'Must contain forensic report');
  assert.equal(audit.forensicReport.vectorAuditDetails.length >= 10, true, 'Must analyze comprehensive vector set');
  assert.ok(audit.forensicReport.narrative, 'Must generate executive diagnosis narrative');
  assert.ok(audit.forensicReport.healthScore !== undefined, 'Must calculate composite harmony score');
});

