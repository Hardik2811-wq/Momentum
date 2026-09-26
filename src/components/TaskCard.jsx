import React, { useState } from 'react';
import { deadlineStatus, effortLabel, IMPACT_LABELS, taskImpact, taskPlanLabel, taskPlanDate, todayPlanDate } from '../lib/taskMetadata';
import DeleteRecurringModal from './DeleteRecurringModal';

const PRIORITY_BADGES = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  low: 'bg-surface-container-high text-on-surface-variant border-black/5',
};

export default function TaskCard({
  task,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onToggleSubtask,
  onEditTask,
  goals = [],
  habits = []
}) {
  const [showDeleteRecurring, setShowDeleteRecurring] = useState(false);
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const linkedGoal = goals.find(g => g.id === task.goalId || g.id === task.linkedGoalId);
  const linkedHabit = habits.find(h => h.id === task.linkedHabitId || h.id === task.habitId);
  const impact = taskImpact(task);
  const plannedLabel = taskPlanLabel(task);
  const deadline = deadlineStatus(task);

  const formatTimeStr = (time) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m || 0).padStart(2, '0')} ${ampm}`;
  };

  // Format Due Time
  const formatDueTime = () => {
    if (task.startTime && task.endTime) {
      return `${plannedLabel}, ${formatTimeStr(task.startTime)} – ${formatTimeStr(task.endTime)}`;
    }
    if (task.startTime) {
      return `${plannedLabel}, ${formatTimeStr(task.startTime)}`;
    }
    return plannedLabel;
  };

  const isFlexible = Boolean(task.isFlexible || task.durationMinutes === null);
  const workDuration = isFlexible ? '~ Flexible' : effortLabel(task.durationMinutes);
  const completedSubtasksCount = (task.subtasks || []).filter(s => s.completed).length;

  const uniqueReasons = [
    deadline?.tone === 'overdue' && 'Deadline overdue',
    deadline?.tone === 'today' && 'Deadline today',
    task.waitingOn && `Waiting on ${task.waitingOn}`,
  ].filter(Boolean);

  const handleSubtaskCheck = (subtaskId) => {
    if (onToggleSubtask) {
      onToggleSubtask(task.id, subtaskId);
    } else if (onUpdateTask && task.subtasks) {
      const updated = task.subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
      onUpdateTask(task.id, { subtasks: updated });
    }
  };

  return (
    <div
      onClick={() => onEditTask?.(task)}
      className={`group relative flex flex-col p-3.5 sm:p-4 rounded-2xl bg-surface-container-lowest shadow-sm hover:shadow-md border border-black/[0.05] dark:border-white/[0.06] transition-all cursor-pointer ${
        task.completed ? 'opacity-60 bg-surface-container-low/40' : ''
      } ${impact === 'high' && !task.completed ? 'border-l-4 border-l-rose-500' : ''}`}
    >
      {/* Top Row: Checkbox, Title, Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTask(task.id);
            }}
            className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all flex-shrink-0 active:scale-90 ${
              task.completed
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-transparent hover:text-primary border border-black/10'
            }`}
            title={task.completed ? 'Mark incomplete' : 'Mark complete'}
          >
            <span className="material-symbols-outlined text-[14px]">done</span>
          </button>
          <div className="flex flex-col min-w-0 flex-1">
            <span
              className={`font-semibold text-sm sm:text-base text-on-surface tracking-tight group-hover:text-primary transition-colors ${
                task.completed ? 'line-through text-on-surface-variant' : ''
              }`}
            >
              {task.title}
            </span>
          </div>
        </div>

        {/* Priority Badge & Delete */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full border font-caption text-[11px] font-semibold ${
              PRIORITY_BADGES[impact] || PRIORITY_BADGES.medium
            }`}
          >
            {IMPACT_LABELS[impact]} impact
          </span>
          {onDeleteTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (task.recurrence && task.recurrence !== 'none') {
                  setShowDeleteRecurring(true);
                } else if (window.confirm('Delete this task?')) {
                  onDeleteTask(task.id);
                }
              }}
              className="p-1 rounded-full text-outline hover:text-error hover:bg-error-container/30 transition-colors opacity-0 group-hover:opacity-100"
              title={task.recurrence && task.recurrence !== 'none' ? 'Delete recurring event' : 'Delete task'}
            >
              <span className="material-symbols-outlined text-[15px]">
                {task.recurrence && task.recurrence !== 'none' ? 'delete' : 'close'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Plan, deadline, effort, and linked goal */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container text-[11px] font-medium text-on-surface-variant">
          <span className="material-symbols-outlined text-[13px] text-primary">schedule</span>
          <span>{task.startTime ? formatDueTime() : plannedLabel}</span>
        </span>

        {deadline && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
            deadline.tone === 'overdue'
              ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
              : deadline.tone === 'today'
              ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
              : 'bg-surface-container text-on-surface-variant'
          }`}>
            <span className="material-symbols-outlined text-[13px]">flag</span>
            <span>{deadline.label}</span>
          </span>
        )}

        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container text-[11px] font-medium text-on-surface-variant">
          <span className="material-symbols-outlined text-[13px] text-amber-600">
            {isFlexible ? 'all_inclusive' : 'timer'}
          </span>
          <span>{isFlexible ? '~ Flexible' : workDuration}</span>
        </span>

        {/* Linked Goal */}
        {linkedGoal && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-fixed/60 text-[11px] font-semibold text-primary">
            <span className="material-symbols-outlined text-[13px]">flag</span>
            <span className="truncate max-w-[140px] sm:max-w-[180px]">{linkedGoal.title}</span>
          </span>
        )}

        {/* Linked Habit */}
        {linkedHabit && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-[11px] font-semibold text-rose-700 border border-rose-200/60">
            <span className="material-symbols-outlined text-[13px]">{linkedHabit.icon || 'repeat'}</span>
            <span className="truncate max-w-[140px] sm:max-w-[180px]">{linkedHabit.title}</span>
          </span>
        )}

        {/* Life Areas (show up to 1 to avoid clutter) */}
        {Array.isArray(task.areas) && task.areas.slice(0, 1).map(area => (
          <span key={area} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container text-[11px] font-medium text-on-surface-variant">
            <span className="material-symbols-outlined text-[12px] opacity-70">category</span>
            <span>{area}</span>
          </span>
        ))}
      </div>

      {uniqueReasons.length > 0 && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
          <span className="material-symbols-outlined mt-px text-[14px]">priority_high</span>
          <span>{uniqueReasons.join(' · ')}</span>
        </div>
      )}

      {/* Small Checklist (Subtasks with toggle) */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-black/[0.04]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSubtasksOpen(!subtasksOpen);
              }}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-[11px] font-semibold text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[14px] text-primary">checklist</span>
              <span>{completedSubtasksCount}/{task.subtasks.length} subtasks</span>
              <span className="material-symbols-outlined text-[13px] opacity-70">
                {subtasksOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant">
                {Math.round((completedSubtasksCount / task.subtasks.length) * 100)}%
              </span>
              <div className="w-14 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.round((completedSubtasksCount / task.subtasks.length) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {subtasksOpen && (
            <div className="space-y-1 mt-2 animate-fadeIn">
              {task.subtasks.map(st => (
                <div
                  key={st.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubtaskCheck(st.id);
                  }}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer select-none"
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center transition-colors border ${
                      st.completed
                        ? 'bg-primary border-primary text-white'
                        : 'border-black/25 bg-surface hover:border-primary'
                    }`}
                  >
                    {st.completed && <span className="material-symbols-outlined text-[12px]">done</span>}
                  </div>
                  <span
                    className={`text-xs ${
                      st.completed ? 'line-through text-on-surface-variant/60' : 'text-on-surface font-medium'
                    }`}
                  >
                    {st.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showDeleteRecurring && (
        <DeleteRecurringModal
          isOpen={showDeleteRecurring}
          task={task}
          targetDate={taskPlanDate(task) || todayPlanDate()}
          onClose={() => setShowDeleteRecurring(false)}
          onConfirm={({ mode, targetDate }) => {
            onDeleteTask?.(task.id, { mode, targetDate });
            setShowDeleteRecurring(false);
          }}
        />
      )}
    </div>
  );
}
