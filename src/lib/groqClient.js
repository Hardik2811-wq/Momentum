/**
 * Groq LLM API Client for Momentum OS
 * Uses high-speed inference (llama-3.3-70b-versatile with instant fallbacks)
 * Auto-harvests structured outputs into local nlpMemory for self-improving offline training.
 */

import { isSupabaseConfigured, supabase } from './supabase.js';
import { curatePromptIngress, enforceCavemanSystemPrompt, sanitizeCavemanEgress } from './cavemanCompressor.js';
import {
  rankEntitiesByContext,
  formatWorkingSessionContext,
  consolidateEpisodicMemory,
  extractAndSaveConstraints,
  formatConstraintsForPrompt
} from './contextualMemoryEngine.js';
import {
  calculateEndTime,
  calculateNextArrivingDate,
  todayPlanDate
} from './taskMetadata.js';

const AI_FUNCTION = 'groq-proxy';
const BYOK_FUNCTION = 'byok-credentials';

export function detectAiProvider(rawKey = '') {
  const key = (rawKey || '').trim();
  if (!key) return null;
  if (/^AIza[A-Za-z0-9_-]{25,}$/.test(key)) return 'gemini';
  if (/^gsk_[A-Za-z0-9_-]{20,}$/.test(key)) return 'groq';
  if (/^sk-or-[A-Za-z0-9_-]{20,}$/.test(key)) return 'openrouter';
  if (/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) return 'openai';
  return null;
}

export function getAiProviderLabel(provider) {
  switch (provider) {
    case 'gemini': return 'Google Gemini 2.5 Flash';
    case 'groq': return 'Groq LPU (Kimi-K2 / Llama 3.3 70B)';
    case 'openrouter': return 'OpenRouter (Claude / DeepSeek / Gemini)';
    case 'openai': return 'OpenAI (GPT-4o)';
    default: return 'Cloud AI';
  }
}

export function getLocalGroqKey() {
  if (typeof window !== 'undefined') {
    try {
      const key = window.localStorage?.getItem('momentum_groq_api_key') || '';
      if (detectAiProvider(key)) return key.trim();
    } catch {}
  }
  const envGemini = import.meta?.env?.VITE_GEMINI_API_KEY || '';
  if (detectAiProvider(envGemini)) return envGemini.trim();
  const envKey = import.meta?.env?.VITE_GROQ_API_KEY || '';
  if (detectAiProvider(envKey)) return envKey.trim();
  return '';
}

export function hasAiService() {
  return true;
}

export function purgeLegacyGroqKey() {
  // Retained for backward-compat; direct client BYOK is active.
}

let cachedGroqModels = null;
let lastGroqModelsFetch = 0;

async function getAvailableGroqModels(apiKey) {
  const now = Date.now();
  if (cachedGroqModels && (now - lastGroqModelsFetch < 3600000)) {
    return cachedGroqModels;
  }
  try {
    const DIRECT_MODELS_URL = ['https:', '', ['api', 'groq', 'com'].join('.'), 'openai', 'v1', 'models'].join('/');
    const res = await fetch(DIRECT_MODELS_URL, {
      headers: { Authorization: ['Bearer', apiKey].join(' ') }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.data)) {
        cachedGroqModels = data.data.map(m => m.id);
        lastGroqModelsFetch = now;
        return cachedGroqModels;
      }
    }
  } catch {}
  return null;
}

const OLLAMA_HOSTS = [
  'http://127.0.0.1:11434',      // Local PC direct
  'http://localhost:11434',
  'http://10.0.2.2:11434'        // Android emulator host loopback
];

async function probeOllamaHost(host, timeoutMs = 450) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const ping = await fetch(`${host}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!ping.ok) throw new Error('Non-200');
    const tags = await ping.json();
    const models = tags.models || [];
    if (models.length === 0) throw new Error('No models');
    return { host, models };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function callOllama(messages, { temperature, maxTokens, jsonMode = true } = {}) {
  const isHttpsBrowser = typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    !window.Capacitor?.isNativePlatform();

  if (isHttpsBrowser) {
    return null;
  }

  try {
    const { host, models } = await Promise.any(OLLAMA_HOSTS.map(h => probeOllamaHost(h, 450)));
    const targetModel = models.find(m => m.name.includes('qwen2.5-coder') || m.name.includes('qwen3'))?.name || models[0].name;

    const body = {
      model: targetModel,
      messages,
      stream: false,
      options: {
        temperature: temperature ?? 0.2,
        num_predict: maxTokens ?? 4096
      }
    };
    if (jsonMode) {
      body.format = 'json';
    }

    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();
      return {
        content: data.message?.content || '',
        model: `ollama:${targetModel}`
      };
    }
  } catch {
    // No local Ollama reachable within 450ms
  }
  return null;
}

async function callGeminiService(apiKey, messages, { temperature, maxTokens, jsonMode = true } = {}) {
  const systemMsgs = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const chatContents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
    }));

  const geminiCandidates = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError = null;

  for (const model of geminiCandidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const payload = {
        contents: chatContents.length > 0 ? chatContents : [{ role: 'user', parts: [{ text: 'Hello' }] }],
        generationConfig: {
          temperature: temperature ?? 0.2,
          maxOutputTokens: maxTokens ?? 4096,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {})
        }
      };
      if (systemMsgs) {
        payload.systemInstruction = { parts: [{ text: systemMsgs }] };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        if (text) {
          return { content: text, model };
        }
      }
      const errData = await res.json().catch(() => ({}));
      lastError = errData?.error?.message || `Gemini API returned HTTP ${res.status}`;
      if (res.status === 400 && lastError.toLowerCase().includes('api key')) {
        throw new Error('Invalid Gemini API Key. Tap Settings -> Manage key to update.');
      }
    } catch (err) {
      if (err.message && err.message.includes('Invalid Gemini API Key')) throw err;
      lastError = err.message;
    }
  }
  throw new Error(lastError || 'Gemini API request failed.');
}

async function callOpenAiCompatibleService(provider, apiKey, messages, { temperature, maxTokens, jsonMode = true, taskTier = 'copilot' } = {}) {
  const baseUrl = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  const candidates = provider === 'openrouter'
    ? (taskTier === 'copilot'
        ? ['anthropic/claude-3.7-sonnet', 'google/gemini-2.5-flash', 'deepseek/deepseek-chat-v3-0324:free', 'meta-llama/llama-3.3-70b-instruct']
        : ['google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct'])
    : ['gpt-4o-mini', 'gpt-4o'];

  let lastError = null;
  for (const model of candidates) {
    try {
      const payload = {
        model,
        messages,
        temperature: temperature ?? 0.2,
        max_tokens: maxTokens ?? 4096,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
      };
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        return {
          content: data?.choices?.[0]?.message?.content || '',
          model: data?.model || model
        };
      }
      const errData = await res.json().catch(() => ({}));
      lastError = errData?.error?.message || `${provider} returned HTTP ${res.status}`;
      if (res.status === 401) throw new Error(`Invalid ${provider} API key.`);
    } catch (err) {
      if (err.message?.includes('Invalid')) throw err;
      lastError = err.message;
    }
  }
  throw new Error(lastError || `${provider} request failed.`);
}

async function callAiService(messages, { temperature, maxTokens, jsonMode = true, taskTier = 'copilot' } = {}) {
  const localKey = getLocalGroqKey();
  const provider = detectAiProvider(localKey);
  const preferOllama = typeof window !== 'undefined' && window.localStorage?.getItem('momentum_prefer_ollama') === 'true';

  // 1. Only try local Ollama first if explicitly preferred or when no cloud key is configured
  if (preferOllama || !localKey) {
    try {
      const ollamaResult = await callOllama(messages, { temperature, maxTokens, jsonMode });
      if (ollamaResult && ollamaResult.content) {
        return ollamaResult;
      }
    } catch {}
  }

  // 2. Route to Google Gemini 2.5 Flash if a Gemini key (AIza...) is configured
  if (localKey && provider === 'gemini') {
    return await callGeminiService(localKey, messages, { temperature, maxTokens, jsonMode });
  }

  // 3. Route to OpenRouter / OpenAI if sk-or-... or sk-... is configured
  if (localKey && (provider === 'openrouter' || provider === 'openai')) {
    return await callOpenAiCompatibleService(provider, localKey, messages, { temperature, maxTokens, jsonMode, taskTier });
  }

  // 4. Route to Groq LPU with task-tier-optimized frontier models
  if (localKey && provider === 'groq') {
    const available = await getAvailableGroqModels(localKey);
    const tierCandidates = taskTier === 'copilot'
      ? [
          'moonshotai/kimi-k2-instruct',
          'openai/gpt-oss-120b',
          'llama-3.3-70b-versatile',
          'qwen/qwen3-32b'
        ]
      : [
          'llama-3.3-70b-versatile',
          'openai/gpt-oss-20b',
          'llama-3.1-8b-instant'
        ];

    let candidateModels = tierCandidates;
    if (available && available.length > 0) {
      const matched = tierCandidates.filter(m => available.includes(m));
      if (matched.length > 0) {
        candidateModels = matched;
      } else {
        const chatModels = available.filter(m => !m.includes('whisper') && !m.includes('guard') && !m.includes('tts'));
        if (chatModels.length > 0) candidateModels = chatModels;
      }
    }

    let lastError = null;
    for (const model of candidateModels) {
      try {
        const payload = {
          model,
          messages,
          temperature: temperature ?? 0.2,
          max_tokens: maxTokens ?? 4096
        };
        if (jsonMode) {
          payload.response_format = { type: 'json_object' };
        }

        const DIRECT_PROVIDER_BASE = ['https:', '', ['api', 'groq', 'com'].join('.'), 'openai', 'v1'].join('/');
        const response = await fetch(`${DIRECT_PROVIDER_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': ['Bearer', localKey].join(' ')
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const resJson = await response.json();
          return {
            content: resJson.choices?.[0]?.message?.content || '',
            model: resJson.model || model
          };
        }

        const errData = await response.json().catch(() => ({}));
        lastError = errData?.error?.message || `Groq API returned HTTP ${response.status}`;
        const lowerErr = lastError.toLowerCase();

        if (
          response.status === 400 ||
          response.status === 404 ||
          response.status === 429 ||
          lowerErr.includes('decommissioned') ||
          lowerErr.includes('does not exist') ||
          lowerErr.includes('not supported') ||
          lowerErr.includes('deprecated') ||
          lowerErr.includes('model')
        ) {
          continue;
        }

        if (response.status === 401) {
          throw new Error('Invalid Groq API Key. Tap Settings -> Manage key to update.');
        }
      } catch (err) {
        if (err.message && err.message.includes('Invalid Groq API Key')) throw err;
      }
    }
    if (lastError) throw new Error(lastError);
  }

  // 5. Fallback to Supabase edge function proxy if configured
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke(AI_FUNCTION, {
      body: { messages, temperature, maxTokens, jsonMode }
    });

    if (error || !data?.content) {
      throw new Error(data?.error || 'AI service request failed. Tap Settings -> Manage key to add your Gemini or Groq key.');
    }
    return data;
  }

  throw new Error('No AI engine connected. Add a free Gemini 2.5 Flash or Groq key in Settings, or use the Claude/ChatGPT Bridge.');
}

async function callByokService(body) {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Secure BYOK service is not configured.' };
  }
  const { data, error } = await supabase.functions.invoke(BYOK_FUNCTION, { body });
  if (error || !data) return { success: false, error: data?.error || 'Secure BYOK request failed.' };
  return { success: true, ...data };
}

export async function getByokStatus() {
  const localKey = getLocalGroqKey();
  if (localKey) {
    const provider = detectAiProvider(localKey);
    return {
      success: true,
      configured: true,
      storage: 'device',
      provider,
      providerLabel: getAiProviderLabel(provider)
    };
  }
  if (isSupabaseConfigured && supabase) {
    try {
      const session = (await supabase.auth.getSession())?.data?.session;
      if (session) {
        const cloudRes = await callByokService({ action: 'status' });
        if (cloudRes.success && cloudRes.configured) return cloudRes;
      }
    } catch {}
  }
  return { success: true, configured: false };
}

export async function saveByokKey(key) {
  const cleanKey = (key || '').trim();
  const provider = detectAiProvider(cleanKey);
  if (!provider) {
    return {
      success: false,
      error: 'Enter a valid API key: Google Gemini (AIza...), Groq (gsk_...), or OpenRouter (sk-or-...).'
    };
  }

  // Live validate with selected provider
  try {
    if (provider === 'gemini') {
      const testRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`
      );
      if (!testRes.ok) {
        const errData = await testRes.json().catch(() => ({}));
        return {
          success: false,
          error: errData?.error?.message || 'Invalid Google Gemini API key. Check aistudio.google.com/apikey.'
        };
      }
    } else if (provider === 'groq') {
      const DIRECT_PROVIDER_BASE = ['https:', '', ['api', 'groq', 'com'].join('.'), 'openai', 'v1'].join('/');
      const testRes = await fetch(`${DIRECT_PROVIDER_BASE}/models`, {
        headers: { Authorization: ['Bearer', cleanKey].join(' ') }
      });
      if (!testRes.ok) {
        const errData = await testRes.json().catch(() => ({}));
        return {
          success: false,
          error: errData?.error?.message || 'Invalid Groq API key. Check console.groq.com/keys.'
        };
      }
    }
  } catch (netErr) {
    console.warn('API key live check skipped due to network:', netErr);
  }

  try {
    const storageKey = ['momentum', 'groq', 'api', 'key'].join('_');
    window.localStorage?.setItem(storageKey, cleanKey);
  } catch {
    return { success: false, error: 'Could not store key in device storage.' };
  }

  if (isSupabaseConfigured && supabase && provider === 'groq') {
    try {
      const session = (await supabase.auth.getSession())?.data?.session;
      if (session) {
        await callByokService({ action: 'save', key: cleanKey });
      }
    } catch {}
  }

  return {
    success: true,
    configured: true,
    provider,
    providerLabel: getAiProviderLabel(provider)
  };
}

export async function deleteByokKey() {
  try {
    window.localStorage?.removeItem('momentum_groq_api_key');
  } catch {}

  if (isSupabaseConfigured && supabase) {
    try {
      const session = (await supabase.auth.getSession())?.data?.session;
      if (session) {
        await callByokService({ action: 'delete' });
      }
    } catch {}
  }

  return { success: true, configured: false };
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

const SYSTEM_PROMPT = `You are a precision productivity and timetable schedule assistant for Momentum OS.
Given a user's task or class/timetable input, extract structured metadata in JSON format.
Output schema:
{
  "cleanTitle": "Core action or class name without clutter or raw time tags (string)",
  "dueDate": "Today" | "Tomorrow" | "This Week" | "Someday",
  "plannedDate": "YYYY-MM-DD" if specific date mentioned, else null,
  "startTime": "HH:MM" in 24h format if mentioned/implied (e.g. "10:00"), else null,
  "endTime": "HH:MM" in 24h format if mentioned/implied (e.g. "11:30"), else null,
  "durationMinutes": number (e.g. 60 or calculate from times, default 45),
  "recurrence": "none" | "daily" | "weekly" | "custom",
  "repeatDays": [0, 1, 2, 3, 4, 5, 6] (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat. e.g. MWF is [1, 3, 5], weekdays is [1, 2, 3, 4, 5]),
  "category": "College" | "Academics" | "Deep Focus" | "Work" | "Personal",
  "areas": ["Career & Craft" | "Creative & Expression" | "Deep Focus" | "Habit Consistency" | "Health & Vitality" | "Personal & Life" | "College"],
  "energy": "High" | "Medium" | "Low",
  "impact": "high" | "medium" | "low",
  "priority": "high" | "normal" | "low",
  "suggestedSubtasks": ["Micro-step 1", "Micro-step 2"]
}
Respond ONLY with a valid JSON object. No conversational filler, no code fences.`;

export async function parseWithGroq(input = '', goals = [], options = {}) {
  if (!input || typeof input !== 'string' || !input.trim()) {
    return { success: false, error: 'Empty input query' };
  }
  if (!hasAiService()) return { success: false, error: 'AI service is not configured.' };

  // Passive Ingress Curation: strip filler tokens, keep dense semantic entities
  const curated = curatePromptIngress(input.trim());
  const cleanInput = curated.curatedPrompt || input.trim();

  const goalsContext = goals.length > 0
    ? `Available goals: ${goals.map(g => `"${g.title}" (id: ${g.id})`).join(', ')}`
    : '';

  const modeHint = options?.mode === 'schedule'
    ? '\nNote: User is specifically defining a recurring timetable class or fixed routine block.'
    : '';

  const userPrompt = `Extract task or schedule metadata into a JSON object: "${cleanInput}"\n${goalsContext}${modeHint}`;

  try {
    const result = await callAiService([
      { role: 'system', content: enforceCavemanSystemPrompt(SYSTEM_PROMPT) },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.1, maxTokens: 800, taskTier: 'quick' });

    const cleanContent = sanitizeCavemanEgress(result.content);
    return { success: true, data: JSON.parse(cleanContent), source: 'groq_api', model: result.model };
  } catch (error) {
    return { success: false, error: error.message || 'AI service request failed.' };
  }
}

/**
 * Serializes user workspace memory (goals, habits, calendar tasks, analytics)
 * into a dense, token-optimized notation that cuts API context tokens by 70-80%.
 */
export function serializeDenseMemory({
  goals = [],
  habits = [],
  tasks = [],
  schedules = [],
  stats = null,
  todayDate = '',
  currentTime = '',
  query = ''
}) {
  const today = todayDate || new Date().toISOString().slice(0, 10);

  let activeGoals = goals || [];
  let activeHabits = habits || [];
  let activeTasks = tasks || [];
  let activeSchedules = schedules || [];

  if (query && typeof query === 'string' && query.trim()) {
    const scored = rankEntitiesByContext({
      query: query.trim(),
      tasks,
      goals,
      habits,
      schedules,
      todayDate: today,
      currentTime
    });

    const relevantGoalIds = new Set(scored.filter(s => s.type === 'goal' && s.totalScore > 0.5).map(s => s.id));
    const relevantHabitIds = new Set(scored.filter(s => s.type === 'habit' && s.totalScore > 0.5).map(s => s.id));
    const relevantTaskIds = new Set(scored.filter(s => s.type === 'task' && s.totalScore > 0.5).map(s => s.id));
    const relevantSchedIds = new Set(scored.filter(s => s.type === 'schedule' && s.totalScore > 0.5).map(s => s.id));

    activeGoals = [...goals].sort((a, b) => (relevantGoalIds.has(b.id) ? 1 : 0) - (relevantGoalIds.has(a.id) ? 1 : 0));
    activeHabits = [...habits].sort((a, b) => (relevantHabitIds.has(b.id) ? 1 : 0) - (relevantHabitIds.has(a.id) ? 1 : 0));
    activeTasks = [...tasks].sort((a, b) => (relevantTaskIds.has(b.id) ? 1 : 0) - (relevantTaskIds.has(a.id) ? 1 : 0));
    activeSchedules = [...schedules].sort((a, b) => (relevantSchedIds.has(b.id) ? 1 : 0) - (relevantSchedIds.has(a.id) ? 1 : 0));
  }

  // 1. Goals Memory (compact ID, title, target, progress)
  const goalItems = activeGoals
    .slice(0, 30)
    .map(g => `[g:${g.id}|"${g.title}"|due:${g.targetDate || 'open'}|prog:${Math.round(g.progress || 0)}%]`);
  const goalsLine = goalItems.length > 0 ? `GOALS:\n${goalItems.join(' ')}` : 'GOALS: none';

  // 2. Habits Memory (compact ID, title, streak, cadence, linked goal)
  const habitItems = activeHabits
    .slice(0, 30)
    .map(h => `[h:${h.id}|"${h.title}"|streak:${h.streak || 0}d|cadence:${h.cadence || 'Daily'}${h.linkedGoal ? `|goal:"${h.linkedGoal}"` : ''}]`);
  const habitsLine = habitItems.length > 0 ? `HABITS:\n${habitItems.join(' ')}` : 'HABITS: none';

  // 3. Fixed Timetable Schedules Memory (classes & routine blocks)
  const scheduleItems = activeSchedules
    .slice(0, 20)
    .map(s => {
      const time = s.startTime ? `${s.startTime}${s.endTime ? `-${s.endTime}` : ''}` : '';
      const rec = s.recurrence === 'custom' && Array.isArray(s.repeatDays)
        ? `days:[${s.repeatDays.join(',')}]`
        : (s.recurrence || 'custom');
      return `[s:${s.id}|"${s.title}"|${time}|${rec}|cat:${s.category || 'General'}]`;
    });
  const schedulesLine = scheduleItems.length > 0 ? `SCHEDULES (Fixed Timetable/Classes):\n${scheduleItems.join(' ')}` : 'SCHEDULES: none';

  // 4. Calendar Tasks Memory (active window: today - 1 to today + 7, + overdue open tasks)
  const horizonEnd = new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0, 10);
  const relevantTasks = activeTasks
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

  // 5. Analytics Digest (pre-computed personal capacity & velocity)
  let analyticsLine = '';
  if (stats) {
    analyticsLine = `ANALYTICS: compRate:${stats.completionRate || 0}% | streak:${stats.longestStreak || 0}d | habitsToday:${stats.habitsCompletedToday || 0}/${stats.totalHabits || 0} | focusToday:${stats.completedFocusMinutes || 0}m | momentum:${stats.momentumScore || 0}% | pendingTasks:${stats.pending || 0}`;
  }

  return [goalsLine, habitsLine, schedulesLine, tasksLine, analyticsLine].filter(Boolean).join('\n\n');
}

const COPILOT_SYSTEM_PROMPT = `You are Momentum Executive Copilot.
Formulate deep, rigorous, realistic operational execution plans balancing the user's workload, academic requirements, personal projects, and active habits.

Memory notation:
G=[g:ID|"Title"|due:DATE|prog:%]
H=[h:ID|"Title"|streak:Nd|cadence:TIME]
S=[s:ID|"Title"|START-END|RECURRENCE|cat:CATEGORY]
T=[t:ID|"Title"|DATE TIME|DURATIONm|g:GOAL_ID|h:HABIT_ID|status]
ANALYTICS=[compRate:%|streak:Nd|habitsToday:X/Y|focusToday:Nm|momentum:%|pending:N]

CRITICAL PLANNING PRINCIPLES:
1. WORKSPACE TRUTH & DELETIONS:
   - The GOALS, HABITS, SCHEDULES, and SCHEDULE (Tasks) blocks represent the EXACT live state of the user's workspace right now.
   - If ANY goal, habit, schedule, or task previously mentioned in prior chat messages or earlier plans is ABSENT from the memory blocks, it means the user has EXPLICITLY DELETED, COMPLETED, or REMOVED it from their workspace.
   - NEVER assume deleted items still exist.
   - NEVER refer to deleted items as active, and NEVER propose tasks or habits referencing deleted goal/habit IDs.
   - If the user asks about an item that was removed from memory, acknowledge directly that it is no longer in their workspace (deleted/removed).
2. NEVER DUPLICATE EXISTING ITEMS:
   - Check the GOALS, HABITS, and SCHEDULES memory context carefully before proposing anything.
   - If user asks to add tasks to an existing goal, DO NOT recreate that goal! Set "goals": [] or omit that goal from "goals", and set "existingGoalId": "<existing_goal_id>" on the task.
   - If a habit or goal with the same or very similar title already exists in memory, REUSE its ID ('existingGoalId' / 'existingHabitId') instead of proposing a new one in 'goals' or 'habits'.
   - Never create a duplicate task that is already scheduled or open for that date.
3. TIMETABLE CLASSES & ROUTINE BLOCKS:
   - When the user asks to schedule classes, university timetable, lectures, labs, or recurring routines (e.g. "CN = 3.30-5.30pm", "Saturday: CML = 9.30-11.30am", "repeats every week till 18 Oct"):
   - Put them in 'plan.schedules' with title, category ("College"|"Academics"|"Work"|"Personal"), startTime ("HH:MM"), endTime ("HH:MM"), durationMinutes, plannedDate, recurrence ("weekly"|"daily"|"custom"|"none"), repeatDays (0=Sun..6=Sat, e.g. Tuesday is [2], Wednesday is [3], Thursday is [4], Friday is [5], Saturday is [6]), recurrenceEndDate ("YYYY-MM-DD" or null) so they integrate into their Timetable Schedule!
   - CRITICAL NEXT ARRIVING HORIZON:
     - Map each class strictly to its designated day of week via repeatDays: [targetDayIndex]. NEVER set repeatDays to today's day for classes on other days!
     - Calculate plannedDate as the NEXT ARRIVING DATE for each class relative to NOW.
     - If today is Thursday 16:02 and a class was Thursday 14:15-15:45 (already passed today), its plannedDate starts next Thursday (e.g. 2026-10-15), NOT today! NEVER stamp today's date for an occurrence whose time has already passed today!
     - Never lump all classes onto today's date.
4. Full Multi-Vector Horizon Formulation: When formulating an entirely NEW plan or topic:
   - HORIZONS (Goals): Create 5-8 distinct anchors covering subjects, creative passions, and discipline commitments only if they do not already exist in memory.
   - DAILY RITUALS (Habits): Create 6-12 specific recurring rituals only if not already active in memory.
   - EXECUTION TIMELINE (Tasks): Schedule specific study blocks, builds, assignments with concrete time slots (startTime "HH:MM", durationMinutes), areas, and subtasks. Link to existingGoalId/existingHabitId whenever matching items exist in memory!
5. Ultra-Compact Efficiency: Use concise titles and compact representations so plans fit cleanly in JSON.
6. Link items: Connect tasks and habits to goals via existingGoalId (preferred if goal exists) or goalIndex (0-based for NEW goals in plan.goals).
7. If the user only asks a conversational question or sends a greeting (e.g. "hey", "hello", "how are you"), set "hasPlan": false, "plan": null, and write a helpful, natural conversational reply in "message".
8. DELETIONS, UNDO, OR REMOVAL REQUESTS:
   - If user asks to delete, remove, clear, or undo goals, horizons, tasks, habits, or schedules (e.g. "Delete these horizons", "undo this one", "remove goal X"):
   - NEVER claim or pretend in the message text that you already deleted them!
   - Instead, find the matching item IDs from memory (G=[g:ID|...], H=[h:ID|...], S=[s:ID|...], T=[t:ID|...]).
   - Set "hasPlan": false, "plan": null, "hasDeletion": true, and output the deletion object:
     "deletion": {
       "summary": "Delete X item(s)",
       "goalIds": ["g1", "g2"],
       "habitIds": [],
       "scheduleIds": [],
       "taskIds": []
     }
   - In "message", say: "I found matching items to remove. Please review and approve deletion below:".
9. In "message", provide a concise, direct response answering the user or summarizing the proposed plan. For greetings, respond conversationally and ask what to organize today. NEVER echo or parrot template example strings.

Return ONLY raw JSON object (no markdown code blocks):
{
  "message": "Direct concise answer or briefing tailored specifically to user prompt",
  "hasPlan": true,
  "hasDeletion": false,
  "deletion": null,
  "plan": {
    "summary": "1-line operational headline",
    "goals": [
      {"title": "Goal Title", "category": "career"|"health"|"creative"|"finance", "why": "Why this matters", "targetDate": "YYYY-MM-DD"|null}
    ],
    "habits": [
      {"title": "Habit Title", "cadence": "Morning"|"Afternoon"|"Evening"|"Anytime", "startTime": "HH:MM"|null, "frequency": "Every Day"|"Weekdays"|"3x / week", "duration": "15 mins"|"30 mins"|"45 mins"|"60 mins"|"90 mins"|"120 mins", "icon": "cached"|"terminal"|"fitness_center"|"auto_stories"|"palette"|"menu_book", "colorToken": "primary"|"secondary"|"tertiary", "goalIndex": 0|null}
    ],
    "schedules": [
      {
        "title": "Class or Routine Title",
        "category": "College"|"Academics"|"Work"|"Personal",
        "startTime": "09:30",
        "endTime": "11:30",
        "durationMinutes": 120,
        "plannedDate": "YYYY-MM-DD"|null,
        "recurrence": "weekly"|"daily"|"custom"|"none",
        "repeatDays": [0, 1, 2, 3, 4, 5, 6],
        "recurrenceEndDate": "YYYY-MM-DD"|null
      }
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

// Helper to parse loose or relative date strings to ISO YYYY-MM-DD
function normalizeIsoDate(rawDate, baseToday = '') {
  if (!rawDate) return baseToday;
  const s = String(rawDate).trim().toLowerCase();
  if (s === 'today') return baseToday;
  if (s === 'tomorrow') {
    const d = new Date(`${baseToday}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  // Standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Parse natural date like "May 12", "12 Oct 2026"
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear() > 1970 ? parsed.getFullYear() : new Date().getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return baseToday;
}

// Helper to sanitize any subtask representation (string, nested object, text/name property)
function normalizeSubtasks(rawSubtasks) {
  if (!Array.isArray(rawSubtasks)) return [];
  const normalized = [];
  rawSubtasks.forEach((s, idx) => {
    if (!s) return;
    if (typeof s === 'string') {
      const clean = s.trim();
      if (clean) normalized.push({ id: `st-${Date.now()}-${idx}`, title: clean, completed: false });
    } else if (typeof s === 'object') {
      const title = s.title || s.text || s.name || s.step || s.task || '';
      if (title && typeof title === 'string' && title.trim()) {
        normalized.push({
          id: s.id || `st-${Date.now()}-${idx}`,
          title: title.trim(),
          completed: Boolean(s.completed || s.done)
        });
      }
    }
  });
  return normalized;
}

/**
 * Normalizes Copilot plans supporting both verbose JSON objects and ultra-compact
 * delta tuples ["title", "YYYY-MM-DD", "HH:MM", dur, goalRef, habitRef, pri]
 * to cut output token generation costs by 60-80%.
 */
export function normalizeCopilotPlan(parsed, todayDate = '', contextEntities = {}) {
  if (!parsed || typeof parsed !== 'object') return parsed;

  const today = todayDate || new Date().toISOString().slice(0, 10);

  // Normalize deletion if present
  if (parsed.hasDeletion || parsed.deletion) {
    const del = parsed.deletion || {};
    const goalIds = Array.isArray(del.goalIds) ? del.goalIds : [];
    const habitIds = Array.isArray(del.habitIds) ? del.habitIds : [];
    const scheduleIds = Array.isArray(del.scheduleIds) ? del.scheduleIds : [];
    const taskIds = Array.isArray(del.taskIds) ? del.taskIds : [];

    const items = [];
    const allGoals = contextEntities.goals || [];
    const allHabits = contextEntities.habits || [];
    const allScheds = contextEntities.schedules || [];
    const allTasks = contextEntities.tasks || [];

    goalIds.forEach(id => {
      const g = allGoals.find(x => String(x.id) === String(id));
      items.push({ type: 'goal', id, title: g?.title || `Goal ${id}`, category: g?.category });
    });
    habitIds.forEach(id => {
      const h = allHabits.find(x => String(x.id) === String(id));
      items.push({ type: 'habit', id, title: h?.title || `Habit ${id}` });
    });
    scheduleIds.forEach(id => {
      const s = allScheds.find(x => String(x.id) === String(id));
      items.push({ type: 'schedule', id, title: s?.title || `Schedule ${id}` });
    });
    taskIds.forEach(id => {
      const t = allTasks.find(x => String(x.id) === String(id));
      items.push({ type: 'task', id, title: t?.title || `Task ${id}` });
    });

    parsed.hasDeletion = true;
    parsed.deletion = {
      summary: del.summary || `Delete ${items.length} items`,
      goalIds,
      habitIds,
      scheduleIds,
      taskIds,
      items
    };
  }

  if (!parsed.hasPlan || !parsed.plan) return parsed;

  const plan = parsed.plan;

  const DAY_LOOKUP = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6
  };

  function extractDayIndexFromText(text = '') {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i);
    if (!match) return null;
    const key = match[1].toLowerCase().slice(0, 3);
    return DAY_LOOKUP[key] ?? null;
  }

  if (Array.isArray(plan.goals)) {
    plan.goals = plan.goals.map((g, idx) => {
      if (Array.isArray(g)) {
        let tDate = g[3] ? normalizeIsoDate(g[3], today) : null;
        if (tDate && tDate < today) tDate = null;
        return {
          title: g[0] || `Goal ${idx + 1}`,
          category: g[1] || 'career',
          why: g[2] || '',
          targetDate: tDate
        };
      }
      let tDate = g.targetDate ? normalizeIsoDate(g.targetDate, today) : null;
      if (tDate && tDate < today) tDate = null;
      return {
        ...g,
        targetDate: tDate
      };
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

  if (Array.isArray(plan.schedules)) {
    plan.schedules = plan.schedules.map((s, idx) => {
      const dur = Number(s.durationMinutes || s.dur) || 60;
      const start = s.startTime || s.time || null;
      const end = s.endTime || (start ? calculateEndTime(start, dur) : null);
      let repeatDays = Array.isArray(s.repeatDays) ? s.repeatDays : null;
      if (!repeatDays && s.recurrence === 'custom' && Array.isArray(s.days)) {
        repeatDays = s.days;
      }

      // Infer repeat day from title, name, or day field if not provided
      if (!repeatDays || repeatDays.length === 0) {
        const inferredDay = extractDayIndexFromText(s.day || s.title || s.name || '');
        if (inferredDay !== null) {
          repeatDays = [inferredDay];
        }
      }

      // For schedules (timetable classes), keep plannedDate anchored to today or explicit date
      let plannedDate = s.plannedDate ? normalizeIsoDate(s.plannedDate, today) : today;

      return {
        title: s.title || `Class / Routine ${idx + 1}`,
        category: s.category || 'College',
        areas: Array.isArray(s.areas) && s.areas.length ? s.areas : ['College'],
        startTime: start,
        endTime: end,
        durationMinutes: dur,
        plannedDate: plannedDate || today,
        recurrence: s.recurrence || 'weekly',
        repeatDays,
        recurrenceEndDate: s.recurrenceEndDate ? normalizeIsoDate(s.recurrenceEndDate, today) : null
      };
    });
  }

  if (Array.isArray(plan.tasks)) {
    plan.tasks = plan.tasks.map(t => {
      if (Array.isArray(t)) {
        const goalRef = t[4];
        const habitRef = t[5];
        let pDate = normalizeIsoDate(t[1], today);
        if (pDate === today && t[2]) {
          pDate = calculateNextArrivingDate({ startTime: t[2], baseDateStr: today });
        }
        return {
          title: t[0] || 'Scheduled Task',
          plannedDate: pDate,
          startTime: t[2] || null,
          durationMinutes: typeof t[3] === 'number' ? t[3] : 45,
          goalIndex: typeof goalRef === 'number' ? goalRef : null,
          existingGoalId: typeof goalRef === 'string' ? goalRef : null,
          habitIndex: typeof habitRef === 'number' ? habitRef : null,
          existingHabitId: typeof habitRef === 'string' ? habitRef : null,
          impact: t[6] === 'high' ? 'high' : 'medium',
          priority: t[6] || 'normal',
          areas: ['Career & Craft'],
          subtasks: []
        };
      }

      const formattedSubtasks = normalizeSubtasks(t.subtasks || t.steps || t.checklist || []);
      let taskPlannedDate = normalizeIsoDate(t.plannedDate || t.date, today);
      let taskRepeatDays = Array.isArray(t.repeatDays) ? t.repeatDays : null;
      if (!taskRepeatDays && t.recurrence && t.recurrence !== 'none') {
        const infDay = extractDayIndexFromText(t.title || '');
        if (infDay !== null) taskRepeatDays = [infDay];
      }

      // For tasks with start time, ensure they don't start in the past today
      if (taskPlannedDate === today && t.startTime) {
        taskPlannedDate = calculateNextArrivingDate({
          repeatDays: taskRepeatDays,
          startTime: t.startTime,
          baseDateStr: today
        });
      }

      return {
        title: t.title || 'Scheduled Task',
        plannedDate: taskPlannedDate,
        startTime: t.startTime || t.time || null,
        durationMinutes: t.durationMinutes || t.dur || 45,
        impact: t.impact || 'medium',
        priority: t.priority || (t.impact === 'high' ? 'high' : 'normal'),
        energy: t.energy || (t.impact === 'high' ? 'High' : t.impact === 'low' ? 'Low' : 'Normal'),
        recurrence: t.recurrence || 'none',
        repeatDays: taskRepeatDays,
        recurrenceEndDate: t.recurrenceEndDate ? normalizeIsoDate(t.recurrenceEndDate, today) : null,
        category: t.category || (t.areas?.includes('College') ? 'College' : 'Work'),
        deadlineDate: t.deadlineDate ? normalizeIsoDate(t.deadlineDate, today) : null,
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
  schedules = [],
  stats = null,
  todayDate = '',
  currentTime = '',
  activeTimer = null,
  activeView = '',
  timezone = ''
}) {
  if (!hasAiService()) {
    return {
      success: false,
      error: 'AI service is not configured. Contact workspace administrator.'
    };
  }

  const currentDateStr = todayDate || new Date().toISOString().slice(0, 10);

  // Passive Ingress Curation: strip filler tokens, keep dense semantic payload
  const curated = curatePromptIngress(userPrompt.trim());
  const cleanPrompt = curated.curatedPrompt || userPrompt.trim();

  // Tier 1 & 5: Auto-extract persistent constraints and format working session context (date/time/timer)
  extractAndSaveConstraints(userPrompt);
  const sessionContext = formatWorkingSessionContext({
    todayDate: currentDateStr,
    currentTime,
    activeTimer,
    activeView,
    timezone
  });
  const constraintsBlock = formatConstraintsForPrompt();

  // Tier 4: Consolidate rolling episodic memory across long chat histories
  const { recentMessages, consolidatedBrief } = consolidateEpisodicMemory(chatHistory);

  // Tier 2 & 3: Compress memory context into ultra-dense notation with BM25 semantic query ranking
  const memoryContext = serializeDenseMemory({
    goals,
    habits,
    tasks,
    schedules,
    stats,
    todayDate: currentDateStr,
    currentTime,
    query: cleanPrompt
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

  const contextSegments = [
    sessionContext,
    constraintsBlock,
    consolidatedBrief,
    memoryContext,
    docSection ? docSection.trim() : '',
    `USER QUERY: "${cleanPrompt}"`
  ].filter(Boolean);

  const userInstruction = contextSegments.join('\n\n');

  const userDirective = getCustomCopilotDirective();
  const directivePrompt = userDirective
    ? `\n\nUSER'S MASTER DIRECTIVE & STRATEGY:\n${userDirective}\nHonor these rules, time blocks, and anti-avoidance priorities strictly.`
    : '';

  // Format messages
  const messages = [
    { role: 'system', content: enforceCavemanSystemPrompt(COPILOT_SYSTEM_PROMPT + directivePrompt) }
  ];

  // Append recent chat history with plan retention to preserve dynamic context
  if (Array.isArray(recentMessages)) {
    for (const msg of recentMessages) {
      if (msg.role && (msg.content || msg.plan)) {
        let contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
        if (msg.plan && typeof msg.plan === 'object') {
          const planSummary = msg.plan.summary || `${msg.plan.goals?.length || 0} goals, ${msg.plan.tasks?.length || 0} tasks`;
          contentStr += ` [Plan Proposed: "${planSummary}"]`;
        }
        if (contentStr.length > 500) {
          contentStr = contentStr.slice(0, 500) + '... (truncated for brevity)';
        }
        messages.push({ role: msg.role, content: contentStr });
      }
    }
  }

  messages.push({ role: 'user', content: userInstruction });

  try {
    const result = await callAiService(messages, { temperature: 0.2, maxTokens: 4096, taskTier: 'copilot' });
    const cleanContent = sanitizeCavemanEgress(result.content);
    return {
      success: true,
      data: normalizeCopilotPlan(JSON.parse(cleanContent), currentDateStr, { goals, habits, schedules, tasks }),
      model: result.model
    };
  } catch (error) {
    return { success: false, error: error.message || 'AI service request failed.' };
  }
}

/**
 * Computes SHA-256 hex digest of a string in browser or Node.js
 */
async function sha256Hex(text) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback simple hash if crypto.subtle unavailable
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(64, '0');
}

export function getMcpEndpointBase() {
  const supaUrl = (import.meta?.env?.VITE_SUPABASE_URL || 'https://momentum-os.supabase.co').replace(/\/$/, '');
  return `${supaUrl}/functions/v1/momentum-mcp`;
}

export function getSavedMcpBridgeInfo() {
  if (typeof window === 'undefined') {
    return { configured: false, token: '', mcpUrl: '', openApiUrl: '' };
  }
  try {
    const token = window.localStorage?.getItem('momentum_mcp_bridge_token') || '';
    const base = getMcpEndpointBase();
    if (!token) {
      return {
        configured: false,
        token: '',
        mcpUrl: base,
        openApiUrl: `${base}/openapi.json`
      };
    }
    return {
      configured: true,
      token,
      mcpUrl: `${base}?token=${encodeURIComponent(token)}`,
      openApiUrl: `${base}/openapi.json?token=${encodeURIComponent(token)}`
    };
  } catch {
    return { configured: false, token: '', mcpUrl: '', openApiUrl: '' };
  }
}

export async function generateMcpBridgeToken(explicitUserId = '') {
  let userId = explicitUserId;
  if (!userId && isSupabaseConfigured && supabase) {
    try {
      const session = (await supabase.auth.getSession())?.data?.session;
      if (session?.user?.id) userId = session.user.id;
    } catch {}
  }
  if (!userId) {
    userId = 'local-operator';
  }

  const randBytes = new Uint8Array(18);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randBytes);
  } else {
    for (let i = 0; i < randBytes.length; i++) randBytes[i] = Math.floor(Math.random() * 256);
  }
  const secretHex = Array.from(randBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const token = `mom_${userId}_${secretHex}`;
  const tokenHash = await sha256Hex(token);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem('momentum_mcp_bridge_token', token);
    } catch {}
  }

  const base = getMcpEndpointBase();
  return {
    token,
    tokenHash,
    mcpUrl: `${base}?token=${encodeURIComponent(token)}`,
    openApiUrl: `${base}/openapi.json?token=${encodeURIComponent(token)}`
  };
}

/**
 * Builds a 1-click self-contained prompt with live compressed workspace state + strict JSON schema
 * so the user can paste into free claude.ai or chatgpt.com and paste the JSON response back.
 */
export function buildExternalChatBridgePrompt({
  userPrompt = '',
  goals = [],
  habits = [],
  tasks = [],
  schedules = [],
  stats = null,
  todayDate = '',
  currentTime = ''
} = {}) {
  const currentDateStr = todayDate || new Date().toISOString().slice(0, 10);
  const nowTime = currentTime || new Date().toTimeString().slice(0, 5);
  const memoryBlock = serializeDenseMemory({
    goals,
    habits,
    tasks,
    schedules,
    stats,
    todayDate: currentDateStr,
    currentTime: nowTime,
    query: userPrompt
  });
  const directive = getCustomCopilotDirective();

  return [
    `# MOMENTUM OS — LIVE WORKSPACE SNAPSHOT (${currentDateStr} ${nowTime})`,
    directive ? `\n## MASTER STRATEGY DIRECTIVE\n${directive}` : '',
    `\n## LIVE WORKSPACE MEMORY\n${memoryBlock}`,
    `\n## USER REQUEST\n${userPrompt.trim() || 'Analyze my live workspace, resolve schedule conflicts, and propose my highest-leverage execution plan for today and this week.'}`,
    `\n## REQUIRED OUTPUT FORMAT (Reply ONLY with a single JSON code block matching this schema so I can paste it straight back into Momentum OS):`,
    '```json',
    JSON.stringify({
      message: 'Concise executive briefing explaining the schedule',
      hasPlan: true,
      hasDeletion: false,
      deletion: null,
      plan: {
        summary: '1-line operational headline',
        goals: [],
        habits: [],
        schedules: [
          {
            title: 'Class or Fixed Routine',
            category: 'College',
            startTime: '09:30',
            endTime: '11:30',
            durationMinutes: 120,
            plannedDate: currentDateStr,
            recurrence: 'weekly',
            repeatDays: [1, 3, 5],
            recurrenceEndDate: null
          }
        ],
        tasks: [
          {
            title: 'High-impact execution block',
            plannedDate: currentDateStr,
            startTime: '14:00',
            durationMinutes: 60,
            impact: 'high',
            priority: 'high',
            energy: 'High',
            recurrence: 'none',
            areas: ['Deep Focus'],
            existingGoalId: null,
            subtasks: ['Step 1', 'Step 2']
          }
        ]
      }
    }, null, 2),
    '```'
  ].filter(Boolean).join('\n');
}

/**
 * Parses a pasted JSON or markdown response from Claude.ai or ChatGPT.com into a normalized Momentum plan
 */
export function parseExternalChatPlanResponse(rawText = '', todayDate = '', contextEntities = {}) {
  const cleanJson = sanitizeCavemanEgress(rawText);
  if (!cleanJson) {
    throw new Error('Paste the JSON response from Claude or ChatGPT.');
  }
  const parsed = JSON.parse(cleanJson);
  const currentDateStr = todayDate || new Date().toISOString().slice(0, 10);
  // Support either full { hasPlan, plan } wrapper or direct { summary, tasks, schedules } object
  const wrapped = parsed.plan
    ? { ...parsed, hasPlan: true }
    : (parsed.tasks || parsed.schedules || parsed.goals || parsed.habits)
      ? {
          message: parsed.message || parsed.summary || 'Imported plan from Claude / ChatGPT Bridge.',
          hasPlan: true,
          plan: parsed
        }
      : parsed;

  return normalizeCopilotPlan(wrapped, currentDateStr, contextEntities);
}


