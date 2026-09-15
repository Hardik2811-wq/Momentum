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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-black/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.18)] overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isDanger ? 'bg-red-50 text-red-500' : 'bg-primary-fixed text-primary'
            }`}>
              <span className="material-symbols-outlined text-[20px]">
                {isDanger ? 'warning' : 'help'}
              </span>
            </div>
            <h3 className="text-[15px] font-semibold text-[#1A1B1F] tracking-tight">
              {title}
            </h3>
          </div>
          <p className="text-[13px] text-[#71717A] leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-[#F9F9FB] border-t border-black/[0.05]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-[12px] font-medium text-[#71717A] hover:bg-black/[0.05] transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all active:scale-95 shadow-sm ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
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
