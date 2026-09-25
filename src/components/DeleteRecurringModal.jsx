import React, { useState, useEffect } from 'react';
import { planDateLabel, todayPlanDate } from '../lib/taskMetadata';

export default function DeleteRecurringModal({
  isOpen,
  task,
  targetDate,
  onClose,
  onConfirm
}) {
  const [mode, setMode] = useState('this'); // 'this' | 'following' | 'all'

  useEffect(() => {
    if (isOpen) {
      setMode('this');
    }
  }, [isOpen]);

  // Keyboard navigation: Enter to confirm, Escape to cancel
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm?.({ mode, targetDate: targetDate || todayPlanDate() });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, targetDate, onClose, onConfirm]);

  if (!isOpen || !task) return null;

  const effectiveDate = targetDate || task.plannedDate || todayPlanDate();
  const dateFormatted = planDateLabel(effectiveDate);

  const handleConfirm = () => {
    onConfirm?.({
      mode,
      targetDate: effectiveDate
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-black/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.18)] overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600 shrink-0">
              <span className="material-symbols-outlined text-[20px]">event_busy</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-bold text-[#1A1B1F] tracking-tight">
                Delete recurring event
              </h3>
              <p className="text-[12px] text-[#71717A] mt-0.5 truncate">
                "{task.title}" · <span className="font-semibold text-slate-800">{dateFormatted}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Options matching Google Calendar */}
        <div className="px-5 py-2 space-y-2">
          {/* Option 1: This event */}
          <label
            className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
              mode === 'this'
                ? 'bg-blue-50/60 border-[#0A84FF] ring-1 ring-[#0A84FF]/20 shadow-2xs'
                : 'bg-white border-black/[0.07] hover:bg-[#F5F4FA]'
            }`}
          >
            <input
              type="radio"
              name="delete_recurrence_mode"
              value="this"
              checked={mode === 'this'}
              onChange={() => setMode('this')}
              className="mt-0.5 h-4 w-4 text-[#0A84FF] border-slate-300 focus:ring-[#0A84FF] accent-[#0A84FF]"
            />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[#1A1B1F]">
                This event
              </div>
              <p className="text-[11px] text-[#71717A] mt-0.5 leading-relaxed">
                Only removes this single occurrence on {dateFormatted}. Other dates in the series will not change.
              </p>
            </div>
          </label>

          {/* Option 2: This and following events */}
          <label
            className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
              mode === 'following'
                ? 'bg-blue-50/60 border-[#0A84FF] ring-1 ring-[#0A84FF]/20 shadow-2xs'
                : 'bg-white border-black/[0.07] hover:bg-[#F5F4FA]'
            }`}
          >
            <input
              type="radio"
              name="delete_recurrence_mode"
              value="following"
              checked={mode === 'following'}
              onChange={() => setMode('following')}
              className="mt-0.5 h-4 w-4 text-[#0A84FF] border-slate-300 focus:ring-[#0A84FF] accent-[#0A84FF]"
            />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[#1A1B1F]">
                This and following events
              </div>
              <p className="text-[11px] text-[#71717A] mt-0.5 leading-relaxed">
                Stops recurrence starting {dateFormatted}. Deletes this event and all future dates. Past events are kept.
              </p>
            </div>
          </label>

          {/* Option 3: All events */}
          <label
            className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
              mode === 'all'
                ? 'bg-rose-50/60 border-rose-400 ring-1 ring-rose-400/20 shadow-2xs'
                : 'bg-white border-black/[0.07] hover:bg-[#F5F4FA]'
            }`}
          >
            <input
              type="radio"
              name="delete_recurrence_mode"
              value="all"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
              className="mt-0.5 h-4 w-4 text-rose-600 border-slate-300 focus:ring-rose-500 accent-rose-600"
            />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[#1A1B1F]">
                All events
              </div>
              <p className="text-[11px] text-[#71717A] mt-0.5 leading-relaxed">
                Deletes every past, present, and future occurrence of this task entirely from your workspace.
              </p>
            </div>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 mt-3 bg-[#F9F9FB] border-t border-black/[0.06]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[12px] font-semibold text-[#64748B] hover:bg-black/[0.05] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-5 py-2 rounded-xl text-[12px] font-semibold text-white transition active:scale-95 shadow-sm ${
              mode === 'all'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/25'
                : 'bg-[#0A84FF] hover:bg-[#0071E3] shadow-blue-500/25'
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
