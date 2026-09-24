/**
 * Groq LLM API Client for Momentum OS
 * Uses high-speed inference (openai/gpt-oss-20b or groq/compound-mini)
 * Auto-harvests structured outputs into local nlpMemory for self-improving offline training.
 */


const PRIMARY_MODEL = 'openai/gpt-oss-20b';
const FALLBACK_MODEL = 'groq/compound-mini';

export function getGroqApiKey() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const customKey = window.localStorage.getItem('momentum_groq_api_key');
    if (customKey && customKey.trim()) return customKey.trim();
  }
  // In production BYOK mode, users provide their own key
  return '';
}

export function hasUserApiKey() {
  return Boolean(getGroqApiKey());
}

export function setGroqApiKey(key = '') {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (key) {
      window.localStorage.setItem('momentum_groq_api_key', key.trim());
    } else {
      window.localStorage.removeItem('momentum_groq_api_key');
    }
  }
}

export async function testGroqConnection(apiKey = null) {
  const key = (apiKey || getGroqApiKey() || '').trim();
  if (!key) {
    return { success: false, error: 'No API key provided' };
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errBody.error?.message || `HTTP error ${res.status}: ${res.statusText}`
      };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Network connection failed' };
  }
}


const SYSTEM_PROMPT = `You are a precision productivity task assistant for Momentum OS.
Given a user's natural language task description, extract structured task metadata in JSON.
Output JSON schema:
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
Return ONLY valid JSON.`;

export async function parseWithGroq(input = '', goals = []) {
  if (!input || !input.trim()) {
    return { success: false, error: 'Empty input query' };
  }

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return { success: false, error: 'No Groq API key configured' };
  }

  const goalsContext = goals.length > 0
    ? `Available goals: ${goals.map(g => `"${g.title}" (id: ${g.id})`).join(', ')}`
    : '';

  const userPrompt = `Task input: "${input.trim()}"\n${goalsContext}`;

  const callModel = async (modelName) => {
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
        max_tokens: 600
      })
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from Groq');
    return JSON.parse(content);
  };

  let parsed = null;
  let usedModel = PRIMARY_MODEL;

  try {
    parsed = await callModel(PRIMARY_MODEL);
  } catch (err) {
    console.warn(`Groq primary model (${PRIMARY_MODEL}) failed:`, err.message, 'Trying fallback...');
    try {
      usedModel = FALLBACK_MODEL;
      parsed = await callModel(FALLBACK_MODEL);
    } catch (fallbackErr) {
      console.error('Groq fallback model failed:', fallbackErr);
      return { success: false, error: fallbackErr.message };
    }
  }

  return {
    success: true,
    data: parsed,
    source: 'groq_api',
    model: usedModel
  };
}
