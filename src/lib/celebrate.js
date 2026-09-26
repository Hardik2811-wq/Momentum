import confetti from 'canvas-confetti';

/**
 * Fires a micro-reward confetti particle explosion.
 * Designed for psychological milestone rewards (all tasks complete, habit streak locked).
 */
export function triggerCelebration(opts = {}) {
  try {
    confetti({
      particleCount: opts.count || 70,
      spread: opts.spread || 65,
      origin: opts.origin || { y: 0.7 },
      colors: ['#0A84FF', '#5E5CE6', '#006E28', '#FF9F0A', '#FF375F'],
      disableForReducedMotion: true,
      scalar: 0.9,
      ticks: 180,
    });
  } catch (err) {
    console.warn('Confetti trigger skipped', err);
  }
}
