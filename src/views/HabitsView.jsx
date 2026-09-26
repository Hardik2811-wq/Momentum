import React, { useState, useMemo } from 'react';
import { calcStreak, last7Days, todayKey, DAY_LABELS } from '../store/useStore';
import HabitModal from '../components/HabitModal';

const HABIT_COLOR_CLASSES = {
  primary: { fixed: 'bg-primary-fixed text-on-primary-fixed-variant', text: 'text-primary', checked: 'bg-primary text-on-primary' },
  secondary: { fixed: 'bg-secondary-fixed text-on-secondary-fixed-variant', text: 'text-secondary', checked: 'bg-secondary text-on-secondary' },
  tertiary: { fixed: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', text: 'text-tertiary', checked: 'bg-tertiary text-on-tertiary' }
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
    <main className="w-full pt-16 md:pt-12 px-4 sm:px-6 md:px-margin-desktop py-4 sm:py-gutter-xl min-h-screen bg-surface">
      <div className="flex flex-col w-full space-y-4 sm:space-y-gutter-2xl">
{/* Dynamic Atmospheric Glow Accent */}
<div className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-surface-container-lowest via-surface-container-low to-surface-container-lowest p-gutter-xl shadow-sm">
<div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-fixed-dim/30 blur-3xl pointer-events-none"></div>
<div className="absolute -left-12 -bottom-12 h-56 w-56 rounded-full bg-secondary-fixed/40 blur-3xl pointer-events-none"></div>
<div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-gutter-lg">
<div className="space-y-gutter-xs">
<div className="flex items-center gap-gutter-sm">
<span className="px-gutter-sm py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">Mindful Momentum</span>
<span className="flex items-center gap-1 font-caption text-caption text-secondary">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            Live Sync Active
          </span>
</div>
<h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Habits &amp; Streaks</h1>
<p className="font-body-md text-body-md text-on-surface-variant">Calibrated consistency without burnout. Built with graceful resilience.</p>
</div>
<div className="flex items-center gap-gutter-md self-stretch sm:self-auto">
<button onClick={handleOpenCreate} className="flex items-center gap-gutter-sm px-gutter-lg py-2.5 rounded-full bg-primary-container text-on-primary-container hover:bg-primary transition-all shadow-sm active:scale-[0.98]">
<span className="material-symbols-outlined text-[20px]">add</span>
<span className="font-label-md text-label-md">New Habit</span>
</button>
</div>
</div>
{/* Apple Health Ring Inspired Status Bar */}
<div className="mt-gutter-xl pt-gutter-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-gutter-lg">
<div className="flex-1 flex flex-wrap items-center gap-gutter-xl">
{/* SVG Radial Multi-Ring Visualizer */}
<div className="flex items-center gap-gutter-md">
<div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
<svg className="w-full h-full -rotate-90" viewBox="0 0 52 52">
<circle className="stroke-surface-container-highest fill-none" cx="26" cy="26" r="21" strokeWidth="4.5" />
<circle className="stroke-secondary fill-none transition-all duration-1000 ease-out" cx="26" cy="26" r="21" strokeDasharray="131.9" strokeDashoffset="8" strokeLinecap="round" strokeWidth="4.5" />
<circle className="stroke-surface-container-highest fill-none" cx="26" cy="26" r="14" strokeWidth="4" />
<circle className="stroke-primary fill-none transition-all duration-1000 ease-out" cx="26" cy="26" r="14" strokeDasharray="87.9" strokeDashoffset="15" strokeLinecap="round" strokeWidth="4" />
</svg>
<span className="absolute font-label-sm text-label-sm text-on-surface">{completionPct}%</span>
</div>
<div>
<div className="font-headline-sm text-headline-sm text-on-surface">Weekly Completion</div>
<div className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
<span>{stats.habitsCompletedToday || 0} of {stats.totalHabits || 0} targets checked</span>
<span className="text-outline-variant">•</span>
<span className="text-secondary font-label-sm text-label-sm">Top 3% personal best</span>
</div>
</div>
</div>
<div className="h-8 w-px bg-surface-container-highest hidden sm:block"></div>
{/* Grace Days Reserve Badge */}
<div className="flex items-center gap-gutter-md">
<div className="w-10 h-10 rounded-full bg-secondary-fixed/50 flex items-center justify-center text-on-secondary-fixed">
<span className="material-symbols-outlined text-[20px]" style={{ 'fontVariationSettings': "\"FILL\" 1" }}>favorite</span>
</div>
<div>
<div className="font-title text-title text-on-surface">{totalGraceDays} Grace Days Ready</div>
<div className="font-caption text-caption text-on-surface-variant">Protects streaks automatically against missed check-ins</div>
</div>
</div>
</div>
{/* Quick Metrics Pill List */}
<div className="flex items-center gap-gutter-sm overflow-x-auto py-1">
<div className="px-gutter-md py-2 rounded-xl bg-surface-container-lowest/80 backdrop-blur shadow-sm flex items-center gap-gutter-sm flex-shrink-0">
<span className="material-symbols-outlined text-secondary text-[18px]">local_fire_department</span>
<div>
<span className="font-caption text-caption text-on-surface-variant block leading-none">Best Streak</span>
<span className="font-title text-title text-on-surface">{stats.longestStreak || 0}d</span>
</div>
</div>
<div className="px-gutter-md py-2 rounded-xl bg-surface-container-lowest/80 backdrop-blur shadow-sm flex items-center gap-gutter-sm flex-shrink-0">
<span className="material-symbols-outlined text-primary text-[18px]">timelapse</span>
<div>
<span className="font-caption text-caption text-on-surface-variant block leading-none">Total Flow</span>
<span className="font-title text-title text-on-surface">18.4h</span>
</div>
</div>
<div className="px-gutter-md py-2 rounded-xl bg-surface-container-lowest/80 backdrop-blur shadow-sm flex items-center gap-gutter-sm flex-shrink-0">
<span className="material-symbols-outlined text-tertiary text-[18px]">health_metrics</span>
<div>
<span className="font-caption text-caption text-on-surface-variant block leading-none">Health Index</span>
<span className="font-title text-title text-on-surface">9.8</span>
</div>
</div>
</div>
</div>
</div>
{/* Main Workstation Canvas: 2-Column Responsive Layout */}
<div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-xl items-start">
{/* Left Column: Active Habits Stack (8 cols) */}
<div className="xl:col-span-8 space-y-gutter-base">
<div className="flex items-center justify-between px-gutter-xs">
<div className="flex items-center gap-gutter-sm">
<h2 className="font-headline-sm text-headline-sm text-on-surface">Active Habit Sequences</h2>
<span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-caption text-caption">{habits.length} Tracked</span>
</div>
<div className="flex items-center gap-gutter-xs bg-surface-container-low p-1 rounded-full text-on-surface-variant font-label-sm text-label-sm">
<button onClick={() => setDailyToggle('Daily')} className={`px-gutter-md py-1 rounded-full transition-all ${dailyToggle === 'Daily' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'hover:text-on-surface'}`}>Daily</button>
<button onClick={() => setDailyToggle('Weekly')} className={`px-gutter-md py-1 rounded-full transition-all ${dailyToggle === 'Weekly' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'hover:text-on-surface'}`}>Weekly</button>
</div>
</div>
{habits.map(habit => {
  const streakInfo = stats.habitStreaks?.find(s => s.id === habit.id);
  const streak = streakInfo ? streakInfo.streak : calcStreak(habit.completedDays || []);
  const color = HABIT_COLOR_CLASSES[habit.colorToken] || HABIT_COLOR_CLASSES.primary;
  
  return (
    <div key={habit.id} className="group relative rounded-2xl bg-surface-container-lowest p-gutter-lg sm:p-gutter-xl shadow-sm hover:shadow-md transition-all duration-300 border border-transparent hover:border-outline-variant/30">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-gutter-base pb-gutter-md">
        <div
          onClick={() => handleOpenEdit(habit)}
          className="flex items-start gap-gutter-base min-w-0 cursor-pointer group/title"
          title="Click to edit habit sequence"
        >
          <div className={`w-12 h-12 rounded-2xl ${color.fixed} flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover/title:scale-105`}>
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: '"FILL" 1' }}>{habit.icon || 'star'}</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-gutter-sm">
              <h3 className="font-title text-title text-on-surface truncate group-hover/title:text-primary transition-colors">{habit.title}</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low font-caption text-caption text-on-surface-variant">{habit.duration}</span>
              {habit.linkedGoal && (
                <span className={`font-label-sm text-label-sm ${color.text} flex items-center gap-0.5`}>
                  <span>→ {habit.linkedGoal}</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
                </span>
              )}
            </div>
            {habit.description && (
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{habit.description}</p>
            )}
          </div>
        </div>
        <div className="flex md:flex-col items-end justify-between md:justify-center gap-1 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low">
            <span className="material-symbols-outlined text-[18px] text-on-surface" style={{ fontVariationSettings: '"FILL" 1' }}>local_fire_department</span>
            <span className="font-title text-title text-on-surface tracking-tight">{streak} Days</span>
          </div>
          <div className="flex items-center gap-1 text-secondary font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: '"FILL" 1' }}>verified_user</span>
            <span>Shield Active ({habit.graceDays || 0} stored)</span>
          </div>
        </div>
      </div>
      
      <div className="pt-gutter-base mt-gutter-xs flex flex-col sm:flex-row sm:items-center justify-between gap-gutter-md border-t border-outline-variant/15">
        <div className="flex items-center gap-2">
          {weekDaysMeta.map(({ dayStr, isToday, dayLabel, formattedDate }) => {
            const isCompleted = habit.completedDays?.includes(dayStr);
            
            return (
              <div key={dayStr} className="flex flex-col items-center gap-1.5">
                <span className={`font-caption text-caption ${isToday ? `${color.text} font-bold` : 'text-on-surface-variant'}`}>{dayLabel}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    checkInHabit(habit.id, dayStr);
                  }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs transition-all duration-200 hover:scale-110 active:scale-95 ${
                    isCompleted
                      ? `${isToday ? color.checked : 'bg-secondary-container text-on-secondary-container font-semibold'} shadow-sm`
                      : isToday
                        ? 'bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
                        : 'bg-surface-container-low hover:bg-surface-container text-outline hover:text-on-surface'
                  }`}
                  title={`${formattedDate} — ${isCompleted ? 'Completed (Click to undo)' : 'Missed / Not checked (Click to check in)'}`}
                  aria-label={`${isCompleted ? 'Undo' : 'Complete'} ${habit.title} for ${formattedDate}`}
                >
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-[18px]">done</span>
                  ) : isToday ? (
                    <span className="material-symbols-outlined text-[16px] text-outline">radio_button_unchecked</span>
                  ) : (
                    <span className="text-[12px] font-bold opacity-40 hover:opacity-100">+</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        
        <div className="flex items-center gap-1.5 self-end sm:self-center">
          {/* 1. Edit Button */}
          <button
            type="button"
            onClick={() => handleOpenEdit(habit)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:text-on-surface hover:bg-neutral-100 transition-colors"
            title="Edit habit sequence"
          >
            <span className="material-symbols-outlined text-[15px]">edit</span>
            <span>Edit</span>
          </button>

          {/* 2. Grace Shield (Graces the habit for today) */}
          <button
            type="button"
            onClick={() => handleApplyGraceToday(habit)}
            disabled={!habit.graceDays || habit.graceDays <= 0}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              habit.graceDays > 0
                ? 'text-secondary hover:text-secondary hover:bg-secondary-fixed/30 active:scale-95 cursor-pointer'
                : 'text-neutral-400 opacity-40 cursor-not-allowed'
            }`}
            title={
              habit.graceDays > 0
                ? `Use 1 Grace Shield for today (${habit.graceDays} available)`
                : 'No grace shields remaining'
            }
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: '"FILL" 1' }}>
              verified_user
            </span>
            <span>Shield</span>
            {habit.graceDays > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold ml-0.5">
                {habit.graceDays}
              </span>
            )}
          </button>

          {/* 3. Delete Symbol (With Inline Confirmation) */}
          {confirmDeleteId === habit.id ? (
            <div className="flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded-lg border border-red-200 animate-fadeIn">
              <span className="text-[11px] font-semibold text-error">Delete?</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteHabit(habit.id);
                  setConfirmDeleteId(null);
                }}
                className="px-2 py-0.5 rounded bg-error text-white text-[11px] font-bold hover:bg-error/90 transition-all shadow-xs"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(null);
                }}
                className="px-1.5 py-0.5 text-[11px] text-neutral-500 hover:text-neutral-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(habit.id);
              }}
              className="flex items-center gap-1 p-1.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-error hover:bg-red-50 transition-colors"
              title={`Delete "${habit.title}"`}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
})}
</div>
{/* Right Column: Wisdom & Weekly Rhythm */}
<div className="xl:col-span-4 space-y-gutter-base xl:sticky xl:top-20">
{/* Quick Micro-Context Card with editorial photo */}
<div className="rounded-2xl bg-surface-container-lowest p-gutter-lg shadow-sm space-y-gutter-md">
<div className="relative w-full h-36 rounded-xl overflow-hidden">
<img className="w-full h-full object-cover" alt="Sunlit desk with notebook, pen, water glass, and plant" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZRXf20xAXDRT4q7ZylydiGoqLpFQ-09HdQjoVKCaWHn8OZmsWkcUSg6uxJpuK6z3-K1Wk8FIZzTp-dsbtncoAkuyVT4ppNhs9CbgT3TX3gYMoOSAUs7VrCHk3wuNDDksPDpOZd_s4pFD3-9wyFEv0UUl-BlgYiPs4RXJM322hox0Soi3q8d0HzabEKib1ZQ2IOcomCOgxKDJMQxg0RhGAesPyXziyNsZL05KLidRdr3WaPPDOlOoC"/>
<div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 via-transparent to-transparent"></div>
<div className="absolute bottom-3 left-3 right-3 text-on-primary">
<div className="font-caption text-caption uppercase tracking-wider text-secondary-fixed">Daily Wisdom</div>
<div className="font-label-md text-label-md font-medium leading-tight">"You do not rise to the level of your goals. You fall to the level of your systems."</div>
</div>
</div>
<div className="space-y-gutter-xs">
<div className="flex items-center justify-between">
<span className="font-title text-title text-on-surface">Weekly Rhythm</span>
<span className="font-label-sm text-label-sm text-secondary font-semibold">+8% vs last week</span>
</div>
<div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
<div className="h-full bg-secondary rounded-full" style={{ 'width': "86%" }}></div>
</div>
<div className="flex justify-between font-caption text-caption text-on-surface-variant pt-1">
<span>Optimal recovery window</span>
<span>Sundays: Light load</span>
</div>
</div>
</div>
</div>
</div>
{/* Annual Consistency Heatmap Section (Real Dynamic 53-Week Ledger) */}
<div className="rounded-3xl bg-surface-container-lowest p-gutter-xl shadow-sm space-y-gutter-md">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-gutter-sm">
    <div className="space-y-0.5">
      <div className="flex items-center gap-gutter-sm">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Annual Consistency Matrix</h2>
        <span className="px-2 py-0.5 rounded-full bg-secondary-fixed-dim/40 text-on-secondary-fixed font-caption text-caption font-semibold">
          {currentYear} Ledger
        </span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        365-day macro cadence tracking compound self-mastery across all tracked sequences.
      </p>
    </div>
    <div className="flex items-center gap-gutter-md">
      <div className="flex items-center gap-1.5 font-caption text-caption text-on-surface-variant">
        <span>Less</span>
        <span className="w-3 h-3 rounded-[2.5px] bg-surface-container border border-black/[0.04]" title="0 habits checked" />
        <span className="w-3 h-3 rounded-[2.5px] bg-secondary-fixed/60" title="1 habit checked" />
        <span className="w-3 h-3 rounded-[2.5px] bg-secondary-container" title="2 habits checked" />
        <span className="w-3 h-3 rounded-[2.5px] bg-secondary" title="3 habits checked" />
        <span className="w-3 h-3 rounded-[2.5px] bg-emerald-800" title="4+ habits checked" />
        <span>More</span>
      </div>
      <div className="h-4 w-px bg-surface-container-highest hidden sm:block" />
      <button
        type="button"
        onClick={handleExportLedger}
        className="flex items-center gap-1 text-primary font-label-sm text-label-sm hover:underline cursor-pointer"
        title="Download full JSON ledger of all habit completions"
      >
        <span>Export Health Data</span>
        <span className="material-symbols-outlined text-[16px]">ios_share</span>
      </button>
    </div>
  </div>

  {/* Scalable 53-Week Real Ledger Canvas */}
  <div className="w-full overflow-x-auto pb-gutter-xs">
    <div className="min-w-[760px] flex flex-col gap-1.5 select-none">
      <div className="flex items-start gap-2">
        {/* Day of week legends (Mon, Wed, Fri, Sun) */}
        <div className="flex flex-col justify-between pt-5 pb-0.5 text-[10px] font-semibold text-outline select-none h-[118px] shrink-0">
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
              <div className="h-4 text-[10px] font-bold text-on-surface-variant overflow-visible whitespace-nowrap">
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

                let cellColor = 'bg-surface-container border border-black/[0.03] hover:ring-1 hover:ring-black/20';
                if (day.isFuture) {
                  cellColor = 'bg-surface-container-high/30 border border-black/[0.03]';
                } else if (day.completedCount >= 4) {
                  cellColor = 'bg-emerald-800 hover:ring-1 hover:ring-emerald-900';
                } else if (day.completedCount === 3) {
                  cellColor = 'bg-secondary hover:ring-1 hover:ring-secondary/80';
                } else if (day.completedCount === 2) {
                  cellColor = 'bg-secondary-container hover:ring-1 hover:ring-secondary-container/80';
                } else if (day.completedCount === 1) {
                  cellColor = 'bg-secondary-fixed/70 hover:ring-1 hover:ring-secondary-fixed';
                }

                if (day.isToday) {
                  cellColor += ' ring-2 ring-primary ring-offset-1';
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
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-gutter-sm pt-gutter-sm font-caption text-caption text-on-surface-variant border-t border-outline-variant/15">
    <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
      <span>
        Longest {currentYear} Streak:{' '}
        <strong className="text-on-surface">{longestYearStreak} {longestYearStreak === 1 ? 'Day' : 'Days'}</strong>
      </span>
      <span>•</span>
      <span>
        Total Check-ins:{' '}
        <strong className="text-on-surface">{totalAnnualCompletions} Logged</strong>
      </span>
      <span>•</span>
      <span>
        Active Shield Pool:{' '}
        <strong className="text-secondary">{totalGraceDays} Stored</strong>
      </span>
    </div>
    <div className="flex items-center gap-1.5 text-xs text-secondary font-medium">
      <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
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
    </main>
  );
});

export default HabitsView;
