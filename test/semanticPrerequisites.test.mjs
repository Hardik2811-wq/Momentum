import assert from 'node:assert';
import { inferSemanticPrerequisites } from '../src/lib/semanticPrerequisites.js';

console.log('--- Testing Semantic Prerequisite & Causal-Brain Engine ---');

// Test 1: Hygiene -> Breakfast / Outing
const hygieneTasks = [
  { id: '1', title: 'Take bath and get dressed', completed: false },
  { id: '2', title: 'Check server logs', completed: false }
];
const res1 = inferSemanticPrerequisites('Going out for breakfast with friends', hygieneTasks);
assert(res1.length > 0, 'Should find prerequisite for breakfast');
assert.strictEqual(res1[0].id, '1', 'Take bath should be top suggestion');
assert.strictEqual(res1[0].badge, 'Hygiene Prep');
console.log('✓ Test 1 Passed: Bath correctly suggested before breakfast outing');

// Test 2: Groceries -> Cook Dinner
const cookingCandidates = [
  { id: '10', title: 'Buy groceries from supermarket', completed: false },
  { id: '11', title: 'Review pull request', completed: false }
];
const res2 = inferSemanticPrerequisites('Cook dinner for family', cookingCandidates);
assert(res2.length > 0, 'Should find prerequisite for cooking');
assert.strictEqual(res2[0].id, '10');
assert.strictEqual(res2[0].badge, 'Food Prep');
console.log('✓ Test 2 Passed: Groceries correctly suggested before cooking');

// Test 3: Lecture -> Assignment
const studyCandidates = [
  { id: '20', title: 'CN Lecture 3 notes', completed: false },
  { id: '21', title: 'Workout', completed: false }
];
const res3 = inferSemanticPrerequisites('CN Assignment 3 practical', studyCandidates);
assert(res3.length > 0, 'Should find prerequisite for assignment');
assert.strictEqual(res3[0].id, '20');
assert.strictEqual(res3[0].badge, 'Study Prep');
console.log('✓ Test 3 Passed: Lecture notes suggested before assignment');

// Test 4: Software Dev Test -> Deploy
const devCandidates = [
  { id: '30', title: 'Run unit test suite', completed: false },
  { id: '31', title: 'Water the plants', completed: false }
];
const res4 = inferSemanticPrerequisites('Deploy to production release', devCandidates);
assert(res4.length > 0, 'Should find prerequisite for deployment');
assert.strictEqual(res4[0].id, '30');
assert.strictEqual(res4[0].badge, 'Dev Pipeline');
console.log('✓ Test 4 Passed: Testing suggested before production deploy');

// Test 5: Natural Series e.g. CN Lecture 1 before CN Lecture 2
const seriesCandidates = [
  { id: '40', title: 'MERN Lecture 1', completed: false },
  { id: '41', title: 'MERN Lecture 2', completed: false }
];
const res5 = inferSemanticPrerequisites('MERN Lecture 3', seriesCandidates);
assert(res5.length > 0, 'Should find series prerequisite');
assert.strictEqual(res5[0].id, '41', 'Should suggest latest prior lecture');
console.log('✓ Test 5 Passed: Natural series sequence detected');

// Test 6: Skip completed tasks
const completedCandidates = [
  { id: '50', title: 'Take bath', completed: true }
];
const res6 = inferSemanticPrerequisites('Going out for breakfast', completedCandidates);
assert.strictEqual(res6.length, 0, 'Completed tasks should not be suggested as active prerequisites');
console.log('✓ Test 6 Passed: Completed tasks properly ignored');

console.log('All Semantic Prerequisite tests passed successfully!');
