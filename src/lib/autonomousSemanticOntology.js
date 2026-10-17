/**
 * Autonomous Semantic Ontology Engine for Momentum OS
 * Classifies tasks, goals, and habits by real-world human essence:
 * - Cognitive & somatic modality (Deep Creation, Absorption, Exhaustion, Admin, Social, Decompression)
 * - Energy & biological depletion (Cognitive focus, Somatic stamina, Willpower)
 * - State-priming sequences and energy clashes
 */

export const COGNITIVE_MODALITIES = {
  DEEP_CREATION: 'DEEP_CREATION',           // Coding architecture, writing, design, math proofs
  INTELLECTUAL_ABSORPTION: 'INTELLECTUAL_ABSORPTION', // Lectures, reading documentation, study notes
  PHYSICAL_EXHAUSTION: 'PHYSICAL_EXHAUSTION',       // Heavy gym, running, sports, physical labor
  ADMINISTRATIVE_FRICTION: 'ADMINISTRATIVE_FRICTION', // Taxes, billing, emails, forms, filings
  EMOTIONAL_SOCIAL: 'EMOTIONAL_SOCIAL',             // Presentations, negotiations, 1-on-1s, demos
  DECOMPRESSION_REST: 'DECOMPRESSION_REST'          // Meditation, walks, breathwork, stretching
};

export const DEPLETION_TYPES = {
  COGNITIVE: 'COGNITIVE',
  SOMATIC: 'SOMATIC',
  WILLPOWER: 'WILLPOWER',
  NEUTRAL: 'NEUTRAL'
};

// Heuristic keyword ontology taxonomy
const MODALITY_PATTERNS = [
  {
    modality: COGNITIVE_MODALITIES.PHYSICAL_EXHAUSTION,
    depletion: DEPLETION_TYPES.SOMATIC,
    recoveryMinutes: 45,
    regex: /\b(gym|workout|leg\s*day|chest\s*day|push\s*day|pull\s*day|cardio|running|jog|swim|cycling|crossfit|weightlifting|squat|bench|deadlift|sparring|pilates|hiit)\b/i
  },
  {
    modality: COGNITIVE_MODALITIES.INTELLECTUAL_ABSORPTION,
    depletion: DEPLETION_TYPES.COGNITIVE,
    recoveryMinutes: 15,
    regex: /\b(lecture|watch\s*(?:video|tutorial|course)|read(?:ing)?\s*(?:chapter|paper|book|docs|notes)|listen\s*podcast|study\s*(?:for|notes|theory)|attend\s*class)\b/i
  },
  {
    modality: COGNITIVE_MODALITIES.DEEP_CREATION,
    depletion: DEPLETION_TYPES.COGNITIVE,
    recoveryMinutes: 20,
    regex: /\b(code|coding|build|program|develop|architect|refactor|design\s*(?:ui|ux|system|api|flow)|implement|write\s*(?:code|essay|paper|script|article)|debug|solve|lab|mern\s*lab)\b/i
  },
  {
    modality: COGNITIVE_MODALITIES.ADMINISTRATIVE_FRICTION,
    depletion: DEPLETION_TYPES.WILLPOWER,
    recoveryMinutes: 10,
    regex: /\b(tax(?:es)?|bill(?:s)?|invoice|email(?:s)?|filing|fill\s*form|bureaucracy|renew\s*(?:passport|license)|clean\s*inbox|schedule\s*appointment)\b/i
  },
  {
    modality: COGNITIVE_MODALITIES.EMOTIONAL_SOCIAL,
    depletion: DEPLETION_TYPES.WILLPOWER,
    recoveryMinutes: 20,
    regex: /\b(pitch|presentation|interview|meeting\s*with|client\s*call|negotiat(?:e|ion)|demo\s*to|sync\s*with|1-on-1|standup)\b/i
  },
  {
    modality: COGNITIVE_MODALITIES.DECOMPRESSION_REST,
    depletion: DEPLETION_TYPES.NEUTRAL,
    recoveryMinutes: 0,
    regex: /\b(meditat(?:e|ion)|walk|breathe|breathwork|journal(?:ing)?|nap|stretch(?:ing)?|yoga|unwind|reflect(?:ion)?)\b/i
  }
];

/**
 * Classifies an item into its semantic human ontology.
 */
export function classifySemanticEssence(item = {}) {
  const title = (typeof item === 'string' ? item : (item.title || item.name || '')).trim();
  const lower = title.toLowerCase();

  let matched = null;
  for (const pattern of MODALITY_PATTERNS) {
    if (pattern.regex.test(lower)) {
      matched = pattern;
      break;
    }
  }

  // Fallbacks based on energy / areas
  let modality = matched?.modality || COGNITIVE_MODALITIES.DEEP_CREATION;
  let depletion = matched?.depletion || DEPLETION_TYPES.COGNITIVE;
  let recoveryBuffer = matched?.recoveryMinutes || 15;

  if (!matched) {
    if (item.energy === 'Low' || item.impact === 'low') {
      modality = COGNITIVE_MODALITIES.ADMINISTRATIVE_FRICTION;
      depletion = DEPLETION_TYPES.WILLPOWER;
      recoveryBuffer = 10;
    } else if (item.areas?.includes('Health & Vitality')) {
      modality = COGNITIVE_MODALITIES.PHYSICAL_EXHAUSTION;
      depletion = DEPLETION_TYPES.SOMATIC;
      recoveryBuffer = 30;
    } else {
      modality = COGNITIVE_MODALITIES.DEEP_CREATION;
      depletion = DEPLETION_TYPES.COGNITIVE;
      recoveryBuffer = 20;
    }
  }

  return {
    modality,
    depletion,
    depletionType: depletion,
    recoveryBufferMinutes: recoveryBuffer,
    requiresPostBufferMinutes: recoveryBuffer,
    isSomatic: depletion === DEPLETION_TYPES.SOMATIC,
    isHighCognitive: modality === COGNITIVE_MODALITIES.DEEP_CREATION,
    isAbsorption: modality === COGNITIVE_MODALITIES.INTELLECTUAL_ABSORPTION,
    isAdminFriction: modality === COGNITIVE_MODALITIES.ADMINISTRATIVE_FRICTION,
    isDecompression: modality === COGNITIVE_MODALITIES.DECOMPRESSION_REST
  };
}

/**
 * Detects real-world human energy clashes between sequential tasks in a day.
 */
export function detectHumanEnergyClashes(timelineItems = []) {
  const clashes = [];
  const sorted = [...timelineItems]
    .filter(i => i.startTime)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const currentEssence = classifySemanticEssence(current);
    const nextEssence = classifySemanticEssence(next);

    const [currH, currM] = current.startTime.split(':').map(Number);
    const currentDuration = Number(current.durationMinutes || current.duration || 45);
    const currentEndMin = currH * 60 + currM + currentDuration;

    const [nextH, nextM] = next.startTime.split(':').map(Number);
    const nextStartMin = nextH * 60 + nextM;
    const gapMinutes = nextStartMin - currentEndMin;

    // Clash 1: Somatic Exhaustion immediately followed by Deep Creation with inadequate buffer
    if (
      currentEssence.isSomatic &&
      nextEssence.isHighCognitive &&
      gapMinutes < currentEssence.recoveryBufferMinutes
    ) {
      clashes.push({
        id: `clash_somatic_${current.id}_${next.id}`,
        type: 'SOMATIC_COGNITIVE_CLASH',
        severity: 'high',
        itemA: current,
        itemB: next,
        gapMinutes,
        requiredBufferMinutes: currentEssence.recoveryBufferMinutes,
        message: `High physical strain from "${current.title}" directly precedes intense mental focus on "${next.title}" without adequate somatic recovery (${gapMinutes}m vs ${currentEssence.recoveryBufferMinutes}m required). Brain fog & fatigue trap.`
      });
    }

    // Clash 2: Inverted Sequencing (Practical Deep Creation before Theoretical Absorption)
    if (
      currentEssence.isHighCognitive &&
      nextEssence.isAbsorption &&
      current.goalId &&
      current.goalId === next.goalId
    ) {
      clashes.push({
        id: `clash_sequence_${current.id}_${next.id}`,
        type: 'INVERTED_PRIMING_CLASH',
        severity: 'medium',
        itemA: current,
        itemB: next,
        message: `Practical synthesis "${current.title}" is scheduled prior to theoretical foundation "${next.title}". Absorbing lecture/notes first primes frictionless execution.`
      });
    }

    // Clash 3: Circadian Slump Misplacement (Deep Creation during 13:30 - 15:30 post-lunch dip)
    if (nextEssence.isHighCognitive && nextH >= 13 && (nextH < 15 || (nextH === 15 && nextM <= 30))) {
      clashes.push({
        id: `clash_circadian_${next.id}`,
        type: 'CIRCADIAN_SLUMP_CLASH',
        severity: 'medium',
        item: next,
        message: `High-cognitive demand task "${next.title}" is positioned directly inside the biological post-lunch circadian dip (13:30–15:30). Moving to morning peak creates ~2x flow velocity.`
      });
    }
  }

  return clashes;
}
