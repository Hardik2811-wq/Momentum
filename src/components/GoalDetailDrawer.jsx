import React, { useState, useEffect, useMemo } from 'react';
import { todayPlanDate } from '../lib/taskMetadata';

const CATEGORY_MAP = {
  career:   { label: 'Career & Craft', color: 'primary', icon: 'terminal' },
  health:   { label: 'Health & Athletics', color: 'secondary', icon: 'directions_run' },
  creative: { label: 'Creative & Mind', color: 'tertiary', icon: 'auto_stories' },
  finance:  { label: 'Finance & Freedom', color: 'primary', icon: 'payments' },
};

function getEndOfMonth() {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return lastDay.toISOString().slice(0, 10);
}

export function InlineGoalCalendar({ selectedDate, onSelectDate }) {
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const d = new Date(`${selectedDate}T12:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  useEffect(() => {
    if (selectedDate) {
      const d = new Date(`${selectedDate}T12:00:00`);
      if (!isNaN(d.getTime())) {
        setViewDate(d);
      }
    }
  }, [selectedDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const prevMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = todayPlanDate();

  const cells = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, isCurrentMonth: true, dateStr: dStr });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, isCurrentMonth: false });
  }

  const getPresetDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().slice(0, 10);
  };

  const formattedSelected = useMemo(() => {
    if (!selectedDate) return 'None';
    const d = new Date(`${selectedDate}T12:00:00`);
    if (isNaN(d.getTime())) return selectedDate;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [selectedDate]);

  const daysDiff = useMemo(() => {
    if (!selectedDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(`${selectedDate}T00:00:00`);
    if (isNaN(target.getTime())) return null;
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  }, [selectedDate]);

  return (
    <div className="p-3 bg-white rounded-2xl border border-black/[0.08] shadow-2xs space-y-2.5 animate-in fade-in duration-200">
      {/* Quick Presets */}
      <div className="grid grid-cols-3 gap-1">
        {[
          { label: '+1 Week', val: getPresetDate(7) },
          { label: '+1 Month', val: getPresetDate(30) },
          { label: '+3 Months', val: getPresetDate(90) },
        ].map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => onSelectDate(p.val)}
            className={`py-1 rounded-lg text-[10px] font-semibold transition text-center ${
              selectedDate === p.val
                ? 'bg-[#0A84FF] text-white shadow-3xs'
                : 'bg-[#F5F4FA] text-[#64748B] hover:bg-[#EBEBF0]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Month Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[12px] font-bold text-[#1A1B1F] tracking-tight">{monthName}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded-lg hover:bg-[#F5F4FA] text-[#8E8E93] hover:text-[#1A1B1F] transition"
            title="Previous month"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded-lg hover:bg-[#F5F4FA] text-[#8E8E93] hover:text-[#1A1B1F] transition"
            title="Next month"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <span key={d} className="py-0.5">{d}</span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((cell, idx) => {
          if (!cell.isCurrentMonth) {
            return (
              <div key={idx} className="h-7 flex items-center justify-center text-[11px] text-[#C7C7CC] opacity-30 select-none">
                {cell.day}
              </div>
            );
          }
          const isSelected = selectedDate === cell.dateStr;
          const isToday = cell.dateStr === today;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDate(cell.dateStr)}
              className={`h-7 w-7 mx-auto rounded-full text-[11px] font-medium transition-all flex items-center justify-center relative ${
                isSelected
                  ? 'bg-[#0A84FF] text-white shadow-xs font-bold'
                  : isToday
                  ? 'text-[#0A84FF] font-bold bg-blue-50/80 hover:bg-blue-100'
                  : 'text-[#1A1B1F] hover:bg-[#F0EFF5]'
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Selected Date Summary Footer */}
      <div className="pt-2 border-t border-black/[0.04] flex items-center justify-between text-[11px]">
        <span className="text-[#8E8E93] font-medium">Target:</span>
        <span className="font-bold text-[#0A84FF]">
          {formattedSelected} {daysDiff !== null ? `(${daysDiff > 0 ? `${daysDiff}d left` : daysDiff === 0 ? 'Today' : `${Math.abs(daysDiff)}d ago`})` : ''}
        </span>
      </div>
    </div>
  );
}

export default function GoalDetailDrawer({
  isOpen = false,
  onClose,
  goal,
  onUpdateGoal,
  onDeleteGoal,
  tasks = [],
  habits = [],
  addTask,
  onToggleTask,
  onStartFocus,
  focusSessions = []
}) {
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [categories, setCategories] = useState(['career']);
  const [dateType, setDateType] = useState('open');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState('active'); // 'active' | 'completed' | 'paused'
  const [linkedHabitIds, setLinkedHabitIds] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // Sync state when goal changes
  useEffect(() => {
    if (goal) {
      setTitle(goal.title || '');
      setWhy(goal.why || '');
      setCategories(goal.categories && goal.categories.length ? goal.categories : [goal.category || 'career']);
      setDateType(goal.dateType || (goal.targetDate ? 'custom' : 'open'));
      setTargetDate(goal.targetDate || '');
      setStatus(goal.status || ((goal.workProgress ?? goal.progress) === 100 ? 'completed' : 'active'));
      setLinkedHabitIds(goal.linkedHabitIds || []);
    }
  }, [goal]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Tasks linked to this goal
  const linkedTasks = useMemo(() => {
    if (!goal?.id) return [];
    return tasks.filter(t => t.goalId === goal.id);
  }, [tasks, goal?.id]);

  const openTasks = linkedTasks.filter(t => !t.completed);
  const completedTasks = linkedTasks.filter(t => t.completed);

  // Focus time logged on this goal
  const focusStats = useMemo(() => {
    if (!goal?.id) return { totalMinutes: 0, hours: 0 };
    const goalTaskIds = new Set(linkedTasks.map(t => t.id));
    const goalSessions = (focusSessions || []).filter(s => goalTaskIds.has(s.taskId));
    const totalMinutes = goalSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    const hours = Number((totalMinutes / 60).toFixed(1));
    return { totalMinutes, hours, count: goalSessions.length };
  }, [linkedTasks, focusSessions, goal?.id]);

  if (!isOpen || !goal) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    let computedDate = null;
    if (dateType === 'month') computedDate = getEndOfMonth();
    else if (dateType === 'custom') computedDate = targetDate || null;

    onUpdateGoal?.(goal.id, {
      title: title.trim(),
      why: why.trim(),
      categories,
      dateType,
      targetDate: computedDate,
      status,
      linkedHabitIds
    });
    onClose();
  };

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    addTask?.({
      title: newTaskTitle.trim(),
      goalId: goal.id,
      completed: false,
      plannedDate: todayPlanDate(),
      dueDate: 'This Week',
      priority: 'normal',
      energy: 'Medium',
      areas: categories
    });
    setNewTaskTitle('');
  };

  const toggleCategory = (catKey) => {
    setCategories(prev => {
      if (prev.includes(catKey)) {
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== catKey);
      }
      return [...prev, catKey];
    });
  };

  const toggleHabit = (habitId) => {
    setLinkedHabitIds(prev => {
      if (prev.includes(habitId)) {
        return prev.filter(id => id !== habitId);
      }
      return [...prev, habitId];
    });
  };

  const progressPercent = linkedTasks.length
    ? Math.round((completedTasks.length / linkedTasks.length) * 100)
    : (goal.workProgress ?? goal.progress ?? 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl sm:rounded-3xl bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-[0_32px_100px_rgba(0,0,0,0.22)] overflow-hidden flex flex-col text-[#1A1B1F] transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Refined Linear Header ── */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-black/[0.06] bg-[#FAFAFC] shrink-0">
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${status === 'completed' ? 'bg-emerald-500' : status === 'paused' ? 'bg-amber-400' : 'bg-[#0A84FF]'}`} />
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">
                Goal Command Center
              </span>
              <span className="text-slate-300">•</span>
              {/* Status Switcher */}
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-black/[0.08] bg-white text-[#1A1B1F] outline-none cursor-pointer hover:border-black/[0.2] transition"
              >
                <option value="active">Active Horizon</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (onDeleteGoal && goal?.id) {
                  onDeleteGoal(goal.id);
                  onClose();
                }
              }}
              title="Delete goal"
              className="p-1.5 rounded-xl text-[#8E8E93] hover:text-red-500 hover:bg-red-50 transition"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
            <div className="w-px h-4 bg-black/[0.08] mx-1" />
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 rounded-xl text-[#8E8E93] hover:text-[#1A1B1F] hover:bg-black/5 transition"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* ── Two-Column Linear Workspace Body ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
          {/* ── Left Column: Primary Content Canvas (7 cols ~ 58%) ── */}
          <div className="lg:col-span-7 p-5 sm:p-6 overflow-visible lg:overflow-y-auto space-y-5 border-r-0 lg:border-r border-black/[0.06]">
            {/* Hero Title (Borderless & Prominent) */}
            <div>
              <textarea
                rows={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Strategic Horizon Title..."
                className="w-full text-xl sm:text-2xl font-bold text-[#1A1B1F] placeholder-slate-300 bg-transparent border-none outline-none resize-none tracking-tight leading-snug focus:ring-0"
              />
            </div>

            {/* Personal Anchor (The Why) */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                <span className="material-symbols-outlined text-[15px] text-[#0A84FF]">psychology</span>
                <span>Personal Anchor (The Why)</span>
              </div>
              <textarea
                rows={3}
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Why does this strategic vector matter? What is the core emotional outcome..."
                className="w-full p-3.5 rounded-2xl bg-[#F8F8FB] border border-black/[0.06] text-[13px] leading-relaxed text-[#1A1B1F] placeholder-slate-400 outline-none focus:bg-white focus:border-[#0A84FF] focus:ring-3 focus:ring-[#0A84FF]/10 transition resize-none shadow-2xs"
              />
            </div>

            {/* Execution Task Pipeline */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-[#0A84FF]">checklist</span>
                  <span>Execution Pipeline</span>
                  <span className="text-slate-500 font-medium normal-case">
                    ({completedTasks.length}/{linkedTasks.length})
                  </span>
                </span>
                {linkedTasks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-[#0A84FF] rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">{progressPercent}%</span>
                  </div>
                )}
              </div>

              {/* Quick Inline Task Creator */}
              <form onSubmit={handleCreateTask} className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="+ Add deliverable to this goal (Press Enter)..."
                  className="flex-1 px-3.5 py-2 text-[12px] rounded-xl bg-[#F8F8FC] border border-black/[0.06] text-[#1A1B1F] placeholder:text-[#8E8E93] outline-none focus:bg-white focus:border-[#0A84FF] transition"
                />
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="px-3.5 py-2 rounded-xl bg-[#0A84FF] text-white text-[11px] font-semibold hover:bg-[#0071E3] transition disabled:opacity-40 shadow-3xs"
                >
                  Add
                </button>
              </form>

              {/* Open Deliverables Checklist */}
              <div className="space-y-1.5">
                {openTasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-black/[0.06] shadow-3xs hover:border-black/[0.12] transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => onToggleTask?.(task.id)}
                        className="text-[#8E8E93] hover:text-[#0A84FF] transition shrink-0"
                      >
                        <span className="material-symbols-outlined text-[18px]">check_box_outline_blank</span>
                      </button>
                      <span className="text-[12px] font-medium text-[#1A1B1F] truncate">
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.dueDate && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[#F8F8FC] text-[#64748B]">
                          {task.dueDate}
                        </span>
                      )}
                      {onStartFocus && (
                        <button
                          type="button"
                          onClick={() => onStartFocus(task.id)}
                          className="p-1 rounded text-[#8E8E93] hover:text-[#0A84FF]"
                          title="Start Pomodoro focus on this deliverable"
                        >
                          <span className="material-symbols-outlined text-[16px]">play_circle</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {openTasks.length === 0 && (
                  <p className="text-[12px] text-[#8E8E93] italic py-3 text-center bg-[#F8F8FC] rounded-xl border border-black/[0.03]">
                    No pending deliverables. Add deliverables above to advance this goal.
                  </p>
                )}
              </div>

              {/* Completed Tasks Toggle */}
              {completedTasks.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                    className="text-[11px] font-bold text-[#8E8E93] hover:text-[#1A1B1F] flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {showCompletedTasks ? 'expand_less' : 'expand_more'}
                    </span>
                    <span>{completedTasks.length} Completed {completedTasks.length === 1 ? 'deliverable' : 'deliverables'}</span>
                  </button>

                  {showCompletedTasks && (
                    <div className="mt-2 space-y-1.5">
                      {completedTasks.map(task => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-[#F8F8FC] text-[#8E8E93] line-through text-[12px]"
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onToggleTask?.(task.id)}
                              className="text-emerald-500 hover:text-[#8E8E93]"
                            >
                              <span className="material-symbols-outlined text-[17px]">check_box</span>
                            </button>
                            <span className="truncate">{task.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Configuration & Rituals (5 cols ~ 42%) ── */}
          <div className="lg:col-span-5 p-5 sm:p-6 overflow-visible lg:overflow-y-auto space-y-5 bg-[#FBFBFE]/70">
            {/* Target Horizon / Timeframe */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Target Horizon
              </label>
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'open', label: 'Flexible' },
                    { id: 'month', label: 'End of Month' },
                    { id: 'custom', label: 'Pick Date' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setDateType(opt.id);
                        if (opt.id === 'custom' && !targetDate) {
                          const d = new Date();
                          d.setDate(d.getDate() + 30);
                          setTargetDate(d.toISOString().slice(0, 10));
                        }
                      }}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition text-center ${
                        dateType === opt.id
                          ? 'bg-[#0A84FF] text-white shadow-xs'
                          : 'bg-[#F0EFF5] text-[#1A1B1F] hover:bg-[#E5E5EB]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Automatically loaded inline calendar when Pick Date is active */}
                {dateType === 'custom' && (
                  <InlineGoalCalendar
                    selectedDate={targetDate}
                    onSelectDate={(newDate) => setTargetDate(newDate)}
                  />
                )}
              </div>
            </div>

            {/* Categories Multi-Select */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Life Areas & Categories
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.entries(CATEGORY_MAP).map(([catKey, info]) => {
                  const isSelected = categories.includes(catKey);
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => toggleCategory(catKey)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition border ${
                        isSelected
                          ? 'bg-[#0A84FF] text-white border-[#0A84FF] shadow-3xs'
                          : 'bg-white text-[#64748B] border-black/[0.08] hover:bg-[#F0EFF5]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">{info.icon}</span>
                      <span>{info.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Deep Work Focus Hours Tracker */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A84FF]">
                  Deep Work Invested
                </span>
                <div className="mt-0.5 text-xl font-bold text-[#1A1B1F]">
                  {focusStats.hours} <span className="text-xs font-normal text-[#64748B]">hours ({focusStats.count} blocks)</span>
                </div>
              </div>

              {openTasks.length > 0 && onStartFocus && (
                <button
                  type="button"
                  onClick={() => onStartFocus(openTasks[0].id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A84FF] text-white text-[11px] font-semibold hover:bg-[#0071E3] transition shadow-xs active:scale-95"
                >
                  <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                  <span>Focus Now</span>
                </button>
              )}
            </div>

            {/* Connected Driving Rituals */}
            {habits && habits.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Connected Driving Rituals
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {habits.map(habit => {
                    const isLinked = linkedHabitIds.includes(habit.id);
                    return (
                      <button
                        key={habit.id}
                        type="button"
                        onClick={() => toggleHabit(habit.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition border ${
                          isLinked
                            ? 'bg-purple-600 text-white border-purple-600 shadow-3xs'
                            : 'bg-white text-[#64748B] border-black/[0.08] hover:bg-[#F0EFF5]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">{habit.icon || 'repeat'}</span>
                        <span>{habit.title}</span>
                        {isLinked && <span className="material-symbols-outlined text-[12px]">done</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom Fixed Action Bar ── */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-black/[0.06] bg-[#FAFAFC] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onDeleteGoal && goal?.id) {
                onDeleteGoal(goal.id);
                onClose();
              }
            }}
            className="text-[12px] font-semibold text-red-500 hover:text-red-700 transition"
          >
            Delete Goal
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[12px] font-semibold text-[#64748B] hover:bg-black/[0.05] rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-[12px] font-semibold text-white bg-[#0A84FF] hover:bg-[#0071E3] rounded-xl shadow-xs transition active:scale-95"
            >
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
