import React, { useState, useEffect, useRef } from 'react';
import {
  calculateDuration,
  calculateEndTime,
  formatDurationLabel,
  formatTimeString
} from '../lib/taskMetadata';
import { LIFE_AREAS } from '../lib/lifeAreas';
import { CupertinoTimeInput } from './QuickAddModal';

const DAY_LABELS = [
  { day: 0, label: 'Su', full: 'Sunday' },
  { day: 1, label: 'Mo', full: 'Monday' },
  { day: 2, label: 'Tu', full: 'Tuesday' },
  { day: 3, label: 'We', full: 'Wednesday' },
  { day: 4, label: 'Th', full: 'Thursday' },
  { day: 5, label: 'Fr', full: 'Friday' },
  { day: 6, label: 'Sa', full: 'Saturday' }
];

export default function ScheduleDetailModal({
  schedule,
  isOpen,
  onClose,
  onUpdateSchedule,
  onDeleteSchedule
}) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [recurrence, setRecurrence] = useState('custom');
  const [repeatDays, setRepeatDays] = useState([1, 2, 3, 4, 5]);
  const [category, setCategory] = useState('College');
  const [notes, setNotes] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title || '');
      setStartTime(schedule.startTime || '09:00');
      setEndTime(schedule.endTime || calculateEndTime(schedule.startTime || '09:00', schedule.durationMinutes || 60));
      setDurationMinutes(schedule.durationMinutes || 60);
      setRecurrence(schedule.recurrence || (Array.isArray(schedule.repeatDays) ? 'custom' : 'none'));
      setRepeatDays(Array.isArray(schedule.repeatDays) ? schedule.repeatDays : [1, 2, 3, 4, 5]);
      setCategory(schedule.category || (Array.isArray(schedule.areas) ? schedule.areas[0] : 'College') || 'College');
      setNotes(schedule.notes || '');
      setShowConfirmDelete(false);
    }
  }, [schedule]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !schedule) return null;

  const handleStartTimeChange = (val) => {
    setStartTime(val);
    if (val && endTime) {
      const diff = calculateDuration(val, endTime);
      if (diff > 0) setDurationMinutes(diff);
      else setEndTime(calculateEndTime(val, durationMinutes || 60));
    } else if (val && durationMinutes) {
      setEndTime(calculateEndTime(val, durationMinutes));
    }
  };

  const handleEndTimeChange = (val) => {
    setEndTime(val);
    if (startTime && val) {
      const diff = calculateDuration(startTime, val);
      if (diff > 0) setDurationMinutes(diff);
    }
  };

  const toggleDay = (dayNum) => {
    setRepeatDays(prev => {
      if (prev.includes(dayNum)) {
        if (prev.length <= 1) return prev; // keep at least 1 day
        return prev.filter(d => d !== dayNum);
      }
      return [...prev, dayNum].sort((a, b) => a - b);
    });
  };

  const setWeekdayPreset = () => {
    setRecurrence('custom');
    setRepeatDays([1, 2, 3, 4, 5]);
  };

  const setMwfPreset = () => {
    setRecurrence('custom');
    setRepeatDays([1, 3, 5]);
  };

  const setDailyPreset = () => {
    setRecurrence('daily');
    setRepeatDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const handleSave = (e) => {
    e?.preventDefault();
    if (!title.trim()) return;

    const computedDuration = (startTime && endTime)
      ? Math.max(15, calculateDuration(startTime, endTime))
      : (durationMinutes || 60);

    const patch = {
      title: title.trim(),
      startTime: startTime || '09:00',
      endTime: endTime || calculateEndTime(startTime || '09:00', computedDuration),
      durationMinutes: computedDuration,
      recurrence: recurrence !== 'none' ? recurrence : null,
      repeatDays: recurrence === 'custom' ? repeatDays : recurrence === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : null,
      category,
      areas: [category],
      notes: notes.trim()
    };

    onUpdateSchedule?.(schedule.id, patch);
    onClose();
  };

  const handleDelete = () => {
    onDeleteSchedule?.(schedule.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[560px] bg-white rounded-3xl border border-black/[0.08] shadow-[0_32px_96px_rgba(0,0,0,0.22)] overflow-hidden flex flex-col max-h-[92vh] text-[#1A1B1F]"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] bg-[#FAFAFC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shadow-2xs">
              <span className="material-symbols-outlined text-[19px]">school</span>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#1A1B1F] tracking-tight">Edit Class / Schedule Block</h2>
              <p className="text-[11px] text-[#64748B]">Fixed timetable routines appear on your calendar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#8E8E93] hover:text-[#1A1B1F] hover:bg-black/[0.05] transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1.5">
              Class / Routine Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operating Systems Lecture, Physics Lab"
              className="w-full px-4 py-2.5 rounded-xl bg-[#F5F4FA] border border-black/[0.06] text-[15px] font-semibold text-[#1A1B1F] focus:bg-white focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] outline-none transition"
              autoFocus
              required
            />
          </div>

          {/* Time & Duration */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200/60">
            <CupertinoTimeInput
              label="Start Time"
              value={startTime}
              onChange={handleStartTimeChange}
              placeholder="09:00"
            />
            <CupertinoTimeInput
              label="End Time"
              value={endTime}
              onChange={handleEndTimeChange}
              placeholder="10:00"
            />
            <div className="col-span-2 flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-200/50">
              <span className="font-medium">Total Duration:</span>
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                {formatDurationLabel(durationMinutes || 60)}
              </span>
            </div>
          </div>

          {/* Recurrence & Repeat Days */}
          <div className="space-y-2.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
              Schedule Recurrence
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#F5F4FA] rounded-xl border border-black/[0.04]">
              {[
                { id: 'custom', label: 'Custom' },
                { id: 'daily', label: 'Daily' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'none', label: 'Once' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRecurrence(opt.id)}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition text-center cursor-pointer ${
                    recurrence === opt.id
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold border border-black/[0.04]'
                      : 'text-[#64748B] hover:text-[#1A1B1F]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Day Selector (for custom recurrence) */}
            {recurrence === 'custom' && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100/70 space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-indigo-950">Active Days</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={setMwfPreset}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      MWF
                    </button>
                    <span className="text-indigo-300">•</span>
                    <button
                      type="button"
                      onClick={setWeekdayPreset}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      Weekdays
                    </button>
                    <span className="text-indigo-300">•</span>
                    <button
                      type="button"
                      onClick={setDailyPreset}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      Every day
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_LABELS.map(({ day, label }) => {
                    const active = repeatDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`h-9 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white shadow-xs scale-100'
                            : 'bg-white text-slate-500 border border-indigo-100 hover:bg-indigo-50/60'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Life Area / Category */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {['College', 'Academics', 'Deep Focus', 'Work', 'Personal'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                    category === cat
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-[#F5F4FA] text-[#64748B] border-transparent hover:bg-[#EBEBF0]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1.5">
              Location / Room / Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Hall 4B, Room 302, Prof. Sharma"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F5F4FA] border border-black/[0.06] text-xs text-[#1A1B1F] focus:bg-white focus:border-indigo-500 outline-none transition"
            />
          </div>

          {/* Delete confirmation banner */}
          {showConfirmDelete && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2 animate-fadeIn">
              <p className="text-xs font-bold">Remove this schedule block?</p>
              <p className="text-[11px] text-rose-700">This will remove it from all recurring days on your timetable.</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-black/[0.06] bg-[#FAFAFC]">
          {!showConfirmDelete ? (
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>Delete</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-black/[0.05] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim()}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
