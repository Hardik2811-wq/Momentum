/**
 * Capacity Overload Guard
 * Evaluates cognitive workload utilizing thermodynamic entropy cost,
 * circadian resonance curves, and Kingman's queuing saturation model.
 */

import { isTaskScheduledForDate, isTaskCompletedForDate, calculateDuration } from './taskMetadata.js';
import { isScheduleActiveForDate } from './missedScheduleEngine.js';

function parseTimeToHour(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return null;
  return h + (m || 0) / 60;
}

/**
 * Circadian cognitive efficiency factor C(t)
 * 1.0 is neutral baseline; > 1.0 means task drains MORE energy due to biological dip
 */
function getCircadianCostMultiplier(hour) {
  if (hour === null) return 1.0;
  // Morning peak: 09:00 - 11:30 (High alertness) -> cost multiplier 0.9 (energetic)
  if (hour >= 9 && hour <= 11.5) return 0.9;
  // Post-prandial circadian dip: 13:30 - 15:30 -> cost multiplier 1.25 (sluggish)
  if (hour >= 13.5 && hour <= 15.5) return 1.25;
  // Late evening fatigue: after 21:00 -> cost multiplier 1.25
  if (hour >= 21) return 1.25;
  // Rest of day
  return 1.0;
}

/**
 * Evaluates context-switching entropy between two items
 */
function getContextSwitchCost(areaA, areaB) {
  if (!areaA || !areaB) return 5;
  if (areaA === areaB) return 0;
  if (areaA === 'Fixed Schedule' || areaB === 'Fixed Schedule') return 5;
  // High friction switch: Deep Focus <-> Meetings or Health <-> Creative
  return 12; // 12 mins equivalent cognitive tax
}

/**
 * Computes deep cognitive load analytics for a specific date
 */
export function evaluateCapacityLoad({
  tasks = [],
  schedules = [],
  date = '',
  dailyTargetHours = 6.0
}) {
  if (!date) return { status: 'optimal', utilization: 0, effectiveHours: 0, rawHours: 0, isOverloaded: false };

  // Filter items on target date (exclude completed deliverables & completed schedules)
  const dayTasks = (tasks || []).filter(t => !isTaskCompletedForDate(t, date) && isTaskScheduledForDate(t, date));
  const daySchedules = (schedules || []).filter(s => {
    const isDone = Boolean(s.completed || (Array.isArray(s.completedDates) && s.completedDates.includes(date)));
    if (isDone) return false;
    return isScheduleActiveForDate(s, date);
  });

  let rawMinutes = 0;
  let effectiveMinutes = 0;
  let highEffortCount = 0;

  // Combine and sort by start time to evaluate transitions
  const items = [];

  for (const t of dayTasks) {
    const dur = Number(t.durationMinutes || t.duration) || 45;
    const hour = parseTimeToHour(t.startTime);
    const effort = (t.energy || t.effort || '').toLowerCase();
    const isHigh = effort === 'high' || t.impact === 'high';
    if (isHigh) highEffortCount++;

    const circadianMult = getCircadianCostMultiplier(hour);
    const effortWeight = isHigh ? 1.25 : effort === 'low' ? 0.85 : 1.0;

    rawMinutes += dur;
    effectiveMinutes += dur * circadianMult * effortWeight;

    items.push({
      time: hour !== null ? hour : 12,
      area: (Array.isArray(t.areas) ? t.areas[0] : t.category) || 'General',
      duration: dur
    });
  }

  for (const s of daySchedules) {
    let dur = Number(s.durationMinutes);
    if (!dur || isNaN(dur)) {
      if (s.startTime && s.endTime) {
        dur = calculateDuration(s.startTime, s.endTime);
      }
    }
    if (!dur || isNaN(dur)) dur = 60;

    const hour = parseTimeToHour(s.startTime);
    rawMinutes += dur;
    effectiveMinutes += dur * getCircadianCostMultiplier(hour);

    items.push({
      time: hour !== null ? hour : 9,
      area: 'Fixed Schedule',
      duration: dur
    });
  }

  // Sort by time of day
  items.sort((a, b) => a.time - b.time);

  // Calculate context-switch entropy only when tasks are close in time (< 60m apart)
  let switchTaxMinutes = 0;
  let switchCount = 0;
  for (let i = 1; i < items.length; i++) {
    const prevItem = items[i - 1];
    const currItem = items[i];
    const prevEndTime = prevItem.time + (prevItem.duration / 60);
    const gapHours = currItem.time - prevEndTime;

    // Only assess switching tax if happening within a tight cognitive window (< 60 min gap)
    if (gapHours >= 0 && gapHours <= 1.0) {
      const tax = getContextSwitchCost(prevItem.area, currItem.area);
      if (tax > 0) {
        switchTaxMinutes += tax;
        switchCount++;
      }
    }
  }

  // Total thermodynamic workload includes switching entropy
  const totalEffectiveMinutes = effectiveMinutes + switchTaxMinutes;
  const rawHours = Number((rawMinutes / 60).toFixed(1));
  const effectiveHours = Number((totalEffectiveMinutes / 60).toFixed(1));

  // Capacity utilization ratio rho
  const capacityMinutes = Math.max(1, dailyTargetHours * 60);
  const utilization = Math.min(2.5, Number((totalEffectiveMinutes / capacityMinutes).toFixed(2)));
  const utilizationPct = Math.round(utilization * 100);

  // Status classification based on Kingman saturation threshold (calibrated)
  let status = 'optimal';
  let message = 'Workload within optimal flow envelope.';

  if (utilization >= 1.25) {
    status = 'burnout';
    message = `Critical saturation (${utilizationPct}%). Cognitive switching entropy threatens execution fidelity.`;
  } else if (utilization >= 1.00) {
    status = 'overload';
    message = `Heavy cognitive load (${utilizationPct}%). Near saturation ceiling. Recommend deferring low-impact tasks.`;
  } else if (utilization >= 0.70) {
    status = 'moderate';
    message = `Balanced active load (${utilizationPct}%). Good flow momentum.`;
  }

  return {
    date,
    rawHours,
    effectiveHours,
    switchCount,
    switchTaxMinutes,
    highEffortCount,
    utilization,
    utilizationPct,
    status,
    message,
    isOverloaded: utilization >= 1.00
  };
}
