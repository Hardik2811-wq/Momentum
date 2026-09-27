/**
 * Copilot Local Intent Router
 * Resolves frequent personal commands (queries, additions, completions, checks)
 * directly in the browser with 0 API tokens and 0ms latency.
 */
import { parseNaturalTask } from './nlpParser.js';
import { harvestApiResult } from './nlpMemory.js';
import { calculateEndTime } from './taskMetadata.js';

export function resolveLocalCopilotIntent({
  query = '',
  tasks = [],
  goals = [],
  habits = [],
  stats = null,
  todayDate = '',
  actions = {}
}) {
  const text = (query || '').trim();
  if (!text) return { handledLocally: false };

  const today = todayDate || new Date().toISOString().slice(0, 10);

  // 1. ADD TASK (e.g., "Add task: Gym session today 18:00 45m" or "Schedule task Prepare pitch")
  const addTaskMatch = text.match(/^(?:add\s+task|schedule\s+task|new\s+task|todo)\s*:\s*(.+)$/i)
    || text.match(/^(?:add|schedule)\s+task\s+(.+)$/i);

  if (addTaskMatch && addTaskMatch[1]) {
    const rawTaskText = addTaskMatch[1].trim();
    const parsed = parseNaturalTask(rawTaskText, goals, habits);
    const title = parsed.cleanTitle || rawTaskText;
    const ext = parsed.extracted || {};

    if (title) {
      const durMins = ext.durationMinutes || 60;
      const endTime = ext.startTime ? calculateEndTime(ext.startTime, durMins) : null;

      const newTask = {
        id: Date.now(),
        title,
        plannedDate: ext.plannedDate || today,
        startTime: ext.startTime || null,
        endTime,
        durationMinutes: durMins,
        duration: durMins,
        energy: ext.energy || 'Normal',
        impact: ext.energy === 'High' ? 'high' : 'medium',
        priority: ext.urgency === 'today' ? 'high' : 'normal',
        areas: ext.areas && ext.areas.length > 0 ? ext.areas : ['Career & Craft'],
        goalId: ext.goalId || null,
        linkedHabitId: ext.linkedHabitId || null,
        completed: false,
        dueDate: ext.plannedDate === today ? 'Today' : 'This Week'
      };

      if (typeof actions.addTask === 'function') {
        actions.addTask(newTask);
      }

      // Reinforce local memory harvest
      harvestApiResult(title, {
        areas: newTask.areas,
        energy: newTask.energy,
        durationMinutes: newTask.duration
      });

      const timeLabel = newTask.startTime ? ` at ${newTask.startTime}` : '';
      const dateLabel = newTask.plannedDate === today ? 'Today' : newTask.plannedDate;
      return {
        handledLocally: true,
        message: `✓ Scheduled task **"${newTask.title}"** for ${dateLabel}${timeLabel} (${newTask.duration}m).`,
        plan: null
      };
    }
  }

  // 2. COMPLETE TASK (e.g. "Mark task Design auth as done", "Complete task Gym")
  const completeMatch = text.match(/^(?:mark|set|check)\s+(?:task\s+)?["']?(.+?)["']?\s+(?:as\s+)?(?:done|complete|completed)$/i)
    || text.match(/^(?:complete|finish)\s+(?:task\s+)?["']?(.+?)["']?$/i);

  if (completeMatch && completeMatch[1]) {
    const targetQuery = completeMatch[1].trim().toLowerCase();
    const targetTask = (tasks || []).find(t =>
      t.title.toLowerCase().includes(targetQuery) || targetQuery.includes(t.title.toLowerCase())
    );

    if (targetTask) {
      if (typeof actions.toggleTask === 'function') {
        actions.toggleTask(targetTask.id);
      }
      return {
        handledLocally: true,
        message: `✓ Marked task **"${targetTask.title}"** as completed.`,
        plan: null
      };
    }
  }

  // 3. CHECK IN HABIT (e.g. "Check in habit Morning Run", "Log habit Workout")
  const habitMatch = text.match(/^(?:check\s*in|log|did)\s+(?:habit\s+)?["']?(.+?)["']?$/i);
  if (habitMatch && habitMatch[1]) {
    const targetQuery = habitMatch[1].trim().toLowerCase();
    const targetHabit = (habits || []).find(h =>
      h.title.toLowerCase().includes(targetQuery) || targetQuery.includes(h.title.toLowerCase())
    );

    if (targetHabit) {
      if (typeof actions.checkInHabit === 'function') {
        actions.checkInHabit(targetHabit.id);
      }
      const streak = (targetHabit.streak || 0) + 1;
      return {
        handledLocally: true,
        message: `↻ Checked in habit **"${targetHabit.title}"** (Current streak: ${streak} days).`,
        plan: null
      };
    }
  }

  // 4. QUERY TODAY'S SCHEDULE (e.g. "What do I have today?", "Show today schedule")
  if (/^(what('s|\s+is)\s+(on\s+my\s+schedule|scheduled|today)|what\s+do\s+i\s+have(\s+today)?|show\s+(today('s)?\s+)?(schedule|tasks)|today('s)?\s+(schedule|tasks))(\?)?$/i.test(text)) {
    const todayTasks = (tasks || []).filter(t => (t.plannedDate || (t.dueDate === 'Today' ? today : null)) === today);
    if (todayTasks.length === 0) {
      return {
        handledLocally: true,
        message: `Your schedule is completely clear for today (${today}). No open tasks planned.`,
        plan: null
      };
    }

    const taskLines = todayTasks.map(t => {
      const time = t.startTime ? `\`${t.startTime}\`` : 'Anytime';
      const status = t.completed ? '✓' : '○';
      return `- ${status} ${time} **${t.title}** (${t.durationMinutes || t.duration || 30}m)`;
    });

    return {
      handledLocally: true,
      message: `**Today's Schedule (${todayTasks.length} items):**\n\n${taskLines.join('\n')}`,
      plan: null
    };
  }

  // 5. QUERY OVERDUE TASKS
  if (/^(show|what('s|\s+is))\s+overdue(\s+tasks)?(\?)?$/i.test(text)) {
    const overdueTasks = (tasks || []).filter(t => !t.completed && t.plannedDate && t.plannedDate < today);
    if (overdueTasks.length === 0) {
      return {
        handledLocally: true,
        message: `🎉 No overdue tasks! All your past commitments are up to date.`,
        plan: null
      };
    }

    const lines = overdueTasks.map(t => `- **${t.title}** (due ${t.plannedDate})`);
    return {
      handledLocally: true,
      message: `**Overdue Tasks (${overdueTasks.length}):**\n\n${lines.join('\n')}`,
      plan: null
    };
  }

  // 6. QUERY GOALS
  if (/^(show|what\s+are|list)\s+(my\s+)?goals(\?)?$/i.test(text)) {
    if (!goals || goals.length === 0) {
      return {
        handledLocally: true,
        message: `No active goals set yet. You can create one anytime or ask Copilot to suggest a roadmap.`,
        plan: null
      };
    }

    const lines = goals.map(g => `- **${g.title}** — ${Math.round(g.progress || 0)}% progress (due ${g.targetDate || 'open'})`);
    return {
      handledLocally: true,
      message: `**Active Goals (${goals.length}):**\n\n${lines.join('\n')}`,
      plan: null
    };
  }

  // 7. QUERY HABITS
  if (/^(show|what\s+are|list)\s+(my\s+)?habits(\?)?$/i.test(text)) {
    if (!habits || habits.length === 0) {
      return {
        handledLocally: true,
        message: `No active habits created yet.`,
        plan: null
      };
    }

    const lines = habits.map(h => `- **${h.title}** — ${h.streak || 0}d streak (${h.cadence || 'Daily'})`);
    return {
      handledLocally: true,
      message: `**Daily Habits (${habits.length}):**\n\n${lines.join('\n')}`,
      plan: null
    };
  }

  // 8. QUERY STATS / ANALYTICS
  if (/^(show|what('s|\s+is)\s+my)\s+(stats|analytics|momentum|score)(\?)?$/i.test(text)) {
    if (!stats) {
      return {
        handledLocally: true,
        message: `Analytics will update as you complete tasks and habits.`,
        plan: null
      };
    }

    return {
      handledLocally: true,
      message: `**Personal Momentum Digest:**\n- **Momentum Score**: ${stats.momentumScore || 0}%\n- **Completion Rate**: ${stats.completionRate || 0}%\n- **Active Streak**: ${stats.longestStreak || 0} days\n- **Habits Done Today**: ${stats.habitsCompletedToday || 0} of ${stats.totalHabits || 0}\n- **Focus Logged Today**: ${stats.completedFocusMinutes || 0} mins`,
      plan: null
    };
  }

  return { handledLocally: false };
}
