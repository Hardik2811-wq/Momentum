/**
 * Self-Improving Hybrid Natural Language Quick-Add Parser for Momentum OS
 * Integrates deterministic syntax parsing with active-learning memory engine.
 * Categorizes tasks into Life Areas (Career & Craft, Creative, Deep Focus, Habits, Health, Personal).
 */

import { queryLearnedMemory, recordLocalHit } from './nlpMemory.js';
import {
  todayPlanDate,
  tomorrowPlanDate,
  planDateLabel,
  urgencyFromPlan,
  calculateDuration,
  calculateEndTime
} from './taskMetadata.js';

const MONTH_INDEX = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

const DAY_INDEX = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6
};

function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function extractDateMatch(text) {
  const now = new Date();
  const currentYear = now.getFullYear();

  // 1. Today / Tonight
  const todayMatch = text.match(/\b(today|tonight)\b/i);
  if (todayMatch) {
    return { token: todayMatch[0], date: todayPlanDate() };
  }

  // 2. Tomorrow
  const tomorrowMatch = text.match(/\b(tomorrow|tmrw)\b/i);
  if (tomorrowMatch) {
    return { token: tomorrowMatch[0], date: tomorrowPlanDate() };
  }

  // 3. Relative: in N days / in a week / next week / in N weeks / in a month
  const relDaysMatch = text.match(/\bin\s+(\d+)\s*days?\b/i);
  if (relDaysMatch) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(relDaysMatch[1], 10));
    return { token: relDaysMatch[0], date: formatYMD(d) };
  }

  const inWeekMatch = text.match(/\bin\s+(?:a|1)\s*week\b/i);
  if (inWeekMatch) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return { token: inWeekMatch[0], date: formatYMD(d) };
  }

  const relWeeksMatch = text.match(/\bin\s+(\d+)\s*weeks?\b/i);
  if (relWeeksMatch) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(relWeeksMatch[1], 10) * 7);
    return { token: relWeeksMatch[0], date: formatYMD(d) };
  }

  const inMonthMatch = text.match(/\bin\s+(?:a|1)\s*month\b/i);
  if (inMonthMatch) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return { token: inMonthMatch[0], date: formatYMD(d) };
  }

  // 4. ISO numeric: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = text.match(/\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const dateObj = new Date(y, m, d);
    if (!isNaN(dateObj.getTime())) {
      return { token: isoMatch[0], date: formatYMD(dateObj) };
    }
  }

  // 5. Month name + Day (e.g., "Oct 15", "October 15th", "Oct 15 2026", "on Oct 15")
  const monthDayMatch = text.match(/\b(?:on\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i);
  if (monthDayMatch) {
    const monthKey = monthDayMatch[1].toLowerCase().slice(0, 3);
    const m = MONTH_INDEX[monthKey];
    const d = parseInt(monthDayMatch[2], 10);
    let y = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : currentYear;
    let candidate = new Date(y, m, d);
    if (!monthDayMatch[3]) {
      const pastThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (candidate < pastThreshold) {
        candidate = new Date(currentYear + 1, m, d);
      }
    }
    if (!isNaN(candidate.getTime())) {
      return { token: monthDayMatch[0], date: formatYMD(candidate) };
    }
  }

  // 6. Day + Month name (e.g., "15th Oct", "15 October", "15th of October 2026")
  const dayMonthMatch = text.match(/\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*(\d{4}))?\b/i);
  if (dayMonthMatch) {
    const d = parseInt(dayMonthMatch[1], 10);
    const monthKey = dayMonthMatch[2].toLowerCase().slice(0, 3);
    const m = MONTH_INDEX[monthKey];
    let y = dayMonthMatch[3] ? parseInt(dayMonthMatch[3], 10) : currentYear;
    let candidate = new Date(y, m, d);
    if (!dayMonthMatch[3]) {
      const pastThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (candidate < pastThreshold) {
        candidate = new Date(currentYear + 1, m, d);
      }
    }
    if (!isNaN(candidate.getTime())) {
      return { token: dayMonthMatch[0], date: formatYMD(candidate) };
    }
  }

  // 7. Day of Week: "this Friday", "next Monday", "on Tuesday", "Wednesday"
  const dowMatch = text.match(/\b(?:(next|this)\s+)?(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (dowMatch) {
    const isNext = (dowMatch[1] || '').toLowerCase() === 'next';
    const dayKey = dowMatch[2].toLowerCase().slice(0, 3);
    const targetDayIndex = DAY_INDEX[dayKey];
    const curDayIndex = now.getDay();
    let diff = (targetDayIndex - curDayIndex + 7) % 7;
    if (diff === 0) diff = 7;
    if (isNext && diff < 7) diff += 7;
    const d = new Date();
    d.setDate(d.getDate() + diff);
    return { token: dowMatch[0], date: formatYMD(d) };
  }

  // 8. Numeric Date (DD/MM or MM/DD or DD-MM-YYYY)
  const numDateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numDateMatch) {
    const part1 = parseInt(numDateMatch[1], 10);
    const part2 = parseInt(numDateMatch[2], 10);
    let yearPart = numDateMatch[3] ? parseInt(numDateMatch[3], 10) : currentYear;
    if (yearPart < 100) yearPart += 2000;

    let day, month;
    if (part1 > 12) {
      day = part1;
      month = part2 - 1;
    } else if (part2 > 12) {
      month = part1 - 1;
      day = part2;
    } else {
      // If ambiguous, assume MM/DD or DD/MM; let's treat as MM/DD if part1 <= 12
      day = part2;
      month = part1 - 1;
    }
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      let candidate = new Date(yearPart, month, day);
      if (!isNaN(candidate.getTime())) {
        return { token: numDateMatch[0], date: formatYMD(candidate) };
      }
    }
  }

  return null;
}

export function parseNaturalTask(input = '', goals = [], habits = []) {
  if (!input || typeof input !== 'string') {
    return {
      cleanTitle: '',
      extracted: {},
      hasDetected: false,
      confidence: 0,
      isFromLearnedMemory: false,
      learnedSource: null
    };
  }

  let text = input;
  const extracted = {};
  let explicitScore = 0;

  // 1. Duration / Flexibility: ~open, flexible, 30m, 45 min, 1.5h, 90 mins, 2h, 3h, 4 hours, half an hour, an hour
  const flexMatch = text.match(/\b(~open|flexible|open-ended|untimed|no\s+rush)\b/i);
  if (flexMatch) {
    extracted.isFlexible = true;
    extracted.durationMinutes = null;
    explicitScore += 0.25;
    text = text.replace(flexMatch[0], ' ');
  } else {
    const durationMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes|h|hr|hrs|hours)\b/i) ||
                          text.match(/\b(half\s+an?\s+hour|an?\s+hour)\b/i);
    if (durationMatch) {
      if (/half\s+an?\s+hour/i.test(durationMatch[0])) {
        extracted.durationMinutes = 30;
      } else if (/an?\s+hour/i.test(durationMatch[0])) {
        extracted.durationMinutes = 60;
      } else {
        const rawVal = parseFloat(durationMatch[1]);
        const isHours = /h|hr|hrs|hours/i.test(durationMatch[0]);
        extracted.durationMinutes = Math.round(isHours ? rawVal * 60 : rawVal);
      }
      explicitScore += 0.25;
      text = text.replace(durationMatch[0], ' ');
    }
  }

  // 2. Start Time & Time Range (e.g. "10am to 1:30pm", "14:00 - 16:45", "at 2:30pm", "before lunch")
  const parseSingleTime = (tStr) => {
    if (!tStr) return null;
    const raw = tStr.trim().toLowerCase();
    if (raw === 'noon') return '12:00';
    if (raw.includes('before lunch')) return '11:30';
    if (raw.includes('after lunch')) return '13:30';
    if (raw.includes('morning')) return '09:00';
    if (raw.includes('afternoon')) return '14:00';
    if (raw.includes('evening')) return '18:00';

    const m = raw.match(/(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm)?/i) ||
              raw.match(/([01]?[0-9]|2[0-3]):([0-5][0-9])/);
    if (!m) return null;
    let hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3]?.toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  // 2a. Time Range: e.g. "10am to 1:30pm", "10am - 12pm", "14:00 - 16:45", "from 2pm to 4:30pm"
  const rangeMatch = text.match(/\b(?:from\s+)?((?:1[0-2]|0?[1-9])(?::[0-5][0-9])?\s*(?:am|pm)?|[01]?[0-9]|2[0-3]:[0-5][0-9])\s*(?:to|-|–)\s*((?:1[0-2]|0?[1-9])(?::[0-5][0-9])?\s*(?:am|pm)?|[01]?[0-9]|2[0-3]:[0-5][0-9])\b/i);
  if (rangeMatch) {
    const s = parseSingleTime(rangeMatch[1]);
    const e = parseSingleTime(rangeMatch[2]);
    if (s && e) {
      extracted.startTime = s;
      extracted.endTime = e;
      const diff = calculateDuration(s, e);
      if (diff && !extracted.isFlexible) {
        extracted.durationMinutes = diff;
      }
      explicitScore += 0.35;
      text = text.replace(rangeMatch[0], ' ');
    }
  }

  // 2b. Single Start Time
  if (!extracted.startTime) {
    const timeMatch = text.match(/\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm)\b/i) ||
                      text.match(/\b(?:at\s+)?([01]?[0-9]|2[0-3]):([0-5][0-9])\b/i) ||
                      text.match(/\b(before\s+lunch|after\s+lunch|noon|morning|afternoon|evening)\b/i);
    if (timeMatch) {
      const s = parseSingleTime(timeMatch[0]);
      if (s) {
        extracted.startTime = s;
        if (extracted.durationMinutes && !extracted.isFlexible) {
          extracted.endTime = calculateEndTime(s, extracted.durationMinutes);
        }
        explicitScore += 0.25;
        text = text.replace(timeMatch[0], ' ');
      }
    }
  }

  // 3. Priority / Impact: !high, !urgent, !1, !p1, !medium, !med, !low, !p3, !3, !
  const priorityMatch = text.match(/!(high|urgent|p1|1|med|medium|normal|p2|2|low|quick|p3|3)\b/i) ||
                        text.match(/(?:^|\s)(!)(?=\s|$)/);
  if (priorityMatch) {
    const tag = (priorityMatch[1] || '!').toLowerCase();
    if (['high', 'urgent', 'p1', '1', '!'].includes(tag)) {
      extracted.priority = 'high';
      extracted.impact = 'high';
    } else if (['med', 'medium', 'normal', 'p2', '2'].includes(tag)) {
      extracted.priority = 'normal';
      extracted.impact = 'medium';
    } else if (['low', 'quick', 'p3', '3'].includes(tag)) {
      extracted.priority = 'low';
      extracted.impact = 'low';
    }
    explicitScore += 0.15;
    text = text.replace(priorityMatch[0], ' ');
  }

  // 4. Life Areas from Tags (#career, #creative, #focus, #habits, #health, #personal, @work, etc.)
  const areaTagMatch = text.match(/(?:#|@)(career|craft|work|job|creative|art|music|design|writing|focus|deepwork|study|code|habit|habits|routine|daily|health|gym|fitness|run|workout|personal|life|home|errand|errands)\b/i);
  if (areaTagMatch) {
    const raw = areaTagMatch[1].toLowerCase();
    const detectedAreas = [];

    if (['career', 'craft', 'work', 'job'].includes(raw)) detectedAreas.push('Career & Craft');
    else if (['creative', 'art', 'music', 'design', 'writing'].includes(raw)) detectedAreas.push('Creative & Expression');
    else if (['focus', 'deepwork', 'study', 'code'].includes(raw)) detectedAreas.push('Deep Focus');
    else if (['habit', 'habits', 'routine', 'daily'].includes(raw)) detectedAreas.push('Habit Consistency');
    else if (['health', 'gym', 'fitness', 'run', 'workout'].includes(raw)) detectedAreas.push('Health & Vitality');
    else if (['personal', 'life', 'home', 'errand', 'errands'].includes(raw)) detectedAreas.push('Personal & Life');

    if (detectedAreas.length > 0) {
      extracted.areas = detectedAreas;
      explicitScore += 0.25;
      text = text.replace(areaTagMatch[0], ' ');
    }
  }

  // 5. Due Date / Horizon: any format (ISO, Month-Day, Day-Month, relative days, day of week, today, tomorrow)
  const dateResult = extractDateMatch(text);
  if (dateResult) {
    extracted.plannedDate = dateResult.date;
    extracted.dueDate = planDateLabel(dateResult.date);
    extracted.urgency = urgencyFromPlan(dateResult.date);
    explicitScore += 0.25;
    text = text.replace(dateResult.token, ' ');
  } else {
    const fallbackHorizonMatch = text.match(/\b(this\s+week|someday|backlog)\b/i);
    if (fallbackHorizonMatch) {
      const d = fallbackHorizonMatch[1].toLowerCase();
      if (d === 'this week') {
        extracted.dueDate = 'This Week';
        extracted.urgency = 'week';
      } else {
        extracted.dueDate = 'Pick Date';
        extracted.urgency = 'later';
      }
      explicitScore += 0.20;
      text = text.replace(fallbackHorizonMatch[0], ' ');
    }
  }

  // 6. Goal & Habit Matching: #tag (e.g. #g1, #q3, #launch, #h1, #run)
  const goalTagMatch = text.match(/#([a-z0-9_-]+)\b/i);
  if (goalTagMatch) {
    const rawTag = goalTagMatch[1].toLowerCase();
    const matchedGoal = goals.find(g =>
      g.id === rawTag ||
      (g.category && g.category.toLowerCase() === rawTag) ||
      (g.title && g.title.toLowerCase().includes(rawTag))
    );
    if (matchedGoal) {
      extracted.goalId = matchedGoal.id;
      extracted.goalTitle = matchedGoal.title;
    }

    const matchedHabit = Array.isArray(habits) && habits.find(h =>
      h.id.toLowerCase() === rawTag ||
      (h.title && h.title.toLowerCase().includes(rawTag))
    );
    if (matchedHabit) {
      extracted.habitId = matchedHabit.id;
      extracted.habitTitle = matchedHabit.title;
      extracted.linkedHabitId = matchedHabit.id;
    }

    explicitScore += 0.15;
    text = text.replace(goalTagMatch[0], ' ');
  }

  // 7. Clean up remaining text to get cleanTitle
  const cleanTitle = text
    .replace(/\s+/g, ' ')
    .replace(/^[-–—:,.\s]+|[-–—:,.\s]+$/g, '')
    .trim();

  // 8. Query Learned Memory & Verb Dictionary if areas or energy not set
  let isFromLearnedMemory = false;
  let learnedSource = null;
  const memoryResult = queryLearnedMemory(cleanTitle || input);

  if (memoryResult.matched) {
    if (!extracted.areas && memoryResult.inferred.areas) {
      extracted.areas = memoryResult.inferred.areas;
    }
    if (!extracted.energy && memoryResult.inferred.energy) {
      extracted.energy = memoryResult.inferred.energy;
    }
    if (!extracted.isFlexible && !extracted.durationMinutes && memoryResult.inferred.durationMinutes) {
      extracted.durationMinutes = memoryResult.inferred.durationMinutes;
    }
    if (!extracted.urgency && memoryResult.inferred.urgency) {
      extracted.urgency = memoryResult.inferred.urgency;
      extracted.dueDate = memoryResult.inferred.urgency === 'today' ? 'Today' : 'This Week';
    }
    isFromLearnedMemory = true;
    learnedSource = memoryResult.source;
    explicitScore += memoryResult.confidenceBoost || 0.35;
  }

  // 9. Infer Energy level if still not determined
  const hasDetected = Object.keys(extracted).length > 0;
  if (hasDetected && !extracted.energy) {
    if ((extracted.durationMinutes && extracted.durationMinutes >= 75) || extracted.priority === 'high') {
      extracted.energy = 'High';
    } else if (extracted.priority === 'low' || (extracted.durationMinutes && extracted.durationMinutes <= 30)) {
      extracted.energy = 'Low';
    } else {
      extracted.energy = 'Medium';
    }
  }

  // 10. Confidence normalization (capped at 1.0)
  const confidence = Math.min(1.0, Math.round(explicitScore * 100) / 100);

  if (confidence >= 0.6) {
    try {
      recordLocalHit();
    } catch {
      // Safe noop
    }
  }

  return {
    cleanTitle: cleanTitle || input.trim(),
    extracted,
    hasDetected,
    confidence,
    isFromLearnedMemory,
    learnedSource
  };
}
