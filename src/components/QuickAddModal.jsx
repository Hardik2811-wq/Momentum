import React, { useState } from 'react';

export default function QuickAddModal({
  isOpen,
  onClose,
  onAddTask,
  goals = [],
  initialTime = '',
  initialDate = 'Today'
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('normal');
  const [category, setCategory] = useState('Deep Work');
  const [dueDate, setDueDate] = useState(initialDate || 'Today');
  const [startTime, setStartTime] = useState(initialTime || '');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [context, setContext] = useState('@Laptop');
  const [energy, setEnergy] = useState('High');
  const [goalId, setGoalId] = useState('');

  // Sync initial props when opened with prefilled time
  React.useEffect(() => {
    if (isOpen) {
      if (initialTime) setStartTime(initialTime);
      if (initialDate) setDueDate(initialDate);
    }
  }, [isOpen, initialTime, initialDate]);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddTask({
      id: Date.now(),
      title: title.trim(),
      priority,
      category,
      dueDate,
      date: dueDate,
      startTime: startTime || null,
      durationMinutes: startTime ? Number(durationMinutes) || 60 : null,
      context,
      energy,
      goalId: goalId || null,
      completed: false,
      subtasks: []
    });
    setTitle('');
    setStartTime('');
    setGoalId('');
    onClose();
  };

  const card = 'bg-white border-black/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.14)]';
  const input = 'bg-[#F5F4FA] border-black/[0.07] text-[#1A1B1F] focus:bg-white focus:border-[#0A84FF]/60 focus:shadow-[0_0_0_3px_rgba(10,132,255,0.12)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn" role="presentation" onMouseDown={onClose}>
      <div className={`w-full max-w-md rounded-2xl border overflow-hidden ${card}`} role="dialog" aria-modal="true" aria-labelledby="quick-add-title" onMouseDown={(event) => event.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-white text-[15px]">add_task</span>
            </div>
            <div>
              <h3 id="quick-add-title" className="text-[14px] font-semibold tracking-tight text-[#1A1B1F]">
                Quick Add
              </h3>
              <p className="text-[11px] text-[#888]">
                Add to Momentum schedule
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close quick add" onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-black/[0.05] text-[#BBBBC0]">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[#BBBBC0]">
              Task
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Finalize Q4 architecture review"
              className={`w-full px-3.5 py-2 rounded-xl text-[13px] outline-none border transition-all ${input}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[#BBBBC0]">
                Due Date / Horizon
              </label>
              <select
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-[12px] outline-none border transition-all ${input}`}
              >
                <option value="Today">📅 Today</option>
                <option value="Tomorrow">⏳ Tomorrow</option>
                <option value="This Week">🗓️ This Week</option>
                <option value="Someday">📦 Someday / Backlog</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[#BBBBC0]">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-[12px] outline-none border transition-all ${input}`}
              >
                <option value="high">🔴 High</option>
                <option value="normal">🟡 Normal</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
          </div>

          {/* Schedule Time & Duration */}
          <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-black/[0.02] border border-black/[0.05]">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[#1A1B1F] flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-[#0A84FF]">schedule</span>
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-xl text-[12px] outline-none border transition-all ${input}`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[#1A1B1F] flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-[#0A84FF]">timelapse</span>
                Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                disabled={!startTime}
                className={`w-full px-3 py-2 rounded-xl text-[12px] outline-none border transition-all ${input} ${!startTime ? 'opacity-50' : ''}`}
              >
                <option value="30">30 mins</option>
                <option value="45">45 mins</option>
                <option value="60">60 mins (1 hr)</option>
                <option value="90">90 mins (1.5 hr)</option>
                <option value="120">120 mins (2 hr)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[#BBBBC0]">
                Context
              </label>
              <select
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-[12px] outline-none border transition-all ${input}`}
              >
                <option value="@Laptop">💻 @Laptop</option>
                <option value="@Home">🏠 @Home</option>
                <option value="@Calls">📞 @Calls</option>
                <option value="@Errands">🏃 @Errands</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[#BBBBC0]">
                Energy Level
              </label>
              <select
                value={energy}
                onChange={(e) => setEnergy(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-[12px] outline-none border transition-all ${input}`}
              >
                <option value="High">⚡ High Cognitive</option>
                <option value="Medium">🔋 Balanced</option>
                <option value="Low">☕ Low Effort</option>
              </select>
            </div>
          </div>

          {/* Linked Goal Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-[#BBBBC0]">
              Link to Strategic Goal (Optional)
            </label>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-[12px] outline-none border transition-all ${input}`}
            >
              <option value="">None (Independent Task)</option>
              {goals.map(g => (
                <option key={g.id} value={g.id}>
                  🎯 {g.title} ({g.category})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] font-medium transition-colors text-[#BBBBC0] hover:bg-black/[0.05]">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-xl text-[12px] font-semibold bg-[#0A84FF] text-white hover:bg-[#0071E3] transition-all active:scale-95 shadow-sm shadow-blue-500/30">
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
