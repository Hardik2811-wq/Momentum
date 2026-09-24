import assert from 'node:assert';
import { parseNaturalTask } from '../src/lib/nlpParser.js';
import { harvestApiResult, getNlpMemory, resetNlpMemory } from '../src/lib/nlpMemory.js';

console.log('--- Testing Self-Improving NLP Active Learning Engine ---');

// Reset memory for clean test run
resetNlpMemory();

// 1. Test Seed Vocabulary
console.log('Test 1: Built-in seed verb inference (offline 0ms)...');
const task1 = parseNaturalTask('Code authentication service tomorrow at 2pm');
assert.deepStrictEqual(task1.extracted.areas, ['Career & Craft', 'Deep Focus']);
assert.strictEqual(task1.extracted.energy, 'High');
assert.strictEqual(task1.extracted.startTime, '14:00');
assert.strictEqual(task1.extracted.dueDate, 'Tomorrow');
assert.strictEqual(task1.isFromLearnedMemory, true);
console.log('✓ Seed verb test passed:', task1.extracted);

// 2. Test Conversational Time (e.g. before lunch)
console.log('Test 2: Conversational time phrasing...');
const task2 = parseNaturalTask('Call Sarah before lunch for 30m');
assert.deepStrictEqual(task2.extracted.areas, ['Career & Craft']);
assert.strictEqual(task2.extracted.startTime, '11:30');
assert.strictEqual(task2.extracted.durationMinutes, 30);
console.log('✓ Conversational time test passed:', task2.extracted);

// 3. Test Novel Phrase Before Learning
console.log('Test 3: Novel phrase before learning...');
const novelInput = 'Prepare quarterly balance sheet statement';
const beforeLearn = parseNaturalTask(novelInput);
// Areas should be undefined because "balance" or "sheet" is not in default seed
assert.strictEqual(beforeLearn.extracted.areas, undefined);
console.log('✓ Before learning: areas undefined as expected');

// 4. Simulate API Harvest (Active Learning)
console.log('Test 4: Simulating Groq API return and harvesting into local memory...');
const simulatedApiResponse = {
  cleanTitle: 'Prepare quarterly balance sheet',
  dueDate: 'This Week',
  urgency: 'week',
  durationMinutes: 90,
  areas: ['Career & Craft', 'Deep Focus'],
  energy: 'High',
  impact: 'high',
  priority: 'high'
};

const harvestResult = harvestApiResult(novelInput, simulatedApiResponse);
assert.strictEqual(harvestResult.newlyLearned, true);
console.log('✓ Harvested API result into local memory:', harvestResult);

// 5. Test Novel Phrase After Learning (Zero API Call!)
console.log('Test 5: Testing local parser on newly learned phrase...');
const afterLearn = parseNaturalTask('Need to prepare quarterly balance sheet statement');
assert.deepStrictEqual(afterLearn.extracted.areas, ['Career & Craft', 'Deep Focus']);
assert.strictEqual(afterLearn.extracted.energy, 'High');
assert.strictEqual(afterLearn.isFromLearnedMemory, true);
console.log('✓ Successfully recognized locally after learning:', afterLearn.extracted);

// 6. Test Metric Tracking
const memory = getNlpMemory();
assert.ok(memory.metrics.apiHits >= 1);
assert.ok(memory.metrics.learnedCount >= 16);
console.log('✓ Learning metrics updated successfully:', memory.metrics);

console.log('All Active Learning tests passed successfully! 🎉');
