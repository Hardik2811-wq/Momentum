export const IMPACT_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

function localDateKey(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function todayPlanDate() {
  return localDateKey(new Date());
}

export function tomorrowPlanDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return localDateKey(tomorrow);
}

export function taskPlanDate(task = {}) {
  if (task.plannedDate) return task.plannedDate;
  if (task.dueDate === 'Today' || task.date === 'Today') return todayPlanDate();
  if (task.dueDate === 'Tomorrow' || task.date === 'Tomorrow') return tomorrowPlanDate();
  return '';
}

export function isTaskScheduledForDate(task = {}, dateStr = '') {
  if (!dateStr || !task) return false;

  // 1. Check if this specific date is excluded (e.g. "This event" deleted)
  if (Array.isArray(task.excludedDates) && task.excludedDates.includes(dateStr)) {
    return false;
  }

  // 2. Check if recurrence was capped (e.g. "This and following events" deleted)
  if (task.recurrenceUntil && dateStr >= task.recurrenceUntil) {
    return false;
  }

  const pDate = taskPlanDate(task);
  if (pDate === dateStr) return true;

  // 3. Handle recurring tasks
  if (task.recurrence && task.recurrence !== 'none') {
    // If task has a base plannedDate, don't show before base date
    if (pDate && dateStr < pDate) return false;

    const targetDate = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(targetDate.getTime())) return false;
    const dayOfWeek = targetDate.getDay(); // 0: Sun, 1: Mon, ...

    if (task.recurrence === 'daily') {
      return true;
    }
    if (task.recurrence === 'weekly') {
      if (pDate) {
        const baseDay = new Date(`${pDate}T12:00:00`).getDay();
        return dayOfWeek === baseDay;
      }
      return dayOfWeek === 1; // default Monday if no original date
    }
    if (task.recurrence === 'custom') {
      const days = Array.isArray(task.repeatDays) ? task.repeatDays : [];
      return days.includes(dayOfWeek);
    }
    if (task.recurrence === 'monthly') {
      if (pDate) {
        const baseDayNum = new Date(`${pDate}T12:00:00`).getDate();
        return targetDate.getDate() === baseDayNum;
      }
      return targetDate.getDate() === 1;
    }
    if (task.recurrence === 'yearly') {
      if (pDate) {
        return pDate.slice(5) === dateStr.slice(5);
      }
      return false;
    }
  }

  return false;
}

export function planDateLabel(date = '') {
  if (!date) return 'Not scheduled';
  if (date === todayPlanDate()) return 'Today';
  if (date === tomorrowPlanDate()) return 'Tomorrow';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? 'Not scheduled' : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function taskPlanLabel(task = {}) {
  const date = taskPlanDate(task);
  if (date) return planDateLabel(date);
  if (task.dueDate === 'This Week' || task.date === 'This Week') return 'This week';
  return 'Not scheduled';
}

export function legacyDueDateForPlan(date = '') {
  if (!date) return 'Someday';
  if (date === todayPlanDate()) return 'Today';
  if (date === tomorrowPlanDate()) return 'Tomorrow';
  return 'This Week';
}

export function urgencyFromPlan(date = '') {
  if (date === todayPlanDate()) return 'today';
  if (date) return 'week';
  return 'later';
}

export function deadlineStatus(task = {}) {
  if (!task.deadlineDate) return null;
  const value = new Date(`${task.deadlineDate}T${task.deadlineTime || '23:59'}:00`);
  if (Number.isNaN(value.getTime())) return null;
  const now = new Date();
  if (value < now) return { label: 'Overdue', tone: 'overdue', timestamp: value.getTime() };
  if (task.deadlineDate === todayPlanDate()) return { label: 'Due today', tone: 'today', timestamp: value.getTime() };
  if (task.deadlineDate === tomorrowPlanDate()) return { label: 'Due tomorrow', tone: 'upcoming', timestamp: value.getTime() };
  return { label: `Due ${planDateLabel(task.deadlineDate)}`, tone: 'upcoming', timestamp: value.getTime() };
}

export function taskImpact(task = {}) {
  if (task.impact) return task.impact;
  return task.priority === 'high' ? 'high' : task.priority === 'low' ? 'low' : 'medium';
}

// Legacy compatibility for existing task records and older views.
export function taskUrgency(task = {}) {
  return urgencyFromPlan(taskPlanDate(task));
}

export function priorityFromImpact(impact) {
  return impact === 'high' ? 'high' : impact === 'low' ? 'low' : 'normal';
}

export function dueDateFromUrgency(urgency) {
  return urgency === 'today' ? 'Today' : urgency === 'week' ? 'This Week' : 'Someday';
}

export function formatDurationLabel(minutes) {
  if (minutes === null || minutes === undefined || minutes === 'open' || minutes === 0) {
    return '~ Flexible';
  }
  const mins = Number(minutes);
  if (isNaN(mins) || mins <= 0) return '~ Flexible';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function effortLabel(minutes) {
  return formatDurationLabel(minutes);
}

export function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 24 * 60;
  return endMins - startMins;
}

export function calculateEndTime(startTime, durationMinutes) {
  if (!startTime || !durationMinutes) return '';
  const [sh, sm] = startTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm)) return '';
  const totalMins = (sh * 60 + sm + Number(durationMinutes)) % (24 * 60);
  const eh = Math.floor(totalMins / 60);
  const em = totalMins % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

export function parseCompoundDuration(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  if (['open', 'flexible', '~open', 'untimed'].includes(s)) return 'open';

  const daysMatch = s.match(/(\d+(?:\.\d+)?)\s*d(?:ays?)?/i);
  const hoursMatch = s.match(/(\d+(?:\.\d+)?)\s*h(?:(?:ou)?rs?)?/i);
  const minsMatch = s.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?/i);

  const days = daysMatch ? parseFloat(daysMatch[1]) : 0;
  const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 0;
  const mins = minsMatch ? parseFloat(minsMatch[1]) : 0;

  const total = Math.round(days * 1440 + hours * 60 + mins);
  if (total > 0) return total;

  const num = parseFloat(s);
  if (!isNaN(num) && num > 0) return Math.round(num);

  return null;
}

export function formatTimeString(timeStr) {
  if (!timeStr) return '';
  const [h, m] = String(timeStr).split(':').map(Number);
  if (isNaN(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

export function parseTimeString(str) {
  if (!str) return '';
  const s = String(str).trim().toLowerCase();
  const m = s.match(/(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm)?/i) ||
            s.match(/([01]?[0-9]|2[0-3]):([0-5][0-9])/);
  if (!m) return '';
  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}


