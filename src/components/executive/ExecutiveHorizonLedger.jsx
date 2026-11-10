import React, { useMemo } from 'react';
import {
  Brain,
  Clock,
  Compass,
  ArrowRight,
  Flame,
  ShieldCheck,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  GitBranch
} from 'lucide-react';
import { evaluateCognitiveLoadBudget } from '../../lib/cognitiveLoadBudget.js';

export default function ExecutiveHorizonLedger({
  tasks = [],
  goals = [],
  habits = [],
  schedules = []
}) {
  // Prefrontal Cognitive Load Budget
  const budget = useMemo(() => {
    return evaluateCognitiveLoadBudget(tasks);
  }, [tasks]);

  // Blocked and unblocked prerequisite pairs
  const dependencyPairs = useMemo(() => {
    const pairs = [];
    tasks.forEach(t => {
      if (t.dependsOn && Array.isArray(t.dependsOn) && t.dependsOn.length > 0) {
        t.dependsOn.forEach(blockerId => {
          const blocker = tasks.find(b => String(b.id) === String(blockerId));
          if (blocker) {
            pairs.push({
              blockerTitle: blocker.title,
              blockerDone: Boolean(blocker.completed),
              targetTitle: t.title,
              targetDone: Boolean(t.completed)
            });
          }
        });
      }
    });
    return pairs.slice(0, 4);
  }, [tasks]);

  // Goal burndown points for SVG sparkline
  const goalVelocityStats = useMemo(() => {
    const total = goals.length || 1;
    const completed = goals.filter(g => g.progress === 100).length;
    const active = goals.filter(g => (g.progress || 0) < 100);
    const avgProgress = Math.round(
      goals.reduce((acc, g) => acc + (g.progress || 0), 0) / total
    );
    return { total, completed, activeCount: active.length, avgProgress };
  }, [goals]);

  // Approaching 72h deadlines
  const upcomingDeadlines = useMemo(() => {
    const now = Date.now();
    const threeDays = now + 3 * 86400000;
    return tasks.filter(t => {
      if (t.completed || !t.dueDate || t.dueDate === 'Today') return false;
      const d = new Date(t.dueDate).getTime();
      return !isNaN(d) && d <= threeDays && d >= now;
    }).slice(0, 3);
  }, [tasks]);

  return (
    <section className="w-full border-b border-black/[0.08] dark:border-white/[0.08] bg-[#F7F6F2] dark:bg-[#121214] py-8 sm:py-12 transition-colors duration-200">
      <div className="mx-auto w-full max-w-[1520px] px-3.5 sm:px-5 lg:px-8 space-y-6">
        
        {/* Masthead Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-black/[0.08] dark:border-white/[0.08]">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A72] dark:text-[#8E8E93]">
              Executive Ledger & Cognitive Horizons
            </div>
            <h3 className="font-editorial text-2xl sm:text-3xl font-medium text-[#161618] dark:text-[#F7F6F2] tracking-[-0.02em] mt-1">
              Biological Capacity & Strategic Critical Path
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#6B6A72] dark:text-[#8E8E93]">
            <span className="w-2 h-2 rounded-full bg-[#0F52BA] dark:bg-[#6495ED]" />
            <span>Cardless Hairline Segmentation</span>
          </div>
        </div>

        {/* 3-Column Columnar Ledger with Hairline Separation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-black/[0.08] dark:divide-white/[0.08]">
          
          {/* Segment A: Prefrontal Cognitive Load Budget */}
          <div className="py-6 lg:py-0 lg:pr-8 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#161618] dark:text-[#F7F6F2]">
                <Brain className="w-4 h-4 text-[#0F52BA] dark:text-[#6495ED]" />
                <span>Prefrontal Cognitive Budget</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.05] text-[#6B6A72] dark:text-[#8E8E93]">
                Cal Newport Model
              </span>
            </div>

            {/* Values-First Telemetry Row */}
            <div className="space-y-3">
              <div>
                <div className="text-3xl sm:text-4xl font-mono font-bold text-[#161618] dark:text-[#F7F6F2] tracking-tight">
                  {budget.deepWork.spent}m{' '}
                  <span className="text-sm font-normal text-[#6B6A72] dark:text-[#8E8E93]">
                    / {budget.deepWork.budget}m max
                  </span>
                </div>
                <div className="text-xs text-[#6B6A72] dark:text-[#8E8E93] mt-1">
                  High-Intensity Logic & Architecture Ceiling
                </div>
                <div className="w-full bg-black/[0.06] dark:bg-white/[0.06] h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      budget.deepWork.percentUsed > 85 ? 'bg-[#C84B31]' : 'bg-[#0F52BA]'
                    }`}
                    style={{ width: `${budget.deepWork.percentUsed}%` }}
                  />
                </div>
              </div>

              {/* Willpower & Crash Point Breakdown */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
                <div className="p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01]">
                  <div className="text-[10px] uppercase text-[#6B6A72] dark:text-[#8E8E93]">Admin Drain</div>
                  <div className="font-bold text-[#161618] dark:text-[#F7F6F2] mt-0.5">
                    {budget.admin.spent}m / {budget.admin.budget}m
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01]">
                  <div className="text-[10px] uppercase text-[#6B6A72] dark:text-[#8E8E93]">Fatigue Horizon</div>
                  <div className="font-bold text-[#C84B31] dark:text-[#F43F5E] mt-0.5">
                    {budget.fatigueForecast.estimatedCrashTime || '18:30'}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#6B6A72] dark:text-[#8E8E93] leading-relaxed pt-1">
                {budget.fatigueForecast.warningMessage}
              </p>
            </div>
          </div>

          {/* Segment B: Multi-Horizon Burndown & Goal Velocity */}
          <div className="py-6 lg:py-0 lg:px-8 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#161618] dark:text-[#F7F6F2]">
                <Target className="w-4 h-4 text-[#0F52BA] dark:text-[#6495ED]" />
                <span>Macro Horizon Burndown</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0F52BA]/10 text-[#0F52BA] dark:text-[#6495ED] font-bold">
                {goalVelocityStats.avgProgress}% Pace
              </span>
            </div>

            {/* Goal Trajectory Sparkline Preview */}
            <div className="space-y-3">
              <div className="h-28 w-full p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white/40 dark:bg-zinc-900/40 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#6B6A72] dark:text-[#8E8E93]">
                  <span>Pacing Trajectory</span>
                  <span>{goalVelocityStats.activeCount} Active Strategic Horizons</span>
                </div>

                {/* Minimalist Monochrome Coordinate Graph */}
                <svg className="w-full h-14 overflow-visible" viewBox="0 0 240 50">
                  <line x1="0" y1="45" x2="240" y2="45" stroke="currentColor" className="text-black/10 dark:text-white/10" strokeDasharray="3 3" />
                  <line x1="0" y1="10" x2="240" y2="10" stroke="currentColor" className="text-black/10 dark:text-white/10" strokeDasharray="3 3" />
                  <path
                    d="M 10 42 Q 70 38 120 25 T 230 12"
                    fill="none"
                    stroke="#0F52BA"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="230" cy="12" r="3.5" fill="#0F52BA" />
                </svg>

                <div className="flex items-center justify-between text-[10px] font-mono text-[#6B6A72] dark:text-[#8E8E93]">
                  <span>W1 Launch</span>
                  <span className="text-[#0F52BA] dark:text-[#6495ED] font-semibold">W4 Target Horizon</span>
                </div>
              </div>

              {/* 72h Approaching Deadlines Ticker */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#6B6A72] dark:text-[#8E8E93]">
                  72-Hour Horizon Pressure
                </div>
                {upcomingDeadlines.length === 0 ? (
                  <div className="text-xs text-[#6B6A72] dark:text-[#8E8E93] py-1 font-mono">
                    Zero critical deadlines approaching in next 72 hours.
                  </div>
                ) : (
                  upcomingDeadlines.map(t => (
                    <div
                      key={t.id}
                      className="p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-[#161618] dark:text-[#F7F6F2] truncate">
                        {t.title}
                      </span>
                      <span className="font-mono text-[10px] text-[#C84B31] dark:text-[#F43F5E] font-semibold shrink-0 ml-2">
                        Due {t.dueDate}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Segment C: Prerequisite Causal DAG & Habit Lindy Survival */}
          <div className="py-6 lg:py-0 lg:pl-8 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#161618] dark:text-[#F7F6F2]">
                <GitBranch className="w-4 h-4 text-[#2E6F40] dark:text-emerald-400" />
                <span>Prerequisite Causal DAG</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:text-emerald-400 font-bold">
                Domino Flow
              </span>
            </div>

            <div className="space-y-2.5">
              {dependencyPairs.length === 0 ? (
                <div className="p-4 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01] text-xs text-[#6B6A72] dark:text-[#8E8E93] leading-relaxed">
                  No explicit prerequisite task dependencies configured. Tasks execute freely without blocker gates.
                </div>
              ) : (
                dependencyPairs.map((pair, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white/50 dark:bg-zinc-900/40 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${pair.blockerDone ? 'bg-[#2E6F40]' : 'bg-[#C84B31]'}`} />
                      <span className={`truncate ${pair.blockerDone ? 'line-through text-[#6B6A72] dark:text-[#8E8E93]' : 'font-medium text-[#161618] dark:text-[#F7F6F2]'}`}>
                        {pair.blockerTitle}
                      </span>
                    </div>

                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />

                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${pair.targetDone ? 'bg-[#2E6F40]' : 'bg-[#0F52BA]'}`} />
                      <span className="font-semibold text-[#161618] dark:text-[#F7F6F2] truncate">
                        {pair.targetTitle}
                      </span>
                    </div>
                  </div>
                ))
              )}

              {/* Habit Lindy Survival Probabilities */}
              <div className="pt-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#6B6A72] dark:text-[#8E8E93] mb-2">
                  Lindy Habit Survival Shielding
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {habits.slice(0, 2).map(h => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01]"
                    >
                      <div className="font-semibold text-[#161618] dark:text-[#F7F6F2] truncate">
                        {h.title}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#2E6F40] dark:text-emerald-400 mt-1">
                        <span>Streak: {h.streak || 1}d</span>
                        <span className="font-bold">{(Math.min(99, 50 + (h.streak || 1) * 3))}% Lindy</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
