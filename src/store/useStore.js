import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import { purgeLegacyGroqKey } from '../lib/groqClient.js';
import { resetNlpMemory, learnFromTaskSave, learnFromGoalSave, learnFromHabitSave } from '../lib/nlpMemory.js';
import { planDateLabel, taskPlanDate, todayPlanDate } from '../lib/taskMetadata.js';
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

const DEFAULT_TASKS = [
  {
    id: 1,
    title: 'Refine Q4 Product Roadmap',
    priority: 'high',
    category: 'Deep Work',
    goalId: 'g1',
    completed: false,
    dueDate: 'Today',
    startTime: '09:30',
    durationMinutes: 75,
    areas: ['Career & Craft', 'Deep Focus'],
    energy: 'High',
    notes: 'Prioritize feature matrix for mobile offline capability and sync protocol.',
    subtasks: [
      { id: 's1', title: 'Audit engineering backlog', completed: true },
      { id: 's2', title: 'Draft RFC document', completed: false }
    ],
    createdAt: Date.now() - 86400000
  },
  {
    id: 2,
    title: 'Sync with Engineering Leads on API migration',
    priority: 'high',
    category: 'Meetings',
    goalId: 'g4',
    completed: true,
    dueDate: 'Today',
    startTime: '11:15',
    durationMinutes: 45,
    areas: ['Career & Craft'],
    energy: 'Medium',
    notes: 'Discuss GraphQL vs REST gateway latency.',
    subtasks: [
      { id: 's21', title: 'Review latency metrics', completed: true },
      { id: 's22', title: 'Confirm fallback strategy', completed: true }
    ],
    createdAt: Date.now() - 172800000
  },
  {
    id: 3,
    title: 'Review Stitch AI design system tokens',
    priority: 'normal',
    category: 'Deep Work',
    goalId: 'g1',
    completed: false,
    dueDate: 'Today',
    startTime: '14:00',
    durationMinutes: 90,
    areas: ['Career & Craft', 'Creative & Expression'],
    energy: 'High',
    notes: 'Harmonize secondary fixed and container tokens.',
    subtasks: [
      { id: 's3', title: 'Color contrast check', completed: false },
      { id: 's4', title: 'Fix hero heading layout', completed: false }
    ],
    createdAt: Date.now() - 50000
  },
  {
    id: 4,
    title: 'Run tempo 5km cardio interval',
    priority: 'normal',
    category: 'Habits',
    goalId: 'g2',
    completed: false,
    dueDate: 'Today',
    startTime: '16:30',
    durationMinutes: 45,
    areas: ['Health & Vitality', 'Habit Consistency'],
    energy: 'High',
    notes: 'Heart rate target ~145 bpm.',
    subtasks: [
      { id: 's5', title: '10 min warm up dynamic stretches', completed: false },
      { id: 's6', title: '5km steady pace interval', completed: false }
    ],
    createdAt: Date.now() - 40000
  },
  {
    id: 5,
    title: 'Practice Fernando Sor Study in B minor',
    priority: 'low',
    category: 'Personal',
    goalId: 'g3',
    completed: false,
    dueDate: 'Tomorrow',
    startTime: '18:30',
    durationMinutes: 30,
    areas: ['Creative & Expression', 'Personal & Life'],
    energy: 'Low',
    notes: 'Tactile fingerstyle phrasing, 60 bpm.',
    subtasks: [
      { id: 's7', title: 'Tuning and posture check', completed: false },
      { id: 's8', title: 'Measure 1-16 fingering drill', completed: false }
    ],
    createdAt: Date.now() - 30000
  },
  {
    id: 6,
    title: 'Pick up running nutrition gel supplies',
    priority: 'low',
    category: 'Personal',
    goalId: 'g2',
    completed: false,
    dueDate: 'This Week',
    startTime: '17:00',
    durationMinutes: 25,
    areas: ['Personal & Life', 'Health & Vitality'],
    energy: 'Low',
    notes: 'Visit marathon store before Saturday long run.',
    subtasks: [],
    createdAt: Date.now() - 20000
  }
];

const DEFAULT_GOALS = [
  {
    id: 'g1', title: 'Ship Portfolio Website v3', category: 'career',
    why: 'To establish independent creative authority and ship craft at the highest level.',
    progress: 50, daysLeft: 14, targetDate: 'May 12',
    keyResults: 3, tasksActive: 2, velocity: 'ahead',
    icon: 'lightbulb', color: 'primary',
  },
  {
    id: 'g2', title: 'Run a Sub-1:45 Half Marathon', category: 'health',
    why: 'Build unbreakable physical stamina and mental endurance.',
    progress: 40, daysLeft: 38, targetDate: 'Jun 15',
    keyResults: 2, tasksActive: 1, velocity: 'on-track',
    icon: 'favorite', color: 'secondary',
  },
  {
    id: 'g3', title: 'Master Grade 3 Classical Guitar', category: 'creative',
    why: 'Anchor evenings in tactile, acoustic expression away from screens.',
    progress: 25, daysLeft: 58, targetDate: 'Jul 20',
    keyResults: 4, tasksActive: 1, velocity: 'behind',
    icon: 'music_note', color: 'tertiary',
  },
  {
    id: 'g4', title: 'Launch Personal Knowledge System', category: 'career',
    why: 'Build a second brain that compounds learning into leverage.',
    progress: 60, daysLeft: 22, targetDate: 'May 28',
    keyResults: 5, tasksActive: 0, velocity: 'on-track',
    icon: 'auto_stories', color: 'primary',
  },
  {
    id: 'g5', title: 'Complete Spanish B1 Certification', category: 'creative',
    why: 'Unlock travel fluency and cultural empathy across Latin America.',
    progress: 35, daysLeft: 45, targetDate: 'Jun 30',
    keyResults: 3, tasksActive: 0, velocity: 'behind',
    icon: 'translate', color: 'tertiary',
  },
];

const DEFAULT_HABITS = [
  {
    id: 'h1', title: 'Morning Deep Work', duration: '90 mins', durationMinutes: 90, startTime: '07:30', isTimeBlocked: true, icon: 'terminal',
    linkedGoal: 'Ship Portfolio', description: 'Autonomous creative focus before notification windows unlock.',
    completedDays: [], graceDays: 1, colorToken: 'primary',
  },
  {
    id: 'h2', title: 'Zone 2 Cardio / Running', duration: '45 mins', durationMinutes: 45, startTime: '16:30', isTimeBlocked: true, icon: 'directions_run',
    linkedGoal: 'Half Marathon', description: 'Sub-lactate threshold endurance builder at ~138 bpm.',
    completedDays: [], graceDays: 0, colorToken: 'secondary',
  },
  {
    id: 'h3', title: 'Evening Reading', duration: '30 mins', durationMinutes: 30, startTime: '21:30', isTimeBlocked: true, icon: 'auto_stories',
    linkedGoal: 'Knowledge System', description: 'Non-fiction synthesis and spaced repetition review.',
    completedDays: [], graceDays: 2, colorToken: 'tertiary',
  },
  {
    id: 'h4', title: 'Guitar Practice', duration: '25 mins', durationMinutes: 25, startTime: '18:30', isTimeBlocked: true, icon: 'music_note',
    linkedGoal: 'Classical Guitar', description: 'Deliberate fingerstyle etude practice with metronome.',
    completedDays: [], graceDays: 1, colorToken: 'secondary',
  },
];

const DEFAULT_REFLECTIONS = {
  currentWeek: '2026-W37',
  moodRatings: { 0: 4, 1: 5, 2: 4, 3: 3, 4: 5, 5: 4, 6: 4 }, // 0=Sun..6=Sat (1-5 scale)
  workedWell: 'Morning deep work block before 11 AM has been 90% reliable.',
  pushedBack: 'Guitar fingerstyle practice got rescheduled 3x due to late evening spillover.',
  pushedBackReason: 'Low Energy',
  onePriority: 'Finalize and launch the Portfolio Website v3 live release.',
  targetGoalId: 'g1',
  frictionTask: 'Syncing engineering team API migration schemas',
  history: [
    {
      id: 'ref-w36',
      week: '2026-W36',
      title: 'Week 36 Review — High Velocity',
      dateRange: 'Aug 31 – Sep 6, 2026',
      completedRate: 85,
      tasksDone: 17,
      tasksTotal: 20,
      momentumScore: 88,
      workedWell: 'Kept consistent 45m workout intervals every alternate evening.',
      pushedBack: 'Book reading backlog.',
      onePriority: 'Complete Stitch design tokens review.',
      targetGoal: 'Ship Portfolio Website v3'
    }
  ]
};

const DEFAULT_SETTINGS = {
  focusLength: 45,
  dailyTarget: 4.5,
  desktopNotifications: true,
  autoBreaks: true,
  soundEffects: true,
  showFocusBar: true,
  profile: {
    name: '',
    role: '',
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
  const [focusSessions, setFocusSessions] = useLocalStorage('momentum_focus_sessions', []);
  const [schedules, setSchedules] = useLocalStorage('momentum_schedules', []);
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
      // If cloud has schedules, adopt them.
      // If cloud has empty array but local has non-empty schedules (e.g. migration from local-only version),
      // preserve local schedules so migration doesn't wipe them.
      setSchedules(prev => (saved.schedules.length > 0 || !prev?.length ? saved.schedules : prev));
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

    const setupRealtime = (userId) => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      if (!userId) return;

      channel = supabase
        .channel(`workspace_realtime_${userId}`)
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

    supabase.auth.getSession().then(({ data }) => handleSession(data.session));
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
      if (channel) supabase.removeChannel(channel);
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
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (t.goalId !== undefined && t.goalId !== null && t.goalId !== '') {
        const gIdStr = String(t.goalId);
        let entry = tasksByGoal.get(gIdStr);
        if (!entry) {
          entry = { activeCount: 0, completedCount: 0, totalCount: 0, uncompletedTasks: [] };
          tasksByGoal.set(gIdStr, entry);
        }
        entry.totalCount++;
        if (t.completed) {
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
        if (t.completed) {
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

  const toggleTask = useCallback((id) => {
    const target = tasks.find(t => String(t.id) === String(id));
    if (!target) return;
    const isNowCompleted = !target.completed;
    const linkedHabit = target.linkedHabitId ? habits.find(h => String(h.id) === String(target.linkedHabitId)) : null;
    const today = todayKey();

    if (isNowCompleted && settings.soundEffects) playChime('complete');
    setTasks(prev => prev.map(t => String(t.id) === String(id) ? {
      ...t,
      completed: isNowCompleted,
      completedAt: isNowCompleted ? Date.now() : null
    } : t));

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
  }, [setGoals, setTasks, showToast]);

  const updateGoal = useCallback((id, patch) => {
    const target = goals.find(g => String(g.id) === String(id));
    if (target) {
      learnFromGoalSave({ ...target, ...patch });
    }
    setGoals(prev => prev.map(g => String(g.id) === String(id) ? { ...g, ...patch } : g));
    if (patch.title && target && patch.title !== target.title) {
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
  const checkInHabit = useCallback((id, targetDateKey = null) => {
    const targetDay = targetDateKey || todayKey();
    let isCheckingIn = false;

    setHabits(prev => prev.map(h => {
      if (String(h.id) !== String(id)) return h;
      const days = h.completedDays || [];
      const alreadyChecked = days.includes(targetDay);
      isCheckingIn = !alreadyChecked;
      if (!alreadyChecked && settings.soundEffects) {
        playChime('complete');
      }
      if (alreadyChecked) {
        return { ...h, completedDays: days.filter(d => d !== targetDay) };
      }
      return { ...h, completedDays: [...days, targetDay] };
    }));

    // Auto sync today's scheduled tasks linked to this habit
    if (targetDay === todayKey()) {
      setTasks(prev => prev.map(t => {
        if (String(t.linkedHabitId) === String(id)) {
          return {
            ...t,
            completed: isCheckingIn,
            completedAt: isCheckingIn ? Date.now() : null
          };
        }
        return t;
      }));
    }
  }, [setHabits, setTasks, settings.soundEffects]);

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
    learnFromHabitSave(newHabit);
    showToast(`Habit added: "${habit.title}"`);
    return newId;
  }, [setHabits, showToast]);

  const updateHabit = useCallback((id, patch) => {
    const target = habits.find(h => h.id === id);
    if (target) {
      learnFromHabitSave({ ...target, ...patch });
    }
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...patch } : h));
    showToast('Habit updated');
  }, [setHabits, showToast]);

  const deleteHabit = useCallback((id) => {
    const target = habits.find(h => h.id === id);
    if (!target) return;
    setHabits(prev => prev.filter(h => h.id !== id));
    showToast(`Habit deleted: "${target.title}"`, {
      actionLabel: 'Undo',
      onAction: () => {
        setHabits(prev => [target, ...prev]);
        showToast('Habit restored');
      }
    });
  }, [habits, setHabits, showToast]);

  const useGraceDay = useCallback((id) => {
    setHabits(prev => prev.map(h =>
      h.id === id && h.graceDays > 0
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
  }, [tasks, goals, habits, reflections, settings, focusSessions, showToast]);

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
      setTasks(data.tasks);
      setGoals(data.goals);
      setHabits(data.habits);
      setReflections(data.reflections);
      setSettings(data.settings);
      setFocusSessions(data.focusSessions || []);
      showToast('Backup restored successfully');
      return true;
    } catch (err) {
      showToast('Failed to parse backup file', { type: 'error' });
      return false;
    }
  }, [setTasks, setGoals, setHabits, setReflections, setSettings, showToast]);

  /* Reset & Clean Slate */
  const resetAllData = useCallback(() => {
    setTasks(DEFAULT_TASKS);
    setGoals(DEFAULT_GOALS);
    setHabits(DEFAULT_HABITS);
    setSchedules([]);
    setReflections(DEFAULT_REFLECTIONS);
    setSettings(DEFAULT_SETTINGS);
    setFocusSessions([]);
    showToast('All data reset to initial baseline');
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
    setTasks(DEFAULT_TASKS);
    setGoals(DEFAULT_GOALS);
    setHabits(DEFAULT_HABITS);
    setReflections(DEFAULT_REFLECTIONS);
    showToast('Sample demo workspace restored');
  }, [setTasks, setGoals, setHabits, setReflections, showToast]);

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
      if (t.completed) {
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
    tasks, addTask, updateTask, toggleTask, deleteTask, toggleSubtask, reorderTasks,
    moveTaskToBacklog, sweepMissedTasksToBacklog,
    schedules, addSchedule, updateSchedule, deleteSchedule,
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
