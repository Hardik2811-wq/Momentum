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
  const taskReasons = [
    deadline?.tone === 'overdue' && 'Deadline overdue',
    deadline?.tone === 'today' && 'Deadline today',
    plannedLabel === 'Today' && 'Planned today',
    linkedGoal && `Linked to ${linkedGoal.title}`,
    linkedHabit && `Habit: ${linkedHabit.title}`,
    impact === 'high' && 'High impact',
    !isFlexible && (task.durationMinutes || 60) <= 30 && 'Fits 30 min block',
    task.startTime && `Scheduled ${formatDueTime().replace(/^Due /, '')}`,
    task.waitingOn && `Waiting on ${task.waitingOn}`,
  ].filter(Boolean).slice(0, 2);

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
      className={`group flex flex-col p-3.5 sm:p-4 rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md border border-outline-variant/15 transition-all cursor-pointer ${
        task.completed ? 'opacity-65' : ''
      }`}
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-low text-[11px] font-medium text-on-surface-variant">
          <span className="material-symbols-outlined text-[13px] text-primary">schedule</span>
          <span>{task.startTime ? formatDueTime() : plannedLabel}</span>
        </span>

        {deadline && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${deadline.tone === 'overdue' ? 'bg-red-50 text-red-700' : deadline.tone === 'today' ? 'bg-amber-50 text-amber-800' : 'bg-surface-container-low text-on-surface-variant'}`}><span className="material-symbols-outlined text-[13px]">flag</span>{deadline.label}</span>}

        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-low text-[11px] font-medium text-on-surface-variant">
          <span className="material-symbols-outlined text-[13px] text-amber-600">
            {isFlexible ? 'all_inclusive' : 'timer'}
          </span>
          <span>{isFlexible ? '~ Flexible' : `${workDuration} effort`}</span>
        </span>

        {/* Linked Goal */}
        {linkedGoal && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary-container/50 text-[11px] font-semibold text-secondary">
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

        {/* Life Areas */}
        {Array.isArray(task.areas) && task.areas.map(area => (
          <span key={area} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-[11px] font-medium text-purple-700 border border-purple-200/60">
            <span className="material-symbols-outlined text-[12px]">category</span>
            <span>{area}</span>
          </span>
        ))}
      </div>

      {taskReasons.length > 0 && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined mt-px text-[14px] text-primary">north_star</span>
          <span><span className="font-semibold text-on-surface">Why now:</span> {taskReasons.join(' · ')}</span>
        </div>
      )}


      {/* Small Checklist (Subtasks) */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-outline-variant/15">
          <div className="flex items-center justify-between mb-1.5 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">checklist</span>
              Checklist
            </span>
            <span>
              {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} done
            </span>
          </div>
          <div className="space-y-1">
            {task.subtasks.map(st => (
              <div
                key={st.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubtaskCheck(st.id);
                }}
                className="flex items-center gap-2 p-1 rounded hover:bg-surface-container-low transition-colors cursor-pointer select-none"
              >
                <div
                  className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-colors border ${
                    st.completed
                      ? 'bg-primary border-primary text-white'
                      : 'border-black/25 bg-surface hover:border-primary'
                  }`}
                >
                  {st.completed && <span className="material-symbols-outlined text-[11px]">done</span>}
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
