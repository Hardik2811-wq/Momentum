import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import QuickAddModal from './components/QuickAddModal';
import FocusTimerBar from './components/FocusTimerBar';
import ToastContainer from './components/ToastContainer';

import DashboardView from './views/DashboardView';
import TodayView from './views/TodayView';
import GoalsView from './views/GoalsView';
import HabitsView from './views/HabitsView';
import ReflectionsView from './views/ReflectionsView';
import AnalyticsView from './views/AnalyticsView';
import SettingsView from './views/SettingsView';
import useStore from './store/useStore';
import MobileTabBar from './components/MobileTabBar';
import AuthGate from './components/AuthGate';
import OnboardingModal from './components/OnboardingModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddProps, setQuickAddProps] = useState({});
  const store = useStore();

  const openQuickAdd = (props = {}) => {
    setQuickAddProps(props);
    setIsQuickAddOpen(true);
  };

  const closeQuickAdd = () => {
    setIsQuickAddOpen(false);
    setQuickAddProps({});
  };

  const startFocusForTask = (taskId) => {
    store.focusTimer.setTimerTaskId(taskId);
    if (!store.focusTimer.isRunning) store.focusTimer.startTimer();
  };

  const renderView = () => {
    const common = {
      tasks: store.tasks,
      onToggleTask: store.toggleTask,
      onDeleteTask: store.deleteTask,
      onToggleSubtask: store.toggleSubtask,
      onOpenQuickAdd: openQuickAdd,
      stats: store.stats,
    };

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            {...common}
            onUpdateTask={store.updateTask}
            setActiveTab={setActiveTab}
            settings={store.settings}
            onUpdateSettings={store.updateSettings}
            onStartFocus={startFocusForTask}
            onCheckInHabit={store.checkInHabit}
            goals={store.goals}
            habits={store.habits}
          />
        );
      case 'today':
        return (
          <TodayView
            {...common}
            onUpdateTask={store.updateTask}
            goals={store.goals}
            habits={store.habits}
            onStartFocus={startFocusForTask}
            onCheckInHabit={store.checkInHabit}
          />
        );
      case 'goals':
        return (
          <GoalsView
            goals={store.goals}
            addGoal={store.addGoal}
            updateGoalProgress={store.updateGoalProgress}
            deleteGoal={store.deleteGoal}
            onOpenQuickAdd={openQuickAdd}
            settings={store.settings}
          />
        );
      case 'habits':
        return (
          <HabitsView
            habits={store.habits}
            checkInHabit={store.checkInHabit}
            addHabit={store.addHabit}
            deleteHabit={store.deleteHabit}
            useGraceDay={store.useGraceDay}
            stats={store.stats}
          />
        );
      case 'reflections':
        return (
          <ReflectionsView
            tasks={store.tasks}
            goals={store.goals}
            habits={store.habits}
            stats={store.stats}
            reflections={store.reflections}
            updateReflection={store.updateReflection}
            saveWeeklyReview={store.saveWeeklyReview}
          />
        );
      case 'analytics':
        return (
          <AnalyticsView
            tasks={store.tasks}
            goals={store.goals}
            habits={store.habits}
            stats={store.stats}
          />
        );
      case 'settings':
        return (
          <SettingsView
            settings={store.settings}
            updateSettings={store.updateSettings}
            updateProfile={store.updateProfile}
            resetAllData={store.resetAllData}
            clearAllData={store.clearAllData}
            loadDemoData={store.loadDemoData}
            exportFullBackup={store.exportFullBackup}
            importFullBackup={store.importFullBackup}
          />
        );
      default:
        return (
          <DashboardView
            {...common}
            onUpdateTask={store.updateTask}
            setActiveTab={setActiveTab}
            settings={store.settings}
            onUpdateSettings={store.updateSettings}
            onStartFocus={startFocusForTask}
            onCheckInHabit={store.checkInHabit}
            goals={store.goals}
            habits={store.habits}
          />
        );
    }
  };

  return (
    <AuthGate>
    <div className="min-h-screen font-sans bg-[#EFEFF5] text-[#1A1B1F]">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickAdd={openQuickAdd}
        settings={store.settings}
      />
      <div className="pl-0 md:pl-[248px] min-h-screen flex flex-col pb-28 md:pb-16">
        <Header
          activeTab={activeTab}
          tasks={store.tasks}
          goals={store.goals}
          setActiveTab={setActiveTab}
        />
        <div className="flex-1 w-full">
          {renderView()}
        </div>
      </div>

      {/* Floating Action Button (FAB) for Mobile Quick Add */}
      <button
        onClick={openQuickAdd}
        aria-label="Quick Add"
        className="md:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-[#0A84FF] to-[#5E5CE6] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(10,132,255,0.4)] active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      {/* Real Pomodoro Deep Work Focus Bar */}
      {(store.settings?.showFocusBar ?? true) && (
        <FocusTimerBar
          focusTimer={store.focusTimer}
          tasks={store.tasks}
          onClose={() => store.updateSettings({ showFocusBar: false })}
        />
      )}

      {/* Mobile Native Bottom Tab Bar */}
      <MobileTabBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickAdd={openQuickAdd}
      />

      {/* Quick Add Modal with Goal and Habit Linkage */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={closeQuickAdd}
        onAddTask={store.addTask}
        onUpdateSettings={store.updateSettings}
        goals={store.goals}
        habits={store.habits}
        initialTime={quickAddProps.initialTime || ''}
        initialDate={quickAddProps.initialDate ?? ''}
        initialGoalId={quickAddProps.initialGoalId || ''}
        initialHabitId={quickAddProps.initialHabitId || ''}
      />

      {/* Onboarding Modal for First User without Profile Name */}
      <OnboardingModal
        isOpen={Boolean(!store.settings?.profile?.name)}
        onSave={(data) => store.updateProfile(data)}
        initialName={store.settings?.profile?.name || ''}
        initialRole={store.settings?.profile?.role || ''}
        initialTimezone={store.settings?.profile?.timezone || ''}
      />

      {/* System Toast & Undo Notifications */}
      <ToastContainer
        toasts={store.toasts}
        dismissToast={store.dismissToast}
      />
    </div>
    </AuthGate>
  );
}
