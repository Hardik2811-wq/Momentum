/**
 * Copilot Local Intent Router
 * Resolves frequent personal commands (queries, additions, completions, checks)
 * directly in the browser with 0 API tokens and 0ms latency.
 */
import { parseNaturalTask } from './nlpParser.js';
import { harvestApiResult } from './nlpMemory.js';
import { calculateEndTime } from './taskMetadata.js';
import { curatePromptIngress } from './cavemanCompressor.js';

export function resolveLocalCopilotIntent({
  query = '',
  tasks = [],
  goals = [],
  habits = [],
  schedules = [],
  stats = null,
  todayDate = '',
  actions = {},
  lastCreatedEntities = null
}) {
  const rawText = (query || '').trim();
  if (!rawText) return { handledLocally: false };

  // Passive Ingress Curation: strip conversational preamble, keep core intent
  const curated = curatePromptIngress(rawText);
  const text = curated.curatedPrompt || rawText;

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
    const todayScheds = (schedules || []).filter(s => s.startTime);

    if (todayTasks.length === 0 && todayScheds.length === 0) {
      return {
        handledLocally: true,
        message: `Your schedule is completely clear for today (${today}). No open tasks or classes planned.`,
        plan: null
      };
    }

    const schedLines = todayScheds.map(s => {
      const time = s.startTime ? `\`${s.startTime}${s.endTime ? `-${s.endTime}` : ''}\`` : 'Routine';
      return `- 🎓 ${time} **${s.title}** (Class, ${s.durationMinutes || 60}m)`;
    });

    const taskLines = todayTasks.map(t => {
      const time = t.startTime ? `\`${t.startTime}\`` : 'Anytime';
      const status = t.completed ? '✓' : '○';
      return `- ${status} ${time} **${t.title}** (${t.durationMinutes || t.duration || 30}m)`;
    });

    const allLines = [...schedLines, ...taskLines];

    return {
      handledLocally: true,
      message: `**Today's Schedule (${allLines.length} items):**\n\n${allLines.join('\n')}`,
      plan: null
    };
  }

  // 4b. QUERY NEXT UPCOMING (e.g. "What's next?", "What should I do next?")
  if (/^(what('s|\s+is)\s+next|what\s+(should\s+i\s+do|is\s+coming\s+up)\s+next)(\?)?$/i.test(text)) {
    const nowTime = new Date().toTimeString().slice(0, 5);
    const todayTasks = (tasks || []).filter(t => !t.completed && (t.plannedDate || (t.dueDate === 'Today' ? today : null)) === today && t.startTime && t.startTime >= nowTime);
    todayTasks.sort((a, b) => a.startTime.localeCompare(b.startTime));

    const todayScheds = (schedules || []).filter(s => s.startTime && s.startTime >= nowTime);
    todayScheds.sort((a, b) => a.startTime.localeCompare(b.startTime));

    const upcoming = [];
    if (todayTasks[0]) upcoming.push({ ...todayTasks[0], isClass: false });
    if (todayScheds[0]) upcoming.push({ ...todayScheds[0], isClass: true });
    upcoming.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    if (upcoming.length > 0) {
      const nextItem = upcoming[0];
      const typeLabel = nextItem.isClass ? 'Class' : 'Task';
      return {
        handledLocally: true,
        message: `**Up Next (${nextItem.startTime}):**\n**${nextItem.title}** (${typeLabel}, ${nextItem.durationMinutes || 60}m).\n\nCurrent time is ${nowTime}.`,
        plan: null
      };
    } else {
      const unscheduledToday = (tasks || []).find(t => !t.completed && (t.plannedDate || (t.dueDate === 'Today' ? today : null)) === today);
      if (unscheduledToday) {
        return {
          handledLocally: true,
          message: `No more timed blocks today. Next priority is **"${unscheduledToday.title}"** (Anytime).`,
          plan: null
        };
      }
      return {
        handledLocally: true,
        message: `No pending items remaining for today. You're all caught up!`,
        plan: null
      };
    }
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

  // 9. UNDO RECENT PLAN INTENT (e.g. "undo this one", "undo", "undo plan", "revert")
  const isUndoIntent = /^(undo(\s+(this(\s+one)?|plan|last\s+plan))?|revert(\s+(last\s+)?plan)?)$/i.test(text.trim());
  if (isUndoIntent && lastCreatedEntities) {
    const matchedGoals = (goals || []).filter(g => (lastCreatedEntities.goalIds || []).includes(g.id));
    const matchedHabits = (habits || []).filter(h => (lastCreatedEntities.habitIds || []).includes(h.id));
    const matchedScheds = (schedules || []).filter(s => (lastCreatedEntities.scheduleIds || []).includes(s.id));
    const matchedTasks = (tasks || []).filter(t => (lastCreatedEntities.taskIds || []).includes(t.id));

    const totalCount = matchedGoals.length + matchedHabits.length + matchedScheds.length + matchedTasks.length;
    if (totalCount > 0) {
      return {
        handledLocally: true,
        hasDeletion: true,
        deletion: {
          type: 'undo',
          summary: `Undo Recent Plan (${totalCount} items)`,
          goalIds: matchedGoals.map(g => g.id),
          habitIds: matchedHabits.map(h => h.id),
          scheduleIds: matchedScheds.map(s => s.id),
          taskIds: matchedTasks.map(t => t.id),
          items: [
            ...matchedGoals.map(g => ({ type: 'goal', id: g.id, title: g.title, category: g.category })),
            ...matchedHabits.map(h => ({ type: 'habit', id: h.id, title: h.title })),
            ...matchedScheds.map(s => ({ type: 'schedule', id: s.id, title: s.title })),
            ...matchedTasks.map(t => ({ type: 'task', id: t.id, title: t.title }))
          ]
        },
        message: `I found ${totalCount} items from your recently applied plan. Please review the items below and tap **Approve & Delete** to remove them from your workspace:`
      };
    }
  }

  // 10. EXPLICIT DELETION / REMOVAL INTENT (Goals / Horizons / Tasks / Habits / Schedules)
  const isDeleteKeyword = /\b(delete|remove|clear|drop|erase)\b/i.test(text);
  if (isDeleteKeyword) {
    const lowerText = text.toLowerCase();

    // Match goals / horizons
    const isGoalTarget = /\b(horizon|horizons|goal|goals)\b/i.test(lowerText);
    const matchedGoals = (goals || []).filter(g => {
      if (!g.title) return false;
      const clean = g.title.toLowerCase().trim();
      if (lowerText.includes(clean)) return true;
      // Multi-word partial match
      const words = clean.split(/[\s()&]+/).filter(w => w.length > 3);
      if (words.length >= 2 && words.every(w => lowerText.includes(w))) return true;
      return false;
    });

    let finalGoals = matchedGoals;
    // Fallback: if user specified "delete these horizons" or "delete all horizons"
    if (finalGoals.length === 0 && isGoalTarget) {
      if (/delete\s+(these|all|the)\s+(horizons|goals)/i.test(lowerText) && goals.length > 0) {
        if (lastCreatedEntities?.goalIds?.length) {
          finalGoals = goals.filter(g => lastCreatedEntities.goalIds.includes(g.id));
        }
        if (finalGoals.length === 0) finalGoals = goals;
      }
    }

    // Match tasks
    const isTaskTarget = /\b(task|tasks|todo|todos)\b/i.test(lowerText);
    const matchedTasks = (tasks || []).filter(t => {
      if (!t.title) return false;
      const clean = t.title.toLowerCase().trim();
      return lowerText.includes(clean);
    });

    // Match habits
    const isHabitTarget = /\b(habit|habits|ritual|rituals)\b/i.test(lowerText);
    const matchedHabits = (habits || []).filter(h => {
      if (!h.title) return false;
      const clean = h.title.toLowerCase().trim();
      return lowerText.includes(clean);
    });

    // Match schedules
    const isSchedTarget = /\b(schedule|schedules|timetable|class|classes)\b/i.test(lowerText);
    const matchedScheds = (schedules || []).filter(s => {
      if (!s.title) return false;
      const clean = s.title.toLowerCase().trim();
      return lowerText.includes(clean);
    });

    const totalCount = finalGoals.length + matchedHabits.length + matchedScheds.length + matchedTasks.length;
    if (totalCount > 0) {
      const typeLabel = finalGoals.length > 0 && totalCount === finalGoals.length ? 'horizons' : 'items';
      return {
        handledLocally: true,
        hasDeletion: true,
        deletion: {
          type: 'delete',
          summary: `Delete ${totalCount} ${typeLabel}`,
          goalIds: finalGoals.map(g => g.id),
          habitIds: matchedHabits.map(h => h.id),
          scheduleIds: matchedScheds.map(s => s.id),
          taskIds: matchedTasks.map(t => t.id),
          items: [
            ...finalGoals.map(g => ({ type: 'goal', id: g.id, title: g.title, category: g.category })),
            ...matchedHabits.map(h => ({ type: 'habit', id: h.id, title: h.title })),
            ...matchedScheds.map(s => ({ type: 'schedule', id: s.id, title: s.title })),
            ...matchedTasks.map(t => ({ type: 'task', id: t.id, title: t.title }))
          ]
        },
        message: `I found ${totalCount} ${typeLabel} to remove from your workspace. Please review the items below and tap **Approve & Delete**:`
      };
    }
  }

  return { handledLocally: false };
}
