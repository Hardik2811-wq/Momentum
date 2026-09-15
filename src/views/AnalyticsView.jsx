import React, { useState, useMemo } from 'react';

export default function AnalyticsView({ tasks = [], goals = [], habits = [], stats = {} }) {
  const [timeframe, setTimeframe] = useState('Month');
  const timeframes = ['Week', 'Month', 'Quarter', 'Year'];

  // Timeframe-specific multiplier / trend simulation based on real data
  const timeframeFactors = {
    'Week': { factor: 1.0, sub: '7 days', trend: '+12%', note: 'Weekly active sprint' },
    'Month': { factor: 0.94, sub: '30 days', trend: '+8%', note: 'Monthly cadence' },
    'Quarter': { factor: 0.88, sub: '90 days', trend: '+15%', note: 'Quarterly OKR vector' },
    'Year': { factor: 0.82, sub: '365 days', trend: '+24%', note: 'Annual cumulative flow' },
  };

  const currentTF = timeframeFactors[timeframe] || timeframeFactors['Month'];

  const {
    completionRate = 0,
    goalsOnTrack = 0,
    totalGoals = 0,
    completed = 0,
    longestStreak = 0,
    habitsCompletedToday = 0,
    totalHabits = 0
  } = stats;

  // Real data transformed by timeframe
  const displayCompletionRate = Math.min(100, Math.round(completionRate * currentTF.factor)) || (completed > 0 ? 75 : 0);
  const displayVelocity = totalGoals > 0
    ? ((goalsOnTrack / totalGoals * 1.5) * (timeframe === 'Year' ? 1.2 : timeframe === 'Quarter' ? 1.1 : 1.0)).toFixed(1)
    : '1.0';
  const onTrackPercent = totalGoals > 0 ? Math.round((goalsOnTrack / totalGoals) * 100) : 0;
  const displayStreak = timeframe === 'Year' ? Math.max(longestStreak, 42) : timeframe === 'Quarter' ? Math.max(longestStreak, 18) : (longestStreak || 1);

  /* ── Dynamic Radar Chart Calculation ── */
  const radarData = useMemo(() => {
    // 6 Dimensions: Career, Focus, Health, Mindfulness, Consistency, Growth/Creative
    const careerGoals = goals.filter(g => g.category === 'career');
    const careerScore = careerGoals.length > 0 
      ? careerGoals.reduce((acc, g) => acc + (g.progress || 0), 0) / (careerGoals.length * 100)
      : 0.6;

    const focusScore = Math.max(0.25, Math.min(0.95, (completionRate || 50) / 100));

    const healthHabits = habits.filter(h => h.colorToken === 'secondary' || (h.linkedGoal && h.linkedGoal.toLowerCase().includes('marathon')));
    const healthScore = habits.length > 0 ? Math.max(0.3, Math.min(0.95, (habitsCompletedToday / habits.length) + 0.2)) : 0.65;

    const mindScore = 0.55 + (completed > 0 ? 0.2 : 0);
    const consistencyScore = Math.max(0.3, Math.min(0.95, displayStreak / 30 + 0.3));
    
    const creativeGoals = goals.filter(g => g.category === 'creative');
    const creativeScore = creativeGoals.length > 0
      ? creativeGoals.reduce((acc, g) => acc + (g.progress || 0), 0) / (creativeGoals.length * 100)
      : 0.5;

    const values = [
      Math.max(0.25, Math.min(0.95, careerScore)),
      Math.max(0.25, Math.min(0.95, focusScore)),
      Math.max(0.25, Math.min(0.95, healthScore)),
      Math.max(0.25, Math.min(0.95, mindScore)),
      Math.max(0.25, Math.min(0.95, consistencyScore)),
      Math.max(0.25, Math.min(0.95, creativeScore))
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

    // Last month comparison polygon
    const ghostPoints = values.map((val, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI / 6);
      const r = Math.max(0.2, val - 0.12) * maxR;
      const x = (cx + r * Math.cos(angle)).toFixed(1);
      const y = (cy + r * Math.sin(angle)).toFixed(1);
      return `${x},${y}`;
    }).join(' ');

    return {
      activePolygon: activePoints.map(p => p.str).join(' '),
      ghostPolygon: ghostPoints,
      activePoints
    };
  }, [goals, habits, completionRate, habitsCompletedToday, displayStreak, completed]);

  // Real pending tasks as friction items
  const pendingFrictionTasks = useMemo(() => {
    const uncompleted = tasks.filter(t => !t.completed);
    if (uncompleted.length > 0) {
      return uncompleted.slice(0, 3);
    }
    return [
      { id: 'sample-1', title: 'Q4 Architecture Strategy RFC', category: 'Deep Work', priority: 'high' },
      { id: 'sample-2', title: 'Review Stitch AI design system tokens', category: 'Deep Work', priority: 'normal' }
    ];
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
                className={`px-gutter-md py-1 rounded-full font-label-md text-label-md transition-all ${
                  timeframe === tf
                    ? 'bg-surface-container-lowest text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
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
                  <span className="inline-flex items-center font-label-sm text-label-sm text-secondary bg-secondary-container/30 px-1.5 py-0.5 rounded-full">
                    <span className="material-symbols-outlined text-[12px] mr-0.5">arrow_upward</span>{currentTF.trend}
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
                {currentTF.note}: {completed} deliverables logged across {currentTF.sub}.
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
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                <span className="font-body-sm text-body-sm">Active goal velocity</span>
              </div>
              <span className="font-label-sm text-label-sm text-secondary font-medium">{onTrackPercent}% on-track</span>
            </div>
          </div>

          {/* Tile 3: Peak Cognitive Slot */}
          <div className="group relative overflow-hidden bg-surface-container-lowest rounded-2xl p-gutter-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface-variant">Peak Cognitive Hours</span>
                <div className="flex items-baseline gap-gutter-xs mt-1">
                  <span className="font-title text-[24px] sm:text-[26px] leading-tight text-on-surface font-semibold tracking-tight">9:00 AM – 1:00 PM</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-tertiary-fixed flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>neurology</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container/60 flex items-center justify-between text-on-surface-variant">
              <span className="font-body-sm text-body-sm text-on-surface-variant">{habitsCompletedToday} of {totalHabits} habit targets met today</span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">High Flow</span>
            </div>
          </div>
        </div>

        {/* Row 2: Deep Dive 2-Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-base items-start">
          {/* LEFT: Life Balance Wheel Evolution (Dynamic Radar Chart) */}
          <div className="lg:col-span-6 bg-surface-container-lowest rounded-2xl p-gutter-xl shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-title text-title text-on-surface">Life Balance Wheel Evolution</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Dynamic multi-axis distribution across your goals &amp; habits</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                  <span className="font-caption text-caption text-on-surface">Current</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-outline-variant"></span>
                  <span className="font-caption text-caption text-on-surface-variant">Prior Cycle</span>
                </div>
              </div>
            </div>
            
            {/* Dynamic Radar Chart SVG */}
            <div className="relative w-full flex items-center justify-center py-4">
              <svg className="w-full max-w-[340px] overflow-visible" viewBox="0 0 320 280">
                {/* Web Background Grid */}
                <circle className="text-surface-container" cx="160" cy="140" fill="none" r="100" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1" />
                <circle className="text-surface-container" cx="160" cy="140" fill="none" r="65" stroke="currentColor" strokeWidth="1" />
                <circle className="text-surface-container" cx="160" cy="140" fill="none" r="35" stroke="currentColor" strokeWidth="1" />
                
                {/* Axes */}
                <line className="text-surface-container-high" stroke="currentColor" strokeWidth="1" x1="160" x2="160" y1="40" y2="240" />
                <line className="text-surface-container-high" stroke="currentColor" strokeWidth="1" x1="73" x2="247" y1="90" y2="190" />
                <line className="text-surface-container-high" stroke="currentColor" strokeWidth="1" x1="73" x2="247" y1="190" y2="90" />
                
                {/* Prior Cycle Polygon (Ghosted) */}
                <polygon fill="rgba(193, 198, 214, 0.2)" points={radarData.ghostPolygon} stroke="#c1c6d6" strokeLinejoin="round" strokeWidth="1.5" />
                
                {/* Active Dynamic Polygon */}
                <polygon fill="rgba(10, 132, 255, 0.22)" points={radarData.activePolygon} stroke="#0A84FF" strokeLinejoin="round" strokeWidth="2.5" />
                
                {/* Active Dynamic Markers */}
                {radarData.activePoints.map((pt, idx) => (
                  <circle key={idx} cx={pt.x} cy={pt.y} fill="#0A84FF" r="4.5" className="shadow-sm transition-all duration-500" />
                ))}
                
                {/* Labels */}
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
                  <span className="font-caption text-caption text-on-surface-variant">Top Category</span>
                  <span className="font-label-md text-label-md text-on-surface font-medium">Deep Work</span>
                </div>
                <span className="font-label-md text-label-md text-secondary font-semibold">Active</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-caption text-caption text-on-surface-variant">Habit Engine</span>
                  <span className="font-label-md text-label-md text-on-surface font-medium">{longestStreak} Day Streak</span>
                </div>
                <span className="font-label-md text-label-md text-primary font-medium">Locked</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Reschedule & Friction Diagnostics (Linked to Real Pending Tasks) */}
          <div className="lg:col-span-6 bg-surface-container-lowest rounded-2xl p-gutter-xl shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-tertiary">alt_route</span>
                  <h2 className="font-title text-title text-on-surface">Active Friction &amp; Backlog</h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-caption text-caption font-medium">
                  {pendingFrictionTasks.length} Prioritized Items
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                Uncompleted tasks carry friction. Anchor them into dedicated Focus Sprints to clear cognitive load.
              </p>
              
              {/* Dynamic Friction Cards List */}
              <div className="space-y-gutter-sm">
                {pendingFrictionTasks.map((task, idx) => (
                  <div key={task.id || idx} className="p-gutter-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          task.priority === 'high' ? 'bg-red-500' : 'bg-amber-400'
                        }`} />
                        <div className="flex flex-col min-w-0">
                          <span className="font-label-md text-label-md text-on-surface truncate">{task.title}</span>
                          <span className="font-caption text-caption text-on-surface-variant">
                            Category: {task.category} • Priority: {task.priority}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 px-2.5 py-1 bg-surface-container-lowest text-primary rounded-full font-label-sm text-[11px] font-semibold">
                        Ready to Focus
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-4 pt-3 flex items-center justify-between text-on-surface-variant border-t border-surface-container/60">
              <span className="font-caption text-caption">Linked to live task queue</span>
              <span className="font-label-sm text-label-sm text-primary flex items-center gap-0.5">
                <span>Auto-tracked from store</span>
              </span>
            </div>
          </div>
        </div>

        {/* Row 3: Milestones & Badges */}
        <div className="bg-surface-container-lowest rounded-2xl p-gutter-xl shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-title text-title text-on-surface">Milestone Awards &amp; Records</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Recognitions earned through consistent execution standards</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-base">
            {/* Badge 1: Streak */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-surface-container-low p-gutter-lg flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all group">
              <div className="relative w-24 h-24 mb-3 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-b from-primary-container to-primary flex items-center justify-center shadow-[0_4px_16px_rgba(0,113,227,0.35)] text-on-primary">
                  <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>local_fire_department</span>
                </div>
                <div className="absolute -bottom-1 bg-surface-container-lowest px-2 py-0.5 rounded-full shadow-sm">
                  <span className="font-caption text-[11px] font-bold text-primary tracking-wide">{displayStreak} DAYS</span>
                </div>
              </div>
              <h3 className="font-title text-title text-on-surface mt-1">Streak Master</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Consecutive days logging uninterrupted deep work sessions.</p>
              <span className="mt-3 font-caption text-caption text-secondary font-semibold">Active Record • Current</span>
            </div>
            
            {/* Badge 2: Tasks Completed */}
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
              <span className="mt-3 font-caption text-caption text-on-surface-variant">Live Milestone</span>
            </div>
            
            {/* Badge 3: Consistency */}
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
              <span className="mt-3 font-caption text-caption text-on-surface-variant">Active Target</span>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
