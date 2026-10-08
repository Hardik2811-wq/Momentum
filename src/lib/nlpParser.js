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
  calculateEndTime,
  calculateNextArrivingDate
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

  // 3b. Natural Horizons: end of month, end of year, next month, next year
  const endOfMonthMatch = text.match(/\b(?:the\s+)?end\s+of\s+(?:the\s+)?month\b/i);
  if (endOfMonthMatch) {
    const lastDay = new Date(currentYear, now.getMonth() + 1, 0);
    return { token: endOfMonthMatch[0], date: formatYMD(lastDay) };
  }

  const endOfYearMatch = text.match(/\b(?:the\s+)?end\s+of\s+(?:the\s+)?year\b/i);
  if (endOfYearMatch) {
    const lastDayOfYear = new Date(currentYear, 11, 31);
    return { token: endOfYearMatch[0], date: formatYMD(lastDayOfYear) };
  }

  const nextMonthMatch = text.match(/\bnext\s+month\b/i);
  if (nextMonthMatch) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return { token: nextMonthMatch[0], date: formatYMD(d) };
  }

  const nextYearMatch = text.match(/\bnext\s+year\b/i);
  if (nextYearMatch) {
    const d = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    return { token: nextYearMatch[0], date: formatYMD(d) };
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

function escapeRegex(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extracts recurrence rule, recurrence until date, and target day sets.
 * Handles compound patterns such as:
 * - "repeat every weekday till nov 30"
 * - "repeat math class at 11am for 90m repeat every tue, thu until 2026-12-31"
 * - "every day till next friday"
 * - "every month until end of year"
 */
export function extractRecurrenceMatch(text) {
  if (!text || typeof text !== 'string') return null;

  let recurrence = null;
  let repeatDays = null;
  let recurrenceUntil = null;
  let recurrenceEndDate = null;
  const matchedTokens = [];

  // 1. Recurrence End Date ("till nov 30", "until 2026-12-31", "through dec 31", "up to next friday", "ending on nov 30")
  const untilRegex = /\b(?:repeat\s+)?(?:till|until|through|thru|up\s+to|ending(?:\s+on)?)\s+([^\s,]+(?:\s+[^\s,]+){0,3})\b/i;
  const untilMatch = text.match(untilRegex);
  if (untilMatch) {
    const candidateStr = untilMatch[1];
    const dateRes = extractDateMatch(candidateStr);
    if (dateRes) {
      recurrenceEndDate = dateRes.date;
      const d = new Date(`${dateRes.date}T12:00:00`);
      d.setDate(d.getDate() + 1);
      recurrenceUntil = formatYMD(d);

      const fullUntilMatch = text.match(new RegExp(`\\b(?:repeat\\s+)?(?:till|until|through|thru|up\\s+to|ending(?:\\s+on)?)\\s+${escapeRegex(dateRes.token)}\\b`, 'i'));
      if (fullUntilMatch) {
        matchedTokens.push(fullUntilMatch[0]);
      } else {
        matchedTokens.push(untilMatch[0]);
      }
    }
  }

  // Create temporary text without the until clause to isolate frequency phrase
  let textWithoutUntil = text;
  matchedTokens.forEach(tok => {
    textWithoutUntil = textWithoutUntil.replace(tok, ' ');
  });

  // 2. Frequency patterns
  // 2a. Weekdays / Workdays
  const weekdaysMatch = textWithoutUntil.match(/\b(?:repeat\s+)?(?:every\s+)?(?:weekdays?|workdays?)\b/i) ||
                        textWithoutUntil.match(/\bon\s+weekdays?\b/i);
  if (weekdaysMatch) {
    recurrence = 'custom';
    repeatDays = [1, 2, 3, 4, 5];
    matchedTokens.push(weekdaysMatch[0]);
  }

  // 2b. Weekends
  if (!recurrence) {
    const weekendsMatch = textWithoutUntil.match(/\b(?:repeat\s+)?(?:every\s+)?weekends?\b/i) ||
                          textWithoutUntil.match(/\bon\s+weekends?\b/i);
    if (weekendsMatch) {
      recurrence = 'custom';
      repeatDays = [0, 6];
      matchedTokens.push(weekendsMatch[0]);
    }
  }

  // 2c. MWF / TTH
  if (!recurrence) {
    const mwfMatch = textWithoutUntil.match(/\b(?:repeat\s+)?(?:every\s+)?(?:mwf|m-w-f)\b/i);
    if (mwfMatch) {
      recurrence = 'custom';
      repeatDays = [1, 3, 5];
      matchedTokens.push(mwfMatch[0]);
    }
  }
  if (!recurrence) {
    const tthMatch = textWithoutUntil.match(/\b(?:repeat\s+)?(?:every\s+)?(?:tth|t-th)\b/i);
    if (tthMatch) {
      recurrence = 'custom';
      repeatDays = [2, 4];
      matchedTokens.push(tthMatch[0]);
    }
  }

  // 2d. Explicit day list: e.g. "every tue, thu", "repeat every monday and wednesday", "every mon, wed, fri"
  if (!recurrence) {
    const daysListMatch = textWithoutUntil.match(/\b(?:repeat\s+)?(?:every|on)\s+((?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)s?(?:\s*(?:,|&|and)?\s*))+)\b/i);
    if (daysListMatch) {
      const daysStr = daysListMatch[1].toLowerCase();
      const extractedDays = new Set();
      const tokens = daysStr.split(/[\s,&]+/).filter(Boolean);
      tokens.forEach(tok => {
        const clean = tok.replace(/s$/, '').slice(0, 3);
        if (DAY_INDEX[clean] !== undefined) {
          extractedDays.add(DAY_INDEX[clean]);
        }
      });
      if (extractedDays.size > 0) {
        repeatDays = Array.from(extractedDays).sort((a, b) => a - b);
        if (repeatDays.length === 7) {
          recurrence = 'daily';
        } else {
          recurrence = 'custom';
        }
        matchedTokens.push(daysListMatch[0]);
      }
    }
  }

  // 2e. Daily / Every day / Everyday / Every night
  if (!recurrence) {
    const dailyMatch = textWithoutUntil.match(/\b(?:repeat\s+)?every\s+(?:day|daily|night)\b/i) ||
                       textWithoutUntil.match(/\b(?:repeat\s+)?daily\b/i) ||
                       textWithoutUntil.match(/\beveryday\b/i);
    if (dailyMatch) {
      recurrence = 'daily';
      repeatDays = [0, 1, 2, 3, 4, 5, 6];
      matchedTokens.push(dailyMatch[0]);
    }
  }

  // 2f. Weekly / Every week
  if (!recurrence) {
    const weeklyMatch = textWithoutUntil.match(/\b(?:repeat\s+)?every\s+week\b/i) ||
                        textWithoutUntil.match(/\b(?:repeat\s+)?weekly\b/i);
    if (weeklyMatch) {
      recurrence = 'weekly';
      matchedTokens.push(weeklyMatch[0]);
    }
  }

  // 2g. Monthly / Every month
  if (!recurrence) {
    const monthlyMatch = textWithoutUntil.match(/\b(?:repeat\s+)?every\s+month\b/i) ||
                         textWithoutUntil.match(/\b(?:repeat\s+)?monthly\b/i);
    if (monthlyMatch) {
      recurrence = 'monthly';
      matchedTokens.push(monthlyMatch[0]);
    }
  }

  // 2h. Yearly / Every year / Annually
  if (!recurrence) {
    const yearlyMatch = textWithoutUntil.match(/\b(?:repeat\s+)?every\s+year\b/i) ||
                        textWithoutUntil.match(/\b(?:repeat\s+)?yearly\b/i) ||
                        textWithoutUntil.match(/\bannually\b/i);
    if (yearlyMatch) {
      recurrence = 'yearly';
      matchedTokens.push(yearlyMatch[0]);
    }
  }

  // Fallback: If until date was given with "repeat" keyword
  if (!recurrence && (recurrenceEndDate || recurrenceUntil)) {
    if (/\brepeat\b/i.test(textWithoutUntil)) {
      recurrence = 'daily';
    }
  }

  if (!recurrence && !recurrenceEndDate) {
    return null;
  }

  // Build human-friendly label
  let recurrenceLabel = 'Repeat';
  const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (recurrence === 'daily') recurrenceLabel = 'Daily';
  else if (recurrence === 'weekly') recurrenceLabel = 'Weekly';
  else if (recurrence === 'monthly') recurrenceLabel = 'Monthly';
  else if (recurrence === 'yearly') recurrenceLabel = 'Yearly';
  else if (recurrence === 'custom' && repeatDays) {
    if (repeatDays.length === 5 && [1, 2, 3, 4, 5].every(d => repeatDays.includes(d))) recurrenceLabel = 'Weekdays';
    else if (repeatDays.length === 2 && [0, 6].every(d => repeatDays.includes(d))) recurrenceLabel = 'Weekends';
    else recurrenceLabel = repeatDays.map(d => WEEKDAY_NAMES[d]).join(', ');
  }
  if (recurrenceEndDate) {
    recurrenceLabel += ` till ${planDateLabel(recurrenceEndDate)}`;
  }

  return {
    recurrence: recurrence || 'daily',
    repeatDays,
    recurrenceEndDate,
    recurrenceUntil,
    recurrenceLabel,
    matchedTokens
  };
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

  // 0. Recurrence & Recurrence End Date ("repeat every weekday till nov 30", "every tue, thu until 2026-12-31")
  const recurrenceMatch = extractRecurrenceMatch(text);
  if (recurrenceMatch) {
    extracted.recurrence = recurrenceMatch.recurrence;
    if (recurrenceMatch.repeatDays) extracted.repeatDays = recurrenceMatch.repeatDays;
    if (recurrenceMatch.recurrenceEndDate) extracted.recurrenceEndDate = recurrenceMatch.recurrenceEndDate;
    if (recurrenceMatch.recurrenceUntil) extracted.recurrenceUntil = recurrenceMatch.recurrenceUntil;
    if (recurrenceMatch.recurrenceLabel) extracted.recurrenceLabel = recurrenceMatch.recurrenceLabel;
    explicitScore += 0.35;
    recurrenceMatch.matchedTokens.forEach(tok => {
      text = text.replace(tok, ' ');
    });
  }

  // 1. Duration / Flexibility: ~open, flexible, 30m, 45 min, 1.5h, 90 mins, 2h, 3h, 4 hours, half an hour, an hour
  // Also supports "for 2h", "fot 1234 duration", "duration: 45m"
  const flexMatch = text.match(/\b(~open|flexible|open-ended|untimed|no\s+rush)\b/i);
  if (flexMatch) {
    extracted.isFlexible = true;
    extracted.durationMinutes = null;
    explicitScore += 0.25;
    text = text.replace(flexMatch[0], ' ');
  } else {
    const durationMatch = text.match(/\b(?:(?:for|fot|fro)\s+)?(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes|h|hr|hrs|hours)\b(?:\s*duration)?/i) ||
                          text.match(/\b(?:(?:for|fot|fro)\s+)?(\d+)\s*(?:m|min|mins|minutes)?\s*duration\b/i) ||
                          text.match(/\b(?:(?:for|fot|fro)\s+)?(half\s+an?\s+hour|an?\s+hour)\b/i) ||
                          text.match(/\b(?:duration|dur)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes|h|hr|hrs|hours)?\b/i);
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

    const m24 = raw.match(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/);
    if (m24) {
      return `${String(parseInt(m24[1], 10)).padStart(2, '0')}:${m24[2]}`;
    }

    const m = raw.match(/(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm)/i) ||
              raw.match(/^(1[0-2]|0?[1-9])(?::([0-5][0-9]))?$/);
    if (!m) return null;
    let hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3]?.toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  // 2a. Time Range: e.g. "10am to 1:30pm", "10am - 12pm", "14:00 - 16:45", "from 2pm to 4:30pm"
  const rangeMatch = text.match(/\b(?:from\s+)?((?:[01]?[0-9]|2[0-3]):[0-5][0-9]|(?:1[0-2]|0?[1-9])(?::[0-5][0-9])?\s*(?:am|pm)?)\s*(?:to|-|–)\s*((?:[01]?[0-9]|2[0-3]):[0-5][0-9]|(?:1[0-2]|0?[1-9])(?::[0-5][0-9])?\s*(?:am|pm)?)\b/i);
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

  // 3b. Conversational Impact & Priority
  if (!extracted.impact) {
    const highImpactMatch = text.match(/\b(urgent|critical|crucial|asap|top\s+priority|highest\s+priority|must\s+do|high\s+impact)\b/i);
    const lowImpactMatch = text.match(/\b(low\s+priority|low\s+impact|minor\s+task|casual|whenever)\b/i);
    const medImpactMatch = text.match(/\b(medium\s+priority|medium\s+impact|moderate)\b/i);

    if (highImpactMatch) {
      extracted.impact = 'high';
      extracted.priority = 'high';
      explicitScore += 0.15;
      text = text.replace(highImpactMatch[0], ' ');
    } else if (lowImpactMatch) {
      extracted.impact = 'low';
      extracted.priority = 'low';
      explicitScore += 0.15;
      text = text.replace(lowImpactMatch[0], ' ');
    } else if (medImpactMatch) {
      extracted.impact = 'medium';
      extracted.priority = 'normal';
      explicitScore += 0.15;
      text = text.replace(medImpactMatch[0], ' ');
    }
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

  // 4b. Life Areas from Natural Domain Words (if untagged)
  if (!extracted.areas) {
    const naturalAreaMatch = text.match(/\b(gym|workout|cardio|running|jogging|fitness|doctor|dentist|groceries|laundry|errands|sketching|painting|songwriting)\b/i);
    if (naturalAreaMatch) {
      const w = naturalAreaMatch[1].toLowerCase();
      if (['gym', 'workout', 'cardio', 'running', 'jogging', 'fitness', 'doctor', 'dentist'].includes(w)) {
        extracted.areas = ['Health & Vitality'];
      } else if (['groceries', 'laundry', 'errands'].includes(w)) {
        extracted.areas = ['Personal & Life'];
      } else if (['sketching', 'painting', 'songwriting'].includes(w)) {
        extracted.areas = ['Creative & Expression'];
      }
      if (extracted.areas) explicitScore += 0.20;
    }
  }

  // 5. Due Date / Horizon / Start Date
  const startPrefixMatch = text.match(/\b(?:starting|starts|beginning|from)\s+/i);
  if (startPrefixMatch) {
    text = text.replace(startPrefixMatch[0], ' ');
  }
  const dateResult = extractDateMatch(text);
  if (dateResult) {
    let resolvedDate = dateResult.date;
    if (resolvedDate === todayPlanDate() && extracted.startTime) {
      resolvedDate = calculateNextArrivingDate({
        repeatDays: extracted.repeatDays,
        startTime: extracted.startTime,
        baseDateStr: resolvedDate
      });
    }
    extracted.plannedDate = resolvedDate;
    extracted.dueDate = planDateLabel(resolvedDate);
    extracted.urgency = urgencyFromPlan(resolvedDate);
    explicitScore += 0.25;
    text = text.replace(dateResult.token, ' ');
  } else if (extracted.recurrence) {
    // Recurring tasks start at next arriving occurrence (never in past)
    const nextArrDate = calculateNextArrivingDate({
      repeatDays: extracted.repeatDays,
      startTime: extracted.startTime,
      baseDateStr: todayPlanDate()
    });
    extracted.plannedDate = nextArrDate;
    extracted.dueDate = planDateLabel(nextArrDate);
    extracted.urgency = urgencyFromPlan(nextArrDate);
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
      if (!extracted.areas && matchedGoal.category) {
        const areaLabel = matchedGoal.category === 'health' ? 'Health & Vitality' : matchedGoal.category === 'creative' ? 'Creative & Expression' : 'Career & Craft';
        extracted.areas = [areaLabel];
      }
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

  // 6b. Auto-detect Goal from natural title tokens
  if (!extracted.goalId && Array.isArray(goals) && goals.length > 0) {
    const lowerText = text.toLowerCase();
    for (const g of goals) {
      if (!g || !g.title) continue;
      const lowerGTitle = g.title.toLowerCase();
      if (lowerGTitle.length >= 4 && lowerText.includes(lowerGTitle)) {
        extracted.goalId = g.id;
        extracted.goalTitle = g.title;
        if (!extracted.areas && g.category) {
          const areaLabel = g.category === 'health' ? 'Health & Vitality' : g.category === 'creative' ? 'Creative & Expression' : 'Career & Craft';
          extracted.areas = [areaLabel];
        }
        explicitScore += 0.2;
        break;
      }
      const gTokens = lowerGTitle.split(/\s+/).filter(w => w.length >= 4 && !['ship', 'build', 'make', 'create', 'learn', 'master', 'with', 'your'].includes(w));
      const matchedToken = gTokens.find(token => {
        const tokenRegex = new RegExp(`\\b${token}\\b`, 'i');
        return tokenRegex.test(text);
      });
      if (matchedToken) {
        extracted.goalId = g.id;
        extracted.goalTitle = g.title;
        if (!extracted.areas && g.category) {
          const areaLabel = g.category === 'health' ? 'Health & Vitality' : g.category === 'creative' ? 'Creative & Expression' : 'Career & Craft';
          extracted.areas = [areaLabel];
        }
        explicitScore += 0.2;
        break;
      }
    }
  }

  // 6c. Auto-detect Habit from natural title tokens
  if (!extracted.habitId && Array.isArray(habits) && habits.length > 0) {
    const lowerText = text.toLowerCase();
    for (const h of habits) {
      if (!h || !h.title) continue;
      const lowerHTitle = h.title.toLowerCase();
      if (lowerHTitle.length >= 4 && lowerText.includes(lowerHTitle)) {
        extracted.habitId = h.id;
        extracted.habitTitle = h.title;
        extracted.linkedHabitId = h.id;
        explicitScore += 0.2;
        break;
      }
      const hTokens = lowerHTitle.split(/[\s/]+/).filter(w => w.length >= 4 && !['daily', 'every', 'routine', 'with'].includes(w));
      const matchedToken = hTokens.find(token => {
        const tokenRegex = new RegExp(`\\b${token}\\b`, 'i');
        return tokenRegex.test(text);
      });
      if (matchedToken) {
        extracted.habitId = h.id;
        extracted.habitTitle = h.title;
        extracted.linkedHabitId = h.id;
        explicitScore += 0.2;
        break;
      }
    }
  }

  // 7. Clean up remaining text to get cleanTitle
  let cleanTitle = text
    .replace(/\s+/g, ' ')
    .trim();

  // If recurrence was parsed or title has repeat tokens, clean them cleanly
  if (extracted.recurrence || extracted.recurrenceEndDate || /^\s*repeat\b/i.test(cleanTitle)) {
    cleanTitle = cleanTitle.replace(/^\s*repeat\s+/i, '');
    cleanTitle = cleanTitle.replace(/\s+repeat\s*$/i, '');
    cleanTitle = cleanTitle.replace(/\s+repeat\s+/gi, ' ');
  }

  // Strip dangling prepositions and conjunctions left over from extraction
  cleanTitle = cleanTitle
    .replace(/^(?:for|fot|fro|at|on|every|till|until|through|ending|dur|duration)\s+/i, '')
    .replace(/\s+(?:for|fot|fro|at|on|every|till|until|through|ending|dur|duration)$/i, '')
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
    if (!extracted.impact && memoryResult.inferred.impact) {
      extracted.impact = memoryResult.inferred.impact;
      if (!extracted.priority) extracted.priority = memoryResult.inferred.impact === 'high' ? 'high' : memoryResult.inferred.impact === 'low' ? 'low' : 'normal';
    }
    if (!extracted.goalId && memoryResult.inferred.goalId) {
      extracted.goalId = memoryResult.inferred.goalId;
      extracted.goalTitle = memoryResult.inferred.goalTitle;
    }
    if (!extracted.habitId && memoryResult.inferred.habitId) {
      extracted.habitId = memoryResult.inferred.habitId;
      extracted.habitTitle = memoryResult.inferred.habitTitle;
      extracted.linkedHabitId = memoryResult.inferred.habitId;
    }
    isFromLearnedMemory = true;
    learnedSource = memoryResult.source;
    explicitScore += memoryResult.confidenceBoost || 0.35;
  }

  // 9. Infer Task Effort & Energy level based on the semantic NATURE and cognitive/physical strain of the task
  const hasDetected = Object.keys(extracted).length > 0;
  if (hasDetected) {
    if (!extracted.energy) {
      extracted.energy = classifyTaskEffort(cleanTitle || input, extracted);
    }
    extracted.effort = extracted.energy.toLowerCase();
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

/**
 * Evaluates task nature, semantic strain, and cognitive/physical intensity.
 * Effort does not only rely on time/duration, but what kind of task it is.
 */
export function classifyTaskEffort(text = '', extracted = {}) {
  const clean = text.toLowerCase();

  // 1. Explicit conversational effort indicators
  if (/\b(deep focus|deep work|intense|strenuous|heavy|exhausting|hard|demanding|high effort|complex|grueling)\b/i.test(clean)) {
    return 'High';
  }
  if (/\b(light|easy|quick|casual|low effort|simple|chill|relax\w*|breeze|minor|small)\b/i.test(clean)) {
    return 'Low';
  }
  if (/\b(moderate|medium effort|standard|steady)\b/i.test(clean)) {
    return 'Medium';
  }

  // 2. High Physical Strain / Athletic Exertion (High Effort regardless of whether it is 20m or 60m)
  if (/\b(gym|workout|hiit|crossfit|sprint|weights|lift|lifting|cardio|pushups|deadlift|squats|marathon|boxing|sparring|training|run|jog|swim)\b/i.test(clean)) {
    return 'High';
  }

  // 3. High Cognitive / Mental Intensity & Depth (High Effort even for short sessions)
  if (/\b(code|coding|debug|debugging|program|programming|refactor|architect|architecture|algorithm|thesis|dissertation|write essay|exam|study for|audit|taxes|tax|accounting|financial model|balance sheet|pitch deck|system design|troubleshoot|root cause)\b/i.test(clean)) {
    return 'High';
  }

  // 4. High Stress / Emotional Friction / High Stakes
  if (/\b(dentist|doctor|surgery|interview|negotiate|performance review|court|dispute|confront)\b/i.test(clean)) {
    return 'High';
  }

  // 5. Low Friction / Routine / Passive / Admin (Low Effort even if 45m or 1h)
  if (/\b(groceries|grocery|buy|order|shop|laundry|wash dishes|dishes|trash|take out trash|clean room|dust|sweep|reply to email|check email|slack|check mail|water plants|walk\w*|stroll\w*|podcast|stretch\w*|tea|coffee|listen\w*|casual read|skim|browse)\b/i.test(clean)) {
    return 'Low';
  }

  // 6. Medium Structured Production
  if (/\b(draft|design|wireframe|edit|write blog|prep meal|cook dinner|meal prep|sync|meeting|review pr|research|plan trip|organize|declutter)\b/i.test(clean)) {
    return 'Medium';
  }

  // 7. Check queryLearnedMemory if available
  try {
    const mem = queryLearnedMemory(text);
    if (mem.matched && mem.inferred.energy) {
      return mem.inferred.energy;
    }
  } catch {
    // Safe noop
  }

  // 8. Fallback heuristics: If duration is very high (>= 90m) without any light indicators -> High
  if (extracted.durationMinutes && extracted.durationMinutes >= 90) {
    return 'High';
  }

  return 'Medium';
}
