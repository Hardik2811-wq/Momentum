import React, { useState, useEffect } from 'react';

const DURATION_PRESETS = ['15 mins', '30 mins', '45 mins', '60 mins', '90 mins'];

const CADENCE_OPTIONS = [
  { id: 'Morning Ritual', label: 'Morning Ritual', icon: 'wb_sunny', period: 'AM' },
  { id: 'Afternoon Flow', label: 'Afternoon Flow', icon: 'bolt', period: 'PM' },
  { id: 'Evening Wind-down', label: 'Evening Wind-down', icon: 'nights_stay', period: 'Night' },
  { id: 'Anytime', label: 'Flexible / Anytime', icon: 'schedule', period: 'All Day' }
];

const FREQUENCY_OPTIONS = [
  { id: 'Every Day', label: 'Every Day', desc: '7 days / week' },
  { id: 'Weekdays', label: 'Weekdays', desc: 'Mon – Fri' },
  { id: '4 Days / Wk', label: '4 Days / Wk', desc: 'Flexible cadence' },
  { id: '3 Days / Wk', label: '3 Days / Wk', desc: 'Active recovery' }
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
  const [cadence, setCadence] = useState('Morning Ritual');
  const [targetFrequency, setTargetFrequency] = useState('Every Day');
  const [linkedGoal, setLinkedGoal] = useState('');
  const [description, setDescription] = useState('');
  const [graceDays, setGraceDays] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      setCadence(habit.cadence || 'Morning Ritual');
      setTargetFrequency(habit.targetFrequency || 'Every Day');
      setLinkedGoal(habit.linkedGoal || '');
      setDescription(habit.description || '');
      setGraceDays(habit.graceDays ?? 1);
    } else {
      // Smart defaults (UX Psychology: Smart Defaults & Goal Gradient)
      setTitle('');
      setDuration('30 mins');
      setIsCustomDuration(false);
      setIcon('terminal');
      setColorToken('primary');
      setCadence('Morning Ritual');
      setTargetFrequency('Every Day');
      setLinkedGoal(goals.length > 0 ? goals[0].title : '');
      setDescription('');
      setGraceDays(1);
    }
    setConfirmDelete(false);
  }, [habit, goals, isOpen]);

  if (!isOpen) return null;

  const activeSignpost = ICONS_CATALOG.find(i => i.icon === icon) || ICONS_CATALOG[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      ...(habit || {}),
      title: title.trim(),
      duration: duration.trim() || '30 mins',
      icon,
      colorToken: colorToken || activeSignpost.colorToken || 'primary',
      cadence,
      targetFrequency,
      linkedGoal: linkedGoal.trim(),
      description: description.trim(),
      graceDays: Number(graceDays) || 0
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/45 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-[0_32px_80px_-16px_rgba(0,0,0,0.22),0_0_1px_1px_rgba(0,0,0,0.06)] border border-black/[0.08] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Subtle Ambient Color Line */}
        <div
          className="h-1 w-full transition-colors duration-300"
          style={{ backgroundColor: activeSignpost.accentHex }}
        />

        {/* Modal Header */}
        <header className="px-6 sm:px-8 pt-6 pb-4 flex items-center justify-between border-b border-black/[0.05] bg-surface-container-lowest shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant font-medium">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeSignpost.accentHex }} />
                {isEditing ? 'Sequence Calibration' : 'New Habit Architecture'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface mt-1">
              {isEditing ? 'Edit Habit Sequence' : 'Create Recurring Habit'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-5 space-y-6 overflow-y-auto flex-1">
          {/* 1. Live Interactive Preview Card (Senior UX Principle: Consequential Transparency) */}
          <div className="relative rounded-2xl bg-gradient-to-br from-surface-container-lowest to-surface-container-low/60 p-4 sm:p-5 border border-black/[0.07] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-outline">Live Card Preview</span>
              <span className="text-[11px] font-semibold text-secondary flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                Real-time Feedback
              </span>
            </div>

            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl ${activeSignpost.iconBg} flex items-center justify-center shrink-0 shadow-xs transition-all`}
              >
                <span
                  className="material-symbols-outlined text-[24px]"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  {icon}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base sm:text-lg font-bold text-on-surface truncate">
                    {title.trim() || 'Untitled Habit Sequence'}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container font-caption text-caption text-on-surface-variant font-medium">
                    {duration}
                  </span>
                  {linkedGoal && (
                    <span className="text-xs font-semibold flex items-center gap-0.5" style={{ color: activeSignpost.accentHex }}>
                      <span>→ {linkedGoal}</span>
                      <span className="material-symbols-outlined text-[13px]">arrow_outward</span>
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-[14px] text-outline">schedule</span>
                    {cadence}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-[14px] text-outline">repeat</span>
                    {targetFrequency}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-secondary font-medium">
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: '"FILL" 1' }}>verified_user</span>
                    {graceDays} Shield Days
                  </span>
                </div>

                {description.trim() && (
                  <p className="mt-2 text-xs text-on-surface-variant italic truncate max-w-md">
                    "{description.trim()}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 2. Habit Title Input (Ultra-Clean, High Craft Minimalist) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Habit Title
              </label>
              <span className="text-[11px] text-neutral-400">Name your recurring practice</span>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Morning Deep Work, Zone 2 Cardio, Evening Reading"
                className="w-full px-4 py-3 rounded-2xl bg-neutral-50/70 hover:bg-neutral-50 focus:bg-white border border-neutral-200/90 text-base font-semibold text-neutral-900 placeholder:text-neutral-400/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus:outline-none focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/[0.04] transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* 3. Curated Visual Signpost Grid (Auto Color-Themed) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Visual Signpost &amp; Theme
              </label>
              <span className="text-[11px] font-medium text-neutral-400">
                Auto-calibrates color accent
              </span>
            </div>

            {/* Curated Icon Grid (Auto-Assigned Colors, zero manual palette clutter) */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
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
                    className={`group/icon relative flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? `${item.activeClass} shadow-xs scale-[1.03] font-bold`
                        : 'bg-neutral-50/70 border-neutral-200/60 hover:bg-neutral-100/70 hover:border-neutral-300 text-neutral-600 hover:text-neutral-900'
                    }`}
                    title={`${item.label}`}
                  >
                    {/* Subtle color pip on top right indicating signature shade */}
                    <span
                      className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full transition-opacity opacity-50 group-hover/icon:opacity-100"
                      style={{ backgroundColor: item.accentHex }}
                    />
                    <span
                      className="material-symbols-outlined text-[22px] mb-1 transition-transform group-hover/icon:scale-110"
                      style={isSelected ? { fontVariationSettings: '"FILL" 1' } : {}}
                    >
                      {item.icon}
                    </span>
                    <span className="text-[11px] leading-tight tracking-tight">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Cadence & Rhythm (Grid of 2x2 with generous breathing room, NO truncation) */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Daily Anchor Window
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CADENCE_OPTIONS.map((item) => {
                const isSelected = cadence === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCadence(item.id)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-surface-container-lowest border-primary ring-2 ring-primary/20 shadow-xs'
                        : 'bg-surface-container-low/60 border-black/[0.06] hover:bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`material-symbols-outlined text-[20px] ${isSelected ? 'text-primary' : 'text-outline'}`}>
                        {item.icon}
                      </span>
                      <span className={`text-sm font-semibold truncate ${isSelected ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-surface-container text-outline uppercase tracking-wider shrink-0 ml-2">
                      {item.period}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Target Frequency & Duration Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Frequency Segmented Group */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Target Frequency
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FREQUENCY_OPTIONS.map((freq) => {
                  const isSelected = targetFrequency === freq.id;
                  return (
                    <button
                      key={freq.id}
                      type="button"
                      onClick={() => setTargetFrequency(freq.id)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-surface-container-lowest border-primary ring-2 ring-primary/20 shadow-xs'
                          : 'bg-surface-container-low/60 border-black/[0.06] hover:bg-surface-container-low'
                      }`}
                    >
                      <span className={`text-xs font-bold ${isSelected ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {freq.label}
                      </span>
                      <span className="text-[10px] text-outline mt-0.5">{freq.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Block Duration
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomDuration(!isCustomDuration)}
                  className="text-xs font-semibold text-primary hover:underline"
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-black/[0.08] text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {DURATION_PRESETS.map((p) => {
                    const isSelected = duration === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDuration(p)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-primary text-white shadow-xs font-bold'
                            : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
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

          {/* 6. Context & Anchor (Subtle Grouped Container) */}
          <div className="rounded-2xl bg-surface-container-low/50 border border-black/[0.06] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Contextual Anchors &amp; Grace Shield
              </h5>
              <span className="text-[11px] text-outline">Protects streak momentum</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Linked Goal Dropdown */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-on-surface">
                  Linked Horizon Goal
                </label>
                <select
                  value={linkedGoal}
                  onChange={(e) => setLinkedGoal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-black/[0.08] text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">None (Independent Habit)</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.title}>
                      🎯 {g.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grace Shield Counter */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-on-surface">
                  Grace Shield Pool (Days)
                </label>
                <div className="flex items-center gap-2">
                  {[0, 1, 2, 3].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setGraceDays(val)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        graceDays === val
                          ? 'bg-secondary text-white shadow-xs font-bold'
                          : 'bg-white border border-black/[0.08] text-on-surface-variant hover:bg-surface-container-low'
                      }`}
                    >
                      {val === 0 ? 'Off' : `${val} d`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Ritual Note / Anchor Cue */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-on-surface">
                Implementation Intent / Anchor Cue
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. When my first morning espresso brews, I will sit at my desk and write."
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-black/[0.08] text-xs font-medium text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Modal Footer Bar */}
          <footer className="pt-3 border-t border-black/[0.06] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
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
                      className="px-3 py-1.5 rounded-xl bg-error text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1.5 text-xs text-outline hover:text-on-surface"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-error hover:bg-red-50 text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Delete Sequence</span>
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex items-center gap-1.5 px-6 py-2.5 rounded-full ${activeSignpost.btnClass} font-semibold text-xs tracking-wide shadow-sm hover:opacity-95 active:scale-95 transition-all`}
              >
                <span className="material-symbols-outlined text-[16px]">
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
