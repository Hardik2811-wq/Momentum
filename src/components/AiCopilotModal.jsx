import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { parseDocumentFile } from '../lib/documentParser';
import { generateExecutivePlanWithAI, hasAiService } from '../lib/groqClient';
import { todayPlanDate, calculateEndTime } from '../lib/taskMetadata';
import { resolveLocalCopilotIntent } from '../lib/copilotIntentRouter';
import { harvestCopilotPlan } from '../lib/nlpMemory';
import LifeGraphVisualizer from './LifeGraphVisualizer';

const QUICK_CHIPS = [
  { label: 'Schedule from document', prompt: 'I have attached a project document. Analyze the deliverables, milestones, and schedule them into my Planner.' },
  { label: 'Break down a 30-day goal', prompt: 'Help me break down a major 30-day objective into actionable weekly milestones, daily habits, and scheduled tasks.' },
  { label: 'Plan today’s focus queue', prompt: 'Review my priorities and construct an optimal, time-blocked execution schedule for today.' }
];

export default function AiCopilotModal({
  isOpen,
  onClose,
  goals = [],
  habits = [],
  tasks = [],
  schedules = [],
  stats = null,
  addGoal,
  addHabit,
  addTask,
  toggleTask,
  checkInHabit,
  onOpenApiKeyModal
}) {
  const [copilotView, setCopilotView] = useState('chat'); // 'chat' | 'graph'
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachedDoc, setAttachedDoc] = useState(null);
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [appliedPlans, setAppliedPlans] = useState(new Set());
  const [editingPlanIds, setEditingPlanIds] = useState(new Set());

  const toggleEditPlan = (messageId) => {
    setEditingPlanIds(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const updatePlanGoal = (messageId, goalIdx, field, value) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.plan?.goals) return m;
      const goals = [...m.plan.goals];
      goals[goalIdx] = { ...goals[goalIdx], [field]: value };
      return { ...m, plan: { ...m.plan, goals } };
    }));
  };

  const removePlanGoal = (messageId, goalIdx) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.plan?.goals) return m;
      const goals = m.plan.goals.filter((_, idx) => idx !== goalIdx);
      return { ...m, plan: { ...m.plan, goals } };
    }));
  };

  const updatePlanHabit = (messageId, habitIdx, field, value) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.plan?.habits) return m;
      const habits = [...m.plan.habits];
      habits[habitIdx] = { ...habits[habitIdx], [field]: value };
      return { ...m, plan: { ...m.plan, habits } };
    }));
  };

  const removePlanHabit = (messageId, habitIdx) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.plan?.habits) return m;
      const habits = m.plan.habits.filter((_, idx) => idx !== habitIdx);
      return { ...m, plan: { ...m.plan, habits } };
    }));
  };

  const updatePlanTask = (messageId, taskIdx, field, value) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.plan?.tasks) return m;
      const tasks = [...m.plan.tasks];
      tasks[taskIdx] = { ...tasks[taskIdx], [field]: value };
      return { ...m, plan: { ...m.plan, tasks } };
    }));
  };

  const updatePlanSubtasks = (messageId, taskIdx, subtasksString) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.plan?.tasks) return m;
      const tasks = [...m.plan.tasks];
      const parsed = subtasksString.split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .map((title, sIdx) => ({ id: `st-${Date.now()}-${sIdx}`, title, completed: false }));
      tasks[taskIdx] = { ...tasks[taskIdx], subtasks: parsed };
      return { ...m, plan: { ...m.plan, tasks } };
    }));
  };

  const removePlanTask = (messageId, taskIdx) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.plan?.tasks) return m;
      const tasks = m.plan.tasks.filter((_, idx) => idx !== taskIdx);
      return { ...m, plan: { ...m.plan, tasks } };
    }));
  };

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, isParsingDoc]);

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingDoc(true);
    try {
      const parsed = await parseDocumentFile(file);
      setAttachedDoc(parsed);
    } catch (err) {
      alert(`Could not read document: ${err.message}`);
    } finally {
      setIsParsingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend ?? input).trim();
    if (!query && !attachedDoc) return;

    // 1. Try resolving locally with 0 API tokens (70% of frequent queries/actions)
    if (!attachedDoc && query) {
      const localResult = resolveLocalCopilotIntent({
        query,
        tasks,
        goals,
        habits,
        stats,
        todayDate: todayPlanDate(),
        actions: { addTask, toggleTask, checkInHabit }
      });

      if (localResult.handledLocally) {
        setMessages(prev => [
          ...prev,
          {
            id: 'msg-' + Date.now(),
            role: 'user',
            content: query
          },
          {
            id: 'asst-' + (Date.now() + 1),
            role: 'assistant',
            content: localResult.message,
            hasPlan: false,
            plan: null
          }
        ]);
        setInput('');
        return;
      }
    }

    if (!hasAiService()) {
      onOpenApiKeyModal?.();
      return;
    }

    const userMsgId = 'msg-' + Date.now();
    const userMsg = {
      id: userMsgId,
      role: 'user',
      content: query || `Analyze document: ${attachedDoc?.name}`,
      docName: attachedDoc?.name
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsGenerating(true);

    const docToSend = attachedDoc;
    setAttachedDoc(null);

    try {
      const result = await generateExecutivePlanWithAI({
        userPrompt: userMsg.content,
        documentContext: docToSend,
        chatHistory: messages.slice(-8),
        goals,
        habits,
        tasks,
        stats,
        todayDate: todayPlanDate()
      });

      if (!result.success) {
        setMessages(prev => [
          ...prev,
          {
            id: 'err-' + Date.now(),
            role: 'assistant',
            content: `Unable to complete request: ${result.error || 'Check connection or API key.'}`,
            hasPlan: false
          }
        ]);
        return;
      }

      const data = result.data;
      const assistantMsg = {
        id: 'asst-' + Date.now(),
        role: 'assistant',
        content: data.message || 'Here is the proposed schedule based on your input:',
        hasPlan: Boolean(data.hasPlan && data.plan),
        plan: data.plan || null
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          content: `Connection error: ${err.message}`,
          hasPlan: false
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprovePlan = (messageId, plan) => {
    if (!plan || appliedPlans.has(messageId)) return;

    const timestamp = Date.now();
    const goalIdMap = new Map();
    const habitIdMap = new Map();

    // 1. Process Goals (re-use existing goal if title matches closely, avoiding duplicates)
    if (Array.isArray(plan.goals)) {
      plan.goals.forEach((g, idx) => {
        if (!g.title) return;
        const cleanTitle = g.title.trim().toLowerCase();
        const existingGoal = goals.find(eg => eg.title && eg.title.trim().toLowerCase() === cleanTitle);

        if (existingGoal) {
          goalIdMap.set(idx, existingGoal.id);
        } else {
          const id = `g-${timestamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
          addGoal({
            id,
            title: g.title,
            categories: [g.category || 'career'],
            why: g.why || '',
            targetDate: g.targetDate || null,
            dateType: g.targetDate ? 'custom' : 'open',
            color: g.category === 'health' ? 'secondary' : g.category === 'creative' ? 'tertiary' : 'primary'
          });
          goalIdMap.set(idx, id);
        }
      });
    }

    // 2. Process Habits (re-use existing habit if title matches closely)
    if (Array.isArray(plan.habits)) {
      plan.habits.forEach((h, idx) => {
        if (!h.title) return;
        const cleanTitle = h.title.trim().toLowerCase();
        const existingHabit = habits.find(eh => eh.title && eh.title.trim().toLowerCase() === cleanTitle);

        const linkedGoalId = (h.goalIndex !== undefined && h.goalIndex !== null && goalIdMap.has(h.goalIndex))
          ? goalIdMap.get(h.goalIndex)
          : h.linkedGoalId || null;

        const linkedGoalTitle = linkedGoalId
          ? (plan.goals?.[h.goalIndex]?.title || goals.find(g => String(g.id) === String(linkedGoalId))?.title || h.linkedGoal || '')
          : (h.linkedGoal || '');

        if (existingHabit) {
          habitIdMap.set(idx, existingHabit.id);
        } else {
          const id = `h-${timestamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
          addHabit({
            id,
            title: h.title,
            cadence: h.cadence || 'Morning',
            targetFrequency: h.frequency || 'Every Day',
            duration: h.duration || '30 mins',
            icon: h.icon || 'cached',
            colorToken: h.colorToken || 'primary',
            linkedGoal: linkedGoalTitle,
            linkedGoalId: linkedGoalId || null
          });
          habitIdMap.set(idx, id);
        }
      });
    }

    // 3. Create & Schedule Tasks with intelligent time-slot collision avoidance
    if (Array.isArray(plan.tasks)) {
      // Build index of already booked time intervals for the targeted dates
      const bookedSlots = [];
      tasks.forEach(t => {
        if (!t.completed && t.plannedDate && t.startTime) {
          const dur = Number(t.durationMinutes) || 45;
          const [sh, sm] = t.startTime.split(':').map(Number);
          if (!isNaN(sh) && !isNaN(sm)) {
            const startM = sh * 60 + sm;
            bookedSlots.push({ date: t.plannedDate, startM, endM: startM + dur });
          }
        }
      });

      plan.tasks.forEach((t, idx) => {
        if (!t.title) return;
        const cleanTitle = t.title.trim().toLowerCase();
        const taskDate = t.plannedDate || todayPlanDate();

        // Check if identical task already exists on this planned date
        const isDuplicateTask = tasks.some(et => 
          et.title && et.title.trim().toLowerCase() === cleanTitle &&
          (et.plannedDate === taskDate || (!et.plannedDate && taskDate === todayPlanDate()))
        );
        if (isDuplicateTask) return;

        // Resolve goal ID (from goalIndex, existingGoalId, or matching existing goal title)
        let linkedGoalId = null;
        if (t.goalIndex !== undefined && t.goalIndex !== null && goalIdMap.has(t.goalIndex)) {
          linkedGoalId = goalIdMap.get(t.goalIndex);
        } else if (t.existingGoalId) {
          linkedGoalId = t.existingGoalId;
        } else if (t.goalTitle) {
          const matched = goals.find(g => g.title?.trim().toLowerCase() === t.goalTitle.trim().toLowerCase());
          if (matched) linkedGoalId = matched.id;
        }

        // Resolve habit ID (from habitIndex, existingHabitId, or matching existing habit title)
        let linkedHabitId = null;
        if (t.habitIndex !== undefined && t.habitIndex !== null && habitIdMap.has(t.habitIndex)) {
          linkedHabitId = habitIdMap.get(t.habitIndex);
        } else if (t.existingHabitId) {
          linkedHabitId = t.existingHabitId;
        } else if (t.habitTitle) {
          const matched = habits.find(h => h.title?.trim().toLowerCase() === t.habitTitle.trim().toLowerCase());
          if (matched) linkedHabitId = matched.id;
        }

        const durMins = Number(t.durationMinutes) || 45;
        let resolvedStartTime = t.startTime || null;

        // Smart Conflict Resolution: if requested startTime clashes with an existing booking, slide to next free slot
        if (resolvedStartTime) {
          const [sh, sm] = resolvedStartTime.split(':').map(Number);
          if (!isNaN(sh) && !isNaN(sm)) {
            let startM = sh * 60 + sm;
            let collision = true;
            let attempts = 0;
            while (collision && attempts < 16) {
              const endM = startM + durMins;
              const hasOverlap = bookedSlots.some(slot => 
                slot.date === taskDate && Math.max(startM, slot.startM) < Math.min(endM, slot.endM)
              );
              if (hasOverlap) {
                startM = endM + 15; // Push 15 min buffer after previous block
                attempts++;
              } else {
                collision = false;
              }
            }
            if (!collision) {
              const finalH = Math.floor(startM / 60) % 24;
              const finalM = startM % 60;
              resolvedStartTime = `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
              bookedSlots.push({ date: taskDate, startM, endM: startM + durMins });
            }
          }
        }

        const id = `t-${timestamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
        const endTime = resolvedStartTime ? calculateEndTime(resolvedStartTime, durMins) : (t.endTime || null);

        addTask({
          id,
          title: t.title,
          plannedDate: taskDate,
          startTime: resolvedStartTime,
          endTime,
          durationMinutes: durMins,
          duration: durMins,
          energy: t.energy || (t.impact === 'high' ? 'High' : t.impact === 'low' ? 'Low' : 'Normal'),
          impact: t.impact || 'medium',
          priority: t.priority || 'normal',
          areas: Array.isArray(t.areas) ? t.areas : ['Career & Craft'],
          goalId: linkedGoalId,
          linkedHabitId,
          subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
          recurrence: t.recurrence || 'none',
          deadlineDate: t.deadlineDate || null,
          deadlineTime: t.deadlineTime || null,
          completed: false,
          dueDate: t.plannedDate ? 'Today' : 'This Week'
        });
      });
    }

    setAppliedPlans(prev => new Set([...prev, messageId]));

    // 4. Harvest newly approved verbs and entities into local offline memory
    harvestCopilotPlan(plan);

    // 5. Inject confirmation into chat history so AI dynamically retains this context across subsequent turns
    const goalsCount = plan.goals?.length || 0;
    const habitsCount = plan.habits?.length || 0;
    const tasksCount = plan.tasks?.length || 0;
    const confirmationText = `Plan successfully added to schedule: ${goalsCount} goals, ${habitsCount} habits, and ${tasksCount} tasks are now live in your workspace.`;

    setMessages(prev => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: 'assistant',
        content: confirmationText,
        hasPlan: false
      }
    ]);

    try {
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { y: 0.6 }
      });
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-xl h-[88vh] sm:h-[80vh] sm:max-h-[720px] bg-white sm:rounded-2xl border-t sm:border border-black/[0.08] shadow-xl flex flex-col overflow-hidden text-[#1A1B1F]">
        
        {/* Mobile Drag Notch */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-white shrink-0">
          <div className="w-9 h-1 bg-black/15 rounded-full" />
        </div>

        {/* Minimal Header (Linear / Raycast Style) */}
        <header className="px-4 sm:px-5 py-2.5 border-b border-black/[0.06] flex items-center justify-between shrink-0 bg-white select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h3 className="font-semibold text-[13px] text-[#1A1B1F] tracking-tight">Copilot</h3>
            <span className="text-[#8E8E93] text-[12px] hidden sm:inline">• Plan &amp; Schedule</span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Chat vs Graphify Life Graph */}
            <div className="flex items-center p-0.5 bg-black/[0.04] rounded-lg border border-black/[0.06]">
              <button
                type="button"
                onClick={() => setCopilotView('chat')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  copilotView === 'chat'
                    ? 'bg-white text-[#1A1B1F] shadow-2xs'
                    : 'text-[#8E8E93] hover:text-[#1A1B1F]'
                }`}
                title="Copilot Chat Assistant"
              >
                <span className="material-symbols-outlined text-[14px]">chat</span>
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setCopilotView('graph')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  copilotView === 'graph'
                    ? 'bg-[#0A84FF] text-white shadow-2xs'
                    : 'text-[#8E8E93] hover:text-[#1A1B1F]'
                }`}
                title="Graphify Life Graph DAG"
              >
                <span className="material-symbols-outlined text-[14px]">hub</span>
                <span>Graphify</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-[#8E8E93] hover:text-[#1A1B1F] hover:bg-black/[0.04] flex items-center justify-center transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </header>

        {copilotView === 'graph' ? (
          <LifeGraphVisualizer
            tasks={tasks}
            goals={goals}
            habits={habits}
            schedules={schedules}
            toggleTask={toggleTask}
            onSwitchToChat={() => setCopilotView('chat')}
          />
        ) : (
          <>
            {/* Message Canvas / Empty State */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Clean, quiet empty state (no bot monologue) */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <div className="w-10 h-10 rounded-2xl bg-black/[0.04] text-[#1A1B1F] flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              </div>
              <h4 className="font-semibold text-sm text-[#1A1B1F] tracking-tight">What are we executing?</h4>
              <p className="text-xs text-[#8E8E93] max-w-xs mt-1 leading-relaxed">
                Drop a project document or write your goals to build a schedule.
              </p>

              {/* Minimalist Quick Chips */}
              <div className="flex flex-wrap gap-2 justify-center mt-5 max-w-sm">
                {QUICK_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(chip.prompt)}
                    className="px-3 py-1.5 rounded-full bg-black/[0.03] hover:bg-black/[0.07] border border-black/[0.05] text-[11px] font-medium text-[#444] transition-colors cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isPlanApplied = appliedPlans.has(msg.id);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
              >
                {/* User Message */}
                {isUser ? (
                  <div className="p-3 px-4 rounded-2xl max-w-[85%] text-[13px] leading-relaxed bg-[#1A1B1F] text-white shadow-xs">
                    {msg.docName && (
                      <div className="flex items-center gap-1.5 text-[11px] text-white/70 mb-1 font-mono">
                        <span className="material-symbols-outlined text-[13px]">attach_file</span>
                        <span>{msg.docName}</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                ) : (
                  /* Assistant Message */
                  <div className="max-w-[92%] sm:max-w-[90%] text-[13px] leading-relaxed text-[#1A1B1F] space-y-2">
                    <div className="whitespace-pre-wrap font-normal text-[#2C2C2E]">{msg.content}</div>

                    {/* Linear-Style Proposed Schedule Card */}
                    {msg.hasPlan && msg.plan && (() => {
                      const isEditing = editingPlanIds.has(msg.id);
                      return (
                      <div className="mt-3 p-4 rounded-xl bg-black/[0.02] border border-black/[0.08] space-y-3.5">
                        <div className="flex items-center justify-between border-b border-black/[0.06] pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[#1A1B1F]">
                              Proposed Schedule
                            </span>
                            {!isPlanApplied && (
                              <button
                                type="button"
                                onClick={() => toggleEditPlan(msg.id)}
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-black/[0.04] hover:bg-black/[0.08] text-[#1A1B1F] transition cursor-pointer flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[13px]">{isEditing ? 'done' : 'edit'}</span>
                                <span>{isEditing ? 'Done' : 'Edit'}</span>
                              </button>
                            )}
                          </div>
                          <span className="text-[11px] text-[#8E8E93] font-mono">
                            {[
                              msg.plan.goals?.length ? `${msg.plan.goals.length} goals` : null,
                              msg.plan.habits?.length ? `${msg.plan.habits.length} habits` : null,
                              msg.plan.tasks?.length ? `${msg.plan.tasks.length} tasks` : null,
                            ].filter(Boolean).join(' • ')}
                          </span>
                        </div>

                        {/* Goals */}
                        {Array.isArray(msg.plan.goals) && msg.plan.goals.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Horizons</span>
                            {msg.plan.goals.map((g, idx) => (
                              <div key={idx} className="p-2 rounded-lg bg-white border border-black/[0.05] text-xs flex items-center justify-between gap-2">
                                {isEditing ? (
                                  <>
                                    <input
                                      type="text"
                                      value={g.title || ''}
                                      onChange={(e) => updatePlanGoal(msg.id, idx, 'title', e.target.value)}
                                      className="flex-1 py-0.5 px-1.5 bg-black/[0.03] border border-black/10 rounded font-medium text-[#1A1B1F] text-xs outline-none focus:bg-white focus:border-[#0A84FF]"
                                    />
                                    <select
                                      value={g.category || 'career'}
                                      onChange={(e) => updatePlanGoal(msg.id, idx, 'category', e.target.value)}
                                      className="py-0.5 px-1 bg-black/[0.03] border border-black/10 rounded text-[10px] font-mono uppercase text-[#64748B] outline-none"
                                    >
                                      <option value="career">CAREER</option>
                                      <option value="health">HEALTH</option>
                                      <option value="creative">CREATIVE</option>
                                      <option value="finance">FINANCE</option>
                                    </select>
                                    <input
                                      type="date"
                                      value={g.targetDate || ''}
                                      onChange={(e) => updatePlanGoal(msg.id, idx, 'targetDate', e.target.value || null)}
                                      className="py-0.5 px-1 bg-black/[0.03] border border-black/10 rounded text-[10px] font-mono text-[#64748B] outline-none"
                                      title="Target date"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removePlanGoal(msg.id, idx)}
                                      className="text-[#8E8E93] hover:text-red-500 p-0.5 cursor-pointer"
                                      title="Remove goal"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">close</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex-1 min-w-0 pr-2">
                                      <span className="font-medium text-[#1A1B1F]">{g.title}</span>
                                      {g.targetDate && (
                                        <span className="ml-2 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-mono">
                                          due {g.targetDate}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-[#8E8E93] uppercase font-mono">{g.category || 'career'}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Habits */}
                        {Array.isArray(msg.plan.habits) && msg.plan.habits.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Daily Rituals</span>
                            {msg.plan.habits.map((h, idx) => (
                              <div key={idx} className="p-2 rounded-lg bg-white border border-black/[0.05] text-xs flex items-center justify-between gap-2">
                                {isEditing ? (
                                  <>
                                    <input
                                      type="text"
                                      value={h.title || ''}
                                      onChange={(e) => updatePlanHabit(msg.id, idx, 'title', e.target.value)}
                                      className="flex-1 py-0.5 px-1.5 bg-black/[0.03] border border-black/10 rounded font-medium text-[#1A1B1F] text-xs outline-none focus:bg-white focus:border-[#0A84FF]"
                                    />
                                    <select
                                      value={h.cadence || 'Morning'}
                                      onChange={(e) => updatePlanHabit(msg.id, idx, 'cadence', e.target.value)}
                                      className="py-0.5 px-1 bg-black/[0.03] border border-black/10 rounded text-[11px] text-[#64748B] outline-none"
                                    >
                                      <option value="Morning">Morning</option>
                                      <option value="Afternoon">Afternoon</option>
                                      <option value="Evening">Evening</option>
                                      <option value="Anytime">Anytime</option>
                                    </select>
                                    <select
                                      value={h.goalIndex ?? (h.linkedGoalId || '')}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '') {
                                          updatePlanHabit(msg.id, idx, 'goalIndex', null);
                                          updatePlanHabit(msg.id, idx, 'linkedGoalId', null);
                                        } else if (val.startsWith('plan-')) {
                                          updatePlanHabit(msg.id, idx, 'goalIndex', Number(val.replace('plan-', '')));
                                          updatePlanHabit(msg.id, idx, 'linkedGoalId', null);
                                        } else {
                                          updatePlanHabit(msg.id, idx, 'linkedGoalId', val);
                                          updatePlanHabit(msg.id, idx, 'goalIndex', null);
                                        }
                                      }}
                                      className="py-0.5 px-1 bg-black/[0.03] border border-black/10 rounded text-[10px] text-blue-700 outline-none max-w-[110px] truncate"
                                      title="Linked Horizon"
                                    >
                                      <option value="">No Linked Horizon</option>
                                      {Array.isArray(msg.plan.goals) && msg.plan.goals.map((g, gIdx) => (
                                        <option key={`pg-${gIdx}`} value={`plan-${gIdx}`}>★ {g.title}</option>
                                      ))}
                                      {goals.map(g => (
                                        <option key={`eg-${g.id}`} value={g.id}>Goal: {g.title}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => removePlanHabit(msg.id, idx)}
                                      className="text-[#8E8E93] hover:text-red-500 p-0.5 cursor-pointer"
                                      title="Remove habit"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">close</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex-1 min-w-0 pr-2">
                                      <span className="font-medium text-[#1A1B1F]">{h.title}</span>
                                      {(() => {
                                        const linkedTitle = typeof h.goalIndex === 'number'
                                          ? msg.plan.goals?.[h.goalIndex]?.title
                                          : (goals.find(g => g.id === h.linkedGoalId)?.title || h.linkedGoal);
                                        return linkedTitle ? (
                                          <span className="ml-2 text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono truncate inline-block max-w-[140px] align-middle">
                                            linked: {linkedTitle}
                                          </span>
                                        ) : null;
                                      })()}
                                    </div>
                                    <span className="text-[10px] text-[#8E8E93]">{h.frequency || h.cadence}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Tasks Timeline */}
                        {Array.isArray(msg.plan.tasks) && msg.plan.tasks.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Execution Timeline</span>
                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                              {msg.plan.tasks.map((t, idx) => (
                                <div key={idx} className="p-2 rounded-lg bg-white border border-black/[0.05] text-xs flex items-center justify-between gap-2">
                                  {isEditing ? (
                                    <div className="w-full space-y-2 p-1">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={t.title || ''}
                                          onChange={(e) => updatePlanTask(msg.id, idx, 'title', e.target.value)}
                                          placeholder="Task title..."
                                          className="flex-1 py-1 px-2 bg-black/[0.03] border border-black/10 rounded-lg font-medium text-[#1A1B1F] text-xs outline-none focus:bg-white focus:border-[#0A84FF]"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removePlanTask(msg.id, idx)}
                                          className="text-[#8E8E93] hover:text-red-500 p-1 cursor-pointer shrink-0"
                                          title="Remove task"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>
                                      </div>

                                      {/* Secondary Row: Date, Time, Duration, Impact, Recurrence */}
                                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                        <div className="flex items-center gap-1 bg-black/[0.03] px-2 py-0.5 rounded-md border border-black/10">
                                          <span className="text-[#8E8E93] text-[10px]">Date</span>
                                          <input
                                            type="date"
                                            value={t.plannedDate || ''}
                                            onChange={(e) => updatePlanTask(msg.id, idx, 'plannedDate', e.target.value)}
                                            className="bg-transparent font-mono text-[#1A1B1F] outline-none text-[11px]"
                                          />
                                        </div>

                                        <div className="flex items-center gap-1 bg-black/[0.03] px-2 py-0.5 rounded-md border border-black/10">
                                          <span className="text-[#8E8E93] text-[10px]">Time</span>
                                          <input
                                            type="time"
                                            value={t.startTime || ''}
                                            onChange={(e) => updatePlanTask(msg.id, idx, 'startTime', e.target.value)}
                                            className="bg-transparent font-mono text-[#1A1B1F] outline-none text-[11px]"
                                          />
                                        </div>

                                        <div className="flex items-center gap-1 bg-black/[0.03] px-2 py-0.5 rounded-md border border-black/10">
                                          <span className="text-[#8E8E93] text-[10px]">Effort</span>
                                          <select
                                            value={t.durationMinutes || 45}
                                            onChange={(e) => updatePlanTask(msg.id, idx, 'durationMinutes', Number(e.target.value))}
                                            className="bg-transparent font-semibold text-[#1A1B1F] outline-none text-[11px]"
                                          >
                                            <option value={15}>15m</option>
                                            <option value={30}>30m</option>
                                            <option value={45}>45m</option>
                                            <option value={60}>60m (1h)</option>
                                            <option value={90}>90m (1.5h)</option>
                                            <option value={120}>120m (2h)</option>
                                            <option value={150}>150m (2.5h)</option>
                                            <option value={180}>180m (3h)</option>
                                          </select>
                                        </div>

                                        <div className="flex items-center gap-1 bg-black/[0.03] px-2 py-0.5 rounded-md border border-black/10">
                                          <span className="text-[#8E8E93] text-[10px]">Impact</span>
                                          <select
                                            value={t.impact || 'medium'}
                                            onChange={(e) => updatePlanTask(msg.id, idx, 'impact', e.target.value)}
                                            className="bg-transparent font-semibold text-[#1A1B1F] outline-none text-[11px]"
                                          >
                                            <option value="high">High</option>
                                            <option value="medium">Medium</option>
                                            <option value="low">Low</option>
                                          </select>
                                        </div>

                                        <div className="flex items-center gap-1 bg-black/[0.03] px-2 py-0.5 rounded-md border border-black/10">
                                          <span className="text-[#8E8E93] text-[10px]">Repeat</span>
                                          <select
                                            value={t.recurrence || 'none'}
                                            onChange={(e) => updatePlanTask(msg.id, idx, 'recurrence', e.target.value)}
                                            className="bg-transparent font-semibold text-teal-700 outline-none text-[11px]"
                                          >
                                            <option value="none">No repeat</option>
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                          </select>
                                        </div>

                                        <div className="flex items-center gap-1 bg-black/[0.03] px-2 py-0.5 rounded-md border border-black/10">
                                          <span className="text-[#8E8E93] text-[10px]">Deadline</span>
                                          <input
                                            type="date"
                                            value={t.deadlineDate || ''}
                                            onChange={(e) => updatePlanTask(msg.id, idx, 'deadlineDate', e.target.value || null)}
                                            className="bg-transparent font-mono text-rose-700 outline-none text-[11px]"
                                            title="Optional Deadline"
                                          />
                                        </div>
                                      </div>

                                      {/* Third Row: Goal & Habit Linking */}
                                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-black/[0.04]">
                                        <div className="flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[13px] text-blue-600">flag</span>
                                          <select
                                            value={t.goalIndex !== undefined && t.goalIndex !== null ? `plan-${t.goalIndex}` : (t.existingGoalId || '')}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (val === '') {
                                                updatePlanTask(msg.id, idx, 'goalIndex', null);
                                                updatePlanTask(msg.id, idx, 'existingGoalId', null);
                                              } else if (val.startsWith('plan-')) {
                                                updatePlanTask(msg.id, idx, 'goalIndex', Number(val.replace('plan-', '')));
                                                updatePlanTask(msg.id, idx, 'existingGoalId', null);
                                              } else {
                                                updatePlanTask(msg.id, idx, 'existingGoalId', val);
                                                updatePlanTask(msg.id, idx, 'goalIndex', null);
                                              }
                                            }}
                                            className="bg-black/[0.03] border border-black/10 rounded px-1.5 py-0.5 text-[11px] text-blue-700 outline-none max-w-[170px] truncate"
                                            title="Linked Goal / Horizon"
                                          >
                                            <option value="">No Linked Goal</option>
                                            {Array.isArray(msg.plan.goals) && msg.plan.goals.map((g, gIdx) => (
                                              <option key={`ptg-${gIdx}`} value={`plan-${gIdx}`}>★ {g.title}</option>
                                            ))}
                                            {goals.map(g => (
                                              <option key={`etg-${g.id}`} value={g.id}>Goal: {g.title}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[13px] text-rose-500">repeat</span>
                                          <select
                                            value={t.habitIndex !== undefined && t.habitIndex !== null ? `plan-${t.habitIndex}` : (t.existingHabitId || '')}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (val === '') {
                                                updatePlanTask(msg.id, idx, 'habitIndex', null);
                                                updatePlanTask(msg.id, idx, 'existingHabitId', null);
                                              } else if (val.startsWith('plan-')) {
                                                updatePlanTask(msg.id, idx, 'habitIndex', Number(val.replace('plan-', '')));
                                                updatePlanTask(msg.id, idx, 'existingHabitId', null);
                                              } else {
                                                updatePlanTask(msg.id, idx, 'existingHabitId', val);
                                                updatePlanTask(msg.id, idx, 'habitIndex', null);
                                              }
                                            }}
                                            className="bg-black/[0.03] border border-black/10 rounded px-1.5 py-0.5 text-[11px] text-rose-700 outline-none max-w-[170px] truncate"
                                            title="Linked Habit"
                                          >
                                            <option value="">No Linked Habit</option>
                                            {Array.isArray(msg.plan.habits) && msg.plan.habits.map((h, hIdx) => (
                                              <option key={`pth-${hIdx}`} value={`plan-${hIdx}`}>★ {h.title}</option>
                                            ))}
                                            {habits.map(h => (
                                              <option key={`eth-${h.id}`} value={h.id}>Habit: {h.title}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      {/* Fourth Row: Subtask Checklist Lines */}
                                      <div className="pt-1 border-t border-black/[0.04]">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">Subtasks (1 step per line)</span>
                                          <span className="text-[10px] text-[#BBBBC0]">{(t.subtasks || []).length} steps</span>
                                        </div>
                                        <textarea
                                          rows={2}
                                          value={(t.subtasks || []).map(s => s.title || s).join('\n')}
                                          onChange={(e) => updatePlanSubtasks(msg.id, idx, e.target.value)}
                                          placeholder="Step 1&#10;Step 2&#10;Step 3..."
                                          className="w-full p-1.5 bg-black/[0.03] border border-black/10 rounded text-[11px] font-mono leading-relaxed outline-none focus:bg-white focus:border-[#0A84FF]"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className="font-medium text-[#1A1B1F] text-xs">{t.title}</p>
                                          
                                          {/* Recurrence Badge */}
                                          {t.recurrence && t.recurrence !== 'none' && (
                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/50">
                                              <span className="material-symbols-outlined text-[10px]">sync</span>
                                              <span className="capitalize">{t.recurrence}</span>
                                            </span>
                                          )}

                                          {/* Impact Badge */}
                                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                            t.impact === 'high' ? 'bg-amber-50 text-amber-800 border border-amber-200/60' : 'bg-black/[0.04] text-[#64748B]'
                                          }`}>
                                            {t.impact || 'medium'}
                                          </span>

                                          {/* Duration */}
                                          <span className="text-[10px] font-mono text-[#8E8E93]">
                                            {t.durationMinutes || 45}m
                                          </span>

                                          {/* Deadline Badge */}
                                          {t.deadlineDate && (
                                            <span className="text-[9px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200/60">
                                              due {t.deadlineDate}
                                            </span>
                                          )}

                                          {/* Linked Goal Badge */}
                                          {(() => {
                                            const linkedGoalTitle = typeof t.goalIndex === 'number'
                                              ? msg.plan.goals?.[t.goalIndex]?.title
                                              : (goals.find(g => g.id === t.existingGoalId)?.title || t.goalTitle);
                                            return linkedGoalTitle ? (
                                              <span className="text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-mono truncate max-w-[130px] border border-blue-200/60" title={`Goal: ${linkedGoalTitle}`}>
                                                ★ {linkedGoalTitle}
                                              </span>
                                            ) : null;
                                          })()}

                                          {/* Linked Habit Badge */}
                                          {(() => {
                                            const linkedHabitTitle = typeof t.habitIndex === 'number'
                                              ? msg.plan.habits?.[t.habitIndex]?.title
                                              : (habits.find(h => h.id === t.existingHabitId)?.title || t.habitTitle);
                                            return linkedHabitTitle ? (
                                              <span className="text-[9px] text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded font-mono truncate max-w-[130px] border border-rose-200/60" title={`Habit: ${linkedHabitTitle}`}>
                                                ↻ {linkedHabitTitle}
                                              </span>
                                            ) : null;
                                          })()}
                                        </div>

                                        {/* Subtasks Preview */}
                                        {Array.isArray(t.subtasks) && t.subtasks.length > 0 && (
                                          <p className="text-[10px] text-[#8E8E93] truncate mt-0.5">
                                            {t.subtasks.length} steps: {t.subtasks.map(s => s.title || s).slice(0, 3).join(', ')}{t.subtasks.length > 3 ? '...' : ''}
                                          </p>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-[#8E8E93] font-mono shrink-0">
                                        {t.plannedDate} {t.startTime ? `• ${t.startTime}` : ''}
                                      </span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Approve Button */}
                        <div className="pt-2">
                          {isPlanApplied ? (
                            <div className="w-full py-2 rounded-lg bg-emerald-50 text-emerald-700 font-semibold text-xs flex items-center justify-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px]">check</span>
                              <span>Added to Schedule</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApprovePlan(msg.id, msg.plan)}
                              className="w-full py-2.5 rounded-lg bg-[#1A1B1F] hover:bg-black text-white text-xs font-semibold shadow-xs transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <span>Add to Schedule</span>
                              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                            </button>
                          )}
                        </div>
                      </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          {isParsingDoc && (
            <div className="flex items-center gap-2 text-xs text-[#8E8E93] animate-pulse">
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              <span>Reading document...</span>
            </div>
          )}

          {isGenerating && (
            <div className="flex items-center gap-2 text-xs text-[#8E8E93] animate-pulse">
              <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
              <span>Formulating schedule...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Document Pill (Clean Apple-Style Tag) */}
        {attachedDoc && (
          <div className="mx-4 mb-2 p-2 px-3 rounded-xl bg-black/[0.03] border border-black/[0.06] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs text-[#1A1B1F] truncate">
              <span className="material-symbols-outlined text-[16px] text-[#8E8E93]">description</span>
              <span className="font-medium truncate">{attachedDoc.name}</span>
              <span className="text-[11px] text-[#8E8E93]">({Math.round(attachedDoc.charCount / 5)} words)</span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedDoc(null)}
              className="text-[#8E8E93] hover:text-[#1A1B1F] p-0.5 transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          </div>
        )}

        {/* Input Bar (Raycast / Linear style composer) */}
        <footer className="p-3 sm:p-4 border-t border-black/[0.06] bg-white shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="flex items-center gap-2 bg-[#F5F5F7] p-1.5 px-2.5 rounded-xl border border-black/[0.04] focus-within:bg-white focus-within:border-black/[0.15] transition"
          >
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.docx,.txt,.md,.markdown,.json,.csv"
              className="hidden"
            />

            {/* Attach Icon */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach document (PDF, DOCX, TXT)"
              className="text-[#8E8E93] hover:text-[#1A1B1F] p-1 rounded-lg transition cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[19px]">attach_file</span>
            </button>

            {/* Input */}
            <input
              ref={textareaRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={attachedDoc ? "Add instruction or press Enter..." : "Ask Copilot or attach a file..."}
              className="flex-1 py-1.5 text-[13px] bg-transparent text-[#1A1B1F] placeholder-[#8E8E93] outline-none"
            />

            {/* Send Arrow */}
            <button
              type="submit"
              disabled={(!input.trim() && !attachedDoc) || isGenerating}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition shrink-0 cursor-pointer ${
                (input.trim() || attachedDoc) && !isGenerating
                  ? 'bg-[#1A1B1F] text-white shadow-2xs active:scale-95'
                  : 'text-[#C7C7CC] cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            </button>
          </form>
        </footer>
      </>
    )}
  </div>
</div>
);
}
