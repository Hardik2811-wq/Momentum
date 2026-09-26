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

const COPILOT_SYSTEM_PROMPT = `You are Momentum Executive AI, an elite productivity strategist and scheduler.
Analyze the user's conversation, request, and any uploaded document (PDF, DOCX, TXT, MD) to formulate an optimal, realistic execution plan.

Your objectives:
1. Provide a sharp, inspiring conversational response explaining your strategy.
2. If the user asks for a plan, task breakdown, schedule, goal formulation, or provided a project document, generate a complete structured execution plan ("hasPlan": true).
3. Connect related items: tasks can link to proposed goals or habits.
4. Distribute tasks across realistic dates (starting from todayDate) with sensible start times (09:00, 11:00, 14:00, 16:30, etc.) and durations (15 to 90 mins).

Output format:
Respond ONLY with a valid JSON object matching this schema:
{
  "message": "Conversational, highly actionable strategic overview (markdown supported)",
  "hasPlan": true,
  "plan": {
    "summary": "Short 1-line headline of this plan",
    "goals": [
      {
        "title": "Clear measurable horizon",
        "category": "career" | "health" | "creative" | "finance",
        "why": "Core intrinsic emotional anchor or ROI",
        "targetDate": "YYYY-MM-DD" or null
      }
    ],
    "habits": [
      {
        "title": "Daily/recurring ritual",
        "cadence": "Morning" | "Afternoon" | "Evening" | "Anytime",
        "frequency": "Every Day" | "Weekdays" | "3x / week",
        "duration": "15 mins" | "30 mins" | "45 mins" | "60 mins",
        "icon": "cached" | "terminal" | "fitness_center" | "auto_stories" | "self_improvement" | "edit_note",
        "colorToken": "primary" | "secondary" | "tertiary",
        "goalIndex": 0 // 0-based index of goal above, or null
      }
    ],
    "tasks": [
      {
        "title": "Concrete actionable deliverable",
        "plannedDate": "YYYY-MM-DD",
        "startTime": "HH:MM" (e.g. "09:30") or null,
        "durationMinutes": 45,
        "impact": "high" | "medium" | "low",
        "priority": "high" | "normal" | "low",
        "areas": ["Career & Craft" | "Creative & Expression" | "Deep Focus" | "Habit Consistency" | "Health & Vitality" | "Personal & Life"],
        "goalIndex": 0, // 0-based index of goal above, or null
        "existingGoalId": null, // or string ID of existing goal
        "habitIndex": 0 // 0-based index of habit above, or null
      }
    ]
  }
}
If no structured plan is requested (e.g. user just asks a simple productivity tip or question), set "hasPlan": false and "plan": null.
Do NOT output code fences or conversational prose outside the JSON. Return raw JSON only.`;

export async function generateExecutivePlanWithAI({
  userPrompt = '',
  documentContext = null,
  chatHistory = [],
  goals = [],
  habits = [],
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

  const existingGoalsContext = goals.length > 0
    ? `Existing Active Goals: ${goals.map(g => `[ID: ${g.id}] "${g.title}" (${g.category || 'general'})`).join('; ')}`
    : 'No active goals yet.';

  const existingHabitsContext = habits.length > 0
    ? `Existing Habits: ${habits.map(h => `[ID: ${h.id}] "${h.title}"`).join('; ')}`
    : 'No existing habits yet.';

  let docSection = '';
  if (documentContext && documentContext.text) {
    // Truncate document text to ~12,000 characters to comfortably stay within context window
    const truncatedText = documentContext.text.slice(0, 12000);
    docSection = `\n--- ATTACHED DOCUMENT (${documentContext.name || 'document'}) ---\n${truncatedText}\n--- END DOCUMENT ---\n`;
  }

  const userInstruction = `Current Anchor Date: ${currentDateStr}
${existingGoalsContext}
${existingHabitsContext}
${docSection}
User Query: "${userPrompt.trim()}"

Formulate your response as the required JSON schema.`;

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

