import React, { useState, useEffect, useMemo } from 'react';
import { todayPlanDate } from '../lib/taskMetadata';

const CATEGORY_MAP = {
  career:   { label: 'Career & Craft', color: 'primary', icon: 'terminal' },
  health:   { label: 'Health & Athletics', color: 'secondary', icon: 'directions_run' },
  creative: { label: 'Creative & Mind', color: 'tertiary', icon: 'auto_stories' },
  finance:  { label: 'Finance & Freedom', color: 'primary', icon: 'payments' },
};

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
    onUpdateGoal?.(goal.id, {
      title: title.trim(),
      why: why.trim(),
      categories,
      dateType,
      targetDate: dateType === 'open' ? null : targetDate,
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300 border-l border-black/[0.08]"
      >
        {/* ── Top Header ── */}
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0A84FF]" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">
              Goal Command Center
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Switcher */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full border border-black/[0.08] bg-[#F8F8FC] text-[#1A1B1F] outline-none"
            >
              <option value="active">Active Horizon</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
            </select>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#8E8E93] hover:text-[#1A1B1F] hover:bg-[#F5F4FA] transition"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Goal Title Input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1">
              Horizon Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xl font-bold text-[#1A1B1F] tracking-tight outline-none border-b border-transparent focus:border-[#0A84FF] transition pb-1"
            />
          </div>

          {/* Categories Multi-Select */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1.5">
              Categories
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.entries(CATEGORY_MAP).map(([catKey, info]) => {
                const isSelected = categories.includes(catKey);
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => toggleCategory(catKey)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition border ${
                      isSelected
                        ? 'bg-[#0A84FF] text-white border-[#0A84FF] shadow-3xs'
                        : 'bg-[#F8F8FC] text-[#64748B] border-black/[0.06] hover:bg-[#F0EFF5]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">{info.icon}</span>
                    <span>{info.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Horizon / Deadline */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1.5">
              Target Horizon
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'open', label: 'Open / Flexible' },
                { id: 'month', label: 'End of Month' },
                { id: 'custom', label: 'Specific Date' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDateType(opt.id)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition border ${
                    dateType === opt.id
                      ? 'bg-[#1A1B1F] text-white border-[#1A1B1F]'
                      : 'bg-[#F8F8FC] text-[#64748B] border-black/[0.06]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              {dateType === 'custom' && (
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="px-2.5 py-1 text-[11px] rounded-xl border border-black/[0.08] bg-[#F8F8FC] outline-none"
                />
              )}
            </div>
          </div>

          {/* The Why (Optional Emotional Anchor) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1">
              Personal Anchor (The Why)
            </label>
            <textarea
              rows="2"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Why does this matter? What is the core outcome?"
              className="w-full px-3 py-2 text-[12px] rounded-xl bg-[#F8F8FC] border border-black/[0.06] text-[#1A1B1F] outline-none focus:bg-white focus:border-[#0A84FF] transition resize-none"
            />
          </div>

          {/* ── Deep Work Focus Investment Widget ── */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/40 border border-blue-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A84FF]">Deep Work Invested</span>
              <div className="mt-0.5 text-xl font-bold text-[#1A1B1F]">
                {focusStats.hours} <span className="text-xs font-normal text-[#64748B]">hours ({focusStats.count} focus blocks)</span>
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

          {/* ── Execution Task Pipeline ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#1A1B1F]">
                  Execution Pipeline
                </span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#F0EFF5] text-[#64748B]">
                  {progressPercent}% Done ({completedTasks.length}/{linkedTasks.length})
                </span>
              </div>
            </div>

            {/* Quick Inline Task Creator */}
            <form onSubmit={handleCreateTask} className="flex items-center gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="+ Add deliverable to this goal (Press Enter)..."
                className="flex-1 px-3 py-2 text-[12px] rounded-xl bg-[#F8F8FC] border border-black/[0.06] text-[#1A1B1F] placeholder:text-[#8E8E93] outline-none focus:bg-white focus:border-[#0A84FF] transition"
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="px-3 py-2 rounded-xl bg-[#0A84FF] text-white text-[11px] font-semibold hover:bg-[#0071E3] transition disabled:opacity-40"
              >
                Add
              </button>
            </form>

            {/* Incomplete Tasks Checklist */}
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
                        title="Start Pomodoro focus on this task"
                      >
                        <span className="material-symbols-outlined text-[16px]">play_circle</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {openTasks.length === 0 && (
                <p className="text-[12px] text-[#8E8E93] italic py-2">
                  No active tasks. Add deliverables above to move this horizon forward.
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
                  <span>{completedTasks.length} Completed {completedTasks.length === 1 ? 'task' : 'tasks'}</span>
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

          {/* ── Connected Driving Habits ── */}
          {habits && habits.length > 0 && (
            <div className="pt-2 border-t border-black/[0.04] space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                Connected Driving Rituals
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {habits.map(habit => {
                  const isLinked = linkedHabitIds.includes(habit.id);
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      onClick={() => toggleHabit(habit.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition border ${
                        isLinked
                          ? 'bg-purple-600 text-white border-purple-600 shadow-3xs'
                          : 'bg-[#F8F8FC] text-[#64748B] border-black/[0.06] hover:bg-[#F0EFF5]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">{habit.icon || 'repeat'}</span>
                      <span>{habit.title}</span>
                      {isLinked && <span className="material-symbols-outlined text-[13px]">done</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── Bottom Fixed Action Bar ── */}
        <div className="px-6 py-4 border-t border-black/[0.06] bg-[#FAFAFC] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onDeleteGoal && goal?.id) {
                onDeleteGoal(goal.id);
                onClose();
              }
            }}
            className="text-[11px] font-semibold text-red-500 hover:text-red-700 transition"
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
