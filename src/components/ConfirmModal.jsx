import React from 'react';

export default function ConfirmModal({
  isOpen,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-fadeIn">
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="w-full max-w-[340px] rounded-3xl bg-white border border-black/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.04)] p-6 sm:p-7 flex flex-col items-center text-center transform transition-all animate-scaleIn"
      >
        {/* Playful Illustrated Trash / Icon with Floating Spark Dots */}
        <div className="relative mb-4 flex items-center justify-center">
          {isDanger ? (
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
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1">
              <span className="material-symbols-outlined text-[30px]">help_outline</span>
            </div>
          )}
        </div>

        {/* Modal Title */}
        <h3 className="text-[17px] sm:text-[18px] font-semibold text-[#1A1B1F] tracking-tight leading-snug mb-2">
          {title}
        </h3>

        {/* Modal Message */}
        <p className="text-[13px] text-[#71717A] leading-relaxed max-w-[270px] mb-6">
          {message}
        </p>

        {/* Pill Buttons Row */}
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-full text-[13px] font-medium text-[#4B4B52] bg-white border border-black/[0.12] hover:bg-black/[0.03] active:scale-[0.98] transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-full text-[13px] font-semibold text-white shadow-sm active:scale-[0.98] transition-all ${
              isDanger
                ? 'bg-[#E5484D] hover:bg-[#D93D42] shadow-red-500/25'
                : 'bg-[#0A84FF] hover:bg-[#0071E3] shadow-blue-500/25'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
