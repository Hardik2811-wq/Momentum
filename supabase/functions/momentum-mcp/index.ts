import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mcp-session-id, accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store'
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
  });
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const MCP_TOOLS = [
  {
    name: 'get_momentum_workspace',
    description:
      'Fetch the live Momentum OS workspace state (today calendar tasks, fixed university/work timetable schedules, daily habits & streaks, and strategic goals). Call this first before planning or modifying the workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Optional YYYY-MM-DD target date (defaults to today).'
        }
      }
    }
  },
  {
    name: 'schedule_tasks',
    description:
      'Create, update, time-block, complete, or delete tasks on the Momentum OS calendar and task tray. Supports Scratch C-Block nesting when a task is scheduled inside a Focus Session or Habit time window.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'complete', 'delete'],
          description: 'Operation to perform on tasks.'
        },
        tasks: {
          type: 'array',
          description: 'List of task objects to create or update.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Task ID (required for update).' },
              title: { type: 'string', description: 'Concise actionable task title.' },
              plannedDate: { type: 'string', description: 'YYYY-MM-DD date.' },
              startTime: { type: 'string', description: '24h HH:MM start time (e.g. "09:00") or null for unscheduled tray.' },
              durationMinutes: { type: 'number', description: 'Duration in minutes (e.g. 45, 60, 90).' },
              priority: { type: 'string', enum: ['high', 'normal', 'low'] },
              impact: { type: 'string', enum: ['high', 'medium', 'low'] },
              energy: { type: 'string', enum: ['High', 'Medium', 'Low'] },
              goalId: { type: 'string', description: 'Optional linked Goal ID.' },
              linkedHabitId: { type: 'string', description: 'Optional linked Habit ID.' },
              areas: { type: 'array', items: { type: 'string' } },
              subtasks: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        taskIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task IDs to mark completed or delete.'
        }
      }
    }
  },
  {
    name: 'manage_timetable',
    description:
      'Create, update, or delete fixed recurring timetable blocks (university classes, lectures, labs, fixed work shifts) in Momentum OS.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete']
        },
        schedules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              category: { type: 'string', enum: ['College', 'Academics', 'Work', 'Personal'] },
              startTime: { type: 'string', description: '24h HH:MM start time (e.g. "09:30").' },
              endTime: { type: 'string', description: '24h HH:MM end time (e.g. "11:30").' },
              durationMinutes: { type: 'number' },
              recurrence: { type: 'string', enum: ['weekly', 'daily', 'custom', 'none'] },
              repeatDays: {
                type: 'array',
                items: { type: 'number' },
                description: 'Days of week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.'
              },
              plannedDate: { type: 'string', description: 'YYYY-MM-DD start anchor.' },
              recurrenceEndDate: { type: 'string', description: 'Optional YYYY-MM-DD end date.' }
            }
          }
        },
        scheduleIds: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  },
  {
    name: 'manage_habits',
    description:
      'Create, update, check-in, or delete daily habits and rituals in Momentum OS.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'checkin', 'delete']
        },
        habits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              cadence: { type: 'string', enum: ['Morning', 'Afternoon', 'Evening', 'Anytime'] },
              startTime: { type: 'string', description: 'Optional 24h HH:MM time block.' },
              duration: { type: 'string', description: 'e.g. "30 mins", "45 mins".' },
              targetFrequency: { type: 'string', enum: ['Every Day', 'Weekdays', '3 Days / Wk', 'Custom'] },
              linkedGoal: { type: 'string' }
            }
          }
        },
        habitIds: {
          type: 'array',
          items: { type: 'string' }
        },
        date: {
          type: 'string',
          description: 'YYYY-MM-DD date for habit check-in (defaults to today).'
        }
      }
    }
  },
  {
    name: 'manage_goals',
    description:
      'Create, update progress, or delete strategic long-term goals & horizons in Momentum OS.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete']
        },
        goals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              category: { type: 'string', enum: ['career', 'health', 'creative', 'finance', 'academics'] },
              why: { type: 'string' },
              targetDate: { type: 'string', description: 'YYYY-MM-DD or null for open horizon.' },
              progress: { type: 'number', description: '0 to 100 completion percentage.' }
            }
          }
        },
        goalIds: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  },
  {
    name: 'apply_executive_plan',
    description:
      'Atomically apply a full multi-horizon execution plan (goals, habits, timetable schedules, tasks, and optional deletions) to the live Momentum OS workspace. Syncs immediately to Android and Web via WebSocket.',
    inputSchema: {
      type: 'object',
      properties: {
        goals: { type: 'array', items: { type: 'object' } },
        habits: { type: 'array', items: { type: 'object' } },
        schedules: { type: 'array', items: { type: 'object' } },
        tasks: { type: 'array', items: { type: 'object' } },
        deleteGoalIds: { type: 'array', items: { type: 'string' } },
        deleteHabitIds: { type: 'array', items: { type: 'string' } },
        deleteScheduleIds: { type: 'array', items: { type: 'string' } },
        deleteTaskIds: { type: 'array', items: { type: 'string' } }
      }
    }
  }
];

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const m = String(startTime || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '10:00';
  const total = (Number(m[1]) * 60 + Number(m[2]) + (Number(durationMinutes) || 60)) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

async function authenticateRequest(request: Request, admin: ReturnType<typeof createClient>) {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token') ?? '';
  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const rawToken = (queryToken || bearerToken).trim();

  if (!rawToken) {
    return { error: 'Missing Momentum Bridge token. Pass ?token=mom_... or Authorization: Bearer mom_...' };
  }

  // Case 1: Personal Momentum Bridge Token: mom_<uuid>_<secret>
  const bridgeMatch = rawToken.match(/^mom_([0-9a-fA-F-]{36})_([A-Za-z0-9_-]{16,})$/);
  if (bridgeMatch) {
    const userId = bridgeMatch[1];
    const { data, error } = await admin
      .from('workspace_snapshots')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data?.data) {
      return { error: 'Workspace not found for this token.' };
    }

    const expectedHash = data.data?.settings?.mcpBridgeTokenHash;
    if (!expectedHash || typeof expectedHash !== 'string') {
      return { error: 'MCP Bridge token is not active in workspace settings.' };
    }

    const candidateHash = await sha256Hex(rawToken);
    if (!timingSafeEqual(candidateHash, expectedHash)) {
      return { error: 'Invalid or revoked Momentum Bridge token.' };
    }

    return { userId, workspace: data.data };
  }

  // Case 2: Standard Supabase Auth JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${rawToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return { error: 'Invalid authentication token.' };
  }

  const { data } = await admin
    .from('workspace_snapshots')
    .select('data')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  return {
    userId: userData.user.id,
    workspace: data?.data || { tasks: [], goals: [], habits: [], schedules: [], reflections: {}, settings: {}, focusSessions: [] }
  };
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  workspace: Record<string, any>,
  admin: ReturnType<typeof createClient>
) {
  const today = new Date().toISOString().slice(0, 10);
  const tasks: any[] = Array.isArray(workspace.tasks) ? [...workspace.tasks] : [];
  const goals: any[] = Array.isArray(workspace.goals) ? [...workspace.goals] : [];
  const habits: any[] = Array.isArray(workspace.habits) ? [...workspace.habits] : [];
  const schedules: any[] = Array.isArray(workspace.schedules) ? [...workspace.schedules] : [];

  const saveWorkspace = async (nextTasks = tasks, nextGoals = goals, nextHabits = habits, nextSchedules = schedules) => {
    const updatedData = {
      ...workspace,
      tasks: nextTasks,
      goals: nextGoals,
      habits: nextHabits,
      schedules: nextSchedules,
      _mcpUpdated: Date.now()
    };
    const { error } = await admin.from('workspace_snapshots').upsert({
      user_id: userId,
      version: 1,
      data: updatedData
    });
    if (error) throw new Error(`Failed to persist workspace: ${error.message}`);
    return updatedData;
  };

  if (toolName === 'get_momentum_workspace') {
    const targetDate = typeof args.date === 'string' && args.date ? args.date : today;
    return {
      todayDate: today,
      targetDate,
      counts: {
        tasks: tasks.length,
        openTasks: tasks.filter((t) => !t.completed).length,
        goals: goals.length,
        habits: habits.length,
        schedules: schedules.length
      },
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        category: g.category,
        progress: g.progress ?? 0,
        targetDate: g.targetDate || 'open',
        why: g.why || ''
      })),
      habits: habits.map((h) => ({
        id: h.id,
        title: h.title,
        cadence: h.cadence || 'Anytime',
        startTime: h.startTime || null,
        duration: h.duration || '30 mins',
        targetFrequency: h.targetFrequency || 'Every Day',
        graceDays: h.graceDays ?? 0,
        completedToday: Array.isArray(h.completedDays) && h.completedDays.includes(targetDate),
        linkedGoal: h.linkedGoal || null
      })),
      schedules: schedules.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category || 'College',
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        recurrence: s.recurrence || 'weekly',
        repeatDays: s.repeatDays || [],
        plannedDate: s.plannedDate || today
      })),
      tasks: tasks.slice(0, 60).map((t) => ({
        id: t.id,
        title: t.title,
        plannedDate: t.plannedDate || today,
        startTime: t.startTime || null,
        endTime: t.endTime || null,
        durationMinutes: t.durationMinutes || 45,
        completed: Boolean(t.completed),
        priority: t.priority || 'normal',
        impact: t.impact || 'medium',
        goalId: t.goalId || null,
        linkedHabitId: t.linkedHabitId || null,
        areas: t.areas || []
      }))
    };
  }

  if (toolName === 'schedule_tasks') {
    const action = String(args.action || 'create');
    const inputTasks = Array.isArray(args.tasks) ? args.tasks : [];
    const targetIds = new Set(Array.isArray(args.taskIds) ? args.taskIds.map(String) : []);
    let nextTasks = [...tasks];

    if (action === 'delete') {
      nextTasks = nextTasks.filter((t) => !targetIds.has(String(t.id)));
    } else if (action === 'complete') {
      nextTasks = nextTasks.map((t) =>
        targetIds.has(String(t.id)) ? { ...t, completed: true, completedAt: Date.now() } : t
      );
    } else if (action === 'update') {
      for (const patch of inputTasks as any[]) {
        if (!patch?.id) continue;
        nextTasks = nextTasks.map((t) => {
          if (String(t.id) !== String(patch.id)) return t;
          const dur = Number(patch.durationMinutes ?? t.durationMinutes) || 45;
          const start = patch.startTime !== undefined ? patch.startTime : t.startTime;
          return {
            ...t,
            ...patch,
            durationMinutes: dur,
            startTime: start,
            endTime: start ? calculateEndTime(start, dur) : null
          };
        });
      }
    } else {
      // create
      for (let i = 0; i < inputTasks.length; i++) {
        const raw = inputTasks[i] as any;
        if (!raw?.title) continue;
        const dur = Number(raw.durationMinutes) || 45;
        const start = raw.startTime || null;
        const pDate = raw.plannedDate || today;
        const newTask = {
          id: raw.id || `task-mcp-${Date.now()}-${i}`,
          title: String(raw.title).trim(),
          plannedDate: pDate,
          dueDate: pDate === today ? 'Today' : pDate,
          startTime: start,
          endTime: start ? calculateEndTime(start, dur) : null,
          durationMinutes: dur,
          completed: false,
          priority: raw.priority || 'normal',
          impact: raw.impact || 'medium',
          energy: raw.energy || 'Medium',
          goalId: raw.goalId || null,
          linkedHabitId: raw.linkedHabitId || null,
          areas: Array.isArray(raw.areas) && raw.areas.length ? raw.areas : ['Career & Craft'],
          subtasks: Array.isArray(raw.subtasks)
            ? raw.subtasks.map((s: any, idx: number) =>
                typeof s === 'string' ? { id: `st-${Date.now()}-${idx}`, title: s, completed: false } : s
              )
            : [],
          createdAt: Date.now()
        };
        nextTasks.unshift(newTask);
      }
    }

    await saveWorkspace(nextTasks, goals, habits, schedules);
    return { success: true, action, totalTasks: nextTasks.length };
  }

  if (toolName === 'manage_timetable') {
    const action = String(args.action || 'create');
    const inputSchedules = Array.isArray(args.schedules) ? args.schedules : [];
    const targetIds = new Set(Array.isArray(args.scheduleIds) ? args.scheduleIds.map(String) : []);
    let nextSchedules = [...schedules];

    if (action === 'delete') {
      nextSchedules = nextSchedules.filter((s) => !targetIds.has(String(s.id)));
    } else if (action === 'update') {
      for (const patch of inputSchedules as any[]) {
        if (!patch?.id) continue;
        nextSchedules = nextSchedules.map((s) =>
          String(s.id) === String(patch.id) ? { ...s, ...patch } : s
        );
      }
    } else {
      for (let i = 0; i < inputSchedules.length; i++) {
        const raw = inputSchedules[i] as any;
        if (!raw?.title) continue;
        const dur = Number(raw.durationMinutes) || 60;
        const start = raw.startTime || '09:00';
        const end = raw.endTime || calculateEndTime(start, dur);
        nextSchedules.push({
          id: raw.id || `sched-mcp-${Date.now()}-${i}`,
          title: String(raw.title).trim(),
          category: raw.category || 'College',
          areas: [raw.category || 'College'],
          startTime: start,
          endTime: end,
          durationMinutes: dur,
          plannedDate: raw.plannedDate || today,
          recurrence: raw.recurrence || 'weekly',
          repeatDays: Array.isArray(raw.repeatDays) ? raw.repeatDays : [1, 3, 5],
          recurrenceEndDate: raw.recurrenceEndDate || null,
          completed: false,
          completedDates: []
        });
      }
    }

    await saveWorkspace(tasks, goals, habits, nextSchedules);
    return { success: true, action, totalSchedules: nextSchedules.length };
  }

  if (toolName === 'manage_habits') {
    const action = String(args.action || 'create');
    const inputHabits = Array.isArray(args.habits) ? args.habits : [];
    const targetIds = new Set(Array.isArray(args.habitIds) ? args.habitIds.map(String) : []);
    const checkDate = typeof args.date === 'string' && args.date ? args.date : today;
    let nextHabits = [...habits];

    if (action === 'delete') {
      nextHabits = nextHabits.filter((h) => !targetIds.has(String(h.id)));
    } else if (action === 'checkin') {
      nextHabits = nextHabits.map((h) => {
        if (!targetIds.has(String(h.id))) return h;
        const days = Array.isArray(h.completedDays) ? [...h.completedDays] : [];
        if (!days.includes(checkDate)) days.push(checkDate);
        return { ...h, completedDays: days };
      });
    } else if (action === 'update') {
      for (const patch of inputHabits as any[]) {
        if (!patch?.id) continue;
        nextHabits = nextHabits.map((h) => (String(h.id) === String(patch.id) ? { ...h, ...patch } : h));
      }
    } else {
      for (let i = 0; i < inputHabits.length; i++) {
        const raw = inputHabits[i] as any;
        if (!raw?.title) continue;
        nextHabits.push({
          id: raw.id || `habit-mcp-${Date.now()}-${i}`,
          title: String(raw.title).trim(),
          cadence: raw.cadence || 'Morning',
          startTime: raw.startTime || null,
          isTimeBlocked: Boolean(raw.startTime),
          duration: raw.duration || '30 mins',
          targetFrequency: raw.targetFrequency || 'Every Day',
          icon: raw.icon || 'bolt',
          colorToken: raw.colorToken || 'primary',
          linkedGoal: raw.linkedGoal || '',
          graceDays: 2,
          completedDays: []
        });
      }
    }

    await saveWorkspace(tasks, goals, nextHabits, schedules);
    return { success: true, action, totalHabits: nextHabits.length };
  }

  if (toolName === 'manage_goals') {
    const action = String(args.action || 'create');
    const inputGoals = Array.isArray(args.goals) ? args.goals : [];
    const targetIds = new Set(Array.isArray(args.goalIds) ? args.goalIds.map(String) : []);
    let nextGoals = [...goals];

    if (action === 'delete') {
      nextGoals = nextGoals.filter((g) => !targetIds.has(String(g.id)));
    } else if (action === 'update') {
      for (const patch of inputGoals as any[]) {
        if (!patch?.id) continue;
        nextGoals = nextGoals.map((g) => (String(g.id) === String(patch.id) ? { ...g, ...patch } : g));
      }
    } else {
      for (let i = 0; i < inputGoals.length; i++) {
        const raw = inputGoals[i] as any;
        if (!raw?.title) continue;
        nextGoals.push({
          id: raw.id || `goal-mcp-${Date.now()}-${i}`,
          title: String(raw.title).trim(),
          category: raw.category || 'career',
          categories: [raw.category || 'career'],
          why: raw.why || '',
          targetDate: raw.targetDate || null,
          dateType: raw.targetDate ? 'target' : 'open',
          progress: Number(raw.progress) || 0,
          createdAt: Date.now()
        });
      }
    }

    await saveWorkspace(tasks, nextGoals, habits, schedules);
    return { success: true, action, totalGoals: nextGoals.length };
  }

  if (toolName === 'apply_executive_plan') {
    const delGoals = new Set(Array.isArray(args.deleteGoalIds) ? args.deleteGoalIds.map(String) : []);
    const delHabits = new Set(Array.isArray(args.deleteHabitIds) ? args.deleteHabitIds.map(String) : []);
    const delScheds = new Set(Array.isArray(args.deleteScheduleIds) ? args.deleteScheduleIds.map(String) : []);
    const delTasks = new Set(Array.isArray(args.deleteTaskIds) ? args.deleteTaskIds.map(String) : []);

    let nextGoals = goals.filter((g) => !delGoals.has(String(g.id)));
    let nextHabits = habits.filter((h) => !delHabits.has(String(h.id)));
    let nextSchedules = schedules.filter((s) => !delScheds.has(String(s.id)));
    let nextTasks = tasks.filter((t) => !delTasks.has(String(t.id)));

    const createdGoalIds: string[] = [];
    if (Array.isArray(args.goals)) {
      args.goals.forEach((raw: any, i: number) => {
        if (!raw?.title) return;
        const id = raw.id || `goal-mcp-${Date.now()}-${i}`;
        createdGoalIds.push(id);
        nextGoals.push({
          id,
          title: String(raw.title).trim(),
          category: raw.category || 'career',
          categories: [raw.category || 'career'],
          why: raw.why || '',
          targetDate: raw.targetDate || null,
          dateType: raw.targetDate ? 'target' : 'open',
          progress: Number(raw.progress) || 0,
          createdAt: Date.now()
        });
      });
    }

    const createdHabitIds: string[] = [];
    if (Array.isArray(args.habits)) {
      args.habits.forEach((raw: any, i: number) => {
        if (!raw?.title) return;
        const id = raw.id || `habit-mcp-${Date.now()}-${i}`;
        createdHabitIds.push(id);
        nextHabits.push({
          id,
          title: String(raw.title).trim(),
          cadence: raw.cadence || 'Morning',
          startTime: raw.startTime || null,
          isTimeBlocked: Boolean(raw.startTime),
          duration: raw.duration || '30 mins',
          targetFrequency: raw.targetFrequency || raw.frequency || 'Every Day',
          icon: raw.icon || 'bolt',
          colorToken: raw.colorToken || 'primary',
          linkedGoal: raw.linkedGoal || '',
          graceDays: 2,
          completedDays: []
        });
      });
    }

    if (Array.isArray(args.schedules)) {
      args.schedules.forEach((raw: any, i: number) => {
        if (!raw?.title) return;
        const dur = Number(raw.durationMinutes) || 60;
        const start = raw.startTime || '09:00';
        nextSchedules.push({
          id: raw.id || `sched-mcp-${Date.now()}-${i}`,
          title: String(raw.title).trim(),
          category: raw.category || 'College',
          areas: [raw.category || 'College'],
          startTime: start,
          endTime: raw.endTime || calculateEndTime(start, dur),
          durationMinutes: dur,
          plannedDate: raw.plannedDate || today,
          recurrence: raw.recurrence || 'weekly',
          repeatDays: Array.isArray(raw.repeatDays) ? raw.repeatDays : [1, 3, 5],
          recurrenceEndDate: raw.recurrenceEndDate || null,
          completed: false,
          completedDates: []
        });
      });
    }

    if (Array.isArray(args.tasks)) {
      args.tasks.forEach((raw: any, i: number) => {
        if (!raw?.title) return;
        const dur = Number(raw.durationMinutes) || 45;
        const start = raw.startTime || null;
        const pDate = raw.plannedDate || today;
        const resolvedGoalId =
          raw.existingGoalId ||
          raw.goalId ||
          (typeof raw.goalIndex === 'number' ? createdGoalIds[raw.goalIndex] : null);
        const resolvedHabitId =
          raw.existingHabitId ||
          raw.linkedHabitId ||
          (typeof raw.habitIndex === 'number' ? createdHabitIds[raw.habitIndex] : null);

        nextTasks.unshift({
          id: raw.id || `task-mcp-${Date.now()}-${i}`,
          title: String(raw.title).trim(),
          plannedDate: pDate,
          dueDate: pDate === today ? 'Today' : pDate,
          startTime: start,
          endTime: start ? calculateEndTime(start, dur) : null,
          durationMinutes: dur,
          completed: false,
          priority: raw.priority || 'normal',
          impact: raw.impact || 'medium',
          energy: raw.energy || 'Medium',
          goalId: resolvedGoalId || null,
          linkedHabitId: resolvedHabitId || null,
          areas: Array.isArray(raw.areas) && raw.areas.length ? raw.areas : ['Career & Craft'],
          subtasks: Array.isArray(raw.subtasks)
            ? raw.subtasks.map((s: any, idx: number) =>
                typeof s === 'string' ? { id: `st-${Date.now()}-${idx}`, title: s, completed: false } : s
              )
            : [],
          createdAt: Date.now()
        });
      });
    }

    await saveWorkspace(nextTasks, nextGoals, nextHabits, nextSchedules);
    return {
      success: true,
      applied: {
        goalsAdded: Array.isArray(args.goals) ? args.goals.length : 0,
        habitsAdded: Array.isArray(args.habits) ? args.habits.length : 0,
        schedulesAdded: Array.isArray(args.schedules) ? args.schedules.length : 0,
        tasksAdded: Array.isArray(args.tasks) ? args.tasks.length : 0
      }
    };
  }

  throw new Error(`Unknown tool: ${toolName}`);
}

function buildOpenApiSpec(serverUrl: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Momentum OS — Live Executive Workspace Action API',
      version: '3.0.0',
      description:
        'Connects ChatGPT Custom GPTs and AI Assistants directly to your live Momentum OS Web & Android workspace via real-time Supabase snapshots.'
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Paste your Momentum Bridge Token (mom_...) from Settings -> Claude & ChatGPT Bridge.'
        }
      }
    },
    security: [{ BearerAuth: [] }],
    paths: {
      '/workspace': {
        get: {
          operationId: 'getMomentumWorkspace',
          summary: 'Fetch live tasks, timetable schedules, habits, and goals from Momentum OS.',
          responses: { '200': { description: 'Live workspace snapshot' } }
        }
      },
      '/tasks': {
        post: {
          operationId: 'scheduleTasks',
          summary: 'Create, update, time-block, complete, or delete tasks on the Momentum calendar.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: MCP_TOOLS[1].inputSchema } }
          },
          responses: { '200': { description: 'Updated task state' } }
        }
      },
      '/timetable': {
        post: {
          operationId: 'manageTimetable',
          summary: 'Create, update, or delete recurring university classes and fixed schedule blocks.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: MCP_TOOLS[2].inputSchema } }
          },
          responses: { '200': { description: 'Updated timetable state' } }
        }
      },
      '/habits': {
        post: {
          operationId: 'manageHabits',
          summary: 'Create, update, check-in, or delete daily habits and streaks.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: MCP_TOOLS[3].inputSchema } }
          },
          responses: { '200': { description: 'Updated habit state' } }
        }
      },
      '/goals': {
        post: {
          operationId: 'manageGoals',
          summary: 'Create, update progress, or delete strategic long-term goals.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: MCP_TOOLS[4].inputSchema } }
          },
          responses: { '200': { description: 'Updated goals state' } }
        }
      },
      '/plan': {
        post: {
          operationId: 'applyExecutivePlan',
          summary: 'Atomically apply a full multi-horizon plan (goals + habits + schedules + tasks).',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: MCP_TOOLS[5].inputSchema } }
          },
          responses: { '200': { description: 'Applied executive plan result' } }
        }
      }
    }
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const baseServerUrl = `${url.origin}/functions/v1/momentum-mcp`;

  // Public OpenAPI 3.1 Schema Endpoint for ChatGPT Custom GPT Actions
  if (request.method === 'GET' && path.endsWith('/openapi.json')) {
    return jsonResponse(buildOpenApiSpec(baseServerUrl));
  }

  // Claude.ai MCP Connector discovery / health check ping (GET / or GET /manifest)
  if (request.method === 'GET' && !url.searchParams.has('token') && !request.headers.has('authorization')) {
    return jsonResponse({
      status: 'ok',
      service: 'momentum-os-mcp',
      version: '3.0.0',
      protocol: 'mcp-streamable-http',
      endpoints: {
        mcp: baseServerUrl,
        openapi: `${baseServerUrl}/openapi.json`
      }
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Momentum MCP Edge Function is missing Supabase environment variables.' }, 503);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const auth = await authenticateRequest(request, admin);
  if ('error' in auth) {
    return jsonResponse({ error: auth.error }, 401);
  }

  // REST Endpoints for ChatGPT Custom GPT Actions
  if (request.method === 'GET' && (path.endsWith('/workspace') || path.endsWith('/momentum-mcp'))) {
    const result = await executeTool('get_momentum_workspace', {}, auth.userId, auth.workspace, admin);
    return jsonResponse(result);
  }

  const restRouteMap: Record<string, string> = {
    '/tasks': 'schedule_tasks',
    '/timetable': 'manage_timetable',
    '/habits': 'manage_habits',
    '/goals': 'manage_goals',
    '/plan': 'apply_executive_plan'
  };

  for (const [suffix, toolName] of Object.entries(restRouteMap)) {
    if (request.method === 'POST' && path.endsWith(suffix)) {
      try {
        const body = await request.json();
        const result = await executeTool(toolName, body || {}, auth.userId, auth.workspace, admin);
        return jsonResponse(result);
      } catch (err) {
        return jsonResponse({ error: err instanceof Error ? err.message : 'Execution failed' }, 400);
      }
    }
  }

  // Streamable HTTP Model Context Protocol (MCP JSON-RPC 2.0) for Claude.ai & MCP Clients
  if (request.method === 'POST') {
    try {
      const rpc = await request.json();
      const { id, method, params } = rpc || {};

      if (method === 'initialize') {
        return jsonResponse({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'momentum-os-mcp', version: '3.0.0' }
          }
        });
      }

      if (method === 'notifications/initialized' || method === 'ping') {
        return jsonResponse({ jsonrpc: '2.0', id: id ?? null, result: {} });
      }

      if (method === 'tools/list') {
        return jsonResponse({
          jsonrpc: '2.0',
          id,
          result: { tools: MCP_TOOLS }
        });
      }

      if (method === 'tools/call') {
        const toolName = String(params?.name || '');
        const toolArgs = (params?.arguments || {}) as Record<string, unknown>;
        const toolOutput = await executeTool(toolName, toolArgs, auth.userId, auth.workspace, admin);
        return jsonResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(toolOutput, null, 2) }],
            isError: false
          }
        });
      }

      return jsonResponse({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32601, message: `Unsupported MCP method: ${method}` }
      });
    } catch (err) {
      return jsonResponse({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: err instanceof Error ? err.message : 'Internal MCP error' }
      }, 400);
    }
  }

  return jsonResponse({ error: 'Method not allowed.' }, 405);
});
