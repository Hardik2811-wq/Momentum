import React, { useState } from 'react';

export default function FocusTimerBar({ focusTimer, tasks = [], onClose }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!focusTimer) return null;

  const {
    isRunning,
    timeLeft,
    duration,
    mode,
    activeTaskId,
    startTimer,
    pauseTimer,
    resetTimer,
    switchTimerMode,
    setTimerTaskId
  } = focusTimer;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const progressPercent = duration > 0 ? Math.round(((duration - timeLeft) / duration) * 100) : 0;

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const uncompletedTasks = tasks.filter(t => !t.completed);

  return (
    <div className="fixed top-14 md:top-auto md:bottom-5 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-lg transition-all duration-300">
      <div className="bg-[#1A1B1F]/95 backdrop-blur-md text-white rounded-2xl border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.35)] overflow-hidden">
        {/* Progress line */}
        <div className="w-full h-1 bg-white/10">
          <div
            className={`h-full transition-all duration-1000 ${
              mode === 'focus' ? 'bg-[#0A84FF]' : 'bg-emerald-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Main Bar */}
        <div className="px-3.5 py-2.5 flex items-center justify-between gap-2.5">
          {/* Left: Mode icon & Time */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => switchTimerMode(mode === 'focus' ? 'break' : 'focus')}
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                mode === 'focus' ? 'bg-[#0A84FF]/20 text-[#0A84FF]' : 'bg-emerald-500/20 text-emerald-400'
              }`}
              title={`Switch to ${mode === 'focus' ? 'Break' : 'Focus'}`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {mode === 'focus' ? 'bolt' : 'coffee'}
              </span>
            </button>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[16px] font-bold tracking-tight text-white">
                  {timeDisplay}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full ${
                  mode === 'focus' ? 'bg-[#0A84FF]/25 text-[#0A84FF]' : 'bg-emerald-500/25 text-emerald-400'
                }`}>
                  {mode === 'focus' ? 'Deep Work' : 'Break'}
                </span>
              </div>
              <span className="text-[11px] text-white/60 truncate max-w-[150px] sm:max-w-[220px]">
                {activeTask ? activeTask.title : 'No task selected'}
              </span>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={isRunning ? pauseTimer : startTimer}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold transition-all active:scale-95 ${
                isRunning
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-[#0A84FF] hover:bg-[#0071E3] shadow-sm shadow-blue-500/30'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isRunning ? 'pause' : 'play_arrow'}
              </span>
            </button>

            <button
              onClick={resetTimer}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Reset timer"
            >
              <span className="material-symbols-outlined text-[16px]">replay</span>
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Expand task selector"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isExpanded ? 'expand_more' : 'tune'}
              </span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors ml-0.5"
                title="Hide focus bar (re-enable in Settings)"
                aria-label="Hide focus timer bar"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Expanded Panel: Anchor Task Selector */}
        {isExpanded && (
          <div className="px-4 pb-3 pt-1 border-t border-white/10 text-xs space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-white/60">
              <span className="text-[10px] font-bold uppercase tracking-wider">Anchor Focus Task</span>
              <span className="text-[10px]">{uncompletedTasks.length} pending</span>
            </div>
            <select
              value={activeTaskId || ''}
              onChange={(e) => setTimerTaskId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 rounded-xl bg-white/10 text-white text-[12px] outline-none border border-white/10 focus:border-[#0A84FF]"
            >
              <option value="" className="bg-[#1A1B1F] text-white">Select a task to anchor sprint...</option>
              {uncompletedTasks.map(t => (
                <option key={t.id} value={t.id} className="bg-[#1A1B1F] text-white">
                  {t.title} ({t.category})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
