import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { parseDocumentFile } from '../lib/documentParser';
import { generateExecutivePlanWithAI, hasUserApiKey } from '../lib/groqClient';
import { todayPlanDate } from '../lib/taskMetadata';

const STARTER_PROMPTS = [
  { label: 'Upload project doc & schedule tasks', prompt: 'I have attached a document. Please review it and extract key goals, daily habits, and scheduled tasks.' },
  { label: 'Build 30-day fitness & energy habit plan', prompt: 'Create an achievable 30-day health & vitality plan with morning workouts, hydration habits, and scheduled exercise sessions.' },
  { label: 'Plan product launch week schedule', prompt: 'Help me plan a high-impact launch week. Create goals for deployment, daily check-in habits, and timed execution tasks.' }
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
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your Executive AI Copilot. Drop or attach any **PDF, Word (.docx), or text document**, and I will analyze it to suggest an execution plan with scheduled tasks, daily habits, and strategic horizons for you to approve in 1 click.',
      hasPlan: false
    }
  ]);
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
      content: query || `Please analyze this document: ${attachedDoc?.name}`,
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
            content: `⚠️ ${result.error || 'Failed to generate plan. Please try again or check your API key.'}`,
            hasPlan: false
          }
        ]);
        return;
      }

      const data = result.data;
      const assistantMsg = {
        id: 'asst-' + Date.now(),
        role: 'assistant',
        content: data.message || 'Here is your strategic execution blueprint:',
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
          content: `⚠️ Error communicating with AI: ${err.message}`,
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
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-2xl h-[92vh] sm:h-[85vh] sm:max-h-[760px] bg-[#FBFBFE] sm:rounded-3xl border-t sm:border border-black/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden text-[#1A1B1F] transition-all animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        
        {/* Mobile Grabber */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-white shrink-0">
          <div className="w-10 h-1 bg-black/15 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-black/[0.06] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#0A84FF] to-[#8B5CF6] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-tight text-[#1A1B1F]">Executive AI Copilot</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-blue-50 text-[#0A84FF] border border-blue-200/60 tracking-wider">
                  Llama 3.3 70B
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Upload documents &amp; plan schedules autonomously
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-[#64748B] hover:text-[#1A1B1F] hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Chat / Messages scroll area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#F5F4FA]/70">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isPlanApplied = appliedPlans.has(msg.id);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
              >
                {/* Message Bubble */}
                <div
                  className={`p-4 rounded-2xl max-w-[92%] sm:max-w-[85%] text-xs sm:text-[13px] leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-gradient-to-tr from-[#0A84FF] to-[#5E5CE6] text-white rounded-br-xs shadow-blue-500/20'
                      : 'bg-white border border-black/[0.06] text-[#1A1B1F] rounded-bl-xs'
                  }`}
                >
                  {msg.docName && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/90 mb-2 pb-1.5 border-b border-white/20">
                      <span className="material-symbols-outlined text-[15px]">description</span>
                      <span>Attached: {msg.docName}</span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>

                {/* Structured Plan Blueprint Card */}
                {msg.hasPlan && msg.plan && (
                  <div className="mt-3 w-full max-w-[96%] sm:max-w-[90%] p-4 rounded-2xl bg-white border border-[#0A84FF]/30 shadow-lg space-y-3.5 animate-fadeIn text-[#1A1B1F]">
                    <div className="flex items-center justify-between border-b border-black/[0.06] pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0A84FF] animate-pulse" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-[#0A84FF]">
                          Proposed Blueprint
                        </h4>
                      </div>
                      <span className="text-[11px] font-semibold text-[#64748B]">
                        {msg.plan.summary}
                      </span>
                    </div>

                    {/* Goals detected */}
                    {Array.isArray(msg.plan.goals) && msg.plan.goals.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-amber-500">flag</span>
                          <span>Strategic Horizons ({msg.plan.goals.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {msg.plan.goals.map((g, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-[#F8F8FB] border border-black/[0.04] text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#1A1B1F]">{g.title}</span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200/60 uppercase">
                                  {g.category || 'career'}
                                </span>
                              </div>
                              {g.why && <p className="text-[11px] text-[#64748B] mt-0.5">{g.why}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Habits detected */}
                    {Array.isArray(msg.plan.habits) && msg.plan.habits.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-purple-500">cached</span>
                          <span>Daily Driving Habits ({msg.plan.habits.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.plan.habits.map((h, idx) => (
                            <div key={idx} className="p-2 rounded-xl bg-[#F8F8FB] border border-black/[0.04] flex items-center justify-between text-xs">
                              <span className="font-semibold text-[#1A1B1F] truncate">{h.title}</span>
                              <span className="text-[10px] text-purple-600 font-bold ml-2 shrink-0">{h.frequency || h.cadence}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tasks timeline */}
                    {Array.isArray(msg.plan.tasks) && msg.plan.tasks.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-blue-500">schedule</span>
                          <span>Execution Deliverables ({msg.plan.tasks.length} Scheduled)</span>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                          {msg.plan.tasks.map((t, idx) => (
                            <div key={idx} className="p-2 rounded-xl bg-[#F8F8FB] border border-black/[0.04] flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 truncate">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#0A84FF]" />
                                <span className="font-medium text-[#1A1B1F] truncate">{t.title}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-[#64748B] font-mono">
                                {t.plannedDate && <span>{t.plannedDate}</span>}
                                {t.startTime && <span>{t.startTime}</span>}
                                <span>({t.durationMinutes || 45}m)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Approval Action */}
                    <div className="pt-2 border-t border-black/[0.06]">
                      {isPlanApplied ? (
                        <div className="w-full py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-xs flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px]">verified</span>
                          <span>Plan Scheduled &amp; Active in Momentum!</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApprovePlan(msg.id, msg.plan)}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] hover:opacity-95 text-white font-bold text-xs shadow-md shadow-blue-500/25 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          <span>Approve &amp; Schedule Blueprint (1-Click)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Starter Quick Chips */}
          {messages.length === 1 && !isGenerating && !isParsingDoc && (
            <div className="pt-2 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] px-1">
                Suggested Actions
              </span>
              <div className="flex flex-col gap-2">
                {STARTER_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    className="p-3 rounded-xl bg-white border border-black/[0.06] hover:border-[#0A84FF] hover:bg-blue-50/40 text-left transition text-xs font-semibold text-[#1A1B1F] flex items-center justify-between group cursor-pointer shadow-2xs"
                  >
                    <span>{item.label}</span>
                    <span className="material-symbols-outlined text-[16px] text-[#64748B] group-hover:text-[#0A84FF] transition">arrow_forward</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isParsingDoc && (
            <div className="flex items-center gap-2 text-xs text-[#64748B] italic animate-pulse p-2">
              <span className="material-symbols-outlined text-[18px] animate-spin text-[#0A84FF]">sync</span>
              <span>Extracting document text with browser reader...</span>
            </div>
          )}

          {isGenerating && (
            <div className="flex items-center gap-2 text-xs text-[#0A84FF] font-medium animate-pulse p-2">
              <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
              <span>Formulating strategic execution plan...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Document Attachment Pill (Preview above input) */}
        {attachedDoc && (
          <div className="px-4 py-2.5 bg-blue-50 border-t border-blue-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0A84FF] truncate">
              <span className="material-symbols-outlined text-[18px]">attach_file</span>
              <span className="truncate">{attachedDoc.name}</span>
              <span className="text-[10px] font-normal text-slate-500">({Math.round(attachedDoc.charCount / 5)} words)</span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedDoc(null)}
              className="text-[#64748B] hover:text-red-500 p-1 transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-3 sm:p-4 border-t border-black/[0.06] bg-white shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2 bg-[#F8F8FC] p-2 rounded-2xl border border-black/[0.06] focus-within:border-[#0A84FF] focus-within:bg-white transition shadow-2xs">
            
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.docx,.txt,.md,.markdown,.json,.csv"
              className="hidden"
            />

            {/* Paperclip Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach PDF, DOCX, TXT, or MD"
              className="w-9 h-9 rounded-xl text-[#64748B] hover:text-[#0A84FF] hover:bg-black/5 flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">attach_file</span>
            </button>

            {/* Auto-expanding Input Area */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={attachedDoc ? "Add instruction or press Enter to analyze document..." : "Ask to plan a project, break down goals, or attach a document..."}
              className="flex-1 max-h-32 min-h-[36px] py-1.5 px-2 bg-transparent text-xs sm:text-[13px] text-[#1A1B1F] placeholder-[#94A3B8] outline-none resize-none leading-relaxed"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!input.trim() && !attachedDoc) || isGenerating}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition shrink-0 cursor-pointer ${
                (input.trim() || attachedDoc) && !isGenerating
                  ? 'bg-[#0A84FF] text-white shadow-xs active:scale-95'
                  : 'bg-black/5 text-[#94A3B8] cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
            </button>
          </div>

          <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-[#64748B]">
            <span>Supports PDF, Word (.docx), TXT, Markdown</span>
            <span>Press Enter to send</span>
          </div>
        </form>
      </div>
    </div>
  );
}
