import React, { useState, useMemo } from 'react';
import { calcStreak, last7Days, todayKey, DAY_LABELS } from '../store/useStore';
import HabitModal from '../components/HabitModal';
import ConfirmModal from '../components/ConfirmModal';
import { computeHabitDecayMetrics } from '../lib/habitDecayGuard';

const HABIT_COLOR_CLASSES = {
  primary: { fixed: 'bg-[#0F52BA]/10 text-[#0F52BA] dark:text-[#6495ED]', text: 'text-[#0F52BA] dark:text-[#6495ED]', checked: 'bg-[#0F52BA] text-white' },
  secondary: { fixed: 'bg-[#2E6F40]/10 text-[#2E6F40] dark:text-[#4ADE80]', text: 'text-[#2E6F40] dark:text-[#4ADE80]', checked: 'bg-[#2E6F40] text-white' },
  tertiary: { fixed: 'bg-[#C84B31]/10 text-[#C84B31] dark:text-[#F87171]', text: 'text-[#C84B31] dark:text-[#F87171]', checked: 'bg-[#C84B31] text-white' }
};

const HabitsView = React.memo(function HabitsView({ habits = [], checkInHabit, addHabit, updateHabit, deleteHabit, useGraceDay, goals = [], stats = {} }) {
  const [dailyToggle, setDailyToggle] = useState('Daily');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);

  const handleOpenCreate = () => {
    setEditingHabit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (habit) => {
    setEditingHabit(habit);
    setIsModalOpen(true);
  };

  const handleSaveHabit = (habitData) => {
    if (habitData.id && habits.some(h => h.id === habitData.id)) {
      if (updateHabit) {
        updateHabit(habitData.id, habitData);
      }
    } else {
      addHabit(habitData);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [habitToDelete, setHabitToDelete] = useState(null);

  const handleApplyGraceToday = (habit) => {
    if (!habit.graceDays || habit.graceDays <= 0) return;
    const today = todayKey();
    const isCompleted = (habit.completedDays || []).includes(today);
    if (!isCompleted) {
      checkInHabit(habit.id, today);
    }
    useGraceDay(habit.id);
  };

  const completionPct = stats.totalHabits ? Math.round((stats.habitsCompletedToday / stats.totalHabits) * 100) : 0;
  const totalGraceDays = habits.reduce((acc, h) => acc + (h.graceDays || 0), 0);

  const currentYear = new Date().getFullYear();
  const today = todayKey();

  // Precompute last 7 days metadata once (zero Date allocations in habit list)
  const weekDaysMeta = useMemo(() => {
    const days = last7Days();
    const tDay = todayKey();
    return days.map(dayStr => {
      const d = new Date(`${dayStr}T12:00:00`);
      return {
        dayStr,
        isToday: dayStr === tDay,
        dayLabel: DAY_LABELS[d.getDay()] || 'D',
        formattedDate: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      };
    });
  }, []);

  const calendarData = useMemo(() => {
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31);

    // Mon=0, Sun=6
    const startDayOfWeek = (startDate.getDay() + 6) % 7;
    const calendarStart = new Date(startDate);
    calendarStart.setDate(calendarStart.getDate() - startDayOfWeek);

    const dayMap = new Map();
    habits.forEach(h => {
      (h.completedDays || []).forEach(d => {
        if (!dayMap.has(d)) dayMap.set(d, []);
        dayMap.get(d).push(h);
      });
    });

    const weeks = [];
    let curr = new Date(calendarStart);
    let lastMonth = -1;

    while (curr <= endDate || (curr.getDay() + 6) % 7 !== 0) {
      const weekDays = [];
      let weekMonthLabel = null;

      for (let i = 0; i < 7; i++) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;
        const isCurrentYear = y === currentYear;

        if (isCurrentYear && curr.getMonth() !== lastMonth) {
          weekMonthLabel = curr.toLocaleString('en-US', { month: 'short' });
          lastMonth = curr.getMonth();
        }

        const completedHabits = dayMap.get(key) || [];
        const completedCount = completedHabits.length;
        const isToday = key === today;
        const isFuture = key > today;

        weekDays.push({
          key,
          dayOfWeek: i,
          isCurrentYear,
          isToday,
          isFuture,
          completedCount,
          completedHabits,
          formattedDate: curr.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          })
        });

        curr.setDate(curr.getDate() + 1);
      }

      weeks.push({ weekMonthLabel, days: weekDays });
      if (curr > endDate && (curr.getDay() + 6) % 7 === 0) break;
    }

    return weeks;
  }, [habits, currentYear, today]);

  const longestYearStreak = useMemo(() => {
    return habits.reduce((max, h) => {
      const s = calcStreak(h.completedDays || []);
      return Math.max(max, s);
    }, 0);
  }, [habits]);

  const totalAnnualCompletions = useMemo(() => {
    return habits.reduce((total, h) => {
      const valid = (h.completedDays || []).filter(d => d.startsWith(`${currentYear}-`));
      return total + valid.length;
    }, 0);
  }, [habits, currentYear]);

  const handleExportLedger = () => {
    const ledgerData = {
      ledgerYear: currentYear,
      exportedAt: new Date().toISOString(),
      totalTrackedHabits: habits.length,
      totalCompletionsThisYear: totalAnnualCompletions,
      longestStreakDays: longestYearStreak,
      availableShieldDays: totalGraceDays,
      habits: habits.map(h => ({
        id: h.id,
        title: h.title,
        cadence: h.cadence,
        duration: h.duration,
        currentStreak: calcStreak(h.completedDays || []),
        annualCheckIns: (h.completedDays || []).filter(d => d.startsWith(`${currentYear}-`)).sort()
      }))
    };
    const blob = new Blob([JSON.stringify(ledgerData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `momentum-habits-ledger-${currentYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="w-full pt-[calc(3.85rem+env(safe-area-inset-top))] md:pt-15 pb-8 sm:pb-12 px-3.5 sm:px-6 md:px-margin-desktop min-h-screen bg-canvas dark:bg-canvas-dark text-[#161618] dark:text-[#F7F6F2] transition-colors duration-200">
      <div className="flex flex-col w-full space-y-3.5 sm:space-y-6 max-w-[1440px] mx-auto">
        {/* Editorial Header Masthead */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="hidden sm:flex items-center gap-2 mb-0.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#0F52BA] dark:text-[#6495ED] font-bold">Lindy Cadence Engine</span>
              <span className="w-1 h-1 rounded-full bg-[#8E8E93]" />
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[#2E6F40] dark:text-[#4ADE80]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E6F40] dark:bg-[#4ADE80] animate-pulse" />
                Live Sync Active
              </span>
            </div>
            <h1 className="font-editorial text-xl sm:text-3xl font-medium text-[#161618] dark:text-[#F7F6F2] tracking-tight">Habits &amp; Streaks</h1>
            <p className="hidden sm:block font-sans text-xs sm:text-sm text-[#6B6A72] dark:text-[#8E8E93] mt-0.5">Calibrated consistency without burnout. Built with graceful resilience.</p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#161618] hover:bg-[#2A2A2E] text-white dark:bg-[#F7F6F2] dark:text-[#161618] dark:hover:bg-white text-[11.5px] sm:text-xs font-semibold transition-all shadow-tactile active:scale-[0.98] shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">add</span>
            <span>New Habit</span>
          </button>
        </header>

        {/* ── Top Lindy Ritual Pulse Ledger Ribbon (Cardless Hairline Segmentation) ── */}
        <section data-block-id="habits-stats-ribbon" className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-black/[0.08] dark:divide-white/[0.08] rounded-2xl bg-white/70 dark:bg-[#18181C]/70 backdrop-blur-xs border border-black/[0.08] dark:border-white/[0.08] overflow-hidden shadow-2xs">
          <div className="p-3.5 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B6A72] dark:text-[#8E8E93]">Weekly Completion</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F52BA] animate-pulse" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-mono tabular-nums font-bold text-[#0F52BA] dark:text-[#6495ED]">{completionPct}%</span>
              <span className="text-[11px] font-mono text-[#6B6A72] dark:text-[#8E8E93]">Target Pace</span>
            </div>
          </div>

          <div className="p-3.5 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B6A72] dark:text-[#8E8E93]">Today's Checked</span>
              <span className="text-[10px] font-mono font-semibold text-[#2E6F40] dark:text-[#4ADE80]">Active</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-mono tabular-nums font-bold text-[#161618] dark:text-[#F7F6F2]">{stats.habitsCompletedToday || 0}/{stats.totalHabits || 0}</span>
              <span className="text-[11px] font-mono text-[#6B6A72] dark:text-[#8E8E93]">Checked In</span>
            </div>
          </div>

          <div className="p-3.5 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B6A72] dark:text-[#8E8E93]">Grace Shield Pool</span>
              <span className="material-symbols-outlined text-[14px] text-[#2E6F40]">verified_user</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-mono tabular-nums font-bold text-[#2E6F40] dark:text-[#4ADE80]">{totalGraceDays}d</span>
              <span className="text-[11px] font-mono text-[#6B6A72] dark:text-[#8E8E93]">Burnout Armor</span>
            </div>
          </div>

          <div className="p-3.5 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B6A72] dark:text-[#8E8E93]">Longest Run</span>
              <span className="material-symbols-outlined text-[14px] text-[#C84B31]">local_fire_department</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-mono tabular-nums font-bold text-[#C84B31] dark:text-[#F87171]">{stats.longestStreak || 0}d</span>
              <span className="text-[11px] font-mono text-[#6B6A72] dark:text-[#8E8E93]">All-Time Peak</span>
            </div>
          </div>
        </section>

        {/* Main Workstation Canvas: 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Left Column: Active Habits Stack (8 cols) */}
          <div className="xl:col-span-8 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#161618] dark:text-[#F7F6F2]">Active Habit Sequences</h2>
                <span className="px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#6B6A72] dark:text-[#8E8E93] font-mono text-[10px] font-bold">{habits.length} Tracked</span>
              </div>
              <div className="flex items-center gap-0.5 bg-black/[0.05] dark:bg-white/[0.06] p-0.5 rounded-full text-[#6B6A72] dark:text-[#8E8E93] text-[11px] font-semibold">
                <button onClick={() => setDailyToggle('Daily')} className={`px-3 py-1 rounded-full transition-all cursor-pointer ${dailyToggle === 'Daily' ? 'bg-white dark:bg-[#1E1E24] text-[#161618] dark:text-[#F7F6F2] shadow-xs' : 'hover:text-[#161618] dark:hover:text-[#F7F6F2]'}`}>Daily</button>
                <button onClick={() => setDailyToggle('Weekly')} className={`px-3 py-1 rounded-full transition-all cursor-pointer ${dailyToggle === 'Weekly' ? 'bg-white dark:bg-[#1E1E24] text-[#161618] dark:text-[#F7F6F2] shadow-xs' : 'hover:text-[#161618] dark:hover:text-[#F7F6F2]'}`}>Weekly</button>
              </div>
            </div>

            {habits.map(habit => {
              const streakInfo = stats.habitStreaks?.find(s => s.id === habit.id);
              const streak = streakInfo ? streakInfo.streak : calcStreak(habit.completedDays || []);
              const color = HABIT_COLOR_CLASSES[habit.colorToken] || HABIT_COLOR_CLASSES.primary;
              const decay = computeHabitDecayMetrics(habit, today);
              
              return (
                <div key={habit.id} className="group relative rounded-2xl bg-white/80 dark:bg-[#18181C]/80 p-4 sm:p-5 shadow-2xs hover:border-black/[0.18] dark:hover:border-white/[0.18] transition-all duration-200 border border-black/[0.08] dark:border-white/[0.08]">
                  <div className="flex items-start justify-between gap-2.5 pb-3">
                    <div
                      onClick={() => handleOpenEdit(habit)}
                      className="flex items-start gap-3 min-w-0 cursor-pointer group/title flex-1"
                      title="Click to edit habit sequence"
                    >
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${color.fixed} border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center flex-shrink-0 shadow-xs transition-transform group-hover/title:scale-105`}>
                        <span className="material-symbols-outlined text-[20px] sm:text-[22px]" style={{ fontVariationSettings: '"FILL" 1' }}>{habit.icon || 'star'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-editorial text-[15.5px] sm:text-[17px] font-medium text-[#161618] dark:text-[#F7F6F2] truncate group-hover/title:text-[#0F52BA] dark:group-hover/title:text-[#6495ED] transition-colors">{habit.title}</h3>
                          <span className="px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[10px] font-mono text-[#6B6A72] dark:text-[#8E8E93]">{habit.duration}</span>
                          {habit.cadence && habit.cadence !== 'Anytime' && (
                            <span className="px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[10px] font-mono text-[#6B6A72] dark:text-[#8E8E93]">
                              {habit.cadence}
                            </span>
                          )}
                          {habit.targetFrequency && habit.targetFrequency !== 'Every Day' && (
                            <span className="px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[10px] font-mono text-[#6B6A72] dark:text-[#8E8E93]">
                              {habit.targetFrequency === 'Custom' && Array.isArray(habit.customDays) && habit.customDays.length > 0
                                ? habit.customDays.join(', ')
                                : habit.targetFrequency}
                            </span>
                          )}
                          {habit.isTimeBlocked !== false && habit.startTime && (
                            <span className="px-2 py-0.5 rounded-full bg-[#0F52BA]/10 text-[#0F52BA] dark:text-[#6495ED] text-[10px] font-mono font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[11px]">schedule</span>
                              {habit.startTime}
                            </span>
                          )}
                          {habit.linkedGoal && (
                            <span className={`text-[10.5px] font-mono font-semibold ${color.text} flex items-center gap-0.5`}>
                              <span>→ {habit.linkedGoal}</span>
                            </span>
                          )}
                        </div>
                        {habit.description && (
                          <p className="font-editorial italic text-[12px] text-[#6B6A72] dark:text-[#8E8E93] mt-0.5 line-clamp-1">"{habit.description}"</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/20">
                        <span className="material-symbols-outlined text-[15px] text-amber-600 dark:text-amber-400" style={{ fontVariationSettings: '"FILL" 1' }}>local_fire_department</span>
                        <span className="font-mono text-[11px] font-bold tracking-tight">{streak}d</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-1 text-[#2E6F40] dark:text-[#4ADE80] text-[10.5px] font-mono font-semibold">
                        <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: '"FILL" 1' }}>verified_user</span>
                        <span>{habit.graceDays || 0} Shields</span>
                      </div>
                    </div>
                  </div>

                  {/* Habit Decay Alert Strip */}
                  {decay.isAtRisk && (
                    <div className={`mb-2.5 p-2 rounded-xl flex items-center justify-between gap-2 text-[11px] border transition-all ${
                      decay.riskLevel === 'critical'
                        ? 'bg-[#C84B31]/10 border-[#C84B31]/25 text-[#C84B31] dark:text-[#F87171]'
                        : 'bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-200'
                    }`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="material-symbols-outlined text-[15px] shrink-0">
                          {decay.riskLevel === 'critical' ? 'warning' : 'timelapse'}
                        </span>
                        <span className="font-mono font-bold shrink-0">
                          {Math.round(decay.survivalProb * 100)}% Lindy:
                        </span>
                        <span className="truncate">
                          {typeof decay.mvrSuggestion === 'object'
                            ? (decay.mvrSuggestion?.recoveryPrescription || '')
                            : String(decay.mvrSuggestion || '')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          checkInHabit(habit.id, today);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold shrink-0 cursor-pointer shadow-tactile transition active:scale-95 ${
                          decay.riskLevel === 'critical'
                            ? 'bg-[#C84B31] text-white hover:opacity-90'
                            : 'bg-amber-600 text-white hover:opacity-90'
                        }`}
                      >
                        2m Rep
                      </button>
                    </div>
                  )}
                  
                  <div className="pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-black/[0.05] dark:border-white/[0.06]">
                    <div className="grid grid-cols-7 gap-1.5 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto">
                      {weekDaysMeta.map(({ dayStr, isToday, dayLabel, formattedDate }) => {
                        const isCompleted = habit.completedDays?.includes(dayStr);
                        
                        return (
                          <div key={dayStr} className="flex flex-col items-center gap-1">
                            <span className={`font-mono text-[10px] ${isToday ? 'text-[#0F52BA] dark:text-[#6495ED] font-bold' : 'text-[#6B6A72] dark:text-[#8E8E93]'}`}>{dayLabel}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                checkInHabit(habit.id, dayStr);
                              }}
                              className={`w-full sm:w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer ${
                                isCompleted
                                  ? 'bg-[#2E6F40] text-white shadow-tactile font-semibold'
                                  : isToday
                                    ? 'bg-black/[0.06] dark:bg-white/[0.1] text-[#161618] dark:text-[#F7F6F2] border border-black/[0.12] dark:border-white/[0.16]'
                                    : 'bg-black/[0.03] dark:bg-white/[0.05] text-[#8E8E93] hover:text-[#161618] dark:hover:text-[#F7F6F2] border border-black/[0.04] dark:border-white/[0.06]'
                              }`}
                              title={`${formattedDate} — ${isCompleted ? 'Completed (Click to undo)' : 'Missed / Not checked (Click to check in)'}`}
                              aria-label={`${isCompleted ? 'Undo' : 'Complete'} ${habit.title} for ${formattedDate}`}
                            >
                              {isCompleted ? (
                                <span className="material-symbols-outlined text-[17px]">done</span>
                              ) : isToday ? (
                                <span className="material-symbols-outlined text-[15px] opacity-60">radio_button_unchecked</span>
                              ) : (
                                <span className="text-[12px] font-mono font-bold opacity-40 hover:opacity-100">+</span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="flex items-center justify-end gap-1 pt-1 sm:pt-0">
                      {/* 1. Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(habit)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#6B6A72] dark:text-[#A0A0AB] hover:text-[#161618] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                        title="Edit habit sequence"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        <span>Edit</span>
                      </button>

                      {/* 2. Grace Shield (Graces the habit for today) */}
                      <button
                        type="button"
                        onClick={() => handleApplyGraceToday(habit)}
                        disabled={!habit.graceDays || habit.graceDays <= 0}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          habit.graceDays > 0
                            ? 'text-[#2E6F40] dark:text-[#4ADE80] hover:bg-[#2E6F40]/10 active:scale-95 cursor-pointer'
                            : 'text-neutral-400 opacity-40 cursor-not-allowed'
                        }`}
                        title={
                          habit.graceDays > 0
                            ? `Use 1 Grace Shield for today (${habit.graceDays} available)`
                            : 'No grace shields remaining'
                        }
                      >
                        <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                          verified_user
                        </span>
                        <span>Shield</span>
                        {habit.graceDays > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#2E6F40]/15 text-[#2E6F40] dark:text-[#4ADE80] font-bold ml-0.5">
                            {habit.graceDays}
                          </span>
                        )}
                      </button>

                      {/* 3. Delete Symbol (Modal Confirmation) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHabitToDelete(habit);
                        }}
                        className="flex items-center gap-1 p-1.5 rounded-lg text-xs font-semibold text-[#8E8E93] hover:text-[#C84B31] hover:bg-[#C84B31]/10 transition-colors cursor-pointer"
                        title={`Delete "${habit.title}"`}
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Systems Philosophy & Rhythm */}
          <div className="xl:col-span-4 space-y-4 xl:sticky xl:top-20">
            {/* Systems Over Goals Card */}
            <div className="rounded-2xl bg-white/70 dark:bg-[#18181C]/70 backdrop-blur-xs p-5 sm:p-6 border border-black/[0.08] dark:border-white/[0.08] shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#0F52BA] dark:text-[#6495ED] font-bold">Systems Philosophy</span>
                <span className="w-1 h-1 rounded-full bg-[#8E8E93]" />
                <span className="text-[10px] font-mono text-[#8E8E93]">Atomic Foundation</span>
              </div>
              <blockquote className="font-editorial text-[14.5px] sm:text-[15.5px] italic text-[#161618] dark:text-[#F7F6F2] leading-relaxed">
                "You do not rise to the level of your goals. You fall to the level of your systems."
              </blockquote>
              <div className="text-[10.5px] font-mono text-[#8E8E93]">— James Clear, Atomic Habits</div>

              <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-[#6B6A72] dark:text-[#8E8E93]">Weekly Cadence Rhythm</span>
                  <span className="font-mono font-bold text-[#2E6F40] dark:text-[#4ADE80]">Optimal Flow</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                  <div className="h-full bg-[#2E6F40] rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(15, completionPct))}%` }} />
                </div>
                <div className="flex justify-between font-mono text-[9.5px] text-[#8E8E93] pt-0.5">
                  <span>Recovery window active</span>
                  <span>Light Sunday buffer</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Annual Consistency Heatmap Section (Real Dynamic 53-Week Ledger) */}
        <div className="rounded-2xl bg-white/70 dark:bg-[#18181C]/70 backdrop-blur-xs p-5 sm:p-6 border border-black/[0.08] dark:border-white/[0.08] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h2 className="font-editorial text-lg sm:text-xl font-medium text-[#161618] dark:text-[#F7F6F2]">Annual Consistency Matrix</h2>
                <span className="px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#6B6A72] dark:text-[#8E8E93] font-mono text-[10px] font-bold">
                  {currentYear} Ledger
                </span>
              </div>
              <p className="text-[12px] text-[#6B6A72] dark:text-[#8E8E93]">
                365-day macro cadence tracking compound self-mastery across all tracked sequences.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#8E8E93]">
                <span>Less</span>
                <span className="w-3 h-3 rounded-[2.5px] bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.06]" title="0 habits checked" />
                <span className="w-3 h-3 rounded-[2.5px] bg-[#2E6F40]/30 border border-[#2E6F40]/20" title="1 habit checked" />
                <span className="w-3 h-3 rounded-[2.5px] bg-[#2E6F40]/55 border border-[#2E6F40]/30" title="2 habits checked" />
                <span className="w-3 h-3 rounded-[2.5px] bg-[#2E6F40]/80 border border-[#2E6F40]/40" title="3 habits checked" />
                <span className="w-3 h-3 rounded-[2.5px] bg-[#2E6F40] border border-[#2E6F40]" title="4+ habits checked" />
                <span>More</span>
              </div>
              <div className="h-4 w-px bg-black/[0.08] dark:bg-white/[0.08] hidden sm:block" />
              <button
                type="button"
                onClick={handleExportLedger}
                className="flex items-center gap-1 text-[#0F52BA] dark:text-[#6495ED] text-[11px] font-mono font-medium hover:underline cursor-pointer"
                title="Download full JSON ledger of all habit completions"
              >
                <span>Export Ledger</span>
                <span className="material-symbols-outlined text-[15px]">ios_share</span>
              </button>
            </div>
          </div>

          {/* Scalable 53-Week Real Ledger Canvas */}
          <div className="w-full overflow-x-auto pb-1">
            <div className="min-w-[760px] flex flex-col gap-1.5 select-none">
              <div className="flex items-start gap-2">
                {/* Day of week legends (Mon, Wed, Fri, Sun) */}
                <div className="flex flex-col justify-between pt-5 pb-0.5 text-[10px] font-mono font-semibold text-[#8E8E93] select-none h-[118px] shrink-0">
                  <span>M</span>
                  <span>W</span>
                  <span>F</span>
                  <span>S</span>
                </div>

                {/* Heatmap Columns: 53 Real-Data Weeks */}
                <div className="flex-1 flex gap-[3px] overflow-x-auto pb-1" id="annual-heatmap-cells">
                  {calendarData.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-[3px] shrink-0">
                      {/* Month label dynamically placed directly above the week column */}
                      <div className="h-4 text-[10px] font-mono font-semibold text-[#8E8E93] overflow-visible whitespace-nowrap">
                        {week.weekMonthLabel || ''}
                      </div>

                      {/* 7 Days in Week (Mon=0 to Sun=6) */}
                      {week.days.map((day) => {
                        if (!day.isCurrentYear) {
                          return <div key={day.key} className="w-3 h-3 rounded-[2.5px] invisible" />;
                        }

                        const tooltip = day.isFuture
                          ? `${day.formattedDate} • Upcoming Day`
                          : day.completedCount > 0
                            ? `${day.formattedDate}: ${day.completedCount} habit${day.completedCount > 1 ? 's' : ''} completed (${day.completedHabits.map(h => h.title).join(', ')})`
                            : `${day.formattedDate}: No habits completed`;

                        let cellColor = 'bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.06] hover:ring-1 hover:ring-black/20';
                        if (day.isFuture) {
                          cellColor = 'bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]';
                        } else if (day.completedCount >= 4) {
                          cellColor = 'bg-[#2E6F40] border border-[#2E6F40]';
                        } else if (day.completedCount === 3) {
                          cellColor = 'bg-[#2E6F40]/80 border border-[#2E6F40]/40';
                        } else if (day.completedCount === 2) {
                          cellColor = 'bg-[#2E6F40]/55 border border-[#2E6F40]/30';
                        } else if (day.completedCount === 1) {
                          cellColor = 'bg-[#2E6F40]/30 border border-[#2E6F40]/20';
                        }

                        if (day.isToday) {
                          cellColor += ' ring-2 ring-[#0F52BA] ring-offset-1 ring-offset-white dark:ring-offset-[#18181C]';
                        }

                        return (
                          <div
                            key={day.key}
                            title={tooltip}
                            className={`w-3 h-3 rounded-[2.5px] transition-all cursor-pointer ${cellColor}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Real Dynamic Heatmap Meta Footnote */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 font-mono text-[11px] text-[#8E8E93] border-t border-black/[0.05] dark:border-white/[0.06]">
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
              <span>
                Longest {currentYear} Streak:{' '}
                <strong className="text-[#161618] dark:text-[#F7F6F2] font-semibold">{longestYearStreak} {longestYearStreak === 1 ? 'Day' : 'Days'}</strong>
              </span>
              <span>•</span>
              <span>
                Total Check-ins:{' '}
                <strong className="text-[#161618] dark:text-[#F7F6F2] font-semibold">{totalAnnualCompletions} Logged</strong>
              </span>
              <span>•</span>
              <span>
                Active Shield Pool:{' '}
                <strong className="text-[#2E6F40] dark:text-[#4ADE80] font-semibold">{totalGraceDays} Stored</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#2E6F40] dark:text-[#4ADE80] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E6F40] dark:bg-[#4ADE80] animate-pulse" />
              <span>Live Sync Active</span>
            </div>
          </div>
        </div>

</div>
      <HabitModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingHabit(null);
        }}
        habit={editingHabit}
        goals={goals}
        onSave={handleSaveHabit}
        onDelete={deleteHabit}
      />

      <ConfirmModal
        isOpen={!!habitToDelete}
        title="Delete Habit Routine?"
        message={`Are you sure you want to delete "${habitToDelete?.title}"? All streak tracking for this routine will be removed.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={() => {
          if (habitToDelete) {
            deleteHabit(habitToDelete.id);
            setHabitToDelete(null);
          }
        }}
        onCancel={() => setHabitToDelete(null)}
      />
    </main>
  );
});

export default HabitsView;
