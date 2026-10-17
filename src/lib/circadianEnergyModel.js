/**
 * Circadian Energy Curve Model for Momentum OS
 * Maps human biological alertness and executive capacity across 24h cycle.
 * Reference: Monk (2005), Boivin & Czeisler (1998) circadian phase performance models.
 */

import { COGNITIVE_MODALITIES } from './autonomousSemanticOntology.js';

export const CIRCADIAN_ZONES = [
  { start: '06:00', end: '10:00', label: 'PEAK_COGNITIVE', multiplier: 1.0, ideal: [COGNITIVE_MODALITIES.DEEP_CREATION], desc: 'Maximum prefrontal cortex alertness & working memory' },
  { start: '10:00', end: '12:30', label: 'SUSTAIN_CREATIVE', multiplier: 0.85, ideal: [COGNITIVE_MODALITIES.DEEP_CREATION, COGNITIVE_MODALITIES.INTELLECTUAL_ABSORPTION], desc: 'High mental bandwidth, low distractibility' },
  { start: '12:30', end: '13:30', label: 'LUNCH_TRANSITION', multiplier: 0.5, ideal: [COGNITIVE_MODALITIES.DECOMPRESSION_REST, COGNITIVE_MODALITIES.ADMINISTRATIVE_FRICTION], desc: 'Digestive downshift & metabolic diversion' },
  { start: '13:30', end: '15:30', label: 'POST_LUNCH_TROUGH', multiplier: 0.35, ideal: [COGNITIVE_MODALITIES.ADMINISTRATIVE_FRICTION, COGNITIVE_MODALITIES.DECOMPRESSION_REST], desc: 'Biological alertness dip; avoid heavy logic synthesis' },
  { start: '15:30', end: '18:00', label: 'SECOND_WIND', multiplier: 0.75, ideal: [COGNITIVE_MODALITIES.EMOTIONAL_SOCIAL, COGNITIVE_MODALITIES.INTELLECTUAL_ABSORPTION], desc: 'Rebound alertness, strong verbal & collaborative flow' },
  { start: '18:00', end: '20:30', label: 'DECLINING_EXECUTIVE', multiplier: 0.55, ideal: [COGNITIVE_MODALITIES.PHYSICAL_EXHAUSTION, COGNITIVE_MODALITIES.ADMINISTRATIVE_FRICTION], desc: 'Physical motor strength peak, declining willpower reserves' },
  { start: '20:30', end: '23:59', label: 'EVENING_LOW', multiplier: 0.3, ideal: [COGNITIVE_MODALITIES.DECOMPRESSION_REST], desc: 'Melatonin release priming; low cognitive stamina' }
];

function timeToMin(t = '00:00') {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Returns circadian zone for a given time string (HH:mm) adjusted by user offset.
 */
export function getCircadianZone(timeStr = '10:00', hourOffset = 0) {
  const baseMinutes = timeToMin(timeStr);
  const adjustedMinutes = (baseMinutes - hourOffset * 60 + 1440) % 1440;

  for (const zone of CIRCADIAN_ZONES) {
    const s = timeToMin(zone.start);
    const e = timeToMin(zone.end);
    if (adjustedMinutes >= s && adjustedMinutes < e) {
      return zone;
    }
  }
  return CIRCADIAN_ZONES[CIRCADIAN_ZONES.length - 1];
}

/**
 * Evaluates whether task modality aligns with biological energy at designated time.
 */
export function scoreTaskPlacement(taskModality, timeStr, hourOffset = 0) {
  const zone = getCircadianZone(timeStr, hourOffset);
  const isDirectFit = zone.ideal.includes(taskModality);

  if (isDirectFit) {
    return {
      score: zone.multiplier,
      zone: zone.label,
      zoneDesc: zone.desc,
      idealZone: zone.label,
      penalty: null,
      aligned: true
    };
  }

  // Modality mismatch penalties
  if (taskModality === COGNITIVE_MODALITIES.DEEP_CREATION) {
    if (zone.label === 'POST_LUNCH_TROUGH' || zone.label === 'EVENING_LOW') {
      return {
        score: 0.25,
        zone: zone.label,
        zoneDesc: zone.desc,
        idealZone: 'PEAK_COGNITIVE (06:00-10:00)',
        penalty: 'Deep synthesis scheduled in severe biological trough (~40% efficiency drop)',
        aligned: false
      };
    }
    return {
      score: 0.6,
      zone: zone.label,
      zoneDesc: zone.desc,
      idealZone: 'PEAK_COGNITIVE (06:00-10:00)',
      penalty: 'Suboptimal focus window for deep creative tasks',
      aligned: false
    };
  }

  if (taskModality === COGNITIVE_MODALITIES.PHYSICAL_EXHAUSTION && zone.label === 'PEAK_COGNITIVE') {
    return {
      score: 0.5,
      zone: zone.label,
      zoneDesc: zone.desc,
      idealZone: 'DECLINING_EXECUTIVE (18:00-20:30)',
      penalty: 'Heavy somatic exertion consumes peak morning cognitive window',
      aligned: false
    };
  }

  return {
    score: Math.max(0.4, zone.multiplier * 0.8),
    zone: zone.label,
    zoneDesc: zone.desc,
    idealZone: zone.ideal[0] || 'SUSTAIN_CREATIVE',
    penalty: null,
    aligned: true
  };
}

/**
 * Rank available open time gaps by biological fit for a given task modality.
 */
export function rankTimeSlotsByCircadianFit(taskModality, availableSlots = [], hourOffset = 0) {
  return [...availableSlots]
    .map(slot => {
      const evaluation = scoreTaskPlacement(taskModality, slot.startTime, hourOffset);
      return {
        ...slot,
        circadianScore: evaluation.score,
        circadianZone: evaluation.zone,
        circadianPenalty: evaluation.penalty,
        aligned: evaluation.aligned
      };
    })
    .sort((a, b) => b.circadianScore - a.circadianScore);
}
