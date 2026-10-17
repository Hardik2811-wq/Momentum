/**
 * Autonomous Agent Background Engine for Momentum OS
 * Handles autonomous audit cycle execution, persistent state, proposal queue,
 * Full Autopilot vs Proactive Approval execution, and reversible audit trail.
 */

import { assembleAutonomousContext } from './autonomousContext.js';
import { runCognitiveAutonomousAudit } from './autonomousCognitiveReasoner.js';
import { playChime, sendNotification } from '../store/useStore.js';

const STORAGE_KEY = 'momentum_autonomous_agent_v1';

export const DEFAULT_AGENT_STATE = {
  enabled: true,
  mode: 'PROACTIVE_APPROVAL', // 'PROACTIVE_APPROVAL' | 'FULL_AUTOPILOT'
  auditIntervalMinutes: 5,
  lastRunTimestamp: null,
  pendingProposals: [],
  auditLog: [],
  skippedLog: [],
  latestAuditResult: null,
  forensicReport: null,
  forensicAuditHistory: [],
  soundEffects: true,
  notificationsEnabled: true,
  circadianProfile: 'STANDARD', // 'STANDARD' | 'NIGHT_OWL' | 'EARLY_BIRD'
  circadianOffset: 0,           // 0 for standard, +3 for night owl, -2 for early bird
  deepWorkBudgetMinutes: 240,
  autoApproveThreshold: 0.85,
  historicalAcceptRate: {}      // { [proposalType]: { accepted: number, dismissed: number } }
};

export function getAgentState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AGENT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_AGENT_STATE, ...parsed };
  } catch (err) {
    console.warn('[AutonomousAgentEngine] Failed to read state from storage', err);
    return { ...DEFAULT_AGENT_STATE };
  }
}

export function saveAgentState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('momentum-agent-state-change', { detail: state }));
    }
  } catch (err) {
    console.warn('[AutonomousAgentEngine] Failed to save state to storage', err);
  }
}

/**
 * Executes a forensic autonomous reasoning run over workspace store.
 */
export function executeAutonomousRun(store, options = {}) {
  const currentState = getAgentState();
  if (!currentState.enabled && !options.force) {
    return { skipped: true, reason: 'AGENT_DISABLED' };
  }

  const startTime = Date.now();

  // 1. Gather all-page contextual state
  const context = assembleAutonomousContext(store, {
    settings: {
      ...store.settings,
      deepWorkBudgetMinutes: currentState.deepWorkBudgetMinutes,
      circadianOffset: currentState.circadianOffset
    }
  });

  // 2. Run 12-vector forensic cognitive reasoning
  const auditResult = runCognitiveAutonomousAudit(context, {
    circadianOffset: currentState.circadianOffset,
    historicalAcceptRates: currentState.historicalAcceptRate || {},
    durationMs: Date.now() - startTime
  });

  let updatedAuditLog = [...(currentState.auditLog || [])];
  let updatedPending = [...(currentState.pendingProposals || [])];
  let appliedCount = 0;
  let newProposalsCount = 0;

  // Filter out duplicate proposals that are already pending
  const existingPendingIds = new Set(updatedPending.map(p => `${p.type}_${p.targetId}`));

  auditResult.proposals.forEach(prop => {
    const dedupeKey = `${prop.type}_${prop.targetId}`;
    if (existingPendingIds.has(dedupeKey)) return;

    if (currentState.mode === 'FULL_AUTOPILOT') {
      // Safe non-destructive automations exceeding autoApproveThreshold
      const isEligibleType = prop.type === 'RESCHEDULE_SLIPPED_TASK' || prop.type === 'RESOLVE_ENERGY_CLASH' || prop.type === 'CIRCADIAN_REALIGNMENT';
      const meetsConfidence = (prop.confidence || 0.8) >= (currentState.autoApproveThreshold || 0.85);
      const isLowRisk = prop.risk?.level === 'LOW';

      if (isEligibleType && meetsConfidence && isLowRisk) {
        if (store.updateTask && prop.targetId && prop.patch) {
          store.updateTask(prop.targetId, prop.patch);
          appliedCount++;
          updatedAuditLog.unshift({
            id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            type: prop.type,
            title: prop.title,
            summary: prop.summary,
            severity: prop.severity,
            confidence: prop.confidence,
            risk: prop.risk,
            targetEntity: prop.targetEntity,
            targetId: prop.targetId,
            patch: prop.patch,
            revertPatch: prop.revertPatch,
            pointers: prop.pointers,
            status: 'APPLIED',
            autoApplied: true
          });
          return;
        }
      }
    }

    // Default to proactive approval queue
    updatedPending.push(prop);
    newProposalsCount++;
  });

  updatedAuditLog = updatedAuditLog.slice(0, 50);
  updatedPending = updatedPending.slice(0, 25);

  const nextAuditHistory = [
    auditResult.forensicReport,
    ...(currentState.forensicAuditHistory || [])
  ].filter(Boolean).slice(0, 10);

  const nextState = {
    ...currentState,
    lastRunTimestamp: Date.now(),
    pendingProposals: updatedPending,
    auditLog: updatedAuditLog,
    skippedLog: (auditResult.skippedDecisions || []).slice(0, 20),
    latestAuditResult: auditResult,
    forensicReport: auditResult.forensicReport,
    forensicAuditHistory: nextAuditHistory
  };

  saveAgentState(nextState);

  // Audio / notification feedback
  if (appliedCount > 0 && nextState.soundEffects) {
    playChime('complete');
  }
  if (appliedCount > 0 && nextState.notificationsEnabled) {
    sendNotification('Momentum AI Autopilot', {
      body: `Harmonized ${appliedCount} schedule clashes in background with zero friction.`,
      tag: 'momentum-autopilot'
    });
  } else if (newProposalsCount > 0 && nextState.notificationsEnabled && !options.silent) {
    sendNotification('Momentum AI Copilot', {
      body: `${newProposalsCount} forensic optimization ready for your review.`,
      tag: 'momentum-proposals'
    });
  }

  return {
    auditResult,
    forensicReport: auditResult.forensicReport,
    appliedCount,
    newProposalsCount
  };
}

/**
 * Apply a specific proposal manually from the approval queue.
 */
export function applyProposal(proposalId, store) {
  const state = getAgentState();
  const proposal = state.pendingProposals.find(p => p.id === proposalId);
  if (!proposal) return false;

  // Apply mutation to store
  if (proposal.targetEntity === 'task' && proposal.patch && store.updateTask) {
    store.updateTask(proposal.targetId, proposal.patch);
  }

  // Update machine learning historical acceptance rates
  const currentHistory = state.historicalAcceptRate || {};
  const typeHistory = currentHistory[proposal.type] || { accepted: 0, dismissed: 0 };
  const updatedHistory = {
    ...currentHistory,
    [proposal.type]: {
      ...typeHistory,
      accepted: typeHistory.accepted + 1
    }
  };

  // Record into audit log with undo patch
  const logItem = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    type: proposal.type,
    title: proposal.title,
    summary: proposal.summary,
    severity: proposal.severity,
    confidence: proposal.confidence,
    risk: proposal.risk,
    targetEntity: proposal.targetEntity,
    targetId: proposal.targetId,
    patch: proposal.patch,
    revertPatch: proposal.revertPatch,
    pointers: proposal.pointers,
    status: 'APPLIED',
    autoApplied: false
  };

  const nextState = {
    ...state,
    historicalAcceptRate: updatedHistory,
    pendingProposals: state.pendingProposals.filter(p => p.id !== proposalId),
    auditLog: [logItem, ...(state.auditLog || [])].slice(0, 50)
  };

  saveAgentState(nextState);
  if (state.soundEffects) playChime('complete');
  return true;
}

/**
 * Dismiss a proposal without applying it.
 */
export function dismissProposal(proposalId) {
  const state = getAgentState();
  const proposal = state.pendingProposals.find(p => p.id === proposalId);
  if (!proposal) return false;

  const currentHistory = state.historicalAcceptRate || {};
  const typeHistory = currentHistory[proposal.type] || { accepted: 0, dismissed: 0 };
  const updatedHistory = {
    ...currentHistory,
    [proposal.type]: {
      ...typeHistory,
      dismissed: typeHistory.dismissed + 1
    }
  };

  const nextState = {
    ...state,
    historicalAcceptRate: updatedHistory,
    pendingProposals: state.pendingProposals.filter(p => p.id !== proposalId),
    skippedLog: [
      {
        entityId: proposal.targetId,
        title: proposal.title,
        domain: proposal.targetEntity,
        decision: 'USER_DISMISSED',
        reason: 'Manually dismissed by user during review.',
        timestamp: Date.now()
      },
      ...(state.skippedLog || [])
    ].slice(0, 20)
  };

  saveAgentState(nextState);
  return true;
}

/**
 * Revert an applied action from the audit trail using its stored revertPatch.
 */
export function undoAuditAction(auditId, store) {
  const state = getAgentState();
  const auditItem = state.auditLog.find(a => a.id === auditId);
  if (!auditItem || auditItem.status === 'REVERTED') return false;

  if (auditItem.targetEntity === 'task' && auditItem.revertPatch && store.updateTask) {
    store.updateTask(auditItem.targetId, auditItem.revertPatch);
  }

  const nextState = {
    ...state,
    auditLog: state.auditLog.map(a => a.id === auditId ? { ...a, status: 'REVERTED' } : a)
  };

  saveAgentState(nextState);
  if (state.soundEffects) playChime('timerEnd');
  return true;
}

/**
 * Batch apply all pending proposals.
 */
export function applyAllProposals(store) {
  const state = getAgentState();
  if (!state.pendingProposals || state.pendingProposals.length === 0) return 0;

  let applied = 0;
  const newAuditEntries = [];
  const currentHistory = { ...(state.historicalAcceptRate || {}) };

  state.pendingProposals.forEach(prop => {
    if (prop.targetEntity === 'task' && prop.patch && store.updateTask) {
      store.updateTask(prop.targetId, prop.patch);
      applied++;

      const typeHistory = currentHistory[prop.type] || { accepted: 0, dismissed: 0 };
      currentHistory[prop.type] = { ...typeHistory, accepted: typeHistory.accepted + 1 };

      newAuditEntries.push({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        type: prop.type,
        title: prop.title,
        summary: prop.summary,
        severity: prop.severity,
        confidence: prop.confidence,
        risk: prop.risk,
        targetEntity: prop.targetEntity,
        targetId: prop.targetId,
        patch: prop.patch,
        revertPatch: prop.revertPatch,
        pointers: prop.pointers,
        status: 'APPLIED',
        autoApplied: false
      });
    }
  });

  const nextState = {
    ...state,
    historicalAcceptRate: currentHistory,
    pendingProposals: [],
    auditLog: [...newAuditEntries, ...(state.auditLog || [])].slice(0, 50)
  };

  saveAgentState(nextState);
  if (applied > 0 && state.soundEffects) playChime('complete');
  return applied;
}

/**
 * Batch apply selected proposals by ID list.
 */
export function applyBatchProposals(proposalIds = [], store) {
  const idSet = new Set(proposalIds);
  const state = getAgentState();
  const selected = state.pendingProposals.filter(p => idSet.has(p.id));
  if (selected.length === 0) return 0;

  let applied = 0;
  const newAuditEntries = [];
  const currentHistory = { ...(state.historicalAcceptRate || {}) };

  selected.forEach(prop => {
    if (prop.targetEntity === 'task' && prop.patch && store.updateTask) {
      store.updateTask(prop.targetId, prop.patch);
      applied++;

      const typeHistory = currentHistory[prop.type] || { accepted: 0, dismissed: 0 };
      currentHistory[prop.type] = { ...typeHistory, accepted: typeHistory.accepted + 1 };

      newAuditEntries.push({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        type: prop.type,
        title: prop.title,
        summary: prop.summary,
        severity: prop.severity,
        confidence: prop.confidence,
        risk: prop.risk,
        targetEntity: prop.targetEntity,
        targetId: prop.targetId,
        patch: prop.patch,
        revertPatch: prop.revertPatch,
        pointers: prop.pointers,
        status: 'APPLIED',
        autoApplied: false
      });
    }
  });

  const nextState = {
    ...state,
    historicalAcceptRate: currentHistory,
    pendingProposals: state.pendingProposals.filter(p => !idSet.has(p.id)),
    auditLog: [...newAuditEntries, ...(state.auditLog || [])].slice(0, 50)
  };

  saveAgentState(nextState);
  if (applied > 0 && state.soundEffects) playChime('complete');
  return applied;
}
