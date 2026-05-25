"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info";

export type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

type ToastMessage = {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
};

export type ToastApi = ReturnType<typeof useToast>;

function createToastId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useToast(duration = 3000) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "info", action?: ToastAction) => {
      const id = createToastId();
      setToasts((current) => [...current, { id, message, type, action }]);
      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss, duration],
  );

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) {
        window.clearTimeout(timer);
      }
      timers.current.clear();
    };
  }, []);

  return {
    toasts,
    dismiss,
    show,
    success: (message: string, action?: ToastAction) => show(message, "success", action),
    error: (message: string, action?: ToastAction) => show(message, "error", action),
    info: (message: string, action?: ToastAction) => show(message, "info", action),
  };
}

export function ToastViewport({ toast }: { toast: ToastApi }) {
  if (toast.toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toast.toasts.map((item) => (
        <div key={item.id} className={`toast toast-${item.type}`}>
          <span>{item.message}</span>
          <div className="toast-actions">
            {item.action && (
              <button
                className="toast-action"
                type="button"
                onClick={async () => {
                  await item.action?.onClick();
                  toast.dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            )}
            <button className="toast-close" type="button" aria-label="关闭提示" onClick={() => toast.dismiss(item.id)}>
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
