import React, { useState, useMemo } from 'react';
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

const MOOD_LEVELS = {
  5: {
    label: 'Peak',
    emoji: '⚡',
    short: 'Peak',
    activeClass: 'bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300',
    barColor: 'bg-emerald-500',
    dotColor: 'bg-emerald-500'
  },
  4: {
    label: 'Good',
    emoji: '🔋',
    short: 'Good',
    activeClass: 'bg-teal-500/10 hover:bg-teal-500/15 border-teal-500/30 text-teal-800 dark:text-teal-300',
    barColor: 'bg-teal-500',
    dotColor: 'bg-teal-500'
  },
  3: {
    label: 'Steady',
    emoji: '☕',
    short: 'Steady',
    activeClass: 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300',
    barColor: 'bg-amber-500',
    dotColor: 'bg-amber-500'
  },
  2: {
    label: 'Low',
    emoji: '📉',
    short: 'Low',
    activeClass: 'bg-orange-500/10 hover:bg-orange-500/15 border-orange-500/30 text-orange-800 dark:text-orange-300',
    barColor: 'bg-orange-500',
    dotColor: 'bg-orange-500'
  },
  1: {
    label: 'Drained',
    emoji: '🪫',
    short: 'Drained',
    activeClass: 'bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-300',
    barColor: 'bg-rose-500',
    dotColor: 'bg-rose-500'
  }
};

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
  const [goalTunedNotice, setGoalTunedNotice] = useState(false);
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

  // Real stalled goal check (never fake-default to an on-track goal)
  const stalledGoal = useMemo(() => {
    return goals.find(g => g.velocity === 'behind' || g.status === 'behind') || null;
  }, [goals]);

  // Real least performing habit to tune up based on completed days count
  const lowestHabit = useMemo(() => {
    if (!habits.length) return null;
    return [...habits].sort((a, b) => {
      const aCount = (a.completedDays || []).length;
      const bCount = (b.completedDays || []).length;
      return aCount - bCount;
    })[0];
  }, [habits]);

  // Derived tasks for Recognition Over Recall
  const completedTasks = useMemo(() => {
    return tasks.filter(t => t.completed || t.status === 'done');
  }, [tasks]);

  const incompleteTasks = useMemo(() => {
    return tasks.filter(t => !t.completed && t.status !== 'done');
  }, [tasks]);

  const retrospectiveProgress = useMemo(() => {
    let filled = 0;
    if (workedWell && workedWell.trim()) filled++;
    if (pushedBack && pushedBack.trim()) filled++;
    if (onePriority && onePriority.trim()) filled++;
    if (frictionTask && frictionTask.trim()) filled++;
    return filled;
  }, [workedWell, pushedBack, onePriority, frictionTask]);

  const previousWeekScore = useMemo(() => {
    if (history && history.length > 0) {
      return history[0].momentumScore ?? 66;
    }
    return 45;
  }, [history]);

  const scoreDelta = momentumScore - previousWeekScore;

  // Honest dynamic status and coach narrative based on actual performance
  const coachStatus = useMemo(() => {
    if (completionRate >= 80 && momentumScore >= 70) {
      return {
        badge: 'Optimal Momentum',
        badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold'
      };
    }
    if (completionRate >= 50 || momentumScore >= 50) {
      return {
        badge: 'Steady Progress',
        badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200/80 font-bold'
      };
    }
    return {
      badge: 'Recalibration Needed',
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200/80 font-bold'
    };
  }, [completionRate, momentumScore]);

  const coachNarrative = useMemo(() => {
    let taskSentence = '';
    if (total === 0) {
      taskSentence = 'No tasks queued for this active cycle.';
    } else if (completionRate >= 80) {
      taskSentence = `You maintained exceptional delivery velocity with ${completed} of ${total} tasks finalized (${completionRate}%), cleanly surpassing the weekly 80% baseline.`;
    } else if (completionRate >= 50) {
      taskSentence = `You maintained steady execution with ${completed} of ${total} tasks completed (${completionRate}%). Focus was directed towards high-leverage outcomes with moderate rollover.`;
    } else if (completed > 0) {
      taskSentence = `Execution velocity slowed this cycle with ${completed} of ${total} tasks finalized (${completionRate}%). High-friction bottlenecks or scope spillover created rollover pressure.`;
    } else {
      taskSentence = `No tasks finalized yet across this cycle (0 of ${total} tasks completed). Let's diagnose friction points and secure a quick 15-minute starter win to restart forward momentum.`;
    }

    let habitSentence = '';
    if (totalHabits === 0) {
      habitSentence = 'No recurring habit sequences are currently active.';
    } else if (habitsCompletedToday === totalHabits) {
      habitSentence = `Your habit engine is firing at peak consistency with all ${habitsCompletedToday} of ${totalHabits} daily anchors completed today.`;
    } else if (habitsCompletedToday > 0) {
      habitSentence = `Your habit engine has locked in ${habitsCompletedToday} of ${totalHabits} daily anchors today.`;
    } else {
      habitSentence = `Daily habit anchors are currently pending (${habitsCompletedToday} of ${totalHabits} locked today). Tap your primary sequence to protect your active streaks.`;
    }

    let goalSentence = '';
    if (stalledGoal) {
      goalSentence = ` Notice: "${stalledGoal.title}" is pacing behind its milestone timeline; consider simplifying the next physical step to lower friction.`;
    } else if (goals.length > 0) {
      goalSentence = ` All ${goalsOnTrack} active horizon goals are currently holding strong trajectories.`;
    }

    return `${taskSentence} ${habitSentence}${goalSentence}`;
  }, [total, completed, completionRate, totalHabits, habitsCompletedToday, goals, goalsOnTrack, stalledGoal]);

  const momentumPercentileNote = useMemo(() => {
    if (momentumScore >= 80) return 'Top 10% percentile of focused cognitive output this cycle.';
    if (momentumScore >= 65) return 'Solid momentum • Top 25% percentile of weekly execution.';
    if (momentumScore >= 45) return 'Steady pacing • Opportunities exist to tighten daily anchors.';
    return 'Recalibration window • Focus on small daily wins to rebuild momentum.';
  }, [momentumScore]);

  const todayIdx = useMemo(() => new Date().getDay(), []);

  const moodAvg = useMemo(() => {
    const vals = Object.values(moodRatings || {});
    if (!vals.length) return '4.0';
    const sum = vals.reduce((acc, curr) => acc + Number(curr), 0);
    return (sum / vals.length).toFixed(1);
  }, [moodRatings]);

  const moodBatteryHealth = useMemo(() => {
    const score = parseFloat(moodAvg);
    if (score >= 4.3) return { label: 'Peak Capacity', color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25' };
    if (score >= 3.6) return { label: 'Optimal Flow', color: 'text-teal-700 dark:text-teal-300 bg-teal-500/10 border-teal-500/25' };
    if (score >= 2.8) return { label: 'Steady Reserve', color: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25' };
    if (score >= 2.0) return { label: 'Depleted Energy', color: 'text-orange-700 dark:text-orange-300 bg-orange-500/10 border-orange-500/25' };
    return { label: 'Burnout Risk Alert', color: 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25' };
  }, [moodAvg]);

  // Real Dynamic Life Area Allocation
  const categoryBreakdown = useMemo(() => {
    const areaCounts = {
      'Career & Craft': 0,
      'Deep Focus': 0,
      'Health & Vitality': 0,
      'Creative & Expression': 0,
      'Personal & Life': 0,
      'Habit Consistency': 0
    };

    let totalWeight = 0;

    tasks.forEach(t => {
      const taskAreas = Array.isArray(t.areas) && t.areas.length > 0
        ? t.areas
        : (t.category ? [t.category] : ['Career & Craft']);
      
      const weight = t.durationMinutes || 30;
      taskAreas.forEach(a => {
        if (areaCounts[a] !== undefined) {
          areaCounts[a] += weight;
        } else {
          areaCounts['Career & Craft'] += weight;
        }
        totalWeight += weight;
      });
    });

    habits.forEach(h => {
      const habitWeight = 30 * ((h.completedDays || []).length || 1);
      areaCounts['Habit Consistency'] += habitWeight;
      totalWeight += habitWeight;
    });

    const areasConfig = [
      { id: 'Career & Craft', label: 'Career & Craft', barColor: 'bg-blue-500', dotColor: 'bg-blue-500' },
      { id: 'Deep Focus', label: 'Deep Focus', barColor: 'bg-indigo-500', dotColor: 'bg-indigo-500' },
      { id: 'Health & Vitality', label: 'Health & Vitality', barColor: 'bg-emerald-500', dotColor: 'bg-emerald-500' },
      { id: 'Creative & Expression', label: 'Creative & Expression', barColor: 'bg-purple-500', dotColor: 'bg-purple-500' }
    ];

    const safeTotal = totalWeight > 0 ? totalWeight : 1;

    const items = areasConfig.map(cfg => {
      const weight = areaCounts[cfg.id] || 0;
      const pct = totalWeight > 0 ? Math.round((weight / safeTotal) * 100) : 0;
      let status = 'Balanced';
      let statusColor = 'text-neutral-500';
      if (pct >= 40) {
        status = 'Dominant Focus';
        statusColor = 'text-primary font-bold';
      } else if (pct >= 20) {
        status = 'Optimal Cadence';
        statusColor = 'text-emerald-600 font-semibold';
      } else if (pct > 0) {
        status = 'Light Cadence';
        statusColor = 'text-amber-600 font-medium';
      } else {
        status = 'Untracked';
        statusColor = 'text-neutral-400 font-normal';
      }
      return {
        ...cfg,
        pct,
        status,
        statusColor
      };
    });

    const activeItems = items.filter(i => i.pct > 0);
    const topArea = [...items].sort((a, b) => b.pct - a.pct)[0];

    let diagnosis = 'Energy distribution across primary life areas is harmoniously balanced.';
    let isBalanced = true;
    if (topArea && topArea.pct >= 55) {
      diagnosis = `Heavy concentration in ${topArea.label} (${topArea.pct}%). Consider scheduling cross-domain recovery to prevent burnout.`;
      isBalanced = false;
    } else if (topArea && topArea.pct >= 35) {
      diagnosis = `${topArea.label} leads execution velocity (${topArea.pct}%), backed by steady multi-domain engagement.`;
    }

    return {
      items,
      activeItems: activeItems.length > 0 ? activeItems : items,
      topArea,
      diagnosis,
      isBalanced
    };
  }, [tasks, habits]);

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
      <div className="flex flex-col w-full space-y-4 sm:space-y-gutter-xl max-w-6xl mx-auto pb-28">

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
                    <p className="font-caption text-[11px] text-on-surface-variant">Real-time diagnosis synthesized across tasks, habits &amp; goals</p>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-caption font-semibold ${coachStatus.badgeClass}`}>
                  {coachStatus.badge}
                </span>
              </div>
              <p className="font-body-md text-xs sm:text-sm text-on-surface leading-relaxed mt-2 mb-3">
                {coachNarrative}
              </p>
            </div>

            {/* 3 Scannable Bento Indicator Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-surface-container">
              {/* Delivery Velocity Bento */}
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-black/[0.03] flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-bold uppercase">
                  <span>Task Velocity</span>
                  <span className={completionRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}>
                    {completionRate >= 80 ? 'Optimal' : completionRate >= 50 ? 'Steady' : 'Lagging'}
                  </span>
                </div>
                <div className="my-1">
                  <span className="text-base font-extrabold text-on-surface">{completed}/{total}</span>
                  <span className="text-[11px] text-on-surface-variant ml-1 font-semibold">({completionRate}%)</span>
                </div>
                <button
                  type="button"
                  onClick={() => document.getElementById('retrospective-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-[10px] font-semibold text-primary hover:underline text-left"
                >
                  Log Rollover Tasks →
                </button>
              </div>

              {/* Habit Engine Bento */}
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-black/[0.03] flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-bold uppercase">
                  <span>Habit Anchors</span>
                  <span className={habitsCompletedToday === totalHabits && totalHabits > 0 ? 'text-emerald-600' : 'text-blue-600'}>
                    {habitsCompletedToday === totalHabits && totalHabits > 0 ? 'Firing' : 'Active'}
                  </span>
                </div>
                <div className="my-1">
                  <span className="text-base font-extrabold text-on-surface">{habitsCompletedToday}/{totalHabits}</span>
                  <span className="text-[11px] text-on-surface-variant ml-1 font-semibold">locked today</span>
                </div>
                <span className="text-[10px] font-semibold text-secondary truncate">
                  {totalHabits - habitsCompletedToday > 0 ? `${totalHabits - habitsCompletedToday} pending today` : 'All daily anchors locked'}
                </span>
              </div>

              {/* Milestone Horizon Bento */}
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-black/[0.03] flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-bold uppercase">
                  <span>Horizon Pace</span>
                  <span className={stalledGoal ? 'text-rose-600' : 'text-emerald-600'}>
                    {stalledGoal ? 'Stalled' : 'On Track'}
                  </span>
                </div>
                <div className="my-1 truncate">
                  <span className="text-xs font-extrabold text-on-surface truncate block" title={stalledGoal ? stalledGoal.title : `${goalsOnTrack}/${totalGoals} Goals On Track`}>
                    {stalledGoal ? stalledGoal.title : `${goalsOnTrack}/${totalGoals} On Track`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => document.getElementById('goal-pacing-alert')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-[10px] font-semibold text-primary hover:underline text-left truncate"
                >
                  {stalledGoal ? 'Unblock Milestone →' : 'View Goal Cadence →'}
                </button>
              </div>
            </div>
          </div>

          {/* Headline Momentum Score (4 cols) */}
          <div className="lg:col-span-4 p-4 sm:p-gutter-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between items-center text-center">
            <div className="w-full flex items-center justify-between text-left mb-1">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">Momentum Score</span>
              <span className="material-symbols-outlined text-amber-500 text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>bolt</span>
            </div>
            
            <div className="relative w-28 h-28 my-1 flex items-center justify-center">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                <path className="text-surface-container-high" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.2" />
                <path className="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${momentumScore}, 100`} strokeLinecap="round" strokeWidth="3.2" />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tracking-tight text-on-surface">{momentumScore}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Index / 100</span>
              </div>
            </div>

            {/* Score Delta Anchor */}
            <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border my-1 ${
              scoreDelta >= 0
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              <span className="material-symbols-outlined text-[13px]">
                {scoreDelta >= 0 ? 'trending_up' : 'trending_down'}
              </span>
              <span>{scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} pts vs last review</span>
            </div>

            <p className="font-caption text-[11px] text-on-surface-variant mt-0.5">
              {momentumPercentileNote}
            </p>
            <span className="text-[10px] text-primary font-semibold mt-1">
              ✨ Locking review secures +15 projection pts
            </span>
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
              {completionRate >= 80 ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span> Exceeding Target (+{completionRate - 80}%)
                </span>
              ) : completionRate >= 60 ? (
                <span className="text-blue-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">schedule</span> Near Baseline ({80 - completionRate}% gap)
                </span>
              ) : (
                <span className="text-amber-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">warning</span> Behind Baseline ({80 - completionRate}% gap)
                </span>
              )}
            </div>
          </div>

          {/* Category Time Shift (Real Dynamic Life Area Allocation) */}
          <div className="p-4 sm:p-gutter-base rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-title text-title text-on-surface font-semibold">Category Balance Shift</h3>
                  <p className="font-caption text-caption text-on-surface-variant">Active cycle life-area equilibrium</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-caption font-semibold ${
                  categoryBreakdown.isBalanced
                    ? 'bg-secondary-container/60 text-secondary border border-secondary/20'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {categoryBreakdown.isBalanced ? 'Balanced' : 'Focus Skewed'}
                </span>
              </div>

              {/* Multi-Segment Distribution Bar */}
              <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden flex my-2">
                {categoryBreakdown.activeItems.map((item) => (
                  <div
                    key={item.id}
                    className={`h-full ${item.barColor} transition-all duration-500`}
                    style={{ width: `${item.pct}%` }}
                    title={`${item.label}: ${item.pct}%`}
                  />
                ))}
              </div>

              {/* 4 Life Area Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 my-1 text-xs">
                {categoryBreakdown.items.map((item) => (
                  <div key={item.id} className="p-2 rounded-xl bg-surface-container-low border border-black/[0.03]">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`w-2 h-2 rounded-full ${item.dotColor}`} />
                      <span className="text-on-surface-variant text-[10px] uppercase font-bold truncate">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="font-bold text-on-surface text-sm">{item.pct}%</span>
                      <span className={`text-[10px] ${item.statusColor}`}>{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="font-caption text-[11px] text-on-surface-variant mt-2 border-t border-surface-container/60 pt-2">
              {categoryBreakdown.diagnosis}
            </p>
          </div>
        </div>

        {/* ── Weekly Energy & Mood Log (Mon-Sun) ── */}
        <div className="p-4 sm:p-gutter-base rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">bolt</span>
                <h3 className="font-title text-title text-on-surface">Daily Energy &amp; Mood Telemetry</h3>
              </div>
              <p className="font-caption text-caption text-on-surface-variant">
                Cognitive battery tracking (1 = Drained, 5 = Peak Flow) • Tap card to cycle or tap segments
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${moodBatteryHealth.color}`}>
                {moodBatteryHealth.label}
              </span>
              <span className="font-label-sm text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-container text-on-surface border border-black/[0.04]">
                Avg: <strong className="text-primary">{moodAvg}</strong> / 5
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 text-center mt-3">
            {DAYS.map((day, idx) => {
              const rating = Number(moodRatings[idx]) || 4;
              const config = MOOD_LEVELS[rating] || MOOD_LEVELS[3];
              const isToday = idx === todayIdx;

              const handleStep = (delta, e) => {
                e?.stopPropagation();
                let nextVal = rating + delta;
                if (nextVal > 5) nextVal = 1;
                if (nextVal < 1) nextVal = 5;
                updateReflection?.({
                  moodRatings: { ...moodRatings, [idx]: nextVal }
                });
              };

              const handleSetRating = (lvl, e) => {
                e?.stopPropagation();
                updateReflection?.({
                  moodRatings: { ...moodRatings, [idx]: lvl }
                });
              };

              return (
                <div
                  key={day}
                  onClick={(e) => handleStep(1, e)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleStep(1, e);
                    }
                  }}
                  className={`group relative flex flex-col items-center justify-between p-2 sm:p-2.5 rounded-2xl border transition-all duration-150 cursor-pointer select-none active:scale-[0.97] ${
                    isToday
                      ? 'ring-2 ring-primary/60 shadow-sm ' + config.activeClass
                      : config.activeClass
                  }`}
                  title={`Click ${day} card to cycle rating (1-5)`}
                >
                  {/* Day Header & Today Marker */}
                  <div className="flex flex-col items-center gap-0.5 w-full">
                    <span className="font-caption text-[11px] font-bold tracking-wider uppercase opacity-85">
                      {day}
                    </span>
                    {isToday ? (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-primary text-on-primary tracking-tight leading-none scale-95 shadow-xs">
                        Today
                      </span>
                    ) : (
                      <span className="text-[9px] text-transparent select-none leading-none py-0.5">·</span>
                    )}
                  </div>

                  {/* Rating Icon & State */}
                  <div className="my-1.5 flex flex-col items-center">
                    <span className="text-xl sm:text-2xl transform transition-transform group-hover:scale-110">
                      {config.emoji}
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold tracking-tight mt-0.5">
                      {rating}<span className="text-[10px] font-normal opacity-60">/5</span>
                    </span>
                    <span className="text-[10px] font-semibold tracking-tight opacity-90 truncate max-w-full">
                      {config.short}
                    </span>
                  </div>

                  {/* 5-segment Mini Energy Gauge */}
                  <div className="w-full flex items-center justify-center gap-1 my-1 px-0.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={(e) => handleSetRating(lvl, e)}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          lvl <= rating ? config.barColor : 'bg-black/10 dark:bg-white/10'
                        } hover:h-2`}
                        title={`Set ${day} to ${lvl}`}
                      />
                    ))}
                  </div>

                  {/* Stepper buttons */}
                  <div className="flex items-center justify-between w-full mt-1 pt-1 border-t border-black/[0.05] dark:border-white/[0.05]">
                    <button
                      type="button"
                      onClick={(e) => handleStep(-1, e)}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 text-on-surface-variant font-bold text-xs"
                      title="Decrease (-1)"
                    >
                      -
                    </button>
                    <span className="text-[9px] font-medium opacity-50">tap</span>
                    <button
                      type="button"
                      onClick={(e) => handleStep(1, e)}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 text-on-surface-variant font-bold text-xs"
                      title="Increase (+1)"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── GUIDED JOURNALING: #8, #9, #10, #13, #34 ── */}
        <div id="retrospective-section" className="space-y-3 sm:space-y-gutter-base scroll-mt-20">
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

              {/* 1-Tap Recognition: Actual Completed Tasks first, then starter presets */}
              <div className="space-y-1.5 mt-2.5">
                {completedTasks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">verified</span>
                      Completed Wins:
                    </span>
                    {completedTasks.slice(0, 4).map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updateReflection?.({ workedWell: workedWell ? `${workedWell} • Finished "${t.title}"` : `Finished "${t.title}"` })}
                        className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[10px] font-semibold transition-all active:scale-95 flex items-center gap-1"
                        title={`Add "${t.title}" to wins`}
                      >
                        <span>+</span>
                        <span className="truncate max-w-[150px]">{t.title}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase">Quick Add:</span>
                  {['Morning 90m block', 'Zero Slack before 11AM', 'Streak consistency', 'Deep Focus sprint'].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => updateReflection?.({ workedWell: workedWell ? `${workedWell} • ${chip}` : chip })}
                      className="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[10px] font-medium transition-colors active:scale-95"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
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

              {/* 1-Tap Recognition: Actual Rolled/Incomplete Tasks first, then starter presets */}
              <div className="space-y-1.5 mt-2.5">
                {incompleteTasks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">update</span>
                      Rolled Over:
                    </span>
                    {incompleteTasks.slice(0, 4).map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updateReflection?.({ pushedBack: pushedBack ? `${pushedBack} • Rolled "${t.title}"` : `Rolled "${t.title}"` })}
                        className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-[10px] font-semibold transition-all active:scale-95 flex items-center gap-1"
                        title={`Mark "${t.title}" as pushed back`}
                      >
                        <span>+</span>
                        <span className="truncate max-w-[150px]">{t.title}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase">Quick Add:</span>
                  {['Evening workout', 'Architecture RFC', 'Backlog triage', 'Book reading'].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => updateReflection?.({ pushedBack: pushedBack ? `${pushedBack} • ${chip}` : chip })}
                      className="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[10px] font-medium transition-colors active:scale-95"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
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

              {/* 1-Tap Recognition: Link active goals directly */}
              <div className="space-y-1.5 mt-2.5">
                {goals.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-primary font-bold uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">flag</span>
                      Active Horizon:
                    </span>
                    {goals.slice(0, 3).map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => updateReflection?.({ onePriority: `Advance "${g.title}" milestone`, targetGoalId: g.id })}
                        className="px-2 py-0.5 rounded-lg bg-primary-fixed/60 hover:bg-primary-fixed text-primary text-[10px] font-semibold transition-all active:scale-95 flex items-center gap-1"
                      >
                        <span>+</span>
                        <span className="truncate max-w-[140px]">{g.title}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase">Preset:</span>
                  {['Ship Portfolio v3', 'Close API migration', 'Tempo Half Marathon', 'Knowledge Hub v1'].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => updateReflection?.({ onePriority: chip })}
                      className="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[10px] font-medium transition-colors active:scale-95"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
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
          {/* Stalled Goal Velocity Speedometer or Clean Horizon State */}
          <div id="goal-pacing-alert" className="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-black/[0.04] flex flex-col justify-between scroll-mt-24">
            {stalledGoal ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">Goal Pacing Alert</span>
                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] font-bold">Needs Attention</span>
                </div>
                <div className="my-2 p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-500 mt-0.5">warning</span>
                  <div>
                    <span className="font-semibold text-sm text-on-surface block">{stalledGoal.title}</span>
                    <p className="font-caption text-xs text-on-surface-variant mt-0.5">
                      Pacing is behind schedule ({stalledGoal.progress || 0}% progress). Recommend reducing friction and simplifying the next milestone.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGoalTunedNotice(true);
                    setTimeout(() => setGoalTunedNotice(false), 2500);
                  }}
                  className="w-full py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-xs font-semibold transition-colors"
                >
                  {goalTunedNotice ? '✓ Milestone Scope Calibrated' : 'Simplify Next Step (Lower Friction)'}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">Goal Pacing Health</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">All Horizons Clean</span>
                </div>
                <div className="my-2 p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-secondary mt-0.5">verified</span>
                  <div>
                    <span className="font-semibold text-sm text-on-surface block">Velocity On Track</span>
                    <p className="font-caption text-xs text-on-surface-variant mt-0.5">
                      All {goals.length} tracked horizon goals are pacing within acceptable milestone thresholds.
                    </p>
                  </div>
                </div>
                <div className="w-full py-2 text-center text-xs font-medium text-secondary">
                  ✓ Horizon momentum maintained
                </div>
              </>
            )}
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
                <span className="font-semibold text-sm text-on-surface block">{lowestHabit?.title || 'Habit Sequences'}</span>
                <p className="font-caption text-xs text-on-surface-variant mt-0.5">
                  {lowestHabit
                    ? `Recorded ${(lowestHabit.completedDays || []).length} check-ins this cycle. Re-anchoring cadences prevents friction.`
                    : 'All habits tracked consistently across this cycle.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setHabitTuneNotice(true);
                setTimeout(() => setHabitTuneNotice(false), 2000);
              }}
              className="w-full py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-xs font-semibold transition-colors"
            >
              {habitTuneNotice ? '✓ Routine Re-anchored' : 'Re-anchor Anchor Window'}
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

      {/* ── STICKY REVIEW COMPLETION BAR (Thumb-Zone Ergonomics & Goal Gradient) ── */}
      <aside aria-label="Review completion bar" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 md:right-8 sm:w-[500px] z-30 bg-surface-container-lowest/95 backdrop-blur-md shadow-2xl border border-black/10 dark:border-white/10 rounded-2xl p-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 transition-all animate-fadeIn">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-on-surface">Weekly Review</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-surface-container-high text-on-surface-variant">
                {retrospectiveProgress}/4 Prompts
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-on-surface-variant">
              <span className={workedWell.trim() ? 'text-emerald-600 font-semibold' : 'opacity-60'}>
                {workedWell.trim() ? '✓ Wins' : '○ Wins'}
              </span>
              <span>•</span>
              <span className={pushedBack.trim() ? 'text-emerald-600 font-semibold' : 'opacity-60'}>
                {pushedBack.trim() ? '✓ Slipped' : '○ Slipped'}
              </span>
              <span>•</span>
              <span className={onePriority.trim() ? 'text-emerald-600 font-semibold' : 'opacity-60'}>
                {onePriority.trim() ? '✓ Priority' : '○ Priority'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFinalizeConfirm(true)}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-label-md text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
        >
          <span>Finalize Week</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </aside>

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
