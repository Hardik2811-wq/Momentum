import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Clock,
  Brain,
  Zap,
  Target,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Check,
  Layers
} from 'lucide-react';
import AgentConfidenceGauge from './AgentConfidenceGauge.jsx';
import AgentCascadeImpactView from './AgentCascadeImpactView.jsx';

export default function AgentFlowDiffModal({
  isOpen,
  onClose,
  auditResult,
  proposals = [],
  onApplyProposal,
  onApplyAll,
  onDismissProposal
}) {
  const [selectedProposalIndex, setSelectedProposalIndex] = useState(0);
  const [viewMode, setViewMode] = useState('side_by_side'); // 'side_by_side' | 'stacked'

  if (!isOpen) return null;

  const currentFlow = auditResult?.currentFlow || [];
  const harmonizedFlow = auditResult?.harmonizedFlow || [];
  const activeProposal = proposals[selectedProposalIndex] || proposals[0];

  const handleApplySingle = (proposalId) => {
    onApplyProposal(proposalId);
    if (proposals.length <= 1) {
      onClose();
    } else {
      setSelectedProposalIndex(prev => Math.max(0, Math.min(prev, proposals.length - 2)));
    }
  };

  const handleDismissSingle = (proposalId) => {
    onDismissProposal(proposalId);
    if (proposals.length <= 1) {
      onClose();
    } else {
      setSelectedProposalIndex(prev => Math.max(0, Math.min(prev, proposals.length - 2)));
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-5xl my-auto rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                  Flow Harmonizer
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    AI Cognitive Reasoning
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Visual timeline diff showing somatic clashes, recovery buffers & streak shields
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs">
                <button
                  onClick={() => setViewMode('side_by_side')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    viewMode === 'side_by_side' ? 'bg-zinc-700 text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setViewMode('stacked')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    viewMode === 'stacked' ? 'bg-zinc-700 text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Sequential
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
                aria-label="Close diff modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Proposal Picker Tabs (if multiple) */}
            {proposals.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {proposals.map((prop, idx) => (
                  <button
                    key={prop.id || idx}
                    onClick={() => setSelectedProposalIndex(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all ${
                      idx === selectedProposalIndex
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20 font-semibold'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>Proposal #{idx + 1}: {prop.type.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Active Proposal Confidence & Overview Card */}
            {activeProposal && (
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <AgentConfidenceGauge
                  confidence={activeProposal.confidence || 0.85}
                  riskLevel={activeProposal.risk?.level || 'LOW'}
                  size={52}
                />

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                    <span className="text-zinc-400 font-mono text-[10px]">#{activeProposal.executionOrder || 1}</span>
                    <span>{activeProposal.title}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">{activeProposal.summary}</div>
                </div>

                {activeProposal.recommendation && (
                  <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border uppercase font-semibold shrink-0 ${
                    activeProposal.recommendation === 'STRONG_APPROVE'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : activeProposal.recommendation === 'REVIEW_CAREFULLY'
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      : 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                  }`}>
                    {activeProposal.recommendation.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}

            {/* Visual Timeline Comparison Container */}
            <div className={`grid gap-4 ${viewMode === 'side_by_side' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {/* CURRENT FLOW (With Clashes & Slippage) */}
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-rose-500/20 flex flex-col">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wider font-mono">
                    <AlertTriangle className="w-4 h-4" />
                    Current Flow (Detected Friction)
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {currentFlow.length} items
                  </span>
                </div>

                <div className="space-y-2.5 flex-1">
                  {currentFlow.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500">
                      No scheduled items on timeline today
                    </div>
                  ) : (
                    currentFlow.slice(0, 5).map((item) => {
                      const isClashed = activeProposal && String(item.id) === String(activeProposal.targetId);
                      return (
                        <div
                          key={`curr_${item.id}`}
                          className={`p-3 rounded-xl border transition-all ${
                            isClashed
                              ? 'bg-rose-950/30 border-rose-500/50 text-rose-100 ring-1 ring-rose-500/30'
                              : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold truncate">{item.title}</span>
                            <span className="font-mono text-[11px] text-zinc-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-zinc-500" />
                              {item.startTime || 'No time'}
                            </span>
                          </div>
                          {isClashed && (
                            <div className="mt-1 text-[11px] font-medium text-rose-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {activeProposal.summary}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* AI SUGGESTED HARMONIZED FLOW */}
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-emerald-500/20 flex flex-col">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider font-mono">
                    <Sparkles className="w-4 h-4" />
                    AI Suggested Flow (Harmonized)
                  </div>
                  <span className="text-[11px] text-emerald-400/80 font-mono">
                    Balanced Rhythm
                  </span>
                </div>

                <div className="space-y-2.5 flex-1">
                  {harmonizedFlow.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500">
                      Timeline already fully harmonized
                    </div>
                  ) : (
                    harmonizedFlow.slice(0, 5).map((item) => {
                      const isShifted = item.isOptimized || (activeProposal && String(item.id) === String(activeProposal.targetId));
                      return (
                        <motion.div
                          key={`harm_${item.id}`}
                          layout
                          className={`p-3 rounded-xl border transition-all ${
                            isShifted
                              ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-100 ring-1 ring-emerald-500/30'
                              : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold truncate">{item.title}</span>
                            <span className="font-mono text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                              <Clock className="w-3 h-3 text-emerald-500" />
                              {item.startTime}
                              {item.oldStartTime && (
                                <span className="text-zinc-500 line-through ml-1 text-[10px]">
                                  {item.oldStartTime}
                                </span>
                              )}
                            </span>
                          </div>
                          {isShifted && (
                            <div className="mt-1 text-[11px] font-medium text-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Restored safe recovery buffer and cognitive queue
                            </div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Cascade Impact Assessment */}
            {activeProposal && activeProposal.cascadeImpact && (
              <AgentCascadeImpactView
                cascadeImpact={activeProposal.cascadeImpact}
                targetTitle={activeProposal.title}
              />
            )}

            {/* 4 PERSPECTIVES BENEFIT ATTRIBUTION (The "Why" Matrix) */}
            {activeProposal && activeProposal.pointers && (
              <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
                  <Layers className="w-4 h-4 text-violet-400" />
                  Multi-Perspective Impact Analysis
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Perspective 1: Cognitive */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-blue-500/20 hover:border-blue-500/40 transition-colors">
                    <div className="flex items-center gap-2 text-blue-400 text-xs font-bold mb-1.5">
                      <Brain className="w-4 h-4" />
                      Cognitive Focus
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {activeProposal.pointers.cognitive}
                    </p>
                  </div>

                  {/* Perspective 2: Biological */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1.5">
                      <Zap className="w-4 h-4" />
                      Biological Rhythm
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {activeProposal.pointers.biological}
                    </p>
                  </div>

                  {/* Perspective 3: Strategic */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1.5">
                      <Target className="w-4 h-4" />
                      Strategic Goals
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {activeProposal.pointers.strategic}
                    </p>
                  </div>

                  {/* Perspective 4: Habits */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                    <div className="flex items-center gap-2 text-purple-400 text-xs font-bold mb-1.5">
                      <Flame className="w-4 h-4" />
                      Habit Streaks
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {activeProposal.pointers.habit}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="font-semibold text-zinc-200">
                {proposals.length} Optimization{proposals.length > 1 ? 's' : ''} Ready
              </span>
              <span>• Full 1-tap undo supported in Audit Log</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {activeProposal && (
                <button
                  onClick={() => handleDismissSingle(activeProposal.id)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  Dismiss Proposal
                </button>
              )}

              {activeProposal && proposals.length > 1 && (
                <button
                  onClick={() => handleApplySingle(activeProposal.id)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700 transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-zinc-300" />
                  Approve This Shift
                </button>
              )}

              <button
                onClick={() => {
                  onApplyAll();
                  onClose();
                }}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Approve All Harmonized Shifts
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
