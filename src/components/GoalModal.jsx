import React, { useState } from 'react';
import { InlineGoalCalendar } from './GoalDetailDrawer';

const CATEGORY_MAP = {
  career:   { label: 'Career & Craft', color: 'primary', icon: 'terminal' },
  health:   { label: 'Health & Athletics', color: 'secondary', icon: 'directions_run' },
  creative: { label: 'Creative & Mind', color: 'tertiary', icon: 'auto_stories' },
  finance:  { label: 'Finance & Freedom', color: 'primary', icon: 'payments' },
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

export default function GoalModal({
  isOpen,
  onClose,
  onAddGoal,
  habits = []
}) {
  const [newGoalForm, setNewGoalForm] = useState({
    title: '',
    categories: ['career'],
    why: '',
    dateType: 'open', // 'open' | 'week' | 'month' | 'year' | 'custom'
    targetDate: '',
    initialTasks: [''],
    linkedHabitIds: []
  });

  if (!isOpen) return null;

  const resetForm = () => {
    setNewGoalForm({
      title: '',
      categories: ['career'],
      why: '',
      dateType: 'open',
      targetDate: '',
      initialTasks: [''],
      linkedHabitIds: []
    });
    onClose();
  };

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (!newGoalForm.title.trim()) return;

    let computedDate = null;
    if (newGoalForm.dateType === 'week') computedDate = getEndOfWeek();
    else if (newGoalForm.dateType === 'month') computedDate = getEndOfMonth();
    else if (newGoalForm.dateType === 'year') computedDate = getEndOfYear();
    else if (newGoalForm.dateType === 'custom') computedDate = newGoalForm.targetDate || null;

    if (onAddGoal) {
      onAddGoal({
        title: newGoalForm.title.trim(),
        categories: newGoalForm.categories.length ? newGoalForm.categories : ['career'],
        why: newGoalForm.why.trim() || '',
        dateType: newGoalForm.dateType,
        targetDate: computedDate,
        initialTasks: newGoalForm.initialTasks.filter(t => t.trim().length > 0),
        linkedHabitIds: newGoalForm.linkedHabitIds,
        color: newGoalForm.categories[0] === 'health' ? 'secondary' : newGoalForm.categories[0] === 'creative' ? 'tertiary' : 'primary'
      });
    }

    resetForm();
  };

  const toggleCategorySelection = (catId) => {
    setNewGoalForm(prev => {
      const current = prev.categories || [];
      if (current.includes(catId)) {
        if (current.length === 1) return prev; // keep at least 1
        return { ...prev, categories: current.filter(c => c !== catId) };
      }
      return { ...prev, categories: [...current, catId] };
    });
  };

  const toggleHabitLinkage = (habitId) => {
    setNewGoalForm(prev => {
      const current = prev.linkedHabitIds || [];
      if (current.includes(habitId)) {
        return { ...prev, linkedHabitIds: current.filter(id => id !== habitId) };
      }
      return { ...prev, linkedHabitIds: [...current, habitId] };
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={resetForm}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_32px_100px_rgba(0,0,0,0.22)] overflow-hidden flex flex-col text-[#1A1B1F] dark:text-white transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-black/[0.06] dark:border-white/[0.06] bg-[#FAFAFC] dark:bg-[#252528] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0A84FF]" />
            <h3 className="text-[13px] font-bold text-[#1A1B1F] dark:text-white uppercase tracking-wider">
              Create Strategic Goal
            </h3>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="p-1.5 rounded-xl text-[#8E8E93] hover:text-[#1A1B1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
            title="Close (Esc)"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form & Two-Column Body */}
        <form onSubmit={handleAddGoal} className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
            {/* Left Column (7 cols ~ 58%) */}
            <div className="lg:col-span-7 p-5 sm:p-6 overflow-visible lg:overflow-y-auto space-y-5 border-r-0 lg:border-r border-black/[0.06] dark:border-white/[0.06]">
              {/* Goal Title */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Goal Title *
                </label>
                <textarea
                  rows={2}
                  required
                  autoFocus
                  value={newGoalForm.title}
                  onChange={(e) => setNewGoalForm({ ...newGoalForm, title: e.target.value })}
                  placeholder="e.g. Ship Portfolio Website v3, Run Half Marathon..."
                  className="w-full text-xl sm:text-2xl font-bold text-[#1A1B1F] dark:text-white placeholder-slate-300 dark:placeholder-slate-600 bg-transparent border-none outline-none resize-none tracking-tight leading-snug focus:ring-0"
                />
              </div>

              {/* Personal Anchor (The Why) */}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <span className="material-symbols-outlined text-[15px] text-[#0A84FF]">psychology</span>
                  <span>The Why <span className="text-[#8E8E93] font-normal normal-case">(Optional emotional anchor)</span></span>
                </div>
                <textarea
                  rows={3}
                  value={newGoalForm.why}
                  onChange={(e) => setNewGoalForm({ ...newGoalForm, why: e.target.value })}
                  placeholder="Why does this matter? What happens if you succeed or fail? Anchor intrinsic motivation..."
                  className="w-full p-3.5 rounded-2xl bg-[#F8F8FB] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] text-[13px] leading-relaxed text-[#1A1B1F] dark:text-white placeholder-slate-400 outline-none focus:bg-white dark:focus:bg-white/[0.08] focus:border-[#0A84FF] focus:ring-3 focus:ring-[#0A84FF]/10 transition resize-none shadow-2xs"
                />
              </div>

              {/* Kick-off Deliverables (Tasks) */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#0A84FF]">checklist</span>
                    <span>Kick-off Deliverables</span>
                  </span>
                  <span className="text-[10px] text-[#8E8E93] font-normal normal-case">
                    Auto-creates tasks in Planner
                  </span>
                </div>

                <div className="space-y-2">
                  {newGoalForm.initialTasks.map((taskText, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[12px] font-mono text-[#8E8E93] w-4 text-right">{idx + 1}.</span>
                      <input
                        type="text"
                        value={taskText}
                        onChange={(e) => {
                          const updated = [...newGoalForm.initialTasks];
                          updated[idx] = e.target.value;
                          setNewGoalForm({ ...newGoalForm, initialTasks: updated });
                        }}
                        placeholder={`Task ${idx + 1}: e.g. Audit backlog, Order gear...`}
                        className="flex-1 px-3.5 py-2 text-[12px] rounded-xl bg-[#F8F8FC] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] text-[#1A1B1F] dark:text-white placeholder:text-[#8E8E93] outline-none focus:bg-white dark:focus:bg-white/[0.08] focus:border-[#0A84FF] transition"
                      />
                      {newGoalForm.initialTasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = newGoalForm.initialTasks.filter((_, i) => i !== idx);
                            setNewGoalForm({ ...newGoalForm, initialTasks: updated });
                          }}
                          className="text-[#8E8E93] hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setNewGoalForm({ ...newGoalForm, initialTasks: [...newGoalForm.initialTasks, ''] })}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0A84FF] hover:underline pt-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    <span>+ Add another deliverable</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols ~ 42%) */}
            <div className="lg:col-span-5 p-5 sm:p-6 overflow-visible lg:overflow-y-auto space-y-5 bg-[#FBFBFE]/70 dark:bg-white/[0.02]">
              {/* Target Horizon with Auto-Loading Inline Calendar */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Target Horizon
                </label>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'open', label: 'Flexible (Default)', icon: 'all_inclusive' },
                      { id: 'week', label: 'End of Week', icon: 'date_range' },
                      { id: 'month', label: 'End of Month', icon: 'calendar_month' },
                      { id: 'custom', label: 'Pick a Date...', icon: 'edit_calendar' }
                    ].map(opt => {
                      const isSelected = newGoalForm.dateType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setNewGoalForm(prev => {
                              let nextDate = prev.targetDate;
                              if (opt.id === 'custom' && !nextDate) {
                                const d = new Date();
                                d.setDate(d.getDate() + 30);
                                nextDate = d.toISOString().slice(0, 10);
                              }
                              return { ...prev, dateType: opt.id, targetDate: nextDate };
                            });
                          }}
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition border cursor-pointer ${
                            isSelected
                              ? 'bg-[#0A84FF] text-white border-[#0A84FF] shadow-3xs'
                              : 'bg-white dark:bg-[#252528] text-[#64748B] dark:text-slate-300 border-black/[0.08] dark:border-white/[0.08] hover:bg-[#F0EFF5] dark:hover:bg-white/10'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Automatically loaded inline calendar when Pick a Date is active */}
                  {newGoalForm.dateType === 'custom' && (
                    <InlineGoalCalendar
                      selectedDate={newGoalForm.targetDate}
                      onSelectDate={(newDate) => setNewGoalForm(prev => ({ ...prev, targetDate: newDate }))}
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
                    const isChecked = (newGoalForm.categories || []).includes(catKey);
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => toggleCategorySelection(catKey)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition border cursor-pointer ${
                          isChecked
                            ? 'bg-[#0A84FF] text-white border-[#0A84FF] shadow-3xs'
                            : 'bg-white dark:bg-[#252528] text-[#64748B] dark:text-slate-300 border-black/[0.08] dark:border-white/[0.08] hover:bg-[#F0EFF5] dark:hover:bg-white/10'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">{info.icon}</span>
                        <span>{info.label}</span>
                        {isChecked && <span className="material-symbols-outlined text-[13px]">done</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Connected Driving Habits */}
              {habits && habits.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Connected Driving Rituals
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {habits.map(habit => {
                      const isLinked = (newGoalForm.linkedHabitIds || []).includes(habit.id);
                      return (
                        <button
                          key={habit.id}
                          type="button"
                          onClick={() => toggleHabitLinkage(habit.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition border cursor-pointer ${
                            isLinked
                              ? 'bg-purple-600 text-white border-purple-600 shadow-3xs'
                              : 'bg-white dark:bg-[#252528] text-[#64748B] dark:text-slate-300 border-black/[0.08] dark:border-white/[0.08] hover:bg-[#F0EFF5] dark:hover:bg-white/10'
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

          {/* Footer */}
          <div className="px-5 sm:px-6 py-3.5 border-t border-black/[0.06] dark:border-white/[0.06] bg-[#FAFAFC] dark:bg-[#252528] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-[12px] font-semibold text-[#64748B] dark:text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/5 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-[12px] font-semibold text-white bg-[#0A84FF] hover:bg-[#0071E3] rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
            >
              Save Strategic Goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
