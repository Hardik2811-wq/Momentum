import React, { useEffect, useRef } from 'react';
import { Toaster, toast } from 'sonner';

export default function ToastContainer({ toasts = [], dismissToast }) {
  const handledIdsRef = useRef(new Set());

  useEffect(() => {
    toasts.forEach((t) => {
      if (handledIdsRef.current.has(t.id)) return;
      handledIdsRef.current.add(t.id);

      const opts = {
        id: t.id,
        duration: t.duration || 4500,
        action: t.actionLabel && t.onAction ? {
          label: t.actionLabel,
          onClick: () => {
            t.onAction();
            dismissToast?.(t.id);
          }
        } : undefined,
        onDismiss: () => dismissToast?.(t.id),
      };

      if (t.type === 'error') {
        toast.error(t.message, opts);
      } else if (t.type === 'success') {
        toast.success(t.message, opts);
      } else {
        toast(t.message, opts);
      }
    });
  }, [toasts, dismissToast]);

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      theme="light"
      toastOptions={{
        className: 'rounded-2xl shadow-lg font-sans text-xs',
        style: {
          borderRadius: '1rem',
          padding: '0.85rem 1rem',
        }
      }}
    />
  );
}
