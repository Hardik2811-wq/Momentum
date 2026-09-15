import React, { useState, useEffect } from 'react';

export default function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onUpdateTask,
  onDeleteTask,
  goals = []
}) {
  const [formData, setFormData] = useState({
    title: '',
    priority: 'normal',
    category: 'Deep Work',
    dueDate: 'Today',
    startTime: '',
    durationMinutes: 60,
    context: '@Laptop',
    energy: 'High',
    goalId: '',
    notes: '',
    subtasks: []
  });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        priority: task.priority || 'normal',
        category: task.category || 'Deep Work',
        dueDate: task.dueDate || task.date || 'Today',
        startTime: task.startTime || '',
        durationMinutes: task.durationMinutes || 60,
        context: task.context || '@Laptop',
        energy: task.energy || 'High',
        goalId: task.goalId || '',
        notes: task.notes || '',
        subtasks: task.subtasks || []
      });
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleAddSubtask = (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const sub = { id: 's-' + Date.now(), title: newSubtaskTitle.trim(), completed: false };
    setFormData(prev => ({
      ...prev,
      subtasks: [...(prev.subtasks || []), sub]
    }));
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subId) => {
    setFormData(prev => ({
      ...prev,
      subtasks: (prev.subtasks || []).map(s => s.id === subId ? { ...s, completed: !s.completed } : s)
    }));
  };

  const handleDeleteSubtask = (subId) => {
    setFormData(prev => ({
      ...prev,
      subtasks: (prev.subtasks || []).filter(s => s.id !== subId)
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onUpdateTask(task.id, {
      title: formData.title.trim(),
      priority: formData.priority,
      category: formData.category,
      dueDate: formData.dueDate,
      context: formData.context,
      energy: formData.energy,
      goalId: formData.goalId || null,
      notes: formData.notes,
      subtasks: formData.subtasks
    });
    onClose();
  };

  const inputCls = 'bg-[#F5F4FA] border-black/[0.07] text-[#1A1B1F] focus:bg-white focus:border-[#0A84FF]/60 focus:shadow-[0_0_0_3px_rgba(10,132,255,0.12)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-black/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.16)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className={`w-3 h-3 rounded-full ${
              formData.priority === 'high' ? 'bg-red-500' : formData.priority === 'normal' ? 'bg-amber-400' : 'bg-emerald-400'
            }`} />
            <div>
              <h3 className="text-[14px] font-semibold text-[#1A1B1F]">
                Edit Task
              </h3>
              <p className="text-[11px] text-[#888]">
                ID #{task.id} • Last modified
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/[0.05] text-[#888] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#888]">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none border font-medium ${inputCls}`}
              placeholder="Task name"
            />
          </div>

          {/* Grid 1: Due Date & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#888]">
                Due Date / Horizon
              </label>
              <select
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className={`w-full px-3 py-2 rounded-xl outline-none border ${inputCls}`}
              >
                <option value="Today">📅 Today</option>
                <option value="Tomorrow">⏳ Tomorrow</option>
                <option value="This Week">🗓️ This Week</option>
                <option value="This Quarter">🎯 This Quarter</option>
                <option value="Someday">📦 Someday / Backlog</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#888]">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className={`w-full px-3 py-2 rounded-xl outline-none border ${inputCls}`}
              >
                <option value="high">🔴 High Impact</option>
                <option value="normal">🟡 Normal</option>
                <option value="low">🟢 Low / Quick Win</option>
              </select>
            </div>
          </div>

          {/* Schedule Time & Duration */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-black/[0.02] border border-black/[0.05]">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#1A1B1F] flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-[#0A84FF]">schedule</span>
                Start Time
              </label>
              <input
                type="time"
                value={formData.startTime || ''}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className={`w-full px-3 py-1.5 rounded-xl text-[12px] outline-none border ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#1A1B1F] flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-[#0A84FF]">timelapse</span>
                Duration
              </label>
              <select
                value={formData.durationMinutes || 60}
                onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                disabled={!formData.startTime}
                className={`w-full px-3 py-2 rounded-xl text-[12px] outline-none border ${inputCls} ${!formData.startTime ? 'opacity-50' : ''}`}
              >
                <option value="30">30 mins</option>
                <option value="45">45 mins</option>
                <option value="60">60 mins (1 hr)</option>
                <option value="90">90 mins (1.5 hr)</option>
                <option value="120">120 mins (2 hr)</option>
              </select>
            </div>
          </div>

          {/* Grid 2: Context & Energy */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#888]">
                Context
              </label>
              <select
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                className={`w-full px-3 py-2 rounded-xl outline-none border ${inputCls}`}
              >
                <option value="@Laptop">💻 @Laptop</option>
                <option value="@Home">🏠 @Home</option>
                <option value="@Calls">📞 @Calls</option>
                <option value="@Errands">🏃 @Errands</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#888]">
                Energy Required
              </label>
              <select
                value={formData.energy}
                onChange={(e) => setFormData({ ...formData, energy: e.target.value })}
                className={`w-full px-3 py-2 rounded-xl outline-none border ${inputCls}`}
              >
                <option value="High">⚡ High Cognitive</option>
                <option value="Medium">🔋 Balanced Flow</option>
                <option value="Low">☕ Low Overhead</option>
              </select>
            </div>
          </div>

          {/* Linked Strategic Goal */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#888]">
              Linked Strategic Goal
            </label>
            <select
              value={formData.goalId}
              onChange={(e) => setFormData({ ...formData, goalId: e.target.value })}
              className={`w-full px-3 py-2 rounded-xl outline-none border ${inputCls}`}
            >
              <option value="">None (Independent Deliverable)</option>
              {goals.map(g => (
                <option key={g.id} value={g.id}>
                  🎯 {g.title} ({g.category})
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#888]">
              Execution Notes &amp; Links
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Checklists, reference URLs, kickoff steps..."
              className={`w-full px-3 py-2 rounded-xl outline-none border resize-none ${inputCls}`}
            />
          </div>

          {/* Subtasks Checklist */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-[#888]">
              Subtasks ({formData.subtasks.filter(s => s.completed).length}/{formData.subtasks.length})
            </label>
            <div className="space-y-1.5 mb-2">
              {formData.subtasks.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-xl bg-[#F5F4FA] border border-black/[0.04]">
                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={s.completed}
                      onChange={() => handleToggleSubtask(s.id)}
                      className="rounded text-[#0A84FF] focus:ring-0 cursor-pointer"
                    />
                    <span className={`text-[12px] truncate ${s.completed ? 'line-through text-[#999]' : 'text-[#1A1B1F]'}`}>
                      {s.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDeleteSubtask(s.id)}
                    className="p-1 text-[#BBB] hover:text-red-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Add Subtask Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="+ Add subtask"
                className={`flex-1 px-3 py-1.5 rounded-xl text-[12px] outline-none border ${inputCls}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask(e);
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 rounded-xl bg-black/[0.05] hover:bg-black/[0.1] font-semibold text-[11px]"
              >
                Add
              </button>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#F9F9FB] border-t border-black/[0.05]">
          <button
            type="button"
            onClick={() => {
              onDeleteTask?.(task.id);
              onClose();
            }}
            className="flex items-center gap-1 text-red-500 hover:text-red-600 text-[12px] font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
            <span>Delete</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[12px] font-medium text-[#71717A] hover:bg-black/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-[12px] font-semibold bg-[#0A84FF] text-white hover:bg-[#0071E3] transition-all active:scale-95 shadow-sm shadow-blue-500/25"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
