import React, { useMemo, useState } from 'react';
import { todayKey } from '../store/useStore';
import TaskCard from '../components/TaskCard';
import TaskDetailModal from '../components/TaskDetailModal';
import { deadlineStatus, effortLabel, IMPACT_LABELS, planDateLabel, taskImpact, taskPlanDate, todayPlanDate, tomorrowPlanDate } from '../lib/taskMetadata';

const IMPACT_ORDER = { high: 1, medium: 2, low: 3 };

function formatTime(time) {
  if (!time) return 'Unscheduled';
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function DashboardView({
  tasks = [], onToggleTask, onDeleteTask, onUpdateTask, onToggleSubtask,
  onOpenQuickAdd, onStartFocus, onCheckInHabit, stats = {}, setActiveTab,
  settings = {}, onUpdateSettings, goals = [], habits = [],
}) {
  const [filter, setFilter] = useState('all');
  const [editingTask, setEditingTask] = useState(null);
  const [showMorningPlan, setShowMorningPlan] = useState(false);
  const [showEveningReview, setShowEveningReview] = useState(false);
  const [planTasks, setPlanTasks] = useState([]);
  const [eveningNote, setEveningNote] = useState('');
  const [scheduleTimes, setScheduleTimes] = useState({});
  const userName = settings?.profile?.name || 'Friend';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = todayKey();
  const quickWinMinutes = settings.quickWinMinutes || 30;

  const todayTasks = useMemo(() => tasks
    .filter(task => taskPlanDate(task) === todayPlanDate())
    .slice()
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const deadlineA = deadlineStatus(a);
      const deadlineB = deadlineStatus(b);
      const deadlineDelta = (deadlineA?.timestamp || Number.MAX_SAFE_INTEGER) - (deadlineB?.timestamp || Number.MAX_SAFE_INTEGER);
      const impactDelta = (IMPACT_ORDER[taskImpact(a)] || 9) - (IMPACT_ORDER[taskImpact(b)] || 9);
      const effortDelta = (a.durationMinutes || 60) - (b.durationMinutes || 60);
      return deadlineDelta || impactDelta || (a.startTime || '99:99').localeCompare(b.startTime || '99:99') || effortDelta;
    }), [tasks]);

  const visibleTasks = todayTasks.filter(task => {
    if (filter === 'high') return taskImpact(task) === 'high';
    return filter !== 'quick' || (task.durationMinutes || 60) <= quickWinMinutes;
  });
  const nextTask = todayTasks.find(task => !task.completed);
  const scheduledTasks = todayTasks.filter(task => task.startTime && !task.completed);
  const checkedHabits = habits.filter(habit => habit.completedDays?.includes(today)).length;
  const activeGoals = goals.filter(goal => goal.velocity !== 'complete').slice(0, 3);
  const dailyPlan = settings.dailyPlan?.date === today ? settings.dailyPlan : { topTaskIds: [], eveningNote: '' };
  const unfinishedTodayTasks = todayTasks.filter(task => !task.completed);

  const openMorningPlan = () => {
    const selected = (dailyPlan.topTaskIds || []).map(id => {
      const task = unfinishedTodayTasks.find(item => item.id === id);
      return task ? { id: task.id, startTime: task.startTime || '' } : null;
    }).filter(Boolean);
    setPlanTasks(selected);
    setShowMorningPlan(true);
  };

  const saveMorningPlan = () => {
    planTasks.forEach(item => onUpdateTask?.(item.id, { startTime: item.startTime || null, plannedDate: todayPlanDate(), dueDate: 'Today', urgency: 'today' }));
    onUpdateSettings?.({ dailyPlan: { date: today, topTaskIds: planTasks.map(item => item.id), eveningNote: dailyPlan.eveningNote || '' } });
    setShowMorningPlan(false);
  };

  const openEveningReview = () => {
    setEveningNote(dailyPlan.eveningNote || '');
    setScheduleTimes(Object.fromEntries(unfinishedTodayTasks.map((task, index) => [task.id, task.startTime || ['09:00', '11:00', '14:00'][index % 3]])));
    setShowEveningReview(true);
  };

  const saveEveningReview = () => {
    onUpdateSettings?.({ dailyPlan: { ...dailyPlan, date: today, eveningNote } });
    setShowEveningReview(false);
  };

  return (
    <main className="w-full min-h-screen bg-surface pt-16 md:pt-12 px-4 sm:px-6 md:px-margin-desktop py-4 sm:py-gutter-xl">
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1 text-xs font-medium text-on-surface-variant"><span className="h-2 w-2 rounded-full bg-secondary" />{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-on-surface">{greeting}, {userName}</h1>
            <p className="mt-1 text-sm text-on-surface-variant">Plan today. Do next task. Review week.</p>
          </div>
          <div className="flex flex-wrap gap-2"><button onClick={openMorningPlan} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"><span className="material-symbols-outlined text-[18px]">sunny</span>Morning plan</button><button onClick={openEveningReview} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"><span className="material-symbols-outlined text-[18px]">bedtime</span>Evening review</button><button onClick={onOpenQuickAdd} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm hover:opacity-90"><span className="material-symbols-outlined text-[18px]">add</span>Add task</button></div>
        </header>

        <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.09] to-surface-container-lowest p-5 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-primary">Now</p>
              {nextTask ? <><h2 className="mt-1 truncate text-xl font-bold text-on-surface">{nextTask.title}</h2><p className="mt-1 text-sm text-on-surface-variant">{deadlineStatus(nextTask)?.label || `Planned ${planDateLabel(taskPlanDate(nextTask)).toLowerCase()}`} · {IMPACT_LABELS[taskImpact(nextTask)]} impact · {effortLabel(nextTask.durationMinutes)} effort</p></> : <><h2 className="mt-1 text-xl font-bold text-on-surface">No task needs attention now.</h2><p className="mt-1 text-sm text-on-surface-variant">Add task or plan tomorrow.</p></>}
            </div>
            {nextTask ? <div className="flex flex-wrap gap-2"><button onClick={() => setEditingTask(nextTask)} className="rounded-xl bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-on-surface shadow-sm hover:bg-surface-container">View task</button><button onClick={() => onStartFocus?.(nextTask.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm hover:opacity-90"><span className="material-symbols-outlined text-[18px]">play_arrow</span>Start focus</button></div> : <button onClick={onOpenQuickAdd} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary">Add first task</button>}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold text-on-surface">Today</h2><p className="text-sm text-on-surface-variant">{stats.completed || 0} of {todayTasks.length} tasks complete · {checkedHabits}/{habits.length} habits checked in</p></div><div className="inline-flex rounded-full bg-surface-container p-1">{[['all', 'All'], ['high', 'High impact'], ['quick', `≤ ${quickWinMinutes} min`]].map(([id, label]) => <button key={id} onClick={() => setFilter(id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === id ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant'}`}>{label}</button>)}</div></div>
            <div className="space-y-3">{visibleTasks.length ? visibleTasks.map(task => <TaskCard key={task.id} task={task} onToggleTask={onToggleTask} onDeleteTask={onDeleteTask} onUpdateTask={onUpdateTask} onToggleSubtask={onToggleSubtask} onEditTask={setEditingTask} goals={goals} habits={habits} />) : <div className="rounded-xl bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">No tasks match this view.</div>}<button onClick={onOpenQuickAdd} className="flex w-full items-center gap-2 rounded-xl bg-surface-container-low px-4 py-3 text-left text-sm font-semibold text-on-surface-variant hover:bg-surface-container"><span className="material-symbols-outlined text-primary">add_circle</span>Add task for today</button></div>
          </div>

          <aside className="space-y-6 lg:col-span-4">
            <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-base font-bold text-on-surface">Time blocks</h2><p className="text-xs text-on-surface-variant">Planned work today</p></div><button onClick={() => setActiveTab('today')} className="text-xs font-semibold text-primary">Open day</button></div><div className="mt-4 space-y-3">{scheduledTasks.length ? scheduledTasks.map(task => <button key={task.id} onClick={() => setEditingTask(task)} className="flex w-full items-center gap-3 rounded-xl bg-surface-container-low p-3 text-left hover:bg-surface-container"><span className="w-16 shrink-0 text-xs font-bold text-primary">{formatTime(task.startTime)}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">{task.title}</span><span className="text-xs text-on-surface-variant">{task.durationMinutes || 45}m</span></button>) : <p className="rounded-xl bg-surface-container-low p-3 text-sm text-on-surface-variant">No time blocks yet. Edit task to add start time.</p>}</div></div>
            <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-base font-bold text-on-surface">Habits</h2><p className="text-xs text-on-surface-variant">{checkedHabits} of {habits.length} checked in</p></div><button onClick={() => setActiveTab('habits')} className="text-xs font-semibold text-primary">All habits</button></div><div className="mt-4 space-y-2">{habits.slice(0, 4).map(habit => { const done = habit.completedDays?.includes(today); return <button key={habit.id} onClick={() => onCheckInHabit?.(habit.id)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-container-low"><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${done ? 'border-primary bg-primary text-white' : 'border-outline-variant'}`}><span className="material-symbols-outlined text-[14px]">done</span></span><span className={`flex-1 text-sm font-medium ${done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{habit.title}</span></button>; })}{!habits.length && <p className="text-sm text-on-surface-variant">No habits yet.</p>}</div></div>
          </aside>
        </section>

        <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-secondary">This week</p><h2 className="mt-1 text-xl font-bold text-on-surface">Goals moving forward</h2></div><button onClick={() => setActiveTab('goals')} className="text-sm font-semibold text-primary">View goals</button></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">{activeGoals.length ? activeGoals.map(goal => { const progress = goal.workProgress ?? goal.progress ?? 0; const next = goal.nextTask?.title; return <div key={goal.id} className="rounded-xl bg-surface-container-low p-4"><button onClick={() => setActiveTab('goals')} className="w-full text-left hover:opacity-80"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-on-surface">{goal.title}</span><span className="text-xs font-bold text-primary">{progress}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container-high"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs font-medium text-on-surface">{goal.milestone || next || 'Set next milestone'}</p><p className="mt-1 text-xs text-on-surface-variant">Due {goal.targetDate || `${goal.daysLeft || 0} days`} · {goal.tasksActive || 0} tasks active</p></button><button onClick={() => onOpenQuickAdd?.({ initialGoalId: goal.id })} className="mt-3 text-xs font-semibold text-primary">+ Add next task</button></div>; }) : <button onClick={() => setActiveTab('goals')} className="rounded-xl bg-surface-container-low p-4 text-left text-sm font-semibold text-primary">Create first goal</button>}</div></section>
      </div>
      {showMorningPlan && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Morning plan</p><h2 className="mt-1 text-xl font-bold text-[#1A1B1F]">Choose your Top 3</h2><p className="mt-1 text-sm text-[#71717A]">Pick work. Give each task a time block. Check habits.</p></div><button onClick={() => setShowMorningPlan(false)} className="p-1 text-[#888]"><span className="material-symbols-outlined">close</span></button></div><div className="mt-5 space-y-2">{unfinishedTodayTasks.map(task => { const selected = planTasks.find(item => item.id === task.id); return <div key={task.id} className={`rounded-xl border p-3 ${selected ? 'border-primary bg-primary/5' : 'border-black/[0.08]'}`}><div className="flex items-center gap-3"><button onClick={() => { if (selected) setPlanTasks(planTasks.filter(item => item.id !== task.id)); else if (planTasks.length < 3) setPlanTasks([...planTasks, { id: task.id, startTime: ['09:00', '11:00', '14:00'][planTasks.length] }]); }} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-primary bg-primary text-white' : 'border-[#BBB]'}`}><span className="material-symbols-outlined text-[14px]">done</span></button><span className="flex-1 text-sm font-semibold text-[#1A1B1F]">{task.title}</span>{selected && <select value={selected.startTime} onChange={event => setPlanTasks(planTasks.map(item => item.id === task.id ? { ...item, startTime: event.target.value } : item))} className="rounded-lg bg-[#F5F4FA] px-2 py-1 text-xs"><option value="">No time</option><option value="09:00">9:00 AM</option><option value="11:00">11:00 AM</option><option value="14:00">2:00 PM</option><option value="16:00">4:00 PM</option></select>}</div></div>})}{!unfinishedTodayTasks.length && <p className="rounded-xl bg-[#F5F4FA] p-3 text-sm text-[#71717A]">No unfinished tasks. Add work for today.</p>}</div><div className="mt-5 border-t border-black/[0.07] pt-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-[#1A1B1F]">Check habits</h3><span className="text-xs text-[#71717A]">{checkedHabits}/{habits.length}</span></div><div className="mt-2 grid grid-cols-2 gap-2">{habits.slice(0, 4).map(habit => { const done = habit.completedDays?.includes(today); return <button key={habit.id} onClick={() => onCheckInHabit?.(habit.id)} className={`rounded-lg px-3 py-2 text-left text-xs font-semibold ${done ? 'bg-primary text-white' : 'bg-[#F5F4FA] text-[#1A1B1F]'}`}>{done ? '✓ ' : ''}{habit.title}</button> })}</div></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowMorningPlan(false)} className="px-4 py-2 text-sm text-[#71717A]">Cancel</button><button disabled={!planTasks.length} onClick={saveMorningPlan} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Plan my day</button></div></div></div>}

      {showEveningReview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-tertiary">Evening review</p><h2 className="mt-1 text-xl font-bold text-[#1A1B1F]">Close your day</h2><p className="mt-1 text-sm text-[#71717A]">Review unfinished work. Choose next home for each task.</p></div><button onClick={() => setShowEveningReview(false)} className="p-1 text-[#888]"><span className="material-symbols-outlined">close</span></button></div><div className="mt-5 space-y-3">{unfinishedTodayTasks.length ? unfinishedTodayTasks.map(task => <div key={task.id} className="rounded-xl border border-black/[0.08] p-3"><p className="text-sm font-semibold text-[#1A1B1F]">{task.title}</p><div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={() => onToggleTask(task.id)} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">Mark done</button><button onClick={() => onUpdateTask(task.id, { plannedDate: tomorrowPlanDate(), dueDate: 'Tomorrow', urgency: 'week', startTime: null })} className="rounded-lg bg-[#F5F4FA] px-2.5 py-1.5 text-xs font-semibold text-[#1A1B1F]">Move tomorrow</button><select value={scheduleTimes[task.id] || '09:00'} onChange={event => setScheduleTimes({ ...scheduleTimes, [task.id]: event.target.value })} className="rounded-lg bg-[#F5F4FA] px-2 py-1.5 text-xs"><option value="09:00">9:00 AM</option><option value="11:00">11:00 AM</option><option value="14:00">2:00 PM</option><option value="16:00">4:00 PM</option></select><button onClick={() => onUpdateTask(task.id, { plannedDate: tomorrowPlanDate(), dueDate: 'Tomorrow', urgency: 'week', startTime: scheduleTimes[task.id] || '09:00' })} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">Schedule</button><button onClick={() => onDeleteTask(task.id)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500">Remove</button></div></div>) : <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">All today tasks complete.</p>}</div><div className="mt-5 border-t border-black/[0.07] pt-4"><label className="text-sm font-bold text-[#1A1B1F]">Note for tomorrow</label><textarea value={eveningNote} onChange={event => setEveningNote(event.target.value)} placeholder="What matters first tomorrow?" rows="3" className="mt-2 w-full resize-none rounded-xl bg-[#F5F4FA] p-3 text-sm outline-none" /></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowEveningReview(false)} className="px-4 py-2 text-sm text-[#71717A]">Cancel</button><button onClick={saveEveningReview} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">Finish review</button></div></div></div>}

      <TaskDetailModal task={editingTask} isOpen={!!editingTask} onClose={() => setEditingTask(null)} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} goals={goals} habits={habits} onStartFocus={onStartFocus} />
    </main>
  );
}
