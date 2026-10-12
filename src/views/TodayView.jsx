import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Timer,
  Pencil,
  Check,
  Plus,
  Layers,
  Inbox,
  ArrowRight,
  Search,
  CheckCircle2,
  Square,
  CheckSquare,
  Repeat,
  Calendar,
  Play,
  Trash2,
  X,
  Flag,
  ListChecks,
  RotateCcw,
  Move,
  Maximize2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { triggerCelebration } from '../lib/celebrate';
import TaskDetailModal from '../components/TaskDetailModal';
import ScheduleDetailModal from '../components/ScheduleDetailModal';
import HabitModal from '../components/HabitModal';
import DeleteRecurringModal from '../components/DeleteRecurringModal';
import ConfirmModal from '../components/ConfirmModal';
import {
  taskPlanDate,
  todayPlanDate,
  tomorrowPlanDate,
  planDateLabel,
  formatDurationLabel,
  calculateDuration,
  calculateEndTime,
  parseTimeString,
  formatTimeString,
  parseCompoundDuration,
  legacyDueDateForPlan,
  isTaskScheduledForDate,
  isTaskCompletedForDate
} from '../lib/taskMetadata';
import { isScheduleActiveForDate } from '../lib/missedScheduleEngine';
import { parseNaturalTask } from '../lib/nlpParser';
import { LIFE_AREAS } from '../lib/lifeAreas';
import { evaluateCapacityLoad } from '../lib/capacityOverloadGuard';
import { getHabitsAtRisk } from '../lib/habitDecayGuard';

/* ── Date Helpers ── */
function shiftDateStr(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function getWeekMonday(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay(); // 0 is Sun, 1 is Mon...
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function formatDateHeader(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    dayNum: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' })
  };
}

function minutesFromStartOfDay(timeStr) {
  if (!timeStr) return null;
  const parsed = parseTimeString(timeStr) || timeStr;
  const [h, m] = parsed.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function format12Hour(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatHourAxis(hourNum) {
  if (hourNum === 0 || hourNum === 24) return '12 AM';
  if (hourNum === 12) return '12 PM';
  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  const hr = hourNum % 12;
  return `${hr} ${ampm}`;
}

const START_HOUR = 0; // 12:00 AM midnight
const END_HOUR = 24;  // 11:59 PM night
const TOTAL_HOURS = END_HOUR - START_HOUR; // Full 24-hour day
const HOUR_HEIGHT = 80; // 80px per hour: 20px/15min snapping, zero card compression
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 1920px full day height
const startDayMinutes = START_HOUR * 60;



const TodayView = React.memo(function TodayView({
  tasks = [],
  onToggleTask,
  onDeleteTask,
  onDeleteTasks,
  onUpdateTask,
  onToggleSubtask,
  onOpenQuickAdd,
  goals = [],
  habits = [],
  schedules = [],
  onUpdateSchedule,
  onAddSchedule,
  onDeleteSchedule,
  onDeleteSchedules,
  onStartFocus,
  onCheckInHabit,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit
}) {
  const [viewDate, setViewDate] = useState(() => todayPlanDate());
  const [scope, setScope] = useState('day'); // 'day' | '3day' | 'week'
  const [mobileTab, setMobileTab] = useState('timeline'); // 'tray' | 'timeline' — default to timeline red line
  const [trayFilterMode, setTrayFilterMode] = useState('unscheduled'); // Default to unscheduled to eliminate duplicates
  const [trayAreaFilter, setTrayAreaFilter] = useState('all');
  const [traySearch, setTraySearch] = useState('');
  const [newTrayTaskTitle, setNewTrayTaskTitle] = useState('');
  const [activeSlotMenuTaskId, setActiveSlotMenuTaskId] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null); // { type: 'task'|'schedule'|'habit', id, title }
  const [activeTouchDrag, setActiveTouchDrag] = useState(null); // { item, currentX, currentY, targetHour, targetDate }
  const touchDragRef = useRef(null);
  const holdTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const didJustDragRef = useRef(false);
  const [isMobileQuickTrayOpen, setIsMobileQuickTrayOpen] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState(null); // { date, hour }
  const [editingTask, setEditingTask] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editingHabit, setEditingHabit] = useState(null);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [recurringDeleteTarget, setRecurringDeleteTarget] = useState(null); // { task, date }
  const [singleDeleteTarget, setSingleDeleteTarget] = useState(null); // { type, id, title }
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [dismissedCapacityAlertDate, setDismissedCapacityAlertDate] = useState(null);

  /* ── Multi-Select Batch Deletion State ── */
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [selectedScheduleIds, setSelectedScheduleIds] = useState(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  // Reset selections when switching tray modes
  useEffect(() => {
    setSelectedTaskIds(new Set());
    setSelectedScheduleIds(new Set());
  }, [trayFilterMode]);

  const toggleSelectTask = useCallback((id) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectSchedule = useCallback((id) => {
    setSelectedScheduleIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ── Canvas Editor Mode & Vector Shape Transform States ── */
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [selectedTransformTaskId, setSelectedTransformTaskId] = useState(null);
  const [transformState, setTransformState] = useState(null);
  const transformRef = useRef(null);
  const calendarScrollRef = useRef(null);

  // Smart auto-scroll: always centers around the live current time red line by default
  const scrollToNow = useCallback((smooth = true) => {
    if (!calendarScrollRef.current) return;
    const now = new Date();
    const currentMinutesToday = now.getHours() * 60 + now.getMinutes();

    const timeTop = (currentMinutesToday / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT;
    const viewHeight = calendarScrollRef.current.clientHeight || 480;
    const isEarlyHour = now.getHours() < 7;
    const topOffset = isEarlyHour ? 28 : Math.min(96, viewHeight * 0.22);
    const targetScroll = Math.max(0, Math.round(timeTop - topOffset));

    if (smooth) {
      calendarScrollRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    } else {
      calendarScrollRef.current.scrollTop = targetScroll;
    }
  }, []);

  const scrollToHour = useCallback((hour) => {
    if (!calendarScrollRef.current) return;
    const targetScroll = Math.max(0, Math.round((hour / TOTAL_HOURS) * TOTAL_HEIGHT - 20));
    calendarScrollRef.current.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });
  }, []);

  // Smart auto-scroll: automatically center around current time red line on initial load & view changes
  useEffect(() => {
    const isToday = viewDate === todayPlanDate();
    const timer1 = setTimeout(() => {
      if (isToday) {
        scrollToNow(false);
      } else if (calendarScrollRef.current) {
        calendarScrollRef.current.scrollTop = 8 * HOUR_HEIGHT; // Default to 8 AM waking anchor
      }
    }, 60);
    const timer2 = setTimeout(() => {
      if (isToday) {
        scrollToNow(true);
      }
    }, 260);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [viewDate, scope, scrollToNow]);

  // When switching mobile tab back to timeline, ensure scroll position is aligned
  useEffect(() => {
    if (mobileTab === 'timeline') {
      const isToday = viewDate === todayPlanDate();
      const timer = setTimeout(() => {
        if (isToday) scrollToNow(false);
        else if (calendarScrollRef.current) calendarScrollRef.current.scrollTop = 8 * HOUR_HEIGHT;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [mobileTab, viewDate, scrollToNow]);

  useEffect(() => {
    transformRef.current = transformState;
  }, [transformState]);

  // Window drag & resize listeners for real-time shape manipulation
  useEffect(() => {
    if (!transformState) return undefined;

    const handleMouseMove = (e) => {
      const current = transformRef.current;
      if (!current) return;

      const deltaY = e.clientY - current.startY;
      // 70px per hour (60 min) -> 1px = 60 / 70 mins
      const minutesDeltaRaw = (deltaY / HOUR_HEIGHT) * 60;
      // Snap to 15-minute intervals for clean calendar alignment
      const minutesDelta = Math.round(minutesDeltaRaw / 15) * 15;

      if (current.mode === 'resize-bottom') {
        const nextDur = Math.max(15, current.origDuration + minutesDelta);
        const maxAvailableDur = (END_HOUR * 60) - current.origStartMin;
        const clampedDur = Math.min(maxAvailableDur, nextDur);
        setTransformState(prev => prev ? { ...prev, currentDuration: clampedDur } : null);
      } else if (current.mode === 'resize-top') {
        const minPossibleStart = START_HOUR * 60;
        const maxPossibleStart = (current.origStartMin + current.origDuration) - 15;
        const candidateStart = current.origStartMin + minutesDelta;
        const clampedStart = Math.max(minPossibleStart, Math.min(maxPossibleStart, candidateStart));
        const deltaActual = current.origStartMin - clampedStart;
        const clampedDur = current.origDuration + deltaActual;
        setTransformState(prev => prev ? { ...prev, currentStartMin: clampedStart, currentDuration: clampedDur } : null);
      } else if (current.mode === 'move') {
        const minPossibleStart = START_HOUR * 60;
        const maxPossibleStart = (END_HOUR * 60) - current.origDuration;
        const candidateStart = current.origStartMin + minutesDelta;
        const clampedStart = Math.max(minPossibleStart, Math.min(maxPossibleStart, candidateStart));
        setTransformState(prev => prev ? { ...prev, currentStartMin: clampedStart } : null);
      }
    };

    const handleMouseUp = () => {
      const current = transformRef.current;
      if (current) {
        const finalStartMin = current.currentStartMin;
        const finalDur = current.currentDuration;
        const finalEndMin = finalStartMin + finalDur;

        const startH = Math.floor(finalStartMin / 60);
        const startM = finalStartMin % 60;
        const formattedStart = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

        const endH = Math.floor(finalEndMin / 60);
        const endM = finalEndMin % 60;
        const formattedEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        onUpdateTask(current.taskId, {
          startTime: formattedStart,
          endTime: formattedEnd,
          durationMinutes: finalDur,
          isFlexible: false
        });

        setTransformState(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [Boolean(transformState), onUpdateTask]);

  // Escape to deselect in editor mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isEditorMode) {
        if (selectedTransformTaskId) {
          setSelectedTransformTaskId(null);
        } else {
          setIsEditorMode(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditorMode, selectedTransformTaskId]);

  const slotMenuRef = useRef(null);

  // Live ticker for time ruler
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Close slot menu on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (slotMenuRef.current && !slotMenuRef.current.contains(e.target)) {
        setActiveSlotMenuTaskId(null);
      }
    };
    if (activeSlotMenuTaskId) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [activeSlotMenuTaskId]);

  /* ── Multi-Column Date Scope Generator ── */
  const columnDates = useMemo(() => {
    if (scope === 'day') return [viewDate];
    if (scope === '3day') return [viewDate, shiftDateStr(viewDate, 1), shiftDateStr(viewDate, 2)];
    if (scope === 'week') {
      const mon = getWeekMonday(viewDate);
      return Array.from({ length: 7 }, (_, i) => shiftDateStr(mon, i));
    }
    return [viewDate];
  }, [viewDate, scope]);

  const handlePrev = () => {
    const step = scope === 'day' ? -1 : scope === '3day' ? -3 : -7;
    setViewDate(prev => shiftDateStr(prev, step));
  };

  const handleNext = () => {
    const step = scope === 'day' ? 1 : scope === '3day' ? 3 : 7;
    setViewDate(prev => shiftDateStr(prev, step));
  };

  const handleToday = () => {
    setViewDate(todayPlanDate());
  };

  /* ── Slotting & Unslotting Actions ── */
  const handleSlotTask = (taskId, timeStr, targetDate = viewDate) => {
    const target = tasks.find(t => String(t.id) === String(taskId));
    if (!target) return;
    const dur = Number(target.durationMinutes) || 60;
    const endTime = calculateEndTime(timeStr, dur);
    onUpdateTask(taskId, {
      plannedDate: targetDate,
      dueDate: legacyDueDateForPlan(targetDate),
      startTime: timeStr,
      endTime,
      durationMinutes: dur,
      isFlexible: false
    });
    setActiveSlotMenuTaskId(null);
    toast.success(`Slotted "${target.title}" at ${formatTimeString(timeStr)}`);
  };

  const totalUnscheduledCount = useMemo(() => {
    return tasks.filter(t => !t.completed && !t.startTime).length;
  }, [tasks]);

  const unscheduledTasks = useMemo(() => {
    return tasks.filter(t => !t.completed && !t.startTime);
  }, [tasks]);

  const handleUnslotTask = (taskId) => {
    onUpdateTask(taskId, {
      startTime: null,
      endTime: null
    });
  };

  /* ── Drag & Mobile Hold Gesture Handlers ── */
  const handleStartDrag = useCallback((type, item, e) => {
    if (isMultiSelectMode) return;
    const payload = {
      type,
      id: item.id,
      title: item.title,
      [`${type}Id`]: item.id,
      durationMinutes: item.durationMinutes,
      duration: item.duration,
      startTime: item.startTime
    };
    if (e?.dataTransfer) {
      try {
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
      } catch (_) {}
    }
    setDraggedItem(payload);
    if (type === 'task') setDraggedTaskId(item.id);

    // Directly switch mobile to calendar timeline so user can drag and drop onto it!
    setMobileTab('timeline');
    setIsMobileQuickTrayOpen(false);
  }, [isMultiSelectMode]);

  const handleEndDrag = useCallback(() => {
    setDraggedItem(null);
    setDraggedTaskId(null);
    setDragOverSlot(null);
  }, []);

  /* ── Continuous Mobile Thumb Drag-and-Drop System (Google Calendar Style) ── */
  const calculateGridSlotFromCoords = useCallback((clientX, clientY) => {
    if (!calendarScrollRef.current) return null;
    const rect = calendarScrollRef.current.getBoundingClientRect();

    // Auto-scroll calendar container when dragging near top or bottom edges:
    const edgeMargin = 75;
    if (clientY < rect.top + edgeMargin) {
      calendarScrollRef.current.scrollTop -= 14;
    } else if (clientY > rect.bottom - edgeMargin) {
      calendarScrollRef.current.scrollTop += 14;
    }

    const scrollY = calendarScrollRef.current.scrollTop;
    const scrollX = calendarScrollRef.current.scrollLeft;
    const relY = Math.max(0, clientY - rect.top + scrollY);

    // Each hour slot is 64px (HOUR_HEIGHT)
    const rawHour = Math.floor(relY / HOUR_HEIGHT);
    const clampedHour = Math.max(0, Math.min(TOTAL_HOURS - 1, rawHour));
    const hourNum = START_HOUR + clampedHour;
    const hourLabel = `${String(hourNum).padStart(2, '0')}:00`;

    let targetDate = viewDate;
    if (scope !== 'day' && Array.isArray(columnDates) && columnDates.length > 0) {
      const relX = clientX - rect.left + scrollX;
      const colX = Math.max(0, relX - 44);
      const colWidth = scope === 'week' ? 120 : 180;
      const colIndex = Math.max(0, Math.min(columnDates.length - 1, Math.floor(colX / colWidth)));
      if (columnDates[colIndex]) {
        targetDate = columnDates[colIndex];
      }
    }

    return { hour: hourLabel, date: targetDate };
  }, [viewDate, scope, columnDates]);

  const handleSlotDroppedItem = useCallback((itemPayload, hourLabel, colDate) => {
    if (!itemPayload) return;
    const type = itemPayload.type || (itemPayload.taskId ? 'task' : itemPayload.scheduleId ? 'schedule' : itemPayload.habitId ? 'habit' : 'task');
    const id = itemPayload.id || itemPayload[`${type}Id`];

    if (type === 'schedule') {
      const targetSched = schedules.find(s => String(s.id) === String(id));
      let dur = Number(itemPayload.durationMinutes);
      if (!dur || isNaN(dur)) {
        if (targetSched) {
          dur = Number(targetSched.durationMinutes);
          if (!dur || isNaN(dur)) {
            if (targetSched.startTime && targetSched.endTime) {
              dur = calculateDuration(targetSched.startTime, targetSched.endTime);
            }
          }
        }
      }
      if (!dur || isNaN(dur)) dur = 60;

      const endTime = calculateEndTime(hourLabel, dur);
      const patch = {
        startTime: hourLabel,
        endTime
      };

      if (colDate) {
        patch.plannedDate = colDate;
        if (targetSched && targetSched.recurrence === 'weekly' && Array.isArray(targetSched.repeatDays)) {
          const newDayOfWeek = new Date(`${colDate}T12:00:00`).getDay();
          if (!targetSched.repeatDays.includes(newDayOfWeek)) {
            patch.repeatDays = [...targetSched.repeatDays, newDayOfWeek];
          }
        }
      }

      onUpdateSchedule?.(id, patch);
      toast.success(`Rescheduled "${targetSched?.title || 'Class'}" to ${formatTimeString(hourLabel)}`);
    } else if (type === 'habit') {
      const targetHabit = habits.find(h => String(h.id) === String(id));
      if (onUpdateHabit) {
        onUpdateHabit(id, { startTime: hourLabel, isTimeBlocked: true });
      }
      toast.success(`Scheduled ritual "${targetHabit?.title || 'Habit'}" at ${formatTimeString(hourLabel)}`);
    } else {
      handleSlotTask(id, hourLabel, colDate);
    }
    setIsMobileQuickTrayOpen(false);
  }, [schedules, habits, onUpdateSchedule, onUpdateHabit, handleSlotTask]);

  const handleTouchStartCard = useCallback((type, item, e) => {
    if (isMultiSelectMode) return;
    const touch = e.touches?.[0];
    if (!touch) return;

    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    // Responsive 190ms hold threshold to activate drag
    holdTimerRef.current = setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([35, 20]); } catch (_) {}
      }

      let dur = Number(item.durationMinutes);
      if (!dur || isNaN(dur)) {
        if (item.startTime && item.endTime) {
          dur = calculateDuration(item.startTime, item.endTime);
        } else if (item.duration) {
          dur = parseCompoundDuration(item.duration);
        }
      }
      if (!dur || isNaN(dur)) dur = 45;

      let initialHour = item.startTime ? `${item.startTime.slice(0, 2)}:00` : '09:00';
      const slot = calculateGridSlotFromCoords(touch.clientX, touch.clientY);
      if (slot?.hour) initialHour = slot.hour;

      const dragData = {
        item: {
          type,
          id: item.id,
          title: item.title,
          durationMinutes: dur,
          duration: item.duration,
          startTime: item.startTime,
          endTime: item.endTime,
          ...item
        },
        currentX: touch.clientX,
        currentY: touch.clientY,
        targetHour: initialHour,
        targetDate: slot?.date || viewDate
      };

      touchDragRef.current = dragData;
      setActiveTouchDrag(dragData);
      setMobileTab('timeline');
      setIsMobileQuickTrayOpen(false);
    }, 190);
  }, [isMultiSelectMode, calculateGridSlotFromCoords, viewDate]);

  const handleTouchMoveCard = useCallback((e) => {
    // If drag hasn't started yet, allow minor thumb jitter up to 24px before cancelling
    if (!touchDragRef.current) {
      const touch = e.touches?.[0];
      if (touch) {
        const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
        if (dx > 24 || dy > 24) {
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
        }
      }
    } else {
      if (e.cancelable) e.preventDefault();
    }
  }, []);

  const handleTouchEndCard = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // Global window listeners while thumb is dragged across the screen
  useEffect(() => {
    if (!activeTouchDrag) return;

    const handleWindowTouchMove = (e) => {
      const touch = e.touches?.[0];
      if (!touch) return;
      if (e.cancelable) e.preventDefault(); // lock viewport scroll while thumb dragging

      const slot = calculateGridSlotFromCoords(touch.clientX, touch.clientY);
      setActiveTouchDrag(prev => {
        if (!prev) return null;
        const next = {
          ...prev,
          currentX: touch.clientX,
          currentY: touch.clientY,
          targetHour: slot ? slot.hour : prev.targetHour,
          targetDate: slot ? slot.date : prev.targetDate
        };
        touchDragRef.current = next;
        return next;
      });
    };

    const handleWindowTouchEnd = () => {
      const current = touchDragRef.current;
      if (current && current.item && current.targetHour && current.targetDate) {
        didJustDragRef.current = true;
        setTimeout(() => { didJustDragRef.current = false; }, 350);
        handleSlotDroppedItem(current.item, current.targetHour, current.targetDate);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(45); } catch (_) {}
        }
      }
      touchDragRef.current = null;
      setActiveTouchDrag(null);
    };

    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd);
    window.addEventListener('touchcancel', handleWindowTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);
    };
  }, [activeTouchDrag, calculateGridSlotFromCoords, handleSlotDroppedItem]);

  const handleCreateTrayTask = (e) => {
    if (e) e.preventDefault();
    if (!newTrayTaskTitle.trim()) return;
    onOpenQuickAdd?.({
      initialTitle: newTrayTaskTitle.trim(),
      initialDate: viewDate
    });
    setNewTrayTaskTitle('');
  };

  const trayNlpPreview = useMemo(() => {
    if (!newTrayTaskTitle.trim() || newTrayTaskTitle.trim().length < 3) return null;
    return parseNaturalTask(newTrayTaskTitle, goals, habits);
  }, [newTrayTaskTitle, goals, habits]);

  /* ── Tray Tasks Filter ── */
  const trayTasks = useMemo(() => {
    const today = todayPlanDate();
    return tasks.filter(t => {
      if (t.completed) return false;

      const pDate = taskPlanDate(t);

      if (trayFilterMode === 'unscheduled') {
        if (t.startTime) return false;
      } else if (trayFilterMode === 'backlog') {
        if (t.startTime) return false;
        if (pDate && pDate === today) return false;
      } else {
        // 'all': active tasks for today/this week
        if (!pDate && !t.dueDate) return true;
        if (pDate === today) return true;
        if (t.dueDate === 'This Week') return true;
      }

      if (trayAreaFilter !== 'all') {
        const tAreas = Array.isArray(t.areas) && t.areas.length > 0 ? t.areas : (t.category ? [t.category] : []);
        if (!tAreas.includes(trayAreaFilter)) return false;
      }

      if (traySearch.trim()) {
        const q = traySearch.toLowerCase();
        if (!t.title.toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [tasks, trayFilterMode, trayAreaFilter, traySearch]);

  /* ── Tray Schedules Filter ── */
  const filteredSchedules = useMemo(() => {
    let list = schedules || [];
    if (traySearch.trim()) {
      const q = traySearch.toLowerCase();
      list = list.filter(s =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q)
      );
    }
    if (trayAreaFilter !== 'all') {
      list = list.filter(s =>
        s.category === trayAreaFilter ||
        (Array.isArray(s.areas) && s.areas.includes(trayAreaFilter))
      );
    }
    return list;
  }, [schedules, traySearch, trayAreaFilter]);

  const activeSelectionCount = trayFilterMode === 'schedules' ? selectedScheduleIds.size : selectedTaskIds.size;

  const handleSelectAll = useCallback(() => {
    if (trayFilterMode === 'schedules') {
      const allIds = filteredSchedules.map(s => s.id);
      setSelectedScheduleIds(new Set(allIds));
    } else {
      const allIds = trayTasks.map(t => t.id);
      setSelectedTaskIds(new Set(allIds));
    }
  }, [trayFilterMode, filteredSchedules, trayTasks]);

  const handleDeselectAll = useCallback(() => {
    if (trayFilterMode === 'schedules') {
      setSelectedScheduleIds(new Set());
    } else {
      setSelectedTaskIds(new Set());
    }
  }, [trayFilterMode]);

  const handleExecuteBatchDelete = useCallback(() => {
    if (trayFilterMode === 'schedules') {
      const ids = Array.from(selectedScheduleIds);
      if (ids.length > 0) {
        if (onDeleteSchedules) {
          onDeleteSchedules(ids);
        } else {
          ids.forEach(id => onDeleteSchedule?.(id));
        }
      }
      setSelectedScheduleIds(new Set());
    } else {
      const ids = Array.from(selectedTaskIds);
      if (ids.length > 0) {
        if (onDeleteTasks) {
          onDeleteTasks(ids);
        } else {
          ids.forEach(id => onDeleteTask?.(id));
        }
      }
      setSelectedTaskIds(new Set());
    }
    setShowBatchDeleteConfirm(false);
    setIsMultiSelectMode(false);
  }, [trayFilterMode, selectedScheduleIds, selectedTaskIds, onDeleteSchedules, onDeleteSchedule, onDeleteTasks, onDeleteTask]);

  /* ── Multi-Column Memoized Layout Generator (Unified Scratch C-Block & Multi-Lane Engine) ── */
  const columnsData = useMemo(() => {
    const today = todayPlanDate();
    return columnDates.map(colDate => {
      const isToday = colDate === today;
      const headerInfo = formatDateHeader(colDate);

      const allEvents = [];
      let colMins = 0;

      // 1. Schedules
      (schedules || []).forEach(sched => {
        if (isScheduleActiveForDate(sched, colDate) && sched.startTime) {
          const sm = minutesFromStartOfDay(sched.startTime);
          if (sm !== null) {
            let dur = Number(sched.durationMinutes);
            if (!dur || isNaN(dur)) {
              if (sched.startTime && sched.endTime) {
                const diff = calculateDuration(sched.startTime, sched.endTime);
                if (diff > 0) dur = diff;
              }
            }
            if (!dur || isNaN(dur)) dur = 60;
            allEvents.push({
              id: `sched-${sched.id}`,
              type: 'schedule',
              sched,
              title: sched.title,
              startMin: sm,
              duration: dur,
              endMin: sm + dur
            });
          }
        }
      });

      // 2. Habits
      (habits || []).forEach(habit => {
        if (!habit.startTime || habit.isTimeBlocked === false) return;
        const targetFreq = habit.targetFrequency || 'Every Day';
        let isActive = true;
        const d = new Date(`${colDate}T12:00:00`).getDay();
        if (targetFreq === 'Weekdays') {
          isActive = d >= 1 && d <= 5;
        } else if (targetFreq === '3 Days / Wk') {
          isActive = d === 1 || d === 3 || d === 5;
        } else if (targetFreq === 'Custom' && Array.isArray(habit.customDays)) {
          const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          isActive = habit.customDays.includes(dayShorts[d]);
        }
        if (isActive) {
          const sm = minutesFromStartOfDay(habit.startTime);
          if (sm !== null) {
            const dur = Number(habit.durationMinutes) || parseCompoundDuration(habit.duration) || 30;
            allEvents.push({
              id: `habit-${habit.id}`,
              type: 'habit',
              habit,
              title: habit.title,
              startMin: sm,
              duration: dur,
              endMin: sm + dur
            });
          }
        }
      });

      // 3. Tasks
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        if (isTaskScheduledForDate(t, colDate) && t.startTime) {
          let dur = Number(t.durationMinutes);
          if (!dur || isNaN(dur)) {
            if (t.startTime && t.endTime) {
              const diff = calculateDuration(t.startTime, t.endTime);
              if (diff > 0) dur = diff;
            }
          }
          if (!dur || isNaN(dur)) dur = 45;
          if (!isTaskCompletedForDate(t, colDate)) {
            colMins += dur;
          }
          const sm = minutesFromStartOfDay(t.startTime);
          if (sm !== null) {
            allEvents.push({
              id: `task-${t.id}`,
              type: 'task',
              task: t,
              title: t.title,
              startMin: sm,
              duration: dur,
              endMin: sm + dur
            });
          }
        }
      }

      // Sort by startMin ASC, then duration DESC so container blocks evaluate first
      allEvents.sort((a, b) => a.startMin - b.startMin || b.duration - a.duration);

      // 1. Detect Scratch C-Block Containment:
      // Only Habit or Focus Session containers can wrap tasks, and only when the child task starts
      // >= 15m after container start (leaving vertical room for the 32px C-Block top header)
      // and ends within container bounds, with container at least 25m longer than child.
      const eventsWithNesting = allEvents.map(item => {
        if (item.type !== 'task') {
          return { ...item, containerId: null, containerItem: null, isNested: false };
        }
        const containers = allEvents.filter(other => {
          if (other.id === item.id) return false;
          const isFocusContainer =
            other.type === 'habit' ||
            (other.type === 'task' && /focus|deep work|sprint|session/i.test(other.title || ''));
          if (!isFocusContainer) return false;
          const hasHeaderClearance = item.startMin >= other.startMin + 15;
          const fitsInsideEnd = item.endMin <= other.endMin + 5;
          const isSignificantlyLarger = other.duration >= item.duration + 25;
          return hasHeaderClearance && fitsInsideEnd && isSignificantlyLarger;
        });
        containers.sort((a, b) => a.duration - b.duration);
        const container = containers[0] || null;
        return {
          ...item,
          containerId: container ? container.id : null,
          containerItem: container || null,
          isNested: Boolean(container)
        };
      });

      const parentContainerIds = new Set(
        eventsWithNesting.filter(it => it.isNested).map(it => it.containerId)
      );

      // 2. Partition top-level (non-nested) events into overlap clusters and assign parallel lanes
      const topLevel = eventsWithNesting
        .filter(it => !it.isNested)
        .map(it => ({
          ...it,
          isCBlock: parentContainerIds.has(it.id),
          hasNestedChildren: parentContainerIds.has(it.id)
        }));

      const assignLanes = (eventList, laneKey = 'lane', totalKey = 'totalLanes') => {
        if (!eventList.length) return [];
        const sorted = [...eventList].sort((a, b) => a.startMin - b.startMin || b.duration - a.duration);
        const clusters = [];
        let curCluster = [];
        let clusterMaxEnd = -1;

        for (const ev of sorted) {
          if (curCluster.length === 0 || ev.startMin < clusterMaxEnd) {
            curCluster.push(ev);
            clusterMaxEnd = Math.max(clusterMaxEnd, ev.endMin);
          } else {
            clusters.push(curCluster);
            curCluster = [ev];
            clusterMaxEnd = ev.endMin;
          }
        }
        if (curCluster.length > 0) clusters.push(curCluster);

        const out = [];
        for (const cluster of clusters) {
          const laneEndTimes = [];
          const placed = [];
          for (const ev of cluster) {
            let assigned = -1;
            for (let l = 0; l < laneEndTimes.length; l++) {
              if (laneEndTimes[l] <= ev.startMin) {
                assigned = l;
                laneEndTimes[l] = ev.endMin;
                break;
              }
            }
            if (assigned === -1) {
              assigned = laneEndTimes.length;
              laneEndTimes.push(ev.endMin);
            }
            placed.push({ ...ev, [laneKey]: assigned });
          }
          const total = laneEndTimes.length;
          for (const p of placed) {
            out.push({ ...p, [totalKey]: total });
          }
        }
        return out;
      };

      const topLevelWithLanes = assignLanes(topLevel, 'lane', 'totalLanes');
      const topLevelIdToLane = new Map(topLevelWithLanes.map(it => [it.id, it]));

      // 3. Assign lanes to nested children within each C-Block container
      const nestedRaw = eventsWithNesting
        .filter(it => it.isNested)
        .map(it => ({
          ...it,
          lane: 0,
          totalLanes: 1,
          isCBlock: false,
          hasNestedChildren: false
        }));

      const nestedByContainer = new Map();
      for (const n of nestedRaw) {
        if (!nestedByContainer.has(n.containerId)) nestedByContainer.set(n.containerId, []);
        nestedByContainer.get(n.containerId).push(n);
      }
      const nestedWithLanes = [];
      for (const [, group] of nestedByContainer.entries()) {
        nestedWithLanes.push(...assignLanes(group, 'nestedLane', 'nestedTotalLanes'));
      }

      // 4. Compute safe anti-collision heights and sequential snap indicators
      const allUnified = [...topLevelWithLanes, ...nestedWithLanes].map(item => {
        let hasSnapToPrev = false;
        let hasSnapToNext = false;
        let nextBlockingStartMin = null;

        if (!item.isNested) {
          for (const other of topLevelWithLanes) {
            if (other.id === item.id) continue;
            if (other.lane === item.lane || other.totalLanes === 1 || item.totalLanes === 1) {
              if (Math.abs(item.startMin - other.endMin) <= 3) hasSnapToPrev = true;
              if (Math.abs(other.startMin - item.endMin) <= 3) hasSnapToNext = true;
            }
            if (other.startMin >= item.endMin) {
              if (nextBlockingStartMin === null || other.startMin < nextBlockingStartMin) {
                nextBlockingStartMin = other.startMin;
              }
            }
          }
        } else {
          const siblings = nestedByContainer.get(item.containerId) || [];
          for (const other of siblings) {
            if (other.id === item.id) continue;
            if (Math.abs(item.startMin - other.endMin) <= 3) hasSnapToPrev = true;
            if (Math.abs(other.startMin - item.endMin) <= 3) hasSnapToNext = true;
            if (other.startMin >= item.endMin) {
              if (nextBlockingStartMin === null || other.startMin < nextBlockingStartMin) {
                nextBlockingStartMin = other.startMin;
              }
            }
          }
        }

        const parentInfo = item.isNested ? topLevelIdToLane.get(item.containerId) : null;

        const rawTopPx = Math.max(0, ((item.startMin - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
        const rawHeightPx = ((item.duration / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT) - 2;

        const maxMinsBeforeNext = nextBlockingStartMin !== null
          ? Math.max(item.duration, nextBlockingStartMin - item.startMin)
          : Math.max(item.duration, 30);
        const maxPxBeforeNext = ((maxMinsBeforeNext / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT) - 2;

        let computedTopPx = rawTopPx;
        let computedHeightPx = Math.min(Math.max(34, rawHeightPx), Math.max(28, maxPxBeforeNext));

        if (item.isNested && parentInfo) {
          const parentTopPx = Math.max(0, ((parentInfo.startMin - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
          const parentHeightPx = Math.max(64, ((parentInfo.duration / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT) - 2);
          const cavityTopPx = parentTopPx + 34; // Below C-Block header
          const cavityBottomPx = parentTopPx + parentHeightPx - 14; // Above C-Block bottom jaw
          computedTopPx = Math.max(rawTopPx, cavityTopPx);
          const maxCavityHeight = Math.max(30, cavityBottomPx - computedTopPx);
          computedHeightPx = Math.min(computedHeightPx, maxCavityHeight);
        }

        return {
          ...item,
          hasSnapToPrev,
          hasSnapToNext,
          parentLaneInfo: parentInfo,
          computedTopPx,
          computedHeightPx
        };
      });

      return {
        colDate,
        isToday,
        headerInfo,
        colMins,
        colScheduled: allUnified
      };
    });
  }, [tasks, schedules, habits, columnDates]);

  /* ── Workload Capacity Metrics (O(C) time, O(1) space) ── */
  const totalScheduledMinutesInView = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < columnsData.length; i++) {
      sum += columnsData[i].colMins;
    }
    return sum;
  }, [columnsData]);

  const targetMinutesInView = columnDates.length * 360; // 6h budget per day
  const capacityPercent = Math.min(100, Math.round((totalScheduledMinutesInView / (targetMinutesInView || 1)) * 100));

  // Advanced Cognitive Capacity Load (Kingman Queuing & Thermodynamic entropy)
  const capacityAnalytics = useMemo(() => {
    return evaluateCapacityLoad({
      tasks,
      schedules,
      date: viewDate,
      dailyTargetHours: 6.0
    });
  }, [tasks, schedules, viewDate]);

  // Habit Decay Guard: identify habits at risk of decaying
  const habitsAtRiskList = useMemo(() => {
    return getHabitsAtRisk(habits, viewDate);
  }, [habits, viewDate]);

  /* ── Live Laser Ruler Coordinates ── */
  const currentMinutesToday = currentTime.getHours() * 60 + currentTime.getMinutes();
  const isTimeInView = currentMinutesToday >= startDayMinutes && currentMinutesToday <= END_HOUR * 60;
  const currentTimeTop = isTimeInView
    ? ((currentMinutesToday - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT
    : null;

  /* ── Next Task Arriving on Calendar (for compact Header badge) ── */
  const upNextTask = useMemo(() => {
    const todayBlocks = tasks
      .filter(t => !isTaskCompletedForDate(t, viewDate) && isTaskScheduledForDate(t, viewDate) && t.startTime)
      .map(t => {
        const sm = minutesFromStartOfDay(t.startTime) || 0;
        const dur = Number(t.durationMinutes) || 45;
        return { task: t, startMin: sm, endMin: sm + dur };
      })
      .sort((a, b) => a.startMin - b.startMin);

    if (todayBlocks.length === 0) return null;

    // Check if one is live right now
    const live = todayBlocks.find(b => currentMinutesToday >= b.startMin && currentMinutesToday <= b.endMin);
    if (live) return { ...live.task, isLiveNow: true };

    // Next upcoming
    const next = todayBlocks.find(b => b.startMin > currentMinutesToday);
    if (next) return { ...next.task, isLiveNow: false };

    // Fallback to first
    return { ...todayBlocks[0].task, isLiveNow: false };
  }, [tasks, viewDate, currentMinutesToday]);

  /* ── Date Title Range Label ── */
  const viewRangeTitle = useMemo(() => {
    if (scope === 'day') {
      const isToday = viewDate === todayPlanDate();
      const d = new Date(`${viewDate}T12:00:00`);
      const longDate = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      const shortDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return { main: longDate, short: shortDate, isToday };
    }
    const first = new Date(`${columnDates[0]}T12:00:00`);
    const last = new Date(`${columnDates[columnDates.length - 1]}T12:00:00`);
    const formatted = `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const shortFormatted = `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    return { main: formatted, short: shortFormatted, isToday: columnDates.includes(todayPlanDate()) };
  }, [viewDate, scope, columnDates]);

  const handleToggleScheduleDone = useCallback((sched, targetDate = viewDate, e) => {
    if (e) e.stopPropagation();
    const isDone = Boolean(
      sched.completed ||
      (Array.isArray(sched.completedDates) && sched.completedDates.includes(targetDate))
    );
    const currentDates = Array.isArray(sched.completedDates) ? sched.completedDates : [];

    if (isDone) {
      const updatedDates = currentDates.filter(d => d !== targetDate);
      onUpdateSchedule?.(sched.id, {
        completed: false,
        completedDates: updatedDates,
      });
    } else {
      const updatedDates = currentDates.includes(targetDate) ? currentDates : [...currentDates, targetDate];
      const isOneTime = !sched.recurrence || sched.recurrence === 'once' || sched.recurrence === 'none';
      onUpdateSchedule?.(sched.id, {
        completed: isOneTime ? true : false,
        completedDates: updatedDates,
        lastCompletedAt: Date.now()
      });
      triggerCelebration({ count: 50, spread: 60 });
    }
  }, [onUpdateSchedule, viewDate]);

  return (
    <main className="w-full h-dvh lg:h-[calc(100dvh-3.5rem)] pt-[calc(3.85rem+env(safe-area-inset-top))] md:pt-14 px-2.5 sm:px-5 lg:px-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-2.5 bg-[#F7F6F2] dark:bg-[#121214] text-[#161618] dark:text-[#F7F6F2] select-none transition-colors duration-200 flex flex-col overflow-hidden">
      <div className="w-full max-w-[1520px] mx-auto flex-1 flex flex-col min-h-0 gap-1.5 sm:gap-2.5">

        {/* ── TOP HERO CONTROL BAR ── */}
        <div className="w-full min-w-0 shrink-0 flex flex-col gap-2 p-2.5 sm:p-4 rounded-2xl bg-white dark:bg-[#1A1A1E] border border-black/[0.07] dark:border-white/[0.08] shadow-double-bezel">
          {/* Top Row: Navigation, Date, Capacity, Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap min-w-0 w-full">
            {/* Left: Navigation & Date Range */}
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="flex items-center gap-0.5 bg-black/[0.04] dark:bg-white/[0.06] p-0.5 sm:p-1 rounded-xl border border-black/[0.04] dark:border-white/[0.06] shrink-0">
                <button
                  type="button"
                  onClick={handlePrev}
                  title="Previous Day"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-white hover:bg-white dark:hover:bg-[#1E1E22] transition active:scale-95 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  title="Next Day"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-white hover:bg-white dark:hover:bg-[#1E1E22] transition active:scale-95 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 truncate">
                <h1 className="text-[14px] sm:text-[18px] font-editorial font-medium tracking-tight text-[#161618] dark:text-[#F7F6F2] truncate">
                  <span className="hidden sm:inline">{viewRangeTitle.main}</span>
                  <span className="inline sm:hidden">{viewRangeTitle.short}</span>
                </h1>
                {viewRangeTitle.isToday ? (
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-mono font-bold bg-[#0F52BA]/10 text-[#0F52BA] dark:text-[#6495ED] border border-[#0F52BA]/20 uppercase tracking-wider shrink-0">
                    Today
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleToday}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-[#0F52BA]/10 text-[#0F52BA] dark:text-[#6495ED] hover:bg-[#0F52BA]/20 border border-[#0F52BA]/20 transition active:scale-95 shrink-0 cursor-pointer"
                    title="Jump back to today"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Today</span>
                  </button>
                )}
              </div>

              {/* Compact Header Pill for Next Task (Desktop only) */}
              {upNextTask && (
                <div
                  onClick={() => setEditingTask(upNextTask)}
                  className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/20 text-[11px] font-medium cursor-pointer hover:bg-amber-500/15 transition shadow-2xs"
                  title="Click to view next upcoming task"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="font-bold">Next:</span>
                  <span className="truncate max-w-[150px] font-semibold">{upNextTask.title}</span>
                  <span className="font-mono font-bold">({upNextTask.startTime})</span>
                </div>
              )}
            </div>

            {/* Right: Workload, Scope (Desktop), Editor & Quick Add */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Workload Capacity Meter */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.07] text-[11px]">
                <Timer className="w-3.5 h-3.5 text-[#0F52BA] dark:text-[#6495ED]" />
                <div className="flex flex-col min-w-[110px]">
                  <div className="flex items-center justify-between text-[9.5px] font-mono font-semibold text-[#6B6A72] dark:text-[#8E8E93]">
                    <span>{(totalScheduledMinutesInView / 60).toFixed(1)}h / {(targetMinutesInView / 60).toFixed(0)}h</span>
                    <span className={capacityPercent > 90 ? 'text-[#C84B31] font-bold' : capacityPercent > 65 ? 'text-amber-600' : 'text-[#0F52BA]'}>
                      {capacityPercent > 90 ? 'Full' : capacityPercent > 65 ? 'Balanced' : 'Light'}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden mt-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        capacityPercent > 90 ? 'bg-[#C84B31]' : capacityPercent > 65 ? 'bg-amber-500' : 'bg-[#0F52BA]'
                      }`}
                      style={{ width: `${capacityPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Jump to Current Time Button (Desktop) */}
              <button
                type="button"
                onClick={() => scrollToNow(true, true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-black/[0.03] dark:bg-white/[0.05] hover:bg-white dark:hover:bg-[#1E1E22] text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#C84B31] border border-black/[0.06] dark:border-white/[0.07] transition active:scale-95 cursor-pointer"
                title="Center view vertically around current time red line"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#C84B31] animate-pulse" />
                <span>Now</span>
              </button>

              {/* Scope Switcher (Desktop) */}
              <div className="hidden lg:flex items-center p-0.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.06]">
                {[
                  { id: 'day', label: 'Day' },
                  { id: '3day', label: '3-Day' },
                  { id: 'week', label: 'Week' }
                ].map(s => {
                  const isSelected = scope === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setScope(s.id)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-[#1E1E22] text-[#161618] dark:text-[#F7F6F2] shadow-xs'
                          : 'text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              {/* Editor Mode Toggle Button (Desktop only) */}
              <button
                type="button"
                onClick={() => {
                  const nextMode = !isEditorMode;
                  setIsEditorMode(nextMode);
                  if (!nextMode) {
                    setSelectedTransformTaskId(null);
                    setTransformState(null);
                  }
                }}
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition active:scale-[0.98] cursor-pointer ${
                  isEditorMode
                    ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300'
                    : 'bg-white dark:bg-[#1E1E22] text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-white border border-black/[0.08] dark:border-white/[0.08]'
                }`}
                title={isEditorMode ? 'Exit Editor Mode' : 'Toggle Editor Mode: Drag and resize blocks like vector shapes'}
              >
                {isEditorMode ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                <span>{isEditorMode ? 'Save & Done' : 'Editor'}</span>
              </button>

              {/* Quick Add Button */}
              <button
                type="button"
                onClick={() => onOpenQuickAdd?.()}
                className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#161618] hover:bg-[#2A2A2E] text-white dark:bg-[#F7F6F2] dark:text-[#161618] dark:hover:bg-white text-[12px] font-semibold transition shadow-double-bezel active:scale-[0.98] shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Task</span>
              </button>
            </div>
          </div>

          {/* Mobile View & Scope Switcher Row (lg:hidden) */}
          <div className="flex lg:hidden items-center justify-between gap-2 pt-1.5 border-t border-black/[0.05] dark:border-white/[0.06] w-full min-w-0">
            <div className="flex items-center p-0.5 rounded-xl bg-black/[0.05] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setMobileTab('timeline')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  mobileTab === 'timeline'
                    ? 'bg-white dark:bg-[#1E1E24] text-[#0F52BA] dark:text-[#6495ED] shadow-xs'
                    : 'text-[#6B6A72] dark:text-[#8E8E93]'
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>Timeline</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('tray')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  mobileTab === 'tray'
                    ? 'bg-white dark:bg-[#1E1E24] text-[#0F52BA] dark:text-[#6495ED] shadow-xs'
                    : 'text-[#6B6A72] dark:text-[#8E8E93]'
                }`}
              >
                <Inbox className="w-3 h-3" />
                <span>Tray ({trayTasks.length})</span>
              </button>
            </div>

            {mobileTab === 'timeline' && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center p-0.5 rounded-xl bg-black/[0.05] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06]">
                  {[
                    { id: 'day', label: 'Day' },
                    { id: '3day', label: '3D' },
                    { id: 'week', label: 'Wk' }
                  ].map(s => {
                    const isSelected = scope === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setScope(s.id)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-white dark:bg-[#1E1E24] text-[#0F52BA] dark:text-[#6495ED] shadow-xs'
                            : 'text-[#6B6A72] dark:text-[#8E8E93]'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Sleek Executive Telemetry Alerts (Compact 1-row strip on mobile, cards on desktop) ── */}
        {(habitsAtRiskList.length > 0 || (capacityAnalytics.isOverloaded && dismissedCapacityAlertDate !== viewDate)) && (
          <div className="w-full shrink-0 grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2.5 animate-fadeIn">
            {/* 1. Habit Decay Warning Card */}
            {habitsAtRiskList.length > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] dark:bg-amber-500/[0.08] px-2.5 py-1.5 sm:p-3 flex items-center justify-between gap-2 sm:gap-3 shadow-2xs">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Circular Lindy Survival Ring (desktop) / Compact Badge (mobile) */}
                  <div className="hidden sm:flex relative w-10 h-10 shrink-0 items-center justify-center">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-amber-500/20"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-amber-500"
                        strokeDasharray={`${Math.round(habitsAtRiskList[0].survivalProb * 100)}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      {Math.round(habitsAtRiskList[0].survivalProb * 100)}%
                    </span>
                  </div>
                  <span className="sm:hidden px-1.5 py-0.5 rounded-md bg-amber-500/15 font-mono text-[10px] font-bold text-amber-800 dark:text-amber-300 shrink-0">
                    {Math.round(habitsAtRiskList[0].survivalProb * 100)}% Lindy
                  </span>

                  <div
                    onClick={() => {
                      const target = habits.find(h => String(h.id) === String(habitsAtRiskList[0].id)) || habitsAtRiskList[0];
                      setEditingHabit(target);
                      setIsHabitModalOpen(true);
                    }}
                    className="min-w-0 cursor-pointer group/decay"
                    title="Click to edit habit sequence"
                  >
                    <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Habit Decay Risk
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
                        Lindy Decay
                      </span>
                    </div>
                    <p className="text-[11.5px] sm:text-xs font-semibold text-[#161618] dark:text-[#F7F6F2] group-hover/decay:text-[#0A84FF] transition-colors truncate">
                      {habitsAtRiskList[0].title}
                    </p>
                    <p className="hidden sm:block text-[11px] text-[#6B6A72] dark:text-[#8E8E93] truncate">
                      {habitsAtRiskList[0].mvrSuggestion}
                    </p>
                  </div>
                </div>

                {onCheckInHabit && (
                  <button
                    type="button"
                    onClick={() => onCheckInHabit(habitsAtRiskList[0].id, viewDate)}
                    className="shrink-0 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10.5px] sm:text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition active:scale-95 shadow-2xs cursor-pointer"
                  >
                    Log 2m Rep
                  </button>
                )}
              </div>
            )}

            {/* 2. Capacity Saturation Alert Card */}
            {capacityAnalytics.isOverloaded && dismissedCapacityAlertDate !== viewDate && (
              <div className={`rounded-xl border border-rose-500/25 bg-rose-500/[0.06] dark:bg-rose-500/[0.08] px-2.5 py-1.5 sm:p-3 flex items-center justify-between gap-2 sm:gap-3 shadow-2xs ${habitsAtRiskList.length === 0 ? 'md:col-span-2' : ''}`}>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="hidden sm:flex w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">speed</span>
                  </div>
                  <span className="sm:hidden px-1.5 py-0.5 rounded-md bg-rose-500/15 font-mono text-[10px] font-bold text-rose-700 dark:text-rose-300 shrink-0">
                    {capacityAnalytics.utilizationPct}% Load
                  </span>

                  <div className="min-w-0">
                    <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                        Capacity Saturation
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold">
                        {capacityAnalytics.utilizationPct}% Load
                      </span>
                      <span className="text-[10.5px] font-mono text-[#6B6A72] dark:text-[#8E8E93]">
                        {capacityAnalytics.effectiveHours}h • {capacityAnalytics.switchCount} switches
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6B6A72] dark:text-[#8E8E93] truncate">
                      <span className="sm:hidden font-semibold text-rose-700 dark:text-rose-400 mr-1">{capacityAnalytics.effectiveHours}h ({capacityAnalytics.switchCount} switches):</span>
                      {capacityAnalytics.message}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDismissedCapacityAlertDate(viewDate)}
                  className="p-1 rounded-lg text-rose-700 dark:text-rose-400 hover:bg-rose-500/15 transition shrink-0 cursor-pointer"
                  title="Dismiss capacity alert for today"
                  aria-label="Dismiss capacity saturation alert"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Editor Mode Instruction & Save Bar ── */}
        {isEditorMode && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-700/40 text-amber-950 dark:text-amber-200 text-[12px] shadow-2xs animate-fadeIn">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 leading-tight">
                <span className="font-bold text-amber-900 dark:text-amber-300">Interactive Editor Mode: </span>
                <span className="text-amber-800 dark:text-amber-200/80">
                  Hold <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#1E1E22] font-mono text-[10px] font-bold border border-amber-300/80 shadow-3xs">Ctrl</kbd> + Left Click on any calendar block to select. Drag top/bottom edge handles to adjust duration, or drag the body to slide times. Changes save permanently.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditorMode(false);
                setSelectedTransformTaskId(null);
                setTransformState(null);
              }}
              className="shrink-0 px-3.5 py-1.5 rounded-xl bg-amber-600 text-white font-semibold text-[11px] hover:bg-amber-700 shadow-xs transition cursor-pointer"
            >
              Save & Exit Editor
            </button>
          </div>
        )}

        {/* ── 2-COLUMN TIME-BLOCKING WORKSPACE ── */}
        <div className="w-full flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch overflow-hidden">

          {/* ══════════════════════════════════════════════════════
              LEFT COLUMN: UNIFIED TASK TRAY (3.5 cols)
             ══════════════════════════════════════════════════════ */}
          <div className={`w-full min-w-0 lg:col-span-4 xl:col-span-3.5 h-full min-h-0 flex flex-col ${
            mobileTab === 'tray'
              ? 'flex'
              : (activeTouchDrag || draggedItem || draggedTaskId)
              ? 'fixed -left-[9999px] top-0 opacity-0 pointer-events-none'
              : 'hidden lg:flex'
          }`}>
            <div className="w-full min-w-0 flex-1 min-h-0 flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#1A1A1E] border border-black/[0.07] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.02)] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0A84FF] flex items-center justify-center">
                    <Inbox className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-bold text-[#1A1B1F] tracking-tight">Task Tray</h2>
                    <p className="text-[10px] text-[#64748B]">
                      {viewRangeTitle.isToday ? 'Drag into calendar or click Slot' : `Slotting deliverables for ${viewRangeTitle.short}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-[#F5F4FA] text-[#64748B] text-[11px] font-bold">
                    {trayFilterMode === 'schedules' ? filteredSchedules.length : trayTasks.length}
                  </span>

                  {/* Multi-Select Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMultiSelectMode(prev => {
                        const next = !prev;
                        if (!next) {
                          setSelectedTaskIds(new Set());
                          setSelectedScheduleIds(new Set());
                        }
                        return next;
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                      isMultiSelectMode
                        ? 'bg-[#0A84FF] text-white shadow-xs'
                        : 'bg-[#F5F4FA] hover:bg-[#EBEBF0] text-[#475569] border border-black/[0.04]'
                    }`}
                    title={isMultiSelectMode ? "Cancel multi-select" : "Select multiple items to delete"}
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {isMultiSelectMode ? 'close' : 'checklist'}
                    </span>
                    <span>{isMultiSelectMode ? 'Cancel' : 'Select'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMobileTab('timeline')}
                    className="lg:hidden px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-blue-50 text-[#0A84FF] hover:bg-blue-100 transition flex items-center gap-1"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>Calendar</span>
                  </button>
                </div>
              </div>

              {/* Multi-Select Batch Action Bar */}
              {isMultiSelectMode && (
                <div className="p-2 px-3 rounded-xl bg-blue-50/90 border border-[#0A84FF]/25 flex items-center justify-between gap-2 animate-fadeIn shrink-0 shadow-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold text-[#0A84FF] shrink-0">
                      {activeSelectionCount} selected
                    </span>
                    <button
                      type="button"
                      onClick={
                        activeSelectionCount > 0 && activeSelectionCount === (trayFilterMode === 'schedules' ? filteredSchedules.length : trayTasks.length)
                          ? handleDeselectAll
                          : handleSelectAll
                      }
                      className="text-[10px] font-semibold text-[#475569] hover:text-[#0A84FF] underline decoration-dotted transition truncate cursor-pointer"
                    >
                      {activeSelectionCount > 0 && activeSelectionCount === (trayFilterMode === 'schedules' ? filteredSchedules.length : trayTasks.length)
                        ? 'Deselect all'
                        : 'Select all'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={activeSelectionCount === 0}
                      onClick={() => setShowBatchDeleteConfirm(true)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 shadow-xs ${
                        activeSelectionCount > 0
                          ? 'bg-[#E5484D] hover:bg-[#D93D42] text-white active:scale-95 cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete {activeSelectionCount > 0 ? `(${activeSelectionCount})` : ''}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Add into Tray Form */}
              <form onSubmit={handleCreateTrayTask} className="relative">
                <input
                  type="text"
                  placeholder={viewRangeTitle.isToday ? "+ Add deliverable to slot..." : `+ Add deliverable for ${viewRangeTitle.short}...`}
                  value={newTrayTaskTitle}
                  onChange={(e) => setNewTrayTaskTitle(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 rounded-xl text-[11px] bg-[#F5F4FA] border border-black/[0.06] text-[#1A1B1F] placeholder:text-[#94A3B8] outline-none focus:bg-white focus:border-[#0A84FF] transition"
                />
                {newTrayTaskTitle.trim() && (
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-[#0A84FF] text-white flex items-center justify-center text-[11px]"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {trayNlpPreview && trayNlpPreview.hasDetected && (
                  <div className="flex flex-wrap items-center gap-1 pt-1.5 px-0.5 animate-fadeIn">
                    <span className="text-[9.5px] font-bold text-[#0A84FF] flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                      Detected:
                    </span>
                    {trayNlpPreview.extracted.dueDate && (
                      <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[9.5px] font-semibold border border-blue-200/60">
                        {trayNlpPreview.extracted.dueDate}
                      </span>
                    )}
                    {trayNlpPreview.extracted.startTime && (
                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[9.5px] font-semibold border border-indigo-200/60">
                        {trayNlpPreview.extracted.startTime}
                      </span>
                    )}
                    {trayNlpPreview.extracted.durationMinutes && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[9.5px] font-semibold border border-amber-200/60">
                        {trayNlpPreview.extracted.durationMinutes}m
                      </span>
                    )}
                    {trayNlpPreview.extracted.impact && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold border ${
                        trayNlpPreview.extracted.impact === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200/60' : 'bg-slate-50 text-slate-700 border-slate-200/60'
                      }`}>
                        {trayNlpPreview.extracted.impact} impact
                      </span>
                    )}
                    {trayNlpPreview.extracted.areas && (
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-700 text-[9.5px] font-semibold border border-slate-200/60">
                        {trayNlpPreview.extracted.areas[0]}
                      </span>
                    )}
                    {trayNlpPreview.extracted.goalTitle && (
                      <span className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[9.5px] font-semibold border border-purple-200/60">
                        {trayNlpPreview.extracted.goalTitle}
                      </span>
                    )}
                  </div>
                )}
              </form>

              {/* Tray Tabs */}
              <div className="grid grid-cols-5 gap-1 bg-[#F5F4FA] p-0.5 rounded-xl border border-black/[0.04]">
                {[
                  { id: 'unscheduled', label: 'Open' },
                  { id: 'rituals', label: 'Rituals' },
                  { id: 'schedules', label: 'Timetable' },
                  { id: 'all', label: 'All' },
                  { id: 'backlog', label: 'Backlog' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTrayFilterMode(t.id)}
                    className={`py-1 rounded-lg text-[10px] font-semibold transition text-center truncate ${
                      trayFilterMode === t.id
                        ? 'bg-white text-[#1A1B1F] shadow-xs font-bold'
                        : 'text-[#8E8E93] hover:text-[#1A1B1F]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tray Search & Area Filters */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="text"
                    placeholder="Search tray..."
                    value={traySearch}
                    onChange={(e) => setTraySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-[11px] bg-[#F5F4FA] border border-black/[0.06] text-[#1A1B1F] placeholder:text-[#94A3B8] outline-none focus:bg-white focus:border-[#0A84FF] transition"
                  />
                </div>

                {/* Horizontal Life Area Filter Chips */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setTrayAreaFilter('all')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition shrink-0 ${
                      trayAreaFilter === 'all'
                        ? 'bg-[#0A84FF] text-white shadow-2xs'
                        : 'bg-[#F5F4FA] text-[#64748B] hover:bg-[#EBEBF0]'
                    }`}
                  >
                    All
                  </button>
                  {LIFE_AREAS.map(area => {
                    const isSelected = trayAreaFilter === area.label;
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => setTrayAreaFilter(isSelected ? 'all' : area.label)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition shrink-0 ${
                          isSelected
                            ? 'bg-[#0A84FF] text-white shadow-2xs'
                            : 'bg-[#F5F4FA] text-[#64748B] hover:bg-[#EBEBF0]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${area.dotClass}`} />
                        <span>{area.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Task Cards Stream (Expanded to full column height) */}
              <div className="space-y-2 flex-1 overflow-y-auto pr-0.5 min-h-0">
                {trayFilterMode === 'schedules' ? (
                  filteredSchedules.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#F9F9FB] border border-dashed border-black/[0.08] text-center space-y-2 my-4">
                      <span className="material-symbols-outlined text-[28px] text-indigo-500 mx-auto block">school</span>
                      <p className="text-[12px] font-semibold text-[#1A1B1F]">No timetable schedules found</p>
                      <p className="text-[10px] text-[#64748B]">Set up fixed classes, labs, and recurring routines.</p>
                      <button
                        type="button"
                        onClick={() => onOpenQuickAdd?.({ initialMode: 'schedule' })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Class / Schedule</span>
                      </button>
                    </div>
                  ) : (
                    filteredSchedules.map(sched => {
                      const isActiveToday = isScheduleActiveForDate(sched, viewDate);
                      const isDone = Boolean(
                        sched.completed ||
                        (Array.isArray(sched.completedDates) && sched.completedDates.includes(viewDate))
                      );
                      const startLabel = sched.startTime ? formatTimeString(sched.startTime) : 'Flexible';
                      const endLabel = sched.endTime ? formatTimeString(sched.endTime) : (sched.startTime ? formatTimeString(calculateEndTime(sched.startTime, sched.durationMinutes || 60)) : '');
                      const recLabel = sched.recurrence === 'custom' && Array.isArray(sched.repeatDays)
                        ? (sched.repeatDays.length === 5 && [1, 2, 3, 4, 5].every(d => sched.repeatDays.includes(d)) ? 'Weekdays'
                          : sched.repeatDays.length === 3 && [1, 3, 5].every(d => sched.repeatDays.includes(d)) ? 'MWF'
                          : sched.repeatDays.length === 7 ? 'Every day'
                          : sched.repeatDays.map(d => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d]).join(', '))
                        : (sched.recurrence || 'Once');
                      const isSelected = isMultiSelectMode && selectedScheduleIds.has(sched.id);

                      return (
                        <div
                          key={`tray-s-${sched.id}`}
                          draggable={!isMultiSelectMode}
                          onDragStart={(e) => handleStartDrag('schedule', sched, e)}
                          onDragEnd={handleEndDrag}
                          onTouchStart={(e) => handleTouchStartCard('schedule', sched, e)}
                          onTouchMove={handleTouchMoveCard}
                          onTouchEnd={handleTouchEndCard}
                          onTouchCancel={handleTouchEndCard}
                          onClick={() => {
                            if (didJustDragRef.current) return;
                            if (isMultiSelectMode) {
                              toggleSelectSchedule(sched.id);
                            } else {
                              setEditingSchedule(sched);
                            }
                          }}
                          style={{ touchAction: 'none', userSelect: 'none' }}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer group shadow-2xs select-none touch-none ${
                            isSelected
                              ? 'ring-2 ring-[#0A84FF] border-[#0A84FF] bg-blue-50/70 shadow-xs'
                              : isDone
                              ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70 opacity-90'
                              : 'border-indigo-100/80 bg-white hover:bg-indigo-50/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {isMultiSelectMode ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectSchedule(sched.id);
                                }}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                                  isSelected
                                    ? 'bg-[#0A84FF] border-[#0A84FF] text-white shadow-2xs'
                                    : 'border-slate-300 bg-white hover:border-[#0A84FF]'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>
                            ) : (
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600'
                              }`}>
                                <span className="material-symbols-outlined text-[16px]">{isDone ? 'check' : 'school'}</span>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className={`text-[12px] font-bold truncate transition ${
                                  isDone
                                    ? 'line-through text-slate-400 group-hover:text-emerald-700'
                                    : 'text-indigo-950 group-hover:text-indigo-600'
                                }`}>
                                  {sched.title}
                                </p>
                                {isDone ? (
                                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-200/80 shrink-0">
                                    Done
                                  </span>
                                ) : isActiveToday ? (
                                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200/60 shrink-0">
                                    Today
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                                <span>{startLabel} – {endLabel}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-indigo-600 font-semibold">{recLabel}</span>
                              </div>
                            </div>
                          </div>
                          {!isMultiSelectMode && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {sched.category && (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[9.5px] font-bold uppercase tracking-wider">
                                  {sched.category}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleToggleScheduleDone(sched, viewDate, e)}
                                className={`p-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                                  isDone
                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                                    : 'border-slate-200 hover:border-emerald-500 hover:text-emerald-600 text-slate-300 bg-white'
                                }`}
                                title={isDone ? "Mark incomplete" : "Mark attended/completed"}
                              >
                                <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isDone ? 'text-white' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSchedule(sched);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Edit schedule"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )
                ) : trayFilterMode === 'rituals' ? (
                  habits.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#F9F9FB] border border-dashed border-black/[0.08] text-center space-y-2 my-4">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                      <p className="text-[12px] font-semibold text-[#1A1B1F]">No habits created</p>
                      <p className="text-[10px] text-[#64748B]">Create daily rituals to establish baseline consistency.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHabit(null);
                          setIsHabitModalOpen(true);
                        }}
                        className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#161618] text-white text-[11px] font-semibold hover:opacity-90 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Ritual
                      </button>
                    </div>
                  ) : (
                    habits.map(h => {
                      const isChecked = Array.isArray(h.completedDays) && h.completedDays.includes(viewDate);
                      return (
                        <div
                          key={`tray-h-${h.id}`}
                          draggable={!isMultiSelectMode}
                          onDragStart={(e) => handleStartDrag('habit', h, e)}
                          onDragEnd={handleEndDrag}
                          onTouchStart={(e) => handleTouchStartCard('habit', h, e)}
                          onTouchMove={handleTouchMoveCard}
                          onTouchEnd={handleTouchEndCard}
                          onTouchCancel={handleTouchEndCard}
                          onClick={() => {
                            if (didJustDragRef.current) return;
                            setEditingHabit(h);
                            setIsHabitModalOpen(true);
                          }}
                          style={{ touchAction: 'none', userSelect: 'none' }}
                          title="Click to edit ritual, or drag onto calendar timeline"
                          className={`group p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer select-none touch-none ${
                            isChecked
                              ? 'bg-emerald-50/70 border-emerald-200 opacity-80'
                              : 'bg-white hover:bg-emerald-50/30 border-black/[0.06]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCheckInHabit?.(h.id, viewDate);
                              }}
                              className={`w-5 h-5 rounded-full flex items-center justify-center transition shrink-0 ${
                                isChecked
                                  ? 'bg-emerald-600 text-white'
                                  : 'border-2 border-emerald-500 hover:bg-emerald-50 text-transparent'
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </button>
                            <div className="min-w-0">
                              <p className={`text-[12px] font-semibold truncate ${isChecked ? 'line-through text-emerald-800' : 'text-[#1A1B1F]'}`}>
                                {h.title}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-[#64748B]">
                                <span>{h.duration || '30 mins'}</span>
                                {h.isTimeBlocked !== false && h.startTime && <span className="text-emerald-600 font-bold">• At {formatTimeString(h.startTime)}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {h.linkedGoal && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 truncate max-w-[80px]">
                                {h.linkedGoal}
                              </span>
                            )}
                            <Pencil className="w-3 h-3 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      );
                    })
                  )
                ) : trayTasks.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-[#F9F9FB] border border-dashed border-black/[0.08] text-center space-y-1.5 my-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                    <p className="text-[12px] font-semibold text-[#1A1B1F]">
                      {trayFilterMode === 'unscheduled' ? 'No unscheduled tasks!' : 'No tasks match filter'}
                    </p>
                    <p className="text-[10px] text-[#64748B]">All deliverables are scheduled on your calendar timeline.</p>
                  </div>
                ) : (
                  trayTasks.map(task => {
                    const impactDot =
                      task.impact === 'high' || task.priority === 'high'
                        ? 'bg-red-500'
                        : task.impact === 'low'
                        ? 'bg-emerald-500'
                        : 'bg-amber-400';
                    const taskArea = Array.isArray(task.areas) && task.areas.length > 0 ? task.areas[0] : (task.category || 'Career & Craft');
                    const isMenuOpen = activeSlotMenuTaskId === task.id;
                    const isAlreadySlotted = Boolean(task.startTime);
                    const isSelected = isMultiSelectMode && selectedTaskIds.has(task.id);

                    return (
                      <div
                        key={task.id}
                        draggable={!isMultiSelectMode}
                        onDragStart={(e) => handleStartDrag('task', task, e)}
                        onDragEnd={handleEndDrag}
                        onTouchStart={(e) => handleTouchStartCard('task', task, e)}
                        onTouchMove={handleTouchMoveCard}
                        onTouchEnd={handleTouchEndCard}
                        onTouchCancel={handleTouchEndCard}
                        onClick={() => {
                          if (didJustDragRef.current) return;
                          if (isMultiSelectMode) {
                            toggleSelectTask(task.id);
                          } else {
                            setEditingTask(task);
                          }
                        }}
                        style={{ touchAction: 'none', userSelect: 'none' }}
                        className={`relative p-2.5 rounded-xl border transition-all select-none touch-none ${
                          isMultiSelectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                        } hover:shadow-xs group ${
                          isSelected
                            ? 'ring-2 ring-[#0A84FF] border-[#0A84FF] bg-blue-50/70 shadow-xs'
                            : draggedTaskId === task.id
                            ? 'opacity-40 border-[#0A84FF] bg-blue-50/50'
                            : 'bg-[#FAFAFC] hover:bg-white border-black/[0.06]'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {isMultiSelectMode ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectTask(task.id);
                              }}
                              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ${
                                isSelected
                                  ? 'bg-[#0A84FF] border-[#0A84FF] text-white shadow-2xs'
                                  : 'border-slate-300 bg-white hover:border-[#0A84FF]'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleTask?.(task.id, viewDate);
                              }}
                              className="mt-0.5 text-[#94A3B8] hover:text-[#0A84FF] transition shrink-0"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-[#1A1B1F] leading-tight truncate">
                              {task.title}
                            </p>

                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-[#64748B]">
                                <span className={`w-1.5 h-1.5 rounded-full ${impactDot}`} />
                                <span>{task.durationMinutes ? formatDurationLabel(task.durationMinutes) : '45m'}</span>
                              </span>

                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-black/[0.04] text-[#64748B] truncate max-w-[100px]">
                                {taskArea}
                              </span>

                              {task.recurrence && task.recurrence !== 'none' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 text-teal-700" title={`Repeats ${task.recurrence}`}>
                                  <Repeat className="w-2.5 h-2.5" />
                                  <span className="capitalize">{task.recurrence}</span>
                                </span>
                              )}

                              {isAlreadySlotted && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-[#0A84FF]">
                                  Slotted {task.startTime}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Slot Button & Popover */}
                          {!isMultiSelectMode && (
                            <div className="relative" ref={isMenuOpen ? slotMenuRef : null}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSlotMenuTaskId(isMenuOpen ? null : task.id);
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-0.5 shrink-0 ${
                                  isAlreadySlotted
                                    ? 'bg-black/[0.04] hover:bg-[#0A84FF] text-[#64748B] hover:text-white'
                                    : 'bg-[#0A84FF]/10 hover:bg-[#0A84FF] text-[#0A84FF] hover:text-white'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                <span>{isAlreadySlotted ? 'Move' : 'Slot'}</span>
                              </button>

                              {isMenuOpen && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 z-50 w-44 p-1.5 rounded-xl bg-white border border-black/[0.08] shadow-[0_12px_32px_rgba(0,0,0,0.14)] space-y-1 animate-fadeIn"
                                >
                                  <div className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    Slot into {planDateLabel(viewDate)}
                                  </div>
                                  {['09:00', '11:00', '13:30', '15:00', '16:30'].map(slotTime => (
                                    <button
                                      key={slotTime}
                                      type="button"
                                      onClick={() => handleSlotTask(task.id, slotTime, viewDate)}
                                      className="w-full text-left px-2 py-1 rounded-lg text-[11px] font-semibold text-[#1A1B1F] hover:bg-blue-50 hover:text-[#0A84FF] flex items-center justify-between transition"
                                    >
                                      <span>{slotTime}</span>
                                      <Plus className="w-3.5 h-3.5 opacity-60" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              RIGHT COLUMN: FULL-WIDTH CALENDAR CANVAS (8.5 cols)
             ══════════════════════════════════════════════════════ */}
          <div className={`w-full min-w-0 lg:col-span-8 xl:col-span-8.5 h-full min-h-0 p-2.5 sm:p-4 rounded-2xl bg-white dark:bg-[#121316] border border-black/[0.06] dark:border-white/[0.08] shadow-2xs overflow-hidden flex flex-col ${
            mobileTab === 'timeline' || Boolean(activeTouchDrag || draggedItem || draggedTaskId) ? 'flex' : 'hidden lg:flex'
          }`}>
            {/* Active Drag & Mobile Hold Placement Banner */}
            {draggedItem && (
              <div className="mb-2.5 p-2 px-3 rounded-xl bg-[#0A84FF] text-white flex items-center justify-between text-xs font-semibold shadow-xs animate-fadeIn shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-[17px] shrink-0 animate-bounce">touch_app</span>
                  <span className="truncate text-[11.5px]">
                    Drop or tap an hour slot to schedule <strong className="font-bold underline">{draggedItem.title || 'item'}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEndDrag();
                  }}
                  className="p-1 rounded-lg hover:bg-white/20 transition shrink-0 ml-2 cursor-pointer"
                  title="Cancel slotting"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mb-1.5 sm:mb-3 gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#0A84FF] flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0A84FF]" />
                </div>
                <div>
                  <span className="text-[12px] sm:text-[13px] font-bold text-[#1A1B1F] dark:text-slate-100">
                    {scope === 'day' ? 'Daily Schedule' : scope === '3day' ? '3-Day Rolling Horizon' : '7-Day Weekly Grid'}
                  </span>
                  <span className="text-[10px] text-[#8E8E93] dark:text-slate-400 hidden sm:inline ml-2">• Click or drop tasks across hours</span>
                </div>
              </div>

              {/* Quick time anchors on mobile/desktop */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollToHour(7)}
                  className="px-2 py-0.5 sm:py-1 rounded-lg text-[10px] font-semibold bg-[#F5F4FA] dark:bg-[#202227] text-[#64748B] dark:text-slate-300 hover:text-[#0A84FF] transition cursor-pointer"
                  title="Jump to 7:00 AM"
                >
                  7 AM
                </button>
                <button
                  type="button"
                  onClick={() => scrollToHour(13)}
                  className="px-2 py-0.5 sm:py-1 rounded-lg text-[10px] font-semibold bg-[#F5F4FA] dark:bg-[#202227] text-[#64748B] dark:text-slate-300 hover:text-[#0A84FF] transition cursor-pointer"
                  title="Jump to 1:00 PM"
                >
                  1 PM
                </button>
                <button
                  type="button"
                  onClick={() => scrollToNow(true, true)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-[#0A84FF] hover:bg-blue-100 dark:hover:bg-blue-900/40 transition active:scale-95 cursor-pointer"
                  title="Jump to Current Time"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>Now</span>
                </button>
              </div>
            </div>

            <div
              ref={calendarScrollRef}
              className={`relative ${scope === 'day' ? 'overflow-x-hidden' : 'overflow-x-auto'} overflow-y-auto select-none border border-black/[0.06] dark:border-white/[0.08] rounded-xl bg-[#FAFAFC] dark:bg-[#18191D] w-full min-w-0 flex-1 min-h-0`}
            >
              <div
                className="grid w-full min-w-0"
                style={{
                  gridTemplateColumns: scope === 'day'
                    ? '44px minmax(0px, 1fr)'
                    : `44px repeat(${columnDates.length}, minmax(${scope === 'week' ? '120px' : '180px'}, 1fr))`,
                  minWidth: scope === 'day' ? '100%' : scope === '3day' ? '560px' : '840px',
                  width: '100%'
                }}
              >
                {/* Corner Spacer */}
                <div className="sticky top-0 z-30 h-10 border-b border-r border-black/[0.06] dark:border-white/[0.08] bg-[#F5F4FA] dark:bg-[#1A1C20] shrink-0" />

                {/* Column Headers */}
                {columnsData.map(col => (
                  <div
                    key={col.colDate}
                    className={`sticky top-0 z-30 h-10 px-2 sm:px-3 flex items-center justify-between border-b border-r border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md min-w-0 overflow-hidden ${
                      col.isToday ? 'bg-blue-50/95 dark:bg-blue-950/60 text-[#0A84FF]' : 'bg-[#F5F4FA]/95 dark:bg-[#1A1C20]/95 text-[#64748B] dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[12px] min-w-0 truncate">
                      <span className="truncate">{col.headerInfo.weekday}</span>
                      <span className={`px-1.5 py-0.2 rounded-md shrink-0 ${col.isToday ? 'bg-[#0A84FF] text-white shadow-2xs' : 'text-[#1A1B1F] dark:text-slate-100'}`}>
                        {col.headerInfo.dayNum}
                      </span>
                    </div>

                    {col.colMins > 0 && (
                      <span className="text-[10px] font-semibold text-[#8E8E93] dark:text-slate-400 shrink-0">
                        {(col.colMins / 60).toFixed(1)}h
                      </span>
                    )}
                  </div>
                ))}

                {/* Left Hour Axis */}
                <div className="relative border-r border-black/[0.06] dark:border-white/[0.08] bg-[#F5F4FA] dark:bg-[#1A1C20] shrink-0" style={{ height: `${TOTAL_HEIGHT}px` }}>
                  {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
                    const hourNum = START_HOUR + i;
                    const hourLabel = `${String(hourNum).padStart(2, '0')}:00`;
                    const axisLabel = formatHourAxis(hourNum);
                    const topPos = i * HOUR_HEIGHT;
                    return (
                      <div
                        key={hourLabel}
                        style={{ top: `${topPos}px`, height: `${HOUR_HEIGHT}px` }}
                        className="absolute left-0 right-0 border-b border-black/[0.04] dark:border-white/[0.04] pr-1.5 pt-1 text-right font-mono text-[10px] text-[#8E8E93] dark:text-slate-400"
                        title={hourLabel}
                      >
                        {axisLabel}
                      </div>
                    );
                  })}
                </div>

                {/* Multi-Column Canvas Bodies */}
                {columnsData.map(col => {
                  const { colDate, isToday, colScheduled } = col;

                  return (
                    <div
                      key={colDate}
                      onClick={() => {
                        if (isEditorMode && selectedTransformTaskId) {
                          setSelectedTransformTaskId(null);
                        }
                      }}
                      className="relative border-r border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#121316] transition-colors min-w-0 overflow-hidden"
                      style={{ height: `${TOTAL_HEIGHT}px` }}
                    >
                      {/* Hour Slots with Drop Targets & Half-Hour Grid lines */}
                      {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
                        const hourNum = START_HOUR + i;
                        const hourLabel = `${String(hourNum).padStart(2, '0')}:00`;
                        const topPos = i * HOUR_HEIGHT;
                        const isHovered = dragOverSlot?.date === colDate && dragOverSlot?.hour === hourLabel;
                        const isTargetedByTouch = activeTouchDrag && activeTouchDrag.targetDate === colDate && activeTouchDrag.targetHour === hourLabel;

                        return (
                          <div
                            key={hourLabel}
                            style={{ top: `${topPos}px`, height: `${HOUR_HEIGHT}px` }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (dragOverSlot?.date !== colDate || dragOverSlot?.hour !== hourLabel) {
                                setDragOverSlot({ date: colDate, hour: hourLabel });
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverSlot?.date === colDate && dragOverSlot?.hour === hourLabel) {
                                setDragOverSlot(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverSlot(null);
                              try {
                                const raw = e.dataTransfer?.getData('text/plain');
                                if (raw) {
                                  const data = JSON.parse(raw);
                                  handleSlotDroppedItem(data, hourLabel, colDate);
                                } else if (draggedItem) {
                                  handleSlotDroppedItem(draggedItem, hourLabel, colDate);
                                }
                              } catch (err) {
                                if (draggedItem) {
                                  handleSlotDroppedItem(draggedItem, hourLabel, colDate);
                                }
                              }
                              handleEndDrag();
                            }}
                            onClick={() => {
                              if (draggedItem) {
                                handleSlotDroppedItem(draggedItem, hourLabel, colDate);
                                handleEndDrag();
                              } else {
                                onOpenQuickAdd?.({ initialTime: hourLabel, initialDate: colDate });
                              }
                            }}
                            className={`absolute left-0 right-0 border-b border-black/[0.05] dark:border-white/[0.05] transition-colors cursor-pointer group flex items-start justify-end p-1.5 ${
                              isHovered || isTargetedByTouch
                                ? 'bg-blue-100/75 dark:bg-blue-900/50 ring-2 ring-blue-500 inset-0 z-10'
                                : (hourNum < 6 || hourNum >= 22)
                                  ? 'bg-[#F8F8FC]/80 dark:bg-[#16171B]/80 hover:bg-blue-50/40 dark:hover:bg-blue-950/30'
                                  : 'bg-white dark:bg-[#121316] hover:bg-blue-50/40 dark:hover:bg-blue-950/30'
                            }`}
                          >
                            {/* Subtle half-hour divider */}
                            <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-black/[0.03] dark:border-white/[0.04] pointer-events-none" />

                            <span className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-[#0A84FF] transition-opacity z-10">
                              + Block at {hourLabel}
                            </span>
                          </div>
                        );
                      })}

                      {/* Live Snapped Ghost Block Preview (Google Calendar Style) */}
                      {activeTouchDrag && activeTouchDrag.targetDate === colDate && (
                        (() => {
                          const ghostStartMin = minutesFromStartOfDay(activeTouchDrag.targetHour);
                          if (ghostStartMin === null) return null;
                          const ghostDur = Number(activeTouchDrag.item.durationMinutes) || 45;
                          const ghostTopPx = Math.max(0, ((ghostStartMin - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
                          const ghostHeightPx = Math.max(38, (ghostDur / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
                          return (
                            <div
                              style={{
                                top: `${ghostTopPx}px`,
                                height: `${ghostHeightPx}px`,
                                left: '6px',
                                right: '6px'
                              }}
                              className="absolute z-25 rounded-xl border-2 border-dashed border-[#0A84FF] bg-blue-500/20 backdrop-blur-2xs p-2.5 flex flex-col justify-between pointer-events-none transition-all duration-75 shadow-md ring-2 ring-[#0A84FF]/25 animate-fadeIn"
                            >
                              <div className="flex items-center justify-between gap-1 text-[#0A84FF] font-bold text-xs truncate">
                                <span className="truncate flex items-center gap-1.5 drop-shadow-2xs">
                                  <span className="material-symbols-outlined text-[15px]">schedule</span>
                                  {activeTouchDrag.item.title}
                                </span>
                                <span className="text-[10px] font-mono bg-[#0A84FF] text-white px-1.5 py-0.5 rounded-md font-bold shadow-xs shrink-0">
                                  {formatTimeString(activeTouchDrag.targetHour)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[9.5px] font-semibold text-[#0A84FF]/90">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">touch_app</span>
                                  Release thumb to place
                                </span>
                                <span className="font-mono bg-blue-100/90 text-blue-800 px-1 py-0.2 rounded font-bold">{ghostDur}m</span>
                              </div>
                            </div>
                          );
                        })()
                      )}

                      {/* Live Laser Ruler on Today column */}
                      {isToday && currentTimeTop !== null && (
                        <div
                          style={{ top: `${currentTimeTop}px` }}
                          className="absolute left-0 right-0 z-30 pointer-events-none flex items-center transition-all duration-500 min-w-0 overflow-hidden"
                        >
                          <div className="flex items-center -ml-0.5 shrink-0">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] ring-2 ring-white shrink-0" />
                            <span className="px-1 py-0.2 rounded bg-red-500 text-white font-mono text-[9px] font-bold shadow-xs -ml-0.5 shrink-0">
                              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 h-[2px] bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                        </div>
                      )}

                      {/* Blocks & Smart Buffer Gaps Container */}
                      <div className="absolute inset-0 pointer-events-none p-1.5">
                        {colScheduled.map(block => {
                          const {
                            id,
                            type,
                            sched,
                            habit,
                            task,
                            startMin,
                            endMin,
                            duration,
                            lane,
                            totalLanes,
                            isNested,
                            nestedLane,
                            nestedTotalLanes,
                            isCBlock,
                            hasNestedChildren = false,
                            hasSnapToPrev,
                            hasSnapToNext,
                            parentLaneInfo,
                            computedTopPx,
                            computedHeightPx
                          } = block;

                          const hasOverlap = !isNested && totalLanes > 1;
                          const parentHasOverlap = isNested && parentLaneInfo && parentLaneInfo.totalLanes > 1;
                          const parentWidthPct = parentHasOverlap ? (100 / parentLaneInfo.totalLanes) : 100;
                          const parentLeftPct = parentHasOverlap ? (parentLaneInfo.lane * parentWidthPct) : 0;

                          const widthStyle = isNested
                            ? (nestedTotalLanes > 1
                                ? `calc(${parentWidthPct / nestedTotalLanes}% - 26px)`
                                : `calc(${parentWidthPct}% - 26px)`)
                            : (hasOverlap
                                ? `calc(${100 / totalLanes}% - 6px)`
                                : 'calc(100% - 8px)');

                          const leftStyle = isNested
                            ? (nestedTotalLanes > 1
                                ? `calc(${parentLeftPct}% + 22px + ${(nestedLane || 0) * (parentWidthPct / nestedTotalLanes)}%)`
                                : `calc(${parentLeftPct}% + 22px)`)
                            : (hasOverlap
                                ? `calc(${lane * (100 / totalLanes)}% + 4px)`
                                : '4px');

                          const zIndexVal = isNested ? 28 : isCBlock ? 12 : (15 + (lane || 0));

                          // ── Type 1: Fixed Schedule Block (Classes/Timetable) ──
                          if (type === 'schedule') {
                            if (!sched) return null;
                            const isDone = Boolean(
                              sched.completed ||
                              (Array.isArray(sched.completedDates) && sched.completedDates.includes(colDate))
                            );
                            const topPx = computedTopPx ?? Math.max(0, ((startMin - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
                            const heightPx = computedHeightPx ?? Math.max(34, (duration / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT - 2);
                            const isCompactSched = heightPx < 48;

                            return (
                              <div
                                key={id}
                                onClick={(e) => {
                                  if (didJustDragRef.current) return;
                                  e.stopPropagation();
                                  setEditingSchedule(sched);
                                }}
                                onTouchStart={(e) => {
                                  if (e.target.closest('button')) return;
                                  handleTouchStartCard('schedule', sched, e);
                                }}
                                onTouchMove={handleTouchMoveCard}
                                onTouchEnd={handleTouchEndCard}
                                onTouchCancel={handleTouchEndCard}
                                style={{
                                  top: `${topPx}px`,
                                  height: `${heightPx}px`,
                                  width: widthStyle,
                                  left: leftStyle,
                                  zIndex: zIndexVal,
                                  touchAction: 'none',
                                  userSelect: 'none',
                                  WebkitUserSelect: 'none'
                                }}
                                className={`absolute rounded-xl pointer-events-auto border overflow-hidden transition-all ${
                                  isCompactSched ? 'px-2.5 py-0.5 flex items-center justify-between gap-2' : 'p-2.5 flex flex-col justify-between'
                                } shadow-xs select-none touch-none ${
                                  activeTouchDrag?.item?.id === sched.id
                                    ? 'opacity-40 ring-2 ring-[#0A84FF] scale-[0.98]'
                                    : isDone
                                    ? 'border-emerald-300 dark:border-emerald-500/40 border-l-[4px] border-l-emerald-500 bg-emerald-50/95 dark:bg-emerald-950/40 hover:bg-emerald-100/95 dark:hover:bg-emerald-900/50 opacity-90'
                                    : 'border-indigo-200/90 dark:border-indigo-500/30 border-l-[4px] border-l-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/45 hover:bg-indigo-100/90 dark:hover:bg-indigo-900/55'
                                } group cursor-pointer`}
                              >
                                <div className="flex items-center justify-between gap-1.5 min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className="material-symbols-outlined text-[13px] text-indigo-600 dark:text-indigo-400 shrink-0">{isDone ? 'check' : 'school'}</span>
                                    <span className={`text-[11.5px] font-bold truncate tracking-tight ${
                                      isDone ? 'line-through text-slate-500 dark:text-slate-400' : 'text-indigo-950 dark:text-indigo-100'
                                    }`}>
                                      {sched.title}
                                    </span>
                                    {isDone ? (
                                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-100/90 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[8.5px] font-bold uppercase tracking-wider shrink-0">
                                        Done
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded-md bg-indigo-100/90 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[8.5px] font-bold uppercase tracking-wider shrink-0">
                                        Class
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isCompactSched && (
                                      <span className="font-mono text-[9.5px] font-semibold text-indigo-700 dark:text-indigo-300">
                                        {format12Hour(startMin)} – {format12Hour(endMin % 1440)}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => handleToggleScheduleDone(sched, colDate, e)}
                                      title={isDone ? "Mark incomplete" : "Mark attended/completed"}
                                      className={`p-0.5 rounded transition cursor-pointer ${
                                        isDone ? 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800' : 'text-indigo-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100'
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </button>
                                    {onDeleteSchedule && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSingleDeleteTarget({ type: 'schedule', id: sched.id, title: sched.title });
                                        }}
                                        title="Remove schedule block"
                                        className="p-0.5 rounded text-indigo-400 hover:text-red-500 hover:bg-white/80 dark:hover:bg-black/40 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {!isCompactSched && (
                                  <div className="flex items-center justify-between text-[10px] font-medium text-indigo-700 dark:text-indigo-300 mt-1">
                                    <span className="font-mono text-[9.5px] font-semibold">
                                      {format12Hour(startMin)} – {format12Hour(endMin % 1440)}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-100/80 dark:bg-indigo-900/60 font-bold text-[9px]">
                                      {duration}m
                                    </span>
                                  </div>
                                )}

                                {/* Scratch Puzzle Snap Notch if continuous with next item */}
                                {hasSnapToNext && (
                                  <div
                                    className="absolute -bottom-1 left-8 w-5 h-1 rounded-b bg-indigo-300 dark:bg-indigo-700 pointer-events-none z-30"
                                    title="Puzzle snap flow"
                                  />
                                )}
                              </div>
                            );
                          }

                          // ── Type 2: Habit & Ritual Block ──
                          if (type === 'habit') {
                            if (!habit) return null;
                            const isChecked = Array.isArray(habit.completedDays) && habit.completedDays.includes(colDate);
                            const topPx = computedTopPx ?? Math.max(0, ((startMin - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
                            const heightPx = computedHeightPx ?? Math.max(34, (duration / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT - 2);

                            if (isCBlock) {
                              // Anatomical 3-Part Scratch C-Block Container (Top Header Arm + Left Spine + Open Mouth Cavity + Bottom Jaw)
                              return (
                                <div
                                  key={id}
                                  style={{
                                    top: `${topPx}px`,
                                    height: `${heightPx}px`,
                                    width: widthStyle,
                                    left: leftStyle,
                                    zIndex: zIndexVal,
                                    touchAction: 'none',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none'
                                  }}
                                  className={`absolute pointer-events-none select-none touch-none group ${
                                    isChecked ? 'opacity-85' : ''
                                  }`}
                                >
                                  {/* Part 1: C-Block Top Header Arm (32px height) */}
                                  <div
                                    onClick={(e) => {
                                      if (didJustDragRef.current) return;
                                      e.stopPropagation();
                                      setEditingHabit(habit);
                                      setIsHabitModalOpen(true);
                                    }}
                                    onTouchStart={(e) => {
                                      if (e.target.closest('button')) return;
                                      handleTouchStartCard('habit', habit, e);
                                    }}
                                    onTouchMove={handleTouchMoveCard}
                                    onTouchEnd={handleTouchEndCard}
                                    onTouchCancel={handleTouchEndCard}
                                    title="Click to edit habit sequence"
                                    className="absolute top-0 left-0 right-0 h-[32px] pointer-events-auto cursor-pointer rounded-t-xl rounded-br-lg bg-emerald-100/95 dark:bg-emerald-950/90 border border-emerald-400/70 dark:border-emerald-500/45 border-l-[6px] border-l-emerald-500 px-2.5 flex items-center justify-between gap-2 shadow-2xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onCheckInHabit?.(habit.id, colDate);
                                        }}
                                        className={`w-4 h-4 rounded-full flex items-center justify-center transition shrink-0 ${
                                          isChecked
                                            ? 'bg-emerald-600 text-white'
                                            : 'border-2 border-emerald-500 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-transparent'
                                        }`}
                                        title={isChecked ? 'Checked in! Click to uncheck' : 'Click to check in ritual'}
                                      >
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      </button>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="material-symbols-outlined text-[13.5px] text-emerald-700 dark:text-emerald-300 shrink-0">
                                          {habit.icon || 'terminal'}
                                        </span>
                                        <span className={`text-[11.5px] font-extrabold truncate tracking-tight ${isChecked ? 'line-through text-emerald-800 dark:text-emerald-400' : 'text-emerald-950 dark:text-emerald-100'}`}>
                                          {habit.title}
                                        </span>
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 dark:bg-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-[8px] font-black uppercase tracking-wider shrink-0">
                                          Focus C-Block
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {habit.linkedGoal && (
                                        <span className="hidden md:inline text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-300 truncate max-w-[120px]">
                                          ⚓ {habit.linkedGoal}
                                        </span>
                                      )}
                                      <span className="text-[9.5px] font-mono font-bold text-emerald-800 dark:text-emerald-200 bg-white/60 dark:bg-black/30 px-1.5 py-0.2 rounded border border-emerald-400/30">
                                        {format12Hour(startMin)} – {format12Hour(endMin % 1440)}
                                      </span>
                                    </div>

                                    {/* Scratch Inner Mouth Puzzle Tab */}
                                    <div className="absolute -bottom-[5px] left-7 w-6 h-[5px] rounded-b bg-emerald-200 dark:bg-emerald-800 border-x border-b border-emerald-400/60 pointer-events-none z-20" />
                                  </div>

                                  {/* Part 2: C-Block Left Structural Spine + Open Recessed Mouth Cavity */}
                                  <div className="absolute top-[31px] bottom-[11px] left-0 w-[14px] pointer-events-auto bg-emerald-100/90 dark:bg-emerald-950/85 border-l-[6px] border-l-emerald-500 border-r border-r-emerald-400/60 dark:border-r-emerald-500/40" />
                                  <div className="absolute top-[32px] bottom-[12px] left-[14px] right-0 bg-emerald-500/[0.025] dark:bg-emerald-500/[0.04] border-r border-dashed border-emerald-400/30 pointer-events-none" />

                                  {/* Part 3: C-Block Bottom Jaw Clamp (12px slim closing arm) */}
                                  <div className="absolute bottom-0 left-0 right-0 h-[12px] pointer-events-auto rounded-b-xl rounded-tr-md bg-emerald-100/90 dark:bg-emerald-950/85 border border-emerald-400/70 dark:border-emerald-500/45 border-l-[6px] border-l-emerald-500 flex items-center justify-between px-3">
                                    <div className="w-8 h-[2px] rounded-full bg-emerald-500/40" />
                                    <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-emerald-700/70 dark:text-emerald-300/70">
                                      {duration}m Sprint
                                    </span>
                                  </div>
                                </div>
                              );
                            }

                            // Standard non-container Habit Card (Compact single-line if < 48px, two-line if >= 48px)
                            const isCompactHabit = heightPx < 48;
                            return (
                              <div
                                key={id}
                                onClick={(e) => {
                                  if (didJustDragRef.current) return;
                                  e.stopPropagation();
                                  setEditingHabit(habit);
                                  setIsHabitModalOpen(true);
                                }}
                                title="Click to edit habit sequence"
                                onTouchStart={(e) => {
                                  if (e.target.closest('button')) return;
                                  handleTouchStartCard('habit', habit, e);
                                }}
                                onTouchMove={handleTouchMoveCard}
                                onTouchEnd={handleTouchEndCard}
                                onTouchCancel={handleTouchEndCard}
                                style={{
                                  top: `${topPx}px`,
                                  height: `${heightPx}px`,
                                  width: widthStyle,
                                  left: leftStyle,
                                  zIndex: zIndexVal,
                                  touchAction: 'none',
                                  userSelect: 'none',
                                  WebkitUserSelect: 'none'
                                }}
                                className={`absolute rounded-xl pointer-events-auto border overflow-hidden transition-all ${
                                  isCompactHabit ? 'px-2.5 py-0.5 flex items-center justify-between gap-2' : 'p-2 px-2.5 flex flex-col justify-between'
                                } shadow-xs select-none touch-none border-l-[4px] border-l-emerald-500 ${
                                  activeTouchDrag?.item?.id === habit.id
                                    ? 'opacity-40 ring-2 ring-emerald-500 scale-[0.98]'
                                    : isChecked
                                    ? 'bg-emerald-50/95 dark:bg-emerald-950/45 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300 opacity-85'
                                    : 'bg-emerald-50/80 dark:bg-emerald-950/35 hover:bg-emerald-50/95 dark:hover:bg-emerald-900/45 border-emerald-200/90 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                                } group`}
                              >
                                <div className="flex items-center justify-between gap-2 min-w-0 w-full">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onCheckInHabit?.(habit.id, colDate);
                                      }}
                                      className={`w-4 h-4 rounded-full flex items-center justify-center transition shrink-0 ${
                                        isChecked
                                          ? 'bg-emerald-600 text-white'
                                          : 'border-2 border-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-transparent'
                                      }`}
                                      title={isChecked ? 'Checked in! Click to uncheck' : 'Click to check in ritual'}
                                    >
                                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                                    </button>
                                    <span className="material-symbols-outlined text-[13px] text-emerald-600 dark:text-emerald-400 shrink-0">
                                      {habit.icon || 'cached'}
                                    </span>
                                    <span className={`text-[11.5px] font-bold truncate ${isChecked ? 'line-through text-emerald-700 dark:text-emerald-400' : 'text-emerald-950 dark:text-emerald-100'}`}>
                                      {habit.title}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[8.5px] font-bold uppercase tracking-wider shrink-0">
                                      Ritual
                                    </span>
                                  </div>

                                  {isCompactHabit && (
                                    <div className="flex items-center gap-2 shrink-0">
                                      {habit.linkedGoal && !hasOverlap && (
                                        <span className="text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[110px] hidden md:inline">
                                          ⚓ {habit.linkedGoal}
                                        </span>
                                      )}
                                      <span className="text-[9.5px] font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                                        {format12Hour(startMin)} – {format12Hour(endMin % 1440)}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {!isCompactHabit && (
                                  <div className="flex items-center justify-between gap-2 text-[10px] min-w-0 w-full">
                                    <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                                      {format12Hour(startMin)} – {format12Hour(endMin % 1440)} ({duration}m)
                                    </span>
                                    {habit.linkedGoal && (
                                      <span className="text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[120px] shrink-0">
                                        ⚓ {habit.linkedGoal}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Scratch Puzzle Snap Notch if continuous with next item */}
                                {hasSnapToNext && (
                                  <div
                                    className="absolute -bottom-1 left-8 w-5 h-1 rounded-b bg-emerald-300 dark:bg-emerald-700 pointer-events-none z-30"
                                    title="Puzzle snap flow"
                                  />
                                )}
                              </div>
                            );
                          }

                          // ── Type 3: Task Block ──
                          if (type !== 'task' || !task) return null;
                          const isFlexible = Boolean(task.isFlexible || task.durationMinutes === null);

                          const isBeingTransformed = transformState?.taskId === task.id;
                          const isSelectedForTransform = isEditorMode && selectedTransformTaskId === task.id;

                          const displayStartMin = isBeingTransformed ? transformState.currentStartMin : startMin;
                          const displayDuration = isBeingTransformed ? transformState.currentDuration : duration;
                          const displayEndMin = displayStartMin + displayDuration;

                          const topPx = isBeingTransformed
                            ? Math.max(0, ((displayStartMin - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT)
                            : (computedTopPx ?? Math.max(0, ((displayStartMin - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT));
                          const heightPx = isBeingTransformed
                            ? Math.max(34, (displayDuration / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT - 2)
                            : (isFlexible ? 34 : (computedHeightPx ?? Math.max(34, (displayDuration / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT - 2)));

                          const isLiveNow = isToday && (currentMinutesToday >= displayStartMin && currentMinutesToday <= displayEndMin);
                          const isHigh = task.priority === 'high' || task.impact === 'high';
                          const isLow = task.priority === 'low' || task.impact === 'low';

                          // Match life area for fine-tuned accents
                          const areaInfo = LIFE_AREAS.find(a =>
                            a.id === task.category ||
                            a.shortLabel.toLowerCase() === (task.category || '').toLowerCase() ||
                            (Array.isArray(task.areas) && task.areas.includes(a.id))
                          );

                          const areaBorderClass = areaInfo?.color === 'purple'
                            ? 'border-l-[4px] border-l-purple-500'
                            : areaInfo?.color === 'emerald'
                            ? 'border-l-[4px] border-l-emerald-500'
                            : areaInfo?.color === 'amber'
                            ? 'border-l-[4px] border-l-amber-500'
                            : areaInfo?.color === 'rose'
                            ? 'border-l-[4px] border-l-rose-500'
                            : areaInfo?.color === 'indigo'
                            ? 'border-l-[4px] border-l-indigo-500'
                            : 'border-l-[4px] border-l-[#0A84FF]';

                          // Distinct visual treatment for nested vs standard blocks
                          const cardAccent = isNested
                            ? `bg-white dark:bg-[#1A1C20] hover:bg-slate-50 dark:hover:bg-[#222429] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-white/10 shadow-xs ${areaBorderClass}`
                            : isHigh
                            ? 'bg-[#FFF5F5] dark:bg-rose-950/35 hover:bg-[#FFEBEB] dark:hover:bg-rose-900/35 text-[#7F1D1D] dark:text-rose-200 border-red-200 dark:border-rose-500/30 border-l-[4px] border-l-red-500'
                            : isLow
                            ? 'bg-[#F0FDF4] dark:bg-emerald-950/35 hover:bg-[#DCFCE7] dark:hover:bg-emerald-900/35 text-[#064E3B] dark:text-emerald-200 border-emerald-200 dark:border-emerald-500/30 border-l-[4px] border-l-emerald-500'
                            : 'bg-[#F0F7FF] dark:bg-[#0A84FF]/15 hover:bg-[#E5F1FF] dark:hover:bg-[#0A84FF]/25 text-[#0C4A6E] dark:text-blue-200 border-blue-200 dark:border-blue-500/30 border-l-[4px] border-l-[#0A84FF]';

                          const timeStr = isFlexible && !isBeingTransformed ? format12Hour(displayStartMin) : `${format12Hour(displayStartMin)} – ${format12Hour(displayEndMin % 1440)}`;
                          const matchedGoal = goals.find(g => g.id === task.goalId);
                          const isTaskDone = isTaskCompletedForDate(task, colDate);

                          // Card size tiers
                          const isUltraCompact = heightPx < 48;
                          const isCompact = heightPx >= 48 && heightPx < 78;
                          const isSpacious = heightPx >= 110;

                          return (
                            <div
                              key={task.id}
                              onClick={(e) => {
                                if (didJustDragRef.current) return;
                                if (isEditorMode) {
                                  e.stopPropagation();
                                  if (e.ctrlKey || e.metaKey || isEditorMode) {
                                    setSelectedTransformTaskId(prev => prev === task.id ? null : task.id);
                                  }
                                  return;
                                }
                                e.stopPropagation();
                                setEditingTask(task);
                              }}
                              onTouchStart={(e) => {
                                if (e.target.closest('button') || e.target.closest('[data-resize-handle="true"]')) return;
                                handleTouchStartCard('task', task, e);
                              }}
                              onTouchMove={handleTouchMoveCard}
                              onTouchEnd={handleTouchEndCard}
                              onTouchCancel={handleTouchEndCard}
                              onMouseDown={(e) => {
                                if (isEditorMode && isSelectedForTransform) {
                                  if (e.target.closest('button') || e.target.closest('[data-resize-handle="true"]')) return;
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setTransformState({
                                    taskId: task.id,
                                    mode: 'move',
                                    startY: e.clientY,
                                    origStartMin: startMin,
                                    origDuration: duration,
                                    currentStartMin: startMin,
                                    currentDuration: duration,
                                    task
                                  });
                                }
                              }}
                              style={{
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                                width: widthStyle,
                                left: leftStyle,
                                zIndex: isSelectedForTransform ? 60 : zIndexVal,
                                cursor: isSelectedForTransform ? 'move' : isEditorMode ? 'pointer' : 'pointer',
                                touchAction: 'none',
                                userSelect: 'none',
                                WebkitUserSelect: 'none'
                              }}
                              className={`absolute rounded-xl pointer-events-auto overflow-hidden transition-all select-none touch-none ${
                                activeTouchDrag?.item?.id === task.id
                                  ? 'opacity-40 ring-2 ring-[#0A84FF] scale-[0.98]'
                                  : isSelectedForTransform
                                  ? 'ring-2 ring-[#0A84FF] shadow-[0_0_0_2px_rgba(10,132,255,0.4),0_12px_32px_rgba(0,0,0,0.18)] z-40'
                                  : isEditorMode
                                  ? 'hover:ring-1 hover:ring-amber-400 hover:shadow-md'
                                  : 'hover:shadow-md hover:z-35'
                              } group border ${cardAccent} ${
                                isUltraCompact
                                  ? 'px-2.5 py-0.5 flex items-center justify-between gap-2'
                                  : isCompact
                                  ? 'p-2 px-2.5 flex flex-col justify-between'
                                  : 'p-2.5 px-3 flex flex-col justify-between'
                              } ${isTaskDone ? 'opacity-60 grayscale-[30%]' : ''}`}
                            >
                              {/* Tier 0: Ultra-Compact Single Row (< 48px height, e.g. 20m-30m tasks) */}
                              {isUltraCompact ? (
                                <div className="flex items-center justify-between gap-2 min-w-0 w-full">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleTask?.(task.id, colDate);
                                      }}
                                      className="text-inherit opacity-75 hover:opacity-100 transition shrink-0"
                                    >
                                      {isTaskDone ? (
                                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                      ) : (
                                        <Square className="w-3.5 h-3.5 text-slate-400 hover:text-[#0A84FF]" />
                                      )}
                                    </button>

                                    {isLiveNow && !isTaskDone && (
                                      <span className="px-1 py-0.2 rounded bg-red-500 text-white text-[8px] font-black uppercase tracking-wider shrink-0">
                                        NOW
                                      </span>
                                    )}

                                    <span className={`text-[11.5px] font-bold tracking-tight truncate text-slate-900 dark:text-slate-100 ${isTaskDone ? 'line-through opacity-65' : ''}`}>
                                      {task.title}
                                    </span>

                                    {areaInfo && !hasOverlap && (
                                      <span className={`hidden sm:inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${areaInfo.badgeClass} shrink-0`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${areaInfo.dotClass}`} />
                                        {areaInfo.shortLabel}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-mono font-semibold text-[9.5px] text-slate-600 dark:text-slate-300">
                                      {timeStr}
                                    </span>
                                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                                      {!isTaskDone && onStartFocus && (
                                        <button
                                          type="button"
                                          title="Start Focus"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onStartFocus(task.id);
                                          }}
                                          className="p-0.5 rounded bg-white dark:bg-[#202227] text-[#0A84FF] shadow-2xs"
                                        >
                                          <Play className="w-3 h-3 fill-current" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        title={task.recurrence && task.recurrence !== 'none' ? 'Delete recurring event' : 'Unslot back to tray'}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (task.recurrence && task.recurrence !== 'none') {
                                            setRecurringDeleteTarget({ task, date: colDate });
                                          } else {
                                            handleUnslotTask(task.id);
                                          }
                                        }}
                                        className="p-0.5 rounded bg-white dark:bg-[#202227] text-slate-500 hover:text-red-500 shadow-2xs"
                                      >
                                        {task.recurrence && task.recurrence !== 'none' ? (
                                          <Trash2 className="w-3 h-3" />
                                        ) : (
                                          <X className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : isCompact ? (
                                /* Tier 1: Compact 2-Row View (48px - 77px height, e.g. 45m tasks) */
                                <div className="flex flex-col justify-between h-full min-w-0">
                                  {/* Row 1: Checkbox + Bold Title + Badges + Quick Actions */}
                                  <div className="flex items-center justify-between gap-2 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onToggleTask?.(task.id, colDate);
                                        }}
                                        className="text-inherit opacity-75 hover:opacity-100 transition shrink-0"
                                      >
                                        {isTaskDone ? (
                                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                                        ) : (
                                          <Square className="w-4 h-4 text-slate-400 hover:text-[#0A84FF]" />
                                        )}
                                      </button>

                                      {isLiveNow && !isTaskDone && (
                                        <span className="px-1 py-0.2 rounded bg-red-500 text-white text-[8px] font-black uppercase tracking-wider shrink-0">
                                          NOW
                                        </span>
                                      )}

                                      {/* Main Task Title - bold & high contrast */}
                                      <span className={`text-[12px] font-bold tracking-tight truncate text-slate-900 dark:text-slate-100 ${isTaskDone ? 'line-through opacity-60' : ''}`}>
                                        {task.title}
                                      </span>

                                      {areaInfo && (
                                        <span className={`hidden sm:inline-flex items-center gap-1 text-[8.5px] font-bold px-1.5 py-0.2 rounded-full border ${areaInfo.badgeClass} shrink-0`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${areaInfo.dotClass}`} />
                                          {areaInfo.shortLabel}
                                        </span>
                                      )}
                                    </div>

                                    {/* Action buttons on hover */}
                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {!isTaskDone && onStartFocus && (
                                        <button
                                          type="button"
                                          title="Start Focus"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onStartFocus(task.id);
                                          }}
                                          className="p-0.5 rounded bg-white dark:bg-[#202227] text-[#0A84FF] shadow-xs hover:scale-105 transition"
                                        >
                                          <Play className="w-3 h-3 fill-current" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        title={task.recurrence && task.recurrence !== 'none' ? 'Delete recurring event' : 'Unslot back to tray'}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (task.recurrence && task.recurrence !== 'none') {
                                            setRecurringDeleteTarget({ task, date: colDate });
                                          } else {
                                            handleUnslotTask(task.id);
                                          }
                                        }}
                                        className="p-0.5 rounded bg-white dark:bg-[#202227] text-slate-500 dark:text-slate-400 hover:text-red-500 shadow-xs hover:scale-105 transition"
                                      >
                                        {task.recurrence && task.recurrence !== 'none' ? (
                                          <Trash2 className="w-3 h-3" />
                                        ) : (
                                          <X className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Row 2: Time + Duration + Goal pill */}
                                  <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 dark:text-slate-400 min-w-0">
                                    <span className="font-mono font-semibold text-[9.5px] text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-white/10 px-1.5 py-0.2 rounded border border-slate-200/50 dark:border-white/10 shrink-0">
                                      {timeStr}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded bg-black/[0.04] dark:bg-white/10 font-bold text-[9px] text-slate-600 dark:text-slate-300 shrink-0">
                                      {formatDurationLabel(duration)}
                                    </span>
                                    {task.recurrence && task.recurrence !== 'none' && (
                                      <span className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-1 py-0.2 rounded border border-teal-200/50 dark:border-teal-500/30 shrink-0" title={`Repeats ${task.recurrence}`}>
                                        <Repeat className="w-2.5 h-2.5" />
                                        <span className="capitalize">{task.recurrence}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                /* Tier 2 & 3: Medium & Spacious View */
                                <>
                                  {/* Top Bar: Checkbox + Title + Actions */}
                                  <div>
                                    <div className="flex items-start justify-between gap-2 overflow-hidden">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleTask?.(task.id, colDate);
                                          }}
                                          className="text-inherit opacity-75 hover:opacity-100 transition shrink-0"
                                        >
                                          {isTaskDone ? (
                                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                                          ) : (
                                            <Square className="w-4 h-4 text-slate-400 hover:text-[#0A84FF]" />
                                          )}
                                        </button>

                                        {isLiveNow && !isTaskDone && (
                                          <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[8px] font-black uppercase tracking-wider animate-pulse shrink-0">
                                            NOW
                                          </span>
                                        )}

                                        <span className={`text-[13px] font-bold tracking-tight truncate text-slate-900 dark:text-slate-100 ${isTaskDone ? 'line-through opacity-70' : ''}`}>
                                          {task.title}
                                        </span>

                                        {task.impact && (
                                          <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-white/70 dark:bg-white/10 opacity-80 shrink-0">
                                            {task.impact}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!isTaskDone && onStartFocus && (
                                          <button
                                            type="button"
                                            title="Start 25m Focus Block"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onStartFocus(task.id);
                                            }}
                                            className="p-1 rounded-md bg-white dark:bg-[#202227] text-[#0A84FF] shadow-xs hover:scale-105 transition"
                                          >
                                            <Play className="w-3.5 h-3.5 fill-current" />
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          title={task.recurrence && task.recurrence !== 'none' ? 'Delete recurring event' : 'Unslot back to tray'}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (task.recurrence && task.recurrence !== 'none') {
                                              setRecurringDeleteTarget({ task, date: colDate });
                                            } else {
                                              handleUnslotTask(task.id);
                                            }
                                          }}
                                          className="p-1 rounded-md bg-white dark:bg-[#202227] text-slate-500 dark:text-slate-400 hover:text-red-500 shadow-xs hover:scale-105 transition"
                                        >
                                          {task.recurrence && task.recurrence !== 'none' ? (
                                            <Trash2 className="w-3.5 h-3.5" />
                                          ) : (
                                            <X className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Focus Window Indicator for Container Tasks */}
                                    {hasNestedChildren && (
                                      <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-red-900/80 dark:text-red-200/90 bg-red-100/50 dark:bg-red-950/40 border border-red-200/50 dark:border-red-500/30 rounded-md px-2 py-0.5 mt-1.5 w-fit">
                                        <Layers className="w-3 h-3" />
                                        <span>Focus Window (Contains sub-blocks)</span>
                                        {task.notes && <span className="opacity-75">• Notes attached</span>}
                                      </div>
                                    )}
                                  </div>

                                  {/* Middle: Notes & Subtasks (Only when spacious AND NOT housing nested children to prevent collisions) */}
                                  {isSpacious && !hasNestedChildren && (
                                    <div className="space-y-1.5 my-1 overflow-hidden">
                                      {task.notes && (
                                        <p className="text-[11px] opacity-80 line-clamp-2 leading-relaxed">
                                          {task.notes}
                                        </p>
                                      )}

                                      {Array.isArray(task.subtasks) && task.subtasks.length > 0 && (
                                        <div className="space-y-0.5">
                                          {task.subtasks.slice(0, 2).map(st => (
                                            <div
                                              key={st.id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleSubtask?.(task.id, st.id);
                                              }}
                                              className="flex items-center gap-1.5 text-[10px] opacity-85 hover:opacity-100 transition"
                                            >
                                              {st.completed ? (
                                                <CheckSquare className="w-3 h-3 text-emerald-600" />
                                              ) : (
                                                <Square className="w-3 h-3 text-slate-400" />
                                              )}
                                              <span className={st.completed ? 'line-through opacity-60' : ''}>{st.title}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Footer: Time & Duration & Goal link */}
                                  <div className="flex items-center justify-between text-[10px] font-medium opacity-90 mt-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-semibold">{timeStr}</span>
                                      <span className="px-1.5 py-0.2 rounded bg-white/70 dark:bg-white/10 font-bold text-[9px]">
                                        {formatDurationLabel(duration)}
                                      </span>
                                      {task.recurrence && task.recurrence !== 'none' && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-white/80 dark:bg-white/10 font-bold text-[9px] text-teal-800 dark:text-teal-200 border border-teal-200/60 dark:border-teal-500/30" title={`Repeats ${task.recurrence}`}>
                                          <Repeat className="w-2.5 h-2.5" />
                                          <span className="capitalize">{task.recurrence}</span>
                                        </span>
                                      )}
                                      {matchedGoal && (
                                        <span className="hidden md:inline-flex items-center gap-1 text-[9px] font-semibold bg-white/60 dark:bg-white/10 px-1.5 py-0.2 rounded">
                                          <Flag className="w-2.5 h-2.5" />
                                          <span className="truncate max-w-[120px]">{matchedGoal.title}</span>
                                        </span>
                                      )}
                                    </div>

                                    {Array.isArray(task.subtasks) && task.subtasks.length > 0 && (
                                      <span className="flex items-center gap-1 text-[9px] font-semibold bg-white/70 dark:bg-white/10 px-1.5 py-0.2 rounded">
                                        <ListChecks className="w-3 h-3" />
                                        <span>
                                          {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}

                              {/* ── Vector Shape Transform Handles (Editor Mode) ── */}
                              {isSelectedForTransform && (
                                <>
                                  {/* Top Resize Handle (adjust start time) */}
                                  <div
                                    data-resize-handle="true"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setTransformState({
                                        taskId: task.id,
                                        mode: 'resize-top',
                                        startY: e.clientY,
                                        origStartMin: startMin,
                                        origDuration: duration,
                                        currentStartMin: startMin,
                                        currentDuration: duration,
                                        task
                                      });
                                    }}
                                    className="absolute -top-2 inset-x-2 h-4 flex items-center justify-center cursor-row-resize z-50 group/topH"
                                    title="Drag up/down to adjust start time"
                                  >
                                    <div className="w-12 h-1.5 rounded-full bg-[#0A84FF] shadow-md group-hover/topH:scale-y-150 transition-transform" />
                                  </div>

                                  {/* Bottom Resize Handle (stretch duration) */}
                                  <div
                                    data-resize-handle="true"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setTransformState({
                                        taskId: task.id,
                                        mode: 'resize-bottom',
                                        startY: e.clientY,
                                        origStartMin: startMin,
                                        origDuration: duration,
                                        currentStartMin: startMin,
                                        currentDuration: duration,
                                        task
                                      });
                                    }}
                                    className="absolute -bottom-2 inset-x-2 h-4 flex items-center justify-center cursor-row-resize z-50 group/botH"
                                    title="Drag down/up to adjust duration"
                                  >
                                    <div className="w-12 h-1.5 rounded-full bg-[#0A84FF] shadow-md group-hover/botH:scale-y-150 transition-transform" />
                                  </div>

                                  {/* 4 Vector Corner Square Handles */}
                                  <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-[#0A84FF] rounded-xs shadow-xs pointer-events-none z-50" />
                                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-[#0A84FF] rounded-xs shadow-xs pointer-events-none z-50" />
                                  <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-[#0A84FF] rounded-xs shadow-xs pointer-events-none z-50" />
                                  <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-[#0A84FF] rounded-xs shadow-xs pointer-events-none z-50" />

                                  {/* Live Floating HUD Badge */}
                                  {isBeingTransformed && (
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-mono text-[10.5px] font-bold shadow-xl pointer-events-none z-50 whitespace-nowrap flex items-center gap-1.5 border border-white/20 animate-fadeIn">
                                      {transformState.mode === 'move' ? (
                                        <Move className="w-3 h-3 text-amber-400" />
                                      ) : (
                                        <Maximize2 className="w-3 h-3 text-amber-400" />
                                      )}
                                      <span>
                                        {format12Hour(displayStartMin)} – {format12Hour(displayEndMin % 1440)} ({displayDuration}m)
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Task Edit Detail Modal */}
      {editingTask && (
        <TaskDetailModal
          task={editingTask}
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          goals={goals}
          habits={habits}
          onStartFocus={onStartFocus}
        />
      )}

      {/* Schedule Detail Edit Modal */}
      {editingSchedule && (
        <ScheduleDetailModal
          schedule={editingSchedule}
          isOpen={Boolean(editingSchedule)}
          onClose={() => setEditingSchedule(null)}
          onUpdateSchedule={onUpdateSchedule}
          onDeleteSchedule={onDeleteSchedule}
        />
      )}

      {/* Delete Recurring Event Modal */}
      {recurringDeleteTarget && (
        <DeleteRecurringModal
          isOpen={Boolean(recurringDeleteTarget)}
          task={recurringDeleteTarget.task}
          targetDate={recurringDeleteTarget.date}
          onClose={() => setRecurringDeleteTarget(null)}
          onConfirm={({ mode, targetDate }) => {
            onDeleteTask?.(recurringDeleteTarget.task.id, { mode, targetDate });
            setRecurringDeleteTarget(null);
          }}
        />
      )}

      {/* Habit Detail / Edit Modal */}
      <HabitModal
        isOpen={isHabitModalOpen}
        onClose={() => {
          setIsHabitModalOpen(false);
          setEditingHabit(null);
        }}
        habit={editingHabit}
        onSave={(data) => {
          if (editingHabit && editingHabit.id) {
            onUpdateHabit?.(editingHabit.id, data);
          } else {
            onAddHabit?.(data);
          }
          setIsHabitModalOpen(false);
          setEditingHabit(null);
        }}
        onDelete={editingHabit ? (id) => {
          onDeleteHabit?.(id);
          setIsHabitModalOpen(false);
          setEditingHabit(null);
        } : undefined}
        goals={goals}
      />

      {/* Multi-Select Batch Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBatchDeleteConfirm}
        title={`Delete ${activeSelectionCount} ${trayFilterMode === 'schedules' ? (activeSelectionCount === 1 ? 'Schedule' : 'Schedules') : (activeSelectionCount === 1 ? 'Task' : 'Tasks')}?`}
        message={`Are you sure you want to delete these ${activeSelectionCount} selected items? You will be able to undo this deletion with 1-click immediately.`}
        confirmText={`Delete ${activeSelectionCount}`}
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleExecuteBatchDelete}
        onCancel={() => setShowBatchDeleteConfirm(false)}
      />

      {/* Single Delete Confirmation Modal */}
      {singleDeleteTarget && (
        <ConfirmModal
          isOpen={Boolean(singleDeleteTarget)}
          title="Delete Item?"
          message={`Are you sure you want to delete "${singleDeleteTarget?.title}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          isDanger={true}
          onConfirm={() => {
            if (singleDeleteTarget.type === 'schedule') {
              onDeleteSchedule?.(singleDeleteTarget.id);
            }
            setSingleDeleteTarget(null);
          }}
          onCancel={() => setSingleDeleteTarget(null)}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          MOBILE ONLY: FLOATING CIRCULAR TASK TRAY / CALENDAR BUTTON (BOTTOM RIGHT)
         ══════════════════════════════════════════════════════ */}
      <button
        type="button"
        onClick={() => {
          setIsMobileQuickTrayOpen(false);
          setMobileTab(prev => (prev === 'timeline' ? 'tray' : 'timeline'));
        }}
        className="lg:hidden fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-30 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer bg-[#0A84FF] text-white shadow-[0_8px_24px_rgba(10,132,255,0.5)] hover:bg-[#0071E3]"
        aria-label={mobileTab === 'timeline' ? 'Open Task Tray' : 'View Calendar Timeline'}
        title={mobileTab === 'timeline' ? 'Go to Task Tray' : 'Back to Calendar Timeline'}
      >
        {mobileTab === 'timeline' ? (
          <Inbox className="w-5 h-5 transition-transform" />
        ) : (
          <Calendar className="w-5 h-5 transition-transform" />
        )}
      </button>

      
      {/* ══════════════════════════════════════════════════════
          MOBILE QUICK TRAY DRAWER (slide-up when on timeline)
          Drag unscheduled tasks directly onto calendar from here
         ══════════════════════════════════════════════════════ */}
      {mobileTab === 'timeline' && isMobileQuickTrayOpen && !activeTouchDrag && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 animate-slideUp"
          style={{ maxHeight: '55vh' }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 -top-screen bg-black/20 backdrop-blur-[1px]"
            onClick={() => setIsMobileQuickTrayOpen(false)}
            style={{ top: '-100vh' }}
          />
          {/* Drawer panel */}
          <div className="relative bg-white rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.18)] border-t border-black/[0.06] flex flex-col overflow-hidden"
            style={{ maxHeight: '55vh' }}
          >
            {/* Drag handle */}
            <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-black/15" />
            </div>
            {/* Header */}
            <div className="px-4 pb-2 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[#0A84FF]" />
                <span className="text-[13px] font-bold text-[#1A1B1F]">Quick Drag to Calendar</span>
                <span className="px-2 py-0.5 rounded-full bg-[#F5F4FA] text-[#64748B] text-[10px] font-bold">
                  {unscheduledTasks.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileQuickTrayOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#F5F4FA] transition text-[#64748B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Hint */}
            <div className="px-4 pb-2 shrink-0">
              <p className="text-[10px] text-[#64748B] flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-[#0A84FF]">touch_app</span>
                Hold any card 0.2s, then drag onto a time slot above to schedule it.
              </p>
            </div>
            {/* Task list */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 min-h-0">
              {unscheduledTasks.length === 0 ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-[11px] font-semibold text-[#1A1B1F]">All tasks scheduled!</p>
                </div>
              ) : (
                unscheduledTasks.map(task => {
                  const impactDot =
                    task.impact === 'high' || task.priority === 'high'
                      ? 'bg-red-500'
                      : task.impact === 'low'
                      ? 'bg-emerald-500'
                      : 'bg-amber-400';
                  return (
                    <div
                      key={`qt-${task.id}`}
                      onTouchStart={(e) => handleTouchStartCard('task', task, e)}
                      onTouchMove={handleTouchMoveCard}
                      onTouchEnd={handleTouchEndCard}
                      onTouchCancel={handleTouchEndCard}
                      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#FAFAFC] border border-black/[0.06] cursor-grab active:cursor-grabbing select-none touch-none active:ring-2 active:ring-[#0A84FF] active:bg-blue-50/60 transition-all"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${impactDot}`} />
                      <span className="text-[12px] font-semibold text-[#1A1B1F] truncate flex-1">{task.title}</span>
                      {task.durationMinutes && (
                        <span className="text-[10px] font-mono text-[#64748B] shrink-0">{task.durationMinutes}m</span>
                      )}
                      <span className="material-symbols-outlined text-[16px] text-[#94A3B8] shrink-0">drag_indicator</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          FLOATING THUMB PILL (FOLLOWS USER'S THUMB DURING DRAG)
         ══════════════════════════════════════════════════════ */}
      {activeTouchDrag && (
        <div
          style={{
            position: 'fixed',
            left: `${activeTouchDrag.currentX}px`,
            top: `${activeTouchDrag.currentY}px`,
            transform: 'translate(-50%, -130%)',
            pointerEvents: 'none',
            zIndex: 9999
          }}
          className="px-3.5 py-2 rounded-2xl bg-[#0A84FF] text-white shadow-[0_16px_36px_rgba(10,132,255,0.5)] border border-white/40 flex items-center gap-2 text-xs font-bold select-none whitespace-nowrap animate-thumbScaleIn"
        >
          <span className="material-symbols-outlined text-[16px] animate-pulse">touch_app</span>
          <span className="truncate max-w-[150px]">{activeTouchDrag.item.title}</span>
          <span className="px-1.5 py-0.5 rounded-lg bg-black/25 text-[10px] font-mono font-bold">
            {formatTimeString(activeTouchDrag.targetHour)}
          </span>
        </div>
      )}
    </main>
  );
});

export default TodayView;
