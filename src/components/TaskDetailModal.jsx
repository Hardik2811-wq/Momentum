import React, { useState, useEffect, useRef } from 'react';
import {
  legacyDueDateForPlan,
  priorityFromImpact,
  taskImpact,
  taskPlanDate,
  urgencyFromPlan,
  calculateDuration,
  calculateEndTime,
  formatDurationLabel,
  formatTimeString,
  todayPlanDate,
  tomorrowPlanDate,
  planDateLabel
} from '../lib/taskMetadata';
import { LIFE_AREAS, getGoalAreas, saveGoalAreas } from '../lib/lifeAreas';
import { CupertinoTimeInput, MiniCalendarPicker } from './QuickAddModal';

const IMPACT_CONFIG = {
  high: { label: 'High', dot: 'bg-red-500', active: 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-200' },
  medium: { label: 'Medium', dot: 'bg-amber-400', active: 'bg-amber-50 text-amber-800 border-amber-200 ring-1 ring-amber-200' },
  low: { label: 'Low', dot: 'bg-emerald-400', active: 'bg-emerald-50 text-emerald-800 border-emerald-200 ring-1 ring-emerald-200' },
};

const ENERGY_OPTIONS = [
  { id: 'High', label: 'High focus', icon: 'bolt' },
  { id: 'Medium', label: 'Balanced', icon: 'battery_horiz_075' },
  { id: 'Low', label: 'Low overhead', icon: 'coffee' }
];

export default function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onUpdateTask,
  onDeleteTask,
  goals = [],
  habits = [],
  onStartFocus
}) {
  const [formData, setFormData] = useState({
    title: '',
    plannedDate: '',
    deadlineDate: '',
    deadlineTime: '',
    impact: 'medium',
    startTime: '',
    endTime: '',
    durationMinutes: 60,
    isFlexible: false,
    areas: ['Career & Craft'],
    energy: 'High',
    goalId: '',
    habitId: '',
    recurrence: 'none',
    repeatDays: [1, 2, 3, 4, 5],
    notes: '',
    subtasks: []
  });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [activeDatePicker, setActiveDatePicker] = useState(false);
  const [showDeadline, setShowDeadline] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'goal' | 'habit' | null

  const goalMenuRef = useRef(null);
  const habitMenuRef = useRef(null);
  const repeatMenuRef = useRef(null);

  useEffect(() => {
    if (task) {
      const isFlex = Boolean(task.isFlexible || task.durationMinutes === null);
      setFormData({
        title: task.title || '',
        plannedDate: taskPlanDate(task),
        deadlineDate: task.deadlineDate || '',
        deadlineTime: task.deadlineTime || '',
        impact: taskImpact(task),
        startTime: task.startTime || '',
        endTime: isFlex ? '' : (task.endTime || ''),
        durationMinutes: isFlex ? null : (task.durationMinutes ?? 60),
        isFlexible: isFlex,
        areas: Array.isArray(task.areas) && task.areas.length > 0 ? task.areas : (task.category ? [task.category] : ['Career & Craft']),
        energy: task.energy || 'High',
        goalId: task.goalId || '',
        habitId: task.linkedHabitId || task.habitId || '',
        recurrence: task.recurrence || 'none',
        repeatDays: Array.isArray(task.repeatDays) ? task.repeatDays : [1, 2, 3, 4, 5],
        notes: task.notes || '',
        subtasks: task.subtasks || []
      });
      setShowDeadline(Boolean(task.deadlineDate));
      setActiveDatePicker(false);
      setActiveDropdown(null);
    }
  }, [task]);

  // Click outside to close custom popovers
  useEffect(() => {
    const handleOutside = (e) => {
      const clickedGoal = goalMenuRef.current && goalMenuRef.current.contains(e.target);
      const clickedHabit = habitMenuRef.current && habitMenuRef.current.contains(e.target);
      const clickedRepeat = repeatMenuRef.current && repeatMenuRef.current.contains(e.target);
      if (!clickedGoal && !clickedHabit && !clickedRepeat) {
        setActiveDropdown(null);
      }
    };
    if (activeDropdown) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [activeDropdown]);

  // Keyboard navigation: Cmd+Enter to save, Esc to close
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activeDropdown) setActiveDropdown(null);
        else if (activeDatePicker) setActiveDatePicker(false);
        else onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave(e);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, formData, activeDropdown, activeDatePicker]);

  if (!isOpen || !task) return null;

  const handleAddSubtask = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const sub = { id: 's-' + Date.now(), title: newSubtaskTitle.trim(), completed: false };
    setFormData(prev => ({
      ...prev,
      subtasks: [...(prev.subtasks || []), sub]
    }));
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subId) => {
    setFormData(prev => ({
      ...prev,
      subtasks: (prev.subtasks || []).map(s => s.id === subId ? { ...s, completed: !s.completed } : s)
    }));
  };

  const handleDeleteSubtask = (subId) => {
    setFormData(prev => ({
      ...prev,
      subtasks: (prev.subtasks || []).filter(s => s.id !== subId)
    }));
  };

  const handleSave = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.title.trim()) return;
    onUpdateTask(task.id, {
      title: formData.title.trim(),
      urgency: urgencyFromPlan(formData.plannedDate),
      impact: formData.impact,
      priority: priorityFromImpact(formData.impact),
      dueDate: legacyDueDateForPlan(formData.plannedDate),
      date: legacyDueDateForPlan(formData.plannedDate),
      plannedDate: formData.plannedDate || null,
      deadlineDate: formData.deadlineDate || null,
      deadlineTime: formData.deadlineDate ? formData.deadlineTime || null : null,
      startTime: formData.startTime || null,
      endTime: formData.isFlexible ? null : (formData.endTime || null),
      durationMinutes: formData.isFlexible ? null : (Number(formData.durationMinutes) || 60),
      isFlexible: Boolean(formData.isFlexible),
      areas: formData.areas && formData.areas.length > 0 ? formData.areas : ['Career & Craft'],
      category: formData.areas?.[0] || 'Career & Craft',
      energy: formData.energy,
      goalId: formData.goalId || null,
      linkedHabitId: formData.habitId || null,
      habitId: formData.habitId || null,
      recurrence: formData.recurrence && formData.recurrence !== 'none' ? formData.recurrence : null,
      repeatDays: formData.recurrence === 'custom' ? formData.repeatDays : null,
      notes: formData.notes,
      subtasks: formData.subtasks
    });
    onClose();
  };

  const completedSubtasks = formData.subtasks.filter(s => s.completed).length;
  const totalSubtasks = formData.subtasks.length;
  const subtaskPct = totalSubtasks ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const today = todayPlanDate();
  const tomorrow = tomorrowPlanDate();
  const currentPlanLabel = formData.plannedDate === today
    ? 'Today'
    : formData.plannedDate === tomorrow
    ? 'Tomorrow'
    : formData.plannedDate ? planDateLabel(formData.plannedDate) : 'Unscheduled';

  const getRepeatPillLabel = () => {
    const rType = formData.recurrence || 'none';
    const rDays = formData.repeatDays || [];
    if (rType === 'none') return 'Repeat: Never';
    if (rType === 'daily') return 'Repeat: Daily';
    if (rType === 'weekly') return 'Repeat: Weekly';
    if (rType === 'monthly') return 'Repeat: Monthly';
    if (rType === 'yearly') return 'Repeat: Yearly';
    if (rType === 'custom') {
      const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      if (!rDays || rDays.length === 0) return 'Repeat: Custom';
      if (rDays.length === 7) return 'Repeat: Every day';
      if (rDays.length === 5 && [1, 2, 3, 4, 5].every(d => rDays.includes(d))) return 'Repeat: Weekdays';
      if (rDays.length === 2 && [0, 6].every(d => rDays.includes(d))) return 'Repeat: Weekends';
      return `Repeat: ${rDays.map(d => WEEKDAY_NAMES[d]).join(', ')}`;
    }
    return 'Repeat: Never';
  };
  const repeatPillLabel = getRepeatPillLabel();

  const matchedGoal = goals.find(g => g.id === formData.goalId);
  const matchedHabit = habits.find(h => h.id === formData.habitId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-5 bg-black/40 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full h-[100dvh] max-w-4xl max-h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-3xl bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-[0_32px_100px_rgba(0,0,0,0.22)] overflow-hidden flex flex-col text-[#1A1B1F] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Refined Linear Header ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-black/[0.06] bg-[#FAFAFC]">
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${IMPACT_CONFIG[formData.impact]?.dot || 'bg-amber-400'}`} />
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-[#1A1B1F]">
                Task #{task.id}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-medium text-[#64748B]">
                {task.completed ? 'Completed' : 'In Progress'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Delete this task?')) {
                  onDeleteTask?.(task.id);
                  onClose();
                }
              }}
              title="Delete task"
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
        {(activeDatePicker || activeDropdown) && (
          <button
            type="button"
            aria-label="Close options"
            onClick={() => {
              setActiveDatePicker(false);
              setActiveDropdown(null);
            }}
            className="fixed inset-0 z-[60] bg-black/30 sm:hidden"
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
          
          {/* ── Left Column: Primary Content Canvas (7 cols ~ 58%) ── */}
          <div className="lg:col-span-7 p-4 sm:p-7 overflow-visible lg:overflow-y-auto space-y-5">
            {/* Hero Title (Borderless & Prominent) */}
            <div>
              <textarea
                rows={2}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="What needs to get done?"
                className="w-full text-xl sm:text-2xl font-bold text-[#1A1B1F] placeholder-slate-300 bg-transparent border-none outline-none resize-none tracking-tight leading-snug focus:ring-0"
              />
            </div>

            {/* Notes & Documentation Canvas */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                <span className="material-symbols-outlined text-[15px] text-slate-400">subject</span>
                <span>Execution Notes &amp; Context</span>
              </div>
              <textarea
                rows={4}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Capture specs, kickoff checklists, reference links, or acceptance criteria..."
                className="w-full p-4 rounded-2xl bg-[#F8F8FB] border border-black/[0.06] text-[13px] leading-relaxed text-[#1A1B1F] placeholder-slate-400 outline-none focus:bg-white focus:border-[#0A84FF] focus:ring-3 focus:ring-[#0A84FF]/10 transition resize-none shadow-2xs min-h-[100px]"
              />
            </div>

            {/* Subtasks Checklist */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-[#0A84FF]">checklist</span>
                  <span>Subtasks</span>
                  {totalSubtasks > 0 && (
                    <span className="text-slate-500 font-medium normal-case">
                      ({completedSubtasks}/{totalSubtasks})
                    </span>
                  )}
                </span>
                {totalSubtasks > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-[#0A84FF] rounded-full transition-all duration-300"
                        style={{ width: `${subtaskPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">{subtaskPct}%</span>
                  </div>
                )}
              </div>

              {/* Subtask items list */}
              <div className="space-y-1.5 mb-2.5">
                {formData.subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="group flex items-center justify-between p-2.5 rounded-xl bg-[#F8F8FB] hover:bg-slate-100/80 border border-black/[0.04] transition text-[12px]"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={st.completed}
                        onChange={() => handleToggleSubtask(st.id)}
                        className="w-4 h-4 rounded text-[#0A84FF] border-slate-300 focus:ring-0 cursor-pointer transition"
                      />
                      <span className={`truncate font-medium ${st.completed ? 'line-through text-slate-400' : 'text-[#1A1B1F]'}`}>
                        {st.title}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(st.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
                      title="Remove subtask"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Subtask Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask(e);
                    }
                  }}
                  placeholder="+ Add subtask step (press Enter)"
                  className="flex-1 px-3.5 py-2 rounded-xl text-[12px] font-medium bg-[#F8F8FB] border border-black/[0.06] outline-none focus:bg-white focus:border-[#0A84FF] transition"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  className="px-3.5 py-2 rounded-xl bg-[#1A1B1F] text-white text-[11px] font-semibold hover:bg-black transition disabled:opacity-40 shadow-xs"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Strategic Impact & Momentum Intelligence (Fills Left Canvas Gracefully) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 border border-black/[0.06] shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-indigo-600">psychology</span>
                  Momentum Context
                </span>
                {onStartFocus && (
                  <button
                    type="button"
                    onClick={() => {
                      onStartFocus(task.id);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition active:scale-95 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[14px]">play_circle</span>
                    <span>Start Focus Block</span>
                  </button>
                )}
              </div>

              {/* Dynamic Goal / Habit Context Card */}
              {matchedGoal ? (
                <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200/70 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-purple-900 flex items-center gap-1.5 truncate">
                      <span className="material-symbols-outlined text-[15px] text-purple-600">{matchedGoal.icon || 'flag'}</span>
                      <span className="truncate">Advances: {matchedGoal.title}</span>
                    </span>
                    <span className="font-bold text-purple-700 shrink-0">{matchedGoal.workProgress ?? matchedGoal.progress ?? 0}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-purple-200/80 overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all duration-300"
                      style={{ width: `${matchedGoal.workProgress ?? matchedGoal.progress ?? 0}%` }}
                    />
                  </div>
                  {matchedGoal.why && (
                    <p className="text-[11px] text-purple-800 italic line-clamp-1">
                      "{matchedGoal.why}"
                    </p>
                  )}
                </div>
              ) : matchedHabit ? (
                <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/70 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[16px] text-rose-600 shrink-0">{matchedHabit.icon || 'repeat'}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-rose-900 truncate">Anchored to {matchedHabit.title}</p>
                      <p className="text-[10px] text-rose-700 truncate">Auto-checks in today's habit streak upon completion</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-bold shrink-0">
                    {matchedHabit.duration || 'Daily'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-black/[0.04] text-[11px] text-slate-600">
                  <span className="material-symbols-outlined text-[18px] text-slate-400 shrink-0">flag_circle</span>
                  <p>Independent deliverable. Link a Strategic Goal or Habit in the inspector to compound velocity.</p>
                </div>
              )}
            </div>

            {/* Quick Metadata Footnote */}
            <div className="pt-2 flex items-center justify-between text-[11px] text-[#8E8E93]">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">event_available</span>
                <span>Horizon: {currentPlanLabel}</span>
              </span>
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-black/[0.05] text-[10px] font-mono">⌘ + Enter</kbd> to save</span>
            </div>
          </div>

          {/* ── Right Column: Linear Property Inspector (5 cols ~ 42%) ── */}
          <div className="lg:col-span-5 bg-[#FAFAFC] border-t lg:border-t-0 lg:border-l border-black/[0.06] p-4 sm:p-6 space-y-4 overflow-visible lg:overflow-y-auto text-xs">
            
            {/* 1. Schedule & Effort Card */}
            <div className="p-3.5 rounded-2xl bg-white border border-black/[0.06] shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-blue-600">calendar_today</span>
                  Plan Date
                </span>
                {formData.plannedDate && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, plannedDate: '' })}
                    className="text-[10px] text-red-500 hover:underline font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Quick Date Presets */}
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: 'Today', val: today },
                  { label: 'Tomorrow', val: tomorrow },
                  { label: 'Someday', val: '' }
                ].map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, plannedDate: opt.val });
                      setActiveDatePicker(false);
                    }}
                    className={`py-1 rounded-xl text-[11px] font-semibold transition text-center ${
                      formData.plannedDate === opt.val
                        ? 'bg-[#0A84FF] text-white shadow-xs'
                        : 'bg-[#F5F4FA] text-[#1A1B1F] hover:bg-[#EBEBF0] border border-black/[0.04]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Custom Mini Calendar Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveDatePicker(!activeDatePicker)}
                  className="w-full py-1.5 px-3 rounded-xl text-[11px] font-medium bg-[#F5F4FA] hover:bg-[#EBEBF0] text-[#1A1B1F] border border-black/[0.06] flex items-center justify-between transition"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[13px] text-slate-500">edit_calendar</span>
                    <span>{formData.plannedDate ? planDateLabel(formData.plannedDate) : 'Pick exact date...'}</span>
                  </span>
                  <span className="material-symbols-outlined text-[13px] opacity-60">
                    {activeDatePicker ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {activeDatePicker && (
                  <div className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[calc(100dvh-1rem)] justify-center overflow-y-auto rounded-t-[28px] border border-black/[0.08] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_56px_rgba(0,0,0,0.2)] sm:absolute sm:left-0 sm:right-auto sm:top-full sm:bottom-auto sm:z-40 sm:mt-1.5 sm:block sm:max-h-none sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                    <MiniCalendarPicker
                      selectedDate={formData.plannedDate}
                      onSelectDate={(d) => {
                        setFormData({ ...formData, plannedDate: d });
                        setActiveDatePicker(false);
                      }}
                      onClear={() => {
                        setFormData({ ...formData, plannedDate: '' });
                        setActiveDatePicker(false);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Repeat / Recurrence Cadence */}
              <div className="relative pt-1" ref={repeatMenuRef}>
                <button
                  type="button"
                  onClick={() => setActiveDropdown(activeDropdown === 'repeat' ? null : 'repeat')}
                  className={`w-full py-1.5 px-3 rounded-xl text-[11px] font-medium border flex items-center justify-between transition ${
                    formData.recurrence && formData.recurrence !== 'none'
                      ? 'bg-teal-50/70 border-teal-200 text-teal-900 font-semibold'
                      : 'bg-[#F5F4FA] border-black/[0.06] text-[#64748B] hover:bg-[#EBEBF0]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`material-symbols-outlined text-[14px] ${
                      formData.recurrence && formData.recurrence !== 'none' ? 'text-teal-600' : 'text-[#8E8E93]'
                    }`}>
                      {formData.recurrence && formData.recurrence !== 'none' ? 'event_repeat' : 'sync'}
                    </span>
                    <span>{repeatPillLabel}</span>
                  </span>
                  <span className="material-symbols-outlined text-[13px] opacity-60">
                    {activeDropdown === 'repeat' ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {activeDropdown === 'repeat' && (
                  <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-[28px] border border-black/[0.08] bg-white p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_56px_rgba(0,0,0,0.2)] space-y-1 animate-fadeIn sm:absolute sm:left-0 sm:right-auto sm:top-full sm:bottom-auto sm:z-40 sm:mt-1 sm:w-full sm:max-h-80 sm:rounded-2xl sm:p-2 sm:shadow-2xl">
                    {/* Option: Doesn't repeat */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, recurrence: 'none' });
                        setActiveDropdown(null);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] flex items-center justify-between transition-colors ${
                        !formData.recurrence || formData.recurrence === 'none'
                          ? 'bg-teal-50 text-teal-800 font-semibold'
                          : 'text-[#64748B] hover:bg-[#F5F4FA]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                        <span>Doesn't repeat</span>
                      </div>
                      {(!formData.recurrence || formData.recurrence === 'none') && (
                        <span className="material-symbols-outlined text-[14px] text-teal-600 font-bold">check</span>
                      )}
                    </button>

                    <div className="border-t border-black/[0.05] my-1" />

                    {/* Presets */}
                    {[
                      { id: 'daily', label: 'Daily', icon: 'today' },
                      { id: 'weekly', label: 'Weekly', icon: 'view_week' },
                      { id: 'monthly', label: 'Monthly', icon: 'calendar_month' },
                      { id: 'yearly', label: 'Yearly', icon: 'calendar_today' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, recurrence: opt.id });
                          setActiveDropdown(null);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] flex items-center justify-between transition-colors ${
                          formData.recurrence === opt.id
                            ? 'bg-teal-50 text-teal-800 font-semibold'
                            : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[15px] text-teal-600">{opt.icon}</span>
                          <span>{opt.label}</span>
                        </div>
                        {formData.recurrence === opt.id && (
                          <span className="material-symbols-outlined text-[14px] text-teal-600 font-bold">check</span>
                        )}
                      </button>
                    ))}

                    {/* Custom days */}
                    <div className="pt-1 border-t border-black/[0.05]">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, recurrence: 'custom' })}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] flex items-center justify-between transition-colors ${
                          formData.recurrence === 'custom'
                            ? 'bg-teal-50 text-teal-800 font-semibold'
                            : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[15px] text-teal-600">tune</span>
                          <span>Custom days</span>
                        </div>
                        {formData.recurrence === 'custom' && (
                          <span className="material-symbols-outlined text-[14px] text-teal-600 font-bold">check</span>
                        )}
                      </button>

                      {formData.recurrence === 'custom' && (
                        <div className="p-2 bg-[#F5F4FA] rounded-xl mt-1.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Repeat on
                            </span>
                            <span className="text-[10px] text-teal-700 font-semibold">
                              {(formData.repeatDays || []).length} days
                            </span>
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {[
                              { day: 0, label: 'S', title: 'Sunday' },
                              { day: 1, label: 'M', title: 'Monday' },
                              { day: 2, label: 'T', title: 'Tuesday' },
                              { day: 3, label: 'W', title: 'Wednesday' },
                              { day: 4, label: 'T', title: 'Thursday' },
                              { day: 5, label: 'F', title: 'Friday' },
                              { day: 6, label: 'S', title: 'Saturday' }
                            ].map(({ day, label, title }) => {
                              const daysList = formData.repeatDays || [];
                              const isDaySelected = daysList.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  title={title}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = isDaySelected
                                      ? (daysList.length > 1 ? daysList.filter(d => d !== day) : daysList)
                                      : [...daysList, day].sort();
                                    setFormData({ ...formData, repeatDays: next });
                                  }}
                                  className={`w-7 h-7 rounded-lg text-[11px] font-bold transition flex items-center justify-center ${
                                    isDaySelected
                                      ? 'bg-[#0A84FF] text-white shadow-xs'
                                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-black/[0.05]'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-black/[0.04]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData({ ...formData, repeatDays: [1, 2, 3, 4, 5] });
                              }}
                              className="text-[10px] font-medium text-slate-500 hover:text-slate-800"
                            >
                              Weekdays
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData({ ...formData, repeatDays: [0, 6] });
                              }}
                              className="text-[10px] font-medium text-slate-500 hover:text-slate-800"
                            >
                              Weekends
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(null);
                              }}
                              className="text-[10px] font-bold text-[#0A84FF] hover:underline"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Time & Duration Row */}
              <div className="pt-2 border-t border-black/[0.05] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-indigo-600">schedule</span>
                    Time &amp; Duration
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      const nextFlex = !formData.isFlexible;
                      setFormData({
                        ...formData,
                        isFlexible: nextFlex,
                        durationMinutes: nextFlex ? null : 45,
                        endTime: nextFlex ? '' : (formData.startTime ? calculateEndTime(formData.startTime, 45) : '')
                      });
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold transition border ${
                      formData.isFlexible
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-[#F5F4FA] text-[#8E8E93] border-black/[0.04] hover:text-[#1A1B1F]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px]">all_inclusive</span>
                    <span>{formData.isFlexible ? 'Flexible' : 'Untimed'}</span>
                  </button>
                </div>

                {/* Cupertino Start / End Inputs */}
                <div className="flex items-center gap-2">
                  <CupertinoTimeInput
                    label="Start Time"
                    placeholder="e.g. 9am"
                    value={formData.startTime}
                    onChange={(val) => {
                      const next = { ...formData, startTime: val };
                      if (!formData.isFlexible) {
                        if (val && formData.durationMinutes) {
                          next.endTime = calculateEndTime(val, formData.durationMinutes);
                        } else if (val && formData.endTime) {
                          const diff = calculateDuration(val, formData.endTime);
                          if (diff > 0) next.durationMinutes = diff;
                        }
                      }
                      setFormData(next);
                    }}
                  />

                  <div className="pt-4 text-slate-300 shrink-0">
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </div>

                  <CupertinoTimeInput
                    label="End Time"
                    placeholder={formData.isFlexible ? 'Flexible' : 'e.g. 10:30am'}
                    value={formData.isFlexible ? '' : formData.endTime}
                    disabled={formData.isFlexible}
                    onChange={(val) => {
                      const next = { ...formData, endTime: val };
                      if (formData.startTime && val) {
                        const diff = calculateDuration(formData.startTime, val);
                        if (diff > 0) {
                          next.durationMinutes = diff;
                          next.isFlexible = false;
                        }
                      }
                      setFormData(next);
                    }}
                  />
                </div>

                {/* Duration Window Badge */}
                <div className="px-2.5 py-1 rounded-xl bg-[#F5F4FA] border border-black/[0.04] flex items-center justify-between text-[10px]">
                  <span className="text-[#8E8E93] font-medium">Schedule Window</span>
                  <span className="font-semibold text-indigo-700 truncate">
                    {formData.isFlexible
                      ? (formData.startTime ? `~ Flexible from ${formatTimeString(formData.startTime)}` : '~ Flexible (Untimed)')
                      : formData.startTime && formData.endTime
                      ? `${formatTimeString(formData.startTime)} – ${formatTimeString(formData.endTime)} (${formatDurationLabel(calculateDuration(formData.startTime, formData.endTime))})`
                      : formData.startTime
                      ? `${formatDurationLabel(formData.durationMinutes)} from ${formatTimeString(formData.startTime)}`
                      : `${formatDurationLabel(formData.durationMinutes)} block`}
                  </span>
                </div>

                {/* Duration Presets */}
                <div className="grid grid-cols-4 gap-1">
                  {[15, 30, 45, 60, 90, 120, 180].map((min) => {
                    const isSelected = !formData.isFlexible && formData.durationMinutes === min;
                    return (
                      <button
                        key={min}
                        type="button"
                        onClick={() => {
                          const next = { ...formData, durationMinutes: min, isFlexible: false };
                          if (formData.startTime) {
                            next.endTime = calculateEndTime(formData.startTime, min);
                          }
                          setFormData(next);
                        }}
                        className={`py-1 rounded-xl text-[10px] font-semibold transition text-center ${
                          isSelected
                            ? 'bg-[#0A84FF] text-white shadow-xs'
                            : 'bg-[#F5F4FA] text-[#1A1B1F] hover:bg-[#EBEBF0] border border-black/[0.04]'
                        }`}
                      >
                        {min < 60 ? `${min}m` : min % 60 === 0 ? `${min / 60}h` : `${(min / 60).toFixed(1)}h`}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        isFlexible: true,
                        durationMinutes: null,
                        endTime: ''
                      });
                    }}
                    className={`py-1 rounded-xl text-[10px] font-semibold transition flex items-center justify-center gap-1 ${
                      formData.isFlexible
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100 border border-amber-200/70'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[11px]">all_inclusive</span>
                    <span>Open</span>
                  </button>
                </div>
              </div>

              {/* Optional Hard Deadline Toggle */}
              <div className="pt-2 border-t border-black/[0.05]">
                {!showDeadline ? (
                  <button
                    type="button"
                    onClick={() => setShowDeadline(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition"
                  >
                    <span className="material-symbols-outlined text-[14px]">flag</span>
                    <span>+ Add Hard Deadline</span>
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Hard Deadline</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, deadlineDate: '', deadlineTime: '' });
                          setShowDeadline(false);
                        }}
                        className="text-red-500 hover:underline font-medium normal-case"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={formData.deadlineDate}
                        onChange={(e) => setFormData({ ...formData, deadlineDate: e.target.value })}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium bg-[#F5F4FA] border border-black/[0.08] outline-none focus:bg-white focus:border-[#0A84FF] transition"
                      />
                      <input
                        type="time"
                        disabled={!formData.deadlineDate}
                        value={formData.deadlineTime}
                        onChange={(e) => setFormData({ ...formData, deadlineTime: e.target.value })}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium bg-[#F5F4FA] border border-black/[0.08] outline-none focus:bg-white focus:border-[#0A84FF] disabled:opacity-40 transition"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Impact & Energy Card (Segmented Controls) */}
            <div className="p-3.5 rounded-2xl bg-white border border-black/[0.06] shadow-2xs space-y-3">
              {/* Impact Segmented Bar */}
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Impact Rating
                </span>
                <div className="grid grid-cols-3 gap-1 bg-[#F5F4FA] p-0.5 rounded-xl border border-black/[0.04]">
                  {['high', 'medium', 'low'].map((imp) => {
                    const isSelected = formData.impact === imp;
                    const conf = IMPACT_CONFIG[imp];
                    return (
                      <button
                        key={imp}
                        type="button"
                        onClick={() => setFormData({ ...formData, impact: imp })}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? `${conf.active} bg-white shadow-xs`
                            : 'text-[#8E8E93] hover:text-[#1A1B1F]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                        <span>{conf.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Energy Segmented Bar */}
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Energy Required
                </span>
                <div className="grid grid-cols-3 gap-1 bg-[#F5F4FA] p-0.5 rounded-xl border border-black/[0.04]">
                  {ENERGY_OPTIONS.map((opt) => {
                    const isSelected = formData.energy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, energy: opt.id })}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs'
                            : 'text-[#8E8E93] hover:text-[#1A1B1F]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">{opt.icon}</span>
                        <span>{opt.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Strategic Alignment Card (Goal & Habit) with Custom Micro-Popovers */}
            <div className="p-3.5 rounded-2xl bg-white border border-black/[0.06] shadow-2xs space-y-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Strategic Alignment
              </span>

              {/* Linked Strategic Goal Custom Popover */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-purple-600">flag</span>
                  Linked Strategic Goal
                </label>
                <div className="relative" ref={goalMenuRef}>
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'goal' ? null : 'goal')}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-[12px] transition ${
                      matchedGoal
                        ? 'bg-purple-50/70 border-purple-200 text-purple-900 font-medium shadow-2xs'
                        : 'bg-[#F5F4FA] border-black/[0.06] text-[#64748B] hover:bg-[#EBEBF0]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="material-symbols-outlined text-[15px] text-purple-600 shrink-0">
                        {matchedGoal ? (matchedGoal.icon || 'flag') : 'flag'}
                      </span>
                      <span className="truncate">
                        {matchedGoal ? matchedGoal.title : 'None (Independent Deliverable)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="material-symbols-outlined text-[15px] opacity-60">
                        {activeDropdown === 'goal' ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </button>

                  {activeDropdown === 'goal' && (
                    <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-[28px] border border-black/[0.08] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_56px_rgba(0,0,0,0.2)] space-y-0.5 animate-fadeIn sm:absolute sm:left-0 sm:right-auto sm:top-full sm:bottom-auto sm:z-50 sm:mt-1 sm:w-full sm:max-h-56 sm:rounded-xl sm:p-1 sm:shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, goalId: '' });
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg text-[12px] text-[#64748B] hover:bg-[#F5F4FA] flex items-center justify-between transition"
                      >
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[14px]">close</span>
                          <span>None (Independent Deliverable)</span>
                        </span>
                        {!formData.goalId && <span className="material-symbols-outlined text-[14px] text-[#0A84FF]">check</span>}
                      </button>
                      {goals.map((g) => {
                        const isSelected = formData.goalId === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => {
                              const goalAreas = getGoalAreas(g.id, goals);
                              setFormData(prev => ({
                                ...prev,
                                goalId: g.id,
                                areas: goalAreas && goalAreas.length > 0 ? goalAreas : prev.areas
                              }));
                              setActiveDropdown(null);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-[12px] flex items-center justify-between gap-2 transition ${
                              isSelected ? 'bg-[#0A84FF] text-white font-medium shadow-xs' : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className={`material-symbols-outlined text-[15px] shrink-0 ${isSelected ? 'text-white' : 'text-purple-600'}`}>
                                {g.icon || 'flag'}
                              </span>
                              <span className="truncate">{g.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Recurring Habit Custom Popover */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-rose-600">repeat</span>
                  Linked Recurring Habit
                </label>
                <div className="relative" ref={habitMenuRef}>
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'habit' ? null : 'habit')}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-[12px] transition ${
                      matchedHabit
                        ? 'bg-rose-50/70 border-rose-200 text-rose-900 font-medium shadow-2xs'
                        : 'bg-[#F5F4FA] border-black/[0.06] text-[#64748B] hover:bg-[#EBEBF0]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="material-symbols-outlined text-[15px] text-rose-600 shrink-0">
                        {matchedHabit ? (matchedHabit.icon || 'repeat') : 'repeat'}
                      </span>
                      <span className="truncate">
                        {matchedHabit ? matchedHabit.title : 'None (One-off Task)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {matchedHabit?.duration && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700">
                          {matchedHabit.duration}
                        </span>
                      )}
                      <span className="material-symbols-outlined text-[15px] opacity-60">
                        {activeDropdown === 'habit' ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </button>

                  {activeDropdown === 'habit' && (
                    <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-[28px] border border-black/[0.08] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_56px_rgba(0,0,0,0.2)] space-y-0.5 animate-fadeIn sm:absolute sm:left-0 sm:right-auto sm:top-full sm:bottom-auto sm:z-50 sm:mt-1 sm:w-full sm:max-h-56 sm:rounded-xl sm:p-1 sm:shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, habitId: '' });
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg text-[12px] text-[#64748B] hover:bg-[#F5F4FA] flex items-center justify-between transition"
                      >
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[14px]">close</span>
                          <span>None (One-off Task)</span>
                        </span>
                        {!formData.habitId && <span className="material-symbols-outlined text-[14px] text-[#0A84FF]">check</span>}
                      </button>
                      {habits.map((h) => {
                        const isSelected = formData.habitId === h.id;
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, habitId: h.id });
                              setActiveDropdown(null);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-[12px] flex items-center justify-between gap-2 transition ${
                              isSelected ? 'bg-[#0A84FF] text-white font-medium shadow-xs' : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className={`material-symbols-outlined text-[15px] shrink-0 ${isSelected ? 'text-white' : 'text-rose-600'}`}>
                                {h.icon || 'repeat'}
                              </span>
                              <span className="truncate">{h.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {h.duration && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isSelected ? 'bg-white/20 text-white' : 'bg-black/[0.05] text-[#64748B]'}`}>
                                  {h.duration}
                                </span>
                              )}
                              {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Areas of Life Card */}
            <div className="p-3.5 rounded-2xl bg-white border border-black/[0.06] shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-slate-500">category</span>
                  Areas of Life
                </span>
                <span className="text-[10px] text-slate-400">Multi-select</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {LIFE_AREAS.map((area) => {
                  const isSelected = (formData.areas || []).includes(area.label);
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => {
                        const current = formData.areas || [];
                        const next = isSelected
                          ? current.filter(a => a !== area.label)
                          : [...current, area.label];
                        setFormData({ ...formData, areas: next });
                        if (formData.goalId) {
                          saveGoalAreas(formData.goalId, next);
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold transition ${
                        isSelected
                          ? 'bg-[#0A84FF] text-white shadow-2xs'
                          : 'bg-[#F5F4FA] text-[#48484A] hover:bg-[#EBEBF0] border border-black/[0.04]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">{area.icon}</span>
                      <span>{area.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* ── Refined Footer Bar ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#F9F9FB] border-t border-black/[0.06]">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Delete this task?')) {
                onDeleteTask?.(task.id);
                onClose();
              }
            }}
            className="flex items-center gap-1 text-red-500 hover:text-red-600 text-[12px] font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
            <span>Delete</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[12px] font-medium text-[#71717A] hover:bg-black/[0.05] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-[12px] font-semibold bg-[#0A84FF] text-white hover:bg-[#0071E3] transition active:scale-95 shadow-sm shadow-blue-500/25"
            >
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
