import React, { useCallback, useEffect, useRef, useState } from 'react';

export type ToastType = 'info' | 'success' | 'error';
export type Toast = { id: string; message: string; type: ToastType; duration: number; actionLabel?: string; onAction?: () => void };

let pushToast: ((t: Omit<Toast, 'id'>) => void) | null = null;

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const toast = (message: string, type: ToastType = 'info', duration = 2400) => {
  try {
    pushToast?.({ message, type, duration });
  } catch {
    // ignore toast errors
  }
};

export const toastAction = (
  message: string,
  actionLabel: string,
  onAction: () => void,
  type: ToastType = 'info',
  duration = 4000,
) => {
  try {
    pushToast?.({ message, type, duration, actionLabel, onAction });
  } catch {
    // ignore toast errors
  }
};

export function ToastProvider({ children }: React.PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, any>>({});

  const remove = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const tm = timers.current[id];
    if (tm) clearTimeout(tm);
    delete timers.current[id];
  }, []);

  useEffect(() => {
    pushToast = ({ message, type, duration }: Omit<Toast, 'id'>) => {
      const id = genId();
      setToasts((list) => [...list, { id, message, type, duration }]);
      timers.current[id] = setTimeout(() => remove(id), duration);
    };
    return () => {
      pushToast = null;
      Object.values(timers.current).forEach((tm) => clearTimeout(tm));
      timers.current = {};
    };
  }, [remove]);

  return (
    <>
      {children}
      {/* aria-live region for non-blocking feedback */}
      <div className="fixed bottom-4 left-0 right-0 z-[100] pointer-events-none">
        <div className="max-w-md mx-auto px-3 space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              aria-live={t.type === 'error' ? 'assertive' : 'polite'}
              className={`pointer-events-auto rounded-2xl px-3 py-2 text-sm shadow-md ring-1 ring-black/5 backdrop-blur flex items-start gap-2 ${
                t.type === 'success'
                  ? 'bg-emerald-600 text-white'
                  : t.type === 'error'
                  ? 'bg-rose-600 text-white'
                  : 'bg-zinc-900/90 text-white'
              }`}
            >
              <span className="flex-1">{t.message}</span>
              {t.actionLabel && (
                <button
                  className="rounded px-2 py-1 text-white/90 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  onClick={() => { try { t.onAction?.(); } finally { remove(t.id); } }}
                >
                  {t.actionLabel}
                </button>
              )}
              <button
                className="text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded px-1"
                aria-label="Luk besked"
                onClick={() => remove(t.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
