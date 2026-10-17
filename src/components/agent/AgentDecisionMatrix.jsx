import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  Clock,
  Eye,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Target,
  Brain,
  SlidersHorizontal
} from 'lucide-react';

export default function AgentDecisionMatrix({
  agentState,
  onUndoAction,
  onApplyProposal,
  onDismissProposal,
  onOpenDiffModal
}) {
  const [activeTab, setActiveTab] = useState('applied'); // 'applied' | 'skipped'
  const [domainFilter, setDomainFilter] = useState('ALL');

  const auditLog = agentState?.auditLog || [];
  const pendingProposals = agentState?.pendingProposals || [];
  const skippedLog = agentState?.skippedLog || [];

  const filteredAudit = auditLog.filter(item => {
    if (domainFilter === 'ALL') return true;
    return item.targetEntity?.toUpperCase() === domainFilter;
  });

  const filteredSkipped = skippedLog.filter(item => {
    if (domainFilter === 'ALL') return true;
    return item.domain?.toUpperCase() === domainFilter;
  });

  return (
    <div className="rounded-3xl bg-zinc-950 border border-zinc-800 p-5 sm:p-6 shadow-2xl">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              Decision Transparency Matrix
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                Audit Trail
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Complete visibility into applied changes, pending proposals & deliberately skipped items
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
          <button
            onClick={() => setActiveTab('applied')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'applied'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Applied & Proposals ({auditLog.length + pendingProposals.length})
          </button>
          <button
            onClick={() => setActiveTab('skipped')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'skipped'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Evaluated & Skipped ({skippedLog.length})
          </button>
        </div>
      </div>

      {/* Filter Chips Strip */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 text-xs">
        <span className="text-zinc-500 font-mono text-[11px] flex items-center gap-1">
          <Filter className="w-3 h-3" /> Filter:
        </span>
        {['ALL', 'TASK', 'HABIT', 'GOAL'].map(cat => (
          <button
            key={cat}
            onClick={() => setDomainFilter(cat)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
              domainFilter === cat
                ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="space-y-3">
        {activeTab === 'applied' ? (
          <>
            {/* Pending Proposals Section (if any) */}
            {pendingProposals.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-mono uppercase font-bold text-amber-400 tracking-wider mb-2 flex items-center justify-between">
                  <span>Awaiting Your Approval ({pendingProposals.length})</span>
                  <button
                    onClick={onOpenDiffModal}
                    className="text-violet-400 hover:text-violet-300 lowercase text-[11px] underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    Open Visual Diff Studio
                  </button>
                </div>

                <div className="space-y-2">
                  {pendingProposals.map(prop => (
                    <div
                      key={prop.id}
                      className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-amber-200 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{prop.title}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{prop.summary}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onDismissProposal(prop.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => onApplyProposal(prop.id)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1"
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

            {/* Applied Audit History with 1-Tap Undo */}
            <div className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider mb-2">
              Applied Actions History (With 1-Tap Undo)
            </div>

            {filteredAudit.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 font-mono">
                No autonomous actions recorded yet today.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAudit.map(item => {
                  const isReverted = item.status === 'REVERTED';
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isReverted
                          ? 'bg-zinc-900/30 border-zinc-800/50 opacity-60'
                          : 'bg-zinc-900/70 border-zinc-800 text-zinc-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${isReverted ? 'text-zinc-500' : 'text-emerald-400'}`} />
                          <span className={isReverted ? 'line-through text-zinc-400' : 'text-zinc-100'}>
                            {item.title}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {item.autoApplied ? 'Autopilot' : 'Manual Approval'}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{item.summary}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isReverted ? (
                          <span className="text-[11px] font-mono text-zinc-500">
                            Reverted
                          </span>
                        ) : (
                          <button
                            onClick={() => onUndoAction(item.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-all"
                            title="Revert to original state immediately"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                            <span>Undo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Skipped Decisions Tab */
          <div>
            <div className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider mb-2">
              Deliberate Non-Interventions (Why It Chose Not To Alter)
            </div>

            {filteredSkipped.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 font-mono">
                No skipped decisions recorded in the latest audit.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSkipped.map((skip, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex items-start gap-3"
                  >
                    <div className="p-1.5 rounded-lg bg-zinc-950 text-zinc-400 mt-0.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                        <span>{skip.decision.replace(/_/g, ' ')}</span>
                        {skip.title && <span className="text-zinc-400 font-normal">({skip.title})</span>}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-400 uppercase">
                          {skip.domain}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        {skip.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
