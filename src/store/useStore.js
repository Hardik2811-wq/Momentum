import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

/* ── localStorage wrapper ── */
function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
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
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  return new Date(`${key}T12:00:00`);
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
  const sorted = [...new Set(completedDays.filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day)))].sort().reverse();
  if (sorted.length === 0) return 0;
  const today = todayKey();
  const yesterday = shiftDateKey(today, -1);

  // streak must include today or yesterday
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === shiftDateKey(sorted[i - 1], -1)) {
      streak++;
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
    id: 'h1', title: 'Morning Deep Work', duration: '90 mins', icon: 'terminal',
    linkedGoal: 'Ship Portfolio', description: 'Autonomous creative focus before notification windows unlock.',
    completedDays: [], graceDays: 1, colorToken: 'primary',
  },
  {
    id: 'h2', title: 'Zone 2 Cardio / Running', duration: '45 mins', icon: 'directions_run',
    linkedGoal: 'Half Marathon', description: 'Sub-lactate threshold endurance builder at ~138 bpm.',
    completedDays: [], graceDays: 0, colorToken: 'secondary',
  },
  {
    id: 'h3', title: 'Evening Reading', duration: '30 mins', icon: 'auto_stories',
    linkedGoal: 'Knowledge System', description: 'Non-fiction synthesis and spaced repetition review.',
    completedDays: [], graceDays: 2, colorToken: 'tertiary',
  },
  {
    id: 'h4', title: 'Guitar Practice', duration: '25 mins', icon: 'music_note',
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
    name: 'Elena Vance',
    role: 'Product Lead',
    timezone: 'Europe / Paris (UTC+2)',
    workCycle: 'Q2 2026',
  },
};

/* ── Main store hook ── */
export default function useStore() {
  const [tasks, setTasks] = useLocalStorage('momentum_tasks', DEFAULT_TASKS);
  const [goals, setGoals] = useLocalStorage('momentum_goals', DEFAULT_GOALS);
  const [habits, setHabits] = useLocalStorage('momentum_habits', DEFAULT_HABITS);
  const [reflections, setReflections] = useLocalStorage('momentum_reflections', DEFAULT_REFLECTIONS);
  const [settings, setSettings] = useLocalStorage('momentum_settings', DEFAULT_SETTINGS);
  const [focusSessions, setFocusSessions] = useLocalStorage('momentum_focus_sessions', []);
  const [cloudUserId, setCloudUserId] = useState(null);
  const [cloudReady, setCloudReady] = useState(!isSupabaseConfigured);
  const cloudLoadRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const loadWorkspace = async (session) => {
      if (!session?.user?.id) {
        setCloudUserId(null);
        setCloudReady(true);
        return;
      }
      setCloudReady(false);
      const { data, error } = await supabase
        .from('workspace_snapshots')
        .select('data')
        .eq('user_id', session.user.id)
        .maybeSingle();
      const saved = data?.data;
      if (!error && saved && Array.isArray(saved.tasks) && Array.isArray(saved.goals) && Array.isArray(saved.habits)) {
        cloudLoadRef.current = true;
        setTasks(saved.tasks);
        setGoals(saved.goals);
        setHabits(saved.habits);
        if (saved.reflections && typeof saved.reflections === 'object') setReflections(saved.reflections);
        if (saved.settings && typeof saved.settings === 'object') setSettings(saved.settings);
        if (Array.isArray(saved.focusSessions)) setFocusSessions(saved.focusSessions);
      }
      setCloudUserId(session.user.id);
      setCloudReady(true);
    };
    supabase.auth.getSession().then(({ data }) => loadWorkspace(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => loadWorkspace(session));
    return () => listener.subscription.unsubscribe();
  }, [setTasks, setGoals, setHabits, setReflections, setSettings, setFocusSessions]);

  useEffect(() => {
    if (!isSupabaseConfigured || !cloudReady || !cloudUserId) return undefined;
    const timer = setTimeout(() => {
      supabase.from('workspace_snapshots').upsert({
        user_id: cloudUserId,
        version: 1,
        data: { tasks, goals, habits, reflections, settings, focusSessions }
      }).then(({ error }) => {
        if (error) console.error('Cloud workspace sync failed', error);
        cloudLoadRef.current = false;
      });
    }, cloudLoadRef.current ? 1200 : 500);
    return () => clearTimeout(timer);
  }, [cloudUserId, cloudReady, tasks, goals, habits, reflections, settings, focusSessions]);

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

  /* ── Reactive Goal Metrics derived from Tasks ── */
  const reactiveGoals = useMemo(() => {
    return goals.map(g => {
      const linked = tasks.filter(t => t.goalId === g.id);
      const activeCount = linked.filter(t => !t.completed).length;
      const completedCount = linked.filter(t => t.completed).length;
      const nextTask = linked.filter(t => !t.completed).slice().sort((a, b) => {
        const dueA = a.dueDate === 'Today' ? 0 : a.dueDate === 'This Week' ? 1 : 2;
        const dueB = b.dueDate === 'Today' ? 0 : b.dueDate === 'This Week' ? 1 : 2;
        if (dueA !== dueB) return dueA - dueB;
        const impactA = a.impact === 'high' || a.priority === 'high' ? 0 : a.impact === 'medium' || a.priority === 'normal' ? 1 : 2;
        const impactB = b.impact === 'high' || b.priority === 'high' ? 0 : b.impact === 'medium' || b.priority === 'normal' ? 1 : 2;
        return impactA - impactB;
      })[0] || null;
      return {
        ...g,
        tasksActive: activeCount,
        linkedTaskCount: linked.length,
        completedTaskCount: completedCount,
        workProgress: linked.length ? Math.round((completedCount / linked.length) * 100) : g.progress,
        nextTask
      };
    });
  }, [goals, tasks]);

  /* Tasks Actions */
  const addTask = useCallback((task) => {
    setTasks(prev => [{ ...task, id: Date.now(), createdAt: Date.now() }, ...prev]);
    showToast(`Task added: "${task.title}"`);
  }, [setTasks, showToast]);

  const toggleTask = useCallback((id) => {
    const target = tasks.find(t => t.id === id);
    const isNowCompleted = target ? !target.completed : false;
    const linkedHabit = target?.linkedHabitId ? habits.find(h => h.id === target.linkedHabitId) : null;
    const habitNeedsCheckIn = isNowCompleted && linkedHabit && !(linkedHabit.completedDays || []).includes(todayKey());

    if (isNowCompleted && settings.soundEffects) playChime('complete');
    setTasks(prev => prev.map(t => t.id === id ? {
      ...t,
      completed: isNowCompleted,
      completedAt: isNowCompleted ? Date.now() : null
    } : t));

    if (habitNeedsCheckIn) {
      const today = todayKey();
      setHabits(prev => prev.map(h => h.id === target.linkedHabitId
        ? { ...h, completedDays: [...(h.completedDays || []), today] }
        : h));
      showToast(`Task complete. ${linkedHabit.title} checked in.`);
    }
  }, [tasks, habits, setTasks, setHabits, settings.soundEffects, showToast]);

  const deleteTask = useCallback((id) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;
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
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    showToast('Task updated');
  }, [setTasks, showToast]);

  const toggleSubtask = useCallback((taskId, subtaskId) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const subtasks = (t.subtasks || []).map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
      return { ...t, subtasks };
    }));
  }, [setTasks]);

  /* Goals Actions */
  const addGoal = useCallback((goal) => {
    const newId = 'g' + Date.now();
    setGoals(prev => [...prev, { ...goal, id: newId, progress: 0, velocity: 'on-track' }]);
    showToast(`Goal created: "${goal.title}"`);
  }, [setGoals, showToast]);

  const updateGoalProgress = useCallback((id, delta) => {
    setGoals(prev => prev.map(g =>
      g.id === id ? { ...g, progress: Math.max(0, Math.min(100, (g.progress || 0) + delta)) } : g
    ));
  }, [setGoals]);

  const deleteGoal = useCallback((id) => {
    const target = goals.find(g => g.id === id);
    if (!target) return;
    setGoals(prev => prev.filter(g => g.id !== id));
    showToast(`Goal deleted: "${target.title}"`, {
      actionLabel: 'Undo',
      onAction: () => {
        setGoals(prev => [...prev, target]);
        showToast('Goal restored');
      }
    });
  }, [goals, setGoals, showToast]);

  /* Habits Actions */
  const checkInHabit = useCallback((id) => {
    const today = todayKey();
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      const days = h.completedDays || [];
      const alreadyChecked = days.includes(today);
      if (!alreadyChecked && settings.soundEffects) {
        playChime('complete');
      }
      if (alreadyChecked) {
        return { ...h, completedDays: days.filter(d => d !== today) };
      }
      return { ...h, completedDays: [...days, today] };
    }));
  }, [setHabits, settings.soundEffects]);

  const addHabit = useCallback((habit) => {
    setHabits(prev => [...prev, {
      ...habit, id: 'h' + Date.now(), completedDays: [], graceDays: 0,
    }]);
    showToast(`Habit added: "${habit.title}"`);
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
    setReflections(DEFAULT_REFLECTIONS);
    setSettings(DEFAULT_SETTINGS);
    setFocusSessions([]);
    showToast('All data reset to initial baseline');
  }, [setTasks, setGoals, setHabits, setReflections, setSettings, setFocusSessions, showToast]);

  const clearAllData = useCallback(() => {
    setTasks([]);
    setGoals([]);
    setHabits([]);
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

  /* Computed stats */
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const highPriority = tasks.filter(t => t.priority === 'high' && !t.completed).length;
    const normalPriority = tasks.filter(t => t.priority === 'normal' && !t.completed).length;
    const lowPriority = tasks.filter(t => t.priority === 'low' && !t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const goalsOnTrack = reactiveGoals.filter(g => g.velocity !== 'behind').length;
    const totalGoals = reactiveGoals.length;

    const habitStreaks = habits.map(h => ({
      id: h.id,
      streak: calcStreak(h.completedDays),
      completedToday: (h.completedDays || []).includes(todayKey()),
    }));
    const longestStreak = Math.max(0, ...habitStreaks.map(s => s.streak));
    const habitsCompletedToday = habitStreaks.filter(s => s.completedToday).length;

    const habitRate = habits.length > 0 ? Math.round((habitsCompletedToday / habits.length) * 100) : 0;
    const goalRate = totalGoals > 0 ? Math.round((goalsOnTrack / totalGoals) * 100) : 0;
    const momentumScore = Math.round((completionRate * 0.4) + (goalRate * 0.3) + (habitRate * 0.3));

    // Real logged focus time today
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const todaySessions = focusSessions.filter(s => s.timestamp >= startOfToday);
    const completedFocusMinutes = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    const completedFocusHours = Number((completedFocusMinutes / 60).toFixed(1));

    return {
      total, completed, pending, highPriority, normalPriority, lowPriority,
      completionRate, goalsOnTrack, totalGoals,
      habitStreaks, longestStreak, habitsCompletedToday,
      totalHabits: habits.length,
      momentumScore,
      completedFocusMinutes,
      completedFocusHours,
      focusSessionsCount: todaySessions.length,
    };
  }, [tasks, reactiveGoals, habits, focusSessions]);

  return {
    tasks, addTask, updateTask, toggleTask, deleteTask, toggleSubtask,
    goals: reactiveGoals, addGoal, updateGoalProgress, deleteGoal,
    habits, checkInHabit, addHabit, deleteHabit, useGraceDay,
    reflections, updateReflection, saveWeeklyReview,
    settings, updateSettings, updateProfile,
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
    }
  };
}

/* Re-export helpers */
export { calcStreak, last7Days, todayKey, DAY_LABELS };
