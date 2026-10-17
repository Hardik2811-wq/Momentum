/**
 * Semantic Prerequisite & Causal-Brain Intelligence Engine
 * 
 * Determines natural causal/temporal prerequisites between tasks based on
 * semantic essence, domain ontologies, action precedence, and learned user habits.
 * 
 * Examples:
 * - "Take bath" / "Morning shower" -> prerequisite to "Going out for breakfast" (Hygiene Prep)
 * - "Buy groceries" / "Prep ingredients" -> prerequisite to "Cook dinner" (Food Prep)
 * - "Watch CN Lecture 1" / "Read Chapter 3" -> prerequisite to "Solve CN Assignment 1" (Study Prep)
 * - "Write unit tests" -> prerequisite to "Deploy to production" (Software Dev Pipeline)
 * - "Warmup / Stretching" -> prerequisite to "Heavy squat workout" (Fitness Prep)
 */

import { parseSeriesToken } from './taskDependencies.js';

// Domain Ontologies & Directional Causal Precedence
const DOMAIN_RULES = [
  {
    domain: 'hygiene_routine',
    badge: 'Hygiene Prep',
    reason: 'Hygiene prep before dining / social outing',
    // Preceding actions
    prereqKeywords: [
      'bath', 'shower', 'brush', 'teeth', 'skincare', 'shave', 'grooming',
      'freshen up', 'get dressed', 'iron shirt', 'get ready'
    ],
    // Downstream actions that naturally follow
    downstreamKeywords: [
      'breakfast', 'brunch', 'dining', 'dine', 'restaurant', 'cafe',
      'go out', 'going out', 'leave for', 'head to', 'office', 'college',
      'meeting', 'date', 'meet friends', 'lunch out'
    ],
    baseConfidence: 0.92
  },
  {
    domain: 'culinary_prep',
    badge: 'Food Prep',
    reason: 'Ingredient procurement and prep before cooking',
    prereqKeywords: [
      'groceries', 'grocery', 'vegetables', 'veggies', 'ingredients', 'buy milk',
      'supermarket', 'market', 'defrost', 'chop', 'marinate'
    ],
    downstreamKeywords: [
      'cook', 'cooking', 'bake', 'baking', 'make dinner', 'make lunch',
      'prepare meal', 'dinner with', 'meal prep'
    ],
    baseConfidence: 0.94
  },
  {
    domain: 'academic_study',
    badge: 'Study Prep',
    reason: 'Theory and lecture comprehension before practical assignment',
    prereqKeywords: [
      'lecture', 'class', 'slides', 'read chapter', 'textbook', 'notes',
      'study theory', 'watch video', 'tutorial', 'documentation'
    ],
    downstreamKeywords: [
      'assignment', 'homework', 'problem set', 'lab', 'practical',
      'quiz', 'mock test', 'exam', 'viva', 'project submission'
    ],
    baseConfidence: 0.95
  },
  {
    domain: 'software_engineering',
    badge: 'Dev Pipeline',
    reason: 'Development and testing before deployment / release',
    prereqKeywords: [
      'implement', 'code', 'build feature', 'bugfix', 'refactor',
      'unit test', 'test suite', 'lint', 'pr', 'code review'
    ],
    downstreamKeywords: [
      'deploy', 'production', 'release', 'publish', 'staging',
      'merge to main', 'qa signoff', 'demo to client'
    ],
    baseConfidence: 0.96
  },
  {
    domain: 'fitness_athletics',
    badge: 'Warmup & Safety',
    reason: 'Physical warmup and mobility prep before intense exertion',
    prereqKeywords: [
      'warmup', 'warm up', 'stretch', 'stretching', 'mobility', 'foam roll',
      'hydrate'
    ],
    downstreamKeywords: [
      'workout', 'heavy squat', 'deadlift', 'leg day', 'run 5k', 'sprint',
      'crossfit', 'sparring', 'gym session'
    ],
    baseConfidence: 0.93
  },
  {
    domain: 'creative_writing',
    badge: 'Research & Draft',
    reason: 'Research and drafting before editing and publishing',
    prereqKeywords: [
      'research', 'outline', 'brainstorm', 'first draft', 'rough draft',
      'gather sources'
    ],
    downstreamKeywords: [
      'edit', 'proofread', 'format', 'publish', 'submit paper',
      'send manuscript', 'share deck'
    ],
    baseConfidence: 0.91
  }
];

/**
 * Normalizes text into lowercase clean tokens
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Checks if a string contains any of the target keywords (or substrings)
 */
function matchesAnyKeyword(text, keywords) {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

/**
 * Extracts domain topic (e.g. 'CN' from 'CN Lecture 1' and 'CN Assignment 1')
 */
function extractSharedTopic(titleA, titleB) {
  const tokensA = new Set(tokenize(titleA));
  const tokensB = tokenize(titleB);
  const common = tokensB.filter(t => tokensA.has(t) && t.length > 2 && !['the', 'and', 'for', 'with'].includes(t));
  return common.length > 0 ? common.join(' ') : null;
}

/**
 * Infers semantic prerequisites for a new or current task
 * given a list of candidate tasks in the workspace.
 * 
 * @param {string} newTitle - Title of the task being created or analyzed
 * @param {Array} candidateTasks - Available tasks (active, incomplete)
 * @param {Object} options - { currentGoalId, learnedAffinityMap }
 * @returns {Array} Top-ranked suggestions [{ task, reason, badge, confidence, domain }]
 */
export function inferSemanticPrerequisites(newTitle, candidateTasks = [], options = {}) {
  if (!newTitle || !newTitle.trim() || !Array.isArray(candidateTasks) || candidateTasks.length === 0) {
    return [];
  }

  const cleanNewTitle = newTitle.trim();
  const currentGoalId = options.currentGoalId || null;
  const learnedAffinity = options.learnedAffinity || {};
  const suggestions = [];

  for (const candidate of candidateTasks) {
    if (!candidate || !candidate.title) continue;
    if (candidate.completed) continue; // Skip completed tasks

    const candTitle = candidate.title.trim();
    if (candTitle.toLowerCase() === cleanNewTitle.toLowerCase()) continue; // Skip identical

    let score = 0;
    let matchBadge = 'Prerequisite';
    let matchReason = '';
    let matchDomain = 'general';

    // 1. Natural Series Match (e.g. 'CN Lecture 1' before 'CN Lecture 2')
    const candSeries = parseSeriesToken(candTitle);
    const newSeries = parseSeriesToken(cleanNewTitle);
    if (candSeries && newSeries && candSeries.seriesKey === newSeries.seriesKey) {
      if (candSeries.index < newSeries.index) {
        score = 0.98 - (newSeries.index - candSeries.index - 1) * 0.05;
        matchBadge = 'Series Sequence';
        matchReason = `Part ${candSeries.index} canonically precedes Part ${newSeries.index}`;
        matchDomain = 'series';
      }
    }

    // 2. Shared Goal / Topic Bonus
    const sameGoal = currentGoalId && candidate.goalId && String(candidate.goalId) === String(currentGoalId);
    const sharedTopic = extractSharedTopic(candTitle, cleanNewTitle);

    // 3. Causal Domain Rules
    for (const rule of DOMAIN_RULES) {
      const isCandPrereq = matchesAnyKeyword(candTitle, rule.prereqKeywords);
      const isNewDownstream = matchesAnyKeyword(cleanNewTitle, rule.downstreamKeywords);

      if (isCandPrereq && isNewDownstream) {
        let domainScore = rule.baseConfidence;
        // Boost if shared topic exists (e.g. 'CN' in both 'CN Lecture' and 'CN Assignment')
        if (sharedTopic) domainScore += 0.05;
        if (sameGoal) domainScore += 0.04;

        if (domainScore > score) {
          score = domainScore;
          matchBadge = rule.badge;
          matchReason = `${rule.reason}`;
          matchDomain = rule.domain;
        }
      }
    }

    // 4. Learned User Affinity Bonus
    const pairKey = `${candTitle.toLowerCase()}->${cleanNewTitle.toLowerCase()}`;
    if (learnedAffinity[pairKey]) {
      score = Math.max(score, 0.95);
      matchBadge = 'Learned Habit';
      matchReason = 'You usually complete this step first';
      matchDomain = 'learned';
    }

    // 5. Shared Subject / Assignment Matching (e.g. "Math Lecture" -> "Math Homework")
    if (score < 0.6 && sharedTopic) {
      const candIsTheory = matchesAnyKeyword(candTitle, ['read', 'study', 'notes', 'lecture', 'chapter']);
      const newIsExercise = matchesAnyKeyword(cleanNewTitle, ['homework', 'assignment', 'solve', 'practice', 'quiz']);
      if (candIsTheory && newIsExercise) {
        score = 0.88;
        matchBadge = 'Academic Prep';
        matchReason = `Study "${sharedTopic}" material before attempting assignment`;
        matchDomain = 'academic_study';
      }
    }

    if (score >= 0.70) {
      suggestions.push({
        task: candidate,
        id: candidate.id,
        title: candTitle,
        reason: matchReason || 'Recommended prerequisite',
        badge: matchBadge,
        confidence: Math.min(score, 0.99),
        domain: matchDomain
      });
    }
  }

  // Sort descending by confidence score and return top 4
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
}
