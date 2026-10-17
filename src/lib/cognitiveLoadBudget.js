/**
 * Cognitive Load Budget Tracker for Momentum OS
 * Monitors prefrontal cortex depletion and forecasts biological fatigue points.
 * Calibrated against Cal Newport (Deep Work, 2016) and Sweller (Cognitive Load Theory).
 */

import { classifySemanticEssence, COGNITIVE_MODALITIES } from './autonomousSemanticOntology.js';

export const DEFAULT_COGNITIVE_BUDGET = {
  deepWorkMinutes: 240,       // 4 hours maximum sustainable high-intensity synthesis
  meetingMinutes: 180,        // 3 hours emotional / social negotiation
  adminMinutes: 120,          // 2 hours willpower-draining administrative tasks
  totalActiveMinutes: 600     // 10 hours gross cognitive day limit
};

/**
 * Calculates current cognitive load budget consumption and estimates crash point.
 */
export function evaluateCognitiveLoadBudget(timelineItems = [], customBudget = {}) {
  const budget = { ...DEFAULT_COGNITIVE_BUDGET, ...customBudget };

  let deepWorkSpent = 0;
  let meetingSpent = 0;
  let adminSpent = 0;
  let decompressionSpent = 0;

  // Track chrono-sorted consumption
  const sortedItems = [...timelineItems]
    .filter(i => i.startTime)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  let cumulativeMinutes = 0;
  let estimatedCrashTime = null;

  sortedItems.forEach(item => {
    const essence = classifySemanticEssence(item);
    const duration = Number(item.durationMinutes || item.duration || 45);

    if (essence.modality === COGNITIVE_MODALITIES.DEEP_CREATION) {
      deepWorkSpent += duration;
    } else if (essence.modality === COGNITIVE_MODALITIES.EMOTIONAL_SOCIAL) {
      meetingSpent += duration;
    } else if (essence.modality === COGNITIVE_MODALITIES.ADMINISTRATIVE_FRICTION) {
      adminSpent += duration;
    } else if (essence.modality === COGNITIVE_MODALITIES.DECOMPRESSION_REST) {
      decompressionSpent += duration;
    }

    cumulativeMinutes += duration;

    // Detect when cumulative high-strain work breaches deep work ceiling
    if (deepWorkSpent >= budget.deepWorkMinutes && !estimatedCrashTime && item.startTime) {
      const [h, m] = item.startTime.split(':').map(Number);
      const crashMinutes = h * 60 + m + duration;
      const ch = Math.floor(crashMinutes / 60) % 24;
      const cm = crashMinutes % 60;
      estimatedCrashTime = `${String(ch).padStart(2, '0')}:${String(cm).padStart(2, '0')}`;
    }
  });

  const totalSpent = deepWorkSpent + meetingSpent + adminSpent + decompressionSpent;

  const isOverloaded =
    deepWorkSpent > budget.deepWorkMinutes ||
    adminSpent > budget.adminMinutes ||
    totalSpent > budget.totalActiveMinutes;

  let overloadVector = null;
  if (deepWorkSpent > budget.deepWorkMinutes) overloadVector = 'DEEP_WORK_EXCEEDED';
  else if (adminSpent > budget.adminMinutes) overloadVector = 'ADMIN_WILLPOWER_DEPLETED';
  else if (totalSpent > budget.totalActiveMinutes) overloadVector = 'GROSS_CAPACITY_EXCEEDED';

  return {
    deepWork: {
      spent: deepWorkSpent,
      budget: budget.deepWorkMinutes,
      remaining: Math.max(0, budget.deepWorkMinutes - deepWorkSpent),
      percentUsed: Math.min(100, Math.round((deepWorkSpent / budget.deepWorkMinutes) * 100))
    },
    meetings: {
      spent: meetingSpent,
      budget: budget.meetingMinutes,
      remaining: Math.max(0, budget.meetingMinutes - meetingSpent),
      percentUsed: Math.min(100, Math.round((meetingSpent / budget.meetingMinutes) * 100))
    },
    admin: {
      spent: adminSpent,
      budget: budget.adminMinutes,
      remaining: Math.max(0, budget.adminMinutes - adminSpent),
      percentUsed: Math.min(100, Math.round((adminSpent / budget.adminMinutes) * 100))
    },
    total: {
      spent: totalSpent,
      budget: budget.totalActiveMinutes,
      remaining: Math.max(0, budget.totalActiveMinutes - totalSpent),
      percentUsed: Math.min(100, Math.round((totalSpent / budget.totalActiveMinutes) * 100))
    },
    isOverloaded,
    overloadVector,
    fatigueForecast: {
      estimatedCrashTime,
      decompressionBufferMinutes: decompressionSpent,
      warningMessage: isOverloaded
        ? `Cognitive capacity ceiling exceeded (${overloadVector}). Expect severe decision fatigue after ${estimatedCrashTime || 'late afternoon'}.`
        : 'Cognitive load is within sustainable neuro-biological thresholds.'
    }
  };
}
