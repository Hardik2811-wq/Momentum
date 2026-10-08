import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizeText,
  buildEntityCorpus,
  computeBM25Scores,
  rankEntitiesByContext,
  formatWorkingSessionContext,
  consolidateEpisodicMemory,
  extractAndSaveConstraints,
  getUserConstraints
} from '../src/lib/contextualMemoryEngine.js';

test('tokenizeText strips stopwords and isolates clean terms', () => {
  const tokens = tokenizeText('Prepare the Operating Systems exam presentation with John');
  assert.ok(tokens.includes('prepare'));
  assert.ok(tokens.includes('operating'));
  assert.ok(tokens.includes('systems'));
  assert.ok(tokens.includes('exam'));
  assert.ok(tokens.includes('presentation'));
  assert.ok(tokens.includes('john'));
  // Stopwords stripped
  assert.ok(!tokens.includes('the'));
  assert.ok(!tokens.includes('with'));
});

test('BM25 scoring ranks query-relevant items at top and unrelated items at bottom', () => {
  const tasks = [
    { id: 't1', title: 'Machine Learning lab assignment 3', category: 'College' },
    { id: 't2', title: 'Buy groceries at supermarket', category: 'Personal' },
    { id: 't3', title: 'Deep learning neural network backprop', category: 'College' },
    { id: 't4', title: 'Guitar fingerstyle chords practice', category: 'Creative' }
  ];

  const corpus = buildEntityCorpus({ tasks });
  const scores = computeBM25Scores('machine learning assignment', corpus);

  assert.ok(scores.get('t1') > 0, 't1 must match machine learning assignment');
  assert.ok(scores.get('t3') > 0, 't3 must have partial match on learning');
  assert.strictEqual(scores.get('t2'), undefined, 'Unrelated grocery task must not match query');
  assert.strictEqual(scores.get('t4'), undefined, 'Unrelated guitar task must not match query');
  assert.ok(scores.get('t1') > scores.get('t3'), 'Exact assignment match must outscore partial match');
});

test('rankEntitiesByContext boosts temporal proximity and graph affinity', () => {
  const goals = [
    { id: 'g1', title: 'Semester Exams Ace' }
  ];

  const habits = [
    { id: 'h1', title: 'Daily Coding Practice', streak: 12 }
  ];

  const tasks = [
    { id: 't1', title: 'Operating Systems Review', plannedDate: '2026-10-08', startTime: '15:00', goalId: 'g1' },
    { id: 't2', title: 'Far away task next month', plannedDate: '2026-11-20', startTime: '10:00' },
    { id: 't3', title: 'Unrelated gardening', plannedDate: '2026-10-08', startTime: '15:30' }
  ];

  const ranked = rankEntitiesByContext({
    query: 'operating systems exam',
    tasks,
    goals,
    habits,
    todayDate: '2026-10-08',
    currentTime: '14:45'
  });

  // t1 is BM25 match + scheduled today within 15 minutes of currentTime -> highest rank
  assert.strictEqual(ranked[0].id, 't1');
  assert.ok(ranked[0].totalScore > 4.0);

  // g1 has graph affinity from t1 matching query -> boosted
  const goalEntry = ranked.find(r => r.id === 'g1');
  assert.ok(goalEntry.totalScore > 1.5, 'Parent goal must receive graph affinity boost');
});

test('formatWorkingSessionContext produces dense date-time context with minimal tokens', () => {
  const result = formatWorkingSessionContext({
    todayDate: '2026-10-08',
    currentTime: '15:15',
    activeTimer: { isRunning: true, title: 'Deep Work Lab', remainingMinutes: 32 },
    activeView: 'planner',
    timezone: 'Asia/Kolkata'
  });

  assert.ok(result.includes('2026-10-08 15:15'));
  assert.ok(result.includes('afternoon'));
  assert.ok(result.includes('TZ: Asia/Kolkata'));
  assert.ok(result.includes('VIEW: planner'));
  assert.ok(result.includes('ACTIVE_FOCUS: "Deep Work Lab" (32m left)'));

  // Length must remain ultra-dense (< 150 chars, ~25 tokens)
  assert.ok(result.length < 150);
});

test('consolidateEpisodicMemory retains prior agreements across long chats', () => {
  const longHistory = [
    { role: 'user', content: 'I am preparing for GATE exam and cannot study after 8pm' },
    { role: 'assistant', content: 'Understood.', plan: { summary: 'GATE 4-week prep' } },
    { role: 'user', content: 'Turn 3 question' },
    { role: 'assistant', content: 'Turn 3 reply' },
    { role: 'user', content: 'Turn 4 question' },
    { role: 'assistant', content: 'Turn 4 reply' },
    { role: 'user', content: 'Turn 5 question' },
    { role: 'assistant', content: 'Turn 5 reply' },
    { role: 'user', content: 'Turn 6 question' },
    { role: 'assistant', content: 'Turn 6 reply' },
    { role: 'user', content: 'Latest turn question' }
  ];

  const { recentMessages, consolidatedBrief } = consolidateEpisodicMemory(longHistory);

  assert.strictEqual(recentMessages.length, 6, 'Must keep exactly the last 6 messages verbatim');
  assert.ok(consolidatedBrief.includes('EPISODIC_SUMMARY'));
  assert.ok(consolidatedBrief.includes('GATE exam and cannot study after 8pm'), 'Old user rule must be preserved in consolidated summary');
  assert.ok(consolidatedBrief.includes('GATE 4-week prep'), 'Old plan headline must be preserved');
});

test('extractAndSaveConstraints extracts personal rules into persistent store', () => {
  // Mock localStorage
  globalThis.__mockLocalStorage = {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = String(v); }
  };

  extractAndSaveConstraints("Please note I want no study after 9pm and I prefer 90m focus blocks");
  const constraints = getUserConstraints();

  assert.ok(constraints.some(c => c.includes('No study/work after 9pm')));
  assert.ok(constraints.some(c => c.includes('Prefers 90-minute focus blocks')));
});
