import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Bot,
  SlidersHorizontal,
  Compass,
  Layers,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import AgentStoryReel from './AgentStoryReel.jsx';
import AgentReplayPlayer from './AgentReplayPlayer.jsx';
import AgentNeuralScanner from './AgentNeuralScanner.jsx';
import AgentDecisionMatrix from './AgentDecisionMatrix.jsx';
import AgentForensicReport from './AgentForensicReport.jsx';

export default function AgentMissionStudio({
  agentState,
  isScanning,
  scanPhase = 'IDLE',
  onTriggerScan,
  onApplyProposal,
  onDismissProposal,
  onUndoAction,
  onOpenDiffModal,
  onUpdateSettings,
  timelineItems = [],
  harmonizedItems = []
}) {
  const [forensicModalOpen, setForensicModalOpen] = useState(false);
  const isAutopilot = agentState?.mode === 'FULL_AUTOPILOT';
  const pendingCount = (agentState?.pendingProposals || []).length;
  const auditResult = agentState?.latestAuditResult;
  const forensicReport = agentState?.forensicReport;

  const toggleMode = () => {
    const nextMode = isAutopilot ? 'PROACTIVE_APPROVAL' : 'FULL_AUTOPILOT';
    onUpdateSettings?.({ mode: nextMode });
  };

  const handleRunForensic = () => {
    onTriggerScan?.(true); // isDeep = true
    setForensicModalOpen(true);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Control Banner: Autopilot vs Proactive Approval Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              Autonomous Governance
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                isAutopilot
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {isAutopilot ? 'Full Autopilot' : 'Proactive Approval'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {isAutopilot
                ? 'Safe schedule clashes & buffers are harmonized automatically in the background with instant 1-tap Undo.'
                : 'AI surfaces visual timeline diffs and structured benefit pointers for your 1-tap approval.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {forensicReport && (
            <button
              onClick={() => setForensicModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold shadow-sm transition-all"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Forensic Report</span>
            </button>
          )}

          {pendingCount > 0 && (
            <button
              onClick={onOpenDiffModal}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-md transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Review Flow Diff ({pendingCount})</span>
            </button>
          )}

          <button
            onClick={toggleMode}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
            <span>Switch to {isAutopilot ? 'Approval Mode' : 'Autopilot'}</span>
          </button>
        </div>
      </div>

      {/* 1. Cinematic Executive Recap Story Reel */}
      <AgentStoryReel />

      {/* 2. Interactive Time-Lapse Video Player Simulation */}
      <AgentReplayPlayer
        timelineItems={timelineItems}
        harmonizedItems={harmonizedItems}
      />

      {/* 3. Holographic 360° Neural Scanner HUD with Scan Phases */}
      <AgentNeuralScanner
        isScanning={isScanning}
        scanPhase={scanPhase}
        onTriggerScan={handleRunForensic}
        clashesCount={auditResult?.clashesFoundCount || 0}
        slippedCount={auditResult?.slippedTasksCount || 0}
        habitsAtRiskCount={auditResult?.habitsAtRiskCount || 0}
      />

      {/* 4. Decision Transparency Matrix (Did vs Skipped + 1-Tap Undo) */}
      <AgentDecisionMatrix
        agentState={agentState}
        onUndoAction={onUndoAction}
        onApplyProposal={onApplyProposal}
        onDismissProposal={onDismissProposal}
        onOpenDiffModal={onOpenDiffModal}
      />

      {/* Forensic Report Modal */}
      <AgentForensicReport
        isOpen={forensicModalOpen}
        onClose={() => setForensicModalOpen(false)}
        forensicReport={forensicReport}
        proposals={agentState?.pendingProposals || []}
        onApplyProposal={onApplyProposal}
        onApplyAll={() => {
          agentState?.pendingProposals?.forEach(p => onApplyProposal(p.id));
        }}
        onOpenDiffModal={onOpenDiffModal}
      />
    </div>
  );
}
