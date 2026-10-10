import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Clock,
  Timer,
  Flag,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
  Infinity as InfinityIcon,
  Repeat
} from 'lucide-react';
import { deadlineStatus, effortLabel, IMPACT_LABELS, taskImpact, taskPlanLabel, taskPlanDate, todayPlanDate } from '../lib/taskMetadata';
import DeleteRecurringModal from './DeleteRecurringModal';
import ConfirmModal from './ConfirmModal';

const TaskCard = React.memo(function TaskCard({
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
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
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
  const workDuration = isFlexible ? 'Flexible' : effortLabel(task.durationMinutes);
  const completedSubtasksCount = (task.subtasks || []).filter(s => s.completed).length;

  const uniqueReasons = [
    deadline?.tone === 'overdue' && 'Deadline overdue',
    deadline?.tone === 'today' && 'Deadline today',
    task.waitingOn && `Waiting on ${task.waitingOn}`,
  ].filter(Boolean);

  const handleToggle = () => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(15); } catch (_) {}
    }
    onToggleTask(task.id);
  };

  const handleSubtaskCheck = (subtaskId) => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(10); } catch (_) {}
    }
    if (onToggleSubtask) {
      onToggleSubtask(task.id, subtaskId);
    } else if (onUpdateTask && task.subtasks) {
      const updated = task.subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
      onUpdateTask(task.id, { subtasks: updated });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Background Action Indicators for Swipe-to-Action */}
      <div className="absolute inset-0 flex items-center justify-between px-5 pointer-events-none rounded-2xl bg-surface-container-low/70">
        <div className="flex items-center gap-1.5 font-display text-xs font-bold text-emerald-600">
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>{task.completed ? 'Undo' : 'Complete'}</span>
        </div>
        <div className="flex items-center gap-1.5 font-display text-xs font-bold text-rose-600">
          <span>Delete</span>
          <Trash2 className="w-4 h-4 stroke-[2]" />
        </div>
      </div>

      <motion.div
        layout
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        onDragEnd={(_e, info) => {
          if (info.offset.x > 80) {
            handleToggle();
          } else if (info.offset.x < -80) {
            if (task.recurrence && task.recurrence !== 'none') {
              setShowDeleteRecurring(true);
            } else if (onDeleteTask) {
              if ('vibrate' in navigator) try { navigator.vibrate([15, 30]); } catch (_) {}
              onDeleteTask(task.id);
            }
          }
        }}
        onClick={() => onEditTask?.(task)}
        className={`group relative flex flex-col p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#1A1A1E] border border-black/[0.07] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_16px_rgba(0,0,0,0.02)] hover:border-black/[0.14] dark:hover:border-white/[0.15] transition-all cursor-pointer select-none ${
          task.completed ? 'opacity-55 hover:opacity-80 py-3 sm:py-3.5' : ''
        } ${impact === 'high' && !task.completed ? 'border-l-[3px] border-l-[#C84B31]' : ''}`}
      >
        {/* Top Row: Checkbox, Title, Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              className={`mt-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center transition-all flex-shrink-0 active:scale-90 ${
                task.completed
                  ? 'bg-[#161618] dark:bg-[#F7F6F2] text-white dark:text-[#161618] shadow-2xs'
                  : 'bg-transparent text-transparent hover:text-[#0F52BA] border border-black/25 dark:border-white/30 hover:border-[#0F52BA]'
              }`}
              title={task.completed ? 'Mark incomplete' : 'Mark complete'}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </button>
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className={`font-medium text-[13.5px] sm:text-[14px] leading-snug text-[#161618] dark:text-[#F7F6F2] tracking-tight group-hover:text-[#0F52BA] dark:group-hover:text-[#6495ED] transition-colors ${
                  task.completed ? 'line-through text-[#6B6A72] dark:text-[#8E8E93]' : ''
                }`}
              >
                {task.title}
              </span>
            </div>
          </div>

          {/* Priority Badge & Delete */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider ${
                impact === 'high'
                  ? 'bg-[#C84B31]/10 text-[#C84B31] border border-[#C84B31]/20 font-bold'
                  : impact === 'medium'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                  : 'hidden sm:inline-block bg-black/[0.04] dark:bg-white/[0.05] text-[#6B6A72] dark:text-[#8E8E93]'
              }`}
            >
              {IMPACT_LABELS[impact]}
            </span>
            {onDeleteTask && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (task.recurrence && task.recurrence !== 'none') {
                    setShowDeleteRecurring(true);
                  } else {
                    setShowConfirmDelete(true);
                  }
                }}
                className="p-1 rounded-full text-outline hover:text-error hover:bg-error-container/30 transition-colors opacity-0 group-hover:opacity-100"
                title={task.recurrence && task.recurrence !== 'none' ? 'Delete recurring event' : 'Delete task'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Plan, deadline, effort, linked goal/habit, and subtask count — Typography-driven negative space */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mt-2.5 text-xs text-on-surface-variant">
          <span className="inline-flex items-center gap-1 font-mono tabular-nums font-medium text-on-surface-variant">
            <Clock className="w-3.5 h-3.5 text-primary/80" />
            <span>{task.startTime ? formatDueTime() : plannedLabel}</span>
          </span>

          {deadline && (
            <>
              <span className="text-outline-variant/50">•</span>
              <span className={`inline-flex items-center gap-1 font-semibold ${
                deadline.tone === 'overdue' ? 'text-rose-600' : deadline.tone === 'today' ? 'text-amber-700' : 'text-on-surface-variant'
              }`}>
                <Flag className="w-3 h-3" />
                <span>{deadline.label}</span>
              </span>
            </>
          )}

          <span className="text-outline-variant/50">•</span>
          <span className="inline-flex items-center gap-1 font-mono tabular-nums text-on-surface-variant/80">
            {isFlexible ? <InfinityIcon className="w-3.5 h-3.5 text-on-surface-variant/60" /> : <Timer className="w-3.5 h-3.5 text-on-surface-variant/60" />}
            <span>{workDuration}</span>
          </span>

          {/* Linked Goal */}
          {linkedGoal && (
            <>
              <span className="text-outline-variant/50 hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1 text-primary/90 font-medium max-w-[130px] sm:max-w-[170px] truncate">
                <Flag className="w-3 h-3 text-primary" />
                <span className="truncate">{linkedGoal.title}</span>
              </span>
            </>
          )}

          {/* Linked Habit */}
          {linkedHabit && (
            <>
              <span className="text-outline-variant/50 hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1 text-rose-600 font-medium max-w-[130px] sm:max-w-[170px] truncate">
                <Repeat className="w-3 h-3 text-rose-500" />
                <span className="truncate">{linkedHabit.title}</span>
              </span>
            </>
          )}

          {/* Subtask inline indicator */}
          {task.subtasks && task.subtasks.length > 0 && (
            <>
              <span className="text-outline-variant/50">•</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSubtasksOpen(!subtasksOpen);
                }}
                className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-primary hover:text-primary-hover transition-colors cursor-pointer"
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>{completedSubtasksCount}/{task.subtasks.length}</span>
                {subtasksOpen ? <ChevronUp className="w-3 h-3 opacity-70" /> : <ChevronDown className="w-3 h-3 opacity-70" />}
              </button>
            </>
          )}
        </div>

        {uniqueReasons.length > 0 && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-3.5 h-3.5 mt-px text-amber-600 shrink-0" />
            <span>{uniqueReasons.join(' · ')}</span>
          </div>
        )}

        {/* Expandable Subtask Checklist with Framer Motion Spring */}
        <AnimatePresence>
          {task.subtasks && task.subtasks.length > 0 && subtasksOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="mt-3 pt-3 border-t border-black/[0.04] space-y-1.5 overflow-hidden"
            >
              {task.subtasks.map(st => (
                <div
                  key={st.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubtaskCheck(st.id);
                  }}
                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer select-none"
                >
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center transition-colors border ${
                      st.completed
                        ? 'bg-primary border-primary text-white'
                        : 'border-black/25 bg-surface hover:border-primary'
                    }`}
                  >
                    {st.completed && <Check className="w-3 h-3 stroke-[3]" />}
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

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

      {showConfirmDelete && (
        <ConfirmModal
          isOpen={showConfirmDelete}
          title="Delete Deliverable?"
          message={`Are you sure you want to delete "${task?.title}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          isDanger={true}
          onConfirm={() => {
            onDeleteTask?.(task.id);
            setShowConfirmDelete(false);
          }}
          onCancel={() => setShowConfirmDelete(false)}
        />
      )}
    </div>
  );
});

export default TaskCard;
