/**
 * Capacity Overload Guard
 * Evaluates cognitive workload utilizing thermodynamic entropy cost,
 * circadian resonance curves, and Kingman's queuing saturation model.
 */

import { isTaskScheduledForDate } from './taskMetadata.js';

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
  // Post-prandial circadian dip: 13:30 - 15:30 -> cost multiplier 1.35 (sluggish)
  if (hour >= 13.5 && hour <= 15.5) return 1.35;
  // Late evening fatigue: after 20:30 -> cost multiplier 1.3
  if (hour >= 20.5) return 1.3;
  // Rest of day
  return 1.0;
}

/**
 * Evaluates context-switching entropy between two items
 */
function getContextSwitchCost(areaA, areaB) {
  if (!areaA || !areaB) return 5; // default 5 mins equivalent
  if (areaA === areaB) return 0;
  // High friction switch: Deep Focus <-> Meetings or Health <-> Creative
  return 15; // 15 mins equivalent cognitive tax
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
  if (!date) return { status: 'optimal', utilization: 0, effectiveHours: 0, rawHours: 0 };

  // Filter items on target date
  const dayTasks = (tasks || []).filter(t => !t.completed && isTaskScheduledForDate(t, date));
  const daySchedules = (schedules || []).filter(s => s.plannedDate === date || (s.repeat && s.repeat !== 'never'));

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
    const effortWeight = isHigh ? 1.3 : effort === 'low' ? 0.8 : 1.0;

    rawMinutes += dur;
    effectiveMinutes += dur * circadianMult * effortWeight;

    items.push({
      time: hour !== null ? hour : 12,
      area: (Array.isArray(t.areas) ? t.areas[0] : t.category) || 'General',
      duration: dur
    });
  }

  for (const s of daySchedules) {
    const dur = Number(s.durationMinutes) || 60;
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

  // Calculate context-switch entropy
  let switchTaxMinutes = 0;
  let switchCount = 0;
  for (let i = 1; i < items.length; i++) {
    const tax = getContextSwitchCost(items[i - 1].area, items[i].area);
    if (tax > 0) {
      switchTaxMinutes += tax;
      switchCount++;
    }
  }

  // Total thermodynamic workload includes switching entropy
  const totalEffectiveMinutes = effectiveMinutes + switchTaxMinutes;
  const rawHours = Number((rawMinutes / 60).toFixed(1));
  const effectiveHours = Number((totalEffectiveMinutes / 60).toFixed(1));

  // Capacity utilization ratio rho
  const capacityMinutes = dailyTargetHours * 60;
  const utilization = Math.min(2.0, Number((totalEffectiveMinutes / capacityMinutes).toFixed(2)));
  const utilizationPct = Math.round(utilization * 100);

  // Status classification based on Kingman saturation threshold
  let status = 'optimal';
  let message = 'Workload within optimal flow envelope.';

  if (utilization >= 1.15) {
    status = 'burnout';
    message = `Critical saturation (${utilizationPct}%). Cognitive switching entropy threatens execution fidelity.`;
  } else if (utilization >= 0.85) {
    status = 'overload';
    message = `Heavy cognitive load (${utilizationPct}%). Near saturation ceiling. Recommend deferring low-impact tasks.`;
  } else if (utilization >= 0.65) {
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
    isOverloaded: utilization >= 0.85
  };
}
