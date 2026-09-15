import React from 'react';

export default function ToastContainer({ toasts = [], dismissToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside aria-label="System notifications" className="fixed top-16 md:top-auto md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm ml-auto">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#1A1B1F] text-white shadow-[0_12px_36px_rgba(0,0,0,0.25)] border border-white/10 animate-fadeIn transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-[#0A84FF] shrink-0">
              {toast.type === 'error' ? 'error' : 'info'}
            </span>
            <span className="text-[12px] font-medium truncate">
              {toast.message}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {toast.actionLabel && toast.onAction && (
              <button
                onClick={() => {
                  toast.onAction();
                  dismissToast(toast.id);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold uppercase tracking-wider text-[#0A84FF] transition-colors"
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      ))}
    </aside>
  );
}
