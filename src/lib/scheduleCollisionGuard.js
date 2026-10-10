/**
 * Schedule Collision Guard
 * Advanced temporal interval algebra with Minkowski transition friction tensors
 * and stochastic duration collision modeling.
 */

import { parseTimeString, calculateDuration, calculateEndTime, isTaskScheduledForDate, isTaskCompletedForDate, taskPlanDate } from './taskMetadata.js';

/**
 * Effort level to numeric rank [1, 5]
 */
function normalizeEffortRank(effort, energy) {
  const eStr = (effort || energy || '').toString().toLowerCase();
  if (eStr === 'high' || eStr === '5' || eStr === 'urgent') return 5;
  if (eStr === 'medium' || eStr === 'normal' || eStr === '3') return 3;
  if (eStr === 'low' || eStr === '1') return 1;
  return 2;
}

/**
 * Calculates transition buffer tensor between two sequential events
 * tau(A, B) = baseTransit + modalityPenalty + fatigueDilation(effort_A)
 */
export function calculateTransitionBuffer(itemA = {}, itemB = {}) {
  // Base transition: 5 minutes default
  let buffer = 5;

  const areaA = (Array.isArray(itemA.areas) ? itemA.areas[0] : itemA.category) || '';
  const areaB = (Array.isArray(itemB.areas) ? itemB.areas[0] : itemB.category) || '';

  // Modality switch penalty (e.g. Health/Gym <-> Deep Focus/Academic)
  const isGymA = /health|vitality|gym|workout|run/i.test(areaA) || /gym|workout|run/i.test(itemA.title || '');
  const isGymB = /health|vitality|gym|workout|run/i.test(areaB) || /gym|workout|run/i.test(itemB.title || '');
  const isClassA = /class|lecture|college|lab/i.test(itemA.title || '') || itemA.isSchedule;
  const isClassB = /class|lecture|college|lab/i.test(itemB.title || '') || itemB.isSchedule;

  if (isGymA !== isGymB) {
    buffer += 20; // 25 mins for physical <-> mental shift / commute
  } else if (isClassA !== isClassB) {
    buffer += 15; // 20 mins campus/class commute
  }

  // Fatigue cool-down dilation based on Effort^2
  const effortRank = normalizeEffortRank(itemA.effort, itemA.energy);
  if (effortRank >= 4) {
    buffer += 15; // High cognitive/physical strain cool-down
  } else if (effortRank === 3) {
    buffer += 5;
  }

  return buffer;
}

/**
 * Converts HH:MM string to absolute minutes from 00:00
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const s24 = parseTimeString(timeStr) || timeStr;
  const [h, m] = s24.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Converts absolute minutes from 00:00 to HH:MM format
 */
export function minutesToTime(mins) {
  if (mins === null || isNaN(mins)) return '';
  const total = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Evaluates collision risk between candidate interval and existing scheduled interval
 * Returns collision metric R in [0, 1] and classification
 */
export function computeCollisionRisk(candidate, existing) {
  const cStart = timeToMinutes(candidate.startTime);
  if (cStart === null) return { riskScore: 0, level: 'clear', overlapMins: 0 };

  const cDur = Number(candidate.durationMinutes || candidate.duration) || 45;
  const cEnd = cStart + cDur;

  const eStart = timeToMinutes(existing.startTime);
  if (eStart === null) return { riskScore: 0, level: 'clear', overlapMins: 0 };

  let eDur = Number(existing.durationMinutes || existing.duration);
  if (!eDur || isNaN(eDur)) {
    if (existing.endTime) {
      const diff = calculateDuration(existing.startTime, existing.endTime);
      if (diff > 0) eDur = diff;
    }
  }
  if (!eDur || isNaN(eDur)) eDur = 45;
  const eEnd = eStart + eDur;

  // 1. Direct Temporal Overlap: [s_c, e_c] intersect [s_e, e_e]
  const directOverlap = Math.max(0, Math.min(cEnd, eEnd) - Math.max(cStart, eStart));
  if (directOverlap > 0) {
    const overlapRatio = directOverlap / Math.min(cDur, eDur);
    return {
      riskScore: Math.min(1.0, 0.75 + 0.25 * overlapRatio),
      level: 'hard',
      overlapMins: directOverlap,
      type: 'direct_overlap',
      explanation: `Direct time conflict of ${directOverlap}m with "${existing.title}".`
    };
  }

  // 2. Minkowski Transition Buffer Squeeze
  // Check if candidate is after existing or before existing
  if (cStart >= eEnd) {
    // Candidate starts after existing ends
    const availableGap = cStart - eEnd;
    const requiredBuffer = calculateTransitionBuffer(existing, candidate);
    if (availableGap < requiredBuffer) {
      const deficit = requiredBuffer - availableGap;
      const riskScore = 0.35 + 0.35 * (deficit / requiredBuffer);
      return {
        riskScore,
        level: 'soft',
        overlapMins: 0,
        gapDeficit: deficit,
        requiredBuffer,
        type: 'buffer_squeeze',
        explanation: `Squeeze: only ${availableGap}m buffer after "${existing.title}" (${requiredBuffer}m recommended for transition/recovery).`
      };
    }
  } else if (cEnd <= eStart) {
    // Candidate ends before existing starts
    const availableGap = eStart - cEnd;
    const requiredBuffer = calculateTransitionBuffer(candidate, existing);
    if (availableGap < requiredBuffer) {
      const deficit = requiredBuffer - availableGap;
      const riskScore = 0.35 + 0.35 * (deficit / requiredBuffer);
      return {
        riskScore,
        level: 'soft',
        overlapMins: 0,
        gapDeficit: deficit,
        requiredBuffer,
        type: 'buffer_squeeze',
        explanation: `Squeeze: only ${availableGap}m buffer before "${existing.title}" (${requiredBuffer}m recommended for transition/recovery).`
      };
    }
  }

  return { riskScore: 0, level: 'clear', overlapMins: 0 };
}

/**
 * Checks candidate against all tasks and fixed schedules for a target date
 */
export function detectScheduleCollisions({
  candidate = {},
  tasks = [],
  schedules = [],
  date = ''
}) {
  if (!candidate.startTime || !date) {
    return { hasCollision: false, riskLevel: 'clear', riskScore: 0, collisions: [] };
  }

  const collisions = [];

  // 1. Check against fixed schedules
  for (const s of schedules || []) {
    if (s.id === candidate.id) continue;
    // Check if schedule falls on this date
    const matchesDate = s.plannedDate === date || (s.repeat && s.repeat !== 'never');
    if (!matchesDate) continue;

    const risk = computeCollisionRisk(candidate, { ...s, isSchedule: true });
    if (risk.level !== 'clear') {
      collisions.push({
        item: s,
        isFixedSchedule: true,
        ...risk
      });
    }
  }

  // 2. Check against scheduled tasks
  for (const t of tasks || []) {
    if (t.id === candidate.id || isTaskCompletedForDate(t, date)) continue;
    if (!t.startTime) continue;
    if (!isTaskScheduledForDate(t, date)) continue;

    const risk = computeCollisionRisk(candidate, t);
    if (risk.level !== 'clear') {
      collisions.push({
        item: t,
        isFixedSchedule: false,
        ...risk
      });
    }
  }

  if (collisions.length === 0) {
    return { hasCollision: false, riskLevel: 'clear', riskScore: 0, collisions: [] };
  }

  // Sort by highest risk score first
  collisions.sort((a, b) => b.riskScore - a.riskScore);
  const worst = collisions[0];

  return {
    hasCollision: true,
    riskLevel: worst.level,
    riskScore: worst.riskScore,
    conflictingItem: worst.item,
    explanation: worst.explanation,
    collisions
  };
}

/**
 * Finds the nearest conflict-free gap for the candidate item
 */
export function findOptimalTimeGap({
  candidate = {},
  tasks = [],
  schedules = [],
  date = '',
  workDayStart = '08:00',
  workDayEnd = '22:00'
}) {
  const dur = Number(candidate.durationMinutes || candidate.duration) || 45;
  const startLimit = timeToMinutes(workDayStart) || 480;
  const endLimit = timeToMinutes(workDayEnd) || 1320;

  // Test slots every 15 minutes
  let bestSlot = null;
  let lowestTension = Infinity;

  for (let slot = startLimit; slot + dur <= endLimit; slot += 15) {
    const slotTimeStr = minutesToTime(slot);
    const testCandidate = { ...candidate, startTime: slotTimeStr, durationMinutes: dur };
    const evalRes = detectScheduleCollisions({ candidate: testCandidate, tasks, schedules, date });

    if (!evalRes.hasCollision) {
      return { suggestedTime: slotTimeStr, riskScore: 0 };
    }

    if (evalRes.riskScore < lowestTension) {
      lowestTension = evalRes.riskScore;
      bestSlot = slotTimeStr;
    }
  }

  return {
    suggestedTime: bestSlot || workDayStart,
    riskScore: lowestTension === Infinity ? 0 : lowestTension
  };
}
