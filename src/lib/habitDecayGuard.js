/**
 * Habit Decay Warning Engine
 * Stochastic calculus, Lindy-modulated exponential decay,
 * and Bayesian survival probabilities for habit adherence.
 */

import { calcStreak, todayKey } from '../store/useStore.js';

function parseDaysBetween(dateStrA, dateStrB) {
  if (!dateStrA || !dateStrB) return 0;
  const da = new Date(`${dateStrA}T12:00:00`);
  const db = new Date(`${dateStrB}T12:00:00`);
  const diffMs = db.getTime() - da.getTime();
  return Math.max(0, Math.round(diffMs / 86400000));
}

/**
 * Extracts habit effort level [1, 5] from duration string or metadata
 */
function extractHabitEffort(habit = {}) {
  const durStr = (habit.duration || '').toLowerCase();
  const durMins = parseInt(durStr, 10) || 30;
  if (durMins >= 60) return 5;
  if (durMins >= 40) return 4;
  if (durMins >= 20) return 3;
  return 2;
}

/**
 * Calculates consistency variance (jitter in check-in rhythm)
 */
function calculateCheckInJitter(completedDays = []) {
  if (!completedDays || completedDays.length < 3) return 0.2;
  const sorted = [...completedDays].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (sorted.length < 3) return 0.2;

  const intervals = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(parseDaysBetween(sorted[i - 1], sorted[i]));
  }

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intervals.length;
  return Math.min(1.0, variance);
}

/**
 * Computes deep mathematical decay and survival metrics for a single habit
 */
export function computeHabitDecayMetrics(habit = {}, todayDateStr = '') {
  const today = todayDateStr || todayKey();
  const completedDays = Array.isArray(habit.completedDays) ? habit.completedDays : [];
  const streak = calcStreak(completedDays);
  const isDoneToday = completedDays.includes(today);

  // Find most recent completed date
  const sortedDates = [...completedDays].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const lastActiveDate = sortedDates[sortedDates.length - 1] || null;
  const daysSinceCheckIn = lastActiveDate ? parseDaysBetween(lastActiveDate, today) : 5;

  // Habit Age in days (Lindy denominator)
  const firstActiveDate = sortedDates[0] || lastActiveDate || today;
  const habitAgeDays = Math.max(1, parseDaysBetween(firstActiveDate, today));

  // Dynamic Decay parameter lambda
  // lambda = lambda_0 * (Effort / sqrt(1 + kappa * AgeDays)) * (1 + jitter)
  const baseLambda = 0.25;
  const effort = extractHabitEffort(habit);
  const kappa = 0.08; // Lindy stabilization factor
  const jitter = calculateCheckInJitter(completedDays);

  const lindyDampener = Math.sqrt(1 + kappa * habitAgeDays);
  const lambda = (baseLambda * (effort / 3) / lindyDampener) * (1 + 0.5 * jitter);

  // Baseline strength H_0 based on streak and total check-ins
  const totalCheckIns = completedDays.length;
  const baselineStrength = Math.min(1.0, 0.3 + 0.4 * (1 - Math.exp(-streak / 7)) + 0.3 * (1 - Math.exp(-totalCheckIns / 21)));

  // Current strength H(t) after delta t inactivity
  const deltaT = isDoneToday ? 0 : Math.max(0, daysSinceCheckIn);
  const currentStrength = Math.max(0.05, Number((baselineStrength * Math.exp(-lambda * deltaT)).toFixed(3)));

  // Half-life in days: t_half = ln(2) / lambda
  const halfLifeDays = Number((Math.LN2 / lambda).toFixed(1));

  // Bayesian Weibull Survival Probability S(deltaT + 1) if skipped tomorrow
  // Beta shape parameter: infant habit (< 14 days) has beta < 1, mature habit has beta > 1
  const beta = habitAgeDays < 14 ? 0.8 : 1.25;
  const alpha = 1 / Math.max(0.1, halfLifeDays);
  const survivalProb = Math.max(0.01, Number(Math.exp(-Math.pow(alpha * (deltaT + 1), beta)).toFixed(3)));

  // Phase-space Momentum Velocity dH/dt
  const velocity = deltaT === 0 ? +0.15 : Number((-lambda * currentStrength).toFixed(3));

  // Risk categorization
  let riskLevel = 'stable'; // 'stable' | 'warning' | 'critical'
  let isAtRisk = false;

  if (!isDoneToday) {
    if (deltaT >= 2 || currentStrength < 0.45 || survivalProb < 0.40) {
      riskLevel = 'critical';
      isAtRisk = true;
    } else if (deltaT === 1 || currentStrength < 0.65 || survivalProb < 0.65) {
      riskLevel = 'warning';
      isAtRisk = true;
    }
  }

  // Minimum Viable Recovery (MVR) suggestion
  // What 2-minute micro-rep halts decay?
  const mvrSuggestion = generateMinimumViableRecovery(habit);

  return {
    id: habit.id,
    title: habit.title,
    streak,
    isDoneToday,
    daysSinceCheckIn,
    habitAgeDays,
    lambda: Number(lambda.toFixed(4)),
    halfLifeDays,
    baselineStrength,
    currentStrength,
    survivalProb,
    velocity,
    riskLevel,
    isAtRisk,
    mvrSuggestion
  };
}

/**
 * Formulates the 2-minute Minimum Viable Recovery (MVR) for a habit
 */
function generateMinimumViableRecovery(habit = {}) {
  const t = (habit.title || '').toLowerCase();
  if (/read/i.test(t)) return 'Read just 1 page or 1 paragraph';
  if (/run|cardio|walk|jog/i.test(t)) return 'Put on running shoes and walk 2 minutes';
  if (/workout|gym|fitness|lift/i.test(t)) return 'Do 5 pushups or 30 seconds of stretching';
  if (/guitar|piano|music/i.test(t)) return 'Play 1 single chord or 60 seconds metronome drill';
  if (/deep work|code|program/i.test(t)) return 'Open editor and write 1 line or review 1 commit';
  if (/meditat|mindful/i.test(t)) return 'Take 3 deep conscious breaths';
  if (/journal|write/i.test(t)) return 'Jot down 1 sentence in notes';
  return 'Complete a 2-minute micro-rep to preserve neural momentum';
}

/**
 * Returns all habits at risk of decay, sorted by greatest urgency
 */
export function getHabitsAtRisk(habits = [], todayDateStr = '') {
  if (!Array.isArray(habits) || habits.length === 0) return [];
  const metrics = habits.map(h => computeHabitDecayMetrics(h, todayDateStr));
  return metrics
    .filter(m => m.isAtRisk)
    .sort((a, b) => a.survivalProb - b.survivalProb); // lowest survival first
}
