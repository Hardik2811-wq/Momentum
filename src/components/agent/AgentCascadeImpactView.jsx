import React from 'react';
import { ArrowRight, AlertTriangle, ShieldCheck, CornerDownRight, CheckCircle2 } from 'lucide-react';

export default function AgentCascadeImpactView({ cascadeImpact, targetTitle = 'Target Task' }) {
  if (!cascadeImpact) return null;

  const direct = cascadeImpact.directCollisions || [];
  const chains = cascadeImpact.chainReactions || [];
  const net = cascadeImpact.netImpact || { delta: 0, verdict: 'BENEFICIAL' };

  const isSafe = direct.length === 0 && chains.length === 0;

  return (
    <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
      {/* Header with Net Verdict Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
            <CornerDownRight className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-200">Cascade Ripple Impact</h4>
            <p className="text-[10px] text-zinc-400">Downstream collision forecast across schedule DAG</p>
          </div>
        </div>

        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
          net.verdict === 'BENEFICIAL'
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            : net.verdict === 'RISKY'
            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
        }`}>
          {net.verdict === 'BENEFICIAL' ? 'Net Collision Relief (-1)' : net.verdict}
        </span>
      </div>

      {isSafe ? (
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Zero downstream collisions. Proposed time window maintains clean buffer margins.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Direct collisions */}
          {direct.map((col, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-rose-200 truncate font-medium">Overlaps with "{col.itemTitle}"</span>
              </div>
              <span className="text-[10px] font-mono text-rose-400 shrink-0 font-semibold">
                +{col.overlapMinutes}m collision
              </span>
            </div>
          ))}

          {/* Chain reactions */}
          {chains.map((chain, idx) => (
            <div
              key={`chain_${idx}`}
              className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs flex items-center gap-2 text-amber-200"
            >
              <CornerDownRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{chain.warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
