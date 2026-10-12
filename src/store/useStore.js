import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import { purgeLegacyGroqKey } from '../lib/groqClient.js';
import { resetNlpMemory, learnFromTaskSave, learnFromGoalSave, learnFromHabitSave } from '../lib/nlpMemory.js';
import { planDateLabel, taskPlanDate, todayPlanDate, isTaskCompletedForDate } from '../lib/taskMetadata.js';
import { detectScheduleCollisions, findOptimalTimeGap } from '../lib/scheduleCollisionGuard.js';
import { computeHabitDecayMetrics, getHabitsAtRisk } from '../lib/habitDecayGuard.js';
import { evaluateCapacityLoad } from '../lib/capacityOverloadGuard.js';
import { buildLifeGraph } from '../lib/lifeGraph.js';
import { getCavemanMetrics } from '../lib/cavemanCompressor.js';

/* ── localStorage wrapper ── */
function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      const parsed = saved ? JSON.parse(saved) : defaultValue;
      if (key === 'momentum_settings' && parsed && typeof parsed === 'object' && 'groqApiKey' in parsed) {
        const { groqApiKey: _removedSecret, ...safeSettings } = parsed;
        localStorage.setItem(key, JSON.stringify(safeSettings));
        return safeSettings;
      }
      return parsed;
    } catch {
      return defaultValue;
    }
  });

  const set = useCallback((updater) => {
    setValue(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save to localStorage', err);
      }
      return next;
    });
  }, [key]);

  return [value, set];
}

/* ── Date helpers ── */
function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
}

function dateFromKey(key) {
  const y = +key.slice(0, 4);
  const m = +key.slice(5, 7) - 1;
  const d = +key.slice(8, 10);
  return new Date(y, m, d, 12, 0, 0);
}

function shiftDateKey(key, days) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

const todayKey = (date = new Date()) => dateKey(date);
const dayOfWeek = () => new Date().getDay(); // 0=Sun

function calcStreak(completedDays) {
  if (!completedDays || completedDays.length === 0) return 0;
  const set = new Set();
  for (let i = 0; i < completedDays.length; i++) {
    const d = completedDays[i];
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      set.add(d);
    }
  }
  if (set.size === 0) return 0;

  const today = todayKey();
  const yesterday = shiftDateKey(today, -1);

  let current = null;
  if (set.has(today)) {
    current = today;
  } else if (set.has(yesterday)) {
    current = yesterday;
  } else {
    return 0;
  }

  let streak = 1;
  while (true) {
    const prev = shiftDateKey(current, -1);
    if (set.has(prev)) {
      streak++;
      current = prev;
    } else {
      break;
    }
  }
  return streak;
}

function last7Days() {
  const days = [];
  const today = todayKey();
  for (let i = 6; i >= 0; i--) {
    days.push(shiftDateKey(today, -i));
  }
  return days;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* ── Web Audio Synthesizer Chimes ── */
export function playChime(type = 'complete') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    if (type === 'complete') {
      // Crisp satisfying chime (C6 -> G6 harmonic)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now);
      osc.frequency.exponentialRampToValueAtTime(1567.98, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'timerEnd') {
      // Triple zen bell
      [0, 0.15, 0.3].forEach((delay, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'triangle';
        o.frequency.setValueAtTime(587.33 + idx * 146.83, now + delay);
        g.gain.setValueAtTime(0.18, now + delay);
        g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.45);
        o.start(now + delay);
        o.stop(now + delay + 0.45);
      });
    }
  } catch (err) {
    console.warn('Audio chime skipped', err);
  }
}

/* ── Desktop Notification Helper ── */
export function sendNotification(title, options = {}) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { icon: '/favicon.svg', ...options });
    } catch (e) {
      console.warn('Notification failed', e);
    }
  }
}

function getOffsetDateKey(baseDateStr, offsetDays) {
  const [y, m, d] = (baseDateStr || todayKey()).split('-').map(Number);
  const date = new Date(y, m - 1, d + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function generateRichSampleWorkspace(todayStr = todayKey()) {
  const yesterday = getOffsetDateKey(todayStr, -1);
  const twoDaysAgo = getOffsetDateKey(todayStr, -2);
  const threeDaysAgo = getOffsetDateKey(todayStr, -3);
  const fourDaysAgo = getOffsetDateKey(todayStr, -4);
  const fiveDaysAgo = getOffsetDateKey(todayStr, -5);
  const sixDaysAgo = getOffsetDateKey(todayStr, -6);
  const tomorrow = getOffsetDateKey(todayStr, 1);
  const dayAfterTomorrow = getOffsetDateKey(todayStr, 2);

  const goals = [
    {
      id: 'g1',
      title: 'Ship Portfolio Website v3 & AI Copilot',
      category: 'career',
      why: 'To establish independent creative authority and ship craft at the highest level.',
      progress: 72,
      daysLeft: 10,
      targetDate: getOffsetDateKey(todayStr, 10),
      keyResults: 4,
      tasksActive: 2,
      velocity: 'ahead',
      icon: 'lightbulb',
      color: 'primary',
      linkedHabitIds: ['h4']
    },
    {
      id: 'g2',
      title: 'Run a Sub-1:45 Half Marathon',
      category: 'health',
      why: 'Build unbreakable physical stamina and mental endurance.',
      progress: 55,
      daysLeft: 32,
      targetDate: getOffsetDateKey(todayStr, 32),
      keyResults: 3,
      tasksActive: 1,
      velocity: 'on-track',
      icon: 'favorite',
      color: 'secondary',
      linkedHabitIds: ['h2', 'h5']
    },
    {
      id: 'g3',
      title: 'Master Grade 3 Classical Guitar Repertoire',
      category: 'creative',
      why: 'Anchor evenings in tactile, acoustic expression away from screens.',
      progress: 20,
      daysLeft: 14,
      targetDate: getOffsetDateKey(todayStr, 14),
      keyResults: 4,
      tasksActive: 1,
      velocity: 'behind',
      icon: 'music_note',
      color: 'tertiary',
      linkedHabitIds: ['h3']
    },
    {
      id: 'g4',
      title: 'Launch Personal Knowledge OS & Zettelkasten',
      category: 'career',
      why: 'Build a second brain that compounds learning into compounding intellectual leverage.',
      progress: 45,
      daysLeft: 24,
      targetDate: getOffsetDateKey(todayStr, 24),
      keyResults: 3,
      tasksActive: 0,
      velocity: 'on-track',
      icon: 'auto_stories',
      color: 'primary',
      linkedHabitIds: ['h6']
    },
    {
      id: 'g5',
      title: 'Complete Spanish B1 Fluency Certification',
      category: 'creative',
      why: 'Unlock travel fluency and cultural empathy across Latin America.',
      progress: 30,
      daysLeft: 45,
      targetDate: getOffsetDateKey(todayStr, 45),
      keyResults: 3,
      tasksActive: 0,
      velocity: 'behind',
      icon: 'translate',
      color: 'tertiary',
      linkedHabitIds: []
    }
  ];

  const habits = [
    {
      id: 'h1',
      title: 'Daily Mobility & Morning Reset',
      duration: '25 mins',
      durationMinutes: 25,
      startTime: '06:30',
      isTimeBlocked: true,
      icon: 'self_improvement',
      linkedGoal: 'Half Marathon',
      description: 'Hip flexor, thoracic spine, and ankle mobility flow.',
      completedDays: [sixDaysAgo, fiveDaysAgo, fourDaysAgo, threeDaysAgo, twoDaysAgo, yesterday, todayStr],
      graceDays: 2,
      colorToken: 'primary'
    },
    {
      id: 'h2',
      title: 'Zone 2 Cardio / Aerobic Base',
      duration: '45 mins',
      durationMinutes: 45,
      startTime: '16:30',
      isTimeBlocked: true,
      icon: 'directions_run',
      linkedGoal: 'Half Marathon',
      description: 'Sub-lactate threshold endurance builder at 138-142 bpm.',
      completedDays: [fourDaysAgo, threeDaysAgo],
      graceDays: 0,
      colorToken: 'secondary'
    },
    {
      id: 'h3',
      title: 'Classical Guitar Fingerstyle Drill',
      duration: '30 mins',
      durationMinutes: 30,
      startTime: '18:30',
      isTimeBlocked: true,
      icon: 'music_note',
      linkedGoal: 'Classical Guitar',
      description: 'Fernando Sor studies with metronome at 60 bpm.',
      completedDays: [threeDaysAgo, twoDaysAgo, yesterday],
      graceDays: 1,
      colorToken: 'tertiary'
    },
    {
      id: 'h4',
      title: 'Autonomous Deep Work Sprint',
      duration: '90 mins',
      durationMinutes: 90,
      startTime: '07:30',
      isTimeBlocked: true,
      icon: 'terminal',
      linkedGoal: 'Ship Portfolio',
      description: 'High-cognitive creative focus before notification windows open.',
      completedDays: [fourDaysAgo, threeDaysAgo, twoDaysAgo, yesterday, todayStr],
      graceDays: 1,
      colorToken: 'primary'
    },
    {
      id: 'h5',
      title: 'Daily Nutrition: 160g Protein & Hydration',
      duration: '20 mins',
      durationMinutes: 20,
      startTime: '13:00',
      isTimeBlocked: false,
      icon: 'restaurant',
      linkedGoal: 'Half Marathon',
      description: 'Lean nutrition fueling daily endurance output and recovery.',
      completedDays: [todayStr, yesterday, twoDaysAgo],
      graceDays: 2,
      colorToken: 'primary'
    },
    {
      id: 'h6',
      title: 'Evening Non-fiction Reading & Synthesis',
      duration: '30 mins',
      durationMinutes: 30,
      startTime: '21:30',
      isTimeBlocked: true,
      icon: 'auto_stories',
      linkedGoal: 'Knowledge System',
      description: 'Deep non-fiction reading and spaced repetition markdown notes.',
      completedDays: [twoDaysAgo, threeDaysAgo],
      graceDays: 1,
      colorToken: 'tertiary'
    },
    {
      id: 'h7',
      title: 'Sleep Discipline (Wind down & Sleep Prep)',
      duration: '15 mins',
      durationMinutes: 15,
      startTime: '22:45',
      isTimeBlocked: true,
      icon: 'bedtime',
      linkedGoal: 'Half Marathon',
      description: 'Screens off, blue-light block, room at 19°C for restorative REM cycle.',
      completedDays: [yesterday, twoDaysAgo, threeDaysAgo, fourDaysAgo],
      graceDays: 2,
      colorToken: 'secondary'
    }
  ];

  const schedules = [
    {
      id: 'sched-1',
      title: 'CS301 Distributed Systems & Cloud Mesh',
      category: 'College',
      startTime: '09:00',
      endTime: '10:15',
      durationMinutes: 75,
      recurrence: 'daily',
      completed: true,
      completedDates: [todayStr],
      notes: 'Lecture Hall B4 — Raft Consensus, Paxos & Byzantine Fault Tolerance',
      type: 'schedule',
      createdAt: Date.now() - 3600000 * 24
    },
    {
      id: 'sched-2',
      title: 'EE210 Circuit Lab & Resonance Analysis',
      category: 'College',
      startTime: '11:30',
      endTime: '13:00',
      durationMinutes: 90,
      recurrence: 'daily',
      completed: false,
      completedDates: [],
      notes: 'Hardware bench 8 — Oscilloscope frequency resonance test',
      type: 'schedule',
      createdAt: Date.now() - 3600000 * 20
    },
    {
      id: 'sched-3',
      title: 'Product Architecture RFC & Sync',
      category: 'Deep Work',
      startTime: '14:30',
      endTime: '15:30',
      durationMinutes: 60,
      recurrence: 'daily',
      completed: false,
      completedDates: [],
      notes: 'Coordinate with lead maintainers on SQLite offline sync protocol',
      type: 'schedule',
      createdAt: Date.now() - 3600000 * 15
    },
    {
      id: 'sched-4',
      title: 'Strength Training: Heavy Pull & Posterior Chain',
      category: 'Fitness',
      startTime: '17:30',
      endTime: '18:45',
      durationMinutes: 75,
      recurrence: 'daily',
      completed: false,
      completedDates: [],
      notes: 'Deadlifts 4x5 @ 140kg, Weighted Pullups, Face pulls',
      type: 'schedule',
      createdAt: Date.now() - 3600000 * 10
    }
  ];

  const tasks = [
    {
      id: 1,
      title: 'Write GraphQL Schema Gateway v3 with Rust WASM',
      priority: 'high',
      impact: 'high',
      category: 'Deep Work',
      goalId: 'g1',
      completed: false,
      dueDate: 'Today',
      plannedDate: todayStr,
      startTime: '10:30',
      durationMinutes: 45,
      areas: ['Career & Craft', 'Deep Focus'],
      energy: 'High',
      notes: 'Resolve latency regression between HTTP/2 and GraphQL federated mesh.',
      subtasks: [
        { id: 's1', title: 'Audit token validation headers', completed: true },
        { id: 's2', title: 'Benchmark serialization latency', completed: false }
      ],
      createdAt: Date.now() - 86400000
    },
    {
      id: 2,
      title: 'Review Stitch AI Design Tokens & Color Harmony Matrix',
      priority: 'high',
      impact: 'high',
      category: 'Design',
      goalId: 'g1',
      completed: false,
      dueDate: 'Today',
      plannedDate: todayStr,
      startTime: '08:00',
      durationMinutes: 45,
      areas: ['Creative & Expression', 'Career & Craft'],
      energy: 'Medium',
      notes: 'Examine contrast ratios on dark mode container tokens and card surfaces.',
      subtasks: [
        { id: 's3', title: 'Verify contrast on dark mode container tokens', completed: false }
      ],
      createdAt: Date.now() - 172800000
    },
    {
      id: 3,
      title: 'Submit Bi-weekly Lab Instrumentation Report PDF',
      priority: 'normal',
      impact: 'medium',
      category: 'College',
      completed: false,
      dueDate: 'Today',
      plannedDate: todayStr,
      startTime: null,
      durationMinutes: 15,
      areas: ['Career & Craft'],
      energy: 'Low',
      notes: 'Export PDF from Overleaf and attach to university canvas portal.',
      subtasks: [],
      createdAt: Date.now() - 50000
    },
    {
      id: 4,
      title: 'Deploy Supabase Auth Sync Proxy Hotfix to Vercel',
      priority: 'high',
      impact: 'high',
      category: 'Deep Work',
      goalId: 'g4',
      completed: true,
      completedAt: Date.now() - 3600000,
      completedDates: [todayStr],
      dueDate: 'Today',
      plannedDate: todayStr,
      startTime: '07:00',
      durationMinutes: 30,
      areas: ['Career & Craft'],
      energy: 'High',
      notes: 'Verify Web & Android real-time WebSocket handshake under latency.',
      subtasks: [
        { id: 's4', title: 'Run automated end-to-end test suite', completed: true }
      ],
      createdAt: Date.now() - 120000
    },
    {
      id: 5,
      title: 'Morning Inbox Zero & Standup Communication Protocol',
      priority: 'normal',
      impact: 'low',
      category: 'Routine',
      recurrence: 'daily',
      completed: false,
      completedDates: [yesterday],
      dueDate: 'Today',
      plannedDate: todayStr,
      startTime: '09:45',
      durationMinutes: 20,
      areas: ['Personal & Life'],
      energy: 'Low',
      notes: 'Clear notifications and post async standup blockers in Slack.',
      subtasks: [],
      createdAt: Date.now() - 40000
    },
    {
      id: 6,
      title: 'Zone 2 Cardio Interval (Heart rate ~142 bpm)',
      priority: 'normal',
      impact: 'medium',
      category: 'Habits',
      goalId: 'g2',
      linkedHabitId: 'h2',
      completed: false,
      dueDate: 'Today',
      plannedDate: todayStr,
      startTime: '16:30',
      durationMinutes: 45,
      areas: ['Health & Vitality', 'Habit Consistency'],
      energy: 'High',
      notes: '5km steady aerobic progression followed by 10 min dynamic stretching.',
      subtasks: [],
      createdAt: Date.now() - 30000
    },
    {
      id: 7,
      title: 'Practice Fernando Sor Study in B minor (Etude No. 5)',
      priority: 'normal',
      impact: 'medium',
      category: 'Creative',
      goalId: 'g3',
      completed: false,
      dueDate: 'Tomorrow',
      plannedDate: tomorrow,
      startTime: '19:00',
      durationMinutes: 35,
      areas: ['Creative & Expression'],
      energy: 'Medium',
      notes: 'Deliberate fingerstyle right-hand alternating thumb independence drill.',
      subtasks: [
        { id: 's7', title: 'Tuning and posture check', completed: false },
        { id: 's8', title: 'Measure 1-16 fingering drill', completed: false }
      ],
      createdAt: Date.now() - 25000
    },
    {
      id: 8,
      title: 'Audit Postgres Index Usage & Query Execution Plan',
      priority: 'normal',
      impact: 'high',
      category: 'Deep Work',
      completed: false,
      dueDate: 'This Week',
      durationMinutes: 60,
      areas: ['Career & Craft'],
      energy: 'High',
      notes: 'Check pg_stat_user_indexes for dead tuples and redundant composite indexes.',
      subtasks: [],
      createdAt: Date.now() - 20000
    },
    {
      id: 9,
      title: 'Explore WebAssembly Rust Media Parser for Audio Chimes',
      priority: 'low',
      impact: 'low',
      category: 'Personal',
      isBacklog: true,
      dueDate: 'Someday',
      durationMinutes: 90,
      areas: ['Creative & Expression', 'Career & Craft'],
      energy: 'High',
      notes: 'Compile minimal Rust synthesis crate to wasm32-unknown-unknown.',
      subtasks: [],
      createdAt: Date.now() - 15000
    },
    {
      id: 10,
      title: 'Order Marathon Energy Gels & Electrolyte Electrolysis Tablets',
      priority: 'normal',
      impact: 'low',
      category: 'Personal',
      goalId: 'g2',
      completed: false,
      dueDate: 'Past',
      plannedDate: threeDaysAgo,
      startTime: '15:00',
      durationMinutes: 20,
      areas: ['Health & Vitality'],
      energy: 'Low',
      notes: 'Replenish marathon racing fuel box before 18km long run weekend.',
      subtasks: [],
      createdAt: Date.now() - 86400000 * 3
    }
  ];

  const focusSessions = [
    {
      id: 'fs-1',
      taskId: 4,
      duration: 30,
      timestamp: Date.now() - 3600000 * 2,
      type: 'focus',
      completed: true
    },
    {
      id: 'fs-2',
      taskId: 1,
      duration: 45,
      timestamp: Date.now() - 3600000 * 4,
      type: 'focus',
      completed: true
    },
    {
      id: 'fs-3',
      taskId: 2,
      duration: 50,
      timestamp: Date.now() - 86400000 - 3600000 * 3,
      type: 'focus',
      completed: true
    },
    {
      id: 'fs-4',
      taskId: 8,
      duration: 60,
      timestamp: Date.now() - 86400000 - 3600000 * 6,
      type: 'focus',
      completed: true
    },
    {
      id: 'fs-5',
      taskId: 1,
      duration: 45,
      timestamp: Date.now() - 86400000 * 2 - 3600000 * 2,
      type: 'focus',
      completed: true
    },
    {
      id: 'fs-6',
      taskId: 3,
      duration: 25,
      timestamp: Date.now() - 86400000 * 2 - 3600000 * 5,
      type: 'focus',
      completed: true
    }
  ];

  const reflections = {
    currentWeek: '2026-W42',
    moodRatings: { 0: 4, 1: 5, 2: 4, 3: 5, 4: 4, 5: 5, 6: 4 },
    workedWell: 'Morning deep work blocks before 11 AM achieved 92% reliability with zero distraction.',
    pushedBack: 'Guitar fingerstyle practice got rescheduled due to late evening team RFC review.',
    pushedBackReason: 'Low Energy',
    onePriority: 'Finalize and launch the Portfolio Website v3 & AI Copilot live production release.',
    targetGoalId: 'g1',
    frictionTask: 'Auditing complex database index execution plans under peak IOPS load',
    history: [
      {
        id: 'ref-w41',
        week: '2026-W41',
        title: 'Week 41 Review — Exceptional Flow & Execution',
        dateRange: 'Oct 5 – Oct 11, 2026',
        completedRate: 88,
        tasksDone: 19,
        tasksTotal: 22,
        momentumScore: 91,
        workedWell: 'Maintained 45m workout intervals every alternate evening with strict sleep discipline.',
        pushedBack: 'Book reading backlog.',
        onePriority: 'Complete Stitch design tokens and mobile widget integration.',
        targetGoal: 'Ship Portfolio Website v3'
      },
      {
        id: 'ref-w40',
        week: '2026-W40',
        title: 'Week 40 Review — Solid Consistency',
        dateRange: 'Sep 28 – Oct 4, 2026',
        completedRate: 82,
        tasksDone: 16,
        tasksTotal: 20,
        momentumScore: 84,
        workedWell: 'Consistent morning mobility routine prevented lower back tightness.',
        pushedBack: 'Weekend long run got shifted due to rain.',
        onePriority: 'Deliver compiler WASM prototype.',
        targetGoal: 'Ship Portfolio Website v3'
      }
    ]
  };

  return { goals, habits, schedules, tasks, focusSessions, reflections };
}

const INITIAL_SAMPLE = generateRichSampleWorkspace(todayKey());
export const DEFAULT_TASKS = INITIAL_SAMPLE.tasks;
export const DEFAULT_GOALS = INITIAL_SAMPLE.goals;
export const DEFAULT_HABITS = INITIAL_SAMPLE.habits;
export const DEFAULT_SCHEDULES = INITIAL_SAMPLE.schedules;
export const DEFAULT_REFLECTIONS = INITIAL_SAMPLE.reflections;
export const DEFAULT_FOCUS_SESSIONS = INITIAL_SAMPLE.focusSessions;

const DEFAULT_SETTINGS = {
  focusLength: 45,
  dailyTarget: 4.5,
  desktopNotifications: true,
  autoBreaks: true,
  soundEffects: true,
  showFocusBar: true,
  profile: {
    name: 'Hardik',
    role: 'Principal Systems Architect',
    timezone: (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  },
  customUiLayout: {},
};

/* ── Main store hook ── */
export default function useStore() {
  const [tasks, setTasks] = useLocalStorage('momentum_tasks', DEFAULT_TASKS);
  const [goals, setGoals] = useLocalStorage('momentum_goals', DEFAULT_GOALS);
  const [habits, setHabits] = useLocalStorage('momentum_habits', DEFAULT_HABITS);
  const [reflections, setReflections] = useLocalStorage('momentum_reflections', DEFAULT_REFLECTIONS);
  const [settings, setSettings] = useLocalStorage('momentum_settings', DEFAULT_SETTINGS);
  const [focusSessions, setFocusSessions] = useLocalStorage('momentum_focus_sessions', DEFAULT_FOCUS_SESSIONS);
  const [schedules, setSchedules] = useLocalStorage('momentum_schedules', DEFAULT_SCHEDULES);
  const [cloudUserId, setCloudUserId] = useState(null);
  const [cloudUserEmail, setCloudUserEmail] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [cloudReady, setCloudReady] = useState(!isSupabaseConfigured);
  const lastSyncedJsonRef = useRef('');
  const isApplyingRemoteRef = useRef(false);

  useEffect(() => {
    purgeLegacyGroqKey();
  }, []);

  const applyRemoteSnapshot = useCallback((saved, userMeta) => {
    if (!saved || typeof saved !== 'object') return;
    isApplyingRemoteRef.current = true;

    if (Array.isArray(saved.tasks)) setTasks(saved.tasks);
    if (Array.isArray(saved.goals)) setGoals(saved.goals);
    if (Array.isArray(saved.habits)) setHabits(saved.habits);
    if (Array.isArray(saved.schedules)) {
      setSchedules(prev => (saved.schedules.length > 0 || !prev?.length || saved._mcpUpdated ? saved.schedules : prev));
    }
    if (saved.reflections && typeof saved.reflections === 'object') setReflections(saved.reflections);
    if (Array.isArray(saved.focusSessions)) setFocusSessions(saved.focusSessions);

    if (saved.settings && typeof saved.settings === 'object') {
      const meta = userMeta || {};
      const mergedSettings = { ...saved.settings };
      if (!mergedSettings.profile?.name && (meta.full_name || meta.name)) {
        mergedSettings.profile = {
          ...mergedSettings.profile,
          name: meta.full_name || meta.name || '',
          role: meta.role || '',
          timezone: meta.timezone || (typeof Intl !== 'undefined' && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC')
        };
      }
      delete mergedSettings.groqApiKey;
      setSettings(mergedSettings);
    }

    const snapshotData = {
      tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
      goals: Array.isArray(saved.goals) ? saved.goals : [],
      habits: Array.isArray(saved.habits) ? saved.habits : [],
      schedules: Array.isArray(saved.schedules) ? saved.schedules : [],
      reflections: saved.reflections || {},
      settings: saved.settings || {},
      focusSessions: Array.isArray(saved.focusSessions) ? saved.focusSessions : []
    };
    lastSyncedJsonRef.current = JSON.stringify(snapshotData);
    setLastSyncedAt(Date.now());

    setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 150);
  }, [setTasks, setGoals, setHabits, setSchedules, setReflections, setSettings, setFocusSessions]);

  const loadWorkspace = useCallback(async (session) => {
    if (!session?.user?.id) {
      setCloudUserId(null);
      setCloudUserEmail('');
      setCloudReady(true);
      return;
    }
    setCloudReady(false);
    try {
      if (session.user.email) setCloudUserEmail(session.user.email);
      const { data, error } = await supabase
        .from('workspace_snapshots')
        .select('data')
        .eq('user_id', session.user.id)
        .maybeSingle();
      const saved = data?.data;
      if (!error && saved && Array.isArray(saved.tasks) && Array.isArray(saved.goals) && Array.isArray(saved.habits)) {
        applyRemoteSnapshot(saved, session.user.user_metadata);
      } else {
        // First-time cloud user or empty snapshot: seed profile with metadata from sign-up
        const meta = session.user.user_metadata || {};
        if (meta.full_name || meta.name || meta.role) {
          setSettings(prev => ({
            ...prev,
            profile: {
              ...prev.profile,
              name: meta.full_name || meta.name || prev.profile?.name || '',
              role: meta.role || prev.profile?.role || '',
              timezone: meta.timezone || prev.profile?.timezone || (typeof Intl !== 'undefined' && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC')
            }
          }));
        }
      }
      setLastSyncedAt(Date.now());
    } catch (err) {
      console.error('Failed to load cloud workspace snapshot', err);
    } finally {
      setCloudUserId(session.user.id);
      setCloudReady(true);
    }
  }, [applyRemoteSnapshot, setSettings]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let activeSession = null;
    let channel = null;
    let subscribedUserId = null;

    const setupRealtime = (userId) => {
      if (!userId) {
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
        subscribedUserId = null;
        return;
      }

      // Avoid duplicate subscription if already subscribed for this user
      if (channel && subscribedUserId === userId) {
        return;
      }

      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      subscribedUserId = userId;

      const basePrefix = `workspace_realtime_${userId}`;
      if (typeof supabase.getChannels === 'function') {
        const existing = supabase.getChannels().filter(c => c.topic?.includes(basePrefix));
        existing.forEach(c => supabase.removeChannel(c));
      }

      const uniqueTopic = `${basePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      channel = supabase
        .channel(uniqueTopic)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workspace_snapshots',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            const incoming = payload.new?.data;
            if (incoming && typeof incoming === 'object') {
              const incomingJson = JSON.stringify({
                tasks: incoming.tasks || [],
                goals: incoming.goals || [],
                habits: incoming.habits || [],
                schedules: incoming.schedules || [],
                reflections: incoming.reflections || {},
                settings: incoming.settings || {},
                focusSessions: incoming.focusSessions || []
              });
              if (incomingJson !== lastSyncedJsonRef.current) {
                applyRemoteSnapshot(incoming, activeSession?.user?.user_metadata);
                setLastSyncedAt(Date.now());
              }
            }
          }
        )
        .subscribe();
    };

    const handleSession = (session) => {
      activeSession = session;
      loadWorkspace(session);
      setupRealtime(session?.user?.id);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) handleSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => handleSession(session));

    // When returning to tab/app (especially on mobile resume)
    const handleRecheck = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && activeSession?.user?.id) {
        loadWorkspace(activeSession);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleRecheck);
      document.addEventListener('visibilitychange', handleRecheck);
    }

    return () => {
      listener?.subscription?.unsubscribe();
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      subscribedUserId = null;
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleRecheck);
        document.removeEventListener('visibilitychange', handleRecheck);
      }
    };
  }, [loadWorkspace, applyRemoteSnapshot]);

  useEffect(() => {
    if (!isSupabaseConfigured || !cloudReady || !cloudUserId) return undefined;
    if (isApplyingRemoteRef.current) return undefined;

    const currentPayload = {
      tasks,
      goals,
      habits,
      reflections,
      settings,
      focusSessions,
      schedules
    };
    const currentJson = JSON.stringify(currentPayload);

    // Skip echo save if matches last synced state
    if (currentJson === lastSyncedJsonRef.current) {
      return undefined;
    }

    const timer = setTimeout(() => {
      supabase.from('workspace_snapshots').upsert({
        user_id: cloudUserId,
        version: 1,
        data: currentPayload
      }).then(({ error }) => {
        if (error) {
          console.error('Cloud workspace sync failed', error);
        } else {
          lastSyncedJsonRef.current = currentJson;
          setLastSyncedAt(Date.now());
        }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [cloudUserId, cloudReady, tasks, goals, habits, reflections, settings, focusSessions, schedules]);

  /* Toasts & Undo Stack */
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, options = {}) => {
    const id = 'toast-' + Date.now() + Math.random().toString(36).slice(2, 6);
    const newToast = { id, message, ...options };
    setToasts(prev => [...prev, newToast]);
    if (!options.persist) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, options.duration || 4500);
    }
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  /* ── Reactive Goal Metrics derived from Tasks & Habits (O(G + T + H)) ── */
  const reactiveGoals = useMemo(() => {
    // 1. Group tasks by goalId and goalTitle in single O(T) pass
    const tasksByGoal = new Map();
    const tasksByGoalTitle = new Map();
    const todayStr = todayKey();
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const isDone = isTaskCompletedForDate(t, todayStr);
      if (t.goalId !== undefined && t.goalId !== null && t.goalId !== '') {
        const gIdStr = String(t.goalId);
        let entry = tasksByGoal.get(gIdStr);
        if (!entry) {
          entry = { activeCount: 0, completedCount: 0, totalCount: 0, uncompletedTasks: [] };
          tasksByGoal.set(gIdStr, entry);
        }
        entry.totalCount++;
        if (isDone) {
          entry.completedCount++;
        } else {
          entry.activeCount++;
          entry.uncompletedTasks.push(t);
        }
      }
      if (t.goalTitle && typeof t.goalTitle === 'string') {
        const titleKey = t.goalTitle.trim().toLowerCase();
        let entry = tasksByGoalTitle.get(titleKey);
        if (!entry) {
          entry = { activeCount: 0, completedCount: 0, totalCount: 0, uncompletedTasks: [] };
          tasksByGoalTitle.set(titleKey, entry);
        }
        entry.totalCount++;
        if (isDone) {
          entry.completedCount++;
        } else {
          entry.activeCount++;
          entry.uncompletedTasks.push(t);
        }
      }
    }

    // 2. Index habits in single O(H) pass
    const habitsById = new Map();
    const habitsByGoalId = new Map();
    const habitsByGoalTitle = new Map();
    for (let i = 0; i < habits.length; i++) {
      const h = habits[i];
      habitsById.set(String(h.id), h);
      if (h.linkedGoalId !== undefined && h.linkedGoalId !== null && h.linkedGoalId !== '') {
        const gIdStr = String(h.linkedGoalId);
        let list = habitsByGoalId.get(gIdStr);
        if (!list) {
          list = [];
          habitsByGoalId.set(gIdStr, list);
        }
        list.push(h);
      }
      if (h.linkedGoal && typeof h.linkedGoal === 'string') {
        const cleanGoalName = h.linkedGoal.trim().toLowerCase();
        let list = habitsByGoalTitle.get(cleanGoalName);
        if (!list) {
          list = [];
          habitsByGoalTitle.set(cleanGoalName, list);
        }
        list.push(h);
      }
    }

    const nowMs = Date.now();

    // 3. Map goals in O(G)
    return goals.map(g => {
      const goalIdStr = String(g.id);
      const titleKey = g.title ? g.title.trim().toLowerCase() : '';
      const entry = tasksByGoal.get(goalIdStr) || (titleKey ? tasksByGoalTitle.get(titleKey) : null);
      const activeCount = entry ? entry.activeCount : 0;
      const completedCount = entry ? entry.completedCount : 0;
      const totalLinked = entry ? entry.totalCount : 0;

      // Find highest priority next task in single O(K) pass without array sort
      let nextTask = null;
      if (entry && entry.uncompletedTasks.length > 0) {
        let bestScore = Infinity;
        const uncompleted = entry.uncompletedTasks;
        for (let i = 0; i < uncompleted.length; i++) {
          const t = uncompleted[i];
          const due = t.dueDate === 'Today' ? 0 : t.dueDate === 'This Week' ? 1 : 2;
          const impact = t.impact === 'high' || t.priority === 'high' ? 0 : t.impact === 'medium' || t.priority === 'normal' ? 1 : 2;
          const score = due * 10 + impact;
          if (score < bestScore) {
            bestScore = score;
            nextTask = t;
          }
        }
      }

      // Linked habits lookup
      const linkedHabits = [];
      const seenHabitIds = new Set();
      if (Array.isArray(g.linkedHabitIds)) {
        for (let i = 0; i < g.linkedHabitIds.length; i++) {
          const h = habitsById.get(String(g.linkedHabitIds[i]));
          if (h && !seenHabitIds.has(String(h.id))) {
            seenHabitIds.add(String(h.id));
            linkedHabits.push(h);
          }
        }
      }
      const idHabits = habitsByGoalId.get(goalIdStr);
      if (idHabits) {
        for (let i = 0; i < idHabits.length; i++) {
          const h = idHabits[i];
          if (!seenHabitIds.has(String(h.id))) {
            seenHabitIds.add(String(h.id));
            linkedHabits.push(h);
          }
        }
      }
      if (titleKey) {
        const titleHabits = habitsByGoalTitle.get(titleKey);
        if (titleHabits) {
          for (let i = 0; i < titleHabits.length; i++) {
            const h = titleHabits[i];
            if (!seenHabitIds.has(String(h.id))) {
              seenHabitIds.add(String(h.id));
              linkedHabits.push(h);
            }
          }
        }
        for (let i = 0; i < habits.length; i++) {
          const h = habits[i];
          if (seenHabitIds.has(String(h.id))) continue;
          const cleanGoalName = (h.linkedGoal || '').replace(/^Horizon:\s*/i, '').trim().toLowerCase();
          if (cleanGoalName && (titleKey.includes(cleanGoalName) || cleanGoalName.includes(titleKey))) {
            seenHabitIds.add(String(h.id));
            linkedHabits.push(h);
          }
        }
      }

      // Compute daysLeft dynamically from targetDate
      let daysLeft = g.daysLeft;
      if (g.targetDate && g.dateType !== 'open') {
        const targetMs = new Date(`${g.targetDate}T23:59:59`).getTime();
        if (!isNaN(targetMs)) {
          daysLeft = Math.max(0, Math.ceil((targetMs - nowMs) / (1000 * 60 * 60 * 24)));
        }
      } else if (g.dateType === 'open') {
        daysLeft = null;
      }

      // Compute habit consistency score for linked habits (completed past 7 days)
      let habitAdherence = 100;
      if (linkedHabits.length > 0) {
        const todayStr = todayKey();
        let checkedCount = 0;
        for (let i = 0; i < linkedHabits.length; i++) {
          const lh = linkedHabits[i];
          if (Array.isArray(lh.completedDays) && lh.completedDays.includes(todayStr)) {
            checkedCount++;
          }
        }
        habitAdherence = Math.round((checkedCount / linkedHabits.length) * 100);
      }

      // Work progress: blended between deliverables (tasks) and rituals (habits)
      let workProgress = g.progress ?? 0;
      if (totalLinked > 0 && linkedHabits.length > 0) {
        const taskRate = Math.round((completedCount / totalLinked) * 100);
        workProgress = Math.round((taskRate * 0.7) + (habitAdherence * 0.3));
      } else if (totalLinked > 0) {
        workProgress = Math.round((completedCount / totalLinked) * 100);
      } else if (linkedHabits.length > 0) {
        workProgress = habitAdherence;
      } else {
        workProgress = g.workProgress ?? g.progress ?? 0;
      }

      // Dynamic velocity engine
      let velocity = g.velocity || 'on-track';
      if (workProgress === 100) {
        velocity = 'complete';
      } else if (g.dateType === 'open' || daysLeft === null) {
        velocity = workProgress >= 50 ? 'ahead' : 'on-track';
      } else if (daysLeft !== null && daysLeft <= 14 && activeCount >= 2 && workProgress < 40) {
        velocity = 'behind';
      } else if (workProgress >= 65) {
        velocity = 'ahead';
      } else {
        velocity = 'on-track';
      }

      return {
        ...g,
        tasksActive: activeCount,
        linkedTaskCount: totalLinked,
        completedTaskCount: completedCount,
        workProgress,
        daysLeft,
        velocity,
        nextTask,
        linkedHabits
      };
    });
  }, [goals, tasks, habits]);

  /* Tasks Actions */
  const addTask = useCallback((task) => {
    const newId = task.id || Date.now();
    const fullTask = { ...task, id: newId, createdAt: task.createdAt || Date.now() };
    setTasks(prev => [fullTask, ...prev]);
    learnFromTaskSave(fullTask);
    showToast(`Task added: "${task.title}"`);
    return newId;
  }, [setTasks, showToast]);

  const toggleTask = useCallback((id, targetDateKey = null, forceCompleted = null) => {
    const target = tasks.find(t => String(t.id) === String(id));
    if (!target) return;
    const isRecurring = Boolean(target.recurrence && target.recurrence !== 'none');
    const today = targetDateKey || todayKey();

    let isNowCompleted;
    if (isRecurring) {
      const dates = Array.isArray(target.completedDates) ? target.completedDates : [];
      const alreadyChecked = dates.includes(today);
      isNowCompleted = forceCompleted !== null ? Boolean(forceCompleted) : !alreadyChecked;
      if (isNowCompleted === alreadyChecked) return;
    } else {
      isNowCompleted = forceCompleted !== null ? Boolean(forceCompleted) : !target.completed;
      if (isNowCompleted === target.completed) return;
    }

    const linkedHabit = target.linkedHabitId ? habits.find(h => String(h.id) === String(target.linkedHabitId)) : null;

    if (isNowCompleted && settings.soundEffects) playChime('complete');
    setTasks(prev => prev.map(t => {
      if (String(t.id) !== String(id)) return t;
      if (isRecurring) {
        const dates = Array.isArray(t.completedDates) ? t.completedDates : [];
        const nextDates = isNowCompleted
          ? (dates.includes(today) ? dates : [...dates, today])
          : dates.filter(d => d !== today);
        return {
          ...t,
          completedDates: nextDates,
          completed: today === todayKey() ? isNowCompleted : t.completed,
          completedAt: isNowCompleted ? Date.now() : t.completedAt
        };
      }
      return {
        ...t,
        completed: isNowCompleted,
        completedAt: isNowCompleted ? Date.now() : null
      };
    }));

    if (linkedHabit) {
      setHabits(prev => prev.map(h => {
        if (String(h.id) !== String(target.linkedHabitId)) return h;
        const days = h.completedDays || [];
        if (isNowCompleted) {
          return days.includes(today) ? h : { ...h, completedDays: [...days, today] };
        } else {
          return { ...h, completedDays: days.filter(d => d !== today) };
        }
      }));
      if (isNowCompleted && !(linkedHabit.completedDays || []).includes(today)) {
        showToast(`Task complete. ${linkedHabit.title} checked in.`);
      }
    }
  }, [tasks, habits, setTasks, setHabits, settings.soundEffects, showToast]);

  const deleteTask = useCallback((id, options = {}) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;

    const mode = options?.mode || 'all'; // 'this' | 'following' | 'all'
    const targetDate = options?.targetDate || taskPlanDate(target) || todayPlanDate();

    if (mode === 'this') {
      const existing = Array.isArray(target.excludedDates) ? target.excludedDates : [];
      if (!existing.includes(targetDate)) {
        const updatedExcluded = [...existing, targetDate];
        setTasks(prev => prev.map(t => t.id === id ? { ...t, excludedDates: updatedExcluded } : t));
        showToast(`Deleted occurrence on ${planDateLabel(targetDate)}`, {
          actionLabel: 'Undo',
          onAction: () => {
            setTasks(prev => prev.map(t => t.id === id ? { ...t, excludedDates: existing } : t));
            showToast('Occurrence restored');
          }
        });
      }
      return;
    }

    if (mode === 'following') {
      const baseDate = taskPlanDate(target);
      if (!baseDate || targetDate <= baseDate) {
        setTasks(prev => prev.filter(t => t.id !== id));
        showToast(`Deleted "${target.title}" and all events`, {
          actionLabel: 'Undo',
          onAction: () => {
            setTasks(prev => [target, ...prev]);
            showToast('Task restored');
          }
        });
        return;
      }

      const prevUntil = target.recurrenceUntil || null;
      setTasks(prev => prev.map(t => t.id === id ? { ...t, recurrenceUntil: targetDate } : t));
      showToast(`Deleted from ${planDateLabel(targetDate)} onward`, {
        actionLabel: 'Undo',
        onAction: () => {
          setTasks(prev => prev.map(t => t.id === id ? { ...t, recurrenceUntil: prevUntil } : t));
          showToast('Recurring series restored');
        }
      });
      return;
    }

    // Default: 'all'
    setTasks(prev => prev.filter(t => t.id !== id));
    showToast(`Deleted "${target.title}"`, {
      actionLabel: 'Undo',
      onAction: () => {
        setTasks(prev => [target, ...prev]);
        showToast('Task restored');
      }
    });
  }, [tasks, setTasks, showToast]);

  const deleteTasks = useCallback((ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const idSet = new Set(ids.map(String));
    const toDelete = tasks.filter(t => idSet.has(String(t.id)));
    if (toDelete.length === 0) return;

    setTasks(prev => prev.filter(t => !idSet.has(String(t.id))));
    showToast(`Deleted ${toDelete.length} task${toDelete.length === 1 ? '' : 's'}`, {
      actionLabel: 'Undo',
      onAction: () => {
        setTasks(prev => [...toDelete, ...prev]);
        showToast('Restored tasks');
      }
    });
  }, [tasks, setTasks, showToast]);

  const updateTask = useCallback((id, patch) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          const merged = { ...t, ...patch };
          learnFromTaskSave(merged);
          return merged;
        }
        return t;
      });
      return updated;
    });
    showToast('Task updated');
  }, [setTasks, showToast]);

  const toggleSubtask = useCallback((taskId, subtaskId) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const subtasks = (t.subtasks || []).map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
      return { ...t, subtasks };
    }));
  }, [setTasks]);

  const reorderTasks = useCallback((orderedIds) => {
    setTasks(prev => {
      const taskMap = new Map(prev.map(t => [t.id, t]));
      const reordered = [];
      orderedIds.forEach(id => {
        const t = taskMap.get(id);
        if (t) {
          reordered.push(t);
          taskMap.delete(id);
        }
      });
      taskMap.forEach(t => reordered.push(t));
      return reordered;
    });
  }, [setTasks]);

  const moveTaskToBacklog = useCallback((id) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (String(t.id) === String(id)) {
          const merged = {
            ...t,
            plannedDate: null,
            date: null,
            dueDate: 'Someday',
            startTime: null,
            endTime: null,
            isBacklog: true
          };
          learnFromTaskSave(merged);
          return merged;
        }
        return t;
      });
      return updated;
    });
    showToast('Task moved to backlog');
  }, [setTasks, showToast]);

  const sweepMissedTasksToBacklog = useCallback((taskIds = []) => {
    if (!taskIds.length) return;
    const targetSet = new Set(taskIds.map(String));
    setTasks(prev => prev.map(t => targetSet.has(String(t.id)) ? {
      ...t,
      plannedDate: null,
      date: null,
      dueDate: 'Someday',
      startTime: null,
      endTime: null,
      isBacklog: true
    } : t));
    showToast(`${taskIds.length} tasks moved to backlog`);
  }, [setTasks, showToast]);

  /* Schedule / Timetable Actions */
  const addSchedule = useCallback((sched) => {
    const newId = sched.id || `sched-${Date.now()}`;
    const fullSched = {
      ...sched,
      id: newId,
      createdAt: sched.createdAt || Date.now(),
      type: 'schedule'
    };
    setSchedules(prev => [fullSched, ...prev]);
    showToast(`Schedule added: "${sched.title}"`);
    return newId;
  }, [setSchedules, showToast]);

  const updateSchedule = useCallback((id, patch) => {
    setSchedules(prev => prev.map(s => String(s.id) === String(id) ? { ...s, ...patch } : s));
  }, [setSchedules]);

  const deleteSchedule = useCallback((id) => {
    setSchedules(prev => prev.filter(s => String(s.id) !== String(id)));
    showToast('Schedule block removed');
  }, [setSchedules, showToast]);

  const deleteSchedules = useCallback((ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const idSet = new Set(ids.map(String));
    const toDelete = schedules.filter(s => idSet.has(String(s.id)));
    if (toDelete.length === 0) return;

    setSchedules(prev => prev.filter(s => !idSet.has(String(s.id))));
    showToast(`Deleted ${toDelete.length} schedule${toDelete.length === 1 ? '' : 's'}`, {
      actionLabel: 'Undo',
      onAction: () => {
        setSchedules(prev => [...toDelete, ...prev]);
        showToast('Restored schedules');
      }
    });
  }, [schedules, setSchedules, showToast]);

  /* Goals Actions */
  const addGoal = useCallback((goalData) => {
    const newId = goalData.id || ('g' + Date.now() + Math.random().toString(36).slice(2, 7));
    const { initialTasks = [], linkedHabitIds = [], ...rest } = goalData;

    const createdGoal = {
      ...rest,
      id: newId,
      categories: Array.isArray(rest.categories) && rest.categories.length ? rest.categories : [rest.category || 'career'],
      linkedHabitIds: Array.isArray(linkedHabitIds) ? linkedHabitIds : [],
      progress: 0,
      createdAt: Date.now()
    };

    setGoals(prev => [...prev, createdGoal]);
    learnFromGoalSave(createdGoal);

    if (Array.isArray(linkedHabitIds) && linkedHabitIds.length > 0 && createdGoal.title) {
      const idSet = new Set(linkedHabitIds.map(String));
      setHabits(prev => prev.map(h => idSet.has(String(h.id)) ? { ...h, linkedGoal: createdGoal.title } : h));
    }

    // If initial tasks provided, auto-create linked tasks in Planner
    if (Array.isArray(initialTasks) && initialTasks.length > 0) {
      const formattedTasks = initialTasks
        .filter(t => t && (typeof t === 'string' ? t.trim() : t.title?.trim()))
        .map((t, idx) => {
          const title = typeof t === 'string' ? t.trim() : t.title.trim();
          return {
            id: Date.now() + idx + 1,
            title,
            goalId: newId,
            completed: false,
            dueDate: 'This Week',
            priority: 'normal',
            energy: 'Medium',
            areas: createdGoal.categories,
            createdAt: Date.now() + idx
          };
        });
      if (formattedTasks.length > 0) {
        setTasks(prev => [...formattedTasks, ...prev]);
        formattedTasks.forEach(ft => learnFromTaskSave(ft));
      }
    }

    showToast(`Goal created: "${createdGoal.title}"`);
    return newId;
  }, [setGoals, setHabits, setTasks, showToast]);

  const updateGoal = useCallback((id, patch) => {
    const target = goals.find(g => String(g.id) === String(id));
    if (target) {
      learnFromGoalSave({ ...target, ...patch });
    }
    const nextTitle = patch.title || target?.title || '';
    setGoals(prev => prev.map(g => String(g.id) === String(id) ? { ...g, ...patch } : g));
    if (Array.isArray(patch.linkedHabitIds)) {
      const nextIdSet = new Set(patch.linkedHabitIds.map(String));
      const oldTitleLower = (target?.title || '').trim().toLowerCase();
      setHabits(prev => prev.map(h => {
        if (nextIdSet.has(String(h.id))) {
          return { ...h, linkedGoal: nextTitle || h.linkedGoal };
        }
        const hGoalLower = (h.linkedGoal || '').trim().toLowerCase();
        const wasLinked = (Array.isArray(target?.linkedHabitIds) && target.linkedHabitIds.some(hid => String(hid) === String(h.id))) ||
          (oldTitleLower && hGoalLower && (hGoalLower === oldTitleLower || oldTitleLower.includes(hGoalLower) || hGoalLower.includes(oldTitleLower)));
        if (wasLinked) {
          return { ...h, linkedGoal: '' };
        }
        return h;
      }));
    } else if (patch.title && target && patch.title !== target.title) {
      setHabits(prev => prev.map(h => {
        if (String(h.linkedGoalId) === String(id) || h.linkedGoal === target.title) {
          return { ...h, linkedGoal: patch.title };
        }
        return h;
      }));
    }
    showToast('Goal updated');
  }, [goals, setGoals, setHabits, showToast]);

  const updateGoalProgress = useCallback((id, delta) => {
    setGoals(prev => prev.map(g =>
      String(g.id) === String(id) ? { ...g, progress: Math.max(0, Math.min(100, (g.progress || 0) + delta)) } : g
    ));
  }, [setGoals]);

  const deleteGoal = useCallback((id, options = { cascade: false }) => {
    const target = goals.find(g => String(g.id) === String(id));
    if (!target) return;

    const previousGoals = goals;
    const previousTasks = tasks;
    const previousHabits = habits;

    const shouldCascade = Boolean(options?.cascade);

    // 1. Remove Goal
    setGoals(prev => prev.filter(g => String(g.id) !== String(id)));

    // 2. Cascade or Unlink Tasks
    if (shouldCascade) {
      setTasks(prev => prev.filter(t => String(t.goalId) !== String(id)));
    } else {
      setTasks(prev => prev.map(t => String(t.goalId) === String(id) ? { ...t, goalId: null } : t));
    }

    // 3. Cascade or Unlink Habits (by goalId or matching linkedGoal title)
    if (shouldCascade) {
      setHabits(prev => prev.filter(h => {
        if (h.goalId && String(h.goalId) === String(id)) return false;
        if (h.linkedGoal && target.title && h.linkedGoal.toLowerCase().includes(target.title.toLowerCase().slice(0, 8))) return false;
        return true;
      }));
    } else {
      setHabits(prev => prev.map(h => {
        if (h.goalId && String(h.goalId) === String(id)) return { ...h, goalId: null, linkedGoal: null };
        return h;
      }));
    }

    showToast(`Goal deleted: "${target.title}"`, {
      actionLabel: 'Undo',
      onAction: () => {
        setGoals(previousGoals);
        setTasks(previousTasks);
        setHabits(previousHabits);
        showToast('Goal restored');
      }
    });
  }, [goals, tasks, habits, setGoals, setTasks, setHabits, showToast]);

  /* Habits Actions */
  const checkInHabit = useCallback((id, targetDateKey = null, forceDone = null) => {
    const targetDay = targetDateKey || todayKey();
    const target = habits.find(h => String(h.id) === String(id));
    if (!target) return;

    const days = target.completedDays || [];
    const alreadyChecked = days.includes(targetDay);
    const isCheckingIn = forceDone !== null ? Boolean(forceDone) : !alreadyChecked;
    if (isCheckingIn === alreadyChecked) return;

    if (isCheckingIn && settings.soundEffects) {
      playChime('complete');
    }

    setHabits(prev => prev.map(h => {
      if (String(h.id) !== String(id)) return h;
      const hDays = h.completedDays || [];
      if (!isCheckingIn) {
        return { ...h, completedDays: hDays.filter(d => d !== targetDay) };
      }
      return { ...h, completedDays: hDays.includes(targetDay) ? hDays : [...hDays, targetDay] };
    }));

    // Auto sync scheduled tasks linked to this habit
    setTasks(prev => prev.map(t => {
      if (String(t.linkedHabitId) === String(id)) {
        const isRecurring = Boolean(t.recurrence && t.recurrence !== 'none');
        if (isRecurring) {
          const tDates = Array.isArray(t.completedDates) ? t.completedDates : [];
          const nextDates = isCheckingIn
            ? (tDates.includes(targetDay) ? tDates : [...tDates, targetDay])
            : tDates.filter(d => d !== targetDay);
          return {
            ...t,
            completedDates: nextDates,
            completed: targetDay === todayKey() ? isCheckingIn : t.completed,
            completedAt: isCheckingIn ? Date.now() : t.completedAt
          };
        } else if (targetDay === todayKey() || t.plannedDate === targetDay) {
          return {
            ...t,
            completed: isCheckingIn,
            completedAt: isCheckingIn ? Date.now() : null
          };
        }
      }
      return t;
    }));
  }, [habits, setHabits, setTasks, settings.soundEffects]);

  const addHabit = useCallback((habit) => {
    const newId = habit.id || ('h' + Date.now() + Math.random().toString(36).slice(2, 7));
    const newHabit = {
      completedDays: [],
      graceDays: habit.graceDays ?? 1,
      colorToken: habit.colorToken || 'primary',
      ...habit,
      id: newId
    };
    setHabits(prev => [...prev, newHabit]);
    if (newHabit.linkedGoal) {
      const targetTitle = newHabit.linkedGoal.trim().toLowerCase();
      setGoals(prev => prev.map(g => {
        const gt = (g.title || '').trim().toLowerCase();
        const isMatch = gt && targetTitle && (gt === targetTitle || gt.includes(targetTitle) || targetTitle.includes(gt));
        if (!isMatch) return g;
        const existing = Array.isArray(g.linkedHabitIds) ? g.linkedHabitIds : [];
        if (existing.some(hid => String(hid) === String(newId))) return g;
        return { ...g, linkedHabitIds: [...existing, newId] };
      }));
    }
    learnFromHabitSave(newHabit);
    showToast(`Habit added: "${habit.title}"`);
    return newId;
  }, [setHabits, setGoals, showToast]);

  const updateHabit = useCallback((id, patch) => {
    const target = habits.find(h => String(h.id) === String(id));
    if (target) {
      learnFromHabitSave({ ...target, ...patch });
    }
    setHabits(prev => prev.map(h => String(h.id) === String(id) ? { ...h, ...patch } : h));
    if (patch.linkedGoal !== undefined) {
      const targetTitle = (patch.linkedGoal || '').trim().toLowerCase();
      setGoals(prev => prev.map(g => {
        const gt = (g.title || '').trim().toLowerCase();
        const existing = Array.isArray(g.linkedHabitIds) ? g.linkedHabitIds : [];
        const isMatch = Boolean(gt && targetTitle && (gt === targetTitle || gt.includes(targetTitle) || targetTitle.includes(gt)));
        const hasId = existing.some(hid => String(hid) === String(id));
        if (isMatch && !hasId) {
          return { ...g, linkedHabitIds: [...existing, id] };
        }
        if (!isMatch && hasId) {
          return { ...g, linkedHabitIds: existing.filter(hid => String(hid) !== String(id)) };
        }
        return g;
      }));
    }
    showToast('Habit updated');
  }, [habits, setHabits, setGoals, showToast]);

  const deleteHabit = useCallback((id) => {
    const target = habits.find(h => String(h.id) === String(id));
    if (!target) return;
    setHabits(prev => prev.filter(h => String(h.id) !== String(id)));
    setGoals(prev => prev.map(g => {
      if (!Array.isArray(g.linkedHabitIds)) return g;
      if (!g.linkedHabitIds.some(hid => String(hid) === String(id))) return g;
      return { ...g, linkedHabitIds: g.linkedHabitIds.filter(hid => String(hid) !== String(id)) };
    }));
    showToast(`Habit deleted: "${target.title}"`, {
      actionLabel: 'Undo',
      onAction: () => {
        setHabits(prev => [target, ...prev]);
        showToast('Habit restored');
      }
    });
  }, [habits, setHabits, setGoals, showToast]);

  const useGraceDay = useCallback((id) => {
    setHabits(prev => prev.map(h =>
      String(h.id) === String(id) && h.graceDays > 0
        ? { ...h, graceDays: h.graceDays - 1 }
        : h
    ));
    showToast('Grace day applied');
  }, [setHabits, showToast]);

  /* Settings Actions */
  const updateSettings = useCallback((patch) => {
    setSettings(prev => ({ ...prev, ...patch }));
    showToast('Settings saved');
  }, [setSettings, showToast]);

  const updateProfile = useCallback((patch) => {
    setSettings(prev => ({ ...prev, profile: { ...prev.profile, ...patch } }));
  }, [setSettings]);

  const updateCustomUiLayout = useCallback((blockId, layoutStyles) => {
    if (!blockId) return;
    setSettings(prev => ({
      ...prev,
      customUiLayout: {
        ...(prev?.customUiLayout || {}),
        [blockId]: {
          ...(prev?.customUiLayout?.[blockId] || {}),
          ...layoutStyles
        }
      }
    }));
  }, [setSettings]);

  const resetCustomUiLayout = useCallback((blockId) => {
    setSettings(prev => {
      if (!blockId) {
        return { ...prev, customUiLayout: {} };
      }
      const next = { ...(prev?.customUiLayout || {}) };
      delete next[blockId];
      return { ...prev, customUiLayout: next };
    });
    showToast(blockId ? 'Block size reset to default' : 'All custom layouts reset to default');
  }, [setSettings, showToast]);

  /* Reflections Actions */
  const updateReflection = useCallback((patch) => {
    setReflections(prev => ({ ...prev, ...patch }));
  }, [setReflections]);

  const saveWeeklyReview = useCallback((reviewRecord) => {
    setReflections(prev => ({
      ...prev,
      history: [reviewRecord, ...(prev.history || [])]
    }));
    showToast('Weekly review archived to history');
  }, [setReflections, showToast]);

  /* Full Backup & Restore */
  const exportFullBackup = useCallback(() => {
    const backup = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      tasks,
      goals,
      habits,
      schedules,
      reflections,
      settings,
      focusSessions
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Momentum-Backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Full backup exported successfully');
  }, [tasks, goals, habits, schedules, reflections, settings, focusSessions, showToast]);

  const importFullBackup = useCallback((jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') throw new Error('Backup must be an object');
      for (const key of ['tasks', 'goals', 'habits']) {
        if (!Array.isArray(data[key])) throw new Error(`Backup ${key} must be an array`);
      }
      if (!data.reflections || typeof data.reflections !== 'object' || Array.isArray(data.reflections)) {
        throw new Error('Backup reflections must be an object');
      }
      if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
        throw new Error('Backup settings must be an object');
      }
      if (data.focusSessions !== undefined && !Array.isArray(data.focusSessions)) {
        throw new Error('Backup focusSessions must be an array');
      }
      if (data.schedules !== undefined && !Array.isArray(data.schedules)) {
        throw new Error('Backup schedules must be an array');
      }
      setTasks(data.tasks);
      setGoals(data.goals);
      setHabits(data.habits);
      setReflections(data.reflections);
      setSettings(data.settings);
      setFocusSessions(data.focusSessions || []);
      if (Array.isArray(data.schedules)) {
        setSchedules(data.schedules);
      }
      showToast('Backup restored successfully');
      return true;
    } catch (err) {
      showToast('Failed to parse backup file', { type: 'error' });
      return false;
    }
  }, [setTasks, setGoals, setHabits, setSchedules, setReflections, setSettings, setFocusSessions, showToast]);

  /* Reset & Clean Slate */
  const resetAllData = useCallback(() => {
    const today = todayKey();
    const sample = generateRichSampleWorkspace(today);
    setTasks(sample.tasks);
    setGoals(sample.goals);
    setHabits(sample.habits);
    setSchedules(sample.schedules);
    setReflections(sample.reflections);
    setSettings(DEFAULT_SETTINGS);
    setFocusSessions(sample.focusSessions);
    showToast('All data reset to initial baseline with all edge features');
  }, [setTasks, setGoals, setHabits, setSchedules, setReflections, setSettings, setFocusSessions, showToast]);

  const clearAllData = useCallback(() => {
    setTasks([]);
    setGoals([]);
    setHabits([]);
    setSchedules([]);
    setFocusSessions([]);
    setReflections({
      currentWeek: '2026-W37',
      moodRatings: {},
      workedWell: '',
      pushedBack: '',
      pushedBackReason: 'Low Energy',
      onePriority: '',
      targetGoalId: '',
      frictionTask: '',
      history: []
    });
    resetNlpMemory();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('momentum_goal_life_areas');
    }
    showToast('Workspace wiped clean. Ready for your personal setup.');
  }, [setTasks, setGoals, setHabits, setReflections, setFocusSessions, showToast]);

  const loadDemoData = useCallback(() => {
    const today = todayKey();
    const sample = generateRichSampleWorkspace(today);
    setTasks(sample.tasks);
    setGoals(sample.goals);
    setHabits(sample.habits);
    setSchedules(sample.schedules);
    setReflections(sample.reflections);
    setFocusSessions(sample.focusSessions);
    showToast('Sample demo workspace restored with all edge features');
  }, [setTasks, setGoals, setHabits, setSchedules, setReflections, setFocusSessions, showToast]);

  /* ── Focus Timer Engine ── */
  const defaultFocusSeconds = (settings.focusLength || 45) * 60;
  const [timerState, setTimerState] = useState({
    isRunning: false,
    timeLeft: defaultFocusSeconds,
    duration: defaultFocusSeconds,
    mode: 'focus', // 'focus' | 'break'
    activeTaskId: null,
    endsAt: null
  });

  // Sync default duration when settings change and timer is stopped
  useEffect(() => {
    if (!timerState.isRunning && timerState.mode === 'focus') {
      const newSec = (settings.focusLength || 45) * 60;
      setTimerState(prev => ({ ...prev, duration: newSec, timeLeft: newSec, endsAt: null }));
    }
  }, [settings.focusLength]);

  // Interval ticker
  useEffect(() => {
    if (!timerState.isRunning) return;

    const interval = setInterval(() => {
      setTimerState(prev => {
        const remaining = prev.endsAt ? Math.max(0, Math.ceil((prev.endsAt - Date.now()) / 1000)) : prev.timeLeft;
        if (remaining <= 0) {
          // Timer finished!
          if (prev.mode === 'focus') {
            const finishedMinutes = Math.round(prev.duration / 60) || 45;
            setFocusSessions(sessions => [
              {
                id: 'f-' + Date.now(),
                taskId: prev.activeTaskId,
                durationMinutes: finishedMinutes,
                timestamp: Date.now()
              },
              ...sessions
            ]);
          }

          if (settings.soundEffects) {
            playChime('timerEnd');
          }
          if (settings.desktopNotifications) {
            sendNotification('Focus Sprint Concluded!', {
              body: prev.mode === 'focus' ? 'Great focus! Take a 5m recovery break.' : 'Break over! Ready for your next deep work sprint.'
            });
          }
          showToast(prev.mode === 'focus' ? '🎉 Focus session logged to daily target!' : '⚡ Break ended!');

          if (settings.autoBreaks && prev.mode === 'focus') {
            return {
              ...prev,
              isRunning: true,
              mode: 'break',
              duration: 5 * 60,
              timeLeft: 5 * 60,
              endsAt: Date.now() + 5 * 60 * 1000
            };
          }
          return {
            ...prev,
            isRunning: false,
            timeLeft: 0,
            endsAt: null
          };
        }
        return remaining === prev.timeLeft ? prev : { ...prev, timeLeft: remaining };
      });
    }, 250);

    return () => clearInterval(interval);
  }, [timerState.isRunning, settings.soundEffects, settings.desktopNotifications, settings.autoBreaks, showToast]);

  const startTimer = useCallback(() => {
    setTimerState(prev => ({ ...prev, isRunning: true, endsAt: Date.now() + prev.timeLeft * 1000 }));
  }, []);

  const pauseTimer = useCallback(() => {
    setTimerState(prev => ({
      ...prev,
      isRunning: false,
      timeLeft: prev.endsAt ? Math.max(0, Math.ceil((prev.endsAt - Date.now()) / 1000)) : prev.timeLeft,
      endsAt: null
    }));
  }, []);

  const resetTimer = useCallback(() => {
    setTimerState(prev => {
      const sec = prev.mode === 'focus' ? (settings.focusLength || 45) * 60 : 5 * 60;
      return { ...prev, isRunning: false, timeLeft: sec, duration: sec, endsAt: null };
    });
  }, [settings.focusLength]);

  const switchTimerMode = useCallback((mode) => {
    const sec = mode === 'focus' ? (settings.focusLength || 45) * 60 : 5 * 60;
    setTimerState(prev => ({
      ...prev,
      mode,
      duration: sec,
      timeLeft: sec,
      isRunning: false,
      endsAt: null
    }));
  }, [settings.focusLength]);

  const setTimerTaskId = useCallback((id) => {
    setTimerState(prev => ({ ...prev, activeTaskId: id }));
  }, []);

  /* Computed stats (single-pass O(N) time, O(1) extra space) */
  const stats = useMemo(() => {
    let completed = 0;
    let highPriority = 0;
    let normalPriority = 0;
    let lowPriority = 0;
    const total = tasks.length;

    for (let i = 0; i < total; i++) {
      const t = tasks[i];
      if (isTaskCompletedForDate(t, todayKey())) {
        completed++;
      } else {
        if (t.priority === 'high') highPriority++;
        else if (t.priority === 'normal') normalPriority++;
        else if (t.priority === 'low') lowPriority++;
      }
    }
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    let goalsOnTrack = 0;
    const totalGoals = reactiveGoals.length;
    for (let i = 0; i < totalGoals; i++) {
      if (reactiveGoals[i].velocity !== 'behind') goalsOnTrack++;
    }

    const today = todayKey();
    let longestStreak = 0;
    let habitsCompletedToday = 0;
    const totalHabits = habits.length;
    const habitStreaks = new Array(totalHabits);

    for (let i = 0; i < totalHabits; i++) {
      const h = habits[i];
      const streak = calcStreak(h.completedDays);
      const isCompletedToday = (h.completedDays || []).includes(today);
      if (streak > longestStreak) longestStreak = streak;
      if (isCompletedToday) habitsCompletedToday++;
      habitStreaks[i] = {
        id: h.id,
        streak,
        completedToday: isCompletedToday,
      };
    }

    const habitRate = totalHabits > 0 ? Math.round((habitsCompletedToday / totalHabits) * 100) : 0;
    const goalRate = totalGoals > 0 ? Math.round((goalsOnTrack / totalGoals) * 100) : 0;
    const momentumScore = Math.round((completionRate * 0.4) + (goalRate * 0.3) + (habitRate * 0.3));

    // Real logged focus time today
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    let completedFocusMinutes = 0;
    let focusSessionsCount = 0;
    for (let i = 0; i < focusSessions.length; i++) {
      const s = focusSessions[i];
      if (s.timestamp >= startOfToday) {
        completedFocusMinutes += s.durationMinutes || 0;
        focusSessionsCount++;
      }
    }
    const completedFocusHours = Number((completedFocusMinutes / 60).toFixed(1));

    return {
      total, completed, pending, highPriority, normalPriority, lowPriority,
      completionRate, goalsOnTrack, totalGoals,
      habitStreaks, longestStreak, habitsCompletedToday,
      totalHabits,
      momentumScore,
      completedFocusMinutes,
      completedFocusHours,
      focusSessionsCount,
    };
  }, [tasks, reactiveGoals, habits, focusSessions]);

  // Advanced Intelligence Graphs & Guards
  const lifeGraph = useMemo(() => {
    return buildLifeGraph({ tasks, goals: reactiveGoals, habits, schedules });
  }, [tasks, reactiveGoals, habits, schedules]);

  const capacityLoad = useMemo(() => {
    return evaluateCapacityLoad({
      tasks,
      schedules,
      date: todayPlanDate(),
      dailyTargetHours: settings.dailyTarget || 6.0
    });
  }, [tasks, schedules, settings.dailyTarget]);

  const habitsAtRisk = useMemo(() => {
    return getHabitsAtRisk(habits, todayPlanDate());
  }, [habits]);

  const checkScheduleCollisions = useCallback((candidate, date = todayPlanDate()) => {
    return detectScheduleCollisions({ candidate, tasks, schedules, date });
  }, [tasks, schedules]);

  const getSuggestedTimeGap = useCallback((candidate, date = todayPlanDate()) => {
    return findOptimalTimeGap({ candidate, tasks, schedules, date });
  }, [tasks, schedules]);

  return {
    tasks, addTask, updateTask, toggleTask, deleteTask, deleteTasks, toggleSubtask, reorderTasks,
    moveTaskToBacklog, sweepMissedTasksToBacklog,
    schedules, addSchedule, updateSchedule, deleteSchedule, deleteSchedules,
    goals: reactiveGoals, addGoal, updateGoal, updateGoalProgress, deleteGoal,
    habits, checkInHabit, addHabit, updateHabit, deleteHabit, useGraceDay,
    reflections, updateReflection, saveWeeklyReview,
    settings, updateSettings, updateProfile,
    updateCustomUiLayout, resetCustomUiLayout,
    resetAllData, clearAllData, loadDemoData, stats,
    toasts, showToast, dismissToast,
    exportFullBackup, importFullBackup,
    focusSessions,
    focusTimer: {
      ...timerState,
      startTimer,
      pauseTimer,
      resetTimer,
      switchTimerMode,
      setTimerTaskId
    },
    // Quantum Intelligence Guards & Engines
    lifeGraph,
    capacityLoad,
    habitsAtRisk,
    checkScheduleCollisions,
    getSuggestedTimeGap,
    getCavemanMetrics,
    cloudSync: {
      isConnected: isSupabaseConfigured && Boolean(cloudUserId),
      userId: cloudUserId,
      email: cloudUserEmail,
      isSyncing: !cloudReady,
      lastSyncedAt,
      syncNow: async () => {
        if (!isSupabaseConfigured || !supabase) return;
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          await loadWorkspace(data.session);
          showToast('Workspace synced with cloud', { type: 'success' });
        }
      },
      signOut: async () => {
        if (!isSupabaseConfigured || !supabase) return;
        await supabase.auth.signOut();
        window.location.reload();
      }
    }
  };
}

/* Re-export helpers */
export {
  calcStreak,
  last7Days,
  todayKey,
  DAY_LABELS,
  detectScheduleCollisions,
  findOptimalTimeGap,
  computeHabitDecayMetrics,
  getHabitsAtRisk,
  evaluateCapacityLoad,
  buildLifeGraph,
  getCavemanMetrics
};
