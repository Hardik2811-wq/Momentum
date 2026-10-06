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
  learnedGoalAssociations: {},
  learnedHabitAssociations: {},
  learnedAreaAssociations: {},
  learnedImpactAssociations: {},
  learnedEffortAssociations: {},
  learnedHabitMetadata: {},
  metrics: {
    totalQueries: 0,
    localHits: 0,
    apiHits: 0,
    apiFailures: 0,
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
      if (entry.impact && !inferred.impact) inferred.impact = entry.impact;
      if (entry.goalId && !inferred.goalId) inferred.goalId = entry.goalId;
      if (entry.habitId && !inferred.habitId) inferred.habitId = entry.habitId;
      matched = true;
      source = 'verb';
      confidenceBoost = Math.max(confidenceBoost, 0.45);
      break;
    }
  }

  // 2. Check learned goal associations
  if (memory.learnedGoalAssociations) {
    for (const candidate of candidates) {
      if (memory.learnedGoalAssociations[candidate]) {
        const goalEntry = memory.learnedGoalAssociations[candidate];
        if (!inferred.goalId && goalEntry.goalId) {
          inferred.goalId = goalEntry.goalId;
          inferred.goalTitle = goalEntry.goalTitle;
          if (goalEntry.category && !inferred.areas) {
            inferred.areas = [goalEntry.category];
          }
          matched = true;
          source = source || 'goal_association';
          confidenceBoost = Math.max(confidenceBoost, 0.4);
        }
      }
    }
  }

  // 3. Check learned habit associations
  if (memory.learnedHabitAssociations) {
    for (const candidate of candidates) {
      if (memory.learnedHabitAssociations[candidate]) {
        const habitEntry = memory.learnedHabitAssociations[candidate];
        if (!inferred.habitId && habitEntry.habitId) {
          inferred.habitId = habitEntry.habitId;
          inferred.linkedHabitId = habitEntry.habitId;
          inferred.habitTitle = habitEntry.habitTitle;
          matched = true;
          source = source || 'habit_association';
          confidenceBoost = Math.max(confidenceBoost, 0.4);
        }
      }
    }
  }

  // 4. Check learned area associations
  if (memory.learnedAreaAssociations && !inferred.areas) {
    for (const candidate of candidates) {
      if (memory.learnedAreaAssociations[candidate]) {
        inferred.areas = [memory.learnedAreaAssociations[candidate].area];
        matched = true;
        source = source || 'area_association';
        confidenceBoost = Math.max(confidenceBoost, 0.35);
        break;
      }
    }
  }

  // 5. Check learned impact associations
  if (memory.learnedImpactAssociations && !inferred.impact) {
    for (const candidate of candidates) {
      if (memory.learnedImpactAssociations[candidate]) {
        inferred.impact = memory.learnedImpactAssociations[candidate].impact;
        matched = true;
        source = source || 'impact_association';
        confidenceBoost = Math.max(confidenceBoost, 0.3);
        break;
      }
    }
  }

  // 6. Check learned effort associations
  if (memory.learnedEffortAssociations) {
    for (const candidate of candidates) {
      if (memory.learnedEffortAssociations[candidate]) {
        const effEntry = memory.learnedEffortAssociations[candidate];
        if (!inferred.durationMinutes && effEntry.durationMinutes) {
          inferred.durationMinutes = effEntry.durationMinutes;
        }
        if (!inferred.energy && effEntry.energy) {
          inferred.energy = effEntry.energy;
        }
        matched = true;
        source = source || 'effort_association';
        confidenceBoost = Math.max(confidenceBoost, 0.3);
        break;
      }
    }
  }

  // 7. Check learned habit metadata (icon, cadence, duration)
  if (memory.learnedHabitMetadata) {
    for (const candidate of candidates) {
      if (memory.learnedHabitMetadata[candidate]) {
        const hMeta = memory.learnedHabitMetadata[candidate];
        if (hMeta.icon) inferred.habitIcon = hMeta.icon;
        if (hMeta.cadence) inferred.habitCadence = hMeta.cadence;
        if (hMeta.duration) inferred.habitDuration = hMeta.duration;
        matched = true;
        source = source || 'habit_metadata';
        break;
      }
    }
  }

  // 8. Check learned exemplars
  if (memory.learnedExemplars && memory.learnedExemplars.length > 0) {
    const inputWords = new Set(candidates);
    for (const exemplar of memory.learnedExemplars) {
      const exemplarWords = exemplar.keywords || [];
      const common = exemplarWords.filter(w => inputWords.has(w));
      const overlapRatio = exemplarWords.length > 0 ? common.length / exemplarWords.length : 0;

      if (overlapRatio >= 0.5) {
        if (!inferred.areas && exemplar.areas) inferred.areas = exemplar.areas;
        if (!inferred.energy && exemplar.energy) inferred.energy = exemplar.energy;
        if (!inferred.durationMinutes && exemplar.durationMinutes) inferred.durationMinutes = exemplar.durationMinutes;
        if (!inferred.urgency && exemplar.urgency) inferred.urgency = exemplar.urgency;
        if (!inferred.impact && exemplar.impact) inferred.impact = exemplar.impact;
        if (!inferred.goalId && exemplar.goalId) inferred.goalId = exemplar.goalId;
        if (!inferred.habitId && exemplar.habitId) inferred.habitId = exemplar.habitId;
        matched = true;
        source = source || 'exemplar';
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

export function learnFromTaskSave(task = {}) {
  if (!task || !task.title || typeof task.title !== 'string') return;
  const memory = getNlpMemory();
  const candidates = extractActionCandidates(task.title);
  const words = candidates.filter(w => !['the', 'and', 'for', 'with', 'before', 'after', 'today', 'tomorrow'].includes(w));
  if (words.length === 0) return;

  const bestAction = words[0];
  const existing = memory.learnedVerbs[bestAction] || {};
  const areas = Array.isArray(task.areas) && task.areas.length ? task.areas : (task.category ? [task.category] : existing.areas);

  memory.learnedVerbs[bestAction] = {
    areas: areas || existing.areas || ['Career & Craft'],
    energy: task.energy || existing.energy || 'Medium',
    durationMinutes: task.durationMinutes || existing.durationMinutes || 45,
    impact: task.impact || existing.impact || 'medium',
    goalId: task.goalId || existing.goalId || null,
    habitId: task.linkedHabitId || task.habitId || existing.habitId || null,
    count: (existing.count || 0) + 1
  };

  // Associate keywords with area if present
  if (areas && areas.length > 0) {
    if (!memory.learnedAreaAssociations) memory.learnedAreaAssociations = {};
    for (const w of words.slice(0, 4)) {
      memory.learnedAreaAssociations[w] = {
        area: areas[0],
        count: ((memory.learnedAreaAssociations[w]?.count) || 0) + 1
      };
    }
  }

  // Associate keywords with impact if set
  if (task.impact) {
    if (!memory.learnedImpactAssociations) memory.learnedImpactAssociations = {};
    for (const w of words.slice(0, 4)) {
      memory.learnedImpactAssociations[w] = {
        impact: task.impact,
        count: ((memory.learnedImpactAssociations[w]?.count) || 0) + 1
      };
    }
  }

  // Associate keywords with effort/energy & duration if set
  const taskEnergy = task.energy || (task.effort ? (task.effort.charAt(0).toUpperCase() + task.effort.slice(1).toLowerCase()) : null);
  if (task.durationMinutes || taskEnergy) {
    if (!memory.learnedEffortAssociations) memory.learnedEffortAssociations = {};
    for (const w of words.slice(0, 4)) {
      const prev = memory.learnedEffortAssociations[w];
      const prevCount = prev?.count || 0;
      const newDur = task.durationMinutes ? (prev && prev.durationMinutes ? Math.round((prev.durationMinutes * prevCount + task.durationMinutes) / (prevCount + 1)) : task.durationMinutes) : (prev?.durationMinutes || null);
      memory.learnedEffortAssociations[w] = {
        durationMinutes: newDur,
        energy: taskEnergy || prev?.energy || 'Medium',
        count: prevCount + 1
      };
    }
  }

  // Associate keywords with goal if goal is linked
  if (task.goalId) {
    if (!memory.learnedGoalAssociations) memory.learnedGoalAssociations = {};
    for (const w of words.slice(0, 4)) {
      memory.learnedGoalAssociations[w] = {
        goalId: task.goalId,
        count: ((memory.learnedGoalAssociations[w]?.count) || 0) + 1
      };
    }
  }

  // Associate keywords with habit if habit is linked
  if (task.linkedHabitId || task.habitId) {
    const hId = task.linkedHabitId || task.habitId;
    if (!memory.learnedHabitAssociations) memory.learnedHabitAssociations = {};
    for (const w of words.slice(0, 4)) {
      memory.learnedHabitAssociations[w] = {
        habitId: hId,
        count: ((memory.learnedHabitAssociations[w]?.count) || 0) + 1
      };
    }
  }

  // Update exemplar
  if (words.length >= 2) {
    const keywords = words.slice(0, 4);
    const exemplar = {
      keywords,
      areas: areas || null,
      energy: task.energy || 'Medium',
      durationMinutes: task.durationMinutes || 45,
      impact: task.impact || 'medium',
      goalId: task.goalId || null,
      habitId: task.linkedHabitId || task.habitId || null,
      learnedAt: Date.now()
    };
    if (!memory.learnedExemplars) memory.learnedExemplars = [];
    memory.learnedExemplars.unshift(exemplar);
    if (memory.learnedExemplars.length > 100) memory.learnedExemplars.pop();
  }

  memory.metrics.learnedCount = Object.keys(memory.learnedVerbs).length;
  saveNlpMemory(memory);
}

export function learnFromGoalSave(goal = {}) {
  if (!goal || !goal.title || !goal.id) return;
  const memory = getNlpMemory();
  const candidates = extractActionCandidates(goal.title);
  const words = candidates.filter(w => !['the', 'and', 'for', 'with', 'goal', 'project'].includes(w));
  if (!memory.learnedGoalAssociations) memory.learnedGoalAssociations = {};
  if (!memory.learnedAreaAssociations) memory.learnedAreaAssociations = {};

  const cat = goal.category || (Array.isArray(goal.categories) ? goal.categories[0] : null);
  const areaName = cat === 'health' ? 'Health & Vitality' : cat === 'creative' ? 'Creative & Expression' : cat === 'finance' ? 'Personal & Life' : 'Career & Craft';

  for (const w of words) {
    memory.learnedGoalAssociations[w] = {
      goalId: goal.id,
      goalTitle: goal.title,
      category: cat,
      count: ((memory.learnedGoalAssociations[w]?.count) || 0) + 2
    };
    if (cat) {
      memory.learnedAreaAssociations[w] = {
        area: areaName,
        count: ((memory.learnedAreaAssociations[w]?.count) || 0) + 2
      };
    }
  }
  saveNlpMemory(memory);
}

export function learnFromHabitSave(habit = {}) {
  if (!habit || !habit.title || !habit.id) return;
  const memory = getNlpMemory();
  const candidates = extractActionCandidates(habit.title);
  const words = candidates.filter(w => !['the', 'and', 'for', 'with', 'habit', 'daily'].includes(w));
  if (!memory.learnedHabitAssociations) memory.learnedHabitAssociations = {};
  if (!memory.learnedHabitMetadata) memory.learnedHabitMetadata = {};

  for (const w of words) {
    memory.learnedHabitAssociations[w] = {
      habitId: habit.id,
      habitTitle: habit.title,
      count: ((memory.learnedHabitAssociations[w]?.count) || 0) + 2
    };
    memory.learnedHabitMetadata[w] = {
      icon: habit.icon || 'repeat',
      cadence: habit.cadence || 'Anytime',
      duration: habit.duration || '30 mins',
      count: ((memory.learnedHabitMetadata[w]?.count) || 0) + 2
    };
  }
  saveNlpMemory(memory);
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

function addRecentActivity(memory, activity) {
  if (!Array.isArray(memory.recentActivity)) {
    memory.recentActivity = [];
  }
  memory.recentActivity.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: Date.now(),
    ...activity
  });
  if (memory.recentActivity.length > 20) {
    memory.recentActivity = memory.recentActivity.slice(0, 20);
  }
}

export function recordAiRequest(query = '') {
  const memory = getNlpMemory();
  memory.metrics.totalQueries = (memory.metrics.totalQueries || 0) + 1;
  saveNlpMemory(memory);
}

export function recordAiSuccess(query = '', model = '') {
  const memory = getNlpMemory();
  memory.metrics.totalQueries = (memory.metrics.totalQueries || 0) + 1;
  memory.metrics.apiHits = (memory.metrics.apiHits || 0) + 1;
  const shortModel = model ? model.split('/').pop() : 'groq';
  addRecentActivity(memory, {
    type: 'ai_success',
    label: query ? `"${query.slice(0, 32)}${query.length > 32 ? '…' : ''}"` : 'Task auto-filled',
    model: shortModel
  });
  saveNlpMemory(memory);
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('momentum:nlp-learned', { detail: { type: 'ai_success' } }));
  }
}

export function recordAiFailure(query = '', errorMsg = '') {
  const memory = getNlpMemory();
  memory.metrics.totalQueries = (memory.metrics.totalQueries || 0) + 1;
  memory.metrics.apiFailures = (memory.metrics.apiFailures || 0) + 1;
  addRecentActivity(memory, {
    type: 'ai_error',
    label: query ? `"${query.slice(0, 32)}${query.length > 32 ? '…' : ''}"` : 'Inference request',
    error: errorMsg || 'Groq API error'
  });
  saveNlpMemory(memory);
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('momentum:nlp-learned', { detail: { type: 'ai_error' } }));
  }
}

export function recordAiDismissal() {
  const memory = getNlpMemory();
  memory.metrics.aiDismissed = (memory.metrics.aiDismissed || 0) + 1;
  saveNlpMemory(memory);
}

export function recordLocalHit(label = 'local task pattern') {
  const memory = getNlpMemory();
  memory.metrics.totalQueries = (memory.metrics.totalQueries || 0) + 1;
  memory.metrics.localHits = (memory.metrics.localHits || 0) + 1;
  addRecentActivity(memory, {
    type: 'local',
    label: typeof label === 'string' ? label : 'Local rule match'
  });
  saveNlpMemory(memory);
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('momentum:nlp-learned', { detail: { type: 'local' } }));
  }
}

export function getMemoryStats() {
  const memory = getNlpMemory();
  const total = (memory.metrics.localHits || 0) + (memory.metrics.apiHits || 0);
  const local = memory.metrics.localHits || 0;
  const ratio = total > 0 ? Math.round((local / total) * 100) : 100;
  return {
    totalLearned: Object.keys(memory.learnedVerbs).length,
    localHits: local,
    apiHits: memory.metrics.apiHits || 0,
    apiFailures: memory.metrics.apiFailures || 0,
    offlineRatio: ratio
  };
}

export function getNlpInsights() {
  const memory = getNlpMemory();
  const local = memory.metrics.localHits || 0;
  const apiHits = memory.metrics.apiHits || 0;
  const apiFailures = memory.metrics.apiFailures || 0;
  const total = local + apiHits;
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
    apiHits: apiHits,
    apiFailures: apiFailures,
    offlineRatio: ratio,
    learnedPatterns,
    recentActivity: memory.recentActivity || [],
    aiAccepted: memory.metrics.aiAccepted || 0,
    aiDismissed: memory.metrics.aiDismissed || 0
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

/**
 * Harvests tasks and habits from an approved Copilot plan into local nlpMemory
 * so future interactions recognize vocabulary offline without calling the API.
 */
export function harvestCopilotPlan(plan) {
  if (!plan) return { learnedCount: 0 };
  let learnedCount = 0;

  if (Array.isArray(plan.tasks)) {
    for (const t of plan.tasks) {
      if (t && t.title) {
        const harvestRes = harvestApiResult(t.title, {
          areas: Array.isArray(t.areas) ? t.areas : ['Career & Craft'],
          energy: t.impact === 'high' ? 'High' : 'Normal',
          durationMinutes: t.durationMinutes || 45,
          urgency: t.priority === 'high' ? 'today' : 'week'
        });
        if (harvestRes.newlyLearned) learnedCount++;
      }
    }
  }

  if (Array.isArray(plan.habits)) {
    for (const h of plan.habits) {
      if (h && h.title) {
        const harvestRes = harvestApiResult(h.title, {
          areas: ['Habit Consistency'],
          energy: 'Normal',
          durationMinutes: 30
        });
        if (harvestRes.newlyLearned) learnedCount++;
      }
    }
  }

  return { learnedCount };
}
