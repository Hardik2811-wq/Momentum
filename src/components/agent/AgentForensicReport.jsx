import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Brain,
  Clock,
  Layers,
  CheckCircle2,
  Check,
  ChevronRight,
  Zap,
  Activity,
  Calendar,
  Compass
} from 'lucide-react';
import AgentConfidenceGauge from './AgentConfidenceGauge.jsx';

export default function AgentForensicReport({
  isOpen,
  onClose,
  forensicReport,
  proposals = [],
  onApplyProposal,
  onApplyAll,
  onOpenDiffModal
}) {
  if (!isOpen || !forensicReport) return null;

  const vectorDetails = forensicReport.vectorAuditDetails || [];
  const cognitive = forensicReport.cognitiveLoadSnapshot || {};
  const healthPercent = Math.round((forensicReport.healthScore || 0.8) * 100);

  const highConfidenceProposals = proposals.filter(p => (p.confidence || 0.8) >= 0.85 && p.risk?.level === 'LOW');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl my-auto rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                  Forensic Cognitive Audit Report
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold">
                    12 Vectors Analyzed
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Forensic evaluation of cognitive load, circadian zones, habit decay & cascade collisions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-zinc-200">
                  {healthPercent}% Harmony
                </span>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
                aria-label="Close forensic report"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Executive Narrative Banner */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-violet-500/30 text-zinc-200 text-xs sm:text-sm leading-relaxed flex items-start gap-3">
              <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 shrink-0 mt-0.5">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-zinc-100 block mb-0.5">Forensic Executive Diagnosis:</span>
                <p className="text-zinc-300">{forensicReport.narrative}</p>
              </div>
            </div>

            {/* Cognitive Capacity & Fatigue Horizon */}
            {cognitive && cognitive.deepWork && (
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Prefrontal Cognitive Budget Consumption</span>
                  </div>
                  {cognitive.fatigueForecast?.estimatedCrashTime && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      Fatigue Ceiling: {cognitive.fatigueForecast.estimatedCrashTime}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                    <div className="text-[10px] text-zinc-400 font-mono uppercase">Deep Work</div>
                    <div className="text-sm font-bold text-zinc-100 mt-1">
                      {cognitive.deepWork.spent}m / {cognitive.deepWork.budget}m
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cognitive.deepWork.percentUsed > 90 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                        style={{ width: `${cognitive.deepWork.percentUsed}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                    <div className="text-[10px] text-zinc-400 font-mono uppercase">Social / Meetings</div>
                    <div className="text-sm font-bold text-zinc-100 mt-1">
                      {cognitive.meetings.spent}m / {cognitive.meetings.budget}m
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${cognitive.meetings.percentUsed}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                    <div className="text-[10px] text-zinc-400 font-mono uppercase">Admin Willpower</div>
                    <div className="text-sm font-bold text-zinc-100 mt-1">
                      {cognitive.admin.spent}m / {cognitive.admin.budget}m
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${cognitive.admin.percentUsed}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                    <div className="text-[10px] text-zinc-400 font-mono uppercase">Gross Capacity</div>
                    <div className="text-sm font-bold text-zinc-100 mt-1">
                      {cognitive.total.spent}m / {cognitive.total.budget}m
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${cognitive.total.percentUsed}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 12 Diagnostic Vector Audit Strips */}
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider">
                12 Diagnostic Vector Findings
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {vectorDetails.map((v, idx) => {
                  const isClean = v.status === 'CLEAN';
                  const isWarning = v.status === 'WARNING' || v.status === 'ATTENTION_NEEDED';
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        isClean
                          ? 'bg-zinc-900/30 border-zinc-800/60 text-zinc-300'
                          : isWarning
                          ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                          : 'bg-violet-950/20 border-violet-500/30 text-violet-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold flex items-center gap-1.5">
                          {isClean ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : isWarning ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                          )}
                          <span className="truncate">{v.name}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate mt-0.5">{v.detail}</div>
                      </div>

                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 font-medium ${
                        isClean
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : isWarning
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                      }`}>
                        {v.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Execution Plan Proposals with Confidence Gauges */}
            {proposals.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono uppercase font-bold text-zinc-300 tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-violet-400" />
                    <span>Prioritized Execution Plan ({proposals.length})</span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenDiffModal();
                    }}
                    className="text-xs text-violet-400 hover:text-violet-300 underline font-medium"
                  >
                    Open Flow Diff Studio
                  </button>
                </div>

                <div className="space-y-2">
                  {proposals.map(prop => (
                    <div
                      key={prop.id}
                      className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <AgentConfidenceGauge
                          confidence={prop.confidence || 0.85}
                          riskLevel={prop.risk?.level || 'LOW'}
                          size={46}
                        />

                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                            <span className="text-zinc-500 font-mono text-[10px]">#{prop.executionOrder}</span>
                            <span className="truncate">{prop.title}</span>
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5 truncate">{prop.summary}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => onApplyProposal(prop.id)}
                          className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl">
            <span className="text-xs text-zinc-400">
              Audit results backed by forensic multi-horizon analysis and 1-tap undo.
            </span>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {highConfidenceProposals.length > 0 && highConfidenceProposals.length < proposals.length && (
                <button
                  onClick={() => {
                    highConfidenceProposals.forEach(p => onApplyProposal(p.id));
                    onClose();
                  }}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all"
                >
                  Approve Safe Only ({highConfidenceProposals.length})
                </button>
              )}

              {proposals.length > 0 && (
                <button
                  onClick={() => {
                    onApplyAll();
                    onClose();
                  }}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Approve All Proposals ({proposals.length})
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
