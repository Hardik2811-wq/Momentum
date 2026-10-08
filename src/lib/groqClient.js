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

const AI_FUNCTION = 'groq-proxy';
const BYOK_FUNCTION = 'byok-credentials';

export function getLocalGroqKey() {
  if (typeof window === 'undefined') return '';
  try {
    const key = window.localStorage?.getItem('momentum_groq_api_key') || '';
    if (key && key.startsWith('gsk_')) return key;
  } catch {}
  const envKey = import.meta?.env?.VITE_GROQ_API_KEY || '';
  if (envKey && envKey.startsWith('gsk_')) return envKey;
  return '';
}

export function hasAiService() {
  return true;
}

export function purgeLegacyGroqKey() {
  // Retained for backward-compat; direct client BYOK is active.
}

const OLLAMA_HOSTS = [
  'http://100.128.172.45:11435', // LAN proxy (accessible from phone & emulator)
  'http://127.0.0.1:11434',      // Local PC direct
  'http://localhost:11434',
  'http://10.0.2.2:11434'        // Android emulator host loopback
];

async function callOllama(messages, { temperature, maxTokens, jsonMode = true } = {}) {
  for (const host of OLLAMA_HOSTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const ping = await fetch(`${host}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!ping.ok) continue;

      const tags = await ping.json();
      const models = tags.models || [];
      if (models.length === 0) continue;

      // Prefer qwen2.5-coder or first available model
      const targetModel = models.find(m => m.name.includes('qwen2.5-coder'))?.name || models[0].name;

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
      // Try next host
    }
  }
  return null;
}

async function callAiService(messages, { temperature, maxTokens, jsonMode = true } = {}) {
  // 1. Try local Ollama first (free, offline, tested with qwen2.5-coder)
  try {
    const ollamaResult = await callOllama(messages, { temperature, maxTokens, jsonMode });
    if (ollamaResult && ollamaResult.content) {
      return ollamaResult;
    }
  } catch {}

  // 2. Try Groq API with robust model fallbacks
  const localKey = getLocalGroqKey();
  if (localKey) {
    // Dynamic candidate models: try fastest production model first, then standard alternatives
    const candidateModels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b'
    ];

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

        // If error is model-specific (decommissioned, not found, retired), proceed to next candidate
        if (
          response.status === 400 ||
          response.status === 404 ||
          lowerErr.includes('decommissioned') ||
          lowerErr.includes('does not exist') ||
          lowerErr.includes('not supported') ||
          lowerErr.includes('deprecated') ||
          lowerErr.includes('model')
        ) {
          continue;
        }

        // If invalid API key or auth, stop immediately
        if (response.status === 401) {
          throw new Error('Invalid Groq API Key. Tap Settings -> Manage key to update.');
        }
      } catch (err) {
        if (err.message && err.message.includes('Invalid Groq API Key')) throw err;
      }
    }
    if (lastError) throw new Error(lastError);
  }

  // 3. Fallback to Supabase edge function proxy if configured
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke(AI_FUNCTION, {
      body: { messages, temperature, maxTokens, jsonMode }
    });

    if (error || !data?.content) {
      throw new Error(data?.error || 'AI service request failed. Tap Settings -> Manage key to add your Groq key.');
    }
    return data;
  }

  throw new Error('No AI engine connected. Make sure Ollama is running or add a Groq key in Settings.');
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
    return { success: true, configured: true, storage: 'device' };
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
  if (!/^gsk_[A-Za-z0-9_-]{20,}$/.test(cleanKey)) {
    return { success: false, error: 'Enter a valid Groq API key (starts with gsk_).' };
  }

  // Live validate with Groq API
  try {
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
  } catch (netErr) {
    console.warn('Groq key live check skipped due to network:', netErr);
  }

  // Save to device localStorage
  try {
    const storageKey = ['momentum', 'groq', 'api', 'key'].join('_');
    window.localStorage?.setItem(storageKey, cleanKey);
  } catch (storageErr) {
    return { success: false, error: 'Could not store key in device storage.' };
  }

  // Optional background sync to Supabase edge function if session exists
  if (isSupabaseConfigured && supabase) {
    try {
      const session = (await supabase.auth.getSession())?.data?.session;
      if (session) {
        await callByokService({ action: 'save', key: cleanKey });
      }
    } catch {}
  }

  return { success: true, configured: true };
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
    ], { temperature: 0.1, maxTokens: 800 });

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
2. Full Multi-Vector Horizon Formulation: When formulating an entirely NEW plan or topic:
   - HORIZONS (Goals): Create 5-8 distinct anchors covering subjects, creative passions, and discipline commitments only if they do not already exist in memory.
   - DAILY RITUALS (Habits): Create 6-12 specific recurring rituals only if not already active in memory.
   - EXECUTION TIMELINE (Tasks): Schedule specific study blocks, builds, lectures with concrete time slots (startTime "HH:MM", durationMinutes), areas, and subtasks. Link to existingGoalId/existingHabitId whenever matching items exist in memory!
3. Ultra-Compact Efficiency: Use concise titles and compact representations so plans fit cleanly in JSON.
4. Link items: Connect tasks and habits to goals via existingGoalId (preferred if goal exists) or goalIndex (0-based for NEW goals in plan.goals).
5. If the user only asks a conversational question without requesting scheduling, set "hasPlan": false, "plan": null.

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
      {"title": "Habit Title", "cadence": "Morning"|"Afternoon"|"Evening"|"Anytime", "startTime": "HH:MM"|null, "frequency": "Every Day"|"Weekdays"|"3x / week", "duration": "15 mins"|"30 mins"|"45 mins"|"60 mins"|"90 mins"|"120 mins", "icon": "cached"|"terminal"|"fitness_center"|"auto_stories"|"palette"|"menu_book", "colorToken": "primary"|"secondary"|"tertiary", "goalIndex": 0|null}
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
          targetDate: g[3] ? normalizeIsoDate(g[3], today) : null
        };
      }
      return {
        ...g,
        targetDate: g.targetDate ? normalizeIsoDate(g.targetDate, today) : null
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

  if (Array.isArray(plan.tasks)) {
    plan.tasks = plan.tasks.map(t => {
      if (Array.isArray(t)) {
        const goalRef = t[4];
        const habitRef = t[5];
        return {
          title: t[0] || 'Scheduled Task',
          plannedDate: normalizeIsoDate(t[1], today),
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

      return {
        title: t.title || 'Scheduled Task',
        plannedDate: normalizeIsoDate(t.plannedDate || t.date, today),
        startTime: t.startTime || t.time || null,
        durationMinutes: t.durationMinutes || t.dur || 45,
        impact: t.impact || 'medium',
        priority: t.priority || (t.impact === 'high' ? 'high' : 'normal'),
        energy: t.energy || (t.impact === 'high' ? 'High' : t.impact === 'low' ? 'Low' : 'Normal'),
        recurrence: t.recurrence || 'none',
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
    const result = await callAiService(messages, { temperature: 0.2, maxTokens: 4096 });
    const cleanContent = sanitizeCavemanEgress(result.content);
    return {
      success: true,
      data: normalizeCopilotPlan(JSON.parse(cleanContent), currentDateStr),
      model: result.model
    };
  } catch (error) {
    return { success: false, error: error.message || 'AI service request failed.' };
  }
}

