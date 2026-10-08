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
import DeleteRecurringModal from '../components/DeleteRecurringModal';
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
  isTaskScheduledForDate
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
const HOUR_HEIGHT = 64; // 64px per hour: sleek density & pixel-perfect 16px/15min snapping
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 1536px full day height



const TodayView = React.memo(function TodayView({
  tasks = [],
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onToggleSubtask,
  onOpenQuickAdd,
  goals = [],
  habits = [],
  schedules = [],
  onUpdateSchedule,
  onAddSchedule,
  onDeleteSchedule,
  onStartFocus,
  onCheckInHabit
}) {
  const [viewDate, setViewDate] = useState(() => todayPlanDate());
  const [scope, setScope] = useState('day'); // 'day' | '3day' | 'week'
  const [mobileTab, setMobileTab] = useState('tray'); // 'tray' | 'timeline'
  const [trayFilterMode, setTrayFilterMode] = useState('unscheduled'); // Default to unscheduled to eliminate duplicates
  const [trayAreaFilter, setTrayAreaFilter] = useState('all');
  const [traySearch, setTraySearch] = useState('');
  const [newTrayTaskTitle, setNewTrayTaskTitle] = useState('');
  const [activeSlotMenuTaskId, setActiveSlotMenuTaskId] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null); // { date, hour }
  const [editingTask, setEditingTask] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [recurringDeleteTarget, setRecurringDeleteTarget] = useState(null); // { task, date }
  const [currentTime, setCurrentTime] = useState(() => new Date());

  /* ── Canvas Editor Mode & Vector Shape Transform States ── */
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [selectedTransformTaskId, setSelectedTransformTaskId] = useState(null);
  const [transformState, setTransformState] = useState(null);
  const transformRef = useRef(null);
  const calendarScrollRef = useRef(null);

  // Smart auto-scroll: centers around current time or 8 AM waking window
  const scrollToNow = useCallback((smooth = true) => {
    if (!calendarScrollRef.current) return;
    const now = new Date();
    const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
    const timeTop = (currentMinutesToday / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT;
    // Position current time ~70px from top so current and upcoming tasks are in prime view
    const targetScroll = Math.max(0, Math.round(timeTop - 70));

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

  const handleUnslotTask = (taskId) => {
    onUpdateTask(taskId, {
      startTime: null,
      endTime: null
    });
  };

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

  /* ── Multi-Column Memoized Layout Generator (O(C * N^2) isolated to data changes) ── */
  const columnsData = useMemo(() => {
    const today = todayPlanDate();
    return columnDates.map(colDate => {
      const isToday = colDate === today;
      const headerInfo = formatDateHeader(colDate);

      // Separate raw scheduled tasks in single pass
      const colTasks = [];
      const rawScheduled = [];
      let colMins = 0;

      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        if (isTaskScheduledForDate(t, colDate) && t.startTime) {
          if (!t.completed) {
            colTasks.push(t);
            let dur = Number(t.durationMinutes);
            if (!dur || isNaN(dur)) {
              if (t.startTime && t.endTime) {
                const diff = calculateDuration(t.startTime, t.endTime);
                if (diff > 0) dur = diff;
              }
            }
            if (!dur || isNaN(dur)) dur = 45;
            colMins += dur;
          }
          const sm = minutesFromStartOfDay(t.startTime);
          if (sm !== null) {
            let dur = Number(t.durationMinutes);
            if (!dur || isNaN(dur)) {
              if (t.startTime && t.endTime) {
                const diff = calculateDuration(t.startTime, t.endTime);
                if (diff > 0) dur = diff;
              }
            }
            if (!dur || isNaN(dur)) dur = 45;
            rawScheduled.push({ task: t, startMin: sm, endMin: sm + dur, duration: dur });
          }
        }
      }

      rawScheduled.sort((a, b) => a.startMin - b.startMin || b.duration - a.duration);

      // Detect nested containment
      const scheduledWithNesting = rawScheduled.map(item => {
        const containers = rawScheduled.filter(other =>
          other.task.id !== item.task.id &&
          other.duration >= item.duration + 20 &&
          item.startMin >= other.startMin - 2 &&
          item.endMin <= other.endMin + 5
        );
        containers.sort((a, b) => a.duration - b.duration);
        const container = containers[0] || null;
        return {
          ...item,
          containerId: container ? container.task.id : null,
          containerTask: container ? container.task : null,
          isNested: Boolean(container)
        };
      });

      const parentContainerIds = new Set(
        scheduledWithNesting.filter(it => it.isNested).map(it => it.containerId)
      );

      const topLevel = scheduledWithNesting
        .filter(it => !it.isNested)
        .map(it => ({ ...it, hasNestedChildren: parentContainerIds.has(it.task.id) }));

      const topLevelWithLanes = topLevel.map(item => ({ ...item, lane: 0, totalLanes: 1 }));
      for (let i = 0; i < topLevelWithLanes.length; i++) {
        for (let j = 0; j < i; j++) {
          if (topLevelWithLanes[i].startMin < topLevelWithLanes[j].endMin && topLevelWithLanes[i].endMin > topLevelWithLanes[j].startMin) {
            if (topLevelWithLanes[i].lane === topLevelWithLanes[j].lane) {
              topLevelWithLanes[i].lane = topLevelWithLanes[j].lane + 1;
            }
            const lanes = Math.max(topLevelWithLanes[i].lane, topLevelWithLanes[j].lane) + 1;
            topLevelWithLanes[i].totalLanes = Math.max(topLevelWithLanes[i].totalLanes, lanes);
            topLevelWithLanes[j].totalLanes = Math.max(topLevelWithLanes[j].totalLanes, lanes);
          }
        }
      }

      const nested = scheduledWithNesting.filter(it => it.isNested);
      const nestedWithLanes = nested.map(item => ({ ...item, nestedLane: 0, nestedTotalLanes: 1 }));
      for (let i = 0; i < nestedWithLanes.length; i++) {
        for (let j = 0; j < i; j++) {
          if (nestedWithLanes[i].containerId === nestedWithLanes[j].containerId) {
            if (nestedWithLanes[i].startMin < nestedWithLanes[j].endMin && nestedWithLanes[i].endMin > nestedWithLanes[j].startMin) {
              if (nestedWithLanes[i].nestedLane === nestedWithLanes[j].nestedLane) {
                nestedWithLanes[i].nestedLane = nestedWithLanes[j].nestedLane + 1;
              }
              const lanes = Math.max(nestedWithLanes[i].nestedLane, nestedWithLanes[j].nestedLane) + 1;
              nestedWithLanes[i].nestedTotalLanes = Math.max(nestedWithLanes[i].nestedTotalLanes, lanes);
              nestedWithLanes[j].nestedTotalLanes = Math.max(nestedWithLanes[j].nestedTotalLanes, lanes);
            }
          }
        }
      }

      const colScheduled = [...topLevelWithLanes, ...nestedWithLanes];

      return {
        colDate,
        isToday,
        headerInfo,
        colMins,
        colScheduled
      };
    });
  }, [tasks, columnDates]);

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
  const startDayMinutes = START_HOUR * 60;
  const currentMinutesToday = currentTime.getHours() * 60 + currentTime.getMinutes();
  const isTimeInView = currentMinutesToday >= startDayMinutes && currentMinutesToday <= END_HOUR * 60;
  const currentTimeTop = isTimeInView
    ? ((currentMinutesToday - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT
    : null;

  /* ── Next Task Arriving on Calendar (for compact Header badge) ── */
  const upNextTask = useMemo(() => {
    const todayBlocks = tasks
      .filter(t => !t.completed && isTaskScheduledForDate(t, viewDate) && t.startTime)
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
    <main className="w-full min-h-screen bg-[#F8F8FC] pt-16 md:pt-12 px-3 sm:px-6 md:px-margin-desktop py-3 sm:py-6 text-[#1A1B1F] select-none">
      <div className="w-full max-w-[1440px] mx-auto flex flex-col gap-3 sm:gap-4 min-w-0">

        {/* ── TOP HERO CONTROL BAR ── */}
        <div className="w-full min-w-0 flex flex-col gap-2.5 p-3 sm:p-4 rounded-2xl bg-white border border-black/[0.06] shadow-2xs">
          {/* Top Row: Navigation, Date, Capacity, Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap min-w-0 w-full">
            {/* Left: Navigation & Date Range */}
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="flex items-center gap-0.5 bg-[#F5F4FA] p-0.5 sm:p-1 rounded-xl border border-black/[0.04] shrink-0">
                <button
                  type="button"
                  onClick={handlePrev}
                  title="Previous Day"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#1A1B1F] hover:bg-white transition active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  title="Next Day"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#1A1B1F] hover:bg-white transition active:scale-95"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 truncate">
                <h1 className="text-[13.5px] sm:text-[17px] font-bold tracking-tight text-[#1A1B1F] truncate">
                  <span className="hidden sm:inline">{viewRangeTitle.main}</span>
                  <span className="inline sm:hidden">{viewRangeTitle.short}</span>
                </h1>
                {viewRangeTitle.isToday ? (
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-bold bg-blue-50 text-[#0A84FF] border border-blue-200/80 uppercase tracking-wider shrink-0">
                    Today
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleToday}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-[#0A84FF] hover:bg-blue-100 border border-blue-200/80 transition active:scale-95 shrink-0 shadow-3xs"
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
                  className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50/90 text-amber-950 border border-amber-200/70 text-[11px] font-medium cursor-pointer hover:bg-amber-100 transition shadow-2xs"
                  title="Click to view next upcoming task"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-bold text-amber-900">Next:</span>
                  <span className="truncate max-w-[150px] font-semibold">{upNextTask.title}</span>
                  <span className="font-mono text-amber-800 font-bold">({upNextTask.startTime})</span>
                </div>
              )}
            </div>

            {/* Right: Workload, Scope (Desktop), Editor & Quick Add */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Workload Capacity Meter */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-[#F5F4FA] border border-black/[0.04] text-[11px]">
                <Timer className="w-3.5 h-3.5 text-[#0A84FF]" />
                <div className="flex flex-col min-w-[110px]">
                  <div className="flex items-center justify-between text-[9.5px] font-semibold text-[#64748B]">
                    <span>{(totalScheduledMinutesInView / 60).toFixed(1)}h / {(targetMinutesInView / 60).toFixed(0)}h</span>
                    <span className={capacityPercent > 90 ? 'text-red-600 font-bold' : capacityPercent > 65 ? 'text-amber-600' : 'text-[#0A84FF]'}>
                      {capacityPercent > 90 ? 'Full' : capacityPercent > 65 ? 'Balanced' : 'Light'}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-black/[0.06] rounded-full overflow-hidden mt-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        capacityPercent > 90 ? 'bg-red-500' : capacityPercent > 65 ? 'bg-amber-500' : 'bg-[#0A84FF]'
                      }`}
                      style={{ width: `${capacityPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Jump to Current Time Button (Desktop) */}
              <button
                type="button"
                onClick={() => scrollToNow(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-[#F5F4FA] hover:bg-white text-[#64748B] hover:text-red-500 border border-black/[0.04] shadow-3xs transition active:scale-95"
                title="Center view vertically around current time red line"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>Now</span>
              </button>

              {/* Scope Switcher (Desktop) */}
              <div className="hidden lg:flex items-center p-0.5 rounded-xl bg-[#F5F4FA] border border-black/[0.04]">
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
                      className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition ${
                        isSelected
                          ? 'bg-white text-[#0A84FF] shadow-xs'
                          : 'text-[#64748B] hover:text-[#1A1B1F]'
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
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition active:scale-[0.98] ${
                  isEditorMode
                    ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                    : 'bg-white text-[#64748B] hover:text-[#1A1B1F] border border-black/[0.08] hover:bg-[#F5F4FA]'
                }`}
                title={isEditorMode ? 'Exit Editor Mode' : 'Toggle Editor Mode: Drag and resize blocks like vector shapes'}
              >
                {isEditorMode ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                <span>{isEditorMode ? 'Save & Done' : 'Editor'}</span>
              </button>

              {/* Quick Add Button (Desktop only, mobile uses bottom nav circular CTA) */}
              <button
                type="button"
                onClick={() => onOpenQuickAdd?.()}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A84FF] text-white text-[12px] font-semibold hover:bg-[#0071E3] transition shadow-xs active:scale-[0.98] shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Task</span>
              </button>
            </div>
          </div>

          {/* Mobile Scope Row (only when viewing Calendar Timeline: lg:hidden) */}
          {mobileTab === 'timeline' && (
            <div className="flex lg:hidden items-center justify-between gap-2 pt-2 border-t border-black/[0.04] w-full min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#1A1B1F]">
                <Calendar className="w-3.5 h-3.5 text-[#0A84FF]" />
                <span>Calendar Timeline</span>
                <span className="text-[10px] text-[#8E8E93] font-normal">• {(totalScheduledMinutesInView / 60).toFixed(1)}h slotted</span>
              </div>
              <div className="flex items-center p-0.5 rounded-xl bg-[#F5F4FA] border border-black/[0.04]">
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
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                        isSelected
                          ? 'bg-white text-[#0A84FF] shadow-xs'
                          : 'text-[#64748B]'
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

        {/* ── Habit Decay Warning Alert ── */}
        {habitsAtRiskList.length > 0 && (
          <div className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 text-[12px] shadow-2xs animate-fadeIn">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">trending_down</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-amber-950">Habit Decay Warning:</span>
                  <span className="font-semibold text-amber-900">"{habitsAtRiskList[0].title}"</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900 font-mono">
                    {Math.round(habitsAtRiskList[0].survivalProb * 100)}% survival
                  </span>
                </div>
                <div className="text-[11px] text-amber-800/90 truncate">
                  <span className="font-medium">Minimum Viable Recovery: </span>
                  <span>{habitsAtRiskList[0].mvrSuggestion}</span>
                </div>
              </div>
            </div>
            {onCheckInHabit && (
              <button
                type="button"
                onClick={() => onCheckInHabit(habitsAtRiskList[0].id, viewDate)}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-600 text-white hover:bg-amber-700 transition active:scale-95 shrink-0 shadow-xs cursor-pointer"
              >
                Log 2m Micro-rep
              </button>
            )}
          </div>
        )}

        {/* ── Capacity Overload Guard Alert ── */}
        {capacityAnalytics.isOverloaded && (
          <div className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-rose-50/90 border border-rose-200/80 text-[12px] text-rose-950 shadow-2xs animate-fadeIn">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">speed</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-rose-900">Capacity Saturation Alert:</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-200/80 text-rose-900 font-mono">
                    {capacityAnalytics.utilizationPct}% Cognitive Load
                  </span>
                  <span className="text-[11px] text-rose-800 font-medium">
                    ({capacityAnalytics.effectiveHours}h load • {capacityAnalytics.switchCount} context switches)
                  </span>
                </div>
                <div className="text-[11px] text-rose-800/90 truncate">
                  {capacityAnalytics.message}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Editor Mode Instruction & Save Bar ── */}
        {isEditorMode && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-950 text-[12px] shadow-2xs animate-fadeIn">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 leading-tight">
                <span className="font-bold text-amber-900">Interactive Editor Mode: </span>
                <span className="text-amber-800">
                  Hold <kbd className="px-1.5 py-0.5 rounded bg-white font-mono text-[10px] font-bold border border-amber-300/80 shadow-3xs">Ctrl</kbd> + Left Click on any calendar block to select. Drag top/bottom edge handles to adjust duration, or drag the body to slide times. Changes save permanently.
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
              className="shrink-0 px-3.5 py-1.5 rounded-xl bg-amber-600 text-white font-semibold text-[11px] hover:bg-amber-700 shadow-xs transition"
            >
              Save & Exit Editor
            </button>
          </div>
        )}

        {/* ── 2-COLUMN TIME-BLOCKING WORKSPACE ── */}
        <div className="w-full min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">



          {/* ══════════════════════════════════════════════════════
              LEFT COLUMN: UNIFIED TASK TRAY (3.5 cols)
             ══════════════════════════════════════════════════════ */}
          <div className={`w-full min-w-0 lg:col-span-4 xl:col-span-3.5 flex flex-col gap-3 ${
            mobileTab === 'tray' ? 'flex' : 'hidden lg:flex'
          }`}>
            <div className="w-full min-w-0 flex flex-col gap-3 p-3.5 sm:p-4 rounded-2xl bg-white border border-black/[0.06] shadow-2xs h-[calc(100vh-210px)] min-h-[580px] overflow-hidden">
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
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-[#F5F4FA] text-[#64748B] text-[11px] font-bold">
                    {trayTasks.length}
                  </span>
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
                      const isActiveToday = isTaskScheduledForDate(sched, viewDate);
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

                      return (
                        <div
                          key={`tray-s-${sched.id}`}
                          onClick={() => setEditingSchedule(sched)}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer group shadow-2xs ${
                            isDone
                              ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70 opacity-90'
                              : 'border-indigo-100/80 bg-white hover:bg-indigo-50/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600'
                            }`}>
                              <span className="material-symbols-outlined text-[16px]">{isDone ? 'check' : 'school'}</span>
                            </div>
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
                        </div>
                      );
                    })
                  )
                ) : trayFilterMode === 'rituals' ? (
                  habits.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#F9F9FB] border border-dashed border-black/[0.08] text-center space-y-1.5 my-4">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                      <p className="text-[12px] font-semibold text-[#1A1B1F]">No habits created</p>
                      <p className="text-[10px] text-[#64748B]">Create daily rituals to establish baseline consistency.</p>
                    </div>
                  ) : (
                    habits.map(h => {
                      const isChecked = Array.isArray(h.completedDays) && h.completedDays.includes(viewDate);
                      return (
                        <div
                          key={`tray-h-${h.id}`}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                            isChecked
                              ? 'bg-emerald-50/70 border-emerald-200 opacity-80'
                              : 'bg-white hover:bg-emerald-50/30 border-black/[0.06]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => onCheckInHabit?.(h.id, viewDate)}
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
                                {h.startTime && <span className="text-emerald-600 font-bold">• At {formatTimeString(h.startTime)}</span>}
                              </div>
                            </div>
                          </div>
                          {h.linkedGoal && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 truncate max-w-[80px]">
                              {h.linkedGoal}
                            </span>
                          )}
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

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id }));
                          setDraggedTaskId(task.id);
                        }}
                        onDragEnd={() => setDraggedTaskId(null)}
                        onClick={() => setEditingTask(task)}
                        className={`relative p-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing hover:shadow-xs group ${
                          draggedTaskId === task.id
                            ? 'opacity-40 border-[#0A84FF] bg-blue-50/50'
                            : 'bg-[#FAFAFC] hover:bg-white border-black/[0.06]'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTask?.(task.id);
                            }}
                            className="mt-0.5 text-[#94A3B8] hover:text-[#0A84FF] transition shrink-0"
                          >
                            <Square className="w-4 h-4" />
                          </button>

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
          <div className={`w-full min-w-0 lg:col-span-8 xl:col-span-8.5 p-2.5 sm:p-4 rounded-2xl bg-white border border-black/[0.06] shadow-2xs overflow-hidden flex flex-col ${
            mobileTab === 'timeline' ? 'flex' : 'hidden lg:flex'
          }`}>
            <div className="flex items-center justify-between mb-2.5 sm:mb-3 gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0A84FF] flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-[#0A84FF]" />
                </div>
                <div>
                  <span className="text-[13px] font-bold text-[#1A1B1F]">
                    {scope === 'day' ? 'Daily Schedule' : scope === '3day' ? '3-Day Rolling Horizon' : '7-Day Weekly Grid'}
                  </span>
                  <span className="text-[10px] text-[#8E8E93] hidden sm:inline ml-2">• Click or drop tasks across hours</span>
                </div>
              </div>

              {/* Quick time anchors on mobile/desktop */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollToHour(8)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#F5F4FA] text-[#64748B] hover:text-[#0A84FF] transition"
                  title="Jump to 8:00 AM"
                >
                  8 AM
                </button>
                <button
                  type="button"
                  onClick={() => scrollToHour(13)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#F5F4FA] text-[#64748B] hover:text-[#0A84FF] transition"
                  title="Jump to 1:00 PM"
                >
                  1 PM
                </button>
                <button
                  type="button"
                  onClick={() => scrollToNow(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-[#0A84FF] hover:bg-blue-100 transition active:scale-95"
                  title="Jump to Current Time"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>Now</span>
                </button>
              </div>
            </div>

            <div
              ref={calendarScrollRef}
              className={`relative ${scope === 'day' ? 'overflow-x-hidden' : 'overflow-x-auto'} overflow-y-auto select-none border border-black/[0.06] rounded-xl bg-[#FAFAFC] h-[calc(100vh-210px)] min-h-[580px] w-full min-w-0 flex-1`}
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
                <div className="sticky top-0 z-30 h-10 border-b border-r border-black/[0.06] bg-[#F5F4FA] shrink-0" />

                {/* Column Headers */}
                {columnsData.map(col => (
                  <div
                    key={col.colDate}
                    className={`sticky top-0 z-30 h-10 px-2 sm:px-3 flex items-center justify-between border-b border-r border-black/[0.06] backdrop-blur-md min-w-0 overflow-hidden ${
                      col.isToday ? 'bg-blue-50/95 text-[#0A84FF]' : 'bg-[#F5F4FA]/95 text-[#64748B]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[12px] min-w-0 truncate">
                      <span className="truncate">{col.headerInfo.weekday}</span>
                      <span className={`px-1.5 py-0.2 rounded-md shrink-0 ${col.isToday ? 'bg-[#0A84FF] text-white shadow-2xs' : 'text-[#1A1B1F]'}`}>
                        {col.headerInfo.dayNum}
                      </span>
                    </div>

                    {col.colMins > 0 && (
                      <span className="text-[10px] font-semibold text-[#8E8E93] shrink-0">
                        {(col.colMins / 60).toFixed(1)}h
                      </span>
                    )}
                  </div>
                ))}

                {/* Left Hour Axis */}
                <div className="relative border-r border-black/[0.06] bg-[#F5F4FA] shrink-0" style={{ height: `${TOTAL_HEIGHT}px` }}>
                  {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
                    const hourNum = START_HOUR + i;
                    const hourLabel = `${String(hourNum).padStart(2, '0')}:00`;
                    const axisLabel = formatHourAxis(hourNum);
                    const topPos = i * HOUR_HEIGHT;
                    return (
                      <div
                        key={hourLabel}
                        style={{ top: `${topPos}px`, height: `${HOUR_HEIGHT}px` }}
                        className="absolute left-0 right-0 border-b border-black/[0.04] pr-1.5 pt-1 text-right font-mono text-[10px] text-[#8E8E93]"
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
                      className="relative border-r border-black/[0.06] bg-white transition-colors min-w-0 overflow-hidden"
                      style={{ height: `${TOTAL_HEIGHT}px` }}
                    >
                      {/* Hour Slots with Drop Targets & Half-Hour Grid lines */}
                      {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
                        const hourNum = START_HOUR + i;
                        const hourLabel = `${String(hourNum).padStart(2, '0')}:00`;
                        const topPos = i * HOUR_HEIGHT;
                        const isHovered = dragOverSlot?.date === colDate && dragOverSlot?.hour === hourLabel;

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
                                const raw = e.dataTransfer.getData('text/plain');
                                if (!raw) return;
                                const { taskId } = JSON.parse(raw);
                                if (taskId) handleSlotTask(taskId, hourLabel, colDate);
                              } catch (err) {
                                console.error('Drop error', err);
                              }
                            }}
                            onClick={() => onOpenQuickAdd?.({ initialTime: hourLabel, initialDate: colDate })}
                            className={`absolute left-0 right-0 border-b border-black/[0.05] transition-colors cursor-pointer group flex items-start justify-end p-1.5 ${
                              isHovered
                                ? 'bg-blue-100/60 ring-2 ring-blue-400 inset-0'
                                : (hourNum < 6 || hourNum >= 22)
                                  ? 'bg-[#F8F8FC]/80 hover:bg-blue-50/40'
                                  : 'bg-white hover:bg-blue-50/40'
                            }`}
                          >
                            {/* Subtle half-hour divider */}
                            <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-black/[0.03] pointer-events-none" />

                            <span className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-[#0A84FF] transition-opacity z-10">
                              + Block at {hourLabel}
                            </span>
                          </div>
                        );
                      })}

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
                        {/* Fixed Timetable & Class Blocks Layer (Background containers) */}
                        {(schedules || [])
                          .filter(sched => isTaskScheduledForDate(sched, colDate) && sched.startTime)
                          .map(sched => {
                            const startMin = minutesFromStartOfDay(sched.startTime);
                            if (startMin === null) return null;
                            let dur = Number(sched.durationMinutes);
                            if (!dur || isNaN(dur)) {
                              if (sched.startTime && sched.endTime) {
                                const diff = calculateDuration(sched.startTime, sched.endTime);
                                if (diff > 0) dur = diff;
                              }
                            }
                            if (!dur || isNaN(dur)) dur = 60;
                            const endMin = startMin + dur;
                            const topPx = Math.max(0, ((startMin - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
                            const heightPx = Math.max(34, (dur / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);

                            const isDone = Boolean(
                              sched.completed ||
                              (Array.isArray(sched.completedDates) && sched.completedDates.includes(colDate))
                            );

                            return (
                              <div
                                key={sched.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSchedule(sched);
                                }}
                                style={{
                                  top: `${topPx}px`,
                                  height: `${heightPx}px`,
                                  left: '6px',
                                  right: '6px'
                                }}
                                className={`absolute rounded-xl pointer-events-auto border transition-all p-2 flex flex-col justify-between shadow-xs z-10 group cursor-pointer ${
                                  isDone
                                    ? 'border-emerald-300 bg-emerald-50/90 hover:bg-emerald-100/90 opacity-90'
                                    : 'border-indigo-200/90 bg-indigo-50/85 hover:bg-indigo-100/90'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="material-symbols-outlined text-[13px] text-indigo-600 shrink-0">{isDone ? 'check' : 'school'}</span>
                                    <span className={`text-[11px] font-bold truncate tracking-tight ${
                                      isDone ? 'line-through text-slate-500' : 'text-indigo-950'
                                    }`}>
                                      {sched.title}
                                    </span>
                                    {isDone ? (
                                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-100/90 text-emerald-800 text-[9px] font-bold uppercase tracking-wider shrink-0">
                                        Done
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded-md bg-indigo-100/90 text-indigo-700 text-[9px] font-bold uppercase tracking-wider shrink-0">
                                        Class
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => handleToggleScheduleDone(sched, colDate, e)}
                                      title={isDone ? "Mark incomplete" : "Mark attended/completed"}
                                      className={`p-0.5 rounded transition cursor-pointer ${
                                        isDone ? 'text-emerald-700 hover:text-emerald-800' : 'text-indigo-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100'
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </button>
                                    {onDeleteSchedule && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteSchedule(sched.id);
                                        }}
                                        title="Remove schedule block"
                                        className="p-0.5 rounded text-indigo-400 hover:text-red-500 hover:bg-white/80 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        }

                        {/* Scheduled Habits & Ritual Blocks Layer */}
                        {(habits || [])
                          .filter(h => {
                            if (!h.startTime) return false;
                            const targetFreq = h.targetFrequency || 'Every Day';
                            if (targetFreq === 'Every Day') return true;
                            const targetD = new Date(`${colDate}T12:00:00`);
                            const dayOfWeek = targetD.getDay(); // 0 Sun, 1 Mon..
                            if (targetFreq === 'Weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
                            if (targetFreq === 'Custom' && Array.isArray(h.customDays)) {
                              const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                              return h.customDays.includes(dayShorts[dayOfWeek]);
                            }
                            return true;
                          })
                          .map(habit => {
                            const startMin = minutesFromStartOfDay(habit.startTime);
                            if (startMin === null) return null;
                            const dur = Number(habit.durationMinutes) || parseCompoundDuration(habit.duration) || 30;
                            const endMin = startMin + dur;
                            const topPx = Math.max(0, ((startMin - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
                            const heightPx = Math.max(34, (dur / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
                            const isChecked = Array.isArray(habit.completedDays) && habit.completedDays.includes(colDate);

                            return (
                              <div
                                key={`cal-habit-${habit.id}`}
                                style={{
                                  top: `${topPx}px`,
                                  height: `${heightPx}px`,
                                  left: '6px',
                                  right: '6px'
                                }}
                                className={`absolute rounded-xl pointer-events-auto border transition-all p-2 flex items-center justify-between shadow-xs z-15 group ${
                                  isChecked
                                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 opacity-80'
                                    : 'bg-emerald-50/60 hover:bg-emerald-50/95 border-emerald-200/90 text-emerald-950'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCheckInHabit?.(habit.id, colDate);
                                    }}
                                    className={`w-5 h-5 rounded-full flex items-center justify-center transition shrink-0 ${
                                      isChecked
                                        ? 'bg-emerald-600 text-white'
                                        : 'border-2 border-emerald-500 hover:bg-emerald-100 text-transparent'
                                    }`}
                                    title={isChecked ? 'Checked in! Click to uncheck' : 'Click to check in ritual'}
                                  >
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </button>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="material-symbols-outlined text-[13px] text-emerald-600 shrink-0">
                                        {habit.icon || 'cached'}
                                      </span>
                                      <span className={`text-[11px] font-bold truncate ${isChecked ? 'line-through text-emerald-700' : 'text-emerald-950'}`}>
                                        {habit.title}
                                      </span>
                                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase tracking-wider shrink-0">
                                        Ritual
                                      </span>
                                    </div>
                                    <div className="text-[10px] font-mono text-emerald-700">
                                      {format12Hour(startMin)} – {format12Hour(endMin % 1440)} ({dur}m)
                                    </div>
                                  </div>
                                </div>

                                {habit.linkedGoal && (
                                  <span className="text-[10px] font-semibold text-emerald-600 truncate max-w-[120px] hidden sm:inline">
                                    ⚓ {habit.linkedGoal}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        }

                        {colScheduled.map(({ task, startMin, endMin, duration, lane, totalLanes, isNested, nestedLane, nestedTotalLanes, containerTask, hasNestedChildren }) => {
                          const isFlexible = Boolean(task.isFlexible || task.durationMinutes === null);

                          const isBeingTransformed = transformState?.taskId === task.id;
                          const isSelectedForTransform = isEditorMode && selectedTransformTaskId === task.id;

                          const displayStartMin = isBeingTransformed ? transformState.currentStartMin : startMin;
                          const displayDuration = isBeingTransformed ? transformState.currentDuration : duration;
                          const displayEndMin = displayStartMin + displayDuration;

                          const topPx = Math.max(0, ((displayStartMin - startDayMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
                          const heightPx = isFlexible && !isBeingTransformed ? 36 : Math.max(36, (displayDuration / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);

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
                            ? 'border-l-[3.5px] border-l-purple-500'
                            : areaInfo?.color === 'emerald'
                            ? 'border-l-[3.5px] border-l-emerald-500'
                            : areaInfo?.color === 'amber'
                            ? 'border-l-[3.5px] border-l-amber-500'
                            : areaInfo?.color === 'rose'
                            ? 'border-l-[3.5px] border-l-rose-500'
                            : areaInfo?.color === 'indigo'
                            ? 'border-l-[3.5px] border-l-indigo-500'
                            : 'border-l-[3.5px] border-l-[#0A84FF]';

                          // Distinct visual treatment for nested vs standard blocks
                          const cardAccent = isNested
                            ? `bg-white/95 hover:bg-white text-slate-900 border-slate-200/90 shadow-[0_3px_12px_rgba(0,0,0,0.07)] ring-1 ring-black/[0.04] ${areaBorderClass}`
                            : isHigh
                            ? 'bg-[#FFF5F5] hover:bg-[#FFEBEB] text-[#7F1D1D] border-red-200 border-l-[4px] border-l-red-500'
                            : isLow
                            ? 'bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#064E3B] border-emerald-200 border-l-[4px] border-l-emerald-500'
                            : 'bg-[#F0F7FF] hover:bg-[#E5F1FF] text-[#0C4A6E] border-blue-200 border-l-[4px] border-l-[#0A84FF]';

                          const timeStr = isFlexible && !isBeingTransformed ? format12Hour(displayStartMin) : `${format12Hour(displayStartMin)} – ${format12Hour(displayEndMin % 1440)}`;
                          const matchedGoal = goals.find(g => g.id === task.goalId);

                          // Card size tiers
                          const isSpacious = heightPx >= 110;
                          const isCompact = heightPx < 65;

                          // Compute non-overlapping positioning with smooth inset margins
                          const hasOverlap = !isNested && totalLanes > 1;
                          const widthStyle = isNested
                            ? (nestedTotalLanes > 1
                                ? `calc(${(100 / nestedTotalLanes)}% - 32px)`
                                : 'calc(100% - 32px)')
                            : (hasOverlap
                                ? `calc(${100 / totalLanes}% - 6px)`
                                : 'calc(100% - 8px)');

                          const leftStyle = isNested
                            ? (nestedTotalLanes > 1
                                ? `calc(22px + ${(nestedLane || 0) * (100 / nestedTotalLanes)}%)`
                                : '22px')
                            : (hasOverlap
                                ? `calc(${lane * (100 / totalLanes)}% + 3px)`
                                : '4px');

                          const zIndexVal = isNested ? (25 + (nestedLane || 0)) : (10 + (lane || 0));

                          return (
                            <div
                              key={task.id}
                              onClick={(e) => {
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
                                cursor: isSelectedForTransform ? 'move' : isEditorMode ? 'pointer' : 'pointer'
                              }}
                              className={`absolute rounded-xl pointer-events-auto transition-all ${
                                isSelectedForTransform
                                  ? 'ring-2 ring-[#0A84FF] shadow-[0_0_0_2px_rgba(10,132,255,0.4),0_12px_32px_rgba(0,0,0,0.18)] z-40'
                                  : isEditorMode
                                  ? 'hover:ring-1 hover:ring-amber-400 hover:shadow-md'
                                  : 'hover:shadow-lg hover:scale-[1.002] hover:z-35'
                              } group border ${cardAccent} ${
                                isCompact ? 'p-2 px-3 flex flex-col justify-center' : 'p-3 flex flex-col justify-between'
                              } ${task.completed ? 'opacity-55 grayscale' : ''}`}
                            >
                              {/* Parent block track guide when it contains nested sub-blocks */}
                              {hasNestedChildren && (
                                <div className="absolute left-[16px] top-[48px] bottom-[28px] w-[1px] border-l border-dashed border-red-300/50 pointer-events-none" />
                              )}

                              {/* Tier 1: Compact View (< 65px height) - ALWAYS renders Title first and never clips */}
                              {isCompact ? (
                                <div className="flex flex-col justify-center h-full min-w-0">
                                  {/* Row 1: Checkbox + Bold Title + Badges + Quick Actions */}
                                  <div className="flex items-center justify-between gap-2 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onToggleTask?.(task.id);
                                        }}
                                        className="text-inherit opacity-75 hover:opacity-100 transition shrink-0"
                                      >
                                        {task.completed ? (
                                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                                        ) : (
                                          <Square className="w-4 h-4 text-slate-400 hover:text-[#0A84FF]" />
                                        )}
                                      </button>

                                      {isLiveNow && !task.completed && (
                                        <span className="px-1 py-0.2 rounded bg-red-500 text-white text-[8px] font-black uppercase tracking-wider shrink-0">
                                          NOW
                                        </span>
                                      )}

                                      {/* Main Task Title - bold & high contrast */}
                                      <span className={`text-[12.5px] font-bold tracking-tight truncate text-slate-900 ${task.completed ? 'line-through opacity-60' : ''}`}>
                                        {task.title}
                                      </span>

                                      {isNested && areaInfo && (
                                        <span className={`hidden sm:inline-flex items-center gap-1 text-[8.5px] font-bold px-1.5 py-0.2 rounded-full border ${areaInfo.badgeClass} shrink-0`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${areaInfo.dotClass}`} />
                                          {areaInfo.shortLabel}
                                        </span>
                                      )}

                                      {isNested && !areaInfo && (
                                        <span className="hidden sm:inline-flex items-center gap-0.5 text-[8.5px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                                          sub-block
                                        </span>
                                      )}
                                    </div>

                                    {/* Action buttons on hover */}
                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {!task.completed && onStartFocus && (
                                        <button
                                          type="button"
                                          title="Start Focus"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onStartFocus(task.id);
                                          }}
                                          className="p-0.5 rounded bg-white text-[#0A84FF] shadow-xs hover:scale-105 transition"
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
                                        className="p-0.5 rounded bg-white text-slate-500 hover:text-red-500 shadow-xs hover:scale-105 transition"
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
                                  <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 mt-0.5 min-w-0">
                                    <span className="font-mono font-semibold text-[9.5px] text-slate-700 bg-slate-100/70 px-1.5 py-0.2 rounded border border-slate-200/50 shrink-0">
                                      {timeStr}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded bg-black/[0.04] font-bold text-[9px] text-slate-600 shrink-0">
                                      {formatDurationLabel(duration)}
                                    </span>
                                    {task.recurrence && task.recurrence !== 'none' && (
                                      <span className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-bold text-teal-700 bg-teal-50 px-1 py-0.2 rounded border border-teal-200/50 shrink-0" title={`Repeats ${task.recurrence}`}>
                                        <Repeat className="w-2.5 h-2.5" />
                                        <span className="capitalize">{task.recurrence}</span>
                                      </span>
                                    )}
                                    {matchedGoal && (
                                      <span className="hidden md:inline-flex items-center gap-1 text-[9px] font-medium text-slate-500 truncate max-w-[130px]">
                                        <Flag className="w-2.5 h-2.5" />
                                        <span className="truncate">{matchedGoal.title}</span>
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
                                            onToggleTask?.(task.id);
                                          }}
                                          className="text-inherit opacity-75 hover:opacity-100 transition shrink-0"
                                        >
                                          {task.completed ? (
                                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                                          ) : (
                                            <Square className="w-4 h-4 text-slate-400 hover:text-[#0A84FF]" />
                                          )}
                                        </button>

                                        {isLiveNow && !task.completed && (
                                          <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[8px] font-black uppercase tracking-wider animate-pulse shrink-0">
                                            NOW
                                          </span>
                                        )}

                                        <span className={`text-[13px] font-bold tracking-tight truncate text-slate-900 ${task.completed ? 'line-through opacity-70' : ''}`}>
                                          {task.title}
                                        </span>

                                        {task.impact && (
                                          <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-white/70 opacity-80 shrink-0">
                                            {task.impact}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!task.completed && onStartFocus && (
                                          <button
                                            type="button"
                                            title="Start 25m Focus Block"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onStartFocus(task.id);
                                            }}
                                            className="p-1 rounded-md bg-white text-[#0A84FF] shadow-xs hover:scale-105 transition"
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
                                          className="p-1 rounded-md bg-white text-slate-500 hover:text-red-500 shadow-xs hover:scale-105 transition"
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
                                      <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-red-900/80 bg-red-100/50 border border-red-200/50 rounded-md px-2 py-0.5 mt-1.5 w-fit">
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
                                      <span className="px-1.5 py-0.2 rounded bg-white/70 font-bold text-[9px]">
                                        {formatDurationLabel(duration)}
                                      </span>
                                      {task.recurrence && task.recurrence !== 'none' && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-white/80 font-bold text-[9px] text-teal-800 border border-teal-200/60" title={`Repeats ${task.recurrence}`}>
                                          <Repeat className="w-2.5 h-2.5" />
                                          <span className="capitalize">{task.recurrence}</span>
                                        </span>
                                      )}
                                      {matchedGoal && (
                                        <span className="hidden md:inline-flex items-center gap-1 text-[9px] font-semibold bg-white/60 px-1.5 py-0.2 rounded">
                                          <Flag className="w-2.5 h-2.5" />
                                          <span className="truncate max-w-[120px]">{matchedGoal.title}</span>
                                        </span>
                                      )}
                                    </div>

                                    {Array.isArray(task.subtasks) && task.subtasks.length > 0 && (
                                      <span className="flex items-center gap-1 text-[9px] font-semibold bg-white/70 px-1.5 py-0.2 rounded">
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
      {/* ══════════════════════════════════════════════════════
          MOBILE ONLY: FLOATING CIRCULAR CALENDAR BUTTON (BOTTOM RIGHT)
         ══════════════════════════════════════════════════════ */}
      <button
        type="button"
        onClick={() => setMobileTab(prev => prev === 'timeline' ? 'tray' : 'timeline')}
        className={`lg:hidden fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-30 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
          mobileTab === 'timeline'
            ? 'bg-[#1A1B1F] text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] ring-2 ring-white/60'
            : 'bg-[#0A84FF] text-white shadow-[0_8px_24px_rgba(10,132,255,0.4)] hover:bg-[#0071E3]'
        }`}
        aria-label={mobileTab === 'timeline' ? 'Back to Task Tray' : 'View Calendar Timeline'}
        title={mobileTab === 'timeline' ? 'Back to Task Tray' : 'View Calendar Timeline'}
      >
        {mobileTab === 'timeline' ? (
          <Inbox className="w-5 h-5 transition-transform" />
        ) : (
          <Calendar className="w-5 h-5 transition-transform" />
        )}
      </button>
    </main>
  );
});

export default TodayView;
