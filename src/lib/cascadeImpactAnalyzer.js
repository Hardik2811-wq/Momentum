/**
 * Cascade Impact Analyzer Engine for Momentum OS
 * Detects ripple-effect schedule collisions before mutating timeline items.
 * Prevents "fixing one clash while inadvertently generating three new ones".
 */

function timeToMin(timeStr = '00:00') {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Analyzes downstream cascade impact of shifting or altering a timeline item.
 */
export function analyzeCascadeImpact(proposal, timelineItems = [], allProposals = []) {
  if (!proposal || !proposal.patch || !proposal.patch.startTime) {
    return {
      directCollisions: [],
      chainReactions: [],
      netImpact: { collisionsCreated: 0, collisionsResolved: 1, delta: -1, verdict: 'BENEFICIAL' },
      safeToAutoApply: true
    };
  }

  const targetId = String(proposal.targetId);
  const newStartMin = timeToMin(proposal.patch.startTime);
  const newEndMin = timeToMin(proposal.patch.endTime || proposal.patch.startTime) + 
    (proposal.patch.endTime ? 0 : Number(proposal.patch.durationMinutes || 45));

  const directCollisions = [];
  const chainReactions = [];

  // Filter out target item itself and items with no start times
  const otherItems = timelineItems.filter(item => String(item.id) !== targetId && item.startTime);

  // Check 1: Direct Overlap Collisions
  otherItems.forEach(item => {
    const itemStartMin = timeToMin(item.startTime);
    const itemDuration = Number(item.durationMinutes || item.duration || 45);
    const itemEndMin = item.endTime ? timeToMin(item.endTime) : itemStartMin + itemDuration;

    // Overlap condition: max(start1, start2) < min(end1, end2)
    const overlapStart = Math.max(newStartMin, itemStartMin);
    const overlapEnd = Math.min(newEndMin, itemEndMin);

    if (overlapEnd > overlapStart) {
      const overlapMinutes = overlapEnd - overlapStart;
      const collision = {
        itemId: item.id,
        itemTitle: item.title,
        itemStartTime: item.startTime,
        overlapMinutes,
        severity: overlapMinutes >= 30 ? 'high' : 'medium',
        isTargetOfOtherProposal: allProposals.some(p => String(p.targetId) === String(item.id))
      };
      directCollisions.push(collision);

      // Check 2: Depth 2 Ripple Reaction
      // If collided item itself has tight buffer with next neighbor
      const sortedNeighbors = otherItems
        .filter(n => String(n.id) !== String(item.id) && timeToMin(n.startTime) >= itemEndMin)
        .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));

      if (sortedNeighbors.length > 0) {
        const nextNeighbor = sortedNeighbors[0];
        const nextStart = timeToMin(nextNeighbor.startTime);
        const bufferWithNext = nextStart - itemEndMin;
        if (bufferWithNext < 15) {
          chainReactions.push({
            depth: 2,
            causeItemId: item.id,
            causeTitle: item.title,
            affectedItemId: nextNeighbor.id,
            affectedTitle: nextNeighbor.title,
            bufferMinutes: bufferWithNext,
            warning: `Shifting "${item.title}" compresses margin on downstream "${nextNeighbor.title}".`
          });
        }
      }
    }
  });

  const collisionsCreated = directCollisions.length;
  // A proposal that successfully fixes a slipped task or clash resolves at least 1 collision
  const collisionsResolved = proposal.type === 'RESOLVE_ENERGY_CLASH' || proposal.type === 'RESCHEDULE_SLIPPED_TASK' ? 1 : 0;
  const delta = collisionsCreated - collisionsResolved;

  let verdict = 'BENEFICIAL';
  if (delta > 0 || directCollisions.some(c => c.severity === 'high')) {
    verdict = 'RISKY';
  } else if (delta === 0 && directCollisions.length > 0) {
    verdict = 'NEUTRAL';
  }

  const safeToAutoApply = delta <= 0 && directCollisions.length === 0;

  return {
    directCollisions,
    chainReactions,
    netImpact: {
      collisionsCreated,
      collisionsResolved,
      delta,
      verdict
    },
    safeToAutoApply
  };
}
