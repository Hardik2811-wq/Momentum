/**
 * Groq LLM API Client for Momentum OS
 * Uses high-speed inference (llama-3.3-70b-versatile with instant fallbacks)
 * Auto-harvests structured outputs into local nlpMemory for self-improving offline training.
 */

const SUPPORTED_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b'
];

let inMemoryKey = '';

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
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
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

  let lastError = null;
  for (const model of SUPPORTED_MODELS) {
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
