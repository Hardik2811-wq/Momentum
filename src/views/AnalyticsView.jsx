import React, { useState, useMemo } from 'react';
import ExecutiveHorizonLedger from '../components/executive/ExecutiveHorizonLedger';

export default function AnalyticsView({
  tasks = [],
  goals = [],
  habits = [],
  stats = {},
  focusSessions = [],
  onStartFocus,
  onOpenQuickAdd
}) {
  const [timeframe, setTimeframe] = useState('Month');
  const timeframes = ['Week', 'Month', 'Quarter', 'Year'];

  const {
    completionRate = 0,
    goalsOnTrack = 0,
    totalGoals = 0,
    completed = 0,
    pending = 0,
    longestStreak = 0,
    habitsCompletedToday = 0,
    totalHabits = 0,
    completedFocusMinutes = 0
  } = stats;

  // Real timeframe date filtering
  const now = Date.now();
  const tfDays = timeframe === 'Week' ? 7 : timeframe === 'Month' ? 30 : timeframe === 'Quarter' ? 90 : 365;
  const tfCutoff = now - tfDays * 86400000;
  const prevCutoff = now - 2 * tfDays * 86400000;

  // Filter tasks belonging to current period
  const periodTasks = useMemo(() => {
    return tasks.filter(t => {
      const ts = t.completedAt || t.createdAt || (t.plannedDate ? new Date(t.plannedDate).getTime() : 0);
      return !ts || ts >= tfCutoff;
    });
  }, [tasks, tfCutoff]);

  const periodCompleted = periodTasks.filter(t => t.completed).length;
  const periodTotal = periodTasks.length;
  const displayCompletionRate = periodTotal > 0
    ? Math.round((periodCompleted / periodTotal) * 100)
    : (tasks.length > 0 ? completionRate : 0);

  // Previous period comparison for real trend
  const prevPeriodTasks = useMemo(() => {
    return tasks.filter(t => {
      const ts = t.completedAt || t.createdAt || (t.plannedDate ? new Date(t.plannedDate).getTime() : 0);
      return ts >= prevCutoff && ts < tfCutoff;
    });
  }, [tasks, prevCutoff, tfCutoff]);

  const prevPeriodCompleted = prevPeriodTasks.filter(t => t.completed).length;
  const prevRate = prevPeriodTasks.length > 0 ? Math.round((prevPeriodCompleted / prevPeriodTasks.length) * 100) : 0;
  const rateDelta = displayCompletionRate - prevRate;
  const trendLabel = periodTotal === 0 ? '0% pacing' : rateDelta >= 0 ? `+${rateDelta}%` : `${rateDelta}%`;

  // Real Goal Velocity
  const displayVelocity = totalGoals > 0
    ? (Math.max(0.1, (goalsOnTrack / totalGoals) * (displayCompletionRate > 0 ? (displayCompletionRate / 50) : 1.0))).toFixed(1)
    : '0.0';
  const onTrackPercent = totalGoals > 0 ? Math.round((goalsOnTrack / totalGoals) * 100) : 0;

  // Real Peak Cognitive Hours calculated from focus sessions and planned task times
  const peakCognitiveWindow = useMemo(() => {
    const hourCounts = new Array(24).fill(0);
    let totalLogs = 0;

    (focusSessions || []).forEach(s => {
      if (s.timestamp) {
        const h = new Date(s.timestamp).getHours();
        if (h >= 0 && h < 24) {
          hourCounts[h] += 2;
          totalLogs++;
        }
      }
    });

    (tasks || []).forEach(t => {
      if (t.startTime) {
        const parts = t.startTime.split(':');
        const h = parseInt(parts[0], 10);
        if (!isNaN(h) && h >= 0 && h < 24) {
          hourCounts[h]++;
          totalLogs++;
        }
      }
    });

    if (totalLogs === 0) {
      return {
        label: '10:00 AM – 1:00 PM',
        sub: 'Optimal daylight deep work block',
        badge: 'Flow Ready'
      };
    }

    let bestSum = -1;
    let bestStart = 9;
    for (let h = 6; h <= 21; h++) {
      const sum = (hourCounts[h] || 0) + (hourCounts[(h + 1) % 24] || 0) + (hourCounts[(h + 2) % 24] || 0);
      if (sum > bestSum) {
        bestSum = sum;
        bestStart = h;
      }
    }

    const fmtHour = (hour) => {
      const h12 = hour % 12 || 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      return `${h12}:00 ${ampm}`;
    };

    const windowEnd = (bestStart + 3) % 24;
    return {
      label: `${fmtHour(bestStart)} – ${fmtHour(windowEnd)}`,
      sub: `${totalLogs} work sessions & tasks mapped`,
      badge: completedFocusMinutes >= 45 ? 'High Flow' : 'Active Flow'
    };
  }, [focusSessions, tasks, completedFocusMinutes]);

  // Real Life Balance Wheel (Radar Chart)
  const radarData = useMemo(() => {
    const hasData = tasks.length > 0 || goals.length > 0 || habits.length > 0;
    if (!hasData) {
      const cx = 160;
      const cy = 140;
      const r = 12;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI / 6);
        const x = (cx + r * Math.cos(angle)).toFixed(1);
        const y = (cy + r * Math.sin(angle)).toFixed(1);
        return { x, y, str: `${x},${y}` };
      });
      return {
        activePolygon: pts.map(p => p.str).join(' '),
        ghostPolygon: pts.map(p => p.str).join(' '),
        activePoints: pts,
        topCategory: 'Workspace Clean',
        topCategoryActive: false
      };
    }

    // 1. Career & Craft
    const careerTasks = tasks.filter(t => (t.areas && t.areas.includes('Career & Craft')) || t.category === 'career');
    const careerGoals = goals.filter(g => (g.categories && g.categories.includes('career')) || g.category === 'career');
    const careerComp = careerTasks.filter(t => t.completed).length;
    const careerVal = careerTasks.length > 0
      ? (careerComp / careerTasks.length)
      : (careerGoals.length > 0 ? (careerGoals[0].progress || 0) / 100 : 0);

    // 2. Deep Focus
    const focusTasks = tasks.filter(t => (t.areas && t.areas.includes('Deep Focus')) || t.priority === 'high');
    const focusComp = focusTasks.filter(t => t.completed).length;
    const focusVal = completedFocusMinutes > 0
      ? Math.min(1.0, completedFocusMinutes / 90)
      : (focusTasks.length > 0 ? focusComp / focusTasks.length : 0);

    // 3. Health & Body
    const healthTasks = tasks.filter(t => (t.areas && t.areas.includes('Health & Vitality')) || t.category === 'health');
    const healthHabits = habits.filter(h => h.colorToken === 'secondary' || (h.title && /run|gym|workout|cardio|sleep|water|hydrate/i.test(h.title)));
    const healthComp = healthTasks.filter(t => t.completed).length;
    const healthVal = healthHabits.length > 0
      ? Math.min(1.0, (habitsCompletedToday / habits.length) * 0.6 + (healthTasks.length > 0 ? (healthComp / healthTasks.length) * 0.4 : 0.3))
      : (healthTasks.length > 0 ? healthComp / healthTasks.length : 0);

    // 4. Mindfulness
    const mindHabits = habits.filter(h => /meditat|breath|wind-down|reflect|journal|read/i.test(h.title));
    const mindVal = mindHabits.length > 0
      ? (mindHabits.filter(h => (h.completedDays || []).includes(new Date().toISOString().slice(0, 10))).length / mindHabits.length)
      : (completedFocusMinutes > 0 ? 0.3 : 0);

    // 5. Habit Consistency
    const habitVal = totalHabits > 0
      ? Math.min(1.0, (longestStreak / 21) * 0.5 + (habitsCompletedToday / totalHabits) * 0.5)
      : 0;

    // 6. Creative & Expression
    const creativeTasks = tasks.filter(t => (t.areas && t.areas.includes('Creative & Expression')) || t.category === 'creative');
    const creativeGoals = goals.filter(g => (g.categories && g.categories.includes('creative')) || g.category === 'creative');
    const creativeComp = creativeTasks.filter(t => t.completed).length;
    const creativeVal = creativeTasks.length > 0
      ? (creativeComp / creativeTasks.length)
      : (creativeGoals.length > 0 ? (creativeGoals[0].progress || 0) / 100 : 0);

    // Determine Top Category
    const areaCounts = {
      'Career & Craft': careerTasks.length + careerGoals.length * 2,
      'Deep Focus': focusTasks.length + (completedFocusMinutes > 0 ? 2 : 0),
      'Health & Body': healthTasks.length + healthHabits.length * 2,
      'Creative & Expression': creativeTasks.length + creativeGoals.length * 2,
      'Habit Consistency': habits.length
    };
    const sortedAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedAreas[0]?.[1] > 0 ? sortedAreas[0][0] : 'General';

    const scale = (val) => Math.max(0.12, Math.min(0.95, val || 0.12));
    const values = [
      scale(careerVal),
      scale(focusVal),
      scale(healthVal),
      scale(mindVal),
      scale(habitVal),
      scale(creativeVal)
    ];

    const cx = 160;
    const cy = 140;
    const maxR = 100;

    const activePoints = values.map((val, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI / 6);
      const r = val * maxR;
      const x = (cx + r * Math.cos(angle)).toFixed(1);
      const y = (cy + r * Math.sin(angle)).toFixed(1);
      return { x, y, str: `${x},${y}` };
    });

    const ghostPoints = values.map((val, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI / 6);
      const r = Math.max(0.1, val * 0.75) * maxR;
      const x = (cx + r * Math.cos(angle)).toFixed(1);
      const y = (cy + r * Math.sin(angle)).toFixed(1);
      return `${x},${y}`;
    }).join(' ');

    return {
      activePolygon: activePoints.map(p => p.str).join(' '),
      ghostPolygon: ghostPoints,
      activePoints,
      topCategory,
      topCategoryActive: sortedAreas[0]?.[1] > 0
    };
  }, [tasks, goals, habits, habitsCompletedToday, longestStreak, totalHabits, completedFocusMinutes]);

  // Real Pending Backlog / Friction items
  const realPendingTasks = useMemo(() => {
    return tasks.filter(t => !t.completed).slice(0, 4);
  }, [tasks]);

  return (
    <main className="operational-page w-full pt-[calc(3.85rem+env(safe-area-inset-top))] md:pt-15 pb-24 sm:pb-12 px-3.5 sm:px-6 md:px-margin-desktop min-h-screen bg-canvas dark:bg-canvas-dark text-[#161618] dark:text-[#F7F6F2] transition-colors duration-200">
      <div className="flex flex-col w-full space-y-6 sm:space-y-10 max-w-[1440px] mx-auto">
        
        {/* Top Navigation & Context Bar */}
        <header className="command-masthead flex items-end justify-between gap-4 sm:gap-8 flex-wrap">
          <div className="flex flex-col">
            <h1 className="max-w-6xl font-editorial text-[clamp(2rem,4vw,3.25rem)] leading-[0.95] font-medium tracking-[-0.03em] text-[#161618] dark:text-[#F7F6F2]">Progress ledger</h1>
            <p className="mt-2 max-w-xl text-xs sm:text-sm leading-relaxed text-[#6B6A72] dark:text-[#8E8E93]">Read task completion, goal movement, habits, and focus as one operating rhythm.</p>
          </div>
          
          {/* Segmented Control Bar */}
          <div className="flex items-center border-y border-black/[0.08] dark:border-white/[0.1] py-1">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'text-[#0F52BA] dark:text-[#6495ED]'
                    : 'text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </header>

        {/* ── Executive Horizon Ledger: Cardless Cognitive Capacity & Burndown ── */}
        <ExecutiveHorizonLedger
          tasks={tasks}
          goals={goals}
          habits={habits}
        />

        {/* Row 1: High-Impact Metric Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          
          {/* Tile 1: Accuracy */}
          <div className="ledger-cell group relative overflow-hidden p-4 sm:p-5 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.025]">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#6B6A72] dark:text-[#8E8E93]">Execution Accuracy ({timeframe})</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-mono tabular-nums text-[28px] sm:text-[44px] leading-tight text-[#161618] dark:text-[#F7F6F2] font-bold tracking-tight">{displayCompletionRate}%</span>
                  <span className={`inline-flex items-center font-mono text-[10px] px-1.5 py-0.5 rounded-md ${
                    rateDelta >= 0 ? 'text-[#2E6F40] bg-[#2E6F40]/10 border border-[#2E6F40]/20' : 'text-[#C84B31] bg-[#C84B31]/10 border border-[#C84B31]/20'
                  }`}>
                    {rateDelta > 0 && <span className="material-symbols-outlined text-[12px] mr-0.5">arrow_upward</span>}
                    {rateDelta < 0 && <span className="material-symbols-outlined text-[12px] mr-0.5">arrow_downward</span>}
                    {trendLabel}
                  </span>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 border border-[#0F52BA]/20 flex items-center justify-center text-[#0F52BA]">
                <span className="material-symbols-outlined text-[18px] sm:text-[19px]" style={{ fontVariationSettings: '"FILL" 1' }}>timer</span>
              </div>
            </div>
            <div className="mt-2.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-start gap-2 text-[#6B6A72] dark:text-[#8E8E93]">
              <span className="material-symbols-outlined text-[15px] text-[#0F52BA] shrink-0 mt-0.5">lightbulb</span>
              <p className="font-sans text-xs leading-snug">
                {periodCompleted} of {periodTotal} deliverables verified across {timeframe.toLowerCase()}.
              </p>
            </div>
          </div>

          {/* Tile 2: Velocity */}
          <div className="ledger-cell group relative overflow-hidden p-4 sm:p-5 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.025]">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#6B6A72] dark:text-[#8E8E93]">Goal Velocity ({timeframe})</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-mono tabular-nums text-[28px] sm:text-[44px] leading-tight text-[#161618] dark:text-[#F7F6F2] font-bold tracking-tight">{displayVelocity}x</span>
                  <span className="font-mono text-[10px] text-[#6B6A72] dark:text-[#8E8E93]">cadence</span>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 border border-[#2E6F40]/20 flex items-center justify-center text-[#2E6F40]">
                <span className="material-symbols-outlined text-[18px] sm:text-[19px]" style={{ fontVariationSettings: '"FILL" 1' }}>speed</span>
              </div>
            </div>
            <div className="mt-2.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-[#6B6A72] dark:text-[#8E8E93]">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${totalGoals > 0 ? 'bg-[#2E6F40]' : 'bg-[#8E8E93]'}`} />
                <span className="font-sans text-xs">
                  {totalGoals > 0 ? `${goalsOnTrack} of ${totalGoals} goals active` : 'No active goals'}
                </span>
              </div>
              <span className="font-mono text-xs text-[#2E6F40] font-medium">
                {totalGoals > 0 ? `${onTrackPercent}% on-track` : '0% target'}
              </span>
            </div>
          </div>

          {/* Tile 3: Peak Cognitive Slot */}
          <div className="ledger-cell group relative overflow-hidden p-4 sm:p-5 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.025]">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#6B6A72] dark:text-[#8E8E93]">Peak Cognitive Hours</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-mono text-[20px] sm:text-[24px] leading-tight text-[#161618] dark:text-[#F7F6F2] font-bold tracking-tight">
                    {peakCognitiveWindow.label}
                  </span>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 border border-[#C84B31]/20 flex items-center justify-center text-[#C84B31] dark:text-rose-300">
                <span className="material-symbols-outlined text-[18px] sm:text-[19px]" style={{ fontVariationSettings: '"FILL" 1' }}>neurology</span>
              </div>
            </div>
            <div className="mt-2.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-[#6B6A72] dark:text-[#8E8E93]">
              <span className="font-sans text-xs truncate">
                {totalHabits > 0 ? `${habitsCompletedToday} of ${totalHabits} habits checked today` : peakCognitiveWindow.sub}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#161618] dark:text-[#F7F6F2] font-mono text-[10.5px] font-semibold shrink-0">
                {peakCognitiveWindow.badge}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Radar Chart & Real Backlog Diagnostics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          
          {/* LEFT: Life Balance Wheel Evolution */}
          <div className="lg:col-span-6 bg-white/80 dark:bg-[#18181C]/80 rounded-2xl p-5 sm:p-6 border border-black/[0.08] dark:border-white/[0.08] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-editorial text-lg sm:text-xl font-normal text-[#161618] dark:text-[#F7F6F2]">Life Balance Wheel Evolution</h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0F52BA]"></span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#6B6A72] dark:text-[#8E8E93]">Current</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#8E8E93]"></span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#6B6A72] dark:text-[#8E8E93]">Baseline</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#6B6A72] dark:text-[#8E8E93] mb-2">
                Dynamic multi-axis distribution across your goals, habits, and focus sprints
              </p>
            </div>
            
            {/* Dynamic Radar Chart SVG */}
            <div className="relative w-full flex items-center justify-center py-4">
              <svg className="w-full max-w-[340px] overflow-visible" viewBox="0 0 320 280">
                <circle className="stroke-black/10 dark:stroke-white/10" cx="160" cy="140" fill="none" r="100" strokeDasharray="2 2" strokeWidth="1" />
                <circle className="stroke-black/10 dark:stroke-white/10" cx="160" cy="140" fill="none" r="65" strokeWidth="1" />
                <circle className="stroke-black/10 dark:stroke-white/10" cx="160" cy="140" fill="none" r="30" strokeWidth="1" />
                
                <line className="stroke-black/10 dark:stroke-white/10" strokeWidth="1" x1="160" x2="160" y1="40" y2="240" />
                <line className="stroke-black/10 dark:stroke-white/10" strokeWidth="1" x1="73" x2="247" y1="90" y2="190" />
                <line className="stroke-black/10 dark:stroke-white/10" strokeWidth="1" x1="73" x2="247" y1="190" y2="90" />
                
                {/* Baseline Ghost Polygon */}
                <polygon fill="rgba(142, 142, 147, 0.12)" points={radarData.ghostPolygon} stroke="#8E8E93" strokeLinejoin="round" strokeWidth="1.5" />
                
                {/* Active Dynamic Polygon */}
                <polygon fill="rgba(15, 82, 186, 0.2)" points={radarData.activePolygon} stroke="#0F52BA" strokeLinejoin="round" strokeWidth="2" />
                
                {/* Active Dynamic Markers */}
                {radarData.activePoints.map((pt, idx) => (
                  <circle key={idx} cx={pt.x} cy={pt.y} fill="#0F52BA" r="4" className="shadow-sm transition-all duration-500" />
                ))}
                
                {/* Axis Labels */}
                <text className="font-mono text-[10.5px] fill-[#161618] dark:fill-[#F7F6F2] font-semibold" textAnchor="middle" x="160" y="25">Career &amp; Craft</text>
                <text className="font-mono text-[10px] fill-[#6B6A72] dark:fill-[#8E8E93]" textAnchor="start" x="255" y="95">Deep Focus</text>
                <text className="font-mono text-[10px] fill-[#6B6A72] dark:fill-[#8E8E93]" textAnchor="start" x="245" y="205">Health &amp; Body</text>
                <text className="font-mono text-[10px] fill-[#6B6A72] dark:fill-[#8E8E93]" textAnchor="middle" x="160" y="255">Mindfulness</text>
                <text className="font-mono text-[10px] fill-[#6B6A72] dark:fill-[#8E8E93]" textAnchor="end" x="65" y="205">Habit Consistency</text>
                <text className="font-mono text-[10px] fill-[#6B6A72] dark:fill-[#8E8E93]" textAnchor="end" x="65" y="95">Creative</text>
              </svg>
            </div>
            
            {/* Summary pills */}
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <div className="p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#202024] border border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between">
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#6B6A72] dark:text-[#8E8E93]">Top Focus</span>
                  <span className="text-[12.5px] text-[#161618] dark:text-[#F7F6F2] font-semibold truncate">{radarData.topCategory}</span>
                </div>
                <span className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${radarData.topCategoryActive ? 'bg-[#0F52BA]/10 text-[#0F52BA] dark:text-blue-400' : 'bg-black/[0.04] text-[#8E8E93]'}`}>
                  {radarData.topCategoryActive ? 'Active' : 'Idle'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#202024] border border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between">
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#6B6A72] dark:text-[#8E8E93]">Habit Engine</span>
                  <span className="font-mono text-[12.5px] text-[#161618] dark:text-[#F7F6F2] font-semibold">{longestStreak} Day Streak</span>
                </div>
                <span className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${longestStreak > 0 ? 'bg-[#2E6F40]/10 text-[#2E6F40] dark:text-emerald-400' : 'bg-black/[0.04] text-[#8E8E93]'}`}>
                  {longestStreak > 0 ? 'Live' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Real Uncompleted Friction Tasks & Action Bridge */}
          <div className="lg:col-span-6 bg-white/80 dark:bg-[#18181C]/80 rounded-2xl p-5 sm:p-6 border border-black/[0.08] dark:border-white/[0.08] shadow-2xs flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[19px] text-[#C84B31]">alt_route</span>
                  <h2 className="font-editorial text-lg sm:text-xl font-normal text-[#161618] dark:text-[#F7F6F2]">Active Friction &amp; Backlog</h2>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono text-[10px] font-bold">
                  {realPendingTasks.length} Pending
                </span>
              </div>
              <p className="text-xs text-[#6B6A72] dark:text-[#8E8E93] mb-4">
                Uncompleted tasks carry mental friction. Launch directly into a Focus Sprint to clear cognitive load.
              </p>
              
              {/* If no pending tasks: High-Utility Empty State */}
              {realPendingTasks.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#F7F6F2] dark:bg-[#202024] border border-black/[0.06] dark:border-white/[0.07] flex flex-col items-center justify-center text-center space-y-2.5 my-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <span className="material-symbols-outlined text-[20px]">task_alt</span>
                  </div>
                  <h4 className="font-editorial text-base font-normal text-[#161618] dark:text-[#F7F6F2]">Zero cognitive friction</h4>
                  <p className="text-xs text-[#6B6A72] dark:text-[#8E8E93] max-w-xs">
                    All tasks are completed or your queue is clear. Create a new deliverable to start a focus sprint.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenQuickAdd?.()}
                    className="mt-1 px-3.5 py-1.5 rounded-xl bg-[#161618] dark:bg-[#F7F6F2] hover:bg-[#2A2A2E] dark:hover:bg-white text-white dark:text-[#161618] text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Create Deliverable</span>
                  </button>
                </div>
              ) : (
                /* Dynamic Friction Task Cards */
                <div className="space-y-2">
                  {realPendingTasks.map((task) => {
                    const areaName = (task.areas && task.areas[0]) || task.category || 'General';
                    return (
                      <div key={task.id} className="p-3 rounded-xl bg-[#F7F6F2] dark:bg-[#202024] hover:border-black/[0.14] dark:hover:border-white/[0.14] border border-black/[0.06] dark:border-white/[0.07] transition-colors flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              task.priority === 'high' ? 'bg-[#C84B31]' : 'bg-amber-400'
                            }`} />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13px] text-[#161618] dark:text-[#F7F6F2] font-medium truncate">{task.title}</span>
                              <span className="font-mono text-[10.5px] text-[#6B6A72] dark:text-[#8E8E93]">
                                {areaName} · {task.priority ? task.priority.toUpperCase() : 'NORMAL'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Functional Focus Button */}
                          <button
                            type="button"
                            onClick={() => onStartFocus?.(task.id)}
                            className="shrink-0 px-2.5 py-1 bg-[#0F52BA] hover:bg-[#003EA8] text-white rounded-lg font-mono text-[11px] font-semibold transition active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Start deep work sprint on this task"
                          >
                            <span className="material-symbols-outlined text-[13px]">play_arrow</span>
                            <span>Focus</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-3 flex items-center justify-between text-[#6B6A72] dark:text-[#8E8E93] border-t border-black/[0.06] dark:border-white/[0.06]">
              <span className="font-mono text-[10.5px]">Linked to live task queue</span>
              <span className="font-mono text-[10.5px] font-semibold text-[#0F52BA] dark:text-blue-400 flex items-center gap-0.5">
                <span>Auto-tracked from store</span>
              </span>
            </div>
          </div>
        </div>

        {/* Row 3: Real Milestone Awards & Records */}
        <div className="bg-white/80 dark:bg-[#18181C]/80 rounded-2xl p-5 sm:p-6 border border-black/[0.08] dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-editorial text-lg sm:text-xl font-normal text-[#161618] dark:text-[#F7F6F2]">Milestone Awards &amp; Records</h2>
              <p className="text-xs text-[#6B6A72] dark:text-[#8E8E93] mt-0.5">Recognitions earned through consistent execution standards</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Badge 1: Real Streak */}
            <div className="relative overflow-hidden rounded-xl bg-[#F7F6F2] dark:bg-[#202024] p-5 border border-black/[0.06] dark:border-white/[0.07] flex flex-col items-center text-center shadow-2xs hover:border-black/[0.12] dark:hover:border-white/[0.14] transition-all group">
              <div className="relative w-20 h-20 mb-3 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-[#0F52BA]/10 border border-[#0F52BA]/25 flex items-center justify-center text-[#0F52BA] shadow-xs">
                  <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: '"FILL" 1' }}>local_fire_department</span>
                </div>
                <div className="absolute -bottom-1 bg-white dark:bg-[#18181C] px-2 py-0.5 rounded-full border border-black/[0.08] dark:border-white/[0.08] shadow-xs">
                  <span className="font-mono text-[10px] font-bold text-[#0F52BA] tracking-wide">{longestStreak} DAYS</span>
                </div>
              </div>
              <h3 className="font-editorial text-base font-normal text-[#161618] dark:text-[#F7F6F2] mt-1">Streak Master</h3>
              <p className="text-xs text-[#6B6A72] dark:text-[#8E8E93] mt-1">Consecutive days logging uninterrupted deep work sessions.</p>
              <span className={`mt-3 font-mono text-[10px] uppercase font-bold tracking-wider ${longestStreak > 0 ? 'text-[#2E6F40] dark:text-emerald-400' : 'text-[#8E8E93]'}`}>
                {longestStreak > 0 ? 'Active Record · Current' : 'Awaiting First Streak'}
              </span>
            </div>
            
            {/* Badge 2: Real Tasks Completed */}
            <div className="relative overflow-hidden rounded-xl bg-[#F7F6F2] dark:bg-[#202024] p-5 border border-black/[0.06] dark:border-white/[0.07] flex flex-col items-center text-center shadow-2xs hover:border-black/[0.12] dark:hover:border-white/[0.14] transition-all group">
              <div className="relative w-20 h-20 mb-3 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-[#2E6F40]/10 border border-[#2E6F40]/25 flex items-center justify-center text-[#2E6F40] shadow-xs">
                  <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: '"FILL" 1' }}>workspace_premium</span>
                </div>
                <div className="absolute -bottom-1 bg-white dark:bg-[#18181C] px-2 py-0.5 rounded-full border border-black/[0.08] dark:border-white/[0.08] shadow-xs">
                  <span className="font-mono text-[10px] font-bold text-[#2E6F40] tracking-wide">{completed} DONE</span>
                </div>
              </div>
              <h3 className="font-editorial text-base font-normal text-[#161618] dark:text-[#F7F6F2] mt-1">Execution Velocity</h3>
              <p className="text-xs text-[#6B6A72] dark:text-[#8E8E93] mt-1">Strategic deliverables completed and verified.</p>
              <span className={`mt-3 font-mono text-[10px] uppercase font-bold tracking-wider ${completed > 0 ? 'text-[#2E6F40] dark:text-emerald-400' : 'text-[#8E8E93]'}`}>
                {completed > 0 ? 'Live Milestone' : 'Awaiting First Complete'}
              </span>
            </div>
            
            {/* Badge 3: Real Consistency */}
            <div className="relative overflow-hidden rounded-xl bg-[#F7F6F2] dark:bg-[#202024] p-5 border border-black/[0.06] dark:border-white/[0.07] flex flex-col items-center text-center shadow-2xs hover:border-black/[0.12] dark:hover:border-white/[0.14] transition-all group">
              <div className="relative w-20 h-20 mb-3 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/25 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-xs">
                  <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: '"FILL" 1' }}>verified</span>
                </div>
                <div className="absolute -bottom-1 bg-white dark:bg-[#18181C] px-2 py-0.5 rounded-full border border-black/[0.08] dark:border-white/[0.08] shadow-xs">
                  <span className="font-mono text-[10px] font-bold text-violet-600 dark:text-violet-400 tracking-wide">{Math.round(completionRate)}% RATE</span>
                </div>
              </div>
              <h3 className="font-editorial text-base font-normal text-[#161618] dark:text-[#F7F6F2] mt-1">Consistency Standard</h3>
              <p className="text-xs text-[#6B6A72] dark:text-[#8E8E93] mt-1">Pacing against planned daily and weekly cognitive targets.</p>
              <span className={`mt-3 font-mono text-[10px] uppercase font-bold tracking-wider ${completionRate > 0 ? 'text-[#161618] dark:text-[#F7F6F2]' : 'text-[#8E8E93]'}`}>
                {completionRate >= 80 ? 'Mastery Pace' : completionRate > 0 ? 'Active Target' : 'Target Ready'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
