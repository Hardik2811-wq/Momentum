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
import UniversalBlockEditor from './components/UniversalBlockEditor';
import UniversalLayoutApplier from './components/UniversalLayoutApplier';
import GoalModal from './components/GoalModal';
import HabitModal from './components/HabitModal';
import AiCopilotModal from './components/AiCopilotModal';
import ApiKeyModal from './components/ApiKeyModal';
import AndroidWidgetSync from './components/AndroidWidgetSync';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [quickAddProps, setQuickAddProps] = useState({});
  const [isUniversalEditorMode, setIsUniversalEditorMode] = useState(false);
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
      onReorderTasks: store.reorderTasks,
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
            schedules={store.schedules}
            onUpdateSchedule={store.updateSchedule}
            onDeleteSchedule={store.deleteSchedule}
            moveTaskToBacklog={store.moveTaskToBacklog}
            sweepMissedTasksToBacklog={store.sweepMissedTasksToBacklog}
          />
        );
      case 'today':
        return (
          <TodayView
            {...common}
            onUpdateTask={store.updateTask}
            goals={store.goals}
            habits={store.habits}
            schedules={store.schedules}
            onDeleteSchedule={store.deleteSchedule}
            onStartFocus={startFocusForTask}
            onCheckInHabit={store.checkInHabit}
          />
        );
      case 'goals':
        return (
          <GoalsView
            goals={store.goals}
            addGoal={store.addGoal}
            updateGoal={store.updateGoal}
            updateGoalProgress={store.updateGoalProgress}
            deleteGoal={store.deleteGoal}
            onOpenQuickAdd={openQuickAdd}
            settings={store.settings}
            tasks={store.tasks}
            habits={store.habits}
            addTask={store.addTask}
            onToggleTask={store.toggleTask}
            onStartFocus={startFocusForTask}
            focusSessions={store.focusSessions}
          />
        );
      case 'habits':
        return (
          <HabitsView
            habits={store.habits}
            checkInHabit={store.checkInHabit}
            addHabit={store.addHabit}
            updateHabit={store.updateHabit}
            deleteHabit={store.deleteHabit}
            useGraceDay={store.useGraceDay}
            goals={store.goals}
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
            focusSessions={store.focusSessions}
            onStartFocus={startFocusForTask}
            onOpenQuickAdd={openQuickAdd}
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
            schedules={store.schedules}
            onUpdateSchedule={store.updateSchedule}
            onDeleteSchedule={store.deleteSchedule}
            moveTaskToBacklog={store.moveTaskToBacklog}
            sweepMissedTasksToBacklog={store.sweepMissedTasksToBacklog}
          />
        );
    }
  };

  return (
    <>
      <AndroidWidgetSync
        tasks={store.tasks}
        onToggleTask={store.toggleTask}
        onOpenQuickAdd={openQuickAdd}
      />
      <AuthGate>
      <div className="min-h-screen font-sans bg-[#EFEFF5] text-[#1A1B1F]">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickAdd={openQuickAdd}
        onOpenAiCopilot={() => setIsAiCopilotOpen(true)}
        settings={store.settings}
      />
      <div className="pl-0 md:pl-[248px] min-h-screen flex flex-col pb-28 md:pb-16">
        <Header
          activeTab={activeTab}
          tasks={store.tasks}
          goals={store.goals}
          setActiveTab={setActiveTab}
          isUniversalEditorMode={isUniversalEditorMode}
          onToggleUniversalEditor={() => setIsUniversalEditorMode(v => !v)}
          onOpenAiCopilot={() => setIsAiCopilotOpen(true)}
        />
        <div className="flex-1 w-full">
          {renderView()}
        </div>
      </div>


      {/* Real Pomodoro Deep Work Focus Bar */}
      {(store.settings?.showFocusBar ?? true) && (
        <FocusTimerBar
          focusTimer={store.focusTimer}
          tasks={store.tasks}
          onClose={() => store.updateSettings({ showFocusBar: false })}
        />
      )}

      {/* Mobile Native Bottom Tab Bar with Speed Dial */}
      <MobileTabBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickAdd={openQuickAdd}
        onOpenNewGoal={() => setIsGoalModalOpen(true)}
        onOpenNewHabit={() => setIsHabitModalOpen(true)}
        onOpenAiCopilot={() => setIsAiCopilotOpen(true)}
      />

      {/* AI Executive Copilot Modal */}
      <AiCopilotModal
        isOpen={isAiCopilotOpen}
        onClose={() => setIsAiCopilotOpen(false)}
        goals={store.goals}
        habits={store.habits}
        tasks={store.tasks}
        schedules={store.schedules}
        stats={store.stats}
        addGoal={store.addGoal}
        addHabit={store.addHabit}
        addTask={store.addTask}
        toggleTask={store.toggleTask}
        checkInHabit={store.checkInHabit}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
      />

      {/* Groq API Key Configuration Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />

      {/* Goal Creation Modal accessible globally */}
      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onAddGoal={store.addGoal}
        habits={store.habits}
      />

      {/* Habit Creation Modal accessible globally */}
      <HabitModal
        isOpen={isHabitModalOpen}
        onClose={() => setIsHabitModalOpen(false)}
        onSave={store.addHabit}
        goals={store.goals}
      />

      {/* Quick Add Modal with Goal and Habit Linkage */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={closeQuickAdd}
        onAddTask={store.addTask}
        onAddSchedule={store.addSchedule}
        onUpdateSettings={store.updateSettings}
        goals={store.goals}
        habits={store.habits}
        tasks={store.tasks}
        schedules={store.schedules}
        initialTitle={quickAddProps.initialTitle || ''}
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

      {/* Universal Dynamic Layout Rules Applier (Active always, persists custom block sizes forever) */}
      <UniversalLayoutApplier
        customUiLayout={store.settings?.customUiLayout}
      />

      {/* Universal Vector-Style Shape Manipulator & Block Editor */}
      <UniversalBlockEditor
        isEditorMode={isUniversalEditorMode}
        onToggleEditorMode={() => setIsUniversalEditorMode(v => !v)}
        customUiLayout={store.settings?.customUiLayout}
        onUpdateLayout={store.updateCustomUiLayout}
        onResetLayout={store.resetCustomUiLayout}
      />
    </div>
    </AuthGate>
    </>
  );
}
