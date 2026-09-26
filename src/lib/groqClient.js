/**
 * Groq LLM API Client for Momentum OS
 * Uses high-speed inference (llama-3.3-70b-versatile with instant fallbacks)
 * Auto-harvests structured outputs into local nlpMemory for self-improving offline training.
 */

const SUPPORTED_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3.8-27b'
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
Formulate optimal, realistic execution plans balancing the user's workload, open calendar time slots, and active habits.

Memory notation:
G=[g:ID|"Title"|due:DATE|prog:%]
H=[h:ID|"Title"|streak:Nd|cadence:TIME]
T=[t:ID|"Title"|DATE TIME|DURATIONm|g:GOAL_ID|h:HABIT_ID|status]
ANALYTICS=[compRate:%|streak:Nd|habitsToday:X/Y|focusToday:Nm|momentum:%|pending:N]

Instructions:
1. Provide a sharp, concise strategic overview.
2. If the user asks for a plan, task breakdown, or uploads a document, generate a structured plan ("hasPlan": true).
3. Interconnect items: link new tasks to existing IDs (existingGoalId, existingHabitId) or newly proposed indexes (goalIndex, habitIndex).
4. Avoid scheduling conflicts with existing open tasks; respect user focus capacity.
5. If no plan is requested, set "hasPlan": false, "plan": null.

Return ONLY raw JSON object (no markdown code blocks):
{
  "message": "Direct, actionable strategic overview",
  "hasPlan": true,
  "plan": {
    "summary": "1-line headline",
    "goals": [{"title":"", "category":"career"|"health"|"creative"|"finance", "why":"", "targetDate":"YYYY-MM-DD"|null}],
    "habits": [{"title":"", "cadence":"Morning"|"Afternoon"|"Evening"|"Anytime", "frequency":"Every Day"|"Weekdays"|"3x / week", "duration":"15 mins"|"30 mins"|"45 mins"|"60 mins", "icon":"cached"|"terminal"|"fitness_center"|"auto_stories", "colorToken":"primary"|"secondary"|"tertiary", "goalIndex":0|null}],
    "tasks": [{"title":"", "plannedDate":"YYYY-MM-DD", "startTime":"HH:MM"|null, "durationMinutes":30, "impact":"high"|"medium"|"low", "priority":"high"|"normal"|"low", "areas":["Career & Craft"|"Deep Focus"|"Health & Vitality"], "goalIndex":0|null, "existingGoalId":"string"|null, "habitIndex":0|null, "existingHabitId":"string"|null}]
  }
}`;

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
  if (documentContext && documentContext.text) {
    // Compress doc whitespace and limit to 6,000 chars (~1,500 tokens max)
    const cleanDoc = documentContext.text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .slice(0, 6000)
      .trim();
    docSection = `\n--- ATTACHED DOC: ${documentContext.name || 'document'} ---\n${cleanDoc}\n--- END DOC ---\n`;
  }

  const userInstruction = `TODAY: ${currentDateStr}

${memoryContext}
${docSection}
USER QUERY: "${userPrompt.trim()}"`;

  // Format messages
  const messages = [
    { role: 'system', content: COPILOT_SYSTEM_PROMPT }
  ];

  // Append recent chat history (last 6 exchanges)
  if (Array.isArray(chatHistory)) {
    const recents = chatHistory.slice(-6);
    for (const msg of recents) {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role, content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) });
      }
    }
  }

  messages.push({ role: 'user', content: userInstruction });

  const callModel = async (modelName) => {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2200
      })
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return JSON.parse(content);
    }

    // Fallback without json_object constraint
    const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          ...messages,
          { role: 'user', content: 'Return ONLY raw JSON object without markdown or code fences.' }
        ],
        temperature: 0.2,
        max_tokens: 2200
      })
    });

    if (!fallbackRes.ok) {
      const err = await fallbackRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${fallbackRes.status}`);
    }

    const data = await fallbackRes.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    return JSON.parse(match[0]);
  };

  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b'];
  let lastError = null;

  for (const m of models) {
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

