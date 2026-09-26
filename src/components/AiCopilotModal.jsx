import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { parseDocumentFile } from '../lib/documentParser';
import { generateExecutivePlanWithAI, hasUserApiKey } from '../lib/groqClient';
import { todayPlanDate } from '../lib/taskMetadata';

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
  addGoal,
  addHabit,
  addTask,
  onOpenApiKeyModal
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachedDoc, setAttachedDoc] = useState(null);
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [appliedPlans, setAppliedPlans] = useState(new Set());

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

    if (!hasUserApiKey()) {
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
        chatHistory: messages.slice(-5),
        goals,
        habits,
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

    const goalIdMap = new Map();
    const habitIdMap = new Map();

    // 1. Create Goals
    if (Array.isArray(plan.goals)) {
      plan.goals.forEach((g, idx) => {
        const id = 'g' + (Date.now() + idx);
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
      });
    }

    // 2. Create Habits
    if (Array.isArray(plan.habits)) {
      plan.habits.forEach((h, idx) => {
        const id = 'h' + (Date.now() + idx + 100);
        const linkedGoalId = h.goalIndex !== undefined && goalIdMap.has(h.goalIndex)
          ? goalIdMap.get(h.goalIndex)
          : null;

        addHabit({
          id,
          title: h.title,
          cadence: h.cadence || 'Morning',
          targetFrequency: h.frequency || 'Every Day',
          duration: h.duration || '30 mins',
          icon: h.icon || 'cached',
          colorToken: h.colorToken || 'primary',
          linkedGoal: linkedGoalId ? plan.goals[h.goalIndex]?.title : ''
        });
        habitIdMap.set(idx, id);
      });
    }

    // 3. Create & Schedule Tasks
    if (Array.isArray(plan.tasks)) {
      plan.tasks.forEach((t, idx) => {
        const id = Date.now() + idx + 200;
        const linkedGoalId = t.goalIndex !== undefined && goalIdMap.has(t.goalIndex)
          ? goalIdMap.get(t.goalIndex)
          : t.existingGoalId || null;

        const linkedHabitId = t.habitIndex !== undefined && habitIdMap.has(t.habitIndex)
          ? habitIdMap.get(t.habitIndex)
          : null;

        addTask({
          id,
          title: t.title,
          plannedDate: t.plannedDate || todayPlanDate(),
          startTime: t.startTime || null,
          duration: t.durationMinutes || 45,
          impact: t.impact || 'medium',
          priority: t.priority || 'normal',
          areas: Array.isArray(t.areas) ? t.areas : ['Career & Craft'],
          goalId: linkedGoalId,
          linkedHabitId,
          completed: false,
          dueDate: t.plannedDate ? 'Today' : 'This Week'
        });
      });
    }

    setAppliedPlans(prev => new Set([...prev, messageId]));

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
        <header className="px-5 py-3 border-b border-black/[0.06] flex items-center justify-between shrink-0 bg-white select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h3 className="font-semibold text-[13px] text-[#1A1B1F] tracking-tight">Copilot</h3>
            <span className="text-[#8E8E93] text-[12px]">• Plan &amp; Schedule</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-[#8E8E93] hover:text-[#1A1B1F] hover:bg-black/[0.04] flex items-center justify-center transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </header>

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
                    {msg.hasPlan && msg.plan && (
                      <div className="mt-3 p-4 rounded-xl bg-black/[0.02] border border-black/[0.08] space-y-3.5">
                        <div className="flex items-center justify-between border-b border-black/[0.06] pb-2">
                          <span className="font-semibold text-xs text-[#1A1B1F]">
                            Proposed Schedule
                          </span>
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
                              <div key={idx} className="p-2 rounded-lg bg-white border border-black/[0.05] text-xs flex items-center justify-between">
                                <span className="font-medium text-[#1A1B1F]">{g.title}</span>
                                <span className="text-[10px] text-[#8E8E93] uppercase font-mono">{g.category || 'career'}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Habits */}
                        {Array.isArray(msg.plan.habits) && msg.plan.habits.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Daily Rituals</span>
                            {msg.plan.habits.map((h, idx) => (
                              <div key={idx} className="p-2 rounded-lg bg-white border border-black/[0.05] text-xs flex items-center justify-between">
                                <span className="font-medium text-[#1A1B1F]">{h.title}</span>
                                <span className="text-[10px] text-[#8E8E93]">{h.frequency || h.cadence}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Tasks Timeline */}
                        {Array.isArray(msg.plan.tasks) && msg.plan.tasks.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Execution Timeline</span>
                            <div className="space-y-1 max-h-44 overflow-y-auto">
                              {msg.plan.tasks.map((t, idx) => (
                                <div key={idx} className="p-2 rounded-lg bg-white border border-black/[0.05] text-xs flex items-center justify-between">
                                  <span className="truncate pr-2 font-medium text-[#1A1B1F]">{t.title}</span>
                                  <span className="text-[10px] text-[#8E8E93] font-mono shrink-0">
                                    {t.plannedDate} {t.startTime ? `• ${t.startTime}` : ''}
                                  </span>
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
                    )}
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
      </div>
    </div>
  );
}
