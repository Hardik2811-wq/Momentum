import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mcp-session-id, accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store'
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
  });
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/* ──────────────── Time, Date & Recurrence Helpers ──────────────── */

function timeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutesToTime(mins: number): string {
  const norm = ((Math.floor(mins) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(norm / 60)).padStart(2, '0');
  const mm = String(norm % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const m = String(startTime || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '10:00';
  const total = (Number(m[1]) * 60 + Number(m[2]) + (Number(durationMinutes) || 60)) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

interface ReconcileOptions {
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  existingStartTime?: string | null;
  existingEndTime?: string | null;
  existingDurationMinutes?: number | null;
}

/**
 * Reconciles startTime, endTime, and durationMinutes so they never disagree.
 * Source of truth: startTime + durationMinutes.
 * In updates: if start or duration is patched, endTime is recomputed from start + duration.
 * Stale existing.endTime is NEVER allowed to inflate duration.
 * Blocks crossing midnight are handled by adding 24h to the end time.
 */
function reconcileTimeAndDuration(
  optsOrStartTime?: ReconcileOptions | string | null,
  paramEndTime?: string | null,
  paramDurationMinutes?: number | null
): { startTime: string; endTime: string; durationMinutes: number; warning?: string } {
  let startTime: string | null | undefined;
  let endTime: string | null | undefined;
  let durationMinutes: number | null | undefined;
  let existingStartTime: string | null | undefined;
  let existingEndTime: string | null | undefined;
  let existingDurationMinutes: number | null | undefined;

  if (optsOrStartTime && typeof optsOrStartTime === 'object') {
    startTime = optsOrStartTime.startTime;
    endTime = optsOrStartTime.endTime;
    durationMinutes = optsOrStartTime.durationMinutes;
    existingStartTime = optsOrStartTime.existingStartTime;
    existingEndTime = optsOrStartTime.existingEndTime;
    existingDurationMinutes = optsOrStartTime.existingDurationMinutes;
  } else {
    startTime = optsOrStartTime as string | null | undefined;
    endTime = paramEndTime;
    durationMinutes = paramDurationMinutes;
  }

  const hasExplicitStart = startTime !== undefined && startTime !== null && String(startTime).trim() !== '';
  const hasExplicitEnd = endTime !== undefined && endTime !== null && String(endTime).trim() !== '';
  const hasExplicitDur = durationMinutes !== undefined && durationMinutes !== null && !isNaN(Number(durationMinutes)) && Number(durationMinutes) > 0;

  // Resolve start time
  let start = hasExplicitStart ? String(startTime).trim() : (existingStartTime ? String(existingStartTime).trim() : '09:00');
  if (timeToMinutes(start) === null) start = '09:00';
  const startMins = timeToMinutes(start)!;

  let dur: number;
  let end: string;
  let warning: string | undefined;

  // Case 1: Start or Duration was explicitly provided, but End was NOT explicitly provided in patch
  if ((hasExplicitStart || hasExplicitDur) && !hasExplicitEnd) {
    const rawDur = hasExplicitDur
      ? Number(durationMinutes)
      : (existingDurationMinutes ? Number(existingDurationMinutes) : 45);
    dur = rawDur > 0 ? rawDur : 45;
    end = minutesToTime(startMins + dur);
  }
  // Case 2: Only End was explicitly provided in patch (Start & Duration not passed in patch)
  else if (hasExplicitEnd && !hasExplicitStart && !hasExplicitDur) {
    end = String(endTime).trim();
    let endMins = timeToMinutes(end);
    if (endMins === null) {
      dur = Number(existingDurationMinutes) || 45;
      end = minutesToTime(startMins + dur);
    } else {
      // Midnight crossing: if end <= start, add 24 hours
      const effectiveEndMins = endMins <= startMins ? endMins + 1440 : endMins;
      dur = Math.max(15, effectiveEndMins - startMins);
    }
  }
  // Case 3: Both Start and End explicitly provided, but NO duration
  else if (hasExplicitEnd && !hasExplicitDur) {
    end = String(endTime).trim();
    let endMins = timeToMinutes(end);
    if (endMins === null) {
      dur = 45;
      end = minutesToTime(startMins + dur);
    } else {
      const effectiveEndMins = endMins <= startMins ? endMins + 1440 : endMins;
      dur = Math.max(15, effectiveEndMins - startMins);
    }
  }
  // Case 4: Duration AND End both provided (or Start + End + Duration all provided)
  else if (hasExplicitDur) {
    dur = Number(durationMinutes);
    const computedEnd = minutesToTime(startMins + dur);
    if (hasExplicitEnd && String(endTime).trim() !== computedEnd) {
      warning = `Specified endTime "${endTime}" conflicted with startTime "${start}" + duration ${dur}m. Recomputed endTime to "${computedEnd}".`;
    }
    end = computedEnd;
  }
  // Case 5: Fallback default
  else {
    const rawDur = Number(existingDurationMinutes) || 45;
    dur = rawDur > 0 ? rawDur : 45;
    end = minutesToTime(startMins + dur);
  }

  return { startTime: start, endTime: end, durationMinutes: dur, warning };
}

/**
 * Normalizes weekday representations into canonical array: 0=Sun, 1=Mon, ..., 6=Sat.
 * Supports numbers (0-6 or ISO 1-7) and strings ('Mon', 'Monday', 'Wed', etc.).
 */
function normalizeRepeatDays(input: unknown): number[] {
  if (input === null || input === undefined) return [1, 3, 5];
  const arr = Array.isArray(input) ? input : [input];
  const nameMap: Record<string, number> = {
    sun: 0, sunday: 0, su: 0,
    mon: 1, monday: 1, mo: 1,
    tue: 2, tues: 2, tuesday: 2, tu: 2,
    wed: 3, wednesday: 3, we: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4, th: 4,
    fri: 5, friday: 5, fr: 5,
    sat: 6, saturday: 6, sa: 6
  };
  const result = new Set<number>();
  for (const item of arr) {
    if (typeof item === 'number') {
      if (item >= 0 && item <= 6) result.add(item);
      else if (item === 7) result.add(0); // ISO Mon=1..Sun=7 -> 0
    } else if (typeof item === 'string') {
      const lower = item.trim().toLowerCase();
      if (nameMap[lower] !== undefined) {
        result.add(nameMap[lower]);
      } else {
        const parsed = parseInt(lower, 10);
        if (!isNaN(parsed)) {
          if (parsed >= 0 && parsed <= 6) result.add(parsed);
          else if (parsed === 7) result.add(0);
        }
      }
    }
  }
  return Array.from(result).sort((a, b) => a - b);
}

function isValidDateFormat(str: unknown): boolean {
  if (typeof str !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str.trim()) && !isNaN(new Date(`${str}T12:00:00`).getTime());
}

function isValidTimeFormat(str: unknown): boolean {
  if (typeof str !== 'string') return false;
  return timeToMinutes(str) !== null;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Checks if a timetable schedule is active for a specific YYYY-MM-DD date.
 * Enforces startDate, endDate, recurrenceUntil, excludedDates, biweekly, and weekdays.
 */
function isScheduleActiveOnDate(sched: any, dateStr: string): boolean {
  if (!sched || !dateStr) return false;

  // 1. Single-occurrence skips & explicit date exclusions
  if (Array.isArray(sched.excludedDates) && sched.excludedDates.includes(dateStr)) return false;
  if (Array.isArray(sched.exceptions) && sched.exceptions.includes(dateStr)) return false;

  const repeatType = sched.recurrence || sched.repeat;
  const isRecurring = Boolean(repeatType && repeatType !== 'none' && repeatType !== 'never');

  // Explicit start date enforcement
  const startDate = sched.recurrenceStartDate || sched.startDate;
  if (startDate && dateStr < startDate) return false;

  // Explicit end date enforcement
  const endDate = sched.recurrenceEndDate || sched.endDate;
  if (endDate && dateStr > endDate) return false;
  if (sched.recurrenceUntil && dateStr >= sched.recurrenceUntil) return false;

  if (!isRecurring) {
    return sched.plannedDate === dateStr;
  }

  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d.getTime())) return false;
  const dayOfWeek = d.getDay();

  if (repeatType === 'daily' || repeatType === 'everyday') return true;
  if (repeatType === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (repeatType === 'weekends') return dayOfWeek === 0 || dayOfWeek === 6;

  if (repeatType === 'biweekly') {
    const anchorStr = startDate || sched.plannedDate || '2026-01-01';
    const anchor = new Date(`${anchorStr}T12:00:00`);
    if (!isNaN(anchor.getTime())) {
      const diffDays = Math.round((d.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      if (Math.abs(diffWeeks) % 2 !== 0) return false;
    }
    const days = normalizeRepeatDays(sched.repeatDays);
    return days.includes(dayOfWeek);
  }

  if (repeatType === 'weekly' || repeatType === 'custom') {
    const days = normalizeRepeatDays(sched.repeatDays);
    return days.includes(dayOfWeek);
  }

  return false;
}

/**
 * Checks if a task is scheduled for target YYYY-MM-DD date.
 */
function isTaskActiveOnDate(task: any, dateStr: string): boolean {
  if (!task || !dateStr) return false;
  if (task.isBacklog || task.dueDate === 'Someday') return false;

  if (task.plannedDate === dateStr || task.date === dateStr) return true;

  if (task.recurrence && task.recurrence !== 'none') {
    if (task.recurrenceStartDate && dateStr < task.recurrenceStartDate) return false;
    if (task.recurrenceEndDate && dateStr > task.recurrenceEndDate) return false;
    if (Array.isArray(task.excludedDates) && task.excludedDates.includes(dateStr)) return false;

    if (task.recurrence === 'daily') return true;
    const d = new Date(`${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return false;
    const dayOfWeek = d.getDay();
    if (task.recurrence === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
    if (Array.isArray(task.repeatDays)) {
      return normalizeRepeatDays(task.repeatDays).includes(dayOfWeek);
    }
  }

  return false;
}

/**
 * Detects time-window conflicts between any timed items (tasks or schedules).
 */
function detectCollisions(
  items: Array<{ id?: string; title?: string; startTime?: string | null; endTime?: string | null; durationMinutes?: number; itemType?: string }>
) {
  const timed = items
    .filter((i) => i.startTime)
    .map((i) => {
      const s = timeToMinutes(i.startTime || '');
      const d = Number(i.durationMinutes) || 45;
      return {
        id: i.id || 'unknown',
        title: i.title || 'Untitled',
        itemType: i.itemType || 'block',
        startMins: s,
        endMins: s !== null ? s + d : null,
        startTime: i.startTime,
        endTime: i.endTime || (s !== null ? minutesToTime(s + d) : null)
      };
    })
    .filter((i): i is { id: string; title: string; itemType: string; startMins: number; endMins: number; startTime: string; endTime: string } => i.startMins !== null && i.endMins !== null)
    .sort((a, b) => a.startMins - b.startMins);

  const conflicts: Array<{
    itemA: { id: string; title: string; itemType: string; timeWindow: string };
    itemB: { id: string; title: string; itemType: string; timeWindow: string };
    overlapMinutes: number;
    severity: 'hard' | 'soft';
    explanation: string;
  }> = [];

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (b.startMins < a.endMins) {
        const overlap = Math.min(a.endMins, b.endMins) - b.startMins;
        conflicts.push({
          itemA: { id: a.id, title: a.title, itemType: a.itemType, timeWindow: `${a.startTime}-${a.endTime}` },
          itemB: { id: b.id, title: b.title, itemType: b.itemType, timeWindow: `${b.startTime}-${b.endTime}` },
          overlapMinutes: overlap,
          severity: overlap >= 15 ? 'hard' : 'soft',
          explanation: `"${a.title}" overlaps with "${b.title}" by ${overlap} minutes.`
        });
      } else {
        break;
      }
    }
  }

  return conflicts;
}

/**
 * Detects duplicate schedules based on case-insensitive title and overlapping days/time.
 */
function findScheduleDuplicates(
  candidate: { title?: string; startTime?: string; repeatDays?: any[] },
  existingSchedules: any[],
  excludeId?: string
): any[] {
  if (!candidate?.title) return [];
  const candTitle = String(candidate.title).trim().toLowerCase();
  const candDays = normalizeRepeatDays(candidate.repeatDays);
  const candStart = candidate.startTime ? candidate.startTime.trim() : '';

  return existingSchedules.filter((s) => {
    if (excludeId && String(s.id) === String(excludeId)) return false;
    if (String(s.title || '').trim().toLowerCase() !== candTitle) return false;
    if (candStart && s.startTime && candStart !== s.startTime) return false;
    if (candDays.length > 0 && Array.isArray(s.repeatDays) && s.repeatDays.length > 0) {
      const sDays = normalizeRepeatDays(s.repeatDays);
      const sharesDay = candDays.some((d) => sDays.includes(d));
      if (!sharesDay) return false;
    }
    return true;
  });
}

/**
 * Renders expanded daily calendar view for date range [startDate, endDate].
 */
function renderCalendar(
  tasks: any[],
  schedules: any[],
  habits: any[],
  startDate: string,
  endDate: string,
  now = new Date()
) {
  const result: any[] = [];
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return result;

  const currentMins = now.getHours() * 60 + now.getMinutes();
  const todayStr = now.toISOString().slice(0, 10);

  const curr = new Date(start);
  let daysCount = 0;
  while (curr <= end && daysCount < 90) {
    const dStr = curr.toISOString().slice(0, 10);
    const dayOfWeek = curr.getDay();

    const daySchedules = schedules
      .filter((s) => isScheduleActiveOnDate(s, dStr))
      .map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category || 'College',
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        recurrence: s.recurrence || 'weekly',
        repeatDays: s.repeatDays || [],
        itemType: 'schedule'
      }));

    const dayTasks = tasks
      .filter((t) => isTaskActiveOnDate(t, dStr))
      .map((t) => ({
        id: t.id,
        title: t.title,
        startTime: t.startTime || null,
        endTime: t.endTime || null,
        durationMinutes: t.durationMinutes || 45,
        completed: Boolean(t.completed),
        scheduleId: t.scheduleId || t.linkedScheduleId || null,
        goalId: t.goalId || null,
        priority: t.priority || 'normal',
        itemType: 'task'
      }));

    const combinedItems = [...daySchedules, ...dayTasks];
    const collisions = detectCollisions(combinedItems);

    const past: any[] = [];
    const activeNow: any[] = [];
    const upcoming: any[] = [];

    for (const item of combinedItems) {
      if (!item.startTime) {
        upcoming.push(item);
        continue;
      }
      const sMins = timeToMinutes(item.startTime);
      const dur = Number(item.durationMinutes) || 45;
      const eMins = sMins !== null ? sMins + dur : 0;

      if (dStr < todayStr) {
        past.push({ ...item, status: 'past' });
      } else if (dStr > todayStr) {
        upcoming.push({ ...item, status: 'upcoming' });
      } else {
        if (sMins !== null && currentMins >= sMins && currentMins <= eMins) {
          activeNow.push({ ...item, status: 'active_now' });
        } else if (sMins !== null && currentMins < sMins) {
          upcoming.push({ ...item, status: 'upcoming' });
        } else {
          past.push({ ...item, status: 'passed' });
        }
      }
    }

    const dayHabits = habits.map((h) => ({
      id: h.id,
      title: h.title,
      cadence: h.cadence || 'Anytime',
      startTime: h.startTime || null,
      completed: Array.isArray(h.completedDays) && h.completedDays.includes(dStr)
    }));

    result.push({
      date: dStr,
      dayOfWeek,
      timeline: { past, activeNow, upcoming },
      schedules: daySchedules,
      tasks: dayTasks,
      habits: dayHabits,
      collisions
    });

    curr.setDate(curr.getDate() + 1);
    daysCount++;
  }

  return result;
}

/* ──────────────── MCP Tool Definitions ──────────────── */

const MCP_TOOLS = [
  {
    name: 'get_momentum_workspace',
    description:
      'Fetch live Momentum OS workspace state (tasks, timetable schedules, habits, goals). Pass optional startDate and endDate (or daysAhead) to render the full projected calendar with timeline classifications and conflict detection.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Optional YYYY-MM-DD target date (defaults to today).'
        },
        startDate: {
          type: 'string',
          description: 'Optional YYYY-MM-DD range start for projected calendar.'
        },
        endDate: {
          type: 'string',
          description: 'Optional YYYY-MM-DD range end for projected calendar.'
        },
        daysAhead: {
          type: 'number',
          description: 'Optional number of days ahead to render calendar from target date (e.g. 7, 14, 30).'
        }
      }
    }
  },
  {
    name: 'get_calendar_view',
    description:
      'Render the full day-by-day projected calendar for any date range, expanding recurring timetable blocks, tasks, habit check-ins, past/upcoming timelines, and collision warnings.',
    inputSchema: {
      type: 'object',
      required: ['startDate'],
      properties: {
        startDate: {
          type: 'string',
          description: 'YYYY-MM-DD start date of calendar view.'
        },
        endDate: {
          type: 'string',
          description: 'Optional YYYY-MM-DD end date (defaults to 7 days after startDate).'
        }
      }
    }
  },
  {
    name: 'detect_schedule_conflicts',
    description:
      'Analyze date or candidate block for overlapping time conflicts between schedules and tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Optional YYYY-MM-DD date to check (defaults to today).'
        },
        candidate: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            durationMinutes: { type: 'number' }
          }
        }
      }
    }
  },
  {
    name: 'manage_timetable',
    description:
      'Create, update, bulk-delete, skip single occurrences, or end recurring series of fixed timetable blocks (university classes, lectures, labs, work shifts). Enforces start/end dates, calculates synchronized durations, detects duplicates, validates fields, and supports dry-run preview.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete', 'skip_occurrence', 'exclude_dates', 'end_series'],
          description:
            'Operation: "create" new blocks, "update" existing by ID, "delete" by IDs or filter, "skip_occurrence" to skip a specific date, "exclude_dates" to exclude holidays/cancellations, "end_series" to stop recurrence from date forward.'
        },
        schedules: {
          type: 'array',
          description: 'List of timetable objects to create or update.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Schedule block ID (required for update).' },
              title: { type: 'string', description: 'Title of course/block (e.g. "CS301 Distributed Systems").' },
              category: { type: 'string', enum: ['College', 'Academics', 'Work', 'Personal'] },
              startTime: { type: 'string', description: '24h HH:MM start time (e.g. "09:30").' },
              endTime: { type: 'string', description: '24h HH:MM end time (e.g. "11:00").' },
              durationMinutes: { type: 'number', description: 'Duration in minutes. Auto-calculated if start & end provided.' },
              recurrence: { type: 'string', enum: ['weekly', 'daily', 'biweekly', 'weekdays', 'weekends', 'custom', 'none'] },
              repeatDays: {
                type: 'array',
                items: { type: ['number', 'string'] },
                description: 'Repeat days: numbers (0=Sun..6=Sat or ISO 1=Mon..7=Sun) or names ("Mon", "Wed").'
              },
              startDate: { type: 'string', description: 'YYYY-MM-DD start date (system-enforced).' },
              plannedDate: { type: 'string', description: 'YYYY-MM-DD anchor date.' },
              endDate: { type: 'string', description: 'YYYY-MM-DD end date (system-enforced).' },
              recurrenceEndDate: { type: 'string', description: 'Optional YYYY-MM-DD end date.' },
              excludedDates: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of YYYY-MM-DD dates to exclude from recurrence (holidays, cancelled classes).'
              },
              notes: { type: 'string' }
            }
          }
        },
        scheduleIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of schedules to delete or modify.'
        },
        filter: {
          type: 'object',
          description: 'Bulk deletion filter: matches title, category, dayOfWeek, or dateRange.',
          properties: {
            title: { type: 'string' },
            titleContains: { type: 'string' },
            category: { type: 'string' },
            dayOfWeek: { type: 'number' },
            dateRange: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' }
              }
            }
          }
        },
        date: {
          type: 'string',
          description: 'Target YYYY-MM-DD date for skip_occurrence.'
        },
        dates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of YYYY-MM-DD dates for exclude_dates.'
        },
        untilDate: {
          type: 'string',
          description: 'YYYY-MM-DD date from which the series ends (for end_series).'
        },
        fromDate: {
          type: 'string',
          description: 'Alias for untilDate.'
        },
        allowDuplicates: {
          type: 'boolean',
          description: 'Set true to bypass duplicate title/time warning on creation.'
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, simulates changes and checks conflicts without modifying the database.'
        }
      }
    }
  },
  {
    name: 'schedule_tasks',
    description:
      'Create, update in-place, time-block, complete, or delete tasks. Supports linking tasks to timetable classes via scheduleId, field validation, and dry-run preview.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'complete', 'delete']
        },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Task ID (required for update).' },
              title: { type: 'string' },
              plannedDate: { type: 'string', description: 'YYYY-MM-DD date.' },
              startTime: { type: 'string', description: '24h HH:MM start time.' },
              endTime: { type: 'string', description: '24h HH:MM end time.' },
              durationMinutes: { type: 'number' },
              priority: { type: 'string', enum: ['high', 'normal', 'low'] },
              impact: { type: 'string', enum: ['high', 'medium', 'low'] },
              energy: { type: 'string', enum: ['High', 'Medium', 'Low'] },
              goalId: { type: 'string', description: 'Linked Goal ID.' },
              linkedHabitId: { type: 'string', description: 'Linked Habit ID.' },
              scheduleId: { type: 'string', description: 'Linked Timetable Schedule ID (e.g. study session attached to class).' },
              linkedScheduleId: { type: 'string', description: 'Alias for scheduleId.' },
              areas: { type: 'array', items: { type: 'string' } },
              subtasks: { type: 'array', items: { type: 'string' } },
              progress: { type: 'number', description: '0 to 100 percentage.' }
            }
          }
        },
        taskIds: {
          type: 'array',
          items: { type: 'string' }
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, returns preview without persisting changes.'
        }
      }
    }
  },
  {
    name: 'manage_habits',
    description: 'Create, update in-place, check-in, or delete daily habits in Momentum OS.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'checkin', 'delete'] },
        habits: { type: 'array', items: { type: 'object' } },
        habitIds: { type: 'array', items: { type: 'string' } },
        date: { type: 'string' }
      }
    }
  },
  {
    name: 'manage_goals',
    description: 'Create, update in-place progress & dates, or delete strategic goals in Momentum OS.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'delete'] },
        goals: { type: 'array', items: { type: 'object' } },
        goalIds: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  {
    name: 'apply_executive_plan',
    description:
      'Atomically apply a full multi-horizon execution plan (goals, habits, timetable schedules, tasks, in-place updates, completions, and deletions). Includes automatic undo snapshot creation and dryRun preview.',
    inputSchema: {
      type: 'object',
      properties: {
        planSummary: { type: 'string', description: 'Short headline describing plan changes.' },
        goals: { type: 'array', items: { type: 'object' } },
        habits: { type: 'array', items: { type: 'object' } },
        schedules: { type: 'array', items: { type: 'object' } },
        tasks: { type: 'array', items: { type: 'object' } },
        updateGoals: { type: 'array', items: { type: 'object' }, description: 'In-place edits for existing goals.' },
        updateHabits: { type: 'array', items: { type: 'object' }, description: 'In-place edits for existing habits.' },
        updateSchedules: { type: 'array', items: { type: 'object' }, description: 'In-place edits for existing schedules.' },
        updateTasks: { type: 'array', items: { type: 'object' }, description: 'In-place edits for existing tasks.' },
        completeTaskIds: { type: 'array', items: { type: 'string' }, description: 'Task IDs to mark completed directly.' },
        deleteGoalIds: { type: 'array', items: { type: 'string' } },
        deleteHabitIds: { type: 'array', items: { type: 'string' } },
        deleteScheduleIds: { type: 'array', items: { type: 'string' } },
        deleteTaskIds: { type: 'array', items: { type: 'string' } },
        allowDuplicates: { type: 'boolean' },
        dryRun: { type: 'boolean', description: 'If true, simulates changes without persisting to database.' }
      }
    }
  },
  {
    name: 'undo_workspace_change',
    description: 'Revert the workspace to the snapshot before the most recent modification. Restores tasks, schedules, goals, and habits.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

/* ──────────────── Authentication ──────────────── */

async function authenticateRequest(request: Request, admin: ReturnType<typeof createClient>) {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token') ?? '';
  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const rawToken = (queryToken || bearerToken).trim();

  if (!rawToken) {
    return { error: 'Missing Momentum Bridge token. Pass ?token=mom_... or Authorization: Bearer mom_...' };
  }

  // Case 1: Personal Momentum Bridge Token: mom_<uuid>_<secret>
  const bridgeMatch = rawToken.match(/^mom_([0-9a-fA-F-]{36})_([A-Za-z0-9_-]{16,})$/);
  if (bridgeMatch) {
    const userId = bridgeMatch[1];
    const { data } = await admin
      .from('workspace_snapshots')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();

    const expectedHash = data?.data?.settings?.mcpBridgeTokenHash;
    const candidateHash = await sha256Hex(rawToken);

    if (expectedHash && typeof expectedHash === 'string' && !timingSafeEqual(candidateHash, expectedHash)) {
      return { error: 'Invalid or revoked Momentum Bridge token.' };
    }

    if (!expectedHash && data?.data) {
      try {
        const patchedData = {
          ...data.data,
          settings: {
            ...(data.data.settings || {}),
            mcpBridgeTokenHash: candidateHash,
            mcpBridgeUpdatedAt: new Date().toISOString()
          }
        };
        await admin.from('workspace_snapshots').upsert({
          user_id: userId,
          data: patchedData,
          version: Date.now(),
          updated_at: new Date().toISOString()
        });
        return { userId, workspace: patchedData };
      } catch {}
    }

    const workspaceData = data?.data || { tasks: [], goals: [], habits: [], schedules: [], reflections: {}, settings: {}, focusSessions: [] };
    return { userId, workspace: workspaceData };
  }

  // Case 2: Standard Supabase Auth JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${rawToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return { error: 'Invalid authentication token.' };
  }

  const { data } = await admin
    .from('workspace_snapshots')
    .select('data')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  return {
    userId: userData.user.id,
    workspace: data?.data || { tasks: [], goals: [], habits: [], schedules: [], reflections: {}, settings: {}, focusSessions: [] }
  };
}

/* ──────────────── Core Tool Execution ──────────────── */

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  workspace: Record<string, any>,
  admin: ReturnType<typeof createClient>
) {
  const today = new Date().toISOString().slice(0, 10);
  const tasks: any[] = Array.isArray(workspace.tasks) ? [...workspace.tasks] : [];
  const goals: any[] = Array.isArray(workspace.goals) ? [...workspace.goals] : [];
  const habits: any[] = Array.isArray(workspace.habits) ? [...workspace.habits] : [];
  const schedules: any[] = Array.isArray(workspace.schedules) ? [...workspace.schedules] : [];

  const saveWorkspace = async (
    nextTasks = tasks,
    nextGoals = goals,
    nextHabits = habits,
    nextSchedules = schedules,
    actionSummary = ''
  ) => {
    // Retain up to 5 snapshots in undo history
    const prevSnapshot = {
      tasks: [...tasks],
      goals: [...goals],
      habits: [...habits],
      schedules: [...schedules]
    };
    const history = Array.isArray(workspace._undoHistory) ? [...workspace._undoHistory] : [];
    history.unshift({
      timestamp: Date.now(),
      summary: actionSummary || 'Workspace modification',
      snapshot: prevSnapshot
    });
    if (history.length > 5) history.length = 5;

    const updatedData = {
      ...workspace,
      tasks: nextTasks,
      goals: nextGoals,
      habits: nextHabits,
      schedules: nextSchedules,
      _undoHistory: history,
      _mcpUpdated: Date.now()
    };
    const { error } = await admin.from('workspace_snapshots').upsert({
      user_id: userId,
      version: 1,
      data: updatedData
    });
    if (error) throw new Error(`Failed to persist workspace: ${error.message}`);
    return updatedData;
  };

  /* ── 1. get_momentum_workspace ── */
  if (toolName === 'get_momentum_workspace') {
    const targetDate = typeof args.date === 'string' && args.date ? args.date : today;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    // Timeline partitioning for target date
    const daySchedules = schedules
      .filter((s) => isScheduleActiveOnDate(s, targetDate))
      .map((s) => ({ ...s, itemType: 'schedule' }));
    const dayTasks = tasks
      .filter((t) => isTaskActiveOnDate(t, targetDate))
      .map((t) => ({ ...t, itemType: 'task' }));

    const combined = [...daySchedules, ...dayTasks];
    const conflicts = detectCollisions(combined);

    const past: any[] = [];
    const activeNow: any[] = [];
    const upcoming: any[] = [];

    for (const item of combined) {
      if (!item.startTime) {
        upcoming.push(item);
        continue;
      }
      const sMins = timeToMinutes(item.startTime);
      const dur = Number(item.durationMinutes) || 45;
      const eMins = sMins !== null ? sMins + dur : 0;

      if (targetDate < today) {
        past.push({ ...item, status: 'past' });
      } else if (targetDate > today) {
        upcoming.push({ ...item, status: 'upcoming' });
      } else {
        if (sMins !== null && currentMins >= sMins && currentMins <= eMins) {
          activeNow.push({ ...item, status: 'active_now' });
        } else if (sMins !== null && currentMins < sMins) {
          upcoming.push({ ...item, status: 'upcoming' });
        } else {
          past.push({ ...item, status: 'passed' });
        }
      }
    }

    // Optional projected calendar range
    let renderedCalendar: any[] | null = null;
    const rangeStart = typeof args.startDate === 'string' ? args.startDate : (typeof args.daysAhead === 'number' ? targetDate : null);
    const rangeEnd = typeof args.endDate === 'string' ? args.endDate : (typeof args.daysAhead === 'number' ? addDays(targetDate, Number(args.daysAhead)) : null);
    if (rangeStart && rangeEnd) {
      renderedCalendar = renderCalendar(tasks, schedules, habits, rangeStart, rangeEnd, now);
    }

    return {
      todayDate: today,
      targetDate,
      counts: {
        tasks: tasks.length,
        openTasks: tasks.filter((t) => !t.completed).length,
        goals: goals.length,
        habits: habits.length,
        schedules: schedules.length
      },
      timeline: { past, activeNow, upcoming },
      conflicts,
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        category: g.category,
        progress: g.progress ?? 0,
        targetDate: g.targetDate || 'open',
        why: g.why || ''
      })),
      habits: habits.map((h) => ({
        id: h.id,
        title: h.title,
        cadence: h.cadence || 'Anytime',
        startTime: h.startTime || null,
        duration: h.duration || '30 mins',
        targetFrequency: h.targetFrequency || 'Every Day',
        graceDays: h.graceDays ?? 0,
        completedToday: Array.isArray(h.completedDays) && h.completedDays.includes(targetDate),
        linkedGoal: h.linkedGoal || null
      })),
      schedules: schedules.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category || 'College',
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        recurrence: s.recurrence || 'weekly',
        repeatDays: s.repeatDays || [],
        startDate: s.startDate || s.recurrenceStartDate || s.plannedDate || today,
        endDate: s.endDate || s.recurrenceEndDate || null,
        excludedDates: s.excludedDates || []
      })),
      tasks: tasks.slice(0, 60).map((t) => ({
        id: t.id,
        title: t.title,
        plannedDate: t.plannedDate || today,
        startTime: t.startTime || null,
        endTime: t.endTime || null,
        durationMinutes: t.durationMinutes || 45,
        completed: Boolean(t.completed),
        priority: t.priority || 'normal',
        impact: t.impact || 'medium',
        goalId: t.goalId || null,
        scheduleId: t.scheduleId || t.linkedScheduleId || null,
        linkedHabitId: t.linkedHabitId || null,
        areas: t.areas || []
      })),
      ...(renderedCalendar ? { renderedCalendar } : {})
    };
  }

  /* ── 2. get_calendar_view ── */
  if (toolName === 'get_calendar_view') {
    const startDate = typeof args.startDate === 'string' && args.startDate ? args.startDate : today;
    const endDate = typeof args.endDate === 'string' && args.endDate ? args.endDate : addDays(startDate, 7);
    const rendered = renderCalendar(tasks, schedules, habits, startDate, endDate);
    return {
      startDate,
      endDate,
      totalDays: rendered.length,
      days: rendered
    };
  }

  /* ── 3. detect_schedule_conflicts ── */
  if (toolName === 'detect_schedule_conflicts') {
    const targetDate = typeof args.date === 'string' && args.date ? args.date : today;
    const activeScheds = schedules.filter((s) => isScheduleActiveOnDate(s, targetDate)).map((s) => ({ ...s, itemType: 'schedule' }));
    const activeTasks = tasks.filter((t) => isTaskActiveOnDate(t, targetDate)).map((t) => ({ ...t, itemType: 'task' }));

    const items = [...activeScheds, ...activeTasks];
    if (args.candidate && typeof args.candidate === 'object') {
      const cand = args.candidate as any;
      const reconciled = reconcileTimeAndDuration(cand.startTime, cand.endTime, cand.durationMinutes);
      items.push({
        id: 'candidate-probe',
        title: cand.title || 'Proposed Block',
        startTime: reconciled.startTime,
        endTime: reconciled.endTime,
        durationMinutes: reconciled.durationMinutes,
        itemType: 'candidate'
      });
    }

    const conflicts = detectCollisions(items);
    return {
      date: targetDate,
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      conflicts
    };
  }

  /* ── 4. manage_timetable ── */
  if (toolName === 'manage_timetable') {
    const action = String(args.action || 'create');
    const isDryRun = Boolean(args.dryRun);
    const allowDuplicates = Boolean(args.allowDuplicates);
    let nextSchedules = [...schedules];

    if (action === 'delete') {
      const targetIds = new Set(Array.isArray(args.scheduleIds) ? args.scheduleIds.map(String) : []);
      const filter = args.filter as any;

      if (filter && typeof filter === 'object') {
        for (const s of schedules) {
          if (filter.title && String(s.title || '').toLowerCase() !== String(filter.title).toLowerCase()) continue;
          if (filter.titleContains && !String(s.title || '').toLowerCase().includes(String(filter.titleContains).toLowerCase())) continue;
          if (filter.category && String(s.category || '').toLowerCase() !== String(filter.category).toLowerCase()) continue;
          if (filter.dayOfWeek !== undefined && Array.isArray(s.repeatDays) && !s.repeatDays.includes(Number(filter.dayOfWeek))) continue;
          if (filter.dateRange?.from && s.plannedDate && s.plannedDate < filter.dateRange.from) continue;
          if (filter.dateRange?.to && s.plannedDate && s.plannedDate > filter.dateRange.to) continue;
          targetIds.add(String(s.id));
        }
      }

      if (targetIds.size === 0) {
        return { success: false, error: 'No schedule IDs or matching filter provided for deletion.' };
      }

      const deletedItems = nextSchedules.filter((s) => targetIds.has(String(s.id)));
      if (!isDryRun) {
        nextSchedules = nextSchedules.filter((s) => !targetIds.has(String(s.id)));
        await saveWorkspace(tasks, goals, habits, nextSchedules, `Deleted ${deletedItems.length} timetable schedules`);
      }

      return {
        success: true,
        action: 'delete',
        dryRun: isDryRun,
        deletedIds: Array.from(targetIds),
        deletedCount: deletedItems.length,
        deletedSchedules: deletedItems.map((s) => ({ id: s.id, title: s.title })),
        totalSchedules: nextSchedules.length
      };
    }

    if (action === 'skip_occurrence') {
      const targetId = String(args.scheduleId || (Array.isArray(args.scheduleIds) && args.scheduleIds[0]) || '');
      const skipDate = String(args.date || today);
      if (!targetId) return { success: false, error: 'scheduleId required for skip_occurrence.' };
      if (!isValidDateFormat(skipDate)) return { success: false, error: `Invalid date "${skipDate}". Expected YYYY-MM-DD.` };

      const targetSched = nextSchedules.find((s) => String(s.id) === targetId);
      if (!targetSched) return { success: false, error: `Schedule with id "${targetId}" not found.` };

      const existingExcluded = Array.isArray(targetSched.excludedDates) ? [...targetSched.excludedDates] : [];
      if (!existingExcluded.includes(skipDate)) {
        existingExcluded.push(skipDate);
      }

      const updated = { ...targetSched, excludedDates: existingExcluded };
      if (!isDryRun) {
        nextSchedules = nextSchedules.map((s) => (String(s.id) === targetId ? updated : s));
        await saveWorkspace(tasks, goals, habits, nextSchedules, `Skipped occurrence for "${targetSched.title}" on ${skipDate}`);
      }

      return {
        success: true,
        action: 'skip_occurrence',
        dryRun: isDryRun,
        scheduleId: targetId,
        skippedDate: skipDate,
        excludedDates: existingExcluded,
        schedule: updated
      };
    }

    if (action === 'exclude_dates') {
      const targetId = String(args.scheduleId || (Array.isArray(args.scheduleIds) && args.scheduleIds[0]) || '');
      const datesToExclude = Array.isArray(args.dates) ? args.dates.map(String) : (args.date ? [String(args.date)] : []);
      if (!targetId) return { success: false, error: 'scheduleId required for exclude_dates.' };
      if (datesToExclude.length === 0) return { success: false, error: 'dates array required for exclude_dates.' };

      const targetSched = nextSchedules.find((s) => String(s.id) === targetId);
      if (!targetSched) return { success: false, error: `Schedule with id "${targetId}" not found.` };

      const existingExcluded = new Set(Array.isArray(targetSched.excludedDates) ? targetSched.excludedDates : []);
      for (const d of datesToExclude) {
        if (isValidDateFormat(d)) existingExcluded.add(d);
      }

      const updated = { ...targetSched, excludedDates: Array.from(existingExcluded) };
      if (!isDryRun) {
        nextSchedules = nextSchedules.map((s) => (String(s.id) === targetId ? updated : s));
        await saveWorkspace(tasks, goals, habits, nextSchedules, `Excluded ${datesToExclude.length} dates from "${targetSched.title}"`);
      }

      return {
        success: true,
        action: 'exclude_dates',
        dryRun: isDryRun,
        scheduleId: targetId,
        excludedDates: Array.from(existingExcluded),
        schedule: updated
      };
    }

    if (action === 'end_series') {
      const targetId = String(args.scheduleId || (Array.isArray(args.scheduleIds) && args.scheduleIds[0]) || '');
      const untilDate = String(args.untilDate || args.fromDate || today);
      if (!targetId) return { success: false, error: 'scheduleId required for end_series.' };
      if (!isValidDateFormat(untilDate)) return { success: false, error: `Invalid untilDate "${untilDate}". Expected YYYY-MM-DD.` };

      const targetSched = nextSchedules.find((s) => String(s.id) === targetId);
      if (!targetSched) return { success: false, error: `Schedule with id "${targetId}" not found.` };

      const updated = { ...targetSched, recurrenceEndDate: untilDate, endDate: untilDate };
      if (!isDryRun) {
        nextSchedules = nextSchedules.map((s) => (String(s.id) === targetId ? updated : s));
        await saveWorkspace(tasks, goals, habits, nextSchedules, `Ended series "${targetSched.title}" on ${untilDate}`);
      }

      return {
        success: true,
        action: 'end_series',
        dryRun: isDryRun,
        scheduleId: targetId,
        recurrenceEndDate: untilDate,
        schedule: updated
      };
    }

    if (action === 'update') {
      const inputSchedules = Array.isArray(args.schedules) ? args.schedules : [];
      if (inputSchedules.length === 0) {
        return { success: false, error: 'schedules array required for update action.' };
      }

      const updatedSchedules: any[] = [];
      const validationErrors: string[] = [];

      for (let i = 0; i < inputSchedules.length; i++) {
        const patch = inputSchedules[i] as any;
        if (!patch?.id) {
          validationErrors.push(`Schedule patch at index ${i} is missing "id".`);
          continue;
        }

        const existing = nextSchedules.find((s) => String(s.id) === String(patch.id));
        if (!existing) {
          validationErrors.push(`Schedule with id "${patch.id}" does not exist.`);
          continue;
        }

        if (patch.startTime && !isValidTimeFormat(patch.startTime)) {
          validationErrors.push(`Invalid startTime "${patch.startTime}" at index ${i}. Expected 24h format HH:MM.`);
        }
        if (patch.endTime && !isValidTimeFormat(patch.endTime)) {
          validationErrors.push(`Invalid endTime "${patch.endTime}" at index ${i}. Expected 24h format HH:MM.`);
        }
        if (patch.startDate && !isValidDateFormat(patch.startDate)) {
          validationErrors.push(`Invalid startDate "${patch.startDate}" at index ${i}. Expected YYYY-MM-DD.`);
        }
        if (patch.endDate && !isValidDateFormat(patch.endDate)) {
          validationErrors.push(`Invalid endDate "${patch.endDate}" at index ${i}. Expected YYYY-MM-DD.`);
        }

        const reconciled = reconcileTimeAndDuration({
          startTime: patch.startTime,
          endTime: patch.endTime,
          durationMinutes: patch.durationMinutes,
          existingStartTime: existing.startTime,
          existingEndTime: existing.endTime,
          existingDurationMinutes: existing.durationMinutes
        });

        const repeatDays = patch.repeatDays !== undefined ? normalizeRepeatDays(patch.repeatDays) : existing.repeatDays;
        const startDate = patch.startDate || patch.plannedDate || existing.startDate || existing.plannedDate;
        const endDate = patch.endDate || patch.recurrenceEndDate || existing.endDate || existing.recurrenceEndDate || null;

        if (startDate && endDate && startDate > endDate) {
          validationErrors.push(`startDate "${startDate}" cannot be after endDate "${endDate}" at index ${i}.`);
        }

        const merged = {
          ...existing,
          ...patch,
          title: patch.title !== undefined ? String(patch.title).trim() : existing.title,
          category: patch.category || existing.category || 'College',
          areas: [patch.category || existing.category || 'College'],
          startTime: reconciled.startTime,
          endTime: reconciled.endTime,
          durationMinutes: reconciled.durationMinutes,
          recurrence: patch.recurrence || existing.recurrence || 'weekly',
          repeatDays,
          startDate,
          plannedDate: startDate,
          endDate,
          recurrenceEndDate: endDate,
          excludedDates: Array.isArray(patch.excludedDates) ? patch.excludedDates : existing.excludedDates || []
        };

        updatedSchedules.push(merged);
        nextSchedules = nextSchedules.map((s) => (String(s.id) === String(patch.id) ? merged : s));
      }

      if (validationErrors.length > 0) {
        return { success: false, error: 'Validation failed on schedule update.', details: validationErrors };
      }

      if (!isDryRun) {
        await saveWorkspace(tasks, goals, habits, nextSchedules, `Updated ${updatedSchedules.length} schedules`);
      }

      return {
        success: true,
        action: 'update',
        dryRun: isDryRun,
        updatedIds: updatedSchedules.map((s) => s.id),
        schedules: updatedSchedules,
        totalSchedules: nextSchedules.length
      };
    }

    // Default: action === 'create'
    const inputSchedules = Array.isArray(args.schedules) ? args.schedules : [];
    if (inputSchedules.length === 0) {
      return { success: false, error: 'schedules array required for create action.' };
    }

    const createdSchedules: any[] = [];
    const validationErrors: string[] = [];
    const duplicatesFound: any[] = [];

    for (let i = 0; i < inputSchedules.length; i++) {
      const raw = inputSchedules[i] as any;
      if (!raw?.title || !String(raw.title).trim()) {
        validationErrors.push(`Schedule at index ${i} is missing required field "title".`);
        continue;
      }

      if (raw.startTime && !isValidTimeFormat(raw.startTime)) {
        validationErrors.push(`Invalid startTime "${raw.startTime}" at index ${i}. Expected 24h format HH:MM.`);
      }
      if (raw.endTime && !isValidTimeFormat(raw.endTime)) {
        validationErrors.push(`Invalid endTime "${raw.endTime}" at index ${i}. Expected 24h format HH:MM.`);
      }
      if (raw.startDate && !isValidDateFormat(raw.startDate)) {
        validationErrors.push(`Invalid startDate "${raw.startDate}" at index ${i}. Expected YYYY-MM-DD.`);
      }
      if (raw.endDate && !isValidDateFormat(raw.endDate)) {
        validationErrors.push(`Invalid endDate "${raw.endDate}" at index ${i}. Expected YYYY-MM-DD.`);
      }

      const reconciled = reconcileTimeAndDuration(raw.startTime, raw.endTime, raw.durationMinutes);
      const repeatDays = normalizeRepeatDays(raw.repeatDays);
      const startDate = raw.startDate || raw.plannedDate || today;
      const endDate = raw.endDate || raw.recurrenceEndDate || null;

      if (startDate && endDate && startDate > endDate) {
        validationErrors.push(`startDate "${startDate}" cannot be after endDate "${endDate}" at index ${i}.`);
      }

      // Check duplicates
      const dups = findScheduleDuplicates({ title: raw.title, startTime: reconciled.startTime, repeatDays }, nextSchedules);
      if (dups.length > 0) {
        duplicatesFound.push({
          candidateTitle: raw.title,
          conflictingScheduleId: dups[0].id,
          conflictingTitle: dups[0].title
        });
        if (!allowDuplicates && !isDryRun) {
          validationErrors.push(`Duplicate schedule: "${raw.title}" already exists on overlapping time/days (ID: ${dups[0].id}). Pass allowDuplicates: true to bypass.`);
        }
      }

      const newId = raw.id || `sched-mcp-${Date.now()}-${i}`;
      const newBlock = {
        id: newId,
        title: String(raw.title).trim(),
        category: raw.category || 'College',
        areas: [raw.category || 'College'],
        startTime: reconciled.startTime,
        endTime: reconciled.endTime,
        durationMinutes: reconciled.durationMinutes,
        recurrence: raw.recurrence || 'weekly',
        repeatDays,
        startDate,
        plannedDate: startDate,
        endDate,
        recurrenceEndDate: endDate,
        excludedDates: Array.isArray(raw.excludedDates) ? raw.excludedDates : [],
        notes: raw.notes ? String(raw.notes).trim() : '',
        completed: false,
        completedDates: []
      };

      createdSchedules.push(newBlock);
      nextSchedules.push(newBlock);
    }

    if (validationErrors.length > 0) {
      return { success: false, error: 'Validation failed on timetable creation.', details: validationErrors, duplicates: duplicatesFound };
    }

    // Run conflict detection against existing schedule blocks on start date
    const conflicts = detectCollisions(nextSchedules.filter((s) => isScheduleActiveOnDate(s, createdSchedules[0]?.startDate || today)));

    if (!isDryRun) {
      await saveWorkspace(tasks, goals, habits, nextSchedules, `Created ${createdSchedules.length} timetable schedules`);
    }

    return {
      success: true,
      action: 'create',
      dryRun: isDryRun,
      createdIds: createdSchedules.map((s) => s.id),
      schedules: createdSchedules,
      conflicts,
      totalSchedules: nextSchedules.length
    };
  }

  /* ── 5. schedule_tasks ── */
  if (toolName === 'schedule_tasks') {
    const action = String(args.action || 'create');
    const isDryRun = Boolean(args.dryRun);
    const inputTasks = Array.isArray(args.tasks) ? args.tasks : [];
    const targetIds = new Set(Array.isArray(args.taskIds) ? args.taskIds.map(String) : []);
    let nextTasks = [...tasks];

    if (action === 'delete') {
      const toDelete = nextTasks.filter((t) => targetIds.has(String(t.id)));
      if (!isDryRun) {
        nextTasks = nextTasks.filter((t) => !targetIds.has(String(t.id)));
        await saveWorkspace(nextTasks, goals, habits, schedules, `Deleted ${toDelete.length} tasks`);
      }
      return { success: true, action: 'delete', dryRun: isDryRun, deletedIds: Array.from(targetIds), deletedCount: toDelete.length, totalTasks: nextTasks.length };
    }

    if (action === 'complete') {
      let completedCount = 0;
      nextTasks = nextTasks.map((t) => {
        if (targetIds.has(String(t.id))) {
          completedCount++;
          return { ...t, completed: true, completedAt: Date.now() };
        }
        return t;
      });
      if (!isDryRun) {
        await saveWorkspace(nextTasks, goals, habits, schedules, `Completed ${completedCount} tasks`);
      }
      return { success: true, action: 'complete', dryRun: isDryRun, completedIds: Array.from(targetIds), completedCount, totalTasks: nextTasks.length };
    }

    if (action === 'update') {
      const updatedTasks: any[] = [];
      const validationErrors: string[] = [];
      const taskWarnings: string[] = [];

      for (let i = 0; i < inputTasks.length; i++) {
        const patch = inputTasks[i] as any;
        if (!patch?.id) {
          validationErrors.push(`Task patch at index ${i} is missing "id".`);
          continue;
        }

        const existing = nextTasks.find((t) => String(t.id) === String(patch.id));
        if (!existing) {
          validationErrors.push(`Task with id "${patch.id}" does not exist.`);
          continue;
        }

        const reconciled = (patch.startTime !== undefined || patch.endTime !== undefined || patch.durationMinutes !== undefined)
          ? reconcileTimeAndDuration({
              startTime: patch.startTime,
              endTime: patch.endTime,
              durationMinutes: patch.durationMinutes,
              existingStartTime: existing.startTime,
              existingEndTime: existing.endTime,
              existingDurationMinutes: existing.durationMinutes
            })
          : null;

        if (reconciled?.warning) {
          taskWarnings.push(`Task "${existing.title}" (${patch.id}): ${reconciled.warning}`);
        }

        const merged = {
          ...existing,
          ...patch,
          title: patch.title !== undefined ? String(patch.title).trim() : existing.title,
          startTime: reconciled ? reconciled.startTime : (patch.startTime !== undefined ? patch.startTime : existing.startTime),
          endTime: reconciled ? reconciled.endTime : (patch.endTime !== undefined ? patch.endTime : existing.endTime),
          durationMinutes: reconciled ? reconciled.durationMinutes : (patch.durationMinutes !== undefined ? Number(patch.durationMinutes) : existing.durationMinutes),
          scheduleId: patch.scheduleId !== undefined ? patch.scheduleId : (patch.linkedScheduleId !== undefined ? patch.linkedScheduleId : existing.scheduleId || null),
          updatedAt: Date.now()
        };

        updatedTasks.push(merged);
        nextTasks = nextTasks.map((t) => (String(t.id) === String(patch.id) ? merged : t));
      }

      if (validationErrors.length > 0) {
        return { success: false, error: 'Validation failed on task update.', details: validationErrors };
      }

      if (!isDryRun) {
        await saveWorkspace(nextTasks, goals, habits, schedules, `Updated ${updatedTasks.length} tasks`);
      }

      return {
        success: true,
        action: 'update',
        dryRun: isDryRun,
        updatedIds: updatedTasks.map((t) => t.id),
        tasks: updatedTasks,
        warnings: taskWarnings.length > 0 ? taskWarnings : undefined,
        totalTasks: nextTasks.length
      };
    }

    // Default: action === 'create'
    const createdTasks: any[] = [];
    const validationErrors: string[] = [];

    for (let i = 0; i < inputTasks.length; i++) {
      const raw = inputTasks[i] as any;
      if (!raw?.title || !String(raw.title).trim()) {
        validationErrors.push(`Task at index ${i} is missing required field "title".`);
        continue;
      }

      const pDate = raw.plannedDate || today;
      const reconciled = raw.startTime ? reconcileTimeAndDuration(raw.startTime, raw.endTime, raw.durationMinutes) : null;
      const dur = reconciled ? reconciled.durationMinutes : (Number(raw.durationMinutes) || 45);

      const newTask = {
        id: raw.id || `task-mcp-${Date.now()}-${i}`,
        title: String(raw.title).trim(),
        plannedDate: pDate,
        dueDate: pDate === today ? 'Today' : pDate,
        startTime: reconciled ? reconciled.startTime : null,
        endTime: reconciled ? reconciled.endTime : null,
        durationMinutes: dur,
        completed: false,
        priority: raw.priority || 'normal',
        impact: raw.impact || 'medium',
        energy: raw.energy || 'Medium',
        goalId: raw.goalId || null,
        linkedHabitId: raw.linkedHabitId || null,
        scheduleId: raw.scheduleId || raw.linkedScheduleId || null,
        areas: Array.isArray(raw.areas) && raw.areas.length ? raw.areas : ['Career & Craft'],
        subtasks: Array.isArray(raw.subtasks)
          ? raw.subtasks.map((s: any, idx: number) =>
              typeof s === 'string' ? { id: `st-${Date.now()}-${idx}`, title: s, completed: false } : s
            )
          : [],
        createdAt: Date.now()
      };

      createdTasks.push(newTask);
      nextTasks.unshift(newTask);
    }

    if (validationErrors.length > 0) {
      return { success: false, error: 'Validation failed on task creation.', details: validationErrors };
    }

    if (!isDryRun) {
      await saveWorkspace(nextTasks, goals, habits, schedules, `Created ${createdTasks.length} tasks`);
    }

    return {
      success: true,
      action: 'create',
      dryRun: isDryRun,
      createdIds: createdTasks.map((t) => t.id),
      tasks: createdTasks,
      totalTasks: nextTasks.length
    };
  }

  /* ── 6. manage_habits ── */
  if (toolName === 'manage_habits') {
    const action = String(args.action || 'create');
    const inputHabits = Array.isArray(args.habits) ? args.habits : [];
    const targetIds = new Set(Array.isArray(args.habitIds) ? args.habitIds.map(String) : []);
    const checkDate = typeof args.date === 'string' && args.date ? args.date : today;
    let nextHabits = [...habits];

    if (action === 'delete') {
      nextHabits = nextHabits.filter((h) => !targetIds.has(String(h.id)));
    } else if (action === 'checkin') {
      nextHabits = nextHabits.map((h) => {
        if (!targetIds.has(String(h.id))) return h;
        const days = Array.isArray(h.completedDays) ? [...h.completedDays] : [];
        if (!days.includes(checkDate)) days.push(checkDate);
        return { ...h, completedDays: days };
      });
    } else if (action === 'update') {
      for (const patch of inputHabits as any[]) {
        if (!patch?.id) continue;
        nextHabits = nextHabits.map((h) => (String(h.id) === String(patch.id) ? { ...h, ...patch } : h));
      }
    } else {
      for (let i = 0; i < inputHabits.length; i++) {
        const raw = inputHabits[i] as any;
        if (!raw?.title) continue;
        nextHabits.push({
          id: raw.id || `habit-mcp-${Date.now()}-${i}`,
          title: String(raw.title).trim(),
          cadence: raw.cadence || 'Morning',
          startTime: raw.startTime || null,
          isTimeBlocked: Boolean(raw.startTime),
          duration: raw.duration || '30 mins',
          targetFrequency: raw.targetFrequency || 'Every Day',
          icon: raw.icon || 'bolt',
          colorToken: raw.colorToken || 'primary',
          linkedGoal: raw.linkedGoal || '',
          graceDays: 2,
          completedDays: []
        });
      }
    }

    await saveWorkspace(tasks, goals, nextHabits, schedules, `Managed habits: ${action}`);
    return { success: true, action, totalHabits: nextHabits.length };
  }

  /* ── 7. manage_goals ── */
  if (toolName === 'manage_goals') {
    const action = String(args.action || 'create');
    const inputGoals = Array.isArray(args.goals) ? args.goals : [];
    const targetIds = new Set(Array.isArray(args.goalIds) ? args.goalIds.map(String) : []);
    let nextGoals = [...goals];

    if (action === 'delete') {
      nextGoals = nextGoals.filter((g) => !targetIds.has(String(g.id)));
    } else if (action === 'update') {
      for (const patch of inputGoals as any[]) {
        if (!patch?.id) continue;
        nextGoals = nextGoals.map((g) => (String(g.id) === String(patch.id) ? { ...g, ...patch } : g));
      }
    } else {
      for (let i = 0; i < inputGoals.length; i++) {
        const raw = inputGoals[i] as any;
        if (!raw?.title) continue;
        nextGoals.push({
          id: raw.id || `goal-mcp-${Date.now()}-${i}`,
          title: String(raw.title).trim(),
          category: raw.category || 'career',
          categories: [raw.category || 'career'],
          why: raw.why || '',
          targetDate: raw.targetDate || null,
          dateType: raw.targetDate ? 'target' : 'open',
          progress: Number(raw.progress) || 0,
          createdAt: Date.now()
        });
      }
    }

    await saveWorkspace(tasks, nextGoals, habits, schedules, `Managed goals: ${action}`);
    return { success: true, action, totalGoals: nextGoals.length };
  }

  /* ── 8. apply_executive_plan ── */
  if (toolName === 'apply_executive_plan') {
    const isDryRun = Boolean(args.dryRun);
    const allowDuplicates = Boolean(args.allowDuplicates);

    const delGoals = new Set(Array.isArray(args.deleteGoalIds) ? args.deleteGoalIds.map(String) : []);
    const delHabits = new Set(Array.isArray(args.deleteHabitIds) ? args.deleteHabitIds.map(String) : []);
    const delScheds = new Set(Array.isArray(args.deleteScheduleIds) ? args.deleteScheduleIds.map(String) : []);
    const delTasks = new Set(Array.isArray(args.deleteTaskIds) ? args.deleteTaskIds.map(String) : []);
    const completeTaskIds = new Set(Array.isArray(args.completeTaskIds) ? args.completeTaskIds.map(String) : []);

    let nextGoals = goals.filter((g) => !delGoals.has(String(g.id)));
    let nextHabits = habits.filter((h) => !delHabits.has(String(h.id)));
    let nextSchedules = schedules.filter((s) => !delScheds.has(String(s.id)));
    let nextTasks = tasks.filter((t) => !delTasks.has(String(t.id)));

    // Mark complete directly in executive plan
    if (completeTaskIds.size > 0) {
      nextTasks = nextTasks.map((t) =>
        completeTaskIds.has(String(t.id)) ? { ...t, completed: true, completedAt: Date.now() } : t
      );
    }

    // In-place updates
    if (Array.isArray(args.updateGoals)) {
      for (const patch of args.updateGoals as any[]) {
        if (!patch?.id) continue;
        nextGoals = nextGoals.map((g) => (String(g.id) === String(patch.id) ? { ...g, ...patch } : g));
      }
    }
    if (Array.isArray(args.updateHabits)) {
      for (const patch of args.updateHabits as any[]) {
        if (!patch?.id) continue;
        const resolvedGoalId = patch.goalId !== undefined ? patch.goalId : patch.linkedGoalId;
        const resolvedGoalTitle = patch.linkedGoal !== undefined ? patch.linkedGoal : (resolvedGoalId ? nextGoals.find((g) => String(g.id) === String(resolvedGoalId))?.title : undefined);
        nextHabits = nextHabits.map((h) => {
          if (String(h.id) !== String(patch.id)) return h;
          return {
            ...h,
            ...patch,
            ...(resolvedGoalId !== undefined ? { linkedGoalId: resolvedGoalId } : {}),
            ...(resolvedGoalTitle !== undefined ? { linkedGoal: resolvedGoalTitle } : {})
          };
        });
      }
    }
    if (Array.isArray(args.updateSchedules)) {
      for (const patch of args.updateSchedules as any[]) {
        if (!patch?.id) continue;
        nextSchedules = nextSchedules.map((s) => (String(s.id) === String(patch.id) ? { ...s, ...patch } : s));
      }
    }
    if (Array.isArray(args.updateTasks)) {
      for (const patch of args.updateTasks as any[]) {
        if (!patch?.id) continue;
        nextTasks = nextTasks.map((t) => (String(t.id) === String(patch.id) ? { ...t, ...patch } : t));
      }
    }

    const createdGoalIds: string[] = [];
    if (Array.isArray(args.goals)) {
      args.goals.forEach((raw: any, i: number) => {
        if (!raw?.title) return;
        const id = raw.id || `goal-mcp-${Date.now()}-${i}`;
        createdGoalIds.push(id);
        nextGoals.push({
          id,
          title: String(raw.title).trim(),
          category: raw.category || 'career',
          categories: [raw.category || 'career'],
          why: raw.why || '',
          targetDate: raw.targetDate || null,
          dateType: raw.targetDate ? 'target' : 'open',
          progress: Number(raw.progress) || 0,
          createdAt: Date.now()
        });
      });
    }

    const createdHabitIds: string[] = [];
    const habitWarnings: string[] = [];
    if (Array.isArray(args.habits)) {
      args.habits.forEach((raw: any, i: number) => {
        if (!raw?.title) return;
        const id = raw.id || `habit-mcp-${Date.now()}-${i}`;
        createdHabitIds.push(id);

        let resolvedGoalId = raw.existingGoalId || raw.goalId || raw.linkedGoalId || null;
        if (typeof raw.goalIndex === 'number') {
          if (createdGoalIds[raw.goalIndex]) {
            resolvedGoalId = createdGoalIds[raw.goalIndex];
          } else {
            habitWarnings.push(`Habit "${raw.title}" referenced goalIndex ${raw.goalIndex}, but only ${createdGoalIds.length} goals were created in this plan.`);
          }
        }

        const linkedGoalObj = resolvedGoalId ? nextGoals.find((g) => String(g.id) === String(resolvedGoalId)) : null;
        const resolvedGoalTitle = raw.linkedGoal || linkedGoalObj?.title || '';

        // Two-way link: add habit ID to goal's linkedHabitIds
        if (resolvedGoalId) {
          nextGoals = nextGoals.map((g) => {
            if (String(g.id) !== String(resolvedGoalId)) return g;
            const existingHIds = Array.isArray(g.linkedHabitIds) ? [...g.linkedHabitIds] : [];
            if (!existingHIds.includes(id)) existingHIds.push(id);
            return { ...g, linkedHabitIds: existingHIds };
          });
        }

        nextHabits.push({
          id,
          title: String(raw.title).trim(),
          cadence: raw.cadence || 'Morning',
          startTime: raw.startTime || null,
          isTimeBlocked: Boolean(raw.startTime),
          duration: raw.duration || '30 mins',
          targetFrequency: raw.targetFrequency || raw.frequency || 'Every Day',
          icon: raw.icon || 'bolt',
          colorToken: raw.colorToken || 'primary',
          linkedGoal: resolvedGoalTitle,
          linkedGoalId: resolvedGoalId || null,
          graceDays: 2,
          completedDays: []
        });
      });
    }

    const createdScheduleIds: string[] = [];
    const duplicatesDetected: any[] = [];
    if (Array.isArray(args.schedules)) {
      args.schedules.forEach((raw: any, i: number) => {
        if (!raw?.title) return;
        const reconciled = reconcileTimeAndDuration(raw.startTime, raw.endTime, raw.durationMinutes);
        const repeatDays = normalizeRepeatDays(raw.repeatDays);
        const startDate = raw.startDate || raw.plannedDate || today;
        const endDate = raw.endDate || raw.recurrenceEndDate || null;

        const dups = findScheduleDuplicates({ title: raw.title, startTime: reconciled.startTime, repeatDays }, nextSchedules);
        if (dups.length > 0) {
          duplicatesDetected.push({ title: raw.title, conflictingId: dups[0].id });
          if (!allowDuplicates) return; // skip adding duplicate
        }

        const id = raw.id || `sched-mcp-${Date.now()}-${i}`;
        createdScheduleIds.push(id);
        nextSchedules.push({
          id,
          title: String(raw.title).trim(),
          category: raw.category || 'College',
          areas: [raw.category || 'College'],
          startTime: reconciled.startTime,
          endTime: reconciled.endTime,
          durationMinutes: reconciled.durationMinutes,
          recurrence: raw.recurrence || 'weekly',
          repeatDays,
          startDate,
          plannedDate: startDate,
          endDate,
          recurrenceEndDate: endDate,
          excludedDates: Array.isArray(raw.excludedDates) ? raw.excludedDates : [],
          notes: raw.notes ? String(raw.notes).trim() : '',
          completed: false,
          completedDates: []
        });
      });
    }

    const createdTaskIds: string[] = [];
    if (Array.isArray(args.tasks)) {
      args.tasks.forEach((raw: any, i: number) => {
        if (!raw?.title) return;
        const id = raw.id || `task-mcp-${Date.now()}-${i}`;
        createdTaskIds.push(id);
        const pDate = raw.plannedDate || today;
        const reconciled = raw.startTime ? reconcileTimeAndDuration(raw.startTime, raw.endTime, raw.durationMinutes) : null;
        const dur = reconciled ? reconciled.durationMinutes : (Number(raw.durationMinutes) || 45);

        const resolvedGoalId =
          raw.existingGoalId ||
          raw.goalId ||
          (typeof raw.goalIndex === 'number' ? createdGoalIds[raw.goalIndex] : null);
        const resolvedHabitId =
          raw.existingHabitId ||
          raw.linkedHabitId ||
          (typeof raw.habitIndex === 'number' ? createdHabitIds[raw.habitIndex] : null);
        const resolvedScheduleId =
          raw.existingScheduleId ||
          raw.scheduleId ||
          raw.linkedScheduleId ||
          (typeof raw.scheduleIndex === 'number' ? createdScheduleIds[raw.scheduleIndex] : null);

        nextTasks.unshift({
          id,
          title: String(raw.title).trim(),
          plannedDate: pDate,
          dueDate: pDate === today ? 'Today' : pDate,
          startTime: reconciled ? reconciled.startTime : null,
          endTime: reconciled ? reconciled.endTime : null,
          durationMinutes: dur,
          completed: false,
          priority: raw.priority || 'normal',
          impact: raw.impact || 'medium',
          energy: raw.energy || 'Medium',
          goalId: resolvedGoalId || null,
          linkedHabitId: resolvedHabitId || null,
          scheduleId: resolvedScheduleId || null,
          areas: Array.isArray(raw.areas) && raw.areas.length ? raw.areas : ['Career & Craft'],
          subtasks: Array.isArray(raw.subtasks)
            ? raw.subtasks.map((s: any, idx: number) =>
                typeof s === 'string' ? { id: `st-${Date.now()}-${idx}`, title: s, completed: false } : s
              )
            : [],
          createdAt: Date.now()
        });
      });
    }

    const conflicts = detectCollisions(nextSchedules.filter((s) => isScheduleActiveOnDate(s, today)));

    if (!isDryRun) {
      await saveWorkspace(nextTasks, nextGoals, nextHabits, nextSchedules, args.planSummary ? String(args.planSummary) : 'Executive Plan');
    }

    return {
      success: true,
      dryRun: isDryRun,
      planSummary: args.planSummary || 'Executive Plan Executed',
      applied: {
        goalsAdded: createdGoalIds.length,
        habitsAdded: createdHabitIds.length,
        schedulesAdded: createdScheduleIds.length,
        tasksAdded: createdTaskIds.length,
        tasksCompleted: completeTaskIds.size,
        goalsDeleted: delGoals.size,
        habitsDeleted: delHabits.size,
        schedulesDeleted: delScheds.size,
        tasksDeleted: delTasks.size
      },
      createdIds: {
        goals: createdGoalIds,
        habits: createdHabitIds,
        schedules: createdScheduleIds,
        tasks: createdTaskIds
      },
      duplicatesDetected,
      conflicts,
      warnings: habitWarnings.length > 0 ? habitWarnings : undefined
    };
  }

  /* ── 9. undo_workspace_change ── */
  if (toolName === 'undo_workspace_change') {
    const history = Array.isArray(workspace._undoHistory) ? [...workspace._undoHistory] : [];
    if (history.length === 0) {
      return { success: false, message: 'No undo history available to restore.' };
    }
    const lastRev = history.shift()!;
    const restored = lastRev.snapshot;
    const updatedData = {
      ...workspace,
      tasks: restored.tasks || [],
      goals: restored.goals || [],
      habits: restored.habits || [],
      schedules: restored.schedules || [],
      _undoHistory: history,
      _mcpUpdated: Date.now()
    };
    const { error } = await admin.from('workspace_snapshots').upsert({
      user_id: userId,
      version: 1,
      data: updatedData
    });
    if (error) throw new Error(`Failed to revert workspace: ${error.message}`);
    return {
      success: true,
      restoredAction: lastRev.summary,
      restoredAt: new Date(lastRev.timestamp).toISOString(),
      counts: {
        tasks: updatedData.tasks.length,
        schedules: updatedData.schedules.length,
        goals: updatedData.goals.length,
        habits: updatedData.habits.length
      }
    };
  }

  throw new Error(`Unknown tool: ${toolName}`);
}

/* ──────────────── OpenAPI 3.1 Spec for GPTs ──────────────── */

function buildOpenApiSpec(serverUrl: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Momentum OS — Live Executive Workspace Action API',
      version: '3.1.0',
      description:
        'Connects ChatGPT Custom GPTs, Claude, and AI Assistants directly to live Momentum OS workspace with full timetable and schedule management.'
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Paste your Momentum Bridge Token (mom_...) from Settings -> Claude & ChatGPT Bridge.'
        }
      }
    },
    security: [{ BearerAuth: [] }],
    paths: {
      '/workspace': {
        get: {
          operationId: 'getMomentumWorkspace',
          summary: 'Fetch live tasks, timetable schedules, habits, and goals from Momentum OS.',
          responses: { '200': { description: 'Live workspace snapshot' } }
        }
      },
      '/calendar': {
        get: {
          operationId: 'getCalendarView',
          summary: 'Render projected calendar occurrences, timeline, and collisions for any date range.',
          responses: { '200': { description: 'Rendered calendar' } }
        }
      },
      '/conflicts': {
        post: {
          operationId: 'detectScheduleConflicts',
          summary: 'Analyze temporal collisions between schedules and tasks.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: MCP_TOOLS[2].inputSchema } }
          },
          responses: { '200': { description: 'Detected conflicts' } }
        }
      },
      '/tasks': {
        post: {
          operationId: 'scheduleTasks',
          summary: 'Create, update in-place, time-block, complete, or delete tasks.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: MCP_TOOLS[4].inputSchema } }
          },
          responses: { '200': { description: 'Updated task state' } }
        }
      },
      '/timetable': {
        post: {
          operationId: 'manageTimetable',
          summary: 'Create, update, bulk delete, skip single occurrences, or end timetable series.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: MCP_TOOLS[3].inputSchema } }
          },
          responses: { '200': { description: 'Updated timetable state' } }
        }
      },
      '/habits': {
        post: {
          operationId: 'manageHabits',
          summary: 'Create, update, check-in, or delete daily habits.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: MCP_TOOLS[5].inputSchema } }
          },
          responses: { '200': { description: 'Updated habit state' } }
        }
      },
      '/goals': {
        post: {
          operationId: 'manageGoals',
          summary: 'Create, update progress, or delete strategic long-term goals.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: MCP_TOOLS[6].inputSchema } }
          },
          responses: { '200': { description: 'Updated goals state' } }
        }
      },
      '/plan': {
        post: {
          operationId: 'applyExecutivePlan',
          summary: 'Atomically apply a full multi-horizon plan with auto-undo and dry-run.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: MCP_TOOLS[7].inputSchema } }
          },
          responses: { '200': { description: 'Applied executive plan result' } }
        }
      },
      '/undo': {
        post: {
          operationId: 'undoWorkspaceChange',
          summary: 'Revert to previous workspace snapshot.',
          responses: { '200': { description: 'Reverted workspace snapshot' } }
        }
      }
    }
  };
}

/* ──────────────── Deno HTTP Entrypoint ──────────────── */

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const baseServerUrl = `${url.origin}/functions/v1/momentum-mcp`;

  // Public OpenAPI 3.1 Schema Endpoint for ChatGPT Custom GPT Actions
  if (request.method === 'GET' && path.endsWith('/openapi.json')) {
    return jsonResponse(buildOpenApiSpec(baseServerUrl));
  }

  // Claude.ai MCP Connector discovery / health check ping (GET / or GET /manifest)
  if (request.method === 'GET' && !url.searchParams.has('token') && !request.headers.has('authorization')) {
    return jsonResponse({
      status: 'ok',
      service: 'momentum-os-mcp',
      version: '3.1.0',
      protocol: 'mcp-streamable-http',
      endpoints: {
        mcp: baseServerUrl,
        openapi: `${baseServerUrl}/openapi.json`
      }
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Momentum MCP Edge Function is missing Supabase environment variables.' }, 503);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const auth = await authenticateRequest(request, admin);
  if ('error' in auth) {
    return jsonResponse({ error: auth.error }, 401);
  }

  // REST Endpoints for ChatGPT Custom GPT Actions
  if (request.method === 'GET' && (path.endsWith('/workspace') || path.endsWith('/momentum-mcp'))) {
    const dateParam = url.searchParams.get('date') || '';
    const startDateParam = url.searchParams.get('startDate') || '';
    const endDateParam = url.searchParams.get('endDate') || '';
    const daysAheadParam = url.searchParams.get('daysAhead') ? Number(url.searchParams.get('daysAhead')) : undefined;

    const result = await executeTool(
      'get_momentum_workspace',
      { date: dateParam, startDate: startDateParam, endDate: endDateParam, daysAhead: daysAheadParam },
      auth.userId,
      auth.workspace,
      admin
    );
    return jsonResponse(result);
  }

  if (request.method === 'GET' && path.endsWith('/calendar')) {
    const startDateParam = url.searchParams.get('startDate') || '';
    const endDateParam = url.searchParams.get('endDate') || '';
    const result = await executeTool('get_calendar_view', { startDate: startDateParam, endDate: endDateParam }, auth.userId, auth.workspace, admin);
    return jsonResponse(result);
  }

  const restRouteMap: Record<string, string> = {
    '/tasks': 'schedule_tasks',
    '/timetable': 'manage_timetable',
    '/habits': 'manage_habits',
    '/goals': 'manage_goals',
    '/plan': 'apply_executive_plan',
    '/conflicts': 'detect_schedule_conflicts',
    '/undo': 'undo_workspace_change'
  };

  for (const [suffix, toolName] of Object.entries(restRouteMap)) {
    if (request.method === 'POST' && path.endsWith(suffix)) {
      try {
        const body = await request.json();
        const result = await executeTool(toolName, body || {}, auth.userId, auth.workspace, admin);
        return jsonResponse(result);
      } catch (err) {
        return jsonResponse({ error: err instanceof Error ? err.message : 'Execution failed' }, 400);
      }
    }
  }

  // Streamable HTTP Model Context Protocol (MCP JSON-RPC 2.0) for Claude.ai & MCP Clients
  if (request.method === 'POST') {
    try {
      const rpc = await request.json();
      const { id, method, params } = rpc || {};

      if (method === 'initialize') {
        return jsonResponse({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'momentum-os-mcp', version: '3.1.0' }
          }
        });
      }

      if (method === 'notifications/initialized' || method === 'ping') {
        return jsonResponse({ jsonrpc: '2.0', id: id ?? null, result: {} });
      }

      if (method === 'tools/list') {
        return jsonResponse({
          jsonrpc: '2.0',
          id,
          result: { tools: MCP_TOOLS }
        });
      }

      if (method === 'tools/call') {
        const toolName = String(params?.name || '');
        const toolArgs = (params?.arguments || {}) as Record<string, unknown>;
        const toolOutput = await executeTool(toolName, toolArgs, auth.userId, auth.workspace, admin);
        return jsonResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(toolOutput, null, 2) }],
            isError: false
          }
        });
      }

      return jsonResponse({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32601, message: `Unsupported MCP method: ${method}` }
      });
    } catch (err) {
      return jsonResponse(
        {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32603, message: err instanceof Error ? err.message : 'Internal MCP error' }
        },
        400
      );
    }
  }

  return jsonResponse({ error: 'Method not allowed.' }, 405);
});
