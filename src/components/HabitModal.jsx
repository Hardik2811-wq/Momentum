import React, { useState, useEffect } from 'react';

const DURATION_PRESETS = ['15 mins', '30 mins', '45 mins', '60 mins', '90 mins'];

const CADENCE_PRESETS = [
  { id: 'morning', label: 'Morning Ritual', icon: 'wb_sunny' },
  { id: 'afternoon', label: 'Afternoon Flow', icon: 'bolt' },
  { id: 'evening', label: 'Evening Wind-down', icon: 'nights_stay' },
  { id: 'anytime', label: 'Anytime', icon: 'schedule' }
];

const FREQUENCY_PRESETS = [
  { id: 'daily', label: 'Every Day', desc: '7 days / wk' },
  { id: 'weekdays', label: 'Weekdays', desc: 'Mon – Fri' },
  { id: '4days', label: '4 Days / Wk', desc: 'Flexible cadence' },
  { id: '3days', label: '3 Days / Wk', desc: 'Active recovery' }
];

const ICONS_CATALOG = [
  { icon: 'terminal', label: 'Deep Work' },
  { icon: 'directions_run', label: 'Cardio' },
  { icon: 'fitness_center', label: 'Strength' },
  { icon: 'auto_stories', label: 'Reading' },
  { icon: 'self_improvement', label: 'Mindful' },
  { icon: 'music_note', label: 'Music' },
  { icon: 'water_drop', label: 'Hydration' },
  { icon: 'bolt', label: 'Energy' },
  { icon: 'brush', label: 'Creative' },
  { icon: 'bedtime', label: 'Rest' },
  { icon: 'restaurant', label: 'Nutrition' },
  { icon: 'hiking', label: 'Outdoors' }
];

const COLOR_TOKENS = [
  { id: 'primary', label: 'Indigo', bgClass: 'bg-primary', borderClass: 'border-primary', ringClass: 'ring-primary' },
  { id: 'secondary', label: 'Emerald', bgClass: 'bg-secondary', borderClass: 'border-secondary', ringClass: 'ring-secondary' },
  { id: 'tertiary', label: 'Coral', bgClass: 'bg-tertiary', borderClass: 'border-tertiary', ringClass: 'ring-tertiary' }
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
  const [customDuration, setCustomDuration] = useState(false);
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
      setCustomDuration(!DURATION_PRESETS.includes(dur));
      setIcon(habit.icon || 'terminal');
      setColorToken(habit.colorToken || 'primary');
      setCadence(habit.cadence || 'Morning Ritual');
      setTargetFrequency(habit.targetFrequency || 'Every Day');
      setLinkedGoal(habit.linkedGoal || '');
      setDescription(habit.description || '');
      setGraceDays(habit.graceDays ?? 1);
    } else {
      // Smart defaults (UX Psychology: Smart Defaults & Goal Gradient)
      setTitle('');
      setDuration('30 mins');
      setCustomDuration(false);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      ...(habit || {}),
      title: title.trim(),
      duration: duration.trim() || '30 mins',
      icon,
      colorToken,
      cadence,
      targetFrequency,
      linkedGoal: linkedGoal.trim(),
      description: description.trim(),
      graceDays: Number(graceDays) || 0
    };

    onSave(payload);
    onClose();
  };

  const selectedColor = COLOR_TOKENS.find(c => c.id === colorToken) || COLOR_TOKENS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-xl my-8 bg-surface-container-lowest text-on-surface rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.22)] border border-outline-variant/30 overflow-hidden transform transition-all">
        {/* Ambient Top Glow Bar */}
        <div className={`h-1.5 w-full ${selectedColor.bgClass} transition-colors duration-300`} />

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                {isEditing ? 'Habit Calibration' : 'Mindful Ritual'}
              </span>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface mt-0.5">
                {isEditing ? 'Edit Habit Sequence' : 'Create New Habit'}
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Small consistent loops form effortless permanent momentum.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label="Close dialog"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Habit Title Input */}
          <div className="space-y-1.5">
            <label className="block font-label-md text-label-md font-semibold text-on-surface">
              What recurring practice are you cultivating?
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Morning Deep Work, Zone 2 Running, Evening Reading"
                className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-base font-medium transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Visual Icon Picker */}
          <div className="space-y-2">
            <label className="block font-label-md text-label-md font-semibold text-on-surface">
              Visual Signpost &amp; Anchor Icon
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {ICONS_CATALOG.map((item) => {
                const isActive = icon === item.icon;
                return (
                  <button
                    key={item.icon}
                    type="button"
                    onClick={() => setIcon(item.icon)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all ${
                      isActive
                        ? `${selectedColor.bgClass} text-white shadow-md scale-105 ring-2 ring-offset-2 ring-primary/40`
                        : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
                    }`}
                    title={item.label}
                  >
                    <span
                      className="material-symbols-outlined text-[24px] mb-1"
                      style={isActive ? { fontVariationSettings: '"FILL" 1' } : {}}
                    >
                      {item.icon}
                    </span>
                    <span className="text-[10px] font-medium leading-tight truncate w-full text-center">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration Preset Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md font-semibold text-on-surface">
                Session Duration
              </label>
              <button
                type="button"
                onClick={() => setCustomDuration(!customDuration)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {customDuration ? 'Use presets' : 'Custom'}
              </button>
            </div>
            {customDuration ? (
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 20 mins, 45m"
                className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((preset) => {
                  const isActive = duration === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDuration(preset)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-primary text-on-primary shadow-sm scale-105'
                          : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cadence & Time-of-Day */}
          <div className="space-y-2">
            <label className="block font-label-md text-label-md font-semibold text-on-surface">
              Daily Cadence
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CADENCE_PRESETS.map((cad) => {
                const isActive = cadence === cad.label;
                return (
                  <button
                    key={cad.id}
                    type="button"
                    onClick={() => setCadence(cad.label)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-surface-container-high text-on-surface ring-2 ring-primary/40 shadow-xs'
                        : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">{cad.icon}</span>
                    <span className="truncate">{cad.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Frequency */}
          <div className="space-y-2">
            <label className="block font-label-md text-label-md font-semibold text-on-surface">
              Target Frequency
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FREQUENCY_PRESETS.map((freq) => {
                const isActive = targetFrequency === freq.label;
                return (
                  <button
                    key={freq.id}
                    type="button"
                    onClick={() => setTargetFrequency(freq.label)}
                    className={`flex flex-col items-start p-2.5 rounded-xl transition-all ${
                      isActive
                        ? 'bg-surface-container-high text-on-surface ring-2 ring-primary/40 shadow-xs'
                        : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <span className="text-xs font-bold text-on-surface">{freq.label}</span>
                    <span className="text-[10px] text-on-surface-variant leading-tight">{freq.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Linked Goal Dropdown & Color Accent in 2 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Linked Goal Dropdown */}
            <div className="space-y-1.5">
              <label className="block font-label-md text-label-md font-semibold text-on-surface">
                Linked Long-Term Goal
              </label>
              <select
                value={linkedGoal}
                onChange={(e) => setLinkedGoal(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">None (Standalone Habit)</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.title}>
                    🎯 {g.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Color Accent Picker */}
            <div className="space-y-1.5">
              <label className="block font-label-md text-label-md font-semibold text-on-surface">
                Accent Token
              </label>
              <div className="flex items-center gap-3 pt-1">
                {COLOR_TOKENS.map((c) => {
                  const isActive = colorToken === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColorToken(c.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        isActive
                          ? `${c.borderClass} ${c.ringClass} ring-2 bg-surface-container-high text-on-surface font-bold`
                          : 'border-transparent bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${c.bgClass}`} />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Description & Grace Days */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block font-label-md text-label-md font-semibold text-on-surface">
                Anchor Cue or Ritual Note
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Directly after first cup of coffee, phone in do-not-disturb."
                className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-label-md text-label-md font-semibold text-on-surface">
                Grace Shield Days
              </label>
              <input
                type="number"
                min="0"
                max="7"
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-outline-variant/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {isEditing && onDelete ? (
              <div>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-error font-medium">Delete this sequence?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(habit.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-error text-on-error text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1 text-xs text-on-surface-variant hover:text-on-surface"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-error hover:bg-error-container/30 text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Delete Sequence</span>
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
                className="px-5 py-2.5 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-primary text-on-primary hover:opacity-90 font-label-md text-label-md font-semibold shadow-md active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isEditing ? 'check' : 'add'}
                </span>
                <span>{isEditing ? 'Save Changes' : 'Create Sequence'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
