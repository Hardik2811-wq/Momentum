import React, { useState, useMemo } from 'react';

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
    <main className="w-full pt-16 md:pt-12 px-4 sm:px-6 md:px-margin-desktop py-4 sm:py-gutter-xl min-h-screen bg-surface">
      <div className="flex flex-col w-full space-y-4 sm:space-y-gutter-xl">
        
        {/* Top Navigation & Context Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-gutter-base">
          <div className="flex flex-col">
            <div className="flex items-center gap-gutter-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
              <span>Executive Insights</span>
              <span className="text-outline-variant">•</span>
              <span className="text-primary font-label-sm text-label-sm">Updated Live</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-0.5">Focus &amp; Cognitive Flow</h1>
          </div>
          
          {/* Segmented Control Bar */}
          <div className="flex items-center bg-surface-container p-1 rounded-full self-start md:self-auto shadow-sm">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-gutter-md py-1 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-surface-container-lowest text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Row 1: High-Impact Metric Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-base">
          
          {/* Tile 1: Accuracy */}
          <div className="group relative overflow-hidden bg-surface-container-lowest rounded-2xl p-gutter-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface-variant">Execution Accuracy ({timeframe})</span>
                <div className="flex items-baseline gap-gutter-xs mt-1">
                  <span className="font-display text-[44px] leading-tight text-on-surface font-semibold tracking-tight">{displayCompletionRate}%</span>
                  <span className={`inline-flex items-center font-label-sm text-label-sm px-1.5 py-0.5 rounded-full ${
                    rateDelta >= 0 ? 'text-secondary bg-secondary-container/30' : 'text-amber-600 bg-amber-50'
                  }`}>
                    {rateDelta > 0 && <span className="material-symbols-outlined text-[12px] mr-0.5">arrow_upward</span>}
                    {rateDelta < 0 && <span className="material-symbols-outlined text-[12px] mr-0.5">arrow_downward</span>}
                    {trendLabel}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>timer</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container/60 flex items-start gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-tertiary shrink-0 mt-0.5">lightbulb</span>
              <p className="font-body-sm text-body-sm leading-snug">
                {periodCompleted} of {periodTotal} deliverables verified across {timeframe.toLowerCase()}.
              </p>
            </div>
          </div>

          {/* Tile 2: Velocity */}
          <div className="group relative overflow-hidden bg-surface-container-lowest rounded-2xl p-gutter-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface-variant">Goal Velocity ({timeframe})</span>
                <div className="flex items-baseline gap-gutter-xs mt-1">
                  <span className="font-display text-[44px] leading-tight text-on-surface font-semibold tracking-tight">{displayVelocity}x</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">cadence</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-secondary-fixed/50 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>speed</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container/60 flex items-center justify-between text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${totalGoals > 0 ? 'bg-secondary' : 'bg-outline-variant'}`}></span>
                <span className="font-body-sm text-body-sm">
                  {totalGoals > 0 ? `${goalsOnTrack} of ${totalGoals} goals active` : 'No active goals'}
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-secondary font-medium">
                {totalGoals > 0 ? `${onTrackPercent}% on-track` : '0% target'}
              </span>
            </div>
          </div>

          {/* Tile 3: Peak Cognitive Slot */}
          <div className="group relative overflow-hidden bg-surface-container-lowest rounded-2xl p-gutter-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface-variant">Peak Cognitive Hours</span>
                <div className="flex items-baseline gap-gutter-xs mt-1">
                  <span className="font-title text-[22px] sm:text-[24px] leading-tight text-on-surface font-semibold tracking-tight">
                    {peakCognitiveWindow.label}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-tertiary-fixed flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>neurology</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container/60 flex items-center justify-between text-on-surface-variant">
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {totalHabits > 0 ? `${habitsCompletedToday} of ${totalHabits} habits checked today` : peakCognitiveWindow.sub}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-[11px] font-semibold shrink-0">
                {peakCognitiveWindow.badge}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Radar Chart & Real Backlog Diagnostics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-base">
          
          {/* LEFT: Life Balance Wheel Evolution */}
          <div className="lg:col-span-6 bg-surface-container-lowest rounded-2xl p-gutter-xl shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-title text-title text-on-surface">Life Balance Wheel Evolution</h2>
                <div className="flex items-center gap-gutter-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                    <span className="font-caption text-caption text-on-surface-variant">Current</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-outline-variant"></span>
                    <span className="font-caption text-caption text-on-surface-variant">Baseline</span>
                  </div>
                </div>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-2">
                Dynamic multi-axis distribution across your goals, habits, and focus sprints
              </p>
            </div>
            
            {/* Dynamic Radar Chart SVG */}
            <div className="relative w-full flex items-center justify-center py-4">
              <svg className="w-full max-w-[340px] overflow-visible" viewBox="0 0 320 280">
                <circle className="text-surface-container" cx="160" cy="140" fill="none" r="100" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1" />
                <circle className="text-surface-container" cx="160" cy="140" fill="none" r="65" stroke="currentColor" strokeWidth="1" />
                <circle className="text-surface-container" cx="160" cy="140" fill="none" r="30" stroke="currentColor" strokeWidth="1" />
                
                <line className="text-surface-container-high" stroke="currentColor" strokeWidth="1" x1="160" x2="160" y1="40" y2="240" />
                <line className="text-surface-container-high" stroke="currentColor" strokeWidth="1" x1="73" x2="247" y1="90" y2="190" />
                <line className="text-surface-container-high" stroke="currentColor" strokeWidth="1" x1="73" x2="247" y1="190" y2="90" />
                
                {/* Baseline Ghost Polygon */}
                <polygon fill="rgba(193, 198, 214, 0.2)" points={radarData.ghostPolygon} stroke="#c1c6d6" strokeLinejoin="round" strokeWidth="1.5" />
                
                {/* Active Dynamic Polygon */}
                <polygon fill="rgba(10, 132, 255, 0.22)" points={radarData.activePolygon} stroke="#0A84FF" strokeLinejoin="round" strokeWidth="2.5" />
                
                {/* Active Dynamic Markers */}
                {radarData.activePoints.map((pt, idx) => (
                  <circle key={idx} cx={pt.x} cy={pt.y} fill="#0A84FF" r="4.5" className="shadow-sm transition-all duration-500" />
                ))}
                
                {/* Axis Labels */}
                <text className="font-caption text-[11px] fill-on-surface font-semibold" textAnchor="middle" x="160" y="25">Career &amp; Craft</text>
                <text className="font-caption text-[11px] fill-on-surface-variant font-medium" textAnchor="start" x="255" y="95">Deep Focus</text>
                <text className="font-caption text-[11px] fill-on-surface-variant font-medium" textAnchor="start" x="245" y="205">Health &amp; Body</text>
                <text className="font-caption text-[11px] fill-on-surface-variant font-medium" textAnchor="middle" x="160" y="255">Mindfulness</text>
                <text className="font-caption text-[11px] fill-on-surface-variant font-medium" textAnchor="end" x="65" y="205">Habit Consistency</text>
                <text className="font-caption text-[11px] fill-on-surface-variant font-medium" textAnchor="end" x="65" y="95">Creative</text>
              </svg>
            </div>
            
            {/* Summary pills */}
            <div className="grid grid-cols-2 gap-gutter-sm mt-3 pt-3 border-t border-surface-container/60">
              <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-caption text-caption text-on-surface-variant">Top Focus</span>
                  <span className="font-label-md text-label-md text-on-surface font-medium truncate">{radarData.topCategory}</span>
                </div>
                <span className={`font-label-md text-label-md font-semibold ${radarData.topCategoryActive ? 'text-secondary' : 'text-outline-variant'}`}>
                  {radarData.topCategoryActive ? 'Active' : 'Idle'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-caption text-caption text-on-surface-variant">Habit Engine</span>
                  <span className="font-label-md text-label-md text-on-surface font-medium">{longestStreak} Day Streak</span>
                </div>
                <span className={`font-label-md text-label-md font-medium ${longestStreak > 0 ? 'text-primary' : 'text-outline-variant'}`}>
                  {longestStreak > 0 ? 'Live' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Real Uncompleted Friction Tasks & Action Bridge */}
          <div className="lg:col-span-6 bg-surface-container-lowest rounded-2xl p-gutter-xl shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-tertiary">alt_route</span>
                  <h2 className="font-title text-title text-on-surface">Active Friction &amp; Backlog</h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-caption text-caption font-medium">
                  {realPendingTasks.length} Pending
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                Uncompleted tasks carry mental friction. Launch directly into a Focus Sprint to clear cognitive load.
              </p>
              
              {/* If no pending tasks: High-Utility Empty State */}
              {realPendingTasks.length === 0 ? (
                <div className="p-6 rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center space-y-2.5 my-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">task_alt</span>
                  </div>
                  <h4 className="font-semibold text-sm text-on-surface">Zero cognitive friction</h4>
                  <p className="text-xs text-on-surface-variant max-w-xs">
                    All tasks are completed or your queue is clear. Create a new deliverable to start a focus sprint.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenQuickAdd?.()}
                    className="mt-1 px-3.5 py-1.5 rounded-lg bg-[#1A1B1F] hover:bg-black text-white text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Create Deliverable</span>
                  </button>
                </div>
              ) : (
                /* Dynamic Friction Task Cards */
                <div className="space-y-gutter-sm">
                  {realPendingTasks.map((task) => {
                    const areaName = (task.areas && task.areas[0]) || task.category || 'General';
                    return (
                      <div key={task.id} className="p-gutter-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              task.priority === 'high' ? 'bg-red-500' : 'bg-amber-400'
                            }`} />
                            <div className="flex flex-col min-w-0">
                              <span className="font-label-md text-label-md text-on-surface font-medium truncate">{task.title}</span>
                              <span className="font-caption text-caption text-on-surface-variant">
                                Area: {areaName} • Priority: {task.priority || 'normal'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Functional Focus Button */}
                          <button
                            type="button"
                            onClick={() => onStartFocus?.(task.id)}
                            className="shrink-0 px-2.5 py-1 bg-surface-container-lowest hover:bg-[#0A84FF] hover:text-white text-[#0A84FF] border border-black/[0.06] rounded-full font-label-sm text-[11px] font-semibold transition active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Start deep work sprint on this task"
                          >
                            <span className="material-symbols-outlined text-[13px]">play_arrow</span>
                            <span>Start Focus</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-3 flex items-center justify-between text-on-surface-variant border-t border-surface-container/60">
              <span className="font-caption text-caption">Linked to live task queue</span>
              <span className="font-label-sm text-label-sm text-primary flex items-center gap-0.5">
                <span>Auto-tracked from store</span>
              </span>
            </div>
          </div>
        </div>

        {/* Row 3: Real Milestone Awards & Records */}
        <div className="bg-surface-container-lowest rounded-2xl p-gutter-xl shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-title text-title text-on-surface">Milestone Awards &amp; Records</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Recognitions earned through consistent execution standards</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-base">
            
            {/* Badge 1: Real Streak */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-surface-container-low p-gutter-lg flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all group">
              <div className="relative w-24 h-24 mb-3 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-b from-primary-container to-primary flex items-center justify-center shadow-[0_4px_16px_rgba(0,113,227,0.35)] text-on-primary">
                  <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>local_fire_department</span>
                </div>
                <div className="absolute -bottom-1 bg-surface-container-lowest px-2 py-0.5 rounded-full shadow-sm">
                  <span className="font-caption text-[11px] font-bold text-primary tracking-wide">{longestStreak} DAYS</span>
                </div>
              </div>
              <h3 className="font-title text-title text-on-surface mt-1">Streak Master</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Consecutive days logging uninterrupted deep work sessions.</p>
              <span className={`mt-3 font-caption text-caption font-semibold ${longestStreak > 0 ? 'text-secondary' : 'text-outline-variant'}`}>
                {longestStreak > 0 ? 'Active Record • Current' : 'Awaiting First Streak'}
              </span>
            </div>
            
            {/* Badge 2: Real Tasks Completed */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-surface-container-low p-gutter-lg flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all group">
              <div className="relative w-24 h-24 mb-3 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-b from-secondary to-on-secondary-fixed-variant flex items-center justify-center shadow-[0_4px_16px_rgba(0,110,40,0.3)] text-on-secondary">
                  <span className="material-symbols-outlined text-[34px]" style={{ fontVariationSettings: '"FILL" 1' }}>workspace_premium</span>
                </div>
                <div className="absolute -bottom-1 bg-surface-container-lowest px-2 py-0.5 rounded-full shadow-sm">
                  <span className="font-caption text-[11px] font-bold text-secondary tracking-wide">{completed} DONE</span>
                </div>
              </div>
              <h3 className="font-title text-title text-on-surface mt-1">Execution Velocity</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Strategic deliverables completed and verified.</p>
              <span className={`mt-3 font-caption text-caption ${completed > 0 ? 'text-on-surface-variant' : 'text-outline-variant'}`}>
                {completed > 0 ? 'Live Milestone' : 'Awaiting First Complete'}
              </span>
            </div>
            
            {/* Badge 3: Real Consistency */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-surface-container-low p-gutter-lg flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all group">
              <div className="relative w-24 h-24 mb-3 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-b from-tertiary-container to-tertiary flex items-center justify-center shadow-[0_4px_16px_rgba(75,73,201,0.3)] text-on-tertiary">
                  <span className="material-symbols-outlined text-[34px]" style={{ fontVariationSettings: '"FILL" 1' }}>verified</span>
                </div>
                <div className="absolute -bottom-1 bg-surface-container-lowest px-2 py-0.5 rounded-full shadow-sm">
                  <span className="font-caption text-[11px] font-bold text-tertiary tracking-wide">{Math.round(completionRate)}% RATE</span>
                </div>
              </div>
              <h3 className="font-title text-title text-on-surface mt-1">Consistency Standard</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Pacing against planned daily and weekly cognitive targets.</p>
              <span className={`mt-3 font-caption text-caption ${completionRate > 0 ? 'text-on-surface-variant' : 'text-outline-variant'}`}>
                {completionRate >= 80 ? 'Mastery Pace' : completionRate > 0 ? 'Active Target' : 'Target Ready'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
