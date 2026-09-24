/**
 * Areas of Life definitions for Momentum OS
 * Replaces GTD physical contexts with holistic life areas.
 * Multi-selectable per task.
 */

export const LIFE_AREAS = [
  {
    id: 'Career & Craft',
    label: 'Career & Craft',
    shortLabel: 'Career',
    icon: 'work',
    color: 'blue',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/70',
    dotClass: 'bg-blue-500'
  },
  {
    id: 'Creative & Expression',
    label: 'Creative & Expression',
    shortLabel: 'Creative',
    icon: 'palette',
    color: 'purple',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/70',
    dotClass: 'bg-purple-500'
  },
  {
    id: 'Deep Focus',
    label: 'Deep Focus',
    shortLabel: 'Focus',
    icon: 'psychology',
    color: 'indigo',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
    dotClass: 'bg-indigo-500'
  },
  {
    id: 'Habit Consistency',
    label: 'Habit Consistency',
    shortLabel: 'Habits',
    icon: 'repeat',
    color: 'amber',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/70',
    dotClass: 'bg-amber-500'
  },
  {
    id: 'Health & Vitality',
    label: 'Health & Vitality',
    shortLabel: 'Health',
    icon: 'fitness_center',
    color: 'emerald',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    dotClass: 'bg-emerald-500'
  },
  {
    id: 'Personal & Life',
    label: 'Personal & Life',
    shortLabel: 'Personal',
    icon: 'favorite',
    color: 'rose',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70',
    dotClass: 'bg-rose-500'
  }
];

export const DEFAULT_LIFE_AREAS = ['Career & Craft'];

export function getLifeArea(id) {
  return LIFE_AREAS.find(a => a.id === id) || {
    id,
    label: id,
    shortLabel: id,
    icon: 'label',
    color: 'slate',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-500'
  };
}

export const CATEGORY_TO_AREAS = {
  career: ['Career & Craft'],
  work: ['Career & Craft'],
  health: ['Health & Vitality'],
  fitness: ['Health & Vitality'],
  creative: ['Creative & Expression'],
  personal: ['Personal & Life'],
  life: ['Personal & Life'],
  habits: ['Habit Consistency'],
  habit: ['Habit Consistency'],
  focus: ['Deep Focus'],
  deepwork: ['Deep Focus']
};

const GOAL_AREAS_STORAGE_KEY = 'momentum_goal_life_areas';

export function getGoalAreas(goalOrGoalId, goals = []) {
  if (!goalOrGoalId) return DEFAULT_LIFE_AREAS;
  const goalId = typeof goalOrGoalId === 'object' ? goalOrGoalId?.id : goalOrGoalId;
  const goalObj = typeof goalOrGoalId === 'object'
    ? goalOrGoalId
    : (Array.isArray(goals) ? goals.find(g => g.id === goalId) : null);

  // 1. Check persistent memory in localStorage
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(GOAL_AREAS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed[goalId]) && parsed[goalId].length > 0) {
          return parsed[goalId];
        }
      }
    }
  } catch (err) {
    // ignore
  }

  // 2. Check if goal explicitly defines areas
  if (goalObj?.areas && Array.isArray(goalObj.areas) && goalObj.areas.length > 0) {
    return goalObj.areas;
  }

  // 3. Fallback to mapped category if available
  if (goalObj?.category) {
    const cat = String(goalObj.category).toLowerCase().trim();
    if (CATEGORY_TO_AREAS[cat]) {
      return CATEGORY_TO_AREAS[cat];
    }
  }

  return DEFAULT_LIFE_AREAS;
}

export function saveGoalAreas(goalId, areas) {
  if (!goalId || !Array.isArray(areas) || areas.length === 0) return;
  try {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(GOAL_AREAS_STORAGE_KEY);
    const mapping = raw ? JSON.parse(raw) : {};
    mapping[goalId] = areas;
    localStorage.setItem(GOAL_AREAS_STORAGE_KEY, JSON.stringify(mapping));
  } catch (err) {
    // ignore
  }
}

