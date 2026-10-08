import React, { useState, useMemo } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import DeleteGoalModal from '../components/DeleteGoalModal';
import GoalDetailDrawer, { InlineGoalCalendar } from '../components/GoalDetailDrawer';
import GoalModal from '../components/GoalModal';

const CATEGORY_MAP = {
  career:   { label: 'Career & Craft', color: 'primary', icon: 'terminal' },
  health:   { label: 'Health & Athletics', color: 'secondary', icon: 'directions_run' },
  creative: { label: 'Creative & Mind', color: 'tertiary', icon: 'auto_stories' },
  finance:  { label: 'Finance & Freedom', color: 'primary', icon: 'payments' },
};

const CATEGORY_COLORS = {
  primary: {
    badge: 'bg-blue-50 text-[#0A84FF] border border-blue-200/60',
    dot: 'bg-[#0A84FF]',
    bar: 'bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6]',
    text: 'text-[#0A84FF]',
    hover: 'hover:text-[#0A84FF]'
  },
  secondary: {
    badge: 'bg-emerald-50 text-emerald-600 border border-emerald-200/60',
    dot: 'bg-emerald-500',
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    text: 'text-emerald-600',
    hover: 'hover:text-emerald-600'
  },
  tertiary: {
    badge: 'bg-purple-50 text-purple-600 border border-purple-200/60',
    dot: 'bg-purple-500',
    bar: 'bg-gradient-to-r from-purple-500 to-pink-500',
    text: 'text-purple-600',
    hover: 'hover:text-purple-600'
  }
};

function getEndOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
  const sunday = new Date(d.setDate(diff));
  return sunday.toISOString().slice(0, 10);
}

function getEndOfMonth() {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return lastDay.toISOString().slice(0, 10);
}

function getEndOfYear() {
  const d = new Date();
  return `${d.getFullYear()}-12-31`;
}

const GoalsView = React.memo(function GoalsView({
  goals = [],
  addGoal,
  updateGoal,
  updateGoalProgress,
  deleteGoal,
  onOpenQuickAdd,
  settings = {},
  tasks = [],
  habits = [],
  addTask,
  onToggleTask,
  onStartFocus,
  focusSessions = []
}) {
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'matrix'
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState(null);
  const [detailGoalId, setDetailGoalId] = useState(null);

  const activeGoalForDetail = useMemo(() => {
    return goals.find(g => g.id === detailGoalId) || null;
  }, [goals, detailGoalId]);

  // Filter and search logic
  const filteredGoals = useMemo(() => {
    return goals.filter(g => {
      // Category filter
      if (filter !== 'all') {
        const goalCats = g.categories || [g.category || 'career'];
        if (!goalCats.includes(filter)) return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'behind' && g.velocity !== 'behind') return false;
        if (statusFilter === 'on-track' && g.velocity !== 'on-track' && g.velocity !== 'ahead') return false;
        if (statusFilter === 'complete' && g.workProgress !== 100) return false;
      }
      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchTitle = g.title?.toLowerCase().includes(q);
        const matchWhy = g.why?.toLowerCase().includes(q);
        if (!matchTitle && !matchWhy) return false;
      }
      return true;
    });
  }, [goals, filter, statusFilter, searchQuery]);

  // Executive Horizon Stats (O(G + T + H) time, O(G) space)
  const horizonStats = useMemo(() => {
    const total = goals.length;
    let onTrack = 0;
    let sumProgress = 0;
    const goalIdSet = new Set();
    const goalTitleSet = new Set();
    const linkedHabitIdSet = new Set();

    for (let i = 0; i < total; i++) {
      const g = goals[i];
      if (g.velocity === 'ahead' || g.velocity === 'on-track') onTrack++;
      sumProgress += (g.workProgress ?? g.progress ?? 0);
      goalIdSet.add(g.id);
      if (g.title) goalTitleSet.add(g.title);
      if (Array.isArray(g.linkedHabitIds)) {
        for (let j = 0; j < g.linkedHabitIds.length; j++) {
          linkedHabitIdSet.add(g.linkedHabitIds[j]);
        }
      }
    }
    const onTrackPct = total > 0 ? Math.round((onTrack / total) * 100) : 100;

    // Single O(T) pass over tasks
    let activeTasks = 0;
    let completedTasks = 0;
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (t.goalId && goalIdSet.has(t.goalId)) {
        if (t.completed) completedTasks++;
        else activeTasks++;
      }
    }

    // Single O(H) pass over habits
    let linkedHabitsCount = 0;
    for (let i = 0; i < habits.length; i++) {
      const h = habits[i];
      if (linkedHabitIdSet.has(h.id) || (h.linkedGoal && goalTitleSet.has(h.linkedGoal))) {
        linkedHabitsCount++;
      }
    }

    const avgProgress = total > 0 ? Math.round(sumProgress / total) : 0;

    return { total, onTrack, onTrackPct, activeTasks, completedTasks, linkedHabitsCount, avgProgress };
  }, [goals, tasks, habits]);

  // Starter Goal Presets for Zero State
  const starterGoalTemplates = [
    {
      title: 'Ship Core Product MVP v1.0',
      categories: ['career'],
      why: 'Establish independent market presence and deliver extreme value to early users.',
      dateType: 'open',
      initialTasks: ['Define feature matrix and wireframes', 'Build live database schema and authentication']
    },
    {
      title: 'Sub-50min 10k Cardio Pace',
      categories: ['health'],
      why: 'Build deep cardiovascular resilience and high-stamina physical energy.',
      dateType: 'open',
      initialTasks: ['Schedule 3 weekly Zone 2 aerobic sessions', 'Buy road racing shoes']
    },
    {
      title: 'Master Modern System Architecture',
      categories: ['creative', 'career'],
      why: 'Gain first-principles intuition for distributed systems and real-time state sync.',
      dateType: 'open',
      initialTasks: ['Complete reading Designing Data-Intensive Applications', 'Implement raft consensus prototype']
    }
  ];

  /* ── Render Individual Goal Card ── */
  const renderGoalCard = (goal) => {
    const goalCats = goal.categories && goal.categories.length ? goal.categories : [goal.category || 'career'];
    const primaryCat = goalCats[0] || 'career';
    const catConfig = CATEGORY_MAP[primaryCat] || CATEGORY_MAP.career;
    const color = CATEGORY_COLORS[catConfig.color] || CATEGORY_COLORS.primary;

    const workProgress = goal.workProgress ?? goal.progress ?? 0;
    const circumference = 2 * Math.PI * 40;
    const offset = circumference * (1 - Math.min(100, Math.max(0, workProgress)) / 100);

    // Velocity Badge Config
    let velIcon = 'check_circle';
    let velText = 'On track';
    let velClass = 'bg-blue-50 text-[#0A84FF] border border-blue-200/50';

    if (workProgress === 100 || goal.velocity === 'complete') {
      velIcon = 'task_alt';
      velText = 'Completed';
      velClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
    } else if (goal.velocity === 'ahead') {
      velIcon = 'trending_up';
      velText = 'Ahead of pace';
      velClass = 'bg-emerald-50 text-emerald-600 border border-emerald-200/50';
    } else if (goal.velocity === 'behind') {
      velIcon = 'warning';
      velText = 'Needs attention';
      velClass = 'bg-amber-50 text-amber-700 border border-amber-200/50';
    }

    const isFlexible = goal.dateType === 'open' || !goal.targetDate;

    return (
      <div
        key={goal.id}
        data-block-id={`goal-card-${goal.id}`}
        onClick={() => setDetailGoalId(goal.id)}
        className="group relative flex flex-col justify-between rounded-2xl bg-white border border-black/[0.06] p-5 shadow-2xs hover:shadow-md hover:border-black/[0.12] transition-all duration-200 cursor-pointer"
      >
        <div>
          {/* Top Row: Categories & Velocity */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {goalCats.map(catKey => {
                const info = CATEGORY_MAP[catKey] || { label: catKey, color: 'primary' };
                const c = CATEGORY_COLORS[info.color] || CATEGORY_COLORS.primary;
                return (
                  <span
                    key={catKey}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${c.badge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    <span>{info.label}</span>
                  </span>
                );
              })}
            </div>

            <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${velClass}`}>
              <span className="material-symbols-outlined text-[13px]">{velIcon}</span>
              <span>{velText}</span>
            </div>
          </div>

          {/* Goal Main Content: Circular Progress Gauge + Title/Why/Horizon */}
          <div className="flex items-start gap-4 mt-2">
            {/* Circular Radial Completion % Gauge */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                updateGoalProgress?.(goal.id, 10);
              }}
              className="relative w-20 h-20 shrink-0 group/circle cursor-pointer active:scale-95 transition-transform"
              title="Click to boost progress +10%"
            >
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  className="text-black/[0.06] fill-none stroke-current"
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="8"
                />
                <circle
                  className={`${color.text} fill-none transition-all duration-700`}
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  strokeWidth="8"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                <span className="text-[17px] font-black text-[#1A1B1F] tracking-tight leading-none">
                  {workProgress}<span className="text-[11px] font-bold text-[#8E8E93]">%</span>
                </span>
                <span className="text-[10px] font-bold text-[#8E8E93] tracking-wider uppercase mt-0.5">
                  done
                </span>
              </div>
            </div>

            {/* Title, Why, Horizon */}
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-bold text-[#1A1B1F] tracking-tight leading-snug group-hover:text-[#0A84FF] transition-colors">
                {goal.title}
              </h2>

              {goal.why && (
                <p className="mt-1 text-[12px] text-[#64748B] italic leading-relaxed line-clamp-2">
                  "{goal.why}"
                </p>
              )}

              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
                <span className="material-symbols-outlined text-[14px]">
                  {isFlexible ? 'all_inclusive' : 'calendar_today'}
                </span>
                <span>
                  {isFlexible ? 'Continuous Horizon' : `${goal.daysLeft ?? 0}d left · ${goal.targetDate}`}
                </span>
              </div>
            </div>
          </div>

          {/* Execution Engine: Next Action & Linked Status */}
          <div className="mt-4 rounded-xl bg-[#F8F8FC] border border-black/[0.04] p-3">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-[#8E8E93]">
              <span>Next Execution Step</span>
              <span>{goal.completedTaskCount || 0}/{goal.linkedTaskCount || 0} tasks done</span>
            </div>

            {goal.nextTask ? (
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[15px] text-[#0A84FF]">play_circle</span>
                  <span className="text-[12px] font-semibold text-[#1A1B1F] truncate">
                    {goal.nextTask.title}
                  </span>
                </div>
                {goal.nextTask.dueDate && (
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-white text-[#64748B] border border-black/[0.04]">
                    {goal.nextTask.dueDate}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-[#8E8E93]">
                {goal.milestone || 'No pending tasks. Click to inspect or add deliverables.'}
              </p>
            )}

            {/* Linked Habits badge if present */}
            {goal.linkedHabits && goal.linkedHabits.length > 0 && (
              <div className="mt-2 pt-2 border-t border-black/[0.04] flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-[#8E8E93]">Ritual:</span>
                {goal.linkedHabits.map(h => (
                  <span key={h.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white text-[#1A1B1F] border border-black/[0.04]">
                    <span className="material-symbols-outlined text-[11px] text-emerald-500">repeat</span>
                    <span>{h.title}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Toolbar */}
        <div className="mt-4 pt-3 border-t border-black/[0.04] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenQuickAdd?.({ initialGoalId: goal.id });
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0A84FF] hover:bg-[#0071E3] text-white text-[11px] font-semibold transition active:scale-95 shadow-3xs"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add Task</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailGoalId(goal.id);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F0EFF5] hover:bg-[#E5E5EB] text-[#1A1B1F] text-[11px] font-semibold transition active:scale-95"
              title="Open Goal Details & Execution Workspace"
            >
              <span className="material-symbols-outlined text-[14px] text-[#64748B]">edit_note</span>
              <span>Details</span>
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setGoalToDelete(goal);
            }}
            className="p-1.5 rounded-lg text-[#8E8E93] hover:text-red-500 hover:bg-red-50 transition"
            title={`Delete ${goal.title}`}
          >
            <span className="material-symbols-outlined text-[17px]">delete</span>
          </button>
        </div>
      </div>
    );
  };

  /* ── Eisenhower Priority Matrix Quadrant ── */
  const renderMatrixQuadrant = (title, goalsList, dotColor, badgeBg, badgeText) => (
    <div className="rounded-2xl bg-white border border-black/[0.06] p-4 shadow-2xs flex flex-col justify-between min-h-[220px]">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
            <span className="text-[13px] font-bold text-[#1A1B1F]">{title}</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeBg}`}>
            {badgeText} ({goalsList.length})
          </span>
        </div>

        <div className="space-y-2">
          {goalsList.length > 0 ? (
            goalsList.map(g => (
              <div
                key={g.id}
                onClick={() => setDetailGoalId(g.id)}
                className="p-2.5 rounded-xl bg-[#F8F8FC] border border-black/[0.04] flex items-center justify-between hover:bg-white transition cursor-pointer"
              >
                <div className="min-w-0">
                  <h4 className="text-[12px] font-semibold text-[#1A1B1F] truncate">{g.title}</h4>
                  <span className="text-[10px] text-[#8E8E93]">
                    {g.workProgress ?? g.progress ?? 0}% · {g.dateType === 'open' ? 'Flexible' : `${g.daysLeft ?? 0}d left`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenQuickAdd?.({ initialGoalId: g.id });
                  }}
                  className="px-2 py-1 rounded-lg bg-white text-[10px] font-bold text-[#0A84FF] shadow-3xs hover:bg-blue-50 active:scale-95 transition"
                >
                  + Task
                </button>
              </div>
            ))
          ) : (
            <p className="text-[11px] text-[#8E8E93] py-4 text-center">No goals in this quadrant</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <main className="w-full min-h-screen bg-[#F8F8FC] pt-16 md:pt-12 px-4 sm:px-6 md:px-margin-desktop py-4 sm:py-gutter-xl">
      <div className="mx-auto w-full max-w-[1440px] space-y-6">

        {/* ── Top Header Block ── */}
        <header data-block-id="goals-header" className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-[#0A84FF] font-bold">Strategic Horizons</span>
              <span className="w-1 h-1 rounded-full bg-[#8E8E93]" />
              <span className="text-[11px] text-[#64748B] font-semibold">Vision to Daily Execution</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1A1B1F]">Goals &amp; Horizons</h1>
            <p className="mt-0.5 text-[13px] text-[#64748B]">
              Anchor meaningful long-term vectors. Daily tasks and rituals drive real progress.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {/* View Mode Toggle: Grid vs Matrix */}
            <div className="p-1 rounded-xl bg-[#F0EFF5] border border-black/[0.04] flex items-center">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                  viewMode === 'grid' ? 'bg-white text-[#0A84FF] shadow-xs' : 'text-[#64748B] hover:text-[#1A1B1F]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">grid_view</span>
                <span>Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                  viewMode === 'matrix' ? 'bg-white text-[#0A84FF] shadow-xs' : 'text-[#64748B] hover:text-[#1A1B1F]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">dashboard_customize</span>
                <span>Matrix</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowNewGoal(!showNewGoal)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A84FF] text-white text-[12px] font-semibold hover:bg-[#0071E3] transition shadow-xs active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>New Goal</span>
            </button>
          </div>
        </header>

        {/* ── Top Executive Horizon Pulse Ribbon ── */}
        <section data-block-id="goals-stats-ribbon" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-2xs">
            <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">Active Horizons</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#1A1B1F] tracking-tight">{horizonStats.total}</span>
              <span className="text-[11px] font-semibold text-[#0A84FF]">Live Projects</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-2xs">
            <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">Strategic Velocity</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600 tracking-tight">{horizonStats.onTrackPct}%</span>
              <span className="text-[11px] font-semibold text-[#64748B]">{horizonStats.onTrack} On Track</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-2xs">
            <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">Execution Pipeline</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#1A1B1F] tracking-tight">{horizonStats.activeTasks}</span>
              <span className="text-[11px] font-semibold text-[#64748B]">Active Tasks</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-2xs">
            <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">Driving Rituals</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-600 tracking-tight">{horizonStats.linkedHabitsCount}</span>
              <span className="text-[11px] font-semibold text-[#64748B]">Linked Habits</span>
            </div>
          </div>
        </section>

        {/* ── Filter Bar: Category & Search & Status ── */}
        <section data-block-id="goals-filter-bar" className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-[#1A1B1F] text-white shadow-xs'
                  : 'bg-white text-[#64748B] hover:text-[#1A1B1F] border border-black/[0.06]'
              }`}
            >
              All Goals ({goals.length})
            </button>

            {Object.entries(CATEGORY_MAP).map(([key, info]) => {
              const count = goals.filter(g => (g.categories || [g.category]).includes(key)).length;
              const isSelected = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#1A1B1F] text-white shadow-xs'
                      : 'bg-white text-[#64748B] hover:text-[#1A1B1F] border border-black/[0.06]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_COLORS[info.color]?.dot}`} />
                  <span>{info.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20' : 'bg-black/[0.04]'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Status Quick Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-[#8E8E93]">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search goals..."
                className="w-full pl-8 pr-3 py-1 rounded-full text-[11px] bg-white border border-black/[0.06] text-[#1A1B1F] placeholder:text-[#8E8E93] outline-none focus:border-[#0A84FF]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1 rounded-full text-[11px] font-semibold bg-white border border-black/[0.06] text-[#64748B] outline-none"
            >
              <option value="all">All Status</option>
              <option value="on-track">On Track</option>
              <option value="behind">Needs Attention</option>
              <option value="complete">Completed</option>
            </select>
          </div>
        </section>

        {/* ── Create New Goal Modal ── */}
        <GoalModal
          isOpen={showNewGoal}
          onClose={() => setShowNewGoal(false)}
          onAddGoal={addGoal}
          habits={habits}
        />

        {/* ── Main View: Grid vs Eisenhower Matrix ── */}
        {viewMode === 'grid' ? (
          filteredGoals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredGoals.map(renderGoalCard)}
            </div>
          ) : (
            /* ── Smart High-Converting Zero State with Presets ── */
            <section className="p-8 sm:p-12 rounded-2xl bg-white border border-black/[0.06] shadow-2xs text-center space-y-6">
              <div className="max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0A84FF] flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[26px]">flag</span>
                </div>
                <h3 className="text-lg font-bold text-[#1A1B1F]">No Strategic Horizons Found</h3>
                <p className="mt-1 text-[13px] text-[#64748B]">
                  Big achievements start with 1 clear vector. Pick a starter blueprint or define your custom goal.
                </p>
              </div>

              {/* 3 Clickable Starter Templates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-left">
                {starterGoalTemplates.map((template, idx) => (
                  <div
                    key={idx}
                    onClick={() => addGoal(template)}
                    className="p-4 rounded-xl bg-[#F8F8FC] border border-black/[0.04] hover:bg-white hover:border-[#0A84FF]/40 hover:shadow-md cursor-pointer transition-all duration-200 group flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A84FF]">
                        {CATEGORY_MAP[template.categories[0]]?.label}
                      </span>
                      <h4 className="mt-1 text-[13px] font-bold text-[#1A1B1F] group-hover:text-[#0A84FF] transition">
                        {template.title}
                      </h4>
                      <p className="mt-1 text-[11px] text-[#64748B] line-clamp-2">
                        {template.why}
                      </p>
                    </div>
                    <div className="mt-4 pt-2 border-t border-black/[0.04] flex items-center justify-between text-[11px] font-bold text-[#0A84FF]">
                      <span>Click to adopt</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowNewGoal(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0A84FF] hover:bg-[#0071E3] text-white text-[12px] font-semibold transition shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Create Custom Horizon</span>
              </button>
            </section>
          )
        ) : (
          /* ── Eisenhower Priority Matrix View ── */
          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderMatrixQuadrant(
                'Critical / Behind Pace',
                filteredGoals.filter(g => g.velocity === 'behind'),
                'bg-red-500',
                'bg-red-50 text-red-700',
                'Urgent Action'
              )}
              {renderMatrixQuadrant(
                'On Track / Steady Velocity',
                filteredGoals.filter(g => g.velocity === 'on-track'),
                'bg-blue-500',
                'bg-blue-50 text-blue-700',
                'Core Focus'
              )}
              {renderMatrixQuadrant(
                'Ahead of Pace',
                filteredGoals.filter(g => g.velocity === 'ahead'),
                'bg-emerald-500',
                'bg-emerald-50 text-emerald-700',
                'High Momentum'
              )}
              {renderMatrixQuadrant(
                'Completed Horizons',
                filteredGoals.filter(g => (g.workProgress ?? g.progress ?? 0) === 100),
                'bg-purple-500',
                'bg-purple-50 text-purple-700',
                'Archived'
              )}
            </div>
          </section>
        )}

        {/* ── Visual Design Philosophy Footer Banner ── */}
        <section className="p-4 sm:p-5 rounded-2xl bg-white border border-black/[0.06] shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0A84FF] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">architecture</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-[#0A84FF] font-bold tracking-wider">Design Philosophy</span>
              <h4 className="text-[13px] font-bold text-[#1A1B1F]">The Architecture of Restraint</h4>
              <p className="text-[12px] text-[#64748B] max-w-xl">
                High velocity is not frantic activity. It is the uncompromising removal of secondary priorities to make room for absolute precision.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
            <div className="text-right">
              <div className="text-[12px] font-semibold text-[#1A1B1F]">{settings?.profile?.name || 'Personal Workspace'}</div>
              <div className="text-[10px] text-[#8E8E93]">{settings?.profile?.role || 'Focus Mode'}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] flex items-center justify-center text-white font-bold text-xs shadow-xs">
              {(settings?.profile?.name || 'M').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </section>

      </div>

      {/* Goal Deletion Choice Modal */}
      <DeleteGoalModal
        isOpen={!!goalToDelete}
        goal={goalToDelete}
        connectedTasksCount={tasks.filter(t => String(t.goalId) === String(goalToDelete?.id)).length}
        connectedHabitsCount={habits.filter(h => {
          if (!goalToDelete) return false;
          if (h.goalId && String(h.goalId) === String(goalToDelete.id)) return true;
          if (h.linkedGoal && goalToDelete.title && h.linkedGoal.toLowerCase().includes(goalToDelete.title.toLowerCase().slice(0, 8))) return true;
          return false;
        }).length}
        onConfirm={(options) => {
          if (goalToDelete) {
            deleteGoal(goalToDelete.id, options);
            if (detailGoalId === goalToDelete.id) setDetailGoalId(null);
            setGoalToDelete(null);
          }
        }}
        onCancel={() => setGoalToDelete(null)}
      />

      {/* Goal Detail & Execution Drawer */}
      <GoalDetailDrawer
        isOpen={!!activeGoalForDetail}
        onClose={() => setDetailGoalId(null)}
        goal={activeGoalForDetail}
        onUpdateGoal={updateGoal}
        onDeleteGoal={(id) => {
          const target = goals.find(g => String(g.id) === String(id));
          if (target) {
            setGoalToDelete(target);
          } else {
            deleteGoal?.(id);
          }
          setDetailGoalId(null);
        }}
        tasks={tasks}
        habits={habits}
        addTask={addTask}
        onToggleTask={onToggleTask}
        onStartFocus={onStartFocus}
        focusSessions={focusSessions}
      />
    </main>
  );
});

export default GoalsView;
