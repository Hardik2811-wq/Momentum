import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocalCopilotIntent } from '../src/lib/copilotIntentRouter.js';
import {
  normalizeCopilotPlan,
  detectAiProvider,
  generateMcpBridgeToken,
  buildExternalChatBridgePrompt,
  parseExternalChatPlanResponse
} from '../src/lib/groqClient.js';
import { harvestCopilotPlan, getNlpMemory, resetNlpMemory } from '../src/lib/nlpMemory.js';

test('resolveLocalCopilotIntent handles schedule task offline with 0 API tokens', () => {
  let addedTask = null;
  const actions = {
    addTask: (task) => { addedTask = task; }
  };

  const res = resolveLocalCopilotIntent({
    query: 'Schedule task Review PR tomorrow 14:00 45m',
    tasks: [],
    todayDate: '2026-09-27',
    actions
  });

  assert.equal(res.handledLocally, true);
  assert.ok(res.message.includes('Review PR'));
  assert.ok(addedTask !== null);
  assert.equal(addedTask.title, 'Review PR');
  assert.equal(addedTask.startTime, '14:00');
  assert.equal(addedTask.duration, 45);
});

test('resolveLocalCopilotIntent marks task complete offline', () => {
  let toggledId = null;
  const mockTasks = [
    { id: 42, title: 'Deploy production build', completed: false }
  ];
  const actions = {
    toggleTask: (id) => { toggledId = id; }
  };

  const res = resolveLocalCopilotIntent({
    query: 'Mark task Deploy production build as done',
    tasks: mockTasks,
    actions
  });

  assert.equal(res.handledLocally, true);
  assert.equal(toggledId, 42);
  assert.ok(res.message.includes('Deploy production build'));
});

test('resolveLocalCopilotIntent checks in habit offline', () => {
  let checkedHabitId = null;
  const mockHabits = [
    { id: 'h1', title: 'Morning Cardio', streak: 7 }
  ];
  const actions = {
    checkInHabit: (id) => { checkedHabitId = id; }
  };

  const res = resolveLocalCopilotIntent({
    query: 'Check in habit Morning Cardio',
    habits: mockHabits,
    actions
  });

  assert.equal(res.handledLocally, true);
  assert.equal(checkedHabitId, 'h1');
  assert.ok(res.message.includes('Morning Cardio'));
  assert.ok(res.message.includes('8 days'));
});

test('resolveLocalCopilotIntent answers today schedule query offline', () => {
  const mockTasks = [
    { id: 1, title: 'Standup', plannedDate: '2026-09-27', startTime: '10:00', durationMinutes: 15, completed: true },
    { id: 2, title: 'Client Demo', plannedDate: '2026-09-27', startTime: '15:00', durationMinutes: 45, completed: false }
  ];

  const res = resolveLocalCopilotIntent({
    query: 'What do I have today?',
    tasks: mockTasks,
    todayDate: '2026-09-27'
  });

  assert.equal(res.handledLocally, true);
  assert.ok(res.message.includes('Standup'));
  assert.ok(res.message.includes('Client Demo'));
});

test('resolveLocalCopilotIntent delegates complex generative questions to API', () => {
  const res = resolveLocalCopilotIntent({
    query: 'Help me brainstorm a 6-month career transition plan into AI safety',
    tasks: []
  });

  assert.equal(res.handledLocally, false);
});

test('normalizeCopilotPlan inflates compact delta tuples into full store models', () => {
  const rawCompactResponse = {
    message: 'Formulated plan',
    hasPlan: true,
    plan: {
      summary: 'Q4 Sprint',
      goals: [
        ['Ship iOS Beta', 'career', 'Strategic MVP milestone', '2026-11-01']
      ],
      habits: [
        ['Morning Code Sprint', 'Morning', 'Every Day', '45 mins', 0]
      ],
      tasks: [
        ['Setup Xcode project', '2026-09-28', '09:00', 60, 0, null, 'high'],
        ['Review Swift API', '2026-09-28', '11:00', 30, 'existing-g1', 'existing-h1', 'normal']
      ]
    }
  };

  const normalized = normalizeCopilotPlan(rawCompactResponse, '2026-09-27');
  const plan = normalized.plan;

  // Verify goal inflated
  assert.equal(plan.goals[0].title, 'Ship iOS Beta');
  assert.equal(plan.goals[0].targetDate, '2026-11-01');

  // Verify habit inflated
  assert.equal(plan.habits[0].title, 'Morning Code Sprint');
  assert.equal(plan.habits[0].goalIndex, 0);

  // Verify tasks inflated
  assert.equal(plan.tasks[0].title, 'Setup Xcode project');
  assert.equal(plan.tasks[0].durationMinutes, 60);
  assert.equal(plan.tasks[0].goalIndex, 0);
  assert.equal(plan.tasks[0].priority, 'high');

  assert.equal(plan.tasks[1].title, 'Review Swift API');
  assert.equal(plan.tasks[1].existingGoalId, 'existing-g1');
  assert.equal(plan.tasks[1].existingHabitId, 'existing-h1');
});

test('harvestCopilotPlan teaches local memory verbs from approved AI plans', () => {
  resetNlpMemory();

  const plan = {
    tasks: [
      { title: 'Benchmark distributed SQLite clusters', areas: ['Career & Craft', 'Deep Focus'], durationMinutes: 90, impact: 'high' }
    ],
    habits: [
      { title: 'Hydrate electrolytes daily' }
    ]
  };

  const result = harvestCopilotPlan(plan);
  assert.ok(result.learnedCount >= 1);

  const memory = getNlpMemory();
  assert.ok(Boolean(memory.learnedVerbs['benchmark']));
});

test('Multi-Provider AI & Claude/ChatGPT MCP Bridge helpers validate keys, tokens, and <think>-wrapped JSON plans', async () => {
  assert.equal(detectAiProvider('AIzaSyA12345678901234567890123456789'), 'gemini');
  assert.equal(detectAiProvider('gsk_12345678901234567890123456'), 'groq');
  assert.equal(detectAiProvider('sk-or-v1-12345678901234567890123456'), 'openrouter');
  assert.equal(detectAiProvider('invalid_key'), null);

  const bridgeInfo = await generateMcpBridgeToken('user-999');
  assert.ok(bridgeInfo.token.startsWith('mom_user-999_'));
  assert.equal(bridgeInfo.tokenHash.length, 64);
  assert.ok(bridgeInfo.mcpUrl.includes('/functions/v1/momentum-mcp?token=mom_user-999_'));
  assert.ok(bridgeInfo.openApiUrl.includes('/functions/v1/momentum-mcp/openapi.json?token=mom_user-999_'));

  const prompt = buildExternalChatBridgePrompt({
    userPrompt: 'Schedule CN and CML labs',
    todayDate: '2026-10-13'
  });
  assert.ok(prompt.includes('MOMENTUM OS'));
  assert.ok(prompt.includes('Schedule CN and CML labs'));

  const rawClaudeOrQwenReply = `<think>Let me calculate the best non-overlapping time slots...</think>
Here is your plan:
\`\`\`json
{
  "summary": "CN & CML Sprint",
  "tasks": [
    {
      "title": "CN Socket Programming Lab",
      "plannedDate": "2026-10-14",
      "startTime": "10:00",
      "durationMinutes": 90,
      "impact": "high"
    }
  ]
}
\`\`\``;

  const parsed = parseExternalChatPlanResponse(rawClaudeOrQwenReply, '2026-10-13');
  assert.equal(parsed.hasPlan, true);
  assert.equal(parsed.plan.tasks.length, 1);
  assert.equal(parsed.plan.tasks[0].title, 'CN Socket Programming Lab');
  assert.equal(parsed.plan.tasks[0].durationMinutes, 90);
});

