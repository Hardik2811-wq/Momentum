/**
 * Self-Improving NLP Memory & Active Learning Engine for Momentum OS
 * Persists learned vocabulary, action verbs, and user task patterns.
 * Associates action verbs with Life Areas and energy profiles.
 */

const STORAGE_KEY = 'momentum_nlp_learned_memory';

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.__mockLocalStorage) {
    return globalThis.__mockLocalStorage;
  }
  return null;
}

const DEFAULT_MEMORY = {
  version: 3,
  learnedVerbs: {
    'code': { areas: ['Career & Craft', 'Deep Focus'], energy: 'High', durationMinutes: 60, count: 1 },
    'debug': { areas: ['Career & Craft', 'Deep Focus'], energy: 'High', durationMinutes: 45, count: 1 },
    'program': { areas: ['Career & Craft', 'Deep Focus'], energy: 'High', durationMinutes: 60, count: 1 },
    'write': { areas: ['Creative & Expression', 'Deep Focus'], energy: 'High', durationMinutes: 45, count: 1 },
    'draft': { areas: ['Career & Craft', 'Creative & Expression'], energy: 'Medium', durationMinutes: 30, count: 1 },
    'design': { areas: ['Creative & Expression', 'Career & Craft'], energy: 'High', durationMinutes: 45, count: 1 },
    'call': { areas: ['Career & Craft'], energy: 'Low', durationMinutes: 15, count: 1 },
    'meet': { areas: ['Career & Craft'], energy: 'Medium', durationMinutes: 30, count: 1 },
    'sync': { areas: ['Career & Craft'], energy: 'Medium', durationMinutes: 20, count: 1 },
    'zoom': { areas: ['Career & Craft'], energy: 'Medium', durationMinutes: 30, count: 1 },
    'interview': { areas: ['Career & Craft'], energy: 'High', durationMinutes: 45, count: 1 },
    'groceries': { areas: ['Personal & Life'], energy: 'Low', durationMinutes: 45, count: 1 },
    'buy': { areas: ['Personal & Life'], energy: 'Low', durationMinutes: 30, count: 1 },
    'clean': { areas: ['Personal & Life', 'Habit Consistency'], energy: 'Low', durationMinutes: 30, count: 1 },
    'laundry': { areas: ['Personal & Life'], energy: 'Low', durationMinutes: 45, count: 1 },
    'gym': { areas: ['Health & Vitality', 'Habit Consistency'], energy: 'High', durationMinutes: 60, count: 1 },
    'workout': { areas: ['Health & Vitality', 'Habit Consistency'], energy: 'High', durationMinutes: 45, count: 1 }
  },
  learnedExemplars: [],
  metrics: {
    totalQueries: 0,
    localHits: 0,
    apiHits: 0,
    learnedCount: 17,
    aiAccepted: 0,
    aiDismissed: 0
  },
  recentActivity: []
};

let inMemoryFallback = null;

export function getNlpMemory() {
  const storage = getStorage();
  if (!storage) {
    if (!inMemoryFallback) inMemoryFallback = JSON.parse(JSON.stringify(DEFAULT_MEMORY));
    return inMemoryFallback;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      storage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MEMORY));
      return JSON.parse(JSON.stringify(DEFAULT_MEMORY));
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_MEMORY,
      ...parsed,
      learnedVerbs: { ...DEFAULT_MEMORY.learnedVerbs, ...(parsed.learnedVerbs || {}) },
      metrics: { ...DEFAULT_MEMORY.metrics, ...(parsed.metrics || {}) }
    };
  } catch (err) {
    console.error('Failed to read NLP memory:', err);
    return DEFAULT_MEMORY;
  }
}

export function saveNlpMemory(memory) {
  const storage = getStorage();
  if (!storage) {
    inMemoryFallback = memory;
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch (err) {
    console.error('Failed to save NLP memory:', err);
  }
}

function extractActionCandidates(text = '') {
  const clean = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean.split(' ').filter(w => w.length > 2);
  const candidates = [...words];

  for (let i = 0; i < words.length - 1; i++) {
    candidates.push(`${words[i]} ${words[i + 1]}`);
  }
  return candidates;
}

export function queryLearnedMemory(text = '') {
  if (!text || typeof text !== 'string') {
    return { matched: false, confidenceBoost: 0, inferred: {}, source: null };
  }

  const memory = getNlpMemory();
  const candidates = extractActionCandidates(text);
  const inferred = {};
  let matched = false;
  let source = null;
  let confidenceBoost = 0;

  // 1. Check learned verbs
  for (const candidate of candidates) {
    if (memory.learnedVerbs[candidate]) {
      const entry = memory.learnedVerbs[candidate];
      if (entry.areas) inferred.areas = entry.areas;
      if (entry.energy) inferred.energy = entry.energy;
      if (entry.durationMinutes && !inferred.durationMinutes) inferred.durationMinutes = entry.durationMinutes;
      matched = true;
      source = 'verb';
      confidenceBoost = Math.max(confidenceBoost, 0.45);
      break;
    }
  }

  // 2. Check learned exemplars
  if (!matched && memory.learnedExemplars && memory.learnedExemplars.length > 0) {
    const inputWords = new Set(candidates);
    for (const exemplar of memory.learnedExemplars) {
      const exemplarWords = exemplar.keywords || [];
      const common = exemplarWords.filter(w => inputWords.has(w));
      const overlapRatio = exemplarWords.length > 0 ? common.length / exemplarWords.length : 0;

      if (overlapRatio >= 0.5) {
        if (exemplar.areas) inferred.areas = exemplar.areas;
        if (exemplar.energy) inferred.energy = exemplar.energy;
        if (exemplar.durationMinutes) inferred.durationMinutes = exemplar.durationMinutes;
        if (exemplar.urgency) inferred.urgency = exemplar.urgency;
        matched = true;
        source = 'exemplar';
        confidenceBoost = Math.max(confidenceBoost, 0.55);
        break;
      }
    }
  }

  return {
    matched,
    confidenceBoost,
    inferred,
    source
  };
}

export function harvestApiResult(rawInput = '', apiOutput = {}, options = {}) {
  if (!rawInput || !apiOutput) return { newlyLearned: false, totalLearned: 0 };

  const memory = getNlpMemory();
  const candidates = extractActionCandidates(rawInput);
  let newlyLearned = false;
  let learnedKey = '';

  const nonStopCandidates = candidates.filter(c =>
    !['the', 'and', 'for', 'with', 'before', 'after', 'today', 'tomorrow', 'morning', 'afternoon', 'night', 'sometime'].includes(c)
  );

  const bestAction = nonStopCandidates[0] || '';
  const incomingAreas = apiOutput.areas || (apiOutput.area ? [apiOutput.area] : null);

  if (bestAction && (incomingAreas || apiOutput.energy)) {
    const existing = memory.learnedVerbs[bestAction] || {};
    memory.learnedVerbs[bestAction] = {
      areas: incomingAreas || existing.areas || ['Career & Craft'],
      energy: apiOutput.energy || existing.energy || 'Medium',
      durationMinutes: apiOutput.durationMinutes || existing.durationMinutes || 45,
      count: (existing.count || 0) + 1
    };
    newlyLearned = true;
    learnedKey = bestAction;
  }

  const keywords = nonStopCandidates.slice(0, 4);
  if (keywords.length >= 2) {
    const existingIndex = memory.learnedExemplars.findIndex(e =>
      e.keywords && e.keywords.join(' ') === keywords.join(' ')
    );

    const exemplar = {
      keywords,
      areas: incomingAreas,
      energy: apiOutput.energy,
      durationMinutes: apiOutput.durationMinutes,
      urgency: apiOutput.urgency,
      learnedAt: Date.now()
    };

    if (existingIndex >= 0) {
      memory.learnedExemplars[existingIndex] = exemplar;
    } else {
      memory.learnedExemplars.unshift(exemplar);
      if (memory.learnedExemplars.length > 100) memory.learnedExemplars.pop();
    }
    newlyLearned = true;
  }

  if (!options.alreadyCounted) {
    memory.metrics.totalQueries = (memory.metrics.totalQueries || 0) + 1;
    memory.metrics.apiHits = (memory.metrics.apiHits || 0) + 1;
  }
  memory.metrics.aiAccepted = (memory.metrics.aiAccepted || 0) + 1;
  memory.metrics.learnedCount = Object.keys(memory.learnedVerbs).length;

  saveNlpMemory(memory);

  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('momentum:nlp-learned', {
      detail: {
        learnedKey: learnedKey || 'exemplar',
        totalLearned: memory.metrics.learnedCount
      }
    }));
  }

  return {
    newlyLearned,
    learnedKey,
    totalLearned: memory.metrics.learnedCount
  };
}

export function recordAiRequest() {
  const memory = getNlpMemory();
  memory.metrics.totalQueries = (memory.metrics.totalQueries || 0) + 1;
  memory.metrics.apiHits = (memory.metrics.apiHits || 0) + 1;
  saveNlpMemory(memory);
}

export function recordAiDismissal() {
  const memory = getNlpMemory();
  memory.metrics.aiDismissed = (memory.metrics.aiDismissed || 0) + 1;
  saveNlpMemory(memory);
}

export function recordLocalHit() {
  const memory = getNlpMemory();
  memory.metrics.totalQueries = (memory.metrics.totalQueries || 0) + 1;
  memory.metrics.localHits = (memory.metrics.localHits || 0) + 1;
  saveNlpMemory(memory);
}

export function getMemoryStats() {
  const memory = getNlpMemory();
  const total = memory.metrics.totalQueries || 0;
  const local = memory.metrics.localHits || 0;
  const ratio = total > 0 ? Math.round((local / total) * 100) : 100;
  return {
    totalLearned: Object.keys(memory.learnedVerbs).length,
    localHits: local,
    apiHits: memory.metrics.apiHits || 0,
    offlineRatio: ratio
  };
}

export function getNlpInsights() {
  const memory = getNlpMemory();
  const total = memory.metrics.totalQueries || 0;
  const local = memory.metrics.localHits || 0;
  const ratio = total > 0 ? Math.round((local / total) * 100) : 100;
  const learnedPatterns = Object.entries(memory.learnedVerbs || {}).map(([name, data]) => ({
    name,
    areas: data.areas || ['Career & Craft'],
    context: (data.areas && data.areas[0]) || 'Career & Craft',
    durationMinutes: data.durationMinutes || 45,
    count: data.count || 1
  })).sort((a, b) => (b.count || 0) - (a.count || 0));

  return {
    totalLearned: Object.keys(memory.learnedVerbs || {}).length,
    localHits: local,
    apiHits: memory.metrics.apiHits || 0,
    offlineRatio: ratio,
    learnedPatterns,
    recentActivity: memory.recentActivity || []
  };
}

export function resetNlpMemory() {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(STORAGE_KEY);
  }
  inMemoryFallback = null;
  return DEFAULT_MEMORY;
}
