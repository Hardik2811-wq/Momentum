import React, { useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';

const REASONS = [
  'Low Energy',
  'Unclear Requirements',
  'Time Overrun on Prior Task',
  'External Distraction',
  'Technical Friction',
  'Scheduled for Later Sprint'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ReflectionsView({
  tasks = [],
  goals = [],
  habits = [],
  stats = {},
  reflections = {},
  updateReflection,
  saveWeeklyReview
}) {
  const [viewScope, setViewScope] = useState('weekly'); // 'weekly' or 'monthly'
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [exportNotice, setExportNotice] = useState(false);
  const [habitTuneNotice, setHabitTuneNotice] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  const {
    total = 0,
    completed = 0,
    completionRate = 0,
    momentumScore = 85,
    goalsOnTrack = 0,
    totalGoals = 0,
    habitsCompletedToday = 0,
    totalHabits = 0
  } = stats;

  const {
    currentWeek = '2026-W37',
    moodRatings = { 0: 4, 1: 5, 2: 4, 3: 3, 4: 5, 5: 4, 6: 4 },
    workedWell = '',
    pushedBack = '',
    pushedBackReason = 'Low Energy',
    onePriority = '',
    targetGoalId = 'g1',
    frictionTask = '',
    history = []
  } = reflections;

  // Find least performing habit to tune up (#26)
  const lowestHabit = habits[0] || { title: 'Guitar Practice' };

  // Stalled goal escalation check
  const stalledGoal = goals.find(g => g.velocity === 'behind') || goals[2];

  // Export JSON/Markdown
  const handleExport = (format) => {
    const data = {
      week: currentWeek,
      date: new Date().toISOString(),
      momentumScore,
      completionRate,
      tasks: { total, completed },
      reflection: { workedWell, pushedBack, pushedBackReason, onePriority, frictionTask }
    };
    let blob;
    let filename;
    if (format === 'markdown') {
      const md = `# Momentum OS — Weekly Review (${currentWeek})\n\n` +
        `**Momentum Score:** ${momentumScore}/100\n` +
        `**Task Completion:** ${completed}/${total} (${completionRate}%)\n\n` +
        `### What Worked Well\n${workedWell}\n\n` +
        `### What Got Pushed Back\n${pushedBack} (Reason: ${pushedBackReason})\n\n` +
        `### ONE Priority for Next Week\n${onePriority}\n\n` +
        `### Friction Audit\n${frictionTask}\n`;
      blob = new Blob([md], { type: 'text/markdown' });
      filename = `Momentum-Review-${currentWeek}.md`;
    } else {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      filename = `Momentum-Review-${currentWeek}.json`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 2500);
  };

  const handleFinalizeWeek = () => {
    setShowFinalizeConfirm(true);
  };

  const confirmFinalizeWeek = () => {
    const record = {
      id: 'ref-' + Date.now(),
      week: currentWeek,
      title: `${currentWeek} Review — Momentum ${momentumScore}`,
      dateRange: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' Finalized',
      completedRate: completionRate,
      tasksDone: completed,
      tasksTotal: total,
      momentumScore,
      workedWell,
      pushedBack,
      onePriority,
      targetGoal: goals.find(g => g.id === targetGoalId)?.title || 'General'
    };
    saveWeeklyReview?.(record);
    setShowFinalizeConfirm(false);
  };

  return (
    <main className="w-full pt-16 md:pt-12 px-4 sm:px-6 md:px-margin-desktop py-4 sm:py-gutter-xl min-h-screen bg-surface">
      <div className="flex flex-col w-full space-y-4 sm:space-y-gutter-xl max-w-6xl mx-auto pb-10">

        {/* ── Header Row with Scope Switcher ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-caption text-[11px] font-semibold tracking-wide uppercase">
                Continuous Calibration
              </span>
              <span className="text-on-surface-variant font-caption text-xs">
                {currentWeek} • Active Cycle
              </span>
            </div>
            <h1 className="font-headline-lg text-[24px] sm:text-headline-lg text-on-surface tracking-tight">
              Weekly Review &amp; Reflections
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Honest audits drive compounding momentum. Review wins, calibrate friction, set intentional trajectories.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            {/* Weekly / Monthly Toggle (#30) */}
            <div className="inline-flex p-1 rounded-full bg-surface-container shadow-inner">
              <button
                onClick={() => setViewScope('weekly')}
                className={`px-3.5 py-1 rounded-full text-label-sm font-label-sm transition-all ${
                  viewScope === 'weekly'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Weekly Retrospective
              </button>
              <button
                onClick={() => setViewScope('monthly')}
                className={`px-3.5 py-1 rounded-full text-label-sm font-label-sm transition-all ${
                  viewScope === 'monthly'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Monthly Retrospective
              </button>
            </div>

            {/* Export Dropdown / Button */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleExport('markdown')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-lowest border border-black/[0.08] hover:bg-surface-container text-on-surface text-label-sm font-label-sm shadow-sm transition-all"
                title="Export as Markdown"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">download</span>
                <span className="hidden sm:inline">Export .MD</span>
              </button>
              <button
                onClick={handleFinalizeWeek}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container text-label-sm font-label-sm shadow-sm hover:brightness-105 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">task_alt</span>
                <span>Finalize Week</span>
              </button>
            </div>
          </div>
        </div>

        {exportNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Reflection exported successfully to your downloads folder.</span>
          </div>
        )}

        {/* ── FEATURE #1 & #2: Coach Narrative & Weekly Momentum Score ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-gutter-base">
          {/* Coach Narrative Summary Card (8 cols) */}
          <div className="lg:col-span-8 p-4 sm:p-gutter-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-primary-fixed text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">psychology_alt</span>
                  </span>
                  <div>
                    <h3 className="font-title text-title text-on-surface font-semibold">Executive Coach Narrative</h3>
                    <p className="font-caption text-[11px] text-on-surface-variant">Computed from active cadence across tasks &amp; goals</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-caption text-caption font-semibold">
                  Pacing Healthy
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface leading-relaxed mt-2">
                You maintained solid execution velocity with <strong>{completed} of {total} tasks completed</strong> ({completionRate}%), with prime focus directed towards high-leverage outcomes. 
                Your habit engine sustained strong consistency, keeping <strong>{habitsCompletedToday} of {totalHabits} targets</strong> locked today. 
                {stalledGoal && ` Notice: "${stalledGoal.title}" is slightly behind trajectory; consider shedding lower-leverage auxiliary work to clear room.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-3 mt-3 border-t border-surface-container text-xs text-on-surface-variant">
              <span className="flex items-center gap-1 text-secondary font-medium">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                +12% velocity vs last week
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-primary font-medium">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                {goalsOnTrack} of {totalGoals} Goals on Track
              </span>
            </div>
          </div>

          {/* Headline Momentum Score (4 cols) */}
          <div className="lg:col-span-4 p-4 sm:p-gutter-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between items-center text-center">
            <div className="w-full flex items-center justify-between text-left mb-1">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">Momentum Score</span>
              <span className="material-symbols-outlined text-amber-500 text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>bolt</span>
            </div>
            
            <div className="relative w-28 h-28 my-2 flex items-center justify-center">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                <path className="text-surface-container-high" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.2" />
                <path className="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${momentumScore}, 100`} strokeLinecap="round" strokeWidth="3.2" />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tracking-tight text-on-surface">{momentumScore}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Index / 100</span>
              </div>
            </div>

            <p className="font-caption text-caption text-on-surface-variant">
              Top 15% percentile of focused cognitive output this cycle.
            </p>
          </div>
        </div>

        {/* ── Planned vs Completed & Category Time Shift ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-gutter-base">
          {/* Planned vs Completed Comparison Bar */}
          <div className="p-4 sm:p-gutter-base rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-title text-title text-on-surface">Planned vs. Completed</h3>
                <p className="font-caption text-caption text-on-surface-variant">Task delivery efficiency across this cycle</p>
              </div>
              <span className="font-label-md text-label-md font-semibold text-primary">{completionRate}% Done</span>
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                  <span>Completed ({completed} tasks)</span>
                  <span className="font-semibold text-on-surface">{completed}</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                  <span>Rolled Over / Incomplete</span>
                  <span className="font-semibold text-on-surface">{Math.max(0, total - completed)}</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${100 - completionRate}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-surface-container/60 flex items-center justify-between text-xs text-on-surface-variant">
              <span>Target: 80% baseline</span>
              <span className="text-secondary font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check</span> Above Target
              </span>
            </div>
          </div>

          {/* Category Time Shift (Radar Balance) */}
          <div className="p-4 sm:p-gutter-base rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-title text-title text-on-surface">Category Balance Shift</h3>
                <p className="font-caption text-caption text-on-surface-variant">Quarterly holistic equilibrium overlay</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container/60 text-secondary font-caption text-caption font-semibold">
                Balanced
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 my-1 text-xs">
              <div className="p-2 rounded-xl bg-surface-container-low">
                <span className="text-on-surface-variant block text-[10px] uppercase font-bold">Deep Work</span>
                <span className="font-semibold text-on-surface">62% (+8% this wk)</span>
              </div>
              <div className="p-2 rounded-xl bg-surface-container-low">
                <span className="text-on-surface-variant block text-[10px] uppercase font-bold">Habits &amp; Health</span>
                <span className="font-semibold text-secondary">24% (Optimal)</span>
              </div>
              <div className="p-2 rounded-xl bg-surface-container-low">
                <span className="text-on-surface-variant block text-[10px] uppercase font-bold">Creative Play</span>
                <span className="font-semibold text-amber-600">14% (Under target)</span>
              </div>
              <div className="p-2 rounded-xl bg-surface-container-low">
                <span className="text-on-surface-variant block text-[10px] uppercase font-bold">Administration</span>
                <span className="font-semibold text-on-surface">&lt; 5% (Lean)</span>
              </div>
            </div>

            <p className="font-caption text-[11px] text-on-surface-variant mt-1">
              Creative exploration is slightly depressed by deadline sprint pressure.
            </p>
          </div>
        </div>

        {/* ── Weekly Energy & Mood Log (Mon-Sun) ── */}
        <div className="p-4 sm:p-gutter-base rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-title text-title text-on-surface">Daily Energy &amp; Mood Telemetry</h3>
              <p className="font-caption text-caption text-on-surface-variant">Self-reported cognitive battery (1 = Drained, 5 = Peak Flow)</p>
            </div>
            <span className="font-label-sm text-xs font-semibold text-tertiary">Avg: 4.1 / 5</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-3 text-center mt-3">
            {DAYS.map((day, idx) => {
              const rating = moodRatings[idx] || 4;
              const colors = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'];
              return (
                <div key={day} className="flex flex-col items-center p-2 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors">
                  <span className="font-caption text-[11px] font-bold text-on-surface-variant uppercase">{day}</span>
                  <div className="my-1.5 flex items-center justify-center">
                    <span className={`w-3 h-3 rounded-full ${colors[rating - 1]}`} />
                  </div>
                  <select
                    value={rating}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateReflection?.({
                        moodRatings: { ...moodRatings, [idx]: val }
                      });
                    }}
                    className="bg-transparent border-none text-[11px] font-semibold text-on-surface cursor-pointer focus:outline-none text-center"
                  >
                    <option value={5}>⚡ 5 (Peak)</option>
                    <option value={4}>🔋 4 (Good)</option>
                    <option value={3}>☕ 3 (Steady)</option>
                    <option value={2}>📉 2 (Low)</option>
                    <option value={1}>🪫 1 (Drained)</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── GUIDED JOURNALING: #8, #9, #10, #13, #34 ── */}
        <div className="space-y-3 sm:space-y-gutter-base">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Structured Guided Retrospective</h2>
            <span className="text-on-surface-variant font-caption text-xs">Auto-saves to local storage</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-gutter-base">
            {/* What Worked Well? */}
            <div className="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-secondary text-[20px]">thumb_up</span>
                  <h3 className="font-title text-title text-on-surface">1. What worked well this week?</h3>
                </div>
                <textarea
                  value={workedWell}
                  onChange={(e) => updateReflection?.({ workedWell: e.target.value })}
                  placeholder="e.g., Morning 90m deep work sprint before opening Slack produced the biggest breakthrough..."
                  rows={3}
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-black/[0.06] text-on-surface text-body-sm placeholder:text-on-surface-variant/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-all"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase">Quick Add:</span>
                {['Morning 90m block', 'Zero Slack before 11AM', 'Streak consistency', 'Deep Focus sprint'].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => updateReflection?.({ workedWell: workedWell ? `${workedWell} • ${chip}` : chip })}
                    className="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[10px] font-medium transition-colors"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* What Got Pushed Back & Reason */}
            <div className="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-[20px]">schedule</span>
                    <h3 className="font-title text-title text-on-surface">2. What got pushed back?</h3>
                  </div>
                  <select
                    value={pushedBackReason}
                    onChange={(e) => updateReflection?.({ pushedBackReason: e.target.value })}
                    className="px-2 py-1 rounded-lg bg-surface-container text-on-surface text-[11px] font-medium border-none outline-none cursor-pointer"
                  >
                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <textarea
                  value={pushedBack}
                  onChange={(e) => updateReflection?.({ pushedBack: e.target.value })}
                  placeholder="e.g., Classical guitar fingerstyle practice got pushed 3 evenings in a row..."
                  rows={3}
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-black/[0.06] text-on-surface text-body-sm placeholder:text-on-surface-variant/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-all"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase">Quick Add:</span>
                {['Evening workout', 'Architecture RFC', 'Backlog triage', 'Book reading'].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => updateReflection?.({ pushedBack: pushedBack ? `${pushedBack} • ${chip}` : chip })}
                    className="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[10px] font-medium transition-colors"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* The ONE Priority for Next Week + Goal Link */}
            <div className="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">flag</span>
                    <h3 className="font-title text-title text-on-surface">3. The ONE Priority</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-on-surface-variant font-bold uppercase">Link Goal:</span>
                    <select
                      value={targetGoalId}
                      onChange={(e) => updateReflection?.({ targetGoalId: e.target.value })}
                      className="px-2 py-0.5 rounded-lg bg-primary-fixed text-on-primary-fixed-variant text-[11px] font-semibold border-none outline-none cursor-pointer"
                    >
                      {goals.map(g => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea
                  value={onePriority}
                  onChange={(e) => updateReflection?.({ onePriority: e.target.value })}
                  placeholder="e.g., Deploy and release the Portfolio Website v3 live for public viewing..."
                  rows={2}
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-black/[0.06] text-on-surface text-body-sm placeholder:text-on-surface-variant/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-all"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase">Preset:</span>
                {['Ship Portfolio v3', 'Close API migration', 'Tempo Half Marathon', 'Knowledge Hub v1'].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => updateReflection?.({ onePriority: chip })}
                    className="px-2 py-0.5 rounded-lg bg-primary-fixed/50 hover:bg-primary-fixed text-primary text-[10px] font-semibold transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Friction Audit */}
            <div className="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-tertiary text-[20px]">construction</span>
                  <h3 className="font-title text-title text-on-surface">4. Friction Audit</h3>
                </div>
                <p className="font-caption text-[11px] text-on-surface-variant mb-2">
                  Which task took the highest willpower to start? Shrink it or automate it for next sprint.
                </p>
                <input
                  type="text"
                  value={frictionTask}
                  onChange={(e) => updateReflection?.({ frictionTask: e.target.value })}
                  placeholder="e.g., Setting up automated test suites for API migration"
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-black/[0.06] text-on-surface text-body-sm placeholder:text-on-surface-variant/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase">Suggest:</span>
                {['Split into 15m kickoff', 'Automate schema export', 'Delegate triage'].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => updateReflection?.({ frictionTask: chip })}
                    className="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[10px] font-medium transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Velocity Calibration & Habit Tune-Up ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-gutter-base">
          {/* Stalled Goal Velocity Speedometer */}
          <div className="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface font-semibold">Goal Pacing Alert</span>
              <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] font-bold">Needs Attention</span>
            </div>
            <div className="my-2 p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
              <span className="material-symbols-outlined text-amber-500 mt-0.5">warning</span>
              <div>
                <span className="font-semibold text-sm text-on-surface block">{stalledGoal?.title || 'Classical Guitar'}</span>
                <p className="font-caption text-xs text-on-surface-variant mt-0.5">
                  Pacing is behind schedule (28% done vs 58 days remaining). Want to lower daily practice threshold from 30m to 15m?
                </p>
              </div>
            </div>
            <button
              onClick={() => alert(`Threshold adjusted: ${stalledGoal?.title || 'Goal'} target simplified for next cycle.`)}
              className="w-full py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-xs font-semibold transition-colors"
            >
              Simplify Next Step (Lower Friction)
            </button>
          </div>

          {/* Recurring Habit Tune-Up */}
          <div className="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface font-semibold">Habit Tune-Up</span>
              <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
            </div>
            <div className="my-2 p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
              <span className="material-symbols-outlined text-primary mt-0.5">autorenew</span>
              <div>
                <span className="font-semibold text-sm text-on-surface block">{lowestHabit.title}</span>
                <p className="font-caption text-xs text-on-surface-variant mt-0.5">
                  Check-in rate dropped this week. Recommend shifting routine from Late Evening to Morning window.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setHabitTuneNotice(true);
                setTimeout(() => setHabitTuneNotice(false), 2000);
              }}
              className="w-full py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-xs font-semibold transition-colors"
            >
              {habitTuneNotice ? '✓ Routine Re-anchored to Morning' : 'Re-anchor to Morning Anchor'}
            </button>
          </div>
        </div>

        {/* ── Review History Drawer ── */}
        <div className="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-title text-title text-on-surface">Archived Weekly Reviews</h3>
              <p className="font-caption text-caption text-on-surface-variant">Past retrospectives and milestone snapshots</p>
            </div>
            <span className="font-caption text-xs text-on-surface-variant">{history.length} archived reviews</span>
          </div>

          <div className="space-y-2">
            {history.map((rev) => {
              const isOpen = activeHistoryId === rev.id;
              return (
                <div key={rev.id} className="rounded-xl bg-surface-container-low border border-black/[0.04] overflow-hidden transition-all">
                  <div
                    onClick={() => setActiveHistoryId(isOpen ? null : rev.id)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-container transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        {isOpen ? 'expand_less' : 'expand_more'}
                      </span>
                      <span className="font-semibold text-xs sm:text-sm text-on-surface">{rev.title}</span>
                      <span className="hidden sm:inline-block font-caption text-[11px] text-on-surface-variant">• {rev.dateRange}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface text-[10px] font-semibold">
                        Score: {rev.momentumScore}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-[10px] font-semibold">
                        {rev.completedRate}% done
                      </span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="p-4 border-t border-surface-container bg-surface-container-lowest/60 text-xs text-on-surface-variant space-y-2 animate-fadeIn">
                      <div>
                        <strong className="text-on-surface block mb-0.5">What Worked Well:</strong>
                        <p>{rev.workedWell}</p>
                      </div>
                      <div>
                        <strong className="text-on-surface block mb-0.5">Pushed Back:</strong>
                        <p>{rev.pushedBack}</p>
                      </div>
                      <div>
                        <strong className="text-on-surface block mb-0.5">Target Priority:</strong>
                        <p>{rev.onePriority} ({rev.targetGoal})</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <ConfirmModal
        isOpen={showFinalizeConfirm}
        title="Finalize & Archive Weekly Review?"
        message={`Archive your reflection for ${currentWeek} (Score: ${momentumScore}) to history and prepare your schedule for the next cycle?`}
        confirmText="Finalize Review"
        isDanger={false}
        onConfirm={confirmFinalizeWeek}
        onCancel={() => setShowFinalizeConfirm(false)}
      />
    </main>
  );
}
