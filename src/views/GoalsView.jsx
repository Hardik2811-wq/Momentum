import React, { useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';

const COLOR_CLASSES = {
  primary: {
    badge: 'bg-primary/10 text-primary', icon: 'text-primary', progress: 'bg-primary', hover: 'hover:text-primary'
  },
  secondary: {
    badge: 'bg-secondary/10 text-secondary', icon: 'text-secondary', progress: 'bg-secondary', hover: 'hover:text-secondary'
  },
  tertiary: {
    badge: 'bg-tertiary/10 text-tertiary', icon: 'text-tertiary', progress: 'bg-tertiary', hover: 'hover:text-tertiary'
  }
};

export default function GoalsView({ goals = [], addGoal, updateGoalProgress, deleteGoal, onOpenQuickAdd, settings = {} }) {
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState(null);
  const [newGoalForm, setNewGoalForm] = useState({
    title: '', category: 'career', why: '', daysLeft: ''
  });

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (!newGoalForm.title) return;
    addGoal({
      ...newGoalForm,
      progress: 0,
      daysLeft: parseInt(newGoalForm.daysLeft, 10) || 0,
      keyResults: 0,
      tasksActive: 0,
      velocity: 'on-track',
      color: newGoalForm.category === 'career' ? 'primary' : newGoalForm.category === 'health' ? 'secondary' : 'tertiary'
    });
    setShowNewGoal(false);
    setNewGoalForm({ title: '', category: 'career', why: '', daysLeft: '' });
  };

  const filteredGoals = goals.filter(g => filter === 'all' || g.category === filter);

  const stats = {
    all: goals.length,
    career: goals.filter(g => g.category === 'career').length,
    health: goals.filter(g => g.category === 'health').length,
    creative: goals.filter(g => g.category === 'creative').length,
  };

  const circumference = 2 * Math.PI * 40;

  const renderGoalCard = (goal) => {
    const offset = circumference * (1 - (goal.progress || 0) / 100);
    const color = COLOR_CLASSES[goal.color] || COLOR_CLASSES.primary;
    
    let velIcon = 'trending_up';
    let velText = 'Ahead of pace';
    let velColorClass = 'bg-secondary-fixed/50 text-on-secondary-fixed-variant';
    
    if (goal.velocity === 'on-track') {
      velIcon = 'check';
      velText = 'On track';
      velColorClass = 'bg-primary/10 text-primary';
    } else if (goal.velocity === 'behind') {
      velIcon = 'warning';
      velText = 'Needs attention';
      velColorClass = 'bg-error-container text-on-error-container';
    }

    const categoryText = {
      career: 'Career & Craft',
      health: 'Health & Athletics',
      creative: 'Creative & Mind'
    }[goal.category] || 'Goal';

    return (
      <div key={goal.id} className="group flex flex-col justify-between rounded-xl bg-surface-container-lowest p-gutter-xl shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300">
        <div>
          <div className="flex items-start justify-between gap-gutter-sm mb-gutter-base">
            <span className={`px-gutter-sm py-1 rounded-full ${color.badge} font-label-sm text-label-sm tracking-wide`}>
              {categoryText}
            </span>
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${velColorClass} font-label-sm text-label-sm font-semibold`}>
              <span className="material-symbols-outlined text-[14px]">{velIcon}</span>
              <span>{velText}</span>
            </div>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-tight mb-gutter-xs">
            {goal.title}
          </h2>
          <div className="p-gutter-base rounded-lg bg-surface-container-low/70 my-gutter-md">
            <div className="flex items-center gap-gutter-xs mb-1">
              <span className={`material-symbols-outlined text-[14px] ${color.icon}`}>lightbulb</span>
              <span className="font-caption text-caption uppercase tracking-wider text-on-surface-variant font-semibold">The Mandatory Why</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface italic">
              “{goal.why}”
            </p>
          </div>
          <div className="flex items-center gap-gutter-lg my-gutter-lg">
            <button type="button" aria-label={`Increase ${goal.title} progress by 5 percent`} className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center cursor-pointer" onClick={() => updateGoalProgress(goal.id, 5)}>
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle className="text-surface-container-high fill-none" cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" />
                <circle className={`${color.icon} fill-none transition-all duration-1000`} cx="50" cy="50" r="40" stroke="currentColor" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" strokeWidth="8" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tighter leading-none">{goal.progress}<span className="text-xs font-normal">%</span></span>
                <span className="font-caption text-caption text-on-surface-variant mt-0.5">done</span>
              </div>
            </button>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-gutter-xs text-on-surface font-label-md text-label-md">
                <span className={`material-symbols-outlined text-[18px] ${color.icon}`}>schedule</span>
                <span className="font-semibold">{goal.daysLeft} days left</span>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Estimated launch: {goal.targetDate || 'TBD'}</span>
              <div className="w-full bg-surface-container rounded-full h-1 mt-1">
                <div className={`${color.progress} h-1 rounded-full`} style={{ width: `${goal.progress}%` }}></div>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-gutter-base mt-gutter-base bg-surface-container-low/50 -mx-gutter-xl -mb-gutter-xl px-gutter-xl pb-gutter-base rounded-b-xl flex items-center justify-between">
          <div className="flex items-center gap-gutter-md text-on-surface-variant font-label-sm text-label-sm">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-outline">account_tree</span>
              {goal.keyResults || 0} Key Results
            </span>
            <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-outline">check_box</span>
              {goal.tasksActive || 0} Tasks Active
            </span>
          </div>
          <button onClick={() => setGoalToDelete(goal)} className={`p-1 rounded-full hover:bg-surface-container text-on-surface-variant ${color.hover} transition-colors`} title="Delete Goal" aria-label={`Delete ${goal.title}`}>
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>
    );
  };

  const matrixBehind = filteredGoals.filter(g => g.velocity === 'behind');
  const matrixOnTrack = filteredGoals.filter(g => g.velocity === 'on-track');
  const matrixAhead = filteredGoals.filter(g => g.velocity === 'ahead');
  const matrixCompleted = filteredGoals.filter(g => g.progress === 100);

  const renderMatrixCard = (title, count, goalsList, dotColor, badgeBg, badgeText, badgeColor, actionText) => (
    <div className="rounded-xl bg-surface-container-lowest p-gutter-lg shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-gutter-md mb-gutter-md border-b-0">
          <div className="flex items-center gap-gutter-sm">
            <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></span>
            <span className="font-title text-title text-on-surface">{title}</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full ${badgeBg} ${badgeColor} font-caption text-caption font-semibold`}>
            {badgeText}
          </span>
        </div>
        <div className="space-y-gutter-sm">
          {goalsList.map(g => (
            <div key={g.id} className="p-gutter-md rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between">
              <div className="flex items-center gap-gutter-md min-w-0">
                <div className={`w-2 h-8 rounded-full ${(COLOR_CLASSES[g.color] || COLOR_CLASSES.primary).progress} flex-shrink-0`}></div>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-md text-label-md text-on-surface font-medium truncate">{g.title}</span>
                  <span className="font-caption text-caption text-on-surface-variant">{g.progress}% • {g.daysLeft} days left</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-outline">arrow_forward</span>
            </div>
          ))}
          {goalsList.length === 0 && (
            <div className="p-gutter-md rounded-lg bg-surface-container-low flex items-center justify-center opacity-70">
              <span className="font-caption text-caption text-on-surface-variant">No goals in this segment</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-gutter-md pt-gutter-sm flex items-center justify-between font-caption text-caption text-on-surface-variant">
        <span>{count} Items</span>
        <span className="text-primary font-medium cursor-pointer hover:underline">{actionText}</span>
      </div>
    </div>
  );

  return (
    <main className="w-full pt-16 md:pt-12 px-4 sm:px-6 md:px-margin-desktop py-4 sm:py-gutter-xl min-h-screen bg-surface">
      <div className="flex flex-col w-full">
        {/* Visual Ambient Light Accents */}
        <div className="relative w-full overflow-hidden">
          <div className="absolute -top-24 right-10 w-96 h-96 bg-gradient-to-br from-primary/10 via-tertiary/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute top-48 left-1/3 w-80 h-80 bg-gradient-to-br from-secondary/10 via-secondary-fixed/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* Header Block */}
        <header className="relative flex flex-col md:flex-row md:items-end justify-between gap-gutter-base pb-gutter-xl">
          <div className="flex flex-col gap-gutter-xs">
            <div className="flex items-center gap-gutter-sm">
              <span className="font-caption text-caption uppercase tracking-wider text-primary font-semibold">Long-Term Trajectory</span>
              <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
              <span className="font-caption text-caption text-on-surface-variant">Q2 Cycle Active</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Goals &amp; Horizons</h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
              Calibrate purpose, maintain rigorous momentum, and measure velocity across your primary strategic vectors.
            </p>
          </div>

          {/* Actions & Segmented Control */}
          <div className="flex items-center gap-gutter-md flex-wrap self-start md:self-auto">
            <div className="p-1 rounded-full bg-surface-container flex items-center shadow-inner">
              <button 
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-gutter-xs px-gutter-md py-1.5 rounded-full font-label-md text-label-md transition-all ${viewMode === 'grid' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-[16px]">grid_view</span>
                <span>Grid View</span>
              </button>
              <button 
                onClick={() => setViewMode('matrix')}
                className={`flex items-center gap-gutter-xs px-gutter-md py-1.5 rounded-full font-label-md text-label-md transition-all ${viewMode === 'matrix' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-[16px]">dashboard_customize</span>
                <span>Eisenhower Matrix</span>
              </button>
            </div>
            <button 
              onClick={() => setShowNewGoal(!showNewGoal)}
              className="flex items-center gap-gutter-xs px-gutter-lg py-2.5 rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md shadow-sm hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>New Goal</span>
            </button>
          </div>
        </header>

        {/* Category Filter Bar */}
        <div className="flex items-center gap-1 sm:gap-gutter-sm pb-4 md:pb-gutter-lg select-none w-full md:w-auto md:overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setFilter('all')} 
            className={`flex-1 md:flex-initial category-pill flex items-center justify-center md:justify-start gap-1 sm:gap-gutter-sm px-2 sm:px-gutter-md py-1.5 rounded-full font-label-md text-[11px] sm:text-label-md shadow-sm transition-all whitespace-nowrap ${
              filter === 'all' 
                ? 'active bg-on-surface text-surface' 
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="md:hidden">All</span>
            <span className="hidden md:inline">All Goals</span>
            <span className={`px-1.5 py-0.2 rounded-full font-caption text-[10px] sm:text-caption ${
              filter === 'all' ? 'bg-surface/20 text-surface' : 'bg-surface-container-highest text-on-surface-variant'
            }`}>
              {stats.all}
            </span>
          </button>

          <button 
            onClick={() => setFilter('career')} 
            className={`flex-1 md:flex-initial category-pill flex items-center justify-center md:justify-start gap-1 sm:gap-gutter-sm px-2 sm:px-gutter-md py-1.5 rounded-full font-label-md text-[11px] sm:text-label-md transition-all whitespace-nowrap ${
              filter === 'career' 
                ? 'active bg-on-surface text-surface shadow-sm' 
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary flex-shrink-0"></span>
            <span className="md:hidden">Career</span>
            <span className="hidden md:inline">Career &amp; Craft</span>
            <span className={`px-1.5 py-0.2 rounded-full font-caption text-[10px] sm:text-caption ${
              filter === 'career' ? 'bg-surface/20 text-surface' : 'bg-surface-container-highest text-on-surface-variant'
            }`}>
              {stats.career}
            </span>
          </button>

          <button 
            onClick={() => setFilter('health')} 
            className={`flex-1 md:flex-initial category-pill flex items-center justify-center md:justify-start gap-1 sm:gap-gutter-sm px-2 sm:px-gutter-md py-1.5 rounded-full font-label-md text-[11px] sm:text-label-md transition-all whitespace-nowrap ${
              filter === 'health' 
                ? 'active bg-on-surface text-surface shadow-sm' 
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-secondary flex-shrink-0"></span>
            <span className="md:hidden">Health</span>
            <span className="hidden md:inline">Health &amp; Athletics</span>
            <span className={`px-1.5 py-0.2 rounded-full font-caption text-[10px] sm:text-caption ${
              filter === 'health' ? 'bg-surface/20 text-surface' : 'bg-surface-container-highest text-on-surface-variant'
            }`}>
              {stats.health}
            </span>
          </button>

          <button 
            onClick={() => setFilter('creative')} 
            className={`flex-1 md:flex-initial category-pill flex items-center justify-center md:justify-start gap-1 sm:gap-gutter-sm px-2 sm:px-gutter-md py-1.5 rounded-full font-label-md text-[11px] sm:text-label-md transition-all whitespace-nowrap ${
              filter === 'creative' 
                ? 'active bg-on-surface text-surface shadow-sm' 
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-tertiary flex-shrink-0"></span>
            <span className="md:hidden">Creative</span>
            <span className="hidden md:inline">Creative &amp; Mind</span>
            <span className={`px-1.5 py-0.2 rounded-full font-caption text-[10px] sm:text-caption ${
              filter === 'creative' ? 'bg-surface/20 text-surface' : 'bg-surface-container-highest text-on-surface-variant'
            }`}>
              {stats.creative}
            </span>
          </button>

          <div className="h-5 w-px bg-surface-container-highest mx-gutter-xs hidden sm:block"></div>
          <div className="hidden sm:flex items-center gap-gutter-xs text-on-surface-variant font-caption text-caption px-gutter-xs">
            <span className="material-symbols-outlined text-[15px] text-outline">sort</span>
            <span>Ranked by Velocity</span>
          </div>
        </div>

        {showNewGoal && (
          <form onSubmit={handleAddGoal} className="mb-gutter-xl p-gutter-lg bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-gutter-md">
            <h3 className="font-headline-sm text-headline-sm">Create New Goal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-md">
              <input type="text" placeholder="Goal Title" required value={newGoalForm.title} onChange={e => setNewGoalForm({...newGoalForm, title: e.target.value})} className="px-4 py-2 rounded-lg bg-surface-container-low border-none outline-none focus:ring-2 focus:ring-primary" />
              <select value={newGoalForm.category} onChange={e => setNewGoalForm({...newGoalForm, category: e.target.value})} className="px-4 py-2 rounded-lg bg-surface-container-low border-none outline-none focus:ring-2 focus:ring-primary">
                <option value="career">Career &amp; Craft</option>
                <option value="health">Health &amp; Athletics</option>
                <option value="creative">Creative &amp; Mind</option>
              </select>
              <input type="number" placeholder="Days Left" required value={newGoalForm.daysLeft} onChange={e => setNewGoalForm({...newGoalForm, daysLeft: e.target.value})} className="px-4 py-2 rounded-lg bg-surface-container-low border-none outline-none focus:ring-2 focus:ring-primary" />
              <textarea placeholder="The Mandatory Why" required value={newGoalForm.why} onChange={e => setNewGoalForm({...newGoalForm, why: e.target.value})} className="px-4 py-2 rounded-lg bg-surface-container-low border-none outline-none focus:ring-2 focus:ring-primary h-10"></textarea>
            </div>
            <div className="flex justify-end gap-gutter-sm">
              <button type="button" onClick={() => setShowNewGoal(false)} className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-on-primary">Save Goal</button>
            </div>
          </form>
        )}

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter-xl pb-gutter-2xl">
            {filteredGoals.map(renderGoalCard)}
          </div>
        ) : (
          <section className="flex flex-col gap-gutter-lg pb-gutter-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-gutter-sm">
              <div>
                <div className="flex items-center gap-gutter-xs mb-1">
                  <span className="material-symbols-outlined text-[18px] text-tertiary">grid_goldenratio</span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-tight">Eisenhower Priority Matrix</h2>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Balancing urgent tactical demands against non-negotiable strategic imperatives.
                </p>
              </div>
              <div className="flex items-center gap-gutter-sm">
                <span className="px-gutter-sm py-1 rounded-full bg-surface-container font-caption text-caption text-on-surface-variant">
                  Live Horizon Distribution
                </span>
                <button className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-lg">
              {renderMatrixCard('Needs Attention', matrixBehind.length, matrixBehind, 'bg-error', 'bg-error-container', 'Act Immediately', 'text-on-error-container', 'Batch execute →')}
              {renderMatrixCard('On Track', matrixOnTrack.length, matrixOnTrack, 'bg-primary', 'bg-primary-fixed', 'Strategic Horizon', 'text-on-primary-fixed-variant', 'Inspect schedule →')}
              {renderMatrixCard('Ahead of Pace', matrixAhead.length, matrixAhead, 'bg-outline', 'bg-surface-container-highest', 'Delegate / Compress', 'text-on-surface-variant', 'Automate rules →')}
              {renderMatrixCard('Completed', matrixCompleted.length, matrixCompleted, 'bg-surface-container-highest', 'bg-surface-container', 'Purge / Filter', 'text-on-surface-variant', 'Clear backlog')}
            </div>
          </section>
        )}

        {/* Visual Inspiration Section: Deep Craft Artifacts */}
        <div className="mb-gutter-2xl p-gutter-lg rounded-2xl bg-surface-container-low/60 flex flex-col md:flex-row items-center justify-between gap-gutter-xl">
          <div className="flex items-center gap-gutter-lg">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed text-primary flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[24px]">architecture</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-caption text-caption uppercase text-primary font-semibold tracking-wider">Design Philosophy</span>
              <span className="font-title text-title text-on-surface">The Architecture of Restraint</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-lg">
                High velocity is not frantic activity. It is the uncompromising removal of secondary priorities to make room for absolute precision.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-gutter-md flex-shrink-0">
            <div className="flex flex-col text-right">
              <span className="font-label-md text-label-md text-on-surface font-semibold">{settings?.profile?.name || 'Personal Workspace'}</span>
              <span className="font-caption text-caption text-on-surface-variant">{settings?.profile?.role || 'Focus Mode'} • {settings?.profile?.workCycle || 'Active Cycle'}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {(settings?.profile?.name || 'ME').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!goalToDelete}
        title="Delete Strategic Goal?"
        message={`Are you sure you want to delete "${goalToDelete?.title}"? All active progress tracking will be removed.`}
        confirmText="Delete Goal"
        isDanger={true}
        onConfirm={() => {
          if (goalToDelete) {
            deleteGoal(goalToDelete.id);
            setGoalToDelete(null);
          }
        }}
        onCancel={() => setGoalToDelete(null)}
      />
    </main>
  );
}
