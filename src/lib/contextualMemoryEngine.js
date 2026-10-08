/**
 * Momentum OS - Cognitive Contextual Memory Engine
 * Multi-tier cognitive retrieval architecture:
 * Tier 1: Real-time working session anchor (live time, active timer, active view)
 * Tier 2: Okapi BM25 semantic relevance scoring with graph affinity
 * Tier 3: Temporal proximity & recency decay
 * Tier 4: Hierarchical episodic memory consolidation across long chat threads
 * Tier 5: Persistent user constraint and preference graph
 */

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours'
]);

const CONSTRAINTS_STORAGE_KEY = 'momentum_copilot_user_constraints';

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.__mockLocalStorage) return globalThis.__mockLocalStorage;
  return null;
}

let inMemoryConstraintsFallback = [];

/**
 * Tokenizes raw text into clean semantic terms.
 */
export function tokenizeText(text = '') {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/[\s_-]+/)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

/**
 * Builds an inverted index and document corpus for BM25 retrieval.
 */
export function buildEntityCorpus({ tasks = [], goals = [], habits = [], schedules = [] } = {}) {
  const documents = [];

  // 1. Tasks
  for (const t of tasks) {
    const rawText = [
      t.title,
      t.notes,
      t.category,
      Array.isArray(t.areas) ? t.areas.join(' ') : '',
      Array.isArray(t.subtasks) ? t.subtasks.map(st => typeof st === 'string' ? st : st.title).join(' ') : ''
    ].filter(Boolean).join(' ');

    documents.push({
      id: t.id,
      type: 'task',
      raw: t,
      title: t.title || '',
      date: t.plannedDate || (t.dueDate === 'Today' ? 'today' : ''),
      time: t.startTime || null,
      tokens: tokenizeText(rawText),
      goalId: t.goalId || null,
      habitId: t.linkedHabitId || null
    });
  }

  // 2. Goals
  for (const g of goals) {
    const rawText = [g.title, g.description, g.category, g.why].filter(Boolean).join(' ');
    documents.push({
      id: g.id,
      type: 'goal',
      raw: g,
      title: g.title || '',
      date: g.targetDate || null,
      time: null,
      tokens: tokenizeText(rawText),
      goalId: g.id,
      habitId: null
    });
  }

  // 3. Habits
  for (const h of habits) {
    const rawText = [h.title, h.notes, h.cadence, h.linkedGoal].filter(Boolean).join(' ');
    documents.push({
      id: h.id,
      type: 'habit',
      raw: h,
      title: h.title || '',
      date: null,
      time: h.startTime || null,
      tokens: tokenizeText(rawText),
      goalId: null,
      habitId: h.id
    });
  }

  // 4. Schedules
  for (const s of schedules) {
    const rawText = [s.title, s.category, s.notes, s.recurrence].filter(Boolean).join(' ');
    documents.push({
      id: s.id,
      type: 'schedule',
      raw: s,
      title: s.title || '',
      date: null,
      time: s.startTime || null,
      tokens: tokenizeText(rawText),
      goalId: null,
      habitId: null
    });
  }

  return documents;
}

/**
 * Computes Okapi BM25 score for a query against a corpus of documents.
 * Parameters: k1 = 1.2, b = 0.75
 */
export function computeBM25Scores(query = '', documents = [], { k1 = 1.2, b = 0.75 } = {}) {
  const queryTokens = tokenizeText(query);
  if (queryTokens.length === 0 || documents.length === 0) {
    return new Map();
  }

  const N = documents.length;
  let totalDocLen = 0;
  const docLengths = new Map();
  const docTermFreqs = new Map();
  const docFreqs = new Map();

  for (const doc of documents) {
    const len = doc.tokens.length;
    docLengths.set(doc.id, len);
    totalDocLen += len;

    const tf = new Map();
    const seenInDoc = new Set();
    for (const token of doc.tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
      if (!seenInDoc.has(token)) {
        seenInDoc.add(token);
        docFreqs.set(token, (docFreqs.get(token) || 0) + 1);
      }
    }
    docTermFreqs.set(doc.id, tf);
  }

  const avgdl = totalDocLen / Math.max(1, N);

  // Compute IDF for query tokens
  const idfMap = new Map();
  for (const q of queryTokens) {
    const df = docFreqs.get(q) || 0;
    // Standard Okapi IDF with floor at 0
    const idf = Math.max(0.1, Math.log((N - df + 0.5) / (df + 0.5) + 1));
    idfMap.set(q, idf);
  }

  // Score each document
  const scores = new Map();
  for (const doc of documents) {
    let score = 0;
    const tf = docTermFreqs.get(doc.id);
    const len = docLengths.get(doc.id) || 0;

    for (const q of queryTokens) {
      const freq = tf.get(q) || 0;
      if (freq > 0) {
        const idf = idfMap.get(q) || 0.1;
        const numerator = freq * (k1 + 1);
        const denominator = freq + k1 * (1 - b + b * (len / avgdl));
        score += idf * (numerator / denominator);
      }
    }
    if (score > 0) {
      scores.set(doc.id, score);
    }
  }

  return scores;
}

/**
 * Multi-vector hybrid ranking combining BM25, temporal proximity, and graph affinity.
 */
export function rankEntitiesByContext({
  query = '',
  tasks = [],
  goals = [],
  habits = [],
  schedules = [],
  todayDate = '',
  currentTime = ''
} = {}) {
  const today = todayDate || new Date().toISOString().slice(0, 10);
  const nowTime = currentTime || new Date().toTimeString().slice(0, 5);
  const [nowH, nowM] = nowTime.split(':').map(Number);
  const currentTotalMinutes = nowH * 60 + nowM;

  const corpus = buildEntityCorpus({ tasks, goals, habits, schedules });
  const bm25Scores = computeBM25Scores(query, corpus);

  const matchedGoalIds = new Set();
  const matchedHabitIds = new Set();

  // First pass: identify matched parent IDs for graph affinity boost
  for (const doc of corpus) {
    const s = bm25Scores.get(doc.id) || 0;
    if (s > 0.5) {
      if (doc.goalId) matchedGoalIds.add(doc.goalId);
      if (doc.habitId) matchedHabitIds.add(doc.habitId);
    }
  }

  const scoredDocs = corpus.map(doc => {
    let score = bm25Scores.get(doc.id) || 0;

    // Temporal Proximity Score
    if (doc.type === 'task') {
      const pDate = doc.date;
      if (pDate === today) {
        score += 2.0; // Scheduled today baseline boost
        if (doc.time) {
          const [th, tm] = doc.time.split(':').map(Number);
          const taskMinutes = th * 60 + tm;
          const diffMinutes = Math.abs(taskMinutes - currentTotalMinutes);
          if (diffMinutes <= 120) score += 2.5; // Imminent (next 2h)
          else if (diffMinutes <= 240) score += 1.5; // Next 4h
        }
      } else if (pDate && pDate < today && !doc.raw.completed) {
        score += 1.2; // Overdue tasks remain relevant
      }
    } else if (doc.type === 'schedule') {
      score += 1.0;
    } else if (doc.type === 'habit') {
      if (doc.raw.streak > 3) score += 0.5; // Maintain winning streaks
    }

    // Graph Affinity Boost (if parent goal or habit matched query)
    if (doc.type === 'goal' && matchedGoalIds.has(doc.id)) {
      score += 2.0;
    }
    if (doc.type === 'habit' && matchedHabitIds.has(doc.id)) {
      score += 1.5;
    }
    if (doc.type === 'task' && doc.goalId && matchedGoalIds.has(doc.goalId)) {
      score += 1.5;
    }

    return { ...doc, totalScore: score };
  });

  // Sort descending by total score
  scoredDocs.sort((a, b) => b.totalScore - a.totalScore);

  return scoredDocs;
}

/**
 * Formats ultra-dense Date, Time, and Working Session context with minimal token drain (~15-20 tokens total).
 */
export function formatWorkingSessionContext({
  todayDate = '',
  currentTime = '',
  activeTimer = null,
  activeView = '',
  timezone = ''
} = {}) {
  const now = new Date();
  const dateStr = todayDate || now.toISOString().slice(0, 10);
  const timeStr = currentTime || now.toTimeString().slice(0, 5);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const baseD = todayDate ? new Date(`${todayDate}T12:00:00`) : now;
  const dayIdx = Number.isNaN(baseD.getTime()) ? now.getDay() : baseD.getDay();
  const dayName = days[dayIdx];

  const [hour] = timeStr.split(':').map(Number);
  const partOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const lines = [
    `NOW: ${dayName} ${dateStr} ${timeStr} (${partOfDay}, dayIdx:${dayIdx}, 0=Sun..6=Sat) | TZ: ${tz}`
  ];

  if (activeView) {
    lines.push(`VIEW: ${activeView}`);
  }

  if (activeTimer && activeTimer.isRunning && activeTimer.title) {
    lines.push(`ACTIVE_FOCUS: "${activeTimer.title}" (${activeTimer.remainingMinutes || 0}m left)`);
  }

  return lines.join(' | ');
}

/**
 * Consolidates multi-turn chat history into a dense, rolling episodic brief.
 * Preserves user instructions, confirmed facts, and previous plan summaries beyond standard message slicing.
 */
export function consolidateEpisodicMemory(chatHistory = []) {
  if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
    return { recentMessages: [], consolidatedBrief: '' };
  }

  // Keep last 6 exchanges verbatim for acute conversational continuity
  const SLICE_WINDOW = 6;
  const recentMessages = chatHistory.slice(-SLICE_WINDOW);
  const olderMessages = chatHistory.slice(0, -SLICE_WINDOW);

  if (olderMessages.length === 0) {
    return { recentMessages, consolidatedBrief: '' };
  }

  // Extract key points from older messages (user directives, accepted plans)
  const summaries = [];
  for (const msg of olderMessages) {
    if (msg.role === 'user') {
      const text = typeof msg.content === 'string' ? msg.content.trim() : '';
      if (text.length > 8 && text.length < 150) {
        // Capture user queries / rules
        summaries.push(`User asked/instructed: "${text.replace(/\n+/g, ' ')}"`);
      }
    } else if (msg.role === 'assistant' && msg.plan) {
      const p = msg.plan;
      const headline = p.summary || `${p.goals?.length || 0}g, ${p.tasks?.length || 0}t`;
      summaries.push(`Plan proposed: "${headline}"`);
    }
  }

  const consolidatedBrief = summaries.length > 0
    ? `EPISODIC_SUMMARY (Prior Dialogue Context):\n${summaries.slice(-5).join('; ')}`
    : '';

  return { recentMessages, consolidatedBrief };
}

/**
 * Persistent User Constraint & Preference Graph.
 * Retains personal boundaries (e.g., "no meetings past 8pm", "90m focus blocks", "exams next week").
 */
export function getUserConstraints() {
  const storage = getStorage();
  if (!storage) return inMemoryConstraintsFallback;
  try {
    const raw = storage.getItem(CONSTRAINTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUserConstraints(constraints = []) {
  const storage = getStorage();
  if (!storage) {
    inMemoryConstraintsFallback = constraints;
    return;
  }
  try {
    storage.setItem(CONSTRAINTS_STORAGE_KEY, JSON.stringify(constraints));
  } catch (err) {
    console.error('Failed to save constraints:', err);
  }
}

export function extractAndSaveConstraints(text = '') {
  if (!text || typeof text !== 'string') return;

  const current = getUserConstraints();
  const lower = text.toLowerCase();
  const newRules = [];

  // 1. Time boundary constraints (e.g. "no work after 9pm", "don't schedule past 8pm")
  const cutoffMatch = lower.match(/(?:no\s+(?:work|study|tasks?)|don't\s+schedule)\s+(?:after|past|later\s+than)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (cutoffMatch) {
    newRules.push(`Cutoff: No study/work after ${cutoffMatch[1]}`);
  }

  // 2. Morning preferences (e.g. "i prefer working in the morning")
  if (lower.includes('morning person') || lower.includes('work best in the morning') || lower.includes('prefer mornings')) {
    newRules.push(`Chronotype: Prefers high-focus work in morning`);
  }

  // 3. Focus duration preference (e.g. "prefer 90m blocks", "i like 45 min sessions")
  const durMatch = lower.match(/prefer\s+(\d+)\s*(?:m|mins?|minutes)\s+(?:blocks?|sessions?|focus)/i);
  if (durMatch) {
    newRules.push(`Focus Duration: Prefers ${durMatch[1]}-minute focus blocks`);
  }

  // 4. Academic / Target Horizon rules
  const examMatch = lower.match(/(?:exam|midterm|finals?|test)\s+(?:on|starts|from)\s+([a-z0-9\s-]+)/i);
  if (examMatch) {
    newRules.push(`Target Milestone: Exam window on ${examMatch[1].trim()}`);
  }

  if (newRules.length > 0) {
    const merged = Array.from(new Set([...current, ...newRules])).slice(-10);
    saveUserConstraints(merged);
  }
}

export function formatConstraintsForPrompt() {
  const list = getUserConstraints();
  if (!list || list.length === 0) return '';
  return `USER CONSTRAINTS & PREFERENCES (Persistent):\n${list.map(r => `• ${r}`).join('\n')}`;
}
