import React, { useState } from 'react';

export default function DeleteGoalModal({
  isOpen,
  goal,
  connectedTasksCount = 0,
  connectedHabitsCount = 0,
  onConfirm,
  onCancel
}) {
  const [deleteMode, setDeleteMode] = useState('cascade'); // 'cascade' | 'unlink'

  if (!isOpen || !goal) return null;

  const totalConnected = connectedTasksCount + connectedHabitsCount;

  const handleConfirm = () => {
    onConfirm({
      cascade: deleteMode === 'cascade'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-fadeIn">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[390px] rounded-3xl bg-white border border-black/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.04)] p-6 sm:p-7 flex flex-col items-center text-center transform transition-all animate-scaleIn"
      >
        {/* Playful Illustrated Trash with Floating Sparkle Dots */}
        <div className="relative mb-3 flex items-center justify-center">
          <div className="relative w-16 h-16 flex items-center justify-center">
            {/* Sparkle micro-dots */}
            <span className="absolute top-1 left-2 w-1.5 h-1.5 rounded-full bg-red-300 animate-pulse"></span>
            <span className="absolute top-0 right-3 w-1 h-1 rounded-full bg-red-400"></span>
            <span className="absolute bottom-2 left-1 w-1 h-1 rounded-full bg-red-300"></span>
            <span className="absolute top-4 right-1 w-1.5 h-1.5 rounded-full bg-red-300"></span>
            <span className="absolute bottom-3 right-2 w-1 h-1 rounded-full bg-red-400"></span>

            {/* Illustrated Trash Can SVG with Tilted Lid */}
            <svg
              className="w-12 h-12 text-[#E5484D] drop-shadow-sm transition-transform hover:scale-105"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Tilted Lid */}
              <g transform="rotate(-12 24 16)">
                <rect x="18" y="9" width="12" height="3" rx="1.5" fill="currentColor" opacity="0.9" />
                <rect x="11" y="12" width="26" height="3.5" rx="1.75" fill="currentColor" />
              </g>
              {/* Can Body */}
              <path
                d="M15 17H33L31.2 38.2C31.05 39.75 29.75 41 28.2 41H19.8C18.25 41 16.95 39.75 16.8 38.2L15 17Z"
                fill="currentColor"
                opacity="0.15"
              />
              <path
                d="M15 17L16.8 38.2C16.95 39.75 18.25 41 19.8 41H28.2C29.75 41 31.05 39.75 31.2 38.2L33 17"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Vertical Ribs */}
              <line x1="21" y1="23" x2="21" y2="34" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="27" y1="23" x2="27" y2="34" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Modal Title */}
        <h3 className="text-[18px] font-semibold text-[#1A1B1F] tracking-tight leading-snug mb-1">
          Delete Strategic Goal?
        </h3>

        {/* Subtitle / Question */}
        <p className="text-[12px] text-[#71717A] mb-4">
          Choose how to handle linked deliverables for <span className="font-semibold text-[#1A1B1F]">"{goal.title}"</span>:
        </p>

        {/* Two Selectable Choice Cards */}
        <div className="w-full flex flex-col gap-2.5 mb-6 text-left">
          {/* Option 1: Delete Goal & All Connected Items */}
          <div
            onClick={() => setDeleteMode('cascade')}
            className={`cursor-pointer p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
              deleteMode === 'cascade'
                ? 'bg-red-50/70 border-[#E5484D]/40 shadow-xs ring-1 ring-[#E5484D]/30'
                : 'bg-white border-black/[0.08] hover:border-black/[0.15]'
            }`}
          >
            <div className="mt-0.5">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                deleteMode === 'cascade'
                  ? 'border-[#E5484D] bg-[#E5484D] text-white'
                  : 'border-black/[0.25] bg-white'
              }`}>
                {deleteMode === 'cascade' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
              </span>
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[#1A1B1F] leading-tight mb-0.5">
                Delete Goal & All Connected Items
              </div>
              <p className="text-[11px] text-[#71717A] leading-relaxed">
                Purges {connectedTasksCount} connected {connectedTasksCount === 1 ? 'task' : 'tasks'}
                {connectedHabitsCount > 0 ? ` and ${connectedHabitsCount} linked ${connectedHabitsCount === 1 ? 'habit' : 'habits'}` : ''}.
              </p>
            </div>
          </div>

          {/* Option 2: Keep Tasks & Habits (Unlink Only) */}
          <div
            onClick={() => setDeleteMode('unlink')}
            className={`cursor-pointer p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
              deleteMode === 'unlink'
                ? 'bg-blue-50/70 border-[#0A84FF]/40 shadow-xs ring-1 ring-[#0A84FF]/30'
                : 'bg-white border-black/[0.08] hover:border-black/[0.15]'
            }`}
          >
            <div className="mt-0.5">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                deleteMode === 'unlink'
                  ? 'border-[#0A84FF] bg-[#0A84FF] text-white'
                  : 'border-black/[0.25] bg-white'
              }`}>
                {deleteMode === 'unlink' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
              </span>
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[#1A1B1F] leading-tight mb-0.5">
                Keep Tasks & Habits (Unlink Only)
              </div>
              <p className="text-[11px] text-[#71717A] leading-relaxed">
                Only deletes goal horizon; preserves {totalConnected > 0 ? `all ${totalConnected}` : ''} tasks & habits in backlog as standalone.
              </p>
            </div>
          </div>
        </div>

        {/* Pill Button Pair */}
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-full text-[13px] font-medium text-[#4B4B52] bg-white border border-black/[0.12] hover:bg-black/[0.03] active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-4 rounded-full text-[13px] font-semibold text-white bg-[#E5484D] hover:bg-[#D93D42] shadow-sm shadow-red-500/25 active:scale-[0.98] transition-all"
          >
            Delete Goal
          </button>
        </div>
      </div>
    </div>
  );
}
