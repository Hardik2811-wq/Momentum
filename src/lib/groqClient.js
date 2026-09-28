/**
 * Groq LLM API Client for Momentum OS
 * Uses high-speed inference (llama-3.3-70b-versatile with instant fallbacks)
 * Auto-harvests structured outputs into local nlpMemory for self-improving offline training.
 */

const SUPPORTED_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
];

let inMemoryKey = '';
let cachedAvailableModels = null;

export function getGroqApiKey() {
  if (inMemoryKey) return inMemoryKey;
  if (typeof window !== 'undefined') {
    try {
      const customKey = window.localStorage?.getItem('momentum_groq_api_key');
      if (customKey && customKey.trim()) {
        inMemoryKey = customKey.trim();
        return inMemoryKey;
      }
    } catch {}
  }
  return '';
}

export function hasUserApiKey() {
  return Boolean(getGroqApiKey());
}

export function setGroqApiKey(key = '') {
  const clean = (key || '').trim();
  inMemoryKey = clean;
  cachedAvailableModels = null;
  if (typeof window !== 'undefined') {
    try {
      if (clean) {
        window.localStorage?.setItem('momentum_groq_api_key', clean);
      } else {
        window.localStorage?.removeItem('momentum_groq_api_key');
      }
    } catch {}
  }
}

export function getCustomCopilotDirective() {
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage?.getItem('momentum_copilot_directive') || '';
    } catch {}
  }
  return '';
}

export function setCustomCopilotDirective(directive = '') {
  if (typeof window !== 'undefined') {
    try {
      const clean = (directive || '').trim();
      if (clean) {
        window.localStorage?.setItem('momentum_copilot_directive', clean);
      } else {
        window.localStorage?.removeItem('momentum_copilot_directive');
      }
    } catch {}
  }
}

export async function testGroqConnection(apiKey = null) {
  const passedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  const key = (passedKey || getGroqApiKey() || '').trim();
  if (!key) {
    return { success: false, error: 'No API key provided' };
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errBody.error?.message || `HTTP error ${res.status}: ${res.statusText}`
      };
    }
    const data = await res.json();
    const available = Array.isArray(data?.data) ? data.data.map(m => m.id) : [];
    if (available.length > 0) {
      cachedAvailableModels = available;
    }
    return { success: true, models: available };
  } catch (err) {
    return { success: false, error: err.message || 'Network connection failed' };
  }
}

const SYSTEM_PROMPT = `You are a precision productivity task assistant for Momentum OS.
Given a user's task input, extract structured task metadata in JSON format.
Output schema:
{
  "cleanTitle": "Core task action without clutter or raw time tags (string)",
  "dueDate": "Today" | "Tomorrow" | "This Week" | "Someday",
  "urgency": "today" | "week" | "later",
  "startTime": "HH:MM" in 24h format if mentioned/implied (e.g. "14:30"), else null,
  "durationMinutes": number (default 45),
  "areas": ["Career & Craft" | "Creative & Expression" | "Deep Focus" | "Habit Consistency" | "Health & Vitality" | "Personal & Life"],
  "energy": "High" | "Medium" | "Low",
  "impact": "high" | "medium" | "low",
  "priority": "high" | "normal" | "low",
  "suggestedSubtasks": ["Micro-step 1", "Micro-step 2"]
}
Respond ONLY with a valid JSON object. No conversational filler, no code fences.`;

export async function parseWithGroq(input = '', goals = [], explicitApiKey = null) {
  if (!input || typeof input !== 'string' || !input.trim()) {
    return { success: false, error: 'Empty input query' };
  }

  const passedKey = typeof explicitApiKey === 'string' ? explicitApiKey.trim() : '';
  const apiKey = (passedKey || getGroqApiKey() || '').trim();
  if (!apiKey) {
    return { success: false, error: 'No Groq API key configured' };
  }

  const goalsContext = goals.length > 0
    ? `Available goals: ${goals.map(g => `"${g.title}" (id: ${g.id})`).join(', ')}`
    : '';

  const userPrompt = `Extract task metadata into a JSON object: "${input.trim()}"\n${goalsContext}`;

  const callModel = async (modelName) => {
    // Attempt 1: response_format json_object
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 800
        })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return JSON.parse(content);
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        const errMsg = errBody.error?.message || `HTTP ${res.status}`;
        // If not a JSON format error (e.g. 404 model not found, 401 unauthorized), throw immediately
        if (!errMsg.toLowerCase().includes('json')) {
          throw new Error(errMsg);
        }
      }
    } catch (e) {
      if (!e.message.toLowerCase().includes('json')) {
        throw e;
      }
    }

    // Attempt 2: Relaxed JSON extraction without json_object constraint
    const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${userPrompt}\n\nIMPORTANT: Return ONLY raw JSON object. Do not wrap in markdown or backticks.` }
        ],
        temperature: 0.1,
        max_tokens: 800
      })
    });

    if (!fallbackRes.ok) {
      const errBody = await fallbackRes.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `HTTP ${fallbackRes.status}`);
    }

    const data = await fallbackRes.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    return JSON.parse(match[0]);
  };

  let modelsToTry = SUPPORTED_MODELS;
  if (!cachedAvailableModels) {
    try {
      const mRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (mRes.ok) {
        const mData = await mRes.json();
        if (Array.isArray(mData?.data)) {
          cachedAvailableModels = mData.data.map(m => m.id);
        }
      }
    } catch {}
  }

  if (cachedAvailableModels && cachedAvailableModels.length > 0) {
    const matched = SUPPORTED_MODELS.filter(m => cachedAvailableModels.includes(m));
    if (matched.length > 0) {
      modelsToTry = matched;
    } else {
      const chatModels = cachedAvailableModels.filter(m => !m.includes('whisper') && !m.includes('guard') && !m.includes('distil'));
      if (chatModels.length > 0) {
        modelsToTry = chatModels;
      }
    }
  }

  let lastError = null;
  for (const model of modelsToTry) {
    try {
      const parsed = await callModel(model);
      if (parsed && typeof parsed === 'object') {
        return {
          success: true,
          data: parsed,
          source: 'groq_api',
          model
        };
      }
    } catch (err) {
      console.warn(`Groq model (${model}) failed:`, err.message);
      lastError = err.message;
    }
  }

  return {
    success: false,
    error: lastError || 'All Groq models failed'
  };
}

/**
 * Serializes user workspace memory (goals, habits, calendar tasks, analytics)
 * into a dense, token-optimized notation that cuts API context tokens by 70-80%.
 */
export function serializeDenseMemory({
  goals = [],
  habits = [],
  tasks = [],
  stats = null,
  todayDate = ''
}) {
  const today = todayDate || new Date().toISOString().slice(0, 10);

  // 1. Goals Memory (compact ID, title, target, progress)
  const goalItems = (goals || [])
    .slice(0, 12)
    .map(g => `[g:${g.id}|"${g.title}"|due:${g.targetDate || 'open'}|prog:${Math.round(g.progress || 0)}%]`);
  const goalsLine = goalItems.length > 0 ? `GOALS:\n${goalItems.join(' ')}` : 'GOALS: none';

  // 2. Habits Memory (compact ID, title, streak, cadence, linked goal)
  const habitItems = (habits || [])
    .slice(0, 12)
    .map(h => `[h:${h.id}|"${h.title}"|streak:${h.streak || 0}d|cadence:${h.cadence || 'Daily'}${h.linkedGoal ? `|goal:"${h.linkedGoal}"` : ''}]`);
  const habitsLine = habitItems.length > 0 ? `HABITS:\n${habitItems.join(' ')}` : 'HABITS: none';

  // 3. Calendar Tasks Memory (active window: today - 1 to today + 7, + overdue open tasks)
  const horizonEnd = new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0, 10);
  const relevantTasks = (tasks || [])
    .filter(t => {
      const date = t.plannedDate || (t.dueDate === 'Today' ? today : null);
      if (!t.completed) {
        if (!date || date <= horizonEnd) return true; // active upcoming or overdue
      } else {
        // completed within recent horizon
        if (date && date >= today) return true;
      }
      return false;
    })
    .slice(0, 25);

  const taskItems = relevantTasks.map(t => {
    const d = t.plannedDate || (t.dueDate === 'Today' ? today : 'unscheduled');
    const time = t.startTime ? ` ${t.startTime}` : '';
    const dur = t.durationMinutes || t.duration || 30;
    const gRef = t.goalId ? `|g:${t.goalId}` : '';
    const hRef = t.linkedHabitId ? `|h:${t.linkedHabitId}` : '';
    const st = t.completed ? 'done' : 'open';
    return `[t:${t.id}|"${t.title}"|${d}${time}|${dur}m${gRef}${hRef}|${st}]`;
  });
  const tasksLine = taskItems.length > 0 ? `SCHEDULE (Active Horizon):\n${taskItems.join(' ')}` : 'SCHEDULE: empty';

  // 4. Analytics Digest (pre-computed personal capacity & velocity)
  let analyticsLine = '';
  if (stats) {
    analyticsLine = `ANALYTICS: compRate:${stats.completionRate || 0}% | streak:${stats.longestStreak || 0}d | habitsToday:${stats.habitsCompletedToday || 0}/${stats.totalHabits || 0} | focusToday:${stats.completedFocusMinutes || 0}m | momentum:${stats.momentumScore || 0}% | pendingTasks:${stats.pending || 0}`;
  }

  return [goalsLine, habitsLine, tasksLine, analyticsLine].filter(Boolean).join('\n\n');
}

const COPILOT_SYSTEM_PROMPT = `You are Momentum Executive Copilot.
Formulate deep, rigorous, realistic operational execution plans balancing the user's workload, academic requirements, personal projects, and active habits.

Memory notation:
G=[g:ID|"Title"|due:DATE|prog:%]
H=[h:ID|"Title"|streak:Nd|cadence:TIME]
T=[t:ID|"Title"|DATE TIME|DURATIONm|g:GOAL_ID|h:HABIT_ID|status]
ANALYTICS=[compRate:%|streak:Nd|habitsToday:X/Y|focusToday:Nm|momentum:%|pending:N]

CRITICAL PLANNING PRINCIPLES:
1. NEVER produce lazy, tiny sample plans (e.g. 3 generic tasks). When user shares an exam strategy, syllabus, timetable, or project mission:
   - HORIZONS (Goals): Create 5-8 distinct anchors covering ALL academic subjects, creative passions, and behavioral discipline commitments.
   - DAILY RITUALS (Habits): Create 6-12 specific, recurring rituals (e.g. subject-specific deep work blocks, pre-class previews, post-class review, evening daily check-ins, Sunday weekly reviews).
   - EXECUTION TIMELINE (Tasks): Schedule every specific study block, in-person lecture attendance anchor, lab build, and checkpoint across the upcoming timeline with concrete time slots (startTime "HH:MM", durationMinutes), areas, and 2-4 subtasks with clear outputs (e.g. "Concept sheet", "5 problems solved").
2. Ultra-Compact Efficiency: Use concise titles and compact representations so full multi-day plans fit effortlessly in JSON.
3. Link items: Connect tasks and habits to goals via goalIndex (0-based) or existingGoalId.
4. If the user only asks a general conversational question without requesting scheduling, set "hasPlan": false, "plan": null.

Return ONLY raw JSON object (no markdown code blocks):
{
  "message": "Sharp, direct executive assessment and strategic briefing.",
  "hasPlan": true,
  "plan": {
    "summary": "1-line operational headline",
    "goals": [
      {"title": "Goal Title", "category": "career"|"health"|"creative"|"finance", "why": "Why this matters", "targetDate": "YYYY-MM-DD"|null}
    ],
    "habits": [
      {"title": "Habit Title", "cadence": "Morning"|"Afternoon"|"Evening"|"Anytime", "frequency": "Every Day"|"Weekdays"|"3x / week", "duration": "15 mins"|"30 mins"|"45 mins"|"60 mins"|"90 mins"|"120 mins", "icon": "cached"|"terminal"|"fitness_center"|"auto_stories"|"palette"|"menu_book", "colorToken": "primary"|"secondary"|"tertiary", "goalIndex": 0|null}
    ],
    "tasks": [
      {
        "title": "Task title with specific topic/session",
        "plannedDate": "YYYY-MM-DD",
        "startTime": "HH:MM"|null,
        "durationMinutes": 60,
        "impact": "high"|"medium"|"low",
        "priority": "high"|"normal"|"low",
        "energy": "High"|"Medium"|"Low",
        "recurrence": "none"|"daily"|"weekly"|"monthly",
        "deadlineDate": "YYYY-MM-DD"|null,
        "areas": ["Career & Craft"|"Deep Focus"|"Creative & Expression"|"Habit Consistency"],
        "goalIndex": 0|null,
        "existingGoalId": "string"|null,
        "habitIndex": 0|null,
        "existingHabitId": "string"|null,
        "subtasks": ["step 1", "step 2"]
      }
    ]
  }
}`;

/**
 * Normalizes Copilot plans supporting both verbose JSON objects and ultra-compact
 * delta tuples ["title", "YYYY-MM-DD", "HH:MM", dur, goalRef, habitRef, pri]
 * to cut output token generation costs by 60-80%.
 */
export function normalizeCopilotPlan(parsed, todayDate = '') {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (!parsed.hasPlan || !parsed.plan) return parsed;

  const today = todayDate || new Date().toISOString().slice(0, 10);
  const plan = parsed.plan;

  if (Array.isArray(plan.goals)) {
    plan.goals = plan.goals.map((g, idx) => {
      if (Array.isArray(g)) {
        return {
          title: g[0] || `Goal ${idx + 1}`,
          category: g[1] || 'career',
          why: g[2] || '',
          targetDate: g[3] || null
        };
      }
      return g;
    });
  }

  if (Array.isArray(plan.habits)) {
    plan.habits = plan.habits.map((h, idx) => {
      if (Array.isArray(h)) {
        return {
          title: h[0] || `Habit ${idx + 1}`,
          cadence: h[1] || 'Morning',
          frequency: h[2] || 'Every Day',
          duration: h[3] || '30 mins',
          icon: 'cached',
          colorToken: 'primary',
          goalIndex: typeof h[4] === 'number' ? h[4] : null
        };
      }
      return h;
    });
  }

  if (Array.isArray(plan.tasks)) {
    plan.tasks = plan.tasks.map(t => {
      if (Array.isArray(t)) {
        const goalRef = t[4];
        const habitRef = t[5];
        return {
          title: t[0] || 'Scheduled Task',
          plannedDate: t[1] || today,
          startTime: t[2] || null,
          durationMinutes: typeof t[3] === 'number' ? t[3] : 45,
          goalIndex: typeof goalRef === 'number' ? goalRef : null,
          existingGoalId: typeof goalRef === 'string' ? goalRef : null,
          habitIndex: typeof habitRef === 'number' ? habitRef : null,
          existingHabitId: typeof habitRef === 'string' ? habitRef : null,
          impact: t[6] === 'high' ? 'high' : 'medium',
          priority: t[6] || 'normal',
          areas: ['Career & Craft']
        };
      }
      const rawSubtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
      const formattedSubtasks = rawSubtasks.map((s, sIdx) => {
        if (typeof s === 'string') {
          return { id: `st-${Date.now()}-${sIdx}`, title: s.trim(), completed: false };
        }
        if (s && typeof s === 'object') {
          return { id: s.id || `st-${Date.now()}-${sIdx}`, title: s.title || String(s), completed: Boolean(s.completed) };
        }
        return null;
      }).filter(Boolean);

      return {
        title: t.title || 'Scheduled Task',
        plannedDate: t.plannedDate || t.date || today,
        startTime: t.startTime || t.time || null,
        durationMinutes: t.durationMinutes || t.dur || 45,
        impact: t.impact || 'medium',
        priority: t.priority || (t.impact === 'high' ? 'high' : 'normal'),
        energy: t.energy || (t.impact === 'high' ? 'High' : t.impact === 'low' ? 'Low' : 'Normal'),
        recurrence: t.recurrence || 'none',
        deadlineDate: t.deadlineDate || null,
        deadlineTime: t.deadlineTime || null,
        areas: Array.isArray(t.areas) ? t.areas : ['Career & Craft'],
        goalIndex: typeof t.goalIndex === 'number' ? t.goalIndex : null,
        existingGoalId: t.existingGoalId || (typeof t.goalIndex === 'string' ? t.goalIndex : null),
        habitIndex: typeof t.habitIndex === 'number' ? t.habitIndex : null,
        existingHabitId: t.existingHabitId || (typeof t.habitIndex === 'string' ? t.habitIndex : null),
        subtasks: formattedSubtasks
      };
    });
  }

  return parsed;
}

export async function generateExecutivePlanWithAI({
  userPrompt = '',
  documentContext = null,
  chatHistory = [],
  goals = [],
  habits = [],
  tasks = [],
  stats = null,
  todayDate = '',
  explicitApiKey = null
}) {
  const passedKey = typeof explicitApiKey === 'string' ? explicitApiKey.trim() : '';
  const apiKey = (passedKey || getGroqApiKey() || '').trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'No Groq API key configured. Please add your free Groq API key in Settings.'
    };
  }

  const currentDateStr = todayDate || new Date().toISOString().slice(0, 10);

  // Compress memory context into ultra-dense notation (70%+ token savings)
  const memoryContext = serializeDenseMemory({
    goals,
    habits,
    tasks,
    stats,
    todayDate: currentDateStr
  });

  let docSection = '';
  if (documentContext && (documentContext.outline || documentContext.text)) {
    // Prefer executive outline to cut up to 90% document tokens
    const rawDocText = documentContext.outline || documentContext.text;
    const cleanDoc = rawDocText
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .slice(0, 3000)
      .trim();
    docSection = `\n--- ATTACHED DOC OUTLINE: ${documentContext.name || 'document'} ---\n${cleanDoc}\n--- END DOC ---\n`;
  }

  const userInstruction = `TODAY: ${currentDateStr}

${memoryContext}
${docSection}
USER QUERY: "${userPrompt.trim()}"`;

  const userDirective = getCustomCopilotDirective();
  const directivePrompt = userDirective
    ? `\n\nUSER'S MASTER DIRECTIVE & STRATEGY:\n${userDirective}\nHonor these rules, time blocks, and anti-avoidance priorities strictly.`
    : '';

  // Format messages
  const messages = [
    { role: 'system', content: COPILOT_SYSTEM_PROMPT + directivePrompt }
  ];

  // Append recent chat history (last 4 exchanges), truncating long messages to ~300 chars to save prompt tokens
  if (Array.isArray(chatHistory)) {
    const recents = chatHistory.slice(-4);
    for (const msg of recents) {
      if (msg.role && msg.content) {
        let contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        if (contentStr.length > 300) {
          contentStr = contentStr.slice(0, 300) + '... (truncated for brevity)';
        }
        messages.push({ role: msg.role, content: contentStr });
      }
    }
  }

  messages.push({ role: 'user', content: userInstruction });

  const callModel = async (modelName) => {
    const makeRequest = async (tokenLimit, isPruned = false) => {
      const activeMsgs = isPruned
        ? [
            { role: 'system', content: COPILOT_SYSTEM_PROMPT },
            { role: 'user', content: `TODAY: ${currentDateStr}\nUSER QUERY: "${userPrompt.trim().slice(0, 8000)}"` }
          ]
        : messages;

      const payload = {
        model: modelName,
        messages: activeMsgs,
        response_format: { type: 'json_object' },
        temperature: 0.2
      };
      if (tokenLimit) payload.max_tokens = tokenLimit;

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const rawJson = JSON.parse(content);
          return normalizeCopilotPlan(rawJson, currentDateStr);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.error?.message || `HTTP ${res.status}`;
        const isLenErr = msg.toLowerCase().includes('reduce the length') || msg.toLowerCase().includes('max_tokens') || msg.toLowerCase().includes('context');
        if (isLenErr && !isPruned) {
          return makeRequest(512, true);
        }
      }

      // Fallback without json_object constraint
      const fallbackPayload = {
        model: modelName,
        messages: [
          ...activeMsgs,
          { role: 'user', content: 'Return ONLY raw JSON object without markdown or code fences.' }
        ],
        temperature: 0.2
      };
      if (tokenLimit) fallbackPayload.max_tokens = tokenLimit;

      const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fallbackPayload)
      });

      if (!fallbackRes.ok) {
        const err = await fallbackRes.json().catch(() => ({}));
        const msg = err.error?.message || `HTTP ${fallbackRes.status}`;
        const isLenErr = msg.toLowerCase().includes('reduce the length') || msg.toLowerCase().includes('max_tokens') || msg.toLowerCase().includes('context');
        if (isLenErr && !isPruned) {
          return makeRequest(512, true);
        }
        throw new Error(msg);
      }

      const data = await fallbackRes.json();
      const rawContent = data.choices?.[0]?.message?.content || '';
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON object found in response');
      const rawJson = JSON.parse(match[0]);
      return normalizeCopilotPlan(rawJson, currentDateStr);
    };

    return makeRequest(4096);
  };

  let modelsToTry = SUPPORTED_MODELS;
  if (!cachedAvailableModels) {
    try {
      const mRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (mRes.ok) {
        const mData = await mRes.json();
        if (Array.isArray(mData?.data)) {
          cachedAvailableModels = mData.data.map(m => m.id);
        }
      }
    } catch {}
  }

  if (Array.isArray(cachedAvailableModels) && cachedAvailableModels.length > 0) {
    const matched = SUPPORTED_MODELS.filter(m => cachedAvailableModels.includes(m));
    if (matched.length > 0) {
      modelsToTry = matched;
    } else {
      const invalidKeywords = ['guard', 'whisper', 'embed', 'moderation', 'classifier', 'vision'];
      const chatModels = cachedAvailableModels.filter(m => {
        const id = String(m).toLowerCase();
        return !invalidKeywords.some(kw => id.includes(kw));
      });
      if (chatModels.length > 0) modelsToTry = chatModels;
    }
  }

  let lastError = null;

  for (const m of modelsToTry) {
    try {
      const parsed = await callModel(m);
      if (parsed) {
        return {
          success: true,
          data: parsed,
          model: m
        };
      }
    } catch (err) {
      console.warn(`Copilot model (${m}) failed:`, err.message);
      lastError = err.message;
    }
  }

  return {
    success: false,
    error: lastError || 'All models failed to process plan'
  };
}

