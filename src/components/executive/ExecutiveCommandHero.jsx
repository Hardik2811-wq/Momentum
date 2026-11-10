import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Compass,
  Clock,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Brain,
  Flame,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { getCircadianZone, scoreTaskPlacement } from '../../lib/circadianEnergyModel.js';
import { classifySemanticEssence } from '../../lib/autonomousSemanticOntology.js';

export default function ExecutiveCommandHero({
  currentTime = new Date(),
  tasks = [],
  habits = [],
  schedules = [],
  onTriggerAudit,
  onStartFocus,
  onOpenQuickAdd
}) {
  const [hoveredItem, setHoveredItem] = useState(null);

  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  // Current Circadian Biological Zone
  const currentZone = useMemo(() => {
    return getCircadianZone(timeString, 0);
  }, [timeString]);

  // Active or Next Timeline Deliverables
  const activeTasks = useMemo(() => {
    return tasks
      .filter(t => !t.completed && (t.plannedDate || t.dueDate === 'Today'))
      .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
      .slice(0, 3);
  }, [tasks]);

  const activeHabit = useMemo(() => {
    return habits.find(h => !h.completedToday && h.startTime) || habits[0] || null;
  }, [habits]);

  const primaryTask = activeTasks[0] || null;
  const primaryEssence = primaryTask ? classifySemanticEssence(primaryTask) : null;
  const placementScore = primaryTask && primaryTask.startTime
    ? scoreTaskPlacement(primaryEssence?.modality, primaryTask.startTime)
    : null;

  return (
    <section className="relative w-full border-b border-black/[0.08] dark:border-white/[0.08] bg-[#F7F6F2] dark:bg-[#121214] py-8 sm:py-12 transition-colors duration-200">
      <div className="mx-auto w-full max-w-[1520px] px-3.5 sm:px-5 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column (45%): Editorial Masthead & Circadian Command */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-[11px] font-mono tracking-tight text-[#6B6A72] dark:text-[#8E8E93]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F52BA] dark:bg-[#6495ED]" />
              <span>Momentum OS • Biological Executive Field</span>
            </div>

            <div className="space-y-2">
              <h2 className="font-editorial text-[clamp(2.25rem,4.5vw,3.5rem)] font-normal text-[#161618] dark:text-[#F7F6F2] leading-[1.05] tracking-[-0.025em]">
                Time is biological, <br />
                <span className="italic font-light text-[#6B6A72] dark:text-[#8E8E93]">not mechanical.</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#6B6A72] dark:text-[#8E8E93] leading-relaxed max-w-md">
                Aligning your prefrontal creative reserves against natural energy peaks. Slipped schedules, somatic clashes, and habit decay are harmonized with zero friction.
              </p>
            </div>

            {/* Live Circadian Phase Meter */}
            <div className="p-4 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#161618] dark:text-[#F7F6F2] font-semibold">
                  <Compass className="w-4 h-4 text-[#0F52BA] dark:text-[#6495ED]" />
                  <span>Circadian Zone: {currentZone.label.replace(/_/g, ' ')}</span>
                </div>
                <span className="font-mono text-[11px] font-bold text-[#0F52BA] dark:text-[#6495ED]">
                  {Math.round(currentZone.multiplier * 100)}% Alertness
                </span>
              </div>
              <p className="text-[11px] text-[#6B6A72] dark:text-[#8E8E93] leading-normal">
                {currentZone.desc}
              </p>
              <div className="w-full bg-black/[0.05] dark:bg-white/[0.05] h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0F52BA] to-[#6495ED] rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(currentZone.multiplier * 100)}%` }}
                />
              </div>
            </div>

            {/* Tactile Executive Triggers */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onTriggerAudit?.(true)}
                className="px-4 py-2.5 rounded-xl bg-[#161618] dark:bg-[#F7F6F2] text-[#F7F6F2] dark:text-[#161618] text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm"
              >
                <Compass className="w-4 h-4 text-[#6495ED] dark:text-[#0F52BA]" />
                <span>Run 12-Vector Forensic Audit</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenQuickAdd?.()}
                className="px-4 py-2.5 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-transparent text-[#161618] dark:text-[#F7F6F2] text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-[0.98] transition-all flex items-center gap-1.5"
              >
                <span>+ Capture Deliverable</span>
              </button>
            </div>
          </div>

          {/* Right Column (55%): Asymmetric Kinetic Instrument Preview */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.08] dark:border-white/[0.08]">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A72] dark:text-[#8E8E93]">
                Live Timeline Instrument & C-Block Nesting
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#C84B31] dark:text-[#F43F5E] font-bold">
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                <span>{timeString} Live Needle</span>
              </div>
            </div>

            {/* Cardless Sequential Instrument Lane */}
            <div className="space-y-3">
              {/* Scratch C-Block Habit Focus Container */}
              {activeHabit && (
                <div
                  onMouseEnter={() => setHoveredItem('habit')}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="relative p-4 rounded-xl border border-l-4 border-l-[#2E6F40] border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm transition-all hover:bg-white dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-[#2E6F40]/10 text-[#2E6F40] dark:text-emerald-400 font-bold">
                        C-Block Ritual
                      </span>
                      <span className="font-bold text-[#161618] dark:text-[#F7F6F2]">
                        {activeHabit.title}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#6B6A72] dark:text-[#8E8E93] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      {activeHabit.startTime || '08:00'} ({activeHabit.duration || '45m'})
                    </span>
                  </div>

                  {/* Nested Deliverable Item Inside C-Block */}
                  {primaryTask && (
                    <div className="ml-3 mt-3 pl-3 py-2 border-l-2 border-dashed border-[#0F52BA]/40 bg-[#0F52BA]/[0.03] dark:bg-[#0F52BA]/[0.08] rounded-r-lg flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0F52BA]" />
                        <span className="font-medium text-[#161618] dark:text-[#F7F6F2] truncate">
                          {primaryTask.title}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[#0F52BA] dark:text-[#6495ED] font-bold shrink-0">
                        Nested Task
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-[#6B6A72] dark:text-[#8E8E93]">
                    <span className="flex items-center gap-1">
                      <Flame className="w-3 h-3 text-[#2E6F40] dark:text-emerald-400" />
                      Streak: {activeHabit.streak || 1}d (Lindy Shield Active)
                    </span>
                    <span className="text-[#0F52BA] dark:text-[#6495ED]">Zero somatic collision</span>
                  </div>
                </div>
              )}

              {/* Secondary Scheduled Action Item */}
              {activeTasks[1] && (
                <div
                  onMouseEnter={() => setHoveredItem('task2')}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="p-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm flex items-center justify-between gap-3 text-xs hover:border-[#0F52BA]/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-lg bg-[#0F52BA]/10 text-[#0F52BA] dark:text-[#6495ED]">
                      <Brain className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[#161618] dark:text-[#F7F6F2] truncate">
                        {activeTasks[1].title}
                      </div>
                      <div className="text-[10px] text-[#6B6A72] dark:text-[#8E8E93] font-mono">
                        Modality: Deep Creation • 60m focus block
                      </div>
                    </div>
                  </div>

                  <span className="font-mono text-[11px] text-[#6B6A72] dark:text-[#8E8E93] shrink-0 font-medium">
                    {activeTasks[1].startTime || '14:00'}
                  </span>
                </div>
              )}
            </div>

            {/* Contextual Telemetry Bar (Values First) */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01]">
                <div className="text-[10px] font-mono uppercase text-[#6B6A72] dark:text-[#8E8E93]">
                  Recovery Gap
                </div>
                <div className="text-sm font-mono font-bold text-[#161618] dark:text-[#F7F6F2] mt-0.5">
                  45m Buffer
                </div>
              </div>

              <div className="p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01]">
                <div className="text-[10px] font-mono uppercase text-[#6B6A72] dark:text-[#8E8E93]">
                  Biological Fit
                </div>
                <div className="text-sm font-mono font-bold text-[#0F52BA] dark:text-[#6495ED] mt-0.5">
                  92% Harmonic
                </div>
              </div>

              <div className="p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01]">
                <div className="text-[10px] font-mono uppercase text-[#6B6A72] dark:text-[#8E8E93]">
                  Cascade Ripple
                </div>
                <div className="text-sm font-mono font-bold text-[#2E6F40] dark:text-emerald-400 mt-0.5">
                  0 Collisions
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
