/**
 * Core Task Dependency & Sequential Chain Engine
 * Provides deterministic blocking detection, natural series sequencing,
 * cascade rescheduling, and topological bottleneck identification.
 */

import { isTaskCompletedForDate } from './taskMetadata.js';

/**
 * Extracts natural series number and prefix from a title.
 * Examples:
 *   "CN Lecture 1" -> { seriesKey: "cn lecture", index: 1 }
 *   "MERN 17 : Final Features" -> { seriesKey: "mern", index: 17 }
 *   "Part 2 - System Design" -> { seriesKey: "system design", index: 2 }
 *   "Chapter 03" -> { seriesKey: "chapter", index: 3 }
 */
export function parseSeriesToken(title = '') {
  if (!title || typeof title !== 'string') return null;
  const clean = title.trim();

  // Pattern 1: e.g. "CN Lecture 1" or "CN-Lecture 2" or "CN Lecture #3"
  const m1 = clean.match(/^(.+?)(?:\s+|-|#)+(\d{1,3})(?:\s*[:\-–]\s*(.+))?$/i);
  if (m1) {
    const rawPrefix = m1[1].replace(/[\s\-_#:]+$/g, '').toLowerCase();
    const num = parseInt(m1[2], 10);
    if (!isNaN(num) && num > 0) {
      return {
        seriesKey: rawPrefix,
        index: num,
        suffix: m1[3]?.trim() || ''
      };
    }
  }

  // Pattern 2: e.g. "Lecture 1: Intro to CN"
  const m2 = clean.match(/^(?:lecture|part|chapter|ch|mod|module|step)\s*(\d{1,3})\s*[:\-–]\s*(.+)$/i);
  if (m2) {
    const num = parseInt(m2[1], 10);
    const suffix = m2[2]?.trim().toLowerCase();
    if (!isNaN(num)) {
      return {
        seriesKey: suffix ? `series_${suffix}` : 'series_default',
        index: num,
        suffix: m2[2]?.trim() || ''
      };
    }
  }

  return null;
}

/**
 * Automatically discovers implicit sequential dependencies within a Goal or series
 * when a user hasn't explicitly set dependsOn.
 */
export function getImplicitGoalPrerequisites(task, allTasks = [], goals = []) {
  if (!task?.title) return [];
  
  // If task belongs to a goal marked sequential
  const parentGoal = task.goalId ? goals.find(g => String(g.id) === String(task.goalId)) : null;
  const parsed = parseSeriesToken(task.title);

  // Case A: Goal is explicitly sequential OR has natural series numbering (e.g. CN Lecture 1, 2, 3)
  if (parsed) {
    // Find earlier numbered tasks in the same series
    const candidateTasks = allTasks.filter(t => {
      if (String(t.id) === String(task.id)) return false;
      // If task has a goal, prefer matching goalId or matching seriesKey
      if (task.goalId && t.goalId && String(t.goalId) !== String(task.goalId)) return false;
      const tParsed = parseSeriesToken(t.title);
      if (!tParsed) return false;
      return tParsed.seriesKey === parsed.seriesKey && tParsed.index < parsed.index;
    });

    // Sort ascending by index
    candidateTasks.sort((a, b) => {
      const idxA = parseSeriesToken(a.title)?.index || 0;
      const idxB = parseSeriesToken(b.title)?.index || 0;
      return idxA - idxB;
    });

    return candidateTasks;
  }

  // Case B: Goal is marked isSequential: true (Ordered deliverable waterfall)
  if (parentGoal?.isSequential && parentGoal?.id) {
    const goalTasks = allTasks.filter(t => String(t.goalId) === String(parentGoal.id));
    const currentIndex = goalTasks.findIndex(t => String(t.id) === String(task.id));
    if (currentIndex > 0) {
      return goalTasks.slice(0, currentIndex);
    }
  }

  return [];
}

/**
 * Returns all prerequisite task objects (both explicit and implicit).
 */
export function getAllPrerequisites(task, allTasks = [], goals = []) {
  if (!task) return [];
  const explicitIds = new Set(
    Array.isArray(task.dependsOn) ? task.dependsOn.map(String) : (task.dependsOn ? [String(task.dependsOn)] : [])
  );

  const result = [];
  const visited = new Set();

  // Add explicit
  for (const depId of explicitIds) {
    const found = allTasks.find(t => String(t.id) === depId);
    if (found && !visited.has(String(found.id))) {
      visited.add(String(found.id));
      result.push(found);
    }
  }

  // If no explicit dependsOn, check implicit sequential chain
  if (result.length === 0) {
    const implicit = getImplicitGoalPrerequisites(task, allTasks, goals);
    for (const t of implicit) {
      if (!visited.has(String(t.id))) {
        visited.add(String(t.id));
        result.push(t);
      }
    }
  }

  return result;
}

/**
 * Returns list of uncompleted prerequisite task objects.
 */
export function getBlockingPrerequisites(task, allTasks = [], goals = [], targetDate = '') {
  const prereqs = getAllPrerequisites(task, allTasks, goals);
  if (prereqs.length === 0) return [];

  return prereqs.filter(pt => !isTaskCompletedForDate(pt, targetDate));
}

/**
 * Returns true if the task is blocked by one or more incomplete prerequisites.
 */
export function isTaskBlocked(task, allTasks = [], goals = [], targetDate = '') {
  if (!task) return false;
  if (isTaskCompletedForDate(task, targetDate)) return false;

  const blockers = getBlockingPrerequisites(task, allTasks, goals, targetDate);
  return blockers.length > 0;
}

/**
 * Finds the earliest uncompleted bottleneck task in a chain.
 */
export function findRootBottleneck(task, allTasks = [], goals = [], targetDate = '') {
  const blockers = getBlockingPrerequisites(task, allTasks, goals, targetDate);
  if (blockers.length === 0) return null;

  // Recurse to find the absolute root prerequisite of the first blocker
  let current = blockers[0];
  const seen = new Set([String(current.id)]);

  while (true) {
    const upstream = getBlockingPrerequisites(current, allTasks, goals, targetDate);
    if (upstream.length === 0) break;
    const next = upstream[0];
    if (seen.has(String(next.id))) break; // avoid infinite loop
    seen.add(String(next.id));
    current = next;
  }

  return current;
}

/**
 * Cascade Rescheduler:
 * Given a missed prerequisite task (e.g. CN-1) and a new start time,
 * recalculates and shifts all downstream dependent tasks in order.
 */
export function calculateCascadeReschedule({
  rootTask,
  newStartTime = '18:00',
  newDate = '',
  allTasks = [],
  goals = []
}) {
  if (!rootTask) return [];

  const targetDate = newDate || rootTask.plannedDate || new Date().toISOString().slice(0, 10);
  const patches = [];

  // 1. Root task patch
  const rootDuration = Number(rootTask.durationMinutes) || 45;
  patches.push({
    id: rootTask.id,
    plannedDate: targetDate,
    startTime: newStartTime,
    durationMinutes: rootDuration
  });

  // 2. Discover downstream dependents
  const dependents = allTasks.filter(t => {
    if (String(t.id) === String(rootTask.id)) return false;
    const prereqs = getAllPrerequisites(t, allTasks, goals);
    return prereqs.some(p => String(p.id) === String(rootTask.id));
  });

  // Sort dependents by natural series index or existing startTime
  dependents.sort((a, b) => {
    const idxA = parseSeriesToken(a.title)?.index || 0;
    const idxB = parseSeriesToken(b.title)?.index || 0;
    if (idxA !== idxB) return idxA - idxB;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });

  // Compute ripple times
  const [hStr, mStr] = newStartTime.split(':').map(Number);
  let cursorMins = (hStr || 18) * 60 + (mStr || 0) + rootDuration + 10; // 10 min break buffer

  for (const dep of dependents) {
    const dur = Number(dep.durationMinutes) || 45;
    const hh = String(Math.floor(cursorMins / 60) % 24).padStart(2, '0');
    const mm = String(cursorMins % 60).padStart(2, '0');
    const sTime = `${hh}:${mm}`;

    patches.push({
      id: dep.id,
      plannedDate: targetDate,
      startTime: sTime,
      durationMinutes: dur
    });

    cursorMins += dur + 10; // 10m buffer for next
  }

  return patches;
}
