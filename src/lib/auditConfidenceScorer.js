/**
 * Audit Confidence and Risk Scorer for Momentum OS
 * Derives a deterministic multi-vector confidence coefficient (0.00 - 1.00)
 * and risk taxonomy for every autonomous proposal.
 */

import { scoreTaskPlacement } from './circadianEnergyModel.js';
import { classifySemanticEssence } from './autonomousSemanticOntology.js';

/**
 * Calculates granular confidence and risk matrix for an autonomous proposal.
 */
export function scoreProposalConfidence({
  proposal,
  context = {},
  cascadeResult = null,
  historicalAcceptRates = {},
  circadianOffset = 0
}) {
  const targetTask = proposal.targetEntity === 'task'
    ? (context.tasks || []).find(t => String(t.id) === String(proposal.targetId)) || {}
    : {};

  // Factor 1: Data Completeness (0.0 - 1.0)
  let completeness = 0.5;
  if (targetTask.title && targetTask.title.trim().length > 3) completeness += 0.2;
  if (targetTask.durationMinutes || targetTask.duration) completeness += 0.15;
  if (proposal.patch?.startTime) completeness += 0.15;
  completeness = Math.min(1.0, completeness);

  // Factor 2: Circadian Fit (0.0 - 1.0)
  let circadianFit = 0.8;
  if (proposal.patch?.startTime) {
    const essence = classifySemanticEssence(targetTask);
    const circadian = scoreTaskPlacement(essence.modality, proposal.patch.startTime, circadianOffset);
    circadianFit = circadian.score;
  }

  // Factor 3: Cascade Safety (0.0 - 1.0)
  let cascadeSafety = 1.0;
  if (cascadeResult) {
    if (cascadeResult.directCollisions.length > 0) {
      const maxOverlap = Math.max(...cascadeResult.directCollisions.map(c => c.overlapMinutes || 0));
      cascadeSafety = maxOverlap >= 45 ? 0.2 : maxOverlap >= 20 ? 0.45 : 0.7;
    }
    if (cascadeResult.chainReactions.length > 0) {
      cascadeSafety = Math.max(0.1, cascadeSafety - 0.2 * cascadeResult.chainReactions.length);
    }
  }

  // Factor 4: Historical Acceptance Bias (0.0 - 1.0)
  let historicalSuccess = 0.75; // Neutral prior
  const typeHistory = historicalAcceptRates[proposal.type];
  if (typeHistory && (typeHistory.accepted + typeHistory.dismissed) >= 3) {
    const total = typeHistory.accepted + typeHistory.dismissed;
    historicalSuccess = Number((typeHistory.accepted / total).toFixed(2));
  }

  // Factor 5: Gap Margin Adequacy (0.0 - 1.0)
  let gapAvailability = 0.85;
  if (proposal.gapMinutes !== undefined) {
    const required = proposal.requiredBufferMinutes || 30;
    gapAvailability = proposal.gapMinutes >= required * 1.5
      ? 1.0
      : proposal.gapMinutes >= required
      ? 0.8
      : 0.35;
  }

  // Weighted composite score
  const confidenceScore = Number((
    completeness * 0.15 +
    circadianFit * 0.25 +
    cascadeSafety * 0.35 +
    historicalSuccess * 0.15 +
    gapAvailability * 0.10
  ).toFixed(2));

  // Risk taxonomy derivation
  let riskLevel = 'LOW';
  let probability = 0.1;
  let worstCase = 'Task execution shift may require slight routine readjustment.';
  const mitigations = [
    'One-tap instant undo available in Decision Matrix',
    'Preserves original time attributes in reversible patch'
  ];

  if (cascadeSafety < 0.5 || (cascadeResult && cascadeResult.directCollisions.length > 0)) {
    riskLevel = 'HIGH';
    probability = 0.8;
    const collidedNames = (cascadeResult?.directCollisions || []).map(c => `"${c.itemTitle}"`).join(', ');
    worstCase = `Generates immediate time collision with ${collidedNames || 'neighboring event'}.`;
    mitigations.unshift('Review timeline diff visually before applying');
  } else if (circadianFit < 0.5) {
    riskLevel = 'MEDIUM';
    probability = 0.45;
    worstCase = 'May induce cognitive fatigue due to biological trough placement.';
    mitigations.push('Consider tackling during peak morning window if possible');
  }

  // Recommendation band
  let recommendation = 'APPROVE';
  if (confidenceScore >= 0.85 && riskLevel === 'LOW') {
    recommendation = 'STRONG_APPROVE';
  } else if (riskLevel === 'HIGH' || confidenceScore < 0.5) {
    recommendation = 'REVIEW_CAREFULLY';
  }

  return {
    confidence: confidenceScore,
    confidenceBreakdown: {
      dataCompleteness: completeness,
      circadianFit,
      cascadeSafety,
      historicalSuccess,
      gapAvailability
    },
    risk: {
      level: riskLevel,
      probability,
      worstCase,
      mitigations
    },
    recommendation
  };
}
