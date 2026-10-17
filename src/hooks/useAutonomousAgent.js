import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getAgentState,
  saveAgentState,
  executeAutonomousRun,
  applyProposal as engineApplyProposal,
  dismissProposal as engineDismissProposal,
  undoAuditAction as engineUndoAuditAction,
  applyAllProposals as engineApplyAllProposals,
  applyBatchProposals as engineApplyBatchProposals
} from '../lib/autonomousAgentEngine.js';

/**
 * React Hook for Autonomous Background AI Agent.
 * Powers the ambient orb, neural scanner HUD, flow diff comparisons, and decision matrix.
 */
export function useAutonomousAgent(store) {
  const [agentState, setAgentState] = useState(getAgentState);
  const [isScanning, setIsScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState('IDLE');
  const [activeDiffModal, setActiveDiffModal] = useState(false);
  const [activeForensicModal, setActiveForensicModal] = useState(false);
  const timerRef = useRef(null);

  // Sync state across tabs and custom events
  useEffect(() => {
    const handleStateChange = (e) => {
      if (e.detail) {
        setAgentState(e.detail);
      } else {
        setAgentState(getAgentState());
      }
    };

    window.addEventListener('momentum-agent-state-change', handleStateChange);
    window.addEventListener('storage', handleStateChange);

    return () => {
      window.removeEventListener('momentum-agent-state-change', handleStateChange);
      window.removeEventListener('storage', handleStateChange);
    };
  }, []);

  // Autonomous background heartbeat loop
  useEffect(() => {
    if (!agentState.enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = Math.max(1, agentState.auditIntervalMinutes || 5) * 60 * 1000;

    const now = Date.now();
    if (!agentState.lastRunTimestamp || (now - agentState.lastRunTimestamp) > intervalMs) {
      const initialTimeout = setTimeout(() => {
        executeAutonomousRun(store, { silent: true });
      }, 2000);
      return () => clearTimeout(initialTimeout);
    }

    timerRef.current = setInterval(() => {
      executeAutonomousRun(store, { silent: true });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [agentState.enabled, agentState.auditIntervalMinutes, agentState.lastRunTimestamp, store]);

  // Trigger manual neural scan with animated phased feedback
  const triggerAudit = useCallback((isDeep = false) => {
    setIsScanning(true);
    setScanPhase('CONTEXT_GATHERING');

    setTimeout(() => {
      setScanPhase('CIRCADIAN_MODELING');
    }, 250);

    setTimeout(() => {
      setScanPhase('CASCADE_ANALYSIS');
    }, 550);

    setTimeout(() => {
      setScanPhase('CONFIDENCE_SCORING');
    }, 850);

    setTimeout(() => {
      const result = executeAutonomousRun(store, { force: true });
      setScanPhase('COMPLETE');
      setIsScanning(false);

      if (isDeep) {
        setActiveForensicModal(true);
      } else if (result?.newProposalsCount > 0) {
        setActiveDiffModal(true);
      }

      setTimeout(() => setScanPhase('IDLE'), 1500);
    }, 1200);
  }, [store]);

  const applyProposal = useCallback((id) => {
    return engineApplyProposal(id, store);
  }, [store]);

  const dismissProposal = useCallback((id) => {
    return engineDismissProposal(id);
  }, []);

  const undoAction = useCallback((id) => {
    return engineUndoAuditAction(id, store);
  }, [store]);

  const applyAll = useCallback(() => {
    return engineApplyAllProposals(store);
  }, [store]);

  const applyBatch = useCallback((ids) => {
    return engineApplyBatchProposals(ids, store);
  }, [store]);

  const updateAgentSettings = useCallback((patch) => {
    const next = { ...agentState, ...patch };
    saveAgentState(next);
    setAgentState(next);
  }, [agentState]);

  return {
    agentState,
    isScanning,
    scanPhase,
    activeDiffModal,
    setActiveDiffModal,
    activeForensicModal,
    setActiveForensicModal,
    triggerAudit,
    applyProposal,
    dismissProposal,
    undoAction,
    applyAll,
    applyBatch,
    updateAgentSettings
  };
}
