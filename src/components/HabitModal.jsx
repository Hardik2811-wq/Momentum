import React, { useState, useEffect } from 'react';

const DURATION_PRESETS = ['Open / Flex', '15 mins', '30 mins', '45 mins', '60 mins'];

const CADENCE_OPTIONS = [
  { id: 'Anytime', label: 'Flexible', icon: 'schedule', period: 'All Day' },
  { id: 'Morning Ritual', label: 'Morning', icon: 'wb_sunny', period: 'AM' },
  { id: 'Afternoon Flow', label: 'Afternoon', icon: 'bolt', period: 'PM' },
  { id: 'Evening Wind-down', label: 'Evening', icon: 'nights_stay', period: 'Night' }
];

const FREQUENCY_OPTIONS = [
  { id: 'Every Day', label: 'Every Day', desc: '7d / week' },
  { id: 'Weekdays', label: 'Weekdays', desc: 'Mon – Fri' },
  { id: '3 Days / Wk', label: '3 Days / Wk', desc: 'Active cadence' },
  { id: 'Custom', label: 'Custom', desc: 'Specific days' }
];

const WEEK_DAYS = [
  { id: 'Mon', label: 'Monday', short: 'M' },
  { id: 'Tue', label: 'Tuesday', short: 'T' },
  { id: 'Wed', label: 'Wednesday', short: 'W' },
  { id: 'Thu', label: 'Thursday', short: 'T' },
  { id: 'Fri', label: 'Friday', short: 'F' },
  { id: 'Sat', label: 'Saturday', short: 'S' },
  { id: 'Sun', label: 'Sunday', short: 'S' }
];

const ICONS_CATALOG = [
  {
    icon: 'terminal',
    label: 'Deep Work',
    colorToken: 'primary',
    accentHex: '#0A84FF',
    activeClass: 'bg-blue-50/80 border-blue-500 text-blue-700 ring-2 ring-blue-500/20',
    iconBg: 'bg-blue-100 text-blue-800',
    btnClass: 'bg-[#0A84FF] text-white shadow-blue-500/20'
  },
  {
    icon: 'directions_run',
    label: 'Cardio',
    colorToken: 'secondary',
    accentHex: '#F97316',
    activeClass: 'bg-orange-50/80 border-orange-500 text-orange-700 ring-2 ring-orange-500/20',
    iconBg: 'bg-orange-100 text-orange-800',
    btnClass: 'bg-[#F97316] text-white shadow-orange-500/20'
  },
  {
    icon: 'fitness_center',
    label: 'Strength',
    colorToken: 'primary',
    accentHex: '#E11D48',
    activeClass: 'bg-rose-50/80 border-rose-500 text-rose-700 ring-2 ring-rose-500/20',
    iconBg: 'bg-rose-100 text-rose-800',
    btnClass: 'bg-[#E11D48] text-white shadow-rose-500/20'
  },
  {
    icon: 'auto_stories',
    label: 'Reading',
    colorToken: 'tertiary',
    accentHex: '#6366F1',
    activeClass: 'bg-indigo-50/80 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20',
    iconBg: 'bg-indigo-100 text-indigo-800',
    btnClass: 'bg-[#6366F1] text-white shadow-indigo-500/20'
  },
  {
    icon: 'self_improvement',
    label: 'Zen',
    colorToken: 'secondary',
    accentHex: '#059669',
    activeClass: 'bg-emerald-50/80 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20',
    iconBg: 'bg-emerald-100 text-emerald-800',
    btnClass: 'bg-[#059669] text-white shadow-emerald-500/20'
  },
  {
    icon: 'music_note',
    label: 'Music',
    colorToken: 'tertiary',
    accentHex: '#9333EA',
    activeClass: 'bg-purple-50/80 border-purple-500 text-purple-700 ring-2 ring-purple-500/20',
    iconBg: 'bg-purple-100 text-purple-800',
    btnClass: 'bg-[#9333EA] text-white shadow-purple-500/20'
  },
  {
    icon: 'water_drop',
    label: 'Hydration',
    colorToken: 'primary',
    accentHex: '#06B6D4',
    activeClass: 'bg-cyan-50/80 border-cyan-500 text-cyan-700 ring-2 ring-cyan-500/20',
    iconBg: 'bg-cyan-100 text-cyan-800',
    btnClass: 'bg-[#06B6D4] text-white shadow-cyan-500/20'
  },
  {
    icon: 'bolt',
    label: 'Energy',
    colorToken: 'secondary',
    accentHex: '#D97706',
    activeClass: 'bg-amber-50/80 border-amber-500 text-amber-800 ring-2 ring-amber-500/20',
    iconBg: 'bg-amber-100 text-amber-800',
    btnClass: 'bg-[#D97706] text-white shadow-amber-500/20'
  },
  {
    icon: 'brush',
    label: 'Creative',
    colorToken: 'tertiary',
    accentHex: '#EC4899',
    activeClass: 'bg-pink-50/80 border-pink-500 text-pink-700 ring-2 ring-pink-500/20',
    iconBg: 'bg-pink-100 text-pink-800',
    btnClass: 'bg-[#EC4899] text-white shadow-pink-500/20'
  },
  {
    icon: 'bedtime',
    label: 'Sleep',
    colorToken: 'tertiary',
    accentHex: '#4F46E5',
    activeClass: 'bg-violet-50/80 border-violet-500 text-violet-700 ring-2 ring-violet-500/20',
    iconBg: 'bg-violet-100 text-violet-800',
    btnClass: 'bg-[#4F46E5] text-white shadow-violet-500/20'
  },
  {
    icon: 'restaurant',
    label: 'Nutrition',
    colorToken: 'secondary',
    accentHex: '#16A34A',
    activeClass: 'bg-green-50/80 border-green-500 text-green-700 ring-2 ring-green-500/20',
    iconBg: 'bg-green-100 text-green-800',
    btnClass: 'bg-[#16A34A] text-white shadow-green-500/20'
  },
  {
    icon: 'hiking',
    label: 'Outdoors',
    colorToken: 'secondary',
    accentHex: '#0D9488',
    activeClass: 'bg-teal-50/80 border-teal-500 text-teal-700 ring-2 ring-teal-500/20',
    iconBg: 'bg-teal-100 text-teal-800',
    btnClass: 'bg-[#0D9488] text-white shadow-teal-500/20'
  }
];

export default function HabitModal({
  isOpen,
  onClose,
  habit = null,
  goals = [],
  onSave,
  onDelete
}) {
  const isEditing = Boolean(habit && habit.id);

  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30 mins');
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [icon, setIcon] = useState('terminal');
  const [colorToken, setColorToken] = useState('primary');
  const [cadence, setCadence] = useState('Anytime');
  const [targetFrequency, setTargetFrequency] = useState('Every Day');
  const [customDays, setCustomDays] = useState(['Mon', 'Wed', 'Fri']);
  const [linkedGoal, setLinkedGoal] = useState('');
  const [isGoalMenuOpen, setIsGoalMenuOpen] = useState(false);
  const [graceDays, setGraceDays] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleCustomDay = (dayId) => {
    setCustomDays(prev => {
      if (prev.includes(dayId)) {
        if (prev.length <= 1) return prev;
        return prev.filter(d => d !== dayId);
      }
      return [...prev, dayId];
    });
  };

  useEffect(() => {
    if (habit) {
      setTitle(habit.title || '');
      const dur = habit.duration || '30 mins';
      setDuration(dur);
      setIsCustomDuration(!DURATION_PRESETS.includes(dur));
      const foundIcon = habit.icon || 'terminal';
      setIcon(foundIcon);
      const matched = ICONS_CATALOG.find(i => i.icon === foundIcon);
      setColorToken(habit.colorToken || matched?.colorToken || 'primary');
      setCadence(habit.cadence || 'Anytime');
      setTargetFrequency(habit.targetFrequency || 'Every Day');
      setCustomDays(habit.customDays || ['Mon', 'Wed', 'Fri']);
      setLinkedGoal(habit.linkedGoal || '');
      setGraceDays(habit.graceDays ?? 1);
    } else {
      setTitle('');
      setDuration('30 mins');
      setIsCustomDuration(false);
      setIcon('terminal');
      setColorToken('primary');
      setCadence('Anytime');
      setTargetFrequency('Every Day');
      setCustomDays(['Mon', 'Wed', 'Fri']);
      setLinkedGoal('');
      setGraceDays(1);
    }
    setConfirmDelete(false);
    setIsGoalMenuOpen(false);
  }, [habit, goals, isOpen]);

  if (!isOpen) return null;

  const activeSignpost = ICONS_CATALOG.find(i => i.icon === icon) || ICONS_CATALOG[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      ...(habit || {}),
      title: title.trim(),
      duration: duration.trim() || 'Open / Flex',
      icon,
      colorToken: colorToken || activeSignpost.colorToken || 'primary',
      cadence,
      targetFrequency,
      customDays: targetFrequency === 'Custom' ? customDays : null,
      linkedGoal: linkedGoal.trim(),
      description: habit?.description || '',
      graceDays: Number(graceDays) || 0
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-[0_24px_70px_-12px_rgba(0,0,0,0.22),0_0_1px_1px_rgba(0,0,0,0.06)] border border-black/[0.08] overflow-hidden my-auto max-h-[96vh] flex flex-col">
        {/* Subtle Ambient Color Line */}
        <div
          className="h-1 w-full transition-colors duration-300 shrink-0"
          style={{ backgroundColor: activeSignpost.accentHex }}
        />

        {/* Modal Header (Compact) */}
        <header className="px-5 sm:px-6 pt-3.5 pb-2.5 flex items-center justify-between border-b border-black/[0.05] bg-surface-container-lowest shrink-0">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeSignpost.accentHex }} />
              <span className="font-label-sm text-[11px] text-neutral-400 font-semibold uppercase tracking-wider">
                {isEditing ? 'Sequence Calibration' : 'New Habit Architecture'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-on-surface mt-0.5">
              {isEditing ? 'Edit Habit Sequence' : 'Create Recurring Habit'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-neutral-100 transition-colors"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </header>

        {/* Modal Body (Streamlined to fit without scrolling) */}
        <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-3 space-y-3 overflow-visible flex-1 flex flex-col justify-between">
          {/* 1. Live Interactive Preview Card (Slim & Compact) */}
          <div className="rounded-xl bg-neutral-50/80 p-2.5 border border-black/[0.06] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl ${activeSignpost.iconBg} flex items-center justify-center shrink-0 shadow-xs transition-all`}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  {icon}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-on-surface truncate max-w-[200px] sm:max-w-xs">
                    {title.trim() || 'Untitled Habit'}
                  </h4>
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-black/[0.06] text-[10px] font-semibold text-neutral-600 shrink-0">
                    {duration}
                  </span>
                  {linkedGoal && (
                    <span className="text-[11px] font-semibold truncate hidden sm:inline" style={{ color: activeSignpost.accentHex }}>
                      → {linkedGoal}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                  <span>{cadence}</span>
                  <span>•</span>
                  <span>{targetFrequency === 'Custom' ? `${customDays.length}d (${customDays.join(',')})` : targetFrequency}</span>
                  <span>•</span>
                  <span className="text-secondary font-medium">{graceDays} Shield Days</span>
                </div>
              </div>
            </div>

            <span className="text-[10px] font-semibold text-secondary flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              Live Preview
            </span>
          </div>

          {/* 2. Habit Title Input (Clean Minimalist) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Habit Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning Deep Work, Zone 2 Cardio, Evening Reading"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50/70 hover:bg-neutral-50 focus:bg-white border border-neutral-200/90 text-sm font-semibold text-neutral-900 placeholder:text-neutral-400/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus:outline-none focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/[0.04] transition-all"
              autoFocus
            />
          </div>

          {/* 3. Visual Signpost Grid (Auto Color-Themed, Compact Touch Tiles) */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Visual Signpost &amp; Theme
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {ICONS_CATALOG.map((item) => {
                const isSelected = icon === item.icon;
                return (
                  <button
                    key={item.icon}
                    type="button"
                    onClick={() => {
                      setIcon(item.icon);
                      setColorToken(item.colorToken);
                    }}
                    className={`group/icon relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border text-center transition-all ${
                      isSelected
                        ? `${item.activeClass} shadow-xs scale-102 font-bold`
                        : 'bg-neutral-50/70 border-neutral-200/60 hover:bg-neutral-100/70 hover:border-neutral-300 text-neutral-600 hover:text-neutral-900'
                    }`}
                    title={item.label}
                  >
                    <span
                      className="absolute top-1 right-1 w-1 h-1 rounded-full transition-opacity opacity-50 group-hover/icon:opacity-100"
                      style={{ backgroundColor: item.accentHex }}
                    />
                    <span
                      className="material-symbols-outlined text-[19px] mb-0.5 transition-transform group-hover/icon:scale-110"
                      style={isSelected ? { fontVariationSettings: '"FILL" 1' } : {}}
                    >
                      {item.icon}
                    </span>
                    <span className="text-[10px] leading-tight tracking-tight truncate w-full text-center">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Daily Anchor Window (4 Columns in a single sleek row) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Daily Anchor Window
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {CADENCE_OPTIONS.map((item) => {
                const isSelected = cadence === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCadence(item.id)}
                    title={item.period ? `${item.label} (${item.period})` : item.label}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-surface-container-lowest border-primary ring-2 ring-primary/20 text-on-surface font-bold shadow-xs'
                        : 'bg-neutral-50/70 border-black/[0.06] hover:bg-neutral-100/70 text-neutral-600 font-medium'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[17px] shrink-0 transition-transform ${
                        isSelected ? 'text-primary scale-110' : 'text-neutral-400'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="text-xs tracking-tight whitespace-nowrap">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Target Frequency & Block Duration (Side-by-Side Row) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {/* Target Frequency */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Target Frequency
                </label>
                {targetFrequency === 'Custom' && (
                  <span className="text-[10px] font-semibold text-primary">
                    {customDays.length}d/wk
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {FREQUENCY_OPTIONS.map((freq) => {
                  const isSelected = targetFrequency === freq.id;
                  return (
                    <button
                      key={freq.id}
                      type="button"
                      onClick={() => setTargetFrequency(freq.id)}
                      className={`flex flex-col items-start px-2 py-1.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-surface-container-lowest border-primary ring-2 ring-primary/20 shadow-xs'
                          : 'bg-neutral-50/70 border-black/[0.06] hover:bg-neutral-100/70'
                      }`}
                    >
                      <span className={`text-[11px] font-bold ${isSelected ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {freq.label}
                      </span>
                      <span className="text-[9px] text-outline mt-0.2">{freq.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Day-of-Week Picker when Custom is selected */}
              {targetFrequency === 'Custom' && (
                <div className="pt-1 animate-fadeIn">
                  <div className="flex items-center gap-1">
                    {WEEK_DAYS.map((d) => {
                      const isDaySelected = customDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleCustomDay(d.id)}
                          className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            isDaySelected
                              ? 'bg-neutral-900 text-white shadow-xs'
                              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                          }`}
                          title={d.label}
                        >
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Block Duration */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Block Duration
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomDuration(!isCustomDuration)}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  {isCustomDuration ? 'Presets' : 'Custom'}
                </button>
              </div>

              {isCustomDuration ? (
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 25 mins"
                  className="w-full px-3 py-1.5 rounded-xl bg-neutral-50/70 border border-black/[0.08] text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {DURATION_PRESETS.map((p) => {
                    const isSelected = duration === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDuration(p)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                          isSelected
                            ? 'bg-primary text-white shadow-xs font-bold'
                            : 'bg-neutral-50/70 border border-black/[0.05] hover:bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 6. Horizon Goal & Grace Shield (Mature Clean Card, No Career/Health tags) */}
          <div className="rounded-xl bg-neutral-50/80 border border-black/[0.06] p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              {/* Mature Linked Goal Selector */}
              <div className="space-y-1 relative">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Linked Horizon Goal
                </label>
                <button
                  type="button"
                  onClick={() => setIsGoalMenuOpen(!isGoalMenuOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-black/[0.08] hover:border-black/20 text-xs font-semibold text-on-surface shadow-xs transition-all text-left"
                >
                  <div className="flex items-center gap-2 truncate pr-1">
                    {linkedGoal ? (
                      <>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeSignpost.accentHex }} />
                        <span className="truncate text-on-surface">{linkedGoal}</span>
                      </>
                    ) : (
                      <span className="text-neutral-400 font-normal">None (Independent Habit)</span>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-neutral-400 shrink-0 ml-1">
                    unfold_more
                  </span>
                </button>

                {/* Mature Popover Menu (Opens upward so it never clips off bottom) */}
                {isGoalMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsGoalMenuOpen(false)}
                    />
                    <div className="absolute bottom-full mb-1.5 left-0 right-0 z-40 bg-white rounded-2xl shadow-[0_16px_36px_rgba(0,0,0,0.16)] border border-black/[0.08] py-1 max-h-44 overflow-y-auto animate-fadeIn">
                      <button
                        type="button"
                        onClick={() => {
                          setLinkedGoal('');
                          setIsGoalMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                          !linkedGoal
                            ? 'bg-neutral-50 text-neutral-900 font-bold'
                            : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                          <span>None (Independent Habit)</span>
                        </div>
                        {!linkedGoal && (
                          <span className="material-symbols-outlined text-[16px] text-primary">check</span>
                        )}
                      </button>

                      {goals.length > 0 && (
                        <div className="border-t border-neutral-100 my-1 pt-1">
                          <div className="px-3 py-0.5 text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                            Active Horizons
                          </div>
                          {goals.map((g) => {
                            const isSelected = linkedGoal === g.title;
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => {
                                  setLinkedGoal(g.title);
                                  setIsGoalMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                                  isSelected
                                    ? 'bg-neutral-50 text-neutral-900 font-bold'
                                    : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      isSelected ? 'bg-primary' : 'bg-neutral-300'
                                    }`}
                                  />
                                  <span className="truncate">{g.title}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {typeof g.progress === 'number' && (
                                    <span className="text-[11px] font-medium text-neutral-400">
                                      {g.progress}%
                                    </span>
                                  )}
                                  {isSelected && (
                                    <span className="material-symbols-outlined text-[16px] text-primary">
                                      check
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Grace Shield Counter */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Grace Shield Pool (Days)
                </label>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2, 3].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setGraceDays(val)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        graceDays === val
                          ? 'bg-secondary text-white shadow-xs font-bold'
                          : 'bg-white border border-black/[0.08] text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {val === 0 ? 'Off' : `${val} d`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Bar (Slim) */}
          <footer className="pt-2 border-t border-black/[0.06] flex items-center justify-between gap-3 shrink-0">
            {isEditing && onDelete ? (
              <div>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-error font-medium">Delete sequence?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(habit.id);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-error text-white text-xs font-semibold hover:opacity-90"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-neutral-400 hover:text-neutral-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-error hover:bg-red-50 text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                    <span>Delete</span>
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex items-center gap-1.5 px-5 py-2 rounded-full ${activeSignpost.btnClass} font-semibold text-xs tracking-wide shadow-sm hover:opacity-95 active:scale-95 transition-all`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isEditing ? 'check' : 'add'}
                </span>
                <span>{isEditing ? 'Save Changes' : 'Establish Habit'}</span>
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
