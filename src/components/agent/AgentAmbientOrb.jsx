import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Activity, Check, ChevronRight, Zap, RefreshCw, Compass } from 'lucide-react';

export default function AgentAmbientOrb({
  agentState,
  isScanning,
  onOpenStudio,
  onOpenDiffModal,
  onTriggerScan
}) {
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const pendingCount = (agentState?.pendingProposals || []).length;
  const recentAppliedCount = (agentState?.auditLog || []).filter(a => a.status === 'APPLIED').length;
  const isAutopilot = agentState?.mode === 'FULL_AUTOPILOT';

  // State color mapping
  const orbColor = isScanning
    ? 'from-cyan-500 to-blue-500 shadow-cyan-500/30'
    : pendingCount > 0
    ? 'from-amber-400 to-orange-500 shadow-amber-500/30'
    : isAutopilot
    ? 'from-emerald-400 to-teal-500 shadow-emerald-500/30'
    : 'from-violet-500 to-indigo-600 shadow-violet-500/30';

  const statusLabel = isScanning
    ? 'Auditing 12 Vectors...'
    : pendingCount > 0
    ? `${pendingCount} Proposal${pendingCount > 1 ? 's' : ''}`
    : isAutopilot
    ? 'Autopilot Active'
    : 'Agent Synchronized';

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={() => setShowQuickMenu(prev => !prev)}
        aria-label="Autonomous AI Agent Status & Mission Control"
        className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-white/10 dark:border-white/10 bg-white/60 dark:bg-zinc-900/70 backdrop-blur-md hover:bg-white/90 dark:hover:bg-zinc-800/90 transition-all duration-200 text-xs font-medium text-zinc-800 dark:text-zinc-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      >
        {/* Living Breathing Orb */}
        <div className="relative flex items-center justify-center w-4 h-4">
          <motion.div
            className={`absolute inset-0 rounded-full bg-gradient-to-tr ${orbColor} blur-[3px] opacity-75`}
            animate={isScanning ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] } : { scale: [1, 1.15, 1], opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: isScanning ? 1 : 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className={`relative w-2.5 h-2.5 rounded-full bg-gradient-to-tr ${orbColor} ring-1 ring-white/30`} />
        </div>

        {/* Text Pill Badge */}
        <span className="hidden sm:inline font-mono tracking-tight text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
          {statusLabel}
        </span>

        {/* Pending Badge Pip */}
        {pendingCount > 0 && (
          <span className="flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-amber-500 rounded-full ring-2 ring-white dark:ring-zinc-900">
            {pendingCount}
          </span>
        )}
      </button>

      {/* Quick Flyout Menu */}
      <AnimatePresence>
        {showQuickMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowQuickMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 w-72 z-50 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Autonomous Copilot
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {isAutopilot ? 'Mode: Full Autopilot' : 'Mode: Proactive Approval'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onTriggerScan?.(true);
                    setShowQuickMenu(false);
                  }}
                  disabled={isScanning}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Run 12-Vector Forensic Audit"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-cyan-500' : ''}`} />
                </button>
              </div>

              {/* Status Metric Strip */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Pending</div>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {pendingCount}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Harmonized</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {recentAppliedCount}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    setShowQuickMenu(false);
                    onTriggerScan?.(true);
                  }}
                  disabled={isScanning}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
                >
                  <span className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5" />
                    Run Forensic Audit (12 Vectors)
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                </button>

                {pendingCount > 0 && (
                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenDiffModal?.();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold shadow-sm transition-all"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Review Flow Diff ({pendingCount})
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowQuickMenu(false);
                    onOpenStudio?.();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-all"
                >
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-zinc-500" />
                    Agent Mission Studio & Logs
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
