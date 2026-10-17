import React, { useState, useMemo } from 'react';
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
  Repeat,
  Lock,
  Link2
} from 'lucide-react';
import { deadlineStatus, effortLabel, IMPACT_LABELS, taskImpact, taskPlanLabel, taskPlanDate, todayPlanDate } from '../lib/taskMetadata';
import { getBlockingPrerequisites, getAllPrerequisites } from '../lib/taskDependencies';
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
  habits = [],
  allTasks = []
}) {
  const [showDeleteRecurring, setShowDeleteRecurring] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const linkedGoal = goals.find(g => g.id === task.goalId || g.id === task.linkedGoalId);
  const linkedHabit = habits.find(h => h.id === task.linkedHabitId || h.id === task.habitId);
  const impact = taskImpact(task);
  const plannedLabel = taskPlanLabel(task);
  const deadline = deadlineStatus(task);

  // Compute Dependency & Prerequisite Lock State
  const allPrereqs = useMemo(() => getAllPrerequisites(task, allTasks, goals), [task, allTasks, goals]);
  const blockers = useMemo(() => getBlockingPrerequisites(task, allTasks, goals), [task, allTasks, goals]);
  const isBlocked = !task.completed && blockers.length > 0;
  const metPrereqsCount = allPrereqs.length - blockers.length;

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
        className={`group relative flex flex-col p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-white dark:bg-[#1A1A1E] border border-black/[0.06] dark:border-white/[0.07] hover:border-black/[0.14] dark:hover:border-white/[0.15] shadow-2xs transition-all cursor-pointer select-none ${
          task.completed ? 'opacity-50 hover:opacity-75' : ''
        }`}
      >
        {/* Main Row: Checkbox, Title, Meta, and Actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              className={`w-4.5 h-4.5 rounded-full flex items-center justify-center transition-all flex-shrink-0 active:scale-90 ${
                task.completed
                  ? 'bg-[#161618] dark:bg-[#F7F6F2] text-white dark:text-[#161618] shadow-2xs'
                  : 'bg-transparent text-transparent hover:text-[#0F52BA] border border-black/25 dark:border-white/30 hover:border-[#0F52BA]'
              }`}
              title={task.completed ? 'Mark incomplete' : 'Mark complete'}
            >
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </button>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className={`font-medium text-[13px] sm:text-[13.5px] leading-snug text-[#161618] dark:text-[#F7F6F2] truncate tracking-tight group-hover:text-[#0F52BA] dark:group-hover:text-[#6495ED] transition-colors ${
                  task.completed ? 'line-through text-[#6B6A72] dark:text-[#8E8E93]' : ''
                }`}
              >
                {task.title}
              </span>
              {isBlocked && (
                <span
                  title={`Waiting on: ${blockers.map(b => b.title).join(', ')}`}
                  className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25 shrink-0"
                >
                  <Lock className="w-2.5 h-2.5" />
                  {allPrereqs.length > 1 ? `${metPrereqsCount}/${allPrereqs.length}` : (blockers[0]?.title ? `After: ${blockers[0].title}` : 'Prerequisite')}
                </span>
              )}
              {linkedGoal && (
                <span className="hidden md:inline-flex items-center text-[10px] font-medium text-[#0F52BA] dark:text-[#6495ED] bg-[#0F52BA]/5 dark:bg-[#0F52BA]/15 px-1.5 py-0.2 rounded shrink-0 truncate max-w-[130px]">
                  {linkedGoal.title}
                </span>
              )}
            </div>
          </div>

          {/* Right Meta Capsule: Time, Priority Dot, Subtask, Delete */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {task.startTime && (
              <span className="text-[11px] font-mono text-[#6B6A72] dark:text-[#8E8E93] bg-black/[0.03] dark:bg-white/[0.04] px-1.5 py-0.5 rounded">
                {formatTimeStr(task.startTime)}
              </span>
            )}
            {task.subtasks && task.subtasks.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSubtasksOpen(!subtasksOpen);
                }}
                className="inline-flex items-center gap-0.5 text-[10.5px] font-mono text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] transition-colors cursor-pointer"
              >
                <ListChecks className="w-3 h-3 text-[#0F52BA]" />
                <span>{completedSubtasksCount}/{task.subtasks.length}</span>
              </button>
            )}
            {/* Priority Dot */}
            {impact === 'high' ? (
              <span className="w-2 h-2 rounded-full bg-[#C84B31] shrink-0" title="High impact" />
            ) : impact === 'medium' ? (
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Medium impact" />
            ) : null}
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
                className="p-1 rounded-full text-[#6B6A72] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors opacity-0 group-hover:opacity-100"
                title={task.recurrence && task.recurrence !== 'none' ? 'Delete recurring event' : 'Delete task'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
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
