import React, { useState, useMemo } from 'react';
import TaskDetailModal from '../components/TaskDetailModal';

export default function TodayView({
  tasks = [],
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onOpenQuickAdd,
  goals = []
}) {
  const [horizon, setHorizon] = useState('all');
  const [contextFilter, setContextFilter] = useState('all');
  const [energyFilter, setEnergyFilter] = useState('all');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const horizons = [
    { id: 'all', label: 'All Horizons' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'quarter', label: 'This Quarter' },
    { id: 'someday', label: 'Backlog / Someday' },
  ];

  const contexts = [
    { id: 'all', label: 'All Contexts', icon: 'apps' },
    { id: '@Laptop', label: '@Laptop', icon: 'laptop_mac' },
    { id: '@Home', label: '@Home', icon: 'home' },
    { id: '@Calls', label: '@Calls', icon: 'call' },
    { id: '@Errands', label: '@Errands', icon: 'directions_run' },
  ];

  const energyLevels = [
    { id: 'all', label: 'All Energies' },
    { id: 'High', label: 'High', icon: 'bolt' },
    { id: 'Medium', label: 'Medium' },
    { id: 'Low', label: 'Low' },
  ];

  /* ── Active Filtering ── */
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Horizon / Due Date filter
      if (horizon !== 'all') {
        const d = (task.dueDate || task.date || 'Today').toLowerCase();
        if (horizon === 'today' && !d.includes('today')) return false;
        if (horizon === 'week' && !d.includes('week') && !d.includes('tomorrow') && !d.includes('today')) return false;
        if (horizon === 'quarter' && !d.includes('quarter')) return false;
        if (horizon === 'someday' && !d.includes('someday') && !d.includes('backlog')) return false;
      }
      // 2. Context filter
      if (contextFilter !== 'all') {
        if (task.context !== contextFilter) return false;
      }
      // 3. Energy filter
      if (energyFilter !== 'all') {
        if (task.energy !== energyFilter) return false;
      }
      return true;
    });
  }, [tasks, horizon, contextFilter, energyFilter]);

  const hasActiveFilters = horizon !== 'all' || contextFilter !== 'all' || energyFilter !== 'all';

  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [calendarScope, setCalendarScope] = useState('today'); // 'today' | '3day'
  const [selectedSlotTime, setSelectedSlotTime] = useState(null);

  // Live minute ticker for current time line
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  /* ── Pixel Mapping Engine: 08:00 to 20:00 (12 hours = 720 mins) ── */
  // Total canvas height = 660px (55px per hour, 0.916px per minute)
  const START_HOUR = 8;
  const END_HOUR = 20;
  const TOTAL_HOURS = END_HOUR - START_HOUR; // 12
  const HOUR_HEIGHT = 55;
  const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 660px

  const minutesFromStartOfDay = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  /* ── Current Time Indicator Coordinate ── */
  const currentMinutesToday = currentTime.getHours() * 60 + currentTime.getMinutes();
  const startDayMinutes = START_HOUR * 60;
  const endDayMinutes = END_HOUR * 60;
  const isTimeInView = currentMinutesToday >= startDayMinutes && currentMinutesToday <= endDayMinutes;
  const currentTimeTop = isTimeInView
    ? ((currentMinutesToday - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT
    : null;

  /* ── Real Scheduled Blocks derived from real task.startTime & duration ── */
  const scheduledBlocks = useMemo(() => {
    // Filter active tasks that have an explicit startTime or due today
    return tasks
      .filter(t => !t.completed && (t.startTime || (t.dueDate === 'Today' && !t.completed)))
      .map(task => {
        let startMin = minutesFromStartOfDay(task.startTime);
        let duration = Number(task.durationMinutes) || 60;

        // If no explicit startTime set yet, do not fake a slot; keep it in unscheduled queue
        if (startMin === null) {
          return null;
        }

        // Calculate pixel coordinates
        const topPx = Math.max(0, ((startMin - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
        const heightPx = Math.max(34, (duration / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);

        // Format 12-hour display string
        const startH = Math.floor(startMin / 60);
        const startM = startMin % 60;
        const endMin = startMin + duration;
        const endH = Math.floor(endMin / 60);
        const endM = endMin % 60;
        const fmt = (h, m) => {
          const ampm = h >= 12 ? 'PM' : 'AM';
          const hr = h % 12 || 12;
          return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
        };
        const timeStr = `${fmt(startH, startM)} – ${fmt(endH, endM)}`;

        // Active right now indicator
        const isLiveNow = currentMinutesToday >= startMin && currentMinutesToday <= endMin;

        return {
          task,
          top: topPx,
          height: heightPx,
          timeStr,
          isLiveNow,
          type: task.priority === 'high' ? 'primary' : task.category === 'Meetings' ? 'tertiary' : 'secondary'
        };
      })
      .filter(Boolean);
  }, [tasks, currentMinutesToday]);

  const clearAllFilters = () => {
    setHorizon('all');
    setContextFilter('all');
    setEnergyFilter('all');
  };

  // Divide into morning, afternoon, evening blocks
  const morningTasks = filteredTasks.filter(t => t.priority === 'high');
  const afternoonTasks = filteredTasks.filter(t => t.priority === 'normal');
  const eveningTasks = filteredTasks.filter(t => t.priority === 'low' || t.category === 'Personal' || t.category === 'Habits');

  // Fallback distribution if specific buckets are empty but tasks exist
  const displayMorning = morningTasks.length > 0 ? morningTasks : filteredTasks.slice(0, Math.ceil(filteredTasks.length / 2));
  const displayAfternoon = afternoonTasks.length > 0 ? afternoonTasks : filteredTasks.slice(Math.ceil(filteredTasks.length / 2));
  const displayEvening = eveningTasks.length > 0 ? eveningTasks : [];

  return (
    <main className="w-full pt-16 md:pt-12 px-4 sm:px-6 md:px-margin-desktop py-4 sm:py-gutter-xl min-h-screen bg-surface">
      <div className="flex flex-col w-full gap-4 sm:gap-gutter-lg pb-10 sm:pb-gutter-2xl">

        {/* Top Segmented Horizon Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-gutter-md">
          <div className="flex items-center gap-gutter-xs p-1 rounded-full bg-surface-container shadow-inner max-w-full overflow-x-auto scrollbar-none">
            {horizons.map(h => {
              const isActive = horizon === h.id;
              return (
                <button
                  key={h.id}
                  onClick={() => setHorizon(h.id)}
                  className={`px-gutter-base py-1 rounded-full font-label-md text-label-md transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>}
                  {h.label}
                </button>
              );
            })}
          </div>

          {/* Live Status & Productivity Dial */}
          <div className="flex items-center gap-gutter-md">
            <div className="flex items-center gap-2 px-gutter-md py-1 rounded-full bg-surface-container-low text-on-surface-variant text-label-sm font-label-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
              </span>
              <span>Optimal Cognitive Window</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 text-on-surface-variant font-caption text-caption uppercase tracking-wider">
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span>•</span>
              <span className="text-primary font-label-sm">{filteredTasks.filter(t => !t.completed).length} active queued</span>
            </div>
          </div>
        </div>

        {/* Context & Energy Filter Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-gutter-base p-gutter-md rounded-2xl bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_20px_rgba(0,0,0,0.02)]">
          {/* Context Chips */}
          <div className="flex items-center gap-gutter-xs overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <span className="text-on-surface-variant font-caption text-caption uppercase tracking-wider pr-1">Context:</span>
            {contexts.map(ctx => {
              const isSelected = contextFilter === ctx.id;
              return (
                <button
                  key={ctx.id}
                  onClick={() => setContextFilter(ctx.id)}
                  className={`px-3 py-1 rounded-full text-label-sm font-label-sm transition-colors flex items-center gap-1 whitespace-nowrap ${
                    isSelected
                      ? 'bg-primary-fixed text-on-primary-fixed-variant font-semibold shadow-sm'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{ctx.icon}</span>
                  {ctx.label}
                  {isSelected && ctx.id !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5"></span>}
                </button>
              );
            })}
          </div>

          {/* Energy Selector & Filter Reset */}
          <div className="flex items-center gap-gutter-md flex-wrap justify-between lg:justify-end">
            <div className="flex items-center gap-1 p-0.5 rounded-full bg-surface-container">
              {energyLevels.map(lvl => {
                const isSelected = energyFilter === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    onClick={() => setEnergyFilter(lvl.id)}
                    className={`px-3 py-1 rounded-full text-label-sm font-label-sm transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-primary-container text-on-primary-container shadow-sm font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span>{lvl.label}</span>
                    {lvl.icon && <span className="material-symbols-outlined text-[13px]">{lvl.icon}</span>}
                  </button>
                );
              })}
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-primary text-[11px] font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Empty State when zero tasks match filters ── */}
        {filteredTasks.length === 0 && (
          <div className="p-10 rounded-2xl bg-surface-container-lowest text-center flex flex-col items-center justify-center border border-black/[0.04]">
            <div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center text-primary mb-3">
              <span className="material-symbols-outlined text-[28px]">filter_list_off</span>
            </div>
            <h3 className="font-title text-title text-on-surface font-semibold mb-1">
              No tasks match current filters
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm mb-4">
              Try resetting your context, horizon, or energy filters, or quick-add a new deliverable.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors"
              >
                Clear All Filters
              </button>
              <button
                onClick={onOpenQuickAdd}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-sm hover:brightness-105 transition-all"
              >
                + Add Task
              </button>
            </div>
          </div>
        )}

        {/* Main Content Layout (Left: Grouped Horizon Tasks 68%, Right: Day Time Ruler 32%) */}
        {filteredTasks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-xl items-start">
            {/* LEFT PANEL: Task Timeline Stream (8 Cols ~ 68%) */}
            <div className="lg:col-span-8 flex flex-col gap-gutter-xl">
              {/* Section 1: Morning Focus Block */}
              {displayMorning.length > 0 && (
                <div className="flex flex-col gap-gutter-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-gutter-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface">Morning Focus Block</h2>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-caption text-caption">9:00 AM – 12:30 PM</span>
                    </div>
                    <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Prime Cognitive Energy</span>
                  </div>

                  {/* Grouped Tasks Card */}
                  <div className="rounded-2xl bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.02)] overflow-hidden">
                    {displayMorning.map((task, idx) => (
                      <React.Fragment key={task.id}>
                        {idx > 0 && <div className="h-[1px] bg-surface-container-high ml-12 mr-gutter-base"></div>}
                        <div className="group relative flex items-center justify-between p-gutter-base hover:bg-surface-container-low/40 transition-colors cursor-pointer" onClick={() => setEditingTask(task)}>
                          <div className="flex items-start gap-gutter-md min-w-0 flex-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleTask(task.id);
                              }}
                              className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all shadow-sm flex-shrink-0 ${
                                task.completed
                                  ? 'bg-primary text-white'
                                  : 'bg-surface-container-high hover:bg-surface-container-highest text-transparent'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">check</span>
                            </button>
                            <div className="flex flex-col min-w-0 flex-1 pr-gutter-md">
                              <div className="flex items-center gap-gutter-sm flex-wrap">
                                <span className={`font-body-md text-body-md font-medium text-on-surface ${task.completed ? 'line-through opacity-50' : ''}`}>
                                  {task.title}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-caption text-caption flex items-center gap-0.5">
                                  <span>→</span> {task.category || 'Deep Work'}
                                </span>
                                {task.dueDate && task.dueDate !== 'Today' && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-caption text-[10px] font-semibold">
                                    {task.dueDate}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-gutter-md mt-1 text-on-surface-variant font-caption text-caption">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px] text-outline">schedule</span>
                                  {task.dueDate || 'Today'}
                                </span>
                                <span className="flex items-center gap-1 text-primary">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                                  {task.energy || 'High'} Energy
                                </span>
                                {task.context && (
                                  <span className="text-[11px] font-medium text-[#777]">
                                    {task.context}
                                  </span>
                                )}
                                {task.subtasks?.length > 0 && (
                                  <span className="text-[11px] text-on-surface-variant font-medium">
                                    {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-gutter-sm relative" onClick={(e) => e.stopPropagation()}>
                            <span className="px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption">{task.priority === 'high' ? 'High Impact' : 'Core'}</span>
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === task.id ? null : task.id)}
                              className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                            </button>
                            {activeMenuId === task.id && (
                              <div className="absolute right-0 top-8 z-20 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-lg py-1 min-w-[130px]">
                                <button
                                  onClick={() => {
                                    setEditingTask(task);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-on-surface font-label-sm text-label-sm hover:bg-surface-container flex items-center gap-2"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                  Edit Task
                                </button>
                                <button
                                  onClick={() => {
                                    onDeleteTask?.(task.id);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-error font-label-sm text-label-sm hover:bg-error-container/20 flex items-center gap-2"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Afternoon Deep Work Block */}
              {displayAfternoon.length > 0 && (
                <div className="flex flex-col gap-gutter-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-gutter-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface">Afternoon Execution Block</h2>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-caption text-caption">1:30 PM – 5:00 PM</span>
                    </div>
                    <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Sustained Cadence</span>
                  </div>
                  <div className="rounded-2xl bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.02)] overflow-hidden">
                    {displayAfternoon.map((task, idx) => (
                      <React.Fragment key={task.id}>
                        {idx > 0 && <div className="h-[1px] bg-surface-container-high ml-12 mr-gutter-base"></div>}
                        <div className="group relative flex items-center justify-between p-gutter-base hover:bg-surface-container-low/40 transition-colors cursor-pointer" onClick={() => setEditingTask(task)}>
                          <div className="flex items-start gap-gutter-md min-w-0 flex-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleTask(task.id);
                              }}
                              className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all shadow-sm flex-shrink-0 ${
                                task.completed
                                  ? 'bg-primary text-white'
                                  : 'bg-surface-container-high hover:bg-surface-container-highest text-transparent'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">check</span>
                            </button>
                            <div className="flex flex-col min-w-0 flex-1 pr-gutter-md">
                              <div className="flex items-center gap-gutter-sm flex-wrap">
                                <span className={`font-body-md text-body-md font-medium text-on-surface ${task.completed ? 'line-through opacity-50' : ''}`}>
                                  {task.title}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-caption text-caption">
                                  {task.category || 'Focus'}
                                </span>
                                {task.dueDate && task.dueDate !== 'Today' && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-caption text-[10px] font-semibold">
                                    {task.dueDate}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-gutter-md mt-1 text-on-surface-variant font-caption text-caption">
                                <span>{task.dueDate || 'Today'}</span>
                                <span className="text-on-surface-variant">{task.energy || 'Medium'} Energy</span>
                                {task.context && (
                                  <span className="text-[11px] font-medium text-[#777]">
                                    {task.context}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === task.id ? null : task.id)}
                              className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                            </button>
                            {activeMenuId === task.id && (
                              <div className="absolute right-0 top-8 z-20 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-lg py-1 min-w-[130px]">
                                <button
                                  onClick={() => {
                                    setEditingTask(task);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-on-surface font-label-sm text-label-sm hover:bg-surface-container flex items-center gap-2"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                  Edit Task
                                </button>
                                <button
                                  onClick={() => {
                                    onDeleteTask?.(task.id);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-error font-label-sm text-label-sm hover:bg-error-container/20 flex items-center gap-2"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3: Evening Wind-Down Block */}
              {displayEvening.length > 0 && (
                <div className="flex flex-col gap-gutter-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-gutter-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface">Evening Habits &amp; Restoration</h2>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-caption text-caption">5:30 PM – 7:00 PM</span>
                    </div>
                    <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Restoration</span>
                  </div>
                  <div className="rounded-2xl bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.02)] p-gutter-base space-y-gutter-sm">
                    {displayEvening.map(task => (
                      <div key={task.id} className="flex items-center justify-between p-gutter-sm rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => setEditingTask(task)}>
                        <div className="flex items-center gap-gutter-md">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTask(task.id);
                            }}
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all shadow-sm flex-shrink-0 ${
                              task.completed
                                ? 'bg-secondary text-white'
                                : 'bg-surface-container-high hover:bg-surface-container-highest text-transparent'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          </button>
                          <div className="flex flex-col">
                            <span className={`font-body-md text-body-md font-medium text-on-surface ${task.completed ? 'line-through opacity-50' : ''}`}>
                              {task.title}
                            </span>
                            <span className="text-on-surface-variant font-caption text-caption">
                              {task.category || 'Habits'} {task.dueDate ? `• ${task.dueDate}` : ''}
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-label-sm">
                          {task.category || 'Evening'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT PANEL: Real Time-Blocking Calendar (4 Cols ~ 32%) */}
            <div className="lg:col-span-4 flex flex-col gap-gutter-md">
              {/* Timeline Header */}
              <div className="flex items-center justify-between px-gutter-sm">
                <div className="flex items-center gap-gutter-xs">
                  <span className="material-symbols-outlined text-primary text-[20px]">calendar_today</span>
                  <h3 className="font-title text-title text-on-surface">Time Blocked Today</h3>
                </div>

                {/* Scope switcher: Today vs 3-Day */}
                <div className="flex items-center p-0.5 rounded-lg bg-surface-container text-xs">
                  <button
                    onClick={() => setCalendarScope('today')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      calendarScope === 'today'
                        ? 'bg-surface text-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Day
                  </button>
                  <button
                    onClick={() => setCalendarScope('3day')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      calendarScope === '3day'
                        ? 'bg-surface text-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    3-Day
                  </button>
                </div>
              </div>

              {/* Calendar Canvas Container */}
              <div className="relative bg-surface-container-lowest rounded-2xl p-gutter-base shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.02)]">
                {/* 3-Day Mode Quick Notification */}
                {calendarScope === '3day' && (
                  <div className="mb-3 p-2 bg-primary/10 rounded-xl text-xs text-primary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">view_week</span>
                    <span>Showing Today + Next 2 Days Schedule</span>
                  </div>
                )}

                {/* Hint banner for Click-to-Schedule */}
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-2 px-1">
                  <span>Click any hour to schedule</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Live Ruler (08:00 - 20:00)
                  </span>
                </div>

                {/* Relative Canvas with Hourly Grid */}
                <div className="relative h-[660px] select-none border-t border-surface-container-high">
                  {/* Hourly Row Slots with Click-to-Create */}
                  {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
                    const hourNum = START_HOUR + i;
                    const hourLabel = `${String(hourNum).padStart(2, '0')}:00`;
                    const topPos = i * HOUR_HEIGHT;

                    return (
                      <div
                        key={hourLabel}
                        onClick={() => onOpenQuickAdd({ initialTime: hourLabel, initialDate: 'Today' })}
                        style={{ top: `${topPos}px`, height: `${HOUR_HEIGHT}px` }}
                        className="absolute left-0 right-0 border-b border-surface-container group hover:bg-primary/5 cursor-pointer transition-colors flex items-start"
                      >
                        <span className="w-12 text-right pr-2 -mt-2 font-mono text-[11px] text-outline group-hover:text-primary transition-colors select-none">
                          {hourLabel}
                        </span>
                        <div className="flex-1 h-[1px] bg-transparent group-hover:bg-primary/20 transition-colors"></div>
                        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-primary font-medium pr-2 transition-opacity">
                          + Add
                        </span>
                      </div>
                    );
                  })}

                  {/* Red Laser Current Time Indicator */}
                  {currentTimeTop !== null && (
                    <div
                      style={{ top: `${currentTimeTop}px` }}
                      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center transition-all duration-500"
                    >
                      <div className="flex items-center -ml-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] ring-2 ring-white"></span>
                        <span className="px-1.5 py-0.5 rounded bg-red-500 text-white font-mono text-[9px] font-bold tracking-tight shadow-xs -ml-0.5">
                          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                      <div className="flex-1 h-[2px] bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"></div>
                    </div>
                  )}

                  {/* Scheduled Task Blocks Placed at Real Pixel Coordinates */}
                  <div className="absolute top-0 left-14 right-1 bottom-0 pointer-events-none">
                    {scheduledBlocks.length === 0 ? (
                      <div className="absolute top-16 left-2 right-2 p-4 rounded-xl bg-surface-container-low text-center pointer-events-auto border border-dashed border-outline/30">
                        <span className="material-symbols-outlined text-[24px] text-outline">event_available</span>
                        <p className="text-xs text-on-surface font-medium mt-1">No tasks scheduled in timeline</p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">Click any hour slot on the ruler to block time.</p>
                        <button
                          onClick={() => onOpenQuickAdd({ initialTime: '09:00', initialDate: 'Today' })}
                          className="mt-2.5 px-3 py-1 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs"
                        >
                          + Block First Time
                        </button>
                      </div>
                    ) : (
                      scheduledBlocks.map(({ task, top, height, timeStr, type, isLiveNow }) => {
                        const bgClass =
                          type === 'primary'
                            ? 'bg-primary-fixed/90 hover:bg-primary-fixed text-on-primary-fixed border-l-4 border-primary'
                            : type === 'tertiary'
                            ? 'bg-tertiary-fixed/90 hover:bg-tertiary-fixed text-on-tertiary-fixed border-l-4 border-tertiary'
                            : 'bg-secondary-fixed/90 hover:bg-secondary-fixed text-on-secondary-fixed border-l-4 border-secondary';

                        const icon =
                          task.priority === 'high'
                            ? 'bolt'
                            : task.category === 'Meetings'
                            ? 'videocam'
                            : 'push_pin';

                        return (
                          <div
                            key={task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTask(task);
                            }}
                            style={{ top: `${top}px`, height: `${height}px` }}
                            className={`absolute left-0 right-1 rounded-lg backdrop-blur-md p-2 flex flex-col justify-between shadow-xs pointer-events-auto transition-all cursor-pointer hover:shadow-md hover:z-10 group ${bgClass}`}
                          >
                            <div className="flex items-start justify-between gap-1 overflow-hidden">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isLiveNow && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[9px] font-bold tracking-wider uppercase animate-pulse">
                                    NOW
                                  </span>
                                )}
                                <span className="font-label-sm text-[11px] font-semibold leading-tight truncate">
                                  {task.title}
                                </span>
                              </div>
                              <span className="material-symbols-outlined text-[13px] shrink-0 opacity-70">
                                {icon}
                              </span>
                            </div>
                            <div className="flex items-center justify-between font-caption text-[10px] opacity-90 mt-1">
                              <span className="font-mono">{timeStr}</span>
                              <span className="px-1.5 py-0.2 rounded bg-surface-container-lowest/70 font-medium">
                                {task.durationMinutes || 60}m
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Quick Add Timeblock Trigger Button */}
                <button
                  onClick={() => onOpenQuickAdd({ initialDate: 'Today' })}
                  className="w-full mt-gutter-md flex items-center justify-center gap-gutter-sm py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors active:scale-[0.99]"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>Add New Task</span>
                </button>
              </div>

              {/* Quick Horizon Alignment Insight Card */}
              <div className="p-gutter-base rounded-2xl bg-surface-container-low/70 flex items-start gap-gutter-md">
                <span className="material-symbols-outlined text-primary text-[24px]">auto_awesome</span>
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-medium">Strategic Horizon Alignment</span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Your active deliverables tie directly into scheduled strategic milestones.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task Edit Detail Modal */}
      <TaskDetailModal
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
        goals={goals}
      />
    </main>
  );
}
