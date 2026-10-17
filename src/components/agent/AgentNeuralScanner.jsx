import React from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Zap,
  Target,
  Flame,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Compass,
  Layers
} from 'lucide-react';

const VECTORS = [
  { id: 'v1', label: 'Slipped Schedules', icon: Zap, color: 'text-amber-400', border: 'border-amber-500/30' },
  { id: 'v2', label: 'Somatic/Cognitive Clashes', icon: Brain, color: 'text-rose-400', border: 'border-rose-500/30' },
  { id: 'v3', label: 'Circadian Biological Curves', icon: Compass, color: 'text-violet-400', border: 'border-violet-500/30' },
  { id: 'v4', label: 'Cascade Downstream Collisions', icon: Layers, color: 'text-cyan-400', border: 'border-cyan-500/30' },
  { id: 'v5', label: 'Habit Streak Shields', icon: Flame, color: 'text-orange-400', border: 'border-orange-500/30' },
  { id: 'v6', label: 'Prerequisite Dependency', icon: ShieldCheck, color: 'text-emerald-400', border: 'border-emerald-500/30' },
];

const PHASE_LABELS = {
  CONTEXT_GATHERING: '1/4 Aggregating Workspace State...',
  CIRCADIAN_MODELING: '2/4 Modeling Biological Curves...',
  CASCADE_ANALYSIS: '3/4 Checking Downstream Ripple Collisions...',
  CONFIDENCE_SCORING: '4/4 Deriving 5-Factor Confidence Matrix...',
  COMPLETE: 'Forensic Audit Complete'
};

export default function AgentNeuralScanner({
  isScanning = false,
  scanPhase = 'IDLE',
  onTriggerScan,
  clashesCount = 0,
  slippedCount = 0,
  habitsAtRiskCount = 0
}) {
  const currentPhaseText = PHASE_LABELS[scanPhase] || (isScanning ? 'Auditing 12 Vectors...' : 'Trigger Forensic Audit');

  return (
    <div className="relative overflow-hidden rounded-3xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl">
      {/* Background Holographic Coordinate Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293715_1px,transparent_1px),linear-gradient(to_bottom,#1f293715_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Top Telemetry Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-zinc-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shadow-lg shadow-cyan-500/20">
            <Cpu className="w-5 h-5" />
            <motion.div
              className="absolute inset-0 rounded-2xl border border-cyan-400"
              animate={isScanning ? { scale: [1, 1.25, 1], opacity: [0.8, 0, 0.8] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              Neural Autonomous HUD
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold ${
                isScanning ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                {isScanning ? '12-Vector Deep Sweep' : 'Sentinel Active'}
              </span>
            </div>
            <div className="text-xs text-zinc-400 font-mono">
              Quantum Cognition Engine • Multi-Horizon Monitoring
            </div>
          </div>
        </div>

        <button
          onClick={onTriggerScan}
          disabled={isScanning}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-violet-600/20 transition-all focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-white' : 'text-zinc-200'}`} />
          <span>{currentPhaseText}</span>
        </button>
      </div>

      {/* Center 360° Circular Radar Sweep Visualizer */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Radar Graphic Area */}
        <div className="md:col-span-5 flex items-center justify-center py-4">
          <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-full border border-cyan-500/20 bg-zinc-900/40 flex items-center justify-center shadow-inner">
            {/* Concentric distance rings */}
            <div className="absolute w-40 h-40 rounded-full border border-cyan-500/15" />
            <div className="absolute w-24 h-24 rounded-full border border-cyan-500/25" />
            <div className="absolute w-10 h-10 rounded-full border border-cyan-500/40 bg-cyan-950/40" />

            {/* Radar Crosshairs */}
            <div className="absolute w-full h-[1px] bg-cyan-500/15" />
            <div className="absolute h-full w-[1px] bg-cyan-500/15" />

            {/* 360-Degree Sweeping Laser Blade */}
            <motion.div
              className="absolute inset-0 rounded-full origin-center pointer-events-none"
              animate={{ rotate: 360 }}
              transition={{ duration: isScanning ? 2.5 : 6, repeat: Infinity, ease: 'linear' }}
            >
              <div className="w-1/2 h-1/2 ml-auto origin-bottom-left bg-gradient-to-tr from-cyan-500/30 to-transparent blur-[1px]" />
            </motion.div>

            {/* Center Core Pip */}
            <div className="relative z-10 w-3 h-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/80" />

            {/* Simulated Live Tracked Radar Blips */}
            <motion.div
              className="absolute top-10 right-14 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-md shadow-amber-400/80"
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <motion.div
              className="absolute bottom-12 left-16 w-2.5 h-2.5 rounded-full bg-rose-400 shadow-md shadow-rose-400/80"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 2.1, repeat: Infinity, delay: 0.5 }}
            />
            <motion.div
              className="absolute top-20 left-12 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/80"
              animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: 0.9 }}
            />
          </div>
        </div>

        {/* Real-Time Vector Status Strips */}
        <div className="md:col-span-7 space-y-2.5">
          <div className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Active Reasoning Domains (12 Vectors)
          </div>

          <div className="grid grid-cols-1 gap-2">
            {VECTORS.map((vec, i) => {
              const Icon = vec.icon;
              return (
                <motion.div
                  key={vec.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border ${vec.border} backdrop-blur-md`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg bg-zinc-950/80 ${vec.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">{vec.label}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {i === 0 && `${slippedCount} slipped items audited`}
                        {i === 1 && `${clashesCount} somatic clashes analyzed`}
                        {i === 2 && 'Calibrated to circadian zones'}
                        {i === 3 && 'Downstream ripple detection'}
                        {i === 4 && `${habitsAtRiskCount} habits defended`}
                        {i === 5 && 'Continuous unblock cascade'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Active</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
