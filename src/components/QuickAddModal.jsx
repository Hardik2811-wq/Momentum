import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  legacyDueDateForPlan,
  priorityFromImpact,
  todayPlanDate,
  tomorrowPlanDate,
  urgencyFromPlan,
  planDateLabel,
  effortLabel,
  formatDurationLabel,
  calculateDuration,
  calculateEndTime,
  parseCompoundDuration,
  formatTimeString,
  parseTimeString
} from '../lib/taskMetadata';
import { parseNaturalTask } from '../lib/nlpParser';
import { getGroqApiKey, parseWithGroq } from '../lib/groqClient';
import {
  harvestApiResult,
  recordAiSuccess,
  recordAiFailure,
  recordLocalHit
} from '../lib/nlpMemory';
import { LIFE_AREAS, DEFAULT_LIFE_AREAS, getGoalAreas, saveGoalAreas } from '../lib/lifeAreas';
import ApiKeyModal from './ApiKeyModal';

const EFFORT_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360];

const ENERGY_OPTIONS = [
  { id: 'High', label: 'High focus', icon: 'bolt' },
  { id: 'Medium', label: 'Medium', icon: 'battery_horiz_075' },
  { id: 'Low', label: 'Low effort', icon: 'coffee' }
];

export function MiniCalendarPicker({ selectedDate, onSelectDate, onClear }) {
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const d = new Date(`${selectedDate}T12:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

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
  const tomorrow = tomorrowPlanDate();
  const nextWeekDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 10);
  })();

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

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-[260px] p-2.5 bg-white rounded-2xl border border-black/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.16)] animate-fadeIn select-none text-[#1A1B1F]"
    >
      {/* Quick Presets */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        <button
          type="button"
          onClick={() => onSelectDate(today)}
          className={`py-1 rounded-lg text-[11px] font-medium transition text-center ${
            selectedDate === today
              ? 'bg-[#0A84FF] text-white shadow-xs font-semibold'
              : 'bg-[#F5F4FA] text-[#48484A] hover:bg-[#EBEBF0]'
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => onSelectDate(tomorrow)}
          className={`py-1 rounded-lg text-[11px] font-medium transition text-center ${
            selectedDate === tomorrow
              ? 'bg-[#0A84FF] text-white shadow-xs font-semibold'
              : 'bg-[#F5F4FA] text-[#48484A] hover:bg-[#EBEBF0]'
          }`}
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => onSelectDate(nextWeekDate)}
          className={`py-1 rounded-lg text-[11px] font-medium transition text-center ${
            selectedDate === nextWeekDate
              ? 'bg-[#0A84FF] text-white shadow-xs font-semibold'
              : 'bg-[#F5F4FA] text-[#48484A] hover:bg-[#EBEBF0]'
          }`}
        >
          +1 Week
        </button>
      </div>

      <div className="border-t border-black/[0.05] pt-2">
        {/* Month Header */}
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[12px] font-semibold text-[#1A1B1F] tracking-tight">{monthName}</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-[#F5F4FA] text-[#8E8E93] hover:text-[#1A1B1F] transition"
              title="Previous Month"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-[#F5F4FA] text-[#8E8E93] hover:text-[#1A1B1F] transition"
              title="Next Month"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 text-center mb-1 text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <span key={d} className="py-0.5">{d}</span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-0.5 text-center">
          {cells.map((cell, idx) => {
            if (!cell.isCurrentMonth) {
              return (
                <div key={idx} className="h-7 flex items-center justify-center text-[11px] text-[#C7C7CC] opacity-40">
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
                    ? 'bg-[#0A84FF] text-white shadow-xs font-semibold'
                    : isToday
                    ? 'text-[#0A84FF] font-bold hover:bg-blue-50'
                    : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                }`}
              >
                <span>{cell.day}</span>
                {isToday && !isSelected && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#0A84FF]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer: Clear Date */}
      {selectedDate && (
        <div className="border-t border-black/[0.05] mt-2 pt-1 text-center">
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-[#8E8E93] hover:text-red-500 font-medium transition"
          >
            Clear Date
          </button>
        </div>
      )}
    </div>
  );
}

export function CupertinoTimeInput({ value, onChange, placeholder = 'Set time', label = 'Start', disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const wrapperRef = useRef(null);

  const display = value ? formatTimeString(value) : '';

  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [isOpen]);

  const TIME_SLOTS = useMemo(() => {
    const slots = [];
    for (let h = 7; h <= 23; h++) {
      for (let m = 0; m < 60; m += 30) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <label className="block text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          type="text"
          disabled={disabled}
          value={disabled ? '' : (isOpen ? typed : display)}
          placeholder={placeholder}
          onFocus={() => {
            if (disabled) return;
            setTyped(display || '');
            setIsOpen(true);
          }}
          onChange={(e) => {
            if (disabled) return;
            setTyped(e.target.value);
            const parsed = parseTimeString(e.target.value);
            if (parsed) onChange(parsed);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const parsed = parseTimeString(typed);
              if (parsed) onChange(parsed);
              setIsOpen(false);
            }
          }}
          className={`w-full px-3 py-2 pr-7 rounded-xl text-[12px] font-semibold bg-[#F5F4FA] hover:bg-[#EBEBF0] focus:bg-white focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.12)] border border-black/[0.08] outline-none transition text-[#1A1B1F] ${
            disabled ? 'opacity-40 cursor-not-allowed bg-slate-100 hover:bg-slate-100' : ''
          }`}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setTyped('');
            }}
            className="absolute right-2 text-[#8E8E93] hover:text-red-500 text-[13px] flex items-center justify-center p-0.5 rounded-full hover:bg-black/[0.05]"
            title="Clear time"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-full max-h-48 overflow-y-auto rounded-xl bg-white border border-black/[0.08] shadow-2xl p-1 space-y-0.5 animate-fadeIn">
          {TIME_SLOTS.map((slot) => {
            const formatted = formatTimeString(slot);
            const isSelected = value === slot;
            return (
              <button
                key={slot}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(slot);
                  setIsOpen(false);
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-medium transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#0A84FF] text-white shadow-xs font-semibold'
                    : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                }`}
              >
                <span>{formatted}</span>
                {isSelected && <span className="material-symbols-outlined text-[12px]">check</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function QuickAddModal({
  isOpen,
  onClose,
  onAddTask,
  goals = [],
  habits = [],
  initialTime = '',
  initialDate = '',
  initialGoalId = '',
  initialHabitId = ''
}) {
  const [title, setTitle] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [impact, setImpact] = useState('low');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [isFlexible, setIsFlexible] = useState(false);
  const [hasSetDuration, setHasSetDuration] = useState(false);
  const [customEffortInput, setCustomEffortInput] = useState('');
  const [areas, setAreas] = useState([]);
  const [energy, setEnergy] = useState('Low');
  const [goalId, setGoalId] = useState('');
  const [habitId, setHabitId] = useState('');
  const [repeatType, setRepeatType] = useState('none'); // 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  const [repeatDays, setRepeatDays] = useState([1, 2, 3, 4, 5]); // 0=Sun, 1=Mon, ..., 6=Sat
  const [subtasks, setSubtasks] = useState([]);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Active micro-popover menu
  const [activeMenu, setActiveMenu] = useState(null); // 'date' | 'time' | 'areas' | 'energy' | 'goal' | 'habit' | 'repeat'
  const menuRef = useRef(null);

  const parsed = useMemo(() => parseNaturalTask(title, goals, habits), [title, goals, habits]);

  const timePillLabel = useMemo(() => {
    if (startTime && endTime) {
      return `${startTime} – ${endTime}`;
    }
    if (startTime && isFlexible) {
      return `${startTime} (~ Flexible)`;
    }
    if (startTime && durationMinutes) {
      return `${startTime} (${formatDurationLabel(durationMinutes)})`;
    }
    if (startTime) {
      return startTime;
    }
    if (isFlexible) {
      return '~ Flexible';
    }
    if (hasSetDuration && durationMinutes) {
      return formatDurationLabel(durationMinutes);
    }
    return 'Time & Duration';
  }, [startTime, endTime, isFlexible, durationMinutes, hasSetDuration]);

  const isTimeActive = Boolean(startTime || isFlexible || (hasSetDuration && durationMinutes));

  const repeatPillLabel = useMemo(() => {
    if (repeatType === 'none') return 'Repeat: Never';
    if (repeatType === 'daily') return 'Repeat: Daily';
    if (repeatType === 'weekly') return 'Repeat: Weekly';
    if (repeatType === 'monthly') return 'Repeat: Monthly';
    if (repeatType === 'yearly') return 'Repeat: Yearly';
    if (repeatType === 'custom') {
      const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      if (!repeatDays || repeatDays.length === 0) return 'Repeat: Custom';
      if (repeatDays.length === 7) return 'Repeat: Every day';
      if (repeatDays.length === 5 && [1, 2, 3, 4, 5].every(d => repeatDays.includes(d))) return 'Repeat: Weekdays';
      if (repeatDays.length === 2 && [0, 6].every(d => repeatDays.includes(d))) return 'Repeat: Weekends';
      return `Repeat: ${repeatDays.map(d => WEEKDAY_NAMES[d]).join(', ')}`;
    }
    return 'Repeat: Never';
  }, [repeatType, repeatDays]);

  // Sync on modal open
  useEffect(() => {
    if (!isOpen) return;
    const date = initialDate || '';
    setPlannedDate(date === 'Tomorrow' ? tomorrowPlanDate() : date === 'Today' ? todayPlanDate() : date === 'Someday' ? '' : date ? date : '');
    setDeadlineDate('');
    setDeadlineTime('');
    setStartTime(initialTime || '');
    setEndTime('');
    setDurationMinutes(45);
    setIsFlexible(false);
    setHasSetDuration(false);
    setCustomEffortInput('');
    setGoalId(initialGoalId || '');
    setHabitId(initialHabitId || '');
    setRepeatType('none');
    setRepeatDays([1, 2, 3, 4, 5]);
    setAreas([]);
    setEnergy('Low');
    setSubtasks([]);
    setShowSubtasks(false);
    setNewSubtaskInput('');
    setActiveMenu(null);
    setAiFeedback(null);
    setShowApiKeyModal(false);
  }, [isOpen, initialDate, initialGoalId, initialHabitId, initialTime]);

  // Click outside to close popovers
  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    if (activeMenu) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [activeMenu]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (activeMenu) setActiveMenu(null);
        else onClose();
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        handleSubmit(event);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, activeMenu, title, plannedDate, impact, startTime, endTime, durationMinutes, isFlexible, areas, energy, goalId, habitId, subtasks]);

  if (!isOpen) return null;

  const applyExtractedDetails = (data, shouldCleanTitle = false) => {
    if (shouldCleanTitle && data.cleanTitle) setTitle(data.cleanTitle);
    if (data.plannedDate) setPlannedDate(data.plannedDate);
    else if (data.dueDate === 'Today') setPlannedDate(todayPlanDate());
    else if (data.dueDate === 'Tomorrow') setPlannedDate(tomorrowPlanDate());
    else if (data.dueDate === 'This Week') setPlannedDate('');
    else if (data.dueDate === 'Pick Date' || data.dueDate === 'Someday') setPlannedDate('');
    
    if (data.startTime) setStartTime(data.startTime);
    if (data.endTime) setEndTime(data.endTime);

    if (data.isFlexible) {
      setIsFlexible(true);
      setDurationMinutes(null);
      setEndTime('');
      setHasSetDuration(true);
    } else if (data.durationMinutes !== undefined && data.durationMinutes !== null) {
      setDurationMinutes(Number(data.durationMinutes) || 45);
      setIsFlexible(false);
      setHasSetDuration(true);
      if (data.startTime && !data.endTime) {
        setEndTime(calculateEndTime(data.startTime, Number(data.durationMinutes) || 45));
      }
    } else if (data.startTime && data.endTime) {
      const diff = calculateDuration(data.startTime, data.endTime);
      if (diff > 0) {
        setDurationMinutes(diff);
        setIsFlexible(false);
        setHasSetDuration(true);
      }
    }

    if (Array.isArray(data.areas) && data.areas.length > 0) {
      setAreas(data.areas);
    } else if (data.category) {
      setAreas([data.category]);
    }
    if (data.energy) setEnergy(data.energy);
    if (data.goalId) {
      setGoalId(data.goalId);
      if (!data.areas || data.areas.length === 0) {
        const goalAreas = getGoalAreas(data.goalId, goals);
        if (goalAreas && goalAreas.length > 0) {
          setAreas(goalAreas);
        }
      }
    }
    if (data.habitId || data.linkedHabitId) setHabitId(data.habitId || data.linkedHabitId);
    if (Array.isArray(data.suggestedSubtasks) && data.suggestedSubtasks.length > 0) {
      setSubtasks(data.suggestedSubtasks.map((text, i) => ({
        id: `${Date.now()}-${i}`,
        title: typeof text === 'string' ? text : text.title || '',
        completed: false
      })));
      setShowSubtasks(true);
    }
  };

  const handleTitleChange = (val) => {
    setTitle(val);
    const local = parseNaturalTask(val, goals);
    if (local.hasDetected && local.confidence >= 0.5) {
      applyExtractedDetails(local.extracted, false);
    }
  };

  const handleAiBreakdown = async (explicitKey = null) => {
    const passedKey = typeof explicitKey === 'string' ? explicitKey.trim() : null;
    if (!title.trim() || isAiParsing) return;

    // Check if user has key configured
    const key = passedKey || getGroqApiKey();
    if (!key) {
      setShowApiKeyModal(true);
      return;
    }

    setAiFeedback(null);
    setIsAiParsing(true);
    try {
      const res = await parseWithGroq(title, goals, key);
      if (res.success && res.data) {
        applyExtractedDetails(res.data, true);
        harvestApiResult(title, res.data, { alreadyCounted: true });
        recordAiSuccess(title.trim(), res.model);
        const modelName = res.model ? res.model.split('/').pop() : 'Groq';
        setAiFeedback({
          type: 'success',
          message: `Auto-filled via Groq (${modelName})`
        });
      } else {
        const errorMsg = res.error || 'Groq request failed';
        recordAiFailure(title.trim(), errorMsg);
        setAiFeedback({
          type: 'error',
          message: errorMsg
        });
      }
    } catch (err) {
      const errorMsg = err?.message || 'Network connection failed';
      recordAiFailure(title.trim(), errorMsg);
      setAiFeedback({
        type: 'error',
        message: errorMsg
      });
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskInput.trim()) return;
    setSubtasks([
      ...subtasks,
      { id: `${Date.now()}-${subtasks.length}`, title: newSubtaskInput.trim(), completed: false }
    ]);
    setNewSubtaskInput('');
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!title.trim()) return;

    const latest = parseNaturalTask(title, goals, habits);
    if (latest.hasDetected && latest.confidence >= 0.6) {
      recordLocalHit(latest.learnedSource ? 'learned task pattern' : 'local task pattern');
    }

    const finalTitle = (latest.hasDetected && latest.cleanTitle) ? latest.cleanTitle : title.trim();

    onAddTask({
      id: Date.now(),
      title: finalTitle,
      urgency: urgencyFromPlan(plannedDate),
      impact,
      priority: priorityFromImpact(impact),
      category: areas.length > 0 ? (LIFE_AREAS.find(a => a.label === areas[0] || a.id === areas[0])?.shortLabel || areas[0]) : '',
      areas: areas.length > 0 ? areas : [],
      dueDate: legacyDueDateForPlan(plannedDate),
      date: legacyDueDateForPlan(plannedDate),
      plannedDate: plannedDate || null,
      deadlineDate: deadlineDate || null,
      deadlineTime: deadlineDate ? deadlineTime || null : null,
      startTime: startTime || null,
      endTime: isFlexible ? null : (endTime || null),
      durationMinutes: isFlexible ? null : (Number(durationMinutes) || 45),
      isFlexible: Boolean(isFlexible),
      energy,
      goalId: goalId || null,
      linkedHabitId: habitId || null,
      habitId: habitId || null,
      recurrence: repeatType !== 'none' ? repeatType : null,
      repeatDays: repeatType === 'custom' ? repeatDays : null,
      completed: false,
      subtasks: subtasks.map((st, i) => ({ id: st.id || `${Date.now()}-${i}`, title: st.title, completed: false }))
    });

    setTitle('');
    setSubtasks([]);
    setShowSubtasks(false);
    setAiFeedback(null);
    setShowApiKeyModal(false);
    onClose();
  };

  const currentPlanLabel = plannedDate === todayPlanDate()
    ? 'Today'
    : plannedDate === tomorrowPlanDate()
    ? 'Tomorrow'
    : plannedDate ? planDateLabel(plannedDate) : 'Pick a Date';

  const currentEnergyObj = ENERGY_OPTIONS.find(e => e.id === energy) || ENERGY_OPTIONS[0];
  const matchedGoal = goals.find(g => g.id === goalId);
  const matchedHabit = habits.find(h => h.id === habitId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/30 backdrop-blur-sm"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[680px] min-h-0 max-h-[calc(100dvh-1.5rem)] sm:min-h-[470px] sm:max-h-none overflow-visible rounded-[24px] bg-white border border-black/[0.08] shadow-[0_32px_96px_rgba(0,0,0,0.18)] flex flex-col justify-between transition-all text-[#1A1B1F]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        onMouseDown={(e) => e.stopPropagation()}
        ref={menuRef}
      >
        {/* ── Refined Apple-Style Header ── */}
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-black/[0.06] bg-[#FAFAFC]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] flex items-center justify-center text-white shadow-xs">
              <span className="material-symbols-outlined text-[17px]">add_task</span>
            </div>
            <div>
              <h3 id="quick-add-title" className="text-[15px] font-semibold text-[#1A1B1F] tracking-tight">
                Quick Add
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Capture and slot into your Momentum flow
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8E8E93] hover:text-[#1A1B1F] hover:bg-black/5 transition"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* ── Form Body ── */}
        <form
          onSubmit={handleSubmit}
          className={`p-4 sm:p-6 flex-1 min-h-0 flex flex-col justify-between ${
            activeMenu ? 'overflow-visible' : 'overflow-y-auto'
          } sm:overflow-visible overscroll-contain`}
        >
          {activeMenu && activeMenu !== 'time' && (
            <button
              type="button"
              aria-label="Close options"
              onClick={() => setActiveMenu(null)}
              className="fixed inset-0 z-[60] bg-black/30 sm:hidden"
            />
          )}
          <div className="space-y-4">
            {/* Main Hero Input Card */}
          <div className="rounded-2xl bg-[#F5F4FA] border border-black/[0.06] p-3.5 focus-within:bg-white focus-within:border-[#0A84FF]/60 focus-within:shadow-[0_0_0_3px_rgba(10,132,255,0.12)] transition-all">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-[#0A84FF]">
                edit_note
              </span>
              <input
                type="text"
                autoFocus
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="What needs to happen? (e.g. Design hero tomorrow 2pm 45m)"
                className="min-w-0 flex-1 text-[15px] font-semibold text-[#1A1B1F] placeholder:text-[#94A3B8] placeholder:font-normal bg-transparent outline-none tracking-tight"
              />
              <button
                type="button"
                onClick={() => handleAiBreakdown()}
                disabled={isAiParsing || !title.trim()}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold shadow-xs active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                  aiFeedback?.type === 'success'
                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80'
                    : aiFeedback?.type === 'error'
                    ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80'
                    : 'text-[#0A84FF] bg-blue-50 hover:bg-blue-100/80 border border-blue-200/60'
                }`}
                title="Auto-fill details and break down subtasks"
              >
                <span className={`material-symbols-outlined text-[15px] ${isAiParsing ? 'animate-spin' : ''}`}>
                  {isAiParsing ? 'progress_activity' : aiFeedback?.type === 'success' ? 'check' : aiFeedback?.type === 'error' ? 'error' : 'auto_awesome'}
                </span>
                <span>{isAiParsing ? 'Thinking…' : aiFeedback?.type === 'success' ? 'AI Filled' : 'AI Fill'}</span>
              </button>
            </div>
          </div>

          {/* AI Status Notification (Success / Failure feedback) */}
          {aiFeedback && (
            <div
              className={`flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium border animate-fadeIn ${
                aiFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[16px] shrink-0">
                  {aiFeedback.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span className="truncate">{aiFeedback.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {aiFeedback.type === 'error' && (
                  <button
                    type="button"
                    onClick={() => setShowApiKeyModal(true)}
                    className="text-[11px] font-bold text-rose-700 underline hover:text-rose-900 cursor-pointer"
                  >
                    Update Key
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAiFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                  title="Dismiss"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            </div>
          )}

          {/* Harmonious Detected Tags */}
          {parsed.hasDetected && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-0.5 animate-fadeIn">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">
                Detected:
              </span>
              {parsed.extracted.dueDate && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 font-medium">
                  <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                  {parsed.extracted.dueDate}
                </span>
              )}
              {parsed.extracted.startTime && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70 font-medium">
                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                  {parsed.extracted.startTime}
                </span>
              )}
              {parsed.extracted.durationMinutes && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70 font-medium">
                  <span className="material-symbols-outlined text-[12px]">timer</span>
                  {parsed.extracted.durationMinutes}m
                </span>
              )}
              {parsed.extracted.areas && parsed.extracted.areas.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/70 font-medium">
                  <span className="material-symbols-outlined text-[12px]">category</span>
                  {parsed.extracted.areas.join(', ')}
                </span>
              )}
              {parsed.extracted.goalTitle && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/70 font-medium">
                  <span className="material-symbols-outlined text-[12px]">flag</span>
                  {parsed.extracted.goalTitle}
                </span>
              )}
              {parsed.extracted.habitTitle && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/70 font-medium">
                  <span className="material-symbols-outlined text-[12px]">repeat</span>
                  {parsed.extracted.habitTitle}
                </span>
              )}
              {parsed.cleanTitle && parsed.cleanTitle !== title.trim() && (
                <button
                  type="button"
                  onClick={() => setTitle(parsed.cleanTitle)}
                  className="ml-auto text-[11px] text-[#0A84FF] hover:underline font-semibold"
                >
                  Clean title
                </button>
              )}
            </div>
          )}

          {/* ── Lively & Mature Smart Pills Toolbar ── */}
          <div className="relative pt-1 flex flex-wrap items-center gap-1.5">
            {/* Date Pill (Blue Hue) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === 'date' ? null : 'date')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition border shadow-xs ${
                  plannedDate
                    ? 'bg-blue-50 text-blue-700 border-blue-200/80 font-semibold'
                    : 'bg-white text-[#64748B] border-black/[0.08] hover:bg-[#F5F4FA]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px] text-blue-600">calendar_today</span>
                <span>{currentPlanLabel}</span>
                <span className="material-symbols-outlined text-[13px] opacity-60">expand_more</span>
              </button>

              {activeMenu === 'date' && (
                <div className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[calc(100dvh-1rem)] justify-center overflow-y-auto rounded-t-[28px] border border-black/[0.08] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_56px_rgba(0,0,0,0.2)] sm:absolute sm:left-0 sm:right-auto sm:top-full sm:bottom-auto sm:z-30 sm:mt-1.5 sm:block sm:max-h-none sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                  <MiniCalendarPicker
                    selectedDate={plannedDate}
                    onSelectDate={(d) => {
                      setPlannedDate(d);
                      setActiveMenu(null);
                    }}
                    onClear={() => {
                      setPlannedDate('');
                      setActiveMenu(null);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Unified Time & Duration Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === 'time' ? null : 'time')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition border shadow-xs ${
                  isTimeActive
                    ? isFlexible
                      ? 'bg-amber-50 text-amber-900 border-amber-200/80 font-semibold'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200/80 font-semibold'
                    : 'bg-white text-[#64748B] border-black/[0.08] hover:bg-[#F5F4FA]'
                }`}
              >
                <span className={`material-symbols-outlined text-[15px] ${isFlexible ? 'text-amber-600' : 'text-indigo-600'}`}>
                  {isFlexible ? 'all_inclusive' : 'schedule'}
                </span>
                <span>{timePillLabel}</span>
                <span className="material-symbols-outlined text-[13px] opacity-60">expand_more</span>
              </button>

              {activeMenu === 'time' && (
                <>
                  <button
                    type="button"
                    aria-label="Close time and duration options"
                    onClick={() => setActiveMenu(null)}
                    className="fixed inset-0 z-[60] bg-black/30 sm:hidden"
                  />
                  <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-[28px] border border-black/[0.08] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_56px_rgba(0,0,0,0.2)] space-y-3.5 sm:absolute sm:left-0 sm:right-auto sm:top-full sm:bottom-auto sm:z-40 sm:mt-1.5 sm:w-[340px] sm:max-h-none sm:overflow-visible sm:rounded-2xl sm:bg-white/95 sm:p-4 sm:shadow-[0_24px_70px_rgba(0,0,0,0.16)] animate-fadeIn">
                  <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
                  {/* Header: Title & Reset */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-indigo-600">schedule</span>
                      Time & Duration
                    </span>

                    {(startTime || endTime || isFlexible || hasSetDuration) && (
                      <button
                        type="button"
                        onClick={() => {
                          setStartTime('');
                          setEndTime('');
                          setIsFlexible(false);
                          setHasSetDuration(false);
                          setDurationMinutes(45);
                          setCustomEffortInput('');
                        }}
                        className="text-[11px] text-red-500 hover:underline font-medium transition"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Start & End Inputs Row */}
                  <div className="flex items-center gap-2">
                    <CupertinoTimeInput
                      label="Start Time"
                      placeholder="e.g. 9am"
                      value={startTime}
                      onChange={(val) => {
                        setStartTime(val);
                        if (!isFlexible) {
                          if (val && durationMinutes) {
                            setEndTime(calculateEndTime(val, durationMinutes));
                          } else if (val && endTime) {
                            const diff = calculateDuration(val, endTime);
                            if (diff > 0) setDurationMinutes(diff);
                          }
                        }
                        setHasSetDuration(true);
                      }}
                    />

                    <div className="pt-4 text-slate-300 shrink-0">
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </div>

                    <CupertinoTimeInput
                      label="End Time"
                      placeholder={isFlexible ? 'Flexible' : 'e.g. 10:30am'}
                      value={isFlexible ? '' : endTime}
                      disabled={isFlexible}
                      onChange={(val) => {
                        setEndTime(val);
                        if (startTime && val) {
                          const diff = calculateDuration(startTime, val);
                          if (diff > 0) {
                            setDurationMinutes(diff);
                            setHasSetDuration(true);
                          }
                        }
                      }}
                    />
                  </div>

                  {/* Live Window Indicator Badge */}
                  <div className="px-3 py-1.5 rounded-xl bg-[#F5F4FA] border border-black/[0.04] flex items-center justify-between text-[11px]">
                    <span className="text-[#8E8E93] font-medium">Duration Window</span>
                    <span className="font-semibold text-indigo-700">
                      {isFlexible
                        ? (startTime ? `~ Flexible from ${formatTimeString(startTime)}` : '~ Flexible (Untimed)')
                        : startTime && endTime
                        ? `${formatTimeString(startTime)} – ${formatTimeString(endTime)} (${formatDurationLabel(calculateDuration(startTime, endTime))})`
                        : startTime
                        ? `${formatDurationLabel(durationMinutes)} from ${formatTimeString(startTime)}`
                        : `${formatDurationLabel(durationMinutes)} block`}
                    </span>
                  </div>

                  {/* Duration Presets */}
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Duration Presets
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[15, 30, 45, 60, 90, 120, 180].map((min) => {
                        const isSelected = !isFlexible && durationMinutes === min;
                        return (
                          <button
                            key={min}
                            type="button"
                            onClick={() => {
                              setDurationMinutes(min);
                              setIsFlexible(false);
                              setHasSetDuration(true);
                              if (startTime) {
                                setEndTime(calculateEndTime(startTime, min));
                              }
                            }}
                            className={`py-1.5 rounded-xl text-[11px] font-semibold transition text-center ${
                              isSelected
                                ? 'bg-[#0A84FF] text-white shadow-xs'
                                : 'bg-[#F5F4FA] text-[#1A1B1F] hover:bg-[#EBEBF0] border border-black/[0.04]'
                            }`}
                          >
                            {min < 60 ? `${min}m` : min % 60 === 0 ? `${min / 60}h` : `${(min / 60).toFixed(1)}h`}
                          </button>
                        );
                      })}

                      {/* Replaces 4h with Open which enables flexible */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsFlexible(true);
                          setDurationMinutes(null);
                          setEndTime('');
                          setHasSetDuration(true);
                        }}
                        className={`py-1.5 rounded-xl text-[11px] font-semibold transition flex items-center justify-center gap-1 ${
                          isFlexible
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100 border border-amber-200/70'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">all_inclusive</span>
                        <span>Open</span>
                      </button>
                    </div>
                  </div>

                  {/* Custom Compound Duration */}
                  <div className="pt-2 border-t border-black/[0.06]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Custom Duration
                      </span>
                      <span className="text-[10px] text-[#8E8E93]">xd yh zm</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. 1h 30m, 75m, 1d 2h"
                        value={customEffortInput}
                        onChange={(e) => setCustomEffortInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            const parsedMins = parseCompoundDuration(customEffortInput);
                            if (parsedMins === 'open') {
                              setIsFlexible(true);
                              setDurationMinutes(null);
                              setEndTime('');
                              setHasSetDuration(true);
                              setCustomEffortInput('');
                            } else if (parsedMins && parsedMins > 0) {
                              setIsFlexible(false);
                              setDurationMinutes(parsedMins);
                              setHasSetDuration(true);
                              if (startTime) {
                                setEndTime(calculateEndTime(startTime, parsedMins));
                              }
                              setCustomEffortInput('');
                            }
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl text-[11px] font-medium bg-[#F5F4FA] border border-black/[0.08] outline-none focus:bg-white focus:border-[#0A84FF] transition"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const parsedMins = parseCompoundDuration(customEffortInput);
                          if (parsedMins === 'open') {
                            setIsFlexible(true);
                            setDurationMinutes(null);
                            setEndTime('');
                            setHasSetDuration(true);
                            setCustomEffortInput('');
                          } else if (parsedMins && parsedMins > 0) {
                            setIsFlexible(false);
                            setDurationMinutes(parsedMins);
                            setHasSetDuration(true);
                            if (startTime) {
                              setEndTime(calculateEndTime(startTime, parsedMins));
                            }
                            setCustomEffortInput('');
                          }
                        }}
                        disabled={!customEffortInput.trim()}
                        className="px-3 py-1.5 rounded-xl bg-[#0A84FF] text-white text-[11px] font-semibold hover:bg-[#0071E3] transition disabled:opacity-40 shadow-xs"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  {/* Quick Extend (if start time set and not flexible) */}
                  {startTime && !isFlexible && (
                    <div className="pt-2 border-t border-black/[0.06]">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Extend End Time
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[15, 30, 60, 120].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => {
                              const base = (endTime && startTime) ? calculateDuration(startTime, endTime) : (durationMinutes || 0);
                              const nextDur = base + mins;
                              setDurationMinutes(nextDur);
                              setHasSetDuration(true);
                              setEndTime(calculateEndTime(startTime, nextDur));
                            }}
                            className="py-1 rounded-xl text-[11px] font-medium bg-[#F5F4FA] hover:bg-indigo-50 hover:text-indigo-700 text-[#1A1B1F] border border-black/[0.04] transition text-center"
                          >
                            +{mins < 60 ? `${mins}m` : `${mins / 60}h`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Done / Close Button */}
                  <div className="pt-2 border-t border-black/[0.06] flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveMenu(null)}
                      className="px-4 py-1.5 rounded-xl bg-[#1A1B1F] text-white text-[12px] font-semibold hover:bg-black transition shadow-xs"
                    >
                      Done
                    </button>
                  </div>
                  </div>
                </>
              )}
            </div>

            {/* Area of Life Pill (Multi-select) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === 'areas' ? null : 'areas')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition border shadow-xs ${
                  areas.length > 0
                    ? 'bg-slate-50 text-[#1A1B1F] border-slate-200 font-semibold'
                    : 'bg-white text-[#64748B] border-black/[0.08] hover:bg-[#F5F4FA]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px] text-[#0A84FF]">category</span>
                <span>
                  {areas.length === 0
                    ? 'Area of Life'
                    : areas.length === 1
                    ? (LIFE_AREAS.find(a => a.label === areas[0] || a.id === areas[0])?.shortLabel || areas[0])
                    : `${areas.length} Areas`}
                </span>
                <span className="material-symbols-outlined text-[13px] opacity-60">expand_more</span>
              </button>

              {activeMenu === 'areas' && (
                <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-[28px] border border-black/[0.08] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_56px_rgba(0,0,0,0.2)] space-y-0.5 animate-fadeIn sm:absolute sm:right-auto sm:left-0 sm:top-full sm:bottom-auto sm:z-30 sm:mt-1.5 sm:w-60 sm:max-h-64 sm:rounded-2xl sm:p-1.5 sm:shadow-2xl">
                  {/* Top Option: No linked area of life */}
                  <button
                    type="button"
                    onClick={() => {
                      setAreas([]);
                      if (goalId) saveGoalAreas(goalId, []);
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] text-[#64748B] hover:bg-[#F5F4FA] flex items-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                    <span>No linked area of life</span>
                  </button>

                  {LIFE_AREAS.map(area => {
                    const isSelected = areas.includes(area.label) || areas.includes(area.id);
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => {
                          const next = isSelected
                            ? areas.filter(a => a !== area.label && a !== area.id)
                            : [...areas, area.label];
                          setAreas(next);
                          if (goalId) {
                            saveGoalAreas(goalId, next);
                          }
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-[12px] flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-slate-50 text-[#1A1B1F] font-semibold'
                            : 'text-[#48484A] hover:bg-[#F5F4FA]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full ${area.dotClass} shrink-0`} />
                          <span className="text-[12px]">{area.label}</span>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-[15px] text-[#0A84FF] font-bold">
                            check
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Energy Pill (Emerald Hue) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === 'energy' ? null : 'energy')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-emerald-50/80 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100 shadow-xs transition"
              >
                <span className="material-symbols-outlined text-[15px] text-emerald-600">{currentEnergyObj.icon}</span>
                <span>{currentEnergyObj.label}</span>
                <span className="material-symbols-outlined text-[13px] opacity-60">expand_more</span>
              </button>

              {activeMenu === 'energy' && (
                <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-[28px] border border-black/[0.08] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_56px_rgba(0,0,0,0.2)] space-y-0.5 animate-fadeIn sm:absolute sm:left-0 sm:right-auto sm:top-full sm:bottom-auto sm:z-20 sm:mt-1.5 sm:w-40 sm:max-h-none sm:rounded-xl sm:p-1 sm:shadow-xl">
                  {ENERGY_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { setEnergy(opt.id); setActiveMenu(null); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] flex items-center gap-2 ${
                        energy === opt.id ? 'bg-[#0A84FF] text-white font-medium' : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Goal Pill (Purple Hue) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === 'goal' ? null : 'goal')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition border shadow-xs ${
                  goalId
                    ? 'bg-purple-50 text-purple-700 border-purple-200/80 font-semibold max-w-[150px] truncate'
                    : 'bg-white text-[#64748B] border-black/[0.08] hover:bg-[#F5F4FA]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px] text-purple-600">flag</span>
                <span className="truncate">{matchedGoal ? matchedGoal.title : 'Link Goal'}</span>
                <span className="material-symbols-outlined text-[13px] opacity-60">expand_more</span>
              </button>

              {activeMenu === 'goal' && (
                <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-[28px] border border-black/[0.08] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_56px_rgba(0,0,0,0.2)] space-y-0.5 animate-fadeIn sm:absolute sm:left-0 sm:right-auto sm:top-full sm:bottom-auto sm:z-20 sm:mt-1.5 sm:w-52 sm:max-h-48 sm:rounded-xl sm:p-1 sm:shadow-xl">
                  <button
                    type="button"
                    onClick={() => { setGoalId(''); setActiveMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] text-[#64748B] hover:bg-[#F5F4FA]"
                  >
                    No linked goal
                  </button>
                  {goals.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setGoalId(g.id);
                        const goalAreas = getGoalAreas(g.id, goals);
                        if (goalAreas && goalAreas.length > 0) {
                          setAreas(goalAreas);
                        }
                        setActiveMenu(null);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] truncate ${
                        goalId === g.id ? 'bg-[#0A84FF] text-white font-medium' : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                      }`}
                    >
                      {g.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Habit Pill (Rose Hue) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === 'habit' ? null : 'habit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition border shadow-xs ${
                  habitId
                    ? 'bg-rose-50 text-rose-700 border-rose-200/80 font-semibold max-w-[150px] truncate'
                    : 'bg-white text-[#64748B] border-black/[0.08] hover:bg-[#F5F4FA]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px] text-rose-600">
                  {matchedHabit?.icon || 'repeat'}
                </span>
                <span className="truncate">{matchedHabit ? matchedHabit.title : 'Link Habit'}</span>
                <span className="material-symbols-outlined text-[13px] opacity-60">expand_more</span>
              </button>

              {activeMenu === 'habit' && (
                <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-[28px] border border-black/[0.08] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_56px_rgba(0,0,0,0.2)] space-y-0.5 animate-fadeIn sm:absolute sm:left-0 sm:right-auto sm:top-full sm:bottom-auto sm:z-20 sm:mt-1.5 sm:w-56 sm:max-h-48 sm:rounded-xl sm:p-1 sm:shadow-xl">
                  <button
                    type="button"
                    onClick={() => { setHabitId(''); setActiveMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] text-[#64748B] hover:bg-[#F5F4FA] flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                    <span>No linked habit</span>
                  </button>
                  {habits.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => { setHabitId(h.id); setActiveMenu(null); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] flex items-center justify-between gap-2 ${
                        habitId === h.id ? 'bg-[#0A84FF] text-white font-medium' : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`material-symbols-outlined text-[15px] shrink-0 ${habitId === h.id ? 'text-white' : 'text-rose-500'}`}>
                          {h.icon || 'repeat'}
                        </span>
                        <span className="truncate">{h.title}</span>
                      </div>
                      {h.duration && (
                        <span className={`text-[10px] shrink-0 ${habitId === h.id ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                          {h.duration}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Repeat / Recurrence Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === 'repeat' ? null : 'repeat')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition border shadow-xs ${
                  repeatType !== 'none'
                    ? 'bg-teal-50 text-teal-800 border-teal-200/80 font-semibold'
                    : 'bg-white text-[#64748B] border-black/[0.08] hover:bg-[#F5F4FA]'
                }`}
              >
                <span className={`material-symbols-outlined text-[15px] ${
                  repeatType !== 'none' ? 'text-teal-600' : 'text-[#8E8E93]'
                }`}>
                  {repeatType !== 'none' ? 'event_repeat' : 'sync'}
                </span>
                <span>{repeatPillLabel}</span>
                <span className="material-symbols-outlined text-[13px] opacity-60">expand_more</span>
              </button>

              {activeMenu === 'repeat' && (
                <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-[28px] border border-black/[0.08] bg-white p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_56px_rgba(0,0,0,0.2)] space-y-1 animate-fadeIn sm:absolute sm:left-0 sm:right-auto sm:top-full sm:bottom-auto sm:z-30 sm:mt-1.5 sm:w-64 sm:max-h-80 sm:rounded-2xl sm:p-2 sm:shadow-2xl">
                  {/* Option: Doesn't repeat */}
                  <button
                    type="button"
                    onClick={() => {
                      setRepeatType('none');
                      setActiveMenu(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] flex items-center justify-between transition-colors ${
                      repeatType === 'none'
                        ? 'bg-teal-50 text-teal-800 font-semibold'
                        : 'text-[#64748B] hover:bg-[#F5F4FA]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                      <span>Doesn't repeat</span>
                    </div>
                    {repeatType === 'none' && (
                      <span className="material-symbols-outlined text-[14px] text-teal-600 font-bold">check</span>
                    )}
                  </button>

                  <div className="border-t border-black/[0.05] my-1" />

                  {/* Preset Frequencies */}
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
                        setRepeatType(opt.id);
                        setActiveMenu(null);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] flex items-center justify-between transition-colors ${
                        repeatType === opt.id
                          ? 'bg-teal-50 text-teal-800 font-semibold'
                          : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[15px] text-teal-600">{opt.icon}</span>
                        <span>{opt.label}</span>
                      </div>
                      {repeatType === opt.id && (
                        <span className="material-symbols-outlined text-[14px] text-teal-600 font-bold">check</span>
                      )}
                    </button>
                  ))}

                  {/* Custom Option */}
                  <div className="pt-1 border-t border-black/[0.05]">
                    <button
                      type="button"
                      onClick={() => setRepeatType('custom')}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] flex items-center justify-between transition-colors ${
                        repeatType === 'custom'
                          ? 'bg-teal-50 text-teal-800 font-semibold'
                          : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[15px] text-teal-600">tune</span>
                        <span>Custom days</span>
                      </div>
                      {repeatType === 'custom' && (
                        <span className="material-symbols-outlined text-[14px] text-teal-600 font-bold">check</span>
                      )}
                    </button>

                    {/* S M T W T F S selector when Custom is selected */}
                    {repeatType === 'custom' && (
                      <div className="p-2 bg-[#F5F4FA] rounded-xl mt-1.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Repeat on
                          </span>
                          <span className="text-[10px] text-teal-700 font-semibold">
                            {repeatDays.length} days
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
                            const isDaySelected = repeatDays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                title={title}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const next = isDaySelected
                                    ? (repeatDays.length > 1 ? repeatDays.filter(d => d !== day) : repeatDays)
                                    : [...repeatDays, day].sort();
                                  setRepeatDays(next);
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
                        <div className="flex items-center gap-1 pt-1 justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRepeatDays([1, 2, 3, 4, 5]);
                            }}
                            className="text-[9.5px] font-semibold text-slate-500 hover:text-[#0A84FF] px-1.5 py-0.5 rounded bg-white border border-black/[0.04]"
                          >
                            Weekdays
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRepeatDays([0, 6]);
                            }}
                            className="text-[9.5px] font-semibold text-slate-500 hover:text-[#0A84FF] px-1.5 py-0.5 rounded bg-white border border-black/[0.04]"
                          >
                            Weekends
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Optional Subtasks Section ── */}
          <div className="pt-1">
            {!showSubtasks && subtasks.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowSubtasks(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0A84FF] hover:text-[#0071E3] transition px-2 py-1 rounded-lg hover:bg-blue-50/60"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add subtasks (optional)</span>
              </button>
            ) : (
              <div className="rounded-2xl bg-[#F5F4FA] border border-black/[0.06] p-3.5 space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B]">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#0A84FF]">checklist</span>
                    <span>Subtasks {subtasks.length > 0 && `(${subtasks.length})`}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSubtasks([]); setShowSubtasks(false); }}
                    className="text-[11px] text-[#8E8E93] hover:text-red-500 transition"
                  >
                    Remove
                  </button>
                </div>

                {/* Subtask list */}
                {subtasks.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {subtasks.map((st, idx) => (
                      <div key={st.id || idx} className="flex items-center gap-2 p-2 rounded-xl bg-white border border-black/[0.04] text-[12px] text-[#1A1B1F] shadow-2xs group">
                        <span className="material-symbols-outlined text-[15px] text-[#0A84FF]">check_box_outline_blank</span>
                        <span className="flex-1 truncate">{st.title}</span>
                        <button
                          type="button"
                          onClick={() => setSubtasks(subtasks.filter((_, i) => i !== idx))}
                          className="p-0.5 text-[#9AA0A6] hover:text-red-500 transition opacity-60 group-hover:opacity-100"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input for adding new subtask */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSubtaskInput}
                    onChange={(e) => setNewSubtaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    placeholder="+ Add a subtask (press Enter)"
                    className="w-full px-3 py-1.5 rounded-xl text-[12px] bg-white border border-black/[0.08] text-[#1A1B1F] placeholder:text-[#94A3B8] outline-none focus:border-[#0A84FF] focus:shadow-[0_0_0_2px_rgba(10,132,255,0.12)] transition"
                  />
                  {newSubtaskInput.trim() && (
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-[#0A84FF] text-white hover:bg-[#0071E3] transition shrink-0"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="pt-3 flex items-center justify-between border-t border-black/[0.05] mt-auto">
            <span className="text-[11px] text-[#94A3B8] font-medium hidden sm:inline">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[#F5F4FA] border border-black/[0.08] font-mono text-[10px] text-slate-600">↵</kbd> to add task
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-[13px] font-medium text-[#64748B] hover:text-[#1A1B1F] hover:bg-black/5 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="px-5 py-2 rounded-xl text-[13px] font-semibold bg-[#0A84FF] hover:bg-[#0071E3] text-white shadow-sm shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add Task
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* BYOK API Key Prompt Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSuccess={(savedKey) => {
          setShowApiKeyModal(false);
          handleAiBreakdown(savedKey);
        }}
      />
    </div>
  );
}
